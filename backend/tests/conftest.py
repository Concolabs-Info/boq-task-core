import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db import connect, init_db
from app.main import create_app


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
def conn(settings):
    connection = connect(settings.database_path)
    init_db(connection)
    yield connection
    connection.close()
