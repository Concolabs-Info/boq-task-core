import pymupdf
import pytest

from app.services.pdf_vectors import read_vectors

from .helpers import new_project, upload

SCALE = 150 / 72  # PDF points to render pixels


def layered_pdf() -> bytes:
    """A page with a rectangle and a label on named layers, and one line on no layer."""
    doc = pymupdf.open()
    page = doc.new_page(width=420, height=297)
    footings = doc.add_ocg("FOUNDATIONS", on=True)
    notes = doc.add_ocg("TEXT", on=True)
    page.draw_rect(pymupdf.Rect(50, 50, 100, 80), oc=footings)
    page.insert_text((50, 45), "F1 1500 x 1200", fontsize=8, oc=notes)
    page.draw_line((10, 200), (110, 200))
    page.insert_text((300, 250), "FAR AWAY", fontsize=8)
    data = doc.tobytes()
    doc.close()
    return data


@pytest.fixture
def pdf_file(tmp_path):
    path = tmp_path / "plan.pdf"
    path.write_bytes(layered_pdf())
    return path


def test_layers_text_and_paths_in_render_pixels(pdf_file):
    vectors = read_vectors(pdf_file, 0)
    assert vectors.layers == ["FOUNDATIONS", "TEXT"]
    texts = [line.text for line in vectors.text]
    assert "F1 1500 x 1200" in texts and "FAR AWAY" in texts
    rect = next(path for path in vectors.paths if path.kind == "rect")
    assert rect.layer == "FOUNDATIONS"
    assert rect.bbox == pytest.approx((50 * SCALE, 50 * SCALE, 100 * SCALE, 80 * SCALE))
    line = next(path for path in vectors.paths if path.kind == "line")
    assert line.layer is None
    flat = [value for point in line.points for value in point]
    assert flat == pytest.approx([10 * SCALE, 200 * SCALE, 110 * SCALE, 200 * SCALE])


def test_box_limits_what_is_returned(pdf_file):
    vectors = read_vectors(pdf_file, 0, bbox=(0, 0, 120 * SCALE, 100 * SCALE))
    assert [line.text for line in vectors.text] == ["F1 1500 x 1200"]
    assert [path.kind for path in vectors.paths] == ["rect"]


def test_layer_filter(pdf_file):
    vectors = read_vectors(pdf_file, 0, layers={"FOUNDATIONS"})
    assert {path.layer for path in vectors.paths} == {"FOUNDATIONS"}


def test_vectors_endpoint(client):
    project_id = new_project(client)
    upload(client, project_id, layered_pdf())
    page_id = client.get(f"/api/projects/{project_id}/pages").json()[0]["id"]
    body = client.get(f"/api/pages/{page_id}/vectors", params={"x0": 0, "y0": 0, "x1": 250, "y1": 210}).json()
    assert body["layers"] == ["FOUNDATIONS", "TEXT"]
    assert [line["text"] for line in body["text"]] == ["F1 1500 x 1200"]
    assert body["truncated"] is False


def test_vectors_endpoint_for_the_agent_needs_the_token(client):
    project_id = new_project(client)
    upload(client, project_id, layered_pdf())
    page_id = client.get(f"/api/projects/{project_id}/pages").json()[0]["id"]
    assert client.get(f"/internal/pages/{page_id}/vectors").status_code == 401
    ok = client.get(f"/internal/pages/{page_id}/vectors", headers={"Authorization": "Bearer test-token"})
    assert ok.status_code == 200 and ok.json()["layers"] == ["FOUNDATIONS", "TEXT"]


def test_rectangle_that_surrounds_the_box_is_left_out(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page(width=420, height=297)
    page.draw_rect(pymupdf.Rect(10, 10, 410, 287))  # drawing border
    page.draw_rect(pymupdf.Rect(50, 50, 100, 80))  # footing
    path = tmp_path / "border.pdf"
    path.write_bytes(doc.tobytes())
    doc.close()
    vectors = read_vectors(path, 0, bbox=(40 * SCALE, 40 * SCALE, 120 * SCALE, 100 * SCALE))
    assert [p.bbox for p in vectors.paths] == [pytest.approx((50 * SCALE, 50 * SCALE, 100 * SCALE, 80 * SCALE))]


def test_straight_line_crossing_the_box_is_kept(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page(width=420, height=297)
    page.draw_line((0, 60), (400, 60))  # horizontal, both ends outside the box
    page.draw_line((70, 0), (70, 290))  # vertical, both ends outside the box
    page.draw_line((0, 150), (400, 150))  # below the box
    path = tmp_path / "lines.pdf"
    path.write_bytes(doc.tobytes())
    doc.close()
    vectors = read_vectors(path, 0, bbox=(40 * SCALE, 40 * SCALE, 120 * SCALE, 100 * SCALE))
    assert len(vectors.paths) == 2
