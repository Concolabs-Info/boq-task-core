"""HTTP client for the agent runtime (agent-runtime/, Node)."""

from collections.abc import Iterator
from typing import Literal

import httpx

from ..api.deps import SettingsDep

RuntimeStatus = Literal["ready", "login_required", "offline"]


class AgentUnavailable(Exception):
    pass


class AgentClient:
    def __init__(self, base_url: str, token: str, transport: httpx.BaseTransport | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.transport = transport

    def _client(self, timeout: float | None = 5.0) -> httpx.Client:
        return httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {self.token}"},
            transport=self.transport,
            timeout=timeout,
        )

    def status(self) -> RuntimeStatus:
        try:
            with self._client(timeout=2.0) as client:
                response = client.get("/health")
        except httpx.HTTPError:
            return "offline"
        if response.status_code != 200:
            return "offline"
        status = response.json().get("status")
        return status if status in ("ready", "login_required") else "offline"

    def start_run(self, payload: dict) -> str:
        try:
            with self._client() as client:
                response = client.post("/runs", json=payload)
        except httpx.HTTPError as error:
            raise AgentUnavailable("Agent runtime is offline") from error
        if response.status_code != 202:
            raise AgentUnavailable(response.json().get("error", f"Agent runtime returned {response.status_code}"))
        return response.json()["run_id"]

    def stream_events(self, run_id: str) -> Iterator[bytes]:
        with self._client(timeout=None) as client, client.stream("GET", f"/runs/{run_id}/events") as response:
            yield from response.iter_bytes()


def get_agent_client(settings: SettingsDep) -> AgentClient:
    return AgentClient(settings.agent_runtime_url, settings.agent_runtime_token)
