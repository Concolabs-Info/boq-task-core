import pytest

from app.modules.pre.frame import Frame, PageFrame, ScaleMissing, Storey

from .helpers import new_project


def test_set_scale_by_ratio_and_points(client, project_with_pages):
    _, pages = project_with_pages
    page_id = pages[0]["id"]
    ratio = client.put(f"/api/pages/{page_id}/scale", json={"method": "ratio", "denominator": 100}).json()
    assert ratio["metres_per_pixel"] == pytest.approx(0.0169333, rel=1e-5)
    assert ratio["scale"] == {"method": "ratio", "denominator": 100.0}

    points = client.put(
        f"/api/pages/{page_id}/scale",
        json={"method": "points", "p1": [0, 0], "p2": [300, 400], "distance_m": 5},
    ).json()
    assert points["metres_per_pixel"] == pytest.approx(0.01)


def test_bad_scale_is_422(client, project_with_pages):
    _, pages = project_with_pages
    response = client.put(
        f"/api/pages/{pages[0]['id']}/scale",
        json={"method": "points", "p1": [0, 0], "p2": [0, 0], "distance_m": 5},
    )
    assert response.status_code == 422


def test_storeys_saved_in_order(client, project_with_pages):
    project_id, _ = project_with_pages
    body = [{"name": "Ground", "level_m": 0.0}, {"name": "First", "level_m": 3.2}]
    assert client.put(f"/api/projects/{project_id}/storeys", json=body).json() == body
    assert client.get(f"/api/projects/{project_id}/storeys").json() == body


def test_duplicate_storey_names_422(client, project_with_pages):
    project_id, _ = project_with_pages
    body = [{"name": "Ground", "level_m": 0.0}, {"name": "Ground", "level_m": 3.0}]
    assert client.put(f"/api/projects/{project_id}/storeys", json=body).status_code == 422


def test_freeze_then_edit_goes_stale(client, project_with_pages):
    project_id, pages = project_with_pages
    assert client.get(f"/api/projects/{project_id}/frame").json() == {"version": None, "status": "none"}
    assert client.post(f"/api/projects/{project_id}/frame/freeze").json()["version"] == 1
    assert client.get(f"/api/projects/{project_id}/frame").json() == {"version": 1, "status": "current"}

    client.put(f"/api/pages/{pages[0]['id']}/scale", json={"method": "ratio", "denominator": 50})
    assert client.get(f"/api/projects/{project_id}/frame").json()["status"] == "stale"
    assert client.post(f"/api/projects/{project_id}/frame/freeze").json()["version"] == 2
    assert client.get(f"/api/projects/{project_id}/frame").json() == {"version": 2, "status": "current"}


def test_storey_edit_makes_frame_stale(client, project_with_pages):
    project_id, _ = project_with_pages
    client.post(f"/api/projects/{project_id}/frame/freeze")
    client.put(f"/api/projects/{project_id}/storeys", json=[{"name": "Roof", "level_m": 9.0}])
    assert client.get(f"/api/projects/{project_id}/frame").json()["status"] == "stale"


def test_freeze_without_pages_409(client):
    project_id = new_project(client, "Empty")
    response = client.post(f"/api/projects/{project_id}/frame/freeze")
    assert response.status_code == 409


def test_to_metres():
    frame = Frame("p", 1, {"pg": PageFrame("pg", "d", 0, 100, 100, 0.02)}, [Storey("Ground", 0.0)])
    assert frame.to_metres("pg", 150) == pytest.approx(3.0)
    assert frame.storey_names() == {"Ground"}


def test_to_metres_without_scale_raises():
    frame = Frame("p", 1, {"pg": PageFrame("pg", "d", 0, 100, 100, None)}, [])
    with pytest.raises(ScaleMissing):
        frame.to_metres("pg", 10)
