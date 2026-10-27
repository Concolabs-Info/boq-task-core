import pymupdf
import pytest

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


def _png_bytes() -> bytes:
    return pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 10, 10), False).tobytes("png")


def _encrypted_pdf() -> bytes:
    doc = pymupdf.open(stream=make_pdf(1), filetype="pdf")
    data = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="secret", owner_pw="secret")
    doc.close()
    return data


@pytest.mark.parametrize(
    "data", [_png_bytes(), b"<html><body>plan</body></html>", _encrypted_pdf()], ids=["png", "html", "encrypted"]
)
def test_other_files_rejected_with_400(client, data):
    project_id = new_project(client)
    response = upload(client, project_id, data, filename="plan.pdf")
    assert response.status_code == 400
    assert response.json()["detail"] == "plan.pdf is not a readable PDF"
    assert client.get(f"/api/projects/{project_id}/pages").json() == []


class FailingCommit:
    """Wraps a connection so commit fails, as it would if the database were locked."""

    def __init__(self, conn):
        self._conn = conn

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def commit(self):
        raise RuntimeError("database is locked")


def test_failed_commit_is_not_reported_as_success(settings, monkeypatch):
    from fastapi.testclient import TestClient

    from app.api import deps
    from app.main import create_app

    real_connect = deps.connect
    monkeypatch.setattr(deps, "connect", lambda path: FailingCommit(real_connect(path)))
    with TestClient(create_app(settings), raise_server_exceptions=False) as test_client:
        assert test_client.post("/api/projects", json={"name": "X"}).status_code == 500
