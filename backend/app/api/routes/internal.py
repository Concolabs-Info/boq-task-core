"""Routes only the agent runtime calls. They need the shared AGENT_RUNTIME_TOKEN."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from ...modules.pre.frame import current_frame, frame_status, latest_frame
from ...modules.pre.service import get_page, get_project, render_path
from ...modules.takeoff.observations import ObservationErrors, create_many
from ...services.pdf import crop_png
from ..deps import Conn, SettingsDep, require_runtime_token

router = APIRouter(prefix="/internal", tags=["internal"], dependencies=[Depends(require_runtime_token)])


class SubmitIn(BaseModel):
    frame_version: int
    observations: list[dict[str, Any]]


@router.get("/projects/{project_id}/frame")
def frame(project_id: str, conn: Conn) -> dict[str, Any]:
    get_project(conn, project_id)
    latest = latest_frame(conn, project_id)
    if latest is None:
        raise HTTPException(status_code=409, detail="Freeze the frame first")
    return {
        "version": latest.version,
        "status": frame_status(conn, project_id),
        "pages": [
            {
                "page_id": page.page_id,
                "page_index": page.page_index,
                "width_px": page.width_px,
                "height_px": page.height_px,
                "metres_per_pixel": page.metres_per_pixel,
            }
            for page in latest.pages.values()
        ],
        "storeys": [{"name": storey.name, "level_m": storey.level_m} for storey in latest.storeys],
    }


@router.get("/pages/{page_id}/crop")
def crop(page_id: str, x0: float, y0: float, x1: float, y1: float, conn: Conn, settings: SettingsDep) -> Response:
    page, project_id = get_page(conn, page_id)
    try:
        png = crop_png(render_path(settings.storage_root, project_id, page.id), (x0, y0, x1, y1))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return Response(content=png, media_type="image/png")


@router.post("/projects/{project_id}/elements/{element}/observations")
def submit_observations(project_id: str, element: str, body: SubmitIn, conn: Conn) -> dict[str, list[str]]:
    get_project(conn, project_id)
    if current_frame(conn, project_id).version != body.frame_version:
        raise HTTPException(status_code=409, detail="The frame changed while the agent was working")
    try:
        records = create_many(conn, project_id, element, body.observations, "agent")
    except ObservationErrors as error:
        raise HTTPException(status_code=422, detail={"errors": error.errors}) from error
    return {"ids": [record.id for record in records]}
