import pytest
from pydantic import BaseModel, Field

from app.modules.takeoff import registry
from app.modules.takeoff.contracts import BoqItem, ElementSpec, Issue
from app.modules.takeoff.observations import ObservationErrors, create_many, list_for

KEY = "box_count"


class BoxCount(BaseModel):
    n: int = Field(ge=1)
    side_m: float = Field(gt=0)


def measure(geometry, frame):
    x0, _, x1, _ = geometry.bbox
    return {"side_m": frame.to_metres(geometry.page_id, x1 - x0)}


def quantify(observed, frame):
    if any(o.data.n == 13 for o in observed):
        raise RuntimeError("unlucky")
    total = sum(o.data.n for o in observed)
    return [
        BoqItem(
            id="boxes",
            element=KEY,
            section="Test",
            description="Boxes",
            quantity=total,
            unit="nr",
            storey=None,
            observation_ids=[o.record.id for o in observed],
            basis=" + ".join(str(o.data.n) for o in observed),
        )
    ]


def check(observed, items, frame):
    return [
        Issue(code="too_many", message="More than 100", severity="error", observation_ids=[o.record.id])
        for o in observed
        if o.data.n > 100
    ]


@pytest.fixture(autouse=True)
def box_element():
    spec = registry.register(
        ElementSpec(
            key=KEY,
            display_name="Boxes",
            section="Test",
            observation_model=BoxCount,
            quantify=quantify,
            check=check,
            measure=measure,
        )
    )
    yield spec
    registry.unregister(KEY)


def scale_page(client, page_id, metres_per_pixel_100=1.0):
    """Points 100 px apart with a real distance, so metres per pixel is distance / 100."""
    client.put(
        f"/api/pages/{page_id}/scale",
        json={"method": "points", "p1": [0, 0], "p2": [100, 0], "distance_m": metres_per_pixel_100},
    )


@pytest.fixture
def frozen_project(client, project_with_pages):
    project_id, pages = project_with_pages
    scale_page(client, pages[0]["id"], 1.0)  # 0.01 m per pixel
    client.put(f"/api/projects/{project_id}/storeys", json=[{"name": "Ground", "level_m": 0}])
    client.post(f"/api/projects/{project_id}/frame/freeze")
    return project_id, pages[0]["id"]


@pytest.fixture
def frozen_project_no_scale(client, project_with_pages):
    project_id, pages = project_with_pages
    client.post(f"/api/projects/{project_id}/frame/freeze")
    return project_id, pages[0]["id"]


def obs_url(project_id, obs_id=None):
    base = f"/api/projects/{project_id}/elements/{KEY}/observations"
    return base if obs_id is None else f"{base}/{obs_id}"


def element(client, project_id):
    return client.get(f"/api/projects/{project_id}/elements/{KEY}").json()


def test_elements_api_lists_schema(client):
    listed = {e["key"]: e for e in client.get("/api/elements").json()}
    assert listed[KEY]["display_name"] == "Boxes"
    assert set(listed[KEY]["schema"]["properties"]) == {"n", "side_m"}


def test_unknown_element_404(client, frozen_project):
    project_id, _ = frozen_project
    assert client.get(f"/api/projects/{project_id}/elements/nope").status_code == 404


def test_manual_observation_flows_to_items(client, frozen_project):
    project_id, _ = frozen_project
    response = client.post(obs_url(project_id), json={"storey": "Ground", "values": {"n": 3, "side_m": 1.0}})
    assert response.status_code == 200
    record = response.json()
    assert record["source"] == "manual" and record["frame_version"] == 1

    result = element(client, project_id)
    assert result["frame_version"] == 1
    assert [o["id"] for o in result["observations"]] == [record["id"]]
    assert result["items"][0]["quantity"] == 3
    assert result["items"][0]["observation_ids"] == [record["id"]]
    assert result["issues"] == []


