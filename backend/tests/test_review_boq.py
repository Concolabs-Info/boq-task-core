import csv
import io

from .conftest import PAD, add_footing


def review(client, project_id):
    return {row["element"]: row for row in client.get(f"/api/projects/{project_id}/review").json()}


def confirm(client, project_id):
    return client.post(PAD.format(project_id=project_id) + "/confirm")


def boq(client, project_id):
    return client.get(f"/api/projects/{project_id}/boq").json()


def test_review_lists_every_element_open(client, pad_project):
    project_id, _, _ = pad_project
    row = review(client, project_id)["example_pad_footing"]
    assert row["status"] == "open"
    assert row["display_name"] == "Example: Pad footing concrete"
    assert (row["observation_count"], row["error_count"], row["warning_count"]) == (2, 0, 0)


def test_confirm_then_boq(client, pad_project):
    project_id, _, _ = pad_project
    assert boq(client, project_id) == []
    assert confirm(client, project_id).status_code == 200
    assert review(client, project_id)["example_pad_footing"]["status"] == "confirmed"

    lines = boq(client, project_id)
    assert len(lines) == 1
    line = lines[0]
    assert (line["section"], line["description"], line["unit"]) == (
        "Example: In-situ concrete",
        "Pad footing concrete",
        "m3",
    )
    assert line["quantity"] == 5.32
    assert [item["basis"] for item in line["items"]] == ["4 x 1.500 x 1.200 x 0.600", "2 x 1.000 x 1.000 x 0.500"]


def test_errors_block_confirm(client, pad_project):
    project_id, _, _ = pad_project
    add_footing(client, project_id, storey=None, mark="F9", length_m=1, width_m=1, depth_m=1)
    response = confirm(client, project_id)
    assert response.status_code == 409
    assert response.json()["detail"] == "Fix errors before confirming"
    assert review(client, project_id)["example_pad_footing"]["error_count"] == 1


def test_nothing_to_confirm(client, project_with_pages):
    project_id, _ = project_with_pages
    client.post(f"/api/projects/{project_id}/frame/freeze")
    response = confirm(client, project_id)
    assert response.status_code == 409
    assert response.json()["detail"] == "Nothing to confirm"


def test_edit_after_confirm_goes_stale_and_leaves_boq(client, pad_project):
    project_id, _, ids = pad_project
    confirm(client, project_id)
    client.put(
        PAD.format(project_id=project_id) + f"/observations/{ids[0]}",
        json={"storey": "Ground", "values": {"mark": "F1", "length_m": 2, "width_m": 1.2, "depth_m": 0.6, "count": 4}},
    )
    assert review(client, project_id)["example_pad_footing"]["status"] == "stale"
    assert boq(client, project_id) == []
    confirm(client, project_id)
    assert boq(client, project_id)[0]["quantity"] == round(4 * 2 * 1.2 * 0.6 + 1.0, 3)


def test_delete_after_confirm_goes_stale(client, pad_project):
    project_id, _, ids = pad_project
    confirm(client, project_id)
    client.delete(PAD.format(project_id=project_id) + f"/observations/{ids[1]}")
    assert review(client, project_id)["example_pad_footing"]["status"] == "stale"
    assert boq(client, project_id) == []


def test_refreeze_makes_confirmation_stale(client, pad_project):
    project_id, page_id, _ = pad_project
    confirm(client, project_id)
    client.put(f"/api/pages/{page_id}/scale", json={"method": "ratio", "denominator": 50})
    client.post(f"/api/projects/{project_id}/frame/freeze")
    assert review(client, project_id)["example_pad_footing"]["status"] == "stale"
    assert boq(client, project_id) == []


def test_csv(client, pad_project):
    project_id, _, _ = pad_project
    confirm(client, project_id)
    response = client.get(f"/api/projects/{project_id}/boq.csv")
    assert response.headers["content-type"].startswith("text/csv")
    assert "boq.csv" in response.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(response.text)))
    assert rows[0] == ["Section", "Item code", "Description", "Quantity", "Unit"]
    assert rows[1] == ["Example: In-situ concrete", "", "Pad footing concrete", "5.32", "m3"]


def test_pre_edit_without_refreeze_makes_confirmation_stale(client, pad_project):
    project_id, _, _ = pad_project
    confirm(client, project_id)
    client.put(f"/api/projects/{project_id}/storeys", json=[{"name": "Ground", "level_m": 0.15}])
    assert review(client, project_id)["example_pad_footing"]["status"] == "stale"
    assert boq(client, project_id) == []
