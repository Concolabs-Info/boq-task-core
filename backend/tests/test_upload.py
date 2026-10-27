import pymupdf

from .helpers import make_pdf, new_project, upload


def test_create_and_list_projects(client):
    project_id = new_project(client, "Site A")
    assert client.get(f"/api/projects/{project_id}").json()["name"] == "Site A"
    assert [p["id"] for p in client.get("/api/projects").json()] == [project_id]


def test_project_name_required(client):
    assert client.post("/api/projects", json={"name": "  "}).status_code == 422


def test_upload_renders_pages(client):
    project_id = new_project(client)
    response = upload(client, project_id, make_pdf(2))
    assert response.status_code == 200
    assert response.json()[0]["page_count"] == 2

    pages = client.get(f"/api/projects/{project_id}/pages").json()
    assert len(pages) == 2
    assert pages[0]["page_index"] == 0
    assert abs(pages[0]["width_px"] - 842 / 72 * 150) < 1
    assert abs(pages[0]["height_px"] - 595 / 72 * 150) < 1
    assert pages[0]["metres_per_pixel"] is None

    image = client.get(pages[0]["image_url"])
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"
    pixmap = pymupdf.Pixmap(image.content)
    assert (pixmap.width, pixmap.height) == (pages[0]["width_px"], pages[0]["height_px"])


def test_non_pdf_rejected_and_nothing_stored(client, settings):
    project_id = new_project(client)
    response = client.post(
        f"/api/projects/{project_id}/documents",
        files=[
            ("files", ("good.pdf", make_pdf(1), "application/pdf")),
            ("files", ("bad.pdf", b"not a pdf", "application/pdf")),
        ],
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "bad.pdf is not a readable PDF"
    assert client.get(f"/api/projects/{project_id}/pages").json() == []
    project_dir = settings.storage_root / project_id
    assert not project_dir.exists() or not any(project_dir.rglob("*.*"))


def test_unknown_project_404(client):
    assert client.get("/api/projects/nope").status_code == 404
    assert upload(client, "nope", make_pdf(1)).status_code == 404


def test_unknown_page_image_404(client):
    assert client.get("/api/pages/nope/image").status_code == 404