def test_box_without_scale_is_409(client, frozen_project_no_scale):
    project_id, page_id = frozen_project_no_scale
    response = client.post(
        obs_url(project_id),
        json={"geometry": {"page_id": page_id, "bbox": [0, 0, 100, 50]}, "values": {"n": 1}},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Set the scale for this page first"
    assert element(client, project_id)["observations"] == []


def test_measure_fills_values_from_box(client, frozen_project):
    project_id, page_id = frozen_project
    response = client.post(
        obs_url(project_id),
        json={"geometry": {"page_id": page_id, "bbox": [10, 10, 310, 60]}, "values": {"n": 1, "side_m": 99}},
    )
    assert response.json()["values"]["side_m"] == pytest.approx(3.0)


def test_bad_bbox_422(client, frozen_project):
    project_id, page_id = frozen_project
    response = client.post(
        obs_url(project_id),
        json={"geometry": {"page_id": page_id, "bbox": [50, 0, 10, 20]}, "values": {"n": 1}},
    )
    assert response.status_code == 422


def test_box_on_unknown_page_422(client, frozen_project):
    project_id, _ = frozen_project
    response = client.post(
        obs_url(project_id),
        json={"geometry": {"page_id": "nope", "bbox": [0, 0, 10, 20]}, "values": {"n": 1}},
    )
    assert response.status_code == 422


def test_invalid_values_422(client, frozen_project):
    project_id, _ = frozen_project
    assert client.post(obs_url(project_id), json={"values": {"n": 0, "side_m": 1}}).status_code == 422


def test_unknown_storey_422(client, frozen_project):
    project_id, _ = frozen_project
    response = client.post(obs_url(project_id), json={"storey": "Basement", "values": {"n": 1, "side_m": 1}})
    assert response.status_code == 422


def test_requires_current_frame_409(client, frozen_project):
    project_id, page_id = frozen_project
    scale_page(client, page_id, 2.0)
    response = client.post(obs_url(project_id), json={"values": {"n": 1, "side_m": 1}})
    assert response.status_code == 409
    assert response.json()["detail"] == "Freeze the frame first"


def test_update_and_delete(client, frozen_project):
    project_id, _ = frozen_project
    record = client.post(obs_url(project_id), json={"values": {"n": 1, "side_m": 1}}).json()
    updated = client.put(obs_url(project_id, record["id"]), json={"values": {"n": 5, "side_m": 1}})
    assert updated.status_code == 200 and updated.json()["values"]["n"] == 5
    assert element(client, project_id)["items"][0]["quantity"] == 5
    assert client.delete(obs_url(project_id, record["id"])).status_code == 204
    assert element(client, project_id)["observations"] == []
    assert client.delete(obs_url(project_id, record["id"])).status_code == 404


def test_check_issues_reported(client, frozen_project):
    project_id, _ = frozen_project
    client.post(obs_url(project_id), json={"values": {"n": 101, "side_m": 1}})
    assert [i["code"] for i in element(client, project_id)["issues"]] == ["too_many"]


def test_create_many_is_all_or_nothing(client, frozen_project, conn):
    project_id, _ = frozen_project
    with pytest.raises(ObservationErrors) as error:
        create_many(
            conn,
            project_id,
            KEY,
            [{"values": {"n": 1, "side_m": 1}}, {"values": {"n": 0}}],
            "agent",
        )
    assert error.value.errors[0]["index"] == 1
    assert list_for(conn, project_id, KEY, 1) == []


def test_create_many_saves_agent_source(client, frozen_project, conn):
    project_id, _ = frozen_project
    records = create_many(conn, project_id, KEY, [{"storey": "Ground", "values": {"n": 2, "side_m": 1}}], "agent")
    conn.commit()
    assert records[0].source == "agent"
    assert element(client, project_id)["items"][0]["quantity"] == 2


def test_refreeze_carries_and_remeasures(client, frozen_project):
    project_id, page_id = frozen_project
    box = {"page_id": page_id, "bbox": [0, 0, 300, 50]}
    first = client.post(obs_url(project_id), json={"geometry": box, "values": {"n": 1}}).json()
    client.post(obs_url(project_id), json={"values": {"n": 4, "side_m": 0.5}})
    assert first["values"]["side_m"] == pytest.approx(3.0)

    scale_page(client, page_id, 2.0)  # 0.02 m per pixel
    client.post(f"/api/projects/{project_id}/frame/freeze")

    result = element(client, project_id)
    assert result["frame_version"] == 2
    by_n = {o["values"]["n"]: o for o in result["observations"]}
    assert by_n[1]["values"]["side_m"] == pytest.approx(6.0)
    assert by_n[1]["frame_version"] == 2 and by_n[1]["id"] != first["id"]
    assert by_n[4]["values"]["side_m"] == pytest.approx(0.5)


def test_quantify_crash_becomes_issue(client, frozen_project):
    project_id, _ = frozen_project
    client.post(obs_url(project_id), json={"values": {"n": 13, "side_m": 1}})
    result = element(client, project_id)
    assert result["items"] == []
    assert [(i["code"], i["severity"]) for i in result["issues"]] == [("quantify_failed", "error")]


def test_element_before_freeze_is_empty(client, project_with_pages):
    project_id, _ = project_with_pages
    result = element(client, project_id)
    assert result["frame_version"] is None and result["observations"] == []


def test_agent_values_win_over_the_box(client, frozen_project, conn):
    project_id, page_id = frozen_project
    box = {"page_id": page_id, "bbox": [0, 0, 300, 50]}
    records = create_many(conn, project_id, KEY, [{"geometry": box, "values": {"n": 1, "side_m": 1.5}}], "agent")
    assert records[0].values["side_m"] == 1.5


def test_agent_box_fills_only_missing_values(client, frozen_project, conn):
    project_id, page_id = frozen_project
    box = {"page_id": page_id, "bbox": [0, 0, 300, 50]}
    records = create_many(conn, project_id, KEY, [{"geometry": box, "values": {"n": 1}}], "agent")
    assert records[0].values["side_m"] == pytest.approx(3.0)


def test_agent_on_unscaled_page_with_complete_values_is_saved(client, frozen_project_no_scale, conn):
    project_id, page_id = frozen_project_no_scale
    box = {"page_id": page_id, "bbox": [0, 0, 300, 50]}
    records = create_many(conn, project_id, KEY, [{"geometry": box, "values": {"n": 1, "side_m": 2.0}}], "agent")
    assert records[0].values["side_m"] == 2.0


def test_renamed_storey_after_refreeze_is_an_error(client, frozen_project):
    project_id, _ = frozen_project
    client.post(obs_url(project_id), json={"storey": "Ground", "values": {"n": 1, "side_m": 1}})
    client.put(f"/api/projects/{project_id}/storeys", json=[{"name": "GF", "level_m": 0}])
    client.post(f"/api/projects/{project_id}/frame/freeze")
    issues = element(client, project_id)["issues"]
    assert [(i["code"], i["severity"]) for i in issues] == [("unknown_storey", "error")]


def test_broken_measure_does_not_break_freeze(client, frozen_project, box_element):
    project_id, page_id = frozen_project
    client.post(
        obs_url(project_id), json={"geometry": {"page_id": page_id, "bbox": [0, 0, 300, 50]}, "values": {"n": 1}}
    )

    def broken(geometry, frame):
        raise ValueError("bug in measure")

    registry.unregister(KEY)
    registry.register(ElementSpec(**{**box_element.__dict__, "measure": broken}))
    response = client.post(f"/api/projects/{project_id}/frame/freeze")
    assert response.status_code == 200
    assert element(client, project_id)["observations"][0]["values"]["side_m"] == pytest.approx(3.0)
