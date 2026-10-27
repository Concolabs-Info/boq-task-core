import httpx
import pymupdf
import pytest

from app.services.agent_client import AgentClient, get_agent_client

from .conftest import PAD

AUTH = {"Authorization": "Bearer test-token"}


class FakeRuntime:
    def __init__(self, state):
        self.state = state
        self.payloads = []

    def status(self):
        return self.state

    def start_run(self, payload):
        self.payloads.append(payload)
        return "run-1"

    def stream_events(self, run_id):
        yield b'event: result\ndata: {"status": "accepted"}\n\n'


@pytest.fixture
def runtime(client):
    fake = FakeRuntime("ready")
    client.app.dependency_overrides[get_agent_client] = lambda: fake
    yield fake
    client.app.dependency_overrides.clear()


def start_run(client, project_id, page_id, bbox=(0, 0, 200, 200)):
    return client.post(PAD.format(project_id=project_id) + "/agent-runs", json={"page_id": page_id, "bbox": list(bbox)})


# Agent client


def test_status_offline_when_unreachable():
    def refuse(request):
        raise httpx.ConnectError("refused")

    assert AgentClient("http://runtime", "t", httpx.MockTransport(refuse)).status() == "offline"


@pytest.mark.parametrize("state", ["ready", "login_required"])
def test_status_passes_runtime_state(state):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"status": state}))
    assert AgentClient("http://runtime", "t", transport).status() == state


def test_start_run_sends_token():
    seen = {}

    def handle(request):
        seen["auth"] = request.headers["authorization"]
        return httpx.Response(202, json={"run_id": "abc"})

    assert AgentClient("http://runtime", "secret", httpx.MockTransport(handle)).start_run({}) == "abc"
    assert seen["auth"] == "Bearer secret"


# Public routes


def test_agent_status_route(client, runtime):
    assert client.get("/api/agent/status").json() == {"status": "ready"}


def test_run_sends_element_context(client, runtime, pad_project):
    project_id, page_id, _ = pad_project
    response = start_run(client, project_id, page_id)
    assert response.status_code == 200 and response.json() == {"run_id": "run-1"}
    payload = runtime.payloads[0]
    assert payload["project_id"] == project_id
    assert payload["frame_version"] == 1
    assert payload["element"] == "example_pad_footing"
    assert payload["page_id"] == page_id
    assert payload["bbox"] == [0, 0, 200, 200]
    assert payload["prompt_file"] == "example_pad_footing.md"
    assert "mark" in payload["schema"]["properties"]


def test_run_refused_when_login_required(client, runtime, pad_project):
    runtime.state = "login_required"
    project_id, page_id, _ = pad_project
    response = start_run(client, project_id, page_id)
    assert response.status_code == 503
    assert "npm run auth" in response.json()["detail"]
    assert runtime.payloads == []


def test_run_refused_when_offline(client, runtime, pad_project):
    runtime.state = "offline"
    project_id, page_id, _ = pad_project
    response = start_run(client, project_id, page_id)
    assert response.status_code == 503
    assert response.json()["detail"] == "Agent runtime is offline"


def test_run_needs_current_frame(client, runtime, pad_project):
    project_id, page_id, _ = pad_project
    client.put(f"/api/projects/{project_id}/storeys", json=[])
    assert start_run(client, project_id, page_id).status_code == 409


def test_run_unknown_page_422(client, runtime, pad_project):
    project_id, _, _ = pad_project
    assert start_run(client, project_id, "nope").status_code == 422


def test_takeoff_still_works_offline(client, runtime, pad_project):
    runtime.state = "offline"
    project_id, _, _ = pad_project
    assert client.post(PAD.format(project_id=project_id) + "/confirm").status_code == 200
    assert client.get(f"/api/projects/{project_id}/boq").json()[0]["quantity"] == 5.32


def test_events_are_proxied(client, runtime):
    response = client.get("/api/agent-runs/run-1/events")
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: result" in response.text


# Internal routes used by the agent runtime


def test_internal_requires_token(client, pad_project):
    project_id, page_id, _ = pad_project
    assert client.get(f"/internal/projects/{project_id}/frame").status_code == 401
    wrong = {"Authorization": "Bearer nope"}
    assert client.get(f"/internal/projects/{project_id}/frame", headers=wrong).status_code == 401


def test_internal_requires_a_configured_token(client, settings, pad_project):
    project_id, _, _ = pad_project
    settings.agent_runtime_token = ""
    assert client.get(f"/internal/projects/{project_id}/frame", headers={"Authorization": "Bearer "}).status_code == 401


def test_internal_frame(client, pad_project):
    project_id, page_id, _ = pad_project
    frame = client.get(f"/internal/projects/{project_id}/frame", headers=AUTH).json()
    assert frame["version"] == 1
    assert frame["pages"][0]["page_id"] == page_id
    assert frame["pages"][0]["metres_per_pixel"] == pytest.approx(0.0169333, rel=1e-5)
    assert frame["storeys"] == [{"name": "Ground", "level_m": 0.0}]


def test_crop_png(client, pad_project):
    _, page_id, _ = pad_project
    response = client.get(
        f"/internal/pages/{page_id}/crop", params={"x0": 10, "y0": 20, "x1": 110, "y1": 70}, headers=AUTH
    )
    assert response.headers["content-type"] == "image/png"
    assert (pymupdf.Pixmap(response.content).width, pymupdf.Pixmap(response.content).height) == (100, 50)


def test_crop_outside_page_422(client, pad_project):
    _, page_id, _ = pad_project
    params = {"x0": 99999, "y0": 0, "x1": 100000, "y1": 10}
    assert client.get(f"/internal/pages/{page_id}/crop", params=params, headers=AUTH).status_code == 422


def submit(client, project_id, observations, frame_version=1):
    return client.post(
        f"/internal/projects/{project_id}/elements/example_pad_footing/observations",
        json={"frame_version": frame_version, "observations": observations},
        headers=AUTH,
    )


GOOD = {"storey": "Ground", "values": {"mark": "F7", "length_m": 2, "width_m": 2, "depth_m": 1, "count": 1}}


def test_internal_submit_saves_agent_source(client, pad_project):
    project_id, _, _ = pad_project
    response = submit(client, project_id, [GOOD])
    assert response.status_code == 200 and len(response.json()["ids"]) == 1
    observations = client.get(PAD.format(project_id=project_id)).json()["observations"]
    assert [o["source"] for o in observations] == ["manual", "manual", "agent"]


def test_internal_submit_all_or_nothing(client, pad_project):
    project_id, _, _ = pad_project
    bad = {"storey": "Ground", "values": {"mark": "F8", "length_m": -1}}
    response = submit(client, project_id, [GOOD, bad])
    assert response.status_code == 422
    assert response.json()["detail"]["errors"][0]["index"] == 1
    assert len(client.get(PAD.format(project_id=project_id)).json()["observations"]) == 2


def test_internal_submit_old_frame_409(client, pad_project):
    project_id, _, _ = pad_project
    assert submit(client, project_id, [GOOD], frame_version=7).status_code == 409


def test_run_bad_bbox_422(client, runtime, pad_project):
    project_id, page_id, _ = pad_project
    assert start_run(client, project_id, page_id, bbox=(50, 50, 10, 10)).status_code == 422
