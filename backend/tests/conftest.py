import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db import connect, init_db
from app.main import create_app

from .helpers import make_pdf, new_project, upload


@pytest.fixture
def settings(tmp_path):
    return Settings(
        database_path=tmp_path / "app.db",
        storage_root=tmp_path / "storage",
        agent_runtime_url="http://127.0.0.1:1",
        agent_runtime_token="test-token",
    )


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def project_with_pages(client):
    """A project with one uploaded two page PDF. Returns (project_id, pages)."""
    project_id = new_project(client)
    upload(client, project_id, make_pdf(2))
    return project_id, client.get(f"/api/projects/{project_id}/pages").json()


PAD = "/api/projects/{project_id}/elements/example_pad_footing"


def add_footing(client, project_id, **values):
    body = {"storey": values.pop("storey", "Ground"), "values": values}
    return client.post(PAD.format(project_id=project_id) + "/observations", json=body)


@pytest.fixture
def pad_project(client, project_with_pages):
    """Frozen project with a scaled page, a Ground storey and two pad footings.

    F1: 4 x 1.5 x 1.2 x 0.6 = 4.32 m3, F2: 2 x 1.0 x 1.0 x 0.5 = 1.0 m3.
    Returns (project_id, page_id, [observation ids]).
    """
    project_id, pages = project_with_pages
    page_id = pages[0]["id"]
    client.put(f"/api/pages/{page_id}/scale", json={"method": "ratio", "denominator": 100})
    client.put(f"/api/projects/{project_id}/storeys", json=[{"name": "Ground", "level_m": 0}])
    client.post(f"/api/projects/{project_id}/frame/freeze")
    ids = [
        add_footing(client, project_id, mark="F1", length_m=1.5, width_m=1.2, depth_m=0.6, count=4).json()["id"],
        add_footing(client, project_id, mark="F2", length_m=1.0, width_m=1.0, depth_m=0.5, count=2).json()["id"],
    ]
    return project_id, page_id, ids


@pytest.fixture
def conn(settings):
    connection = connect(settings.database_path)
    init_db(connection)
    yield connection
    connection.close()
