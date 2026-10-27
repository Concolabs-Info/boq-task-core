import itertools

import pytest

from app.modules.pre.frame import Frame, PageFrame, Storey
from app.modules.takeoff.contracts import Geometry, ObservationRecord, Observed
from app.modules.takeoff.elements.example_pad_footing import PadFooting, check, measure, quantify

FRAME = Frame("p", 1, {"pg": PageFrame("pg", "d", 0, 1000, 800, 0.01)}, [Storey("Ground", 0.0)])
_ids = itertools.count(1)


def obs(storey="Ground", **values) -> Observed:
    data = PadFooting(**{"mark": "F1", "length_m": 1.0, "width_m": 1.0, "depth_m": 0.5, **values})
    record = ObservationRecord(
        id=f"o{next(_ids)}",
        project_id="p",
        element="example_pad_footing",
        frame_version=1,
        storey=storey,
        source="manual",
        geometry=None,
        values=data.model_dump(),
        created_at="2026-01-01T00:00:00+00:00",
    )
    return Observed(record=record, data=data)


def test_volume_and_basis():
    footing = obs(mark="F1", length_m=1.5, width_m=1.2, depth_m=0.6, count=4)
    items = quantify([footing], FRAME)
    assert len(items) == 1
    item = items[0]
    assert item.quantity == 4.32
    assert item.unit == "m3"
    assert item.description == "Pad footing concrete"
    assert item.storey == "Ground"
    assert item.basis == "4 x 1.500 x 1.200 x 0.600"
    assert item.observation_ids == [footing.record.id]


def test_one_item_per_observation():
    assert len(quantify([obs(mark="F1"), obs(mark="F2")], FRAME)) == 2


def test_measure_uses_longer_side_as_length():
    values = measure(Geometry(page_id="pg", bbox=(0, 0, 120, 150)), FRAME)
    assert values == {"length_m": pytest.approx(1.5), "width_m": pytest.approx(1.2)}


def test_checks():
    no_storey = obs(storey=None, mark="F1")
    deep = obs(mark="F2", depth_m=2.5)
    twin_a, twin_b = obs(mark="F3"), obs(mark="F3")
    clean = obs(mark="F4")
    observed = [no_storey, deep, twin_a, twin_b, clean]
    issues = check(observed, quantify(observed, FRAME), FRAME)
    by_code = {issue.code: issue for issue in issues}
    assert by_code["storey_missing"].severity == "error"
    assert by_code["storey_missing"].observation_ids == [no_storey.record.id]
    assert by_code["depth_unusual"].severity == "warning"
    assert by_code["duplicate_mark"].observation_ids == [twin_a.record.id, twin_b.record.id]
    assert len(issues) == 3


def test_count_defaults_to_one_and_values_must_be_positive():
    assert PadFooting(mark="F1", length_m=1, width_m=1, depth_m=1).count == 1
    with pytest.raises(ValueError):
        PadFooting(mark="F1", length_m=0, width_m=1, depth_m=1)


def test_listed_in_elements_api(client):
    elements = client.get("/api/elements").json()
    assert [e["key"] for e in elements] == ["example_pad_footing"]
    assert elements[0]["has_prompt"] is True
    assert set(elements[0]["schema"]["required"]) == {"mark", "length_m", "width_m", "depth_m"}


def test_box_then_typed_depth_end_to_end(client, project_with_pages):
    project_id, pages = project_with_pages
    page_id = pages[0]["id"]
    client.put(f"/api/pages/{page_id}/scale", json={"method": "points", "p1": [0, 0], "p2": [100, 0], "distance_m": 1})
    client.put(f"/api/projects/{project_id}/storeys", json=[{"name": "Ground", "level_m": 0}])
    client.post(f"/api/projects/{project_id}/frame/freeze")
    response = client.post(
        f"/api/projects/{project_id}/elements/example_pad_footing/observations",
        json={
            "storey": "Ground",
            "geometry": {"page_id": page_id, "bbox": [100, 100, 220, 250]},
            "values": {"mark": "F1", "depth_m": 0.6, "count": 4},
        },
    )
    assert response.status_code == 200, response.text
    result = client.get(f"/api/projects/{project_id}/elements/example_pad_footing").json()
    assert result["items"][0]["quantity"] == 4.32
