"""Routes the frontend uses to talk to the agent runtime through the backend."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ...modules.pre.frame import current_frame
from ...modules.pre.service import get_project
from ...modules.takeoff import registry
from ...modules.takeoff.contracts import Geometry
from ...services.agent_client import AgentClient, AgentUnavailable, get_agent_client
from ..deps import Conn

router = APIRouter(tags=["agent"])

Agent = Annotated[AgentClient, Depends(get_agent_client)]

NOT_READY = {
    "offline": "Agent runtime is offline",
    "login_required": "Agent runtime needs login: run npm run auth in agent-runtime",
}


class AgentRunIn(Geometry):
    """The box the agent should read."""


@router.get("/api/agent/status")
def agent_status(agent: Agent) -> dict[str, str]:
    return {"status": agent.status()}


@router.post("/api/projects/{project_id}/elements/{element}/agent-runs")
def start_agent_run(project_id: str, element: str, body: AgentRunIn, conn: Conn, agent: Agent) -> dict[str, str]:
    get_project(conn, project_id)
    spec = registry.get(element)
    frame = current_frame(conn, project_id)
    if body.page_id not in frame.pages:
        raise HTTPException(status_code=422, detail="Unknown page")
    status = agent.status()
    if status != "ready":
        raise HTTPException(status_code=503, detail=NOT_READY[status])
    payload = {
        "project_id": project_id,
        "frame_version": frame.version,
        "element": spec.key,
        "page_id": body.page_id,
        "bbox": list(body.bbox),
        "schema": spec.observation_model.model_json_schema(),
        "prompt_file": spec.prompt_file,
    }
    try:
        return {"run_id": agent.start_run(payload)}
    except AgentUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/api/agent-runs/{run_id}/events")
def agent_run_events(run_id: str, agent: Agent) -> StreamingResponse:
    return StreamingResponse(agent.stream_events(run_id), media_type="text/event-stream")
