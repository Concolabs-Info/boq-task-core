from typing import Annotated

from fastapi import APIRouter, Query, UploadFile
from fastapi.responses import FileResponse

from ...modules.pre import frame, service
from ...modules.pre.models import Document, FrameInfo, Page, StoreyIn
from ...modules.pre.scale import ScaleIn
from ..deps import Conn, SettingsDep

router = APIRouter(tags=["pre"])


@router.post("/api/projects/{project_id}/documents", response_model=list[Document])
async def upload_documents(
    project_id: str, files: list[UploadFile], conn: Conn, settings: SettingsDep
) -> list[Document]:
    contents = [(file.filename or "drawing.pdf", await file.read()) for file in files]
    return service.add_documents(conn, settings.storage_root, project_id, contents)


@router.get("/api/projects/{project_id}/pages", response_model=list[Page])
def list_pages(project_id: str, conn: Conn) -> list[Page]:
    return service.list_pages(conn, project_id)


@router.get("/api/pages/{page_id}/image")
def page_image(page_id: str, conn: Conn, settings: SettingsDep) -> FileResponse:
    page, project_id = service.get_page(conn, page_id)
    return FileResponse(service.render_path(settings.storage_root, project_id, page.id), media_type="image/png")


def box_from_query(x0: float | None, y0: float | None, x1: float | None, y1: float | None):
    values = (x0, y0, x1, y1)
    return None if any(value is None for value in values) else values


@router.get("/api/pages/{page_id}/vectors")
def page_vectors(
    page_id: str,
    conn: Conn,
    settings: SettingsDep,
    x0: float | None = None,
    y0: float | None = None,
    x1: float | None = None,
    y1: float | None = None,
    layer: Annotated[list[str] | None, Query()] = None,
) -> dict:
    """Text, vector lines and rectangles, and layers read from the PDF itself. Optional box in render pixels."""
    return service.page_vectors(
        conn, settings.storage_root, page_id, box_from_query(x0, y0, x1, y1), set(layer) if layer else None
    )


@router.put("/api/pages/{page_id}/scale", response_model=Page)
def set_scale(page_id: str, body: ScaleIn, conn: Conn) -> Page:
    return service.set_scale(conn, page_id, body)


@router.get("/api/projects/{project_id}/storeys", response_model=list[StoreyIn])
def list_storeys(project_id: str, conn: Conn) -> list[StoreyIn]:
    return service.list_storeys(conn, project_id)


@router.put("/api/projects/{project_id}/storeys", response_model=list[StoreyIn])
def replace_storeys(project_id: str, body: list[StoreyIn], conn: Conn) -> list[StoreyIn]:
    return service.replace_storeys(conn, project_id, body)


@router.get("/api/projects/{project_id}/frame", response_model=FrameInfo)
def get_frame(project_id: str, conn: Conn) -> FrameInfo:
    service.get_project(conn, project_id)
    latest = frame.latest_frame(conn, project_id)
    return FrameInfo(version=None if latest is None else latest.version, status=frame.frame_status(conn, project_id))


@router.post("/api/projects/{project_id}/frame/freeze", response_model=FrameInfo)
def freeze(project_id: str, conn: Conn) -> FrameInfo:
    service.get_project(conn, project_id)
    frozen = frame.freeze_frame(conn, project_id)
    return FrameInfo(version=frozen.version, status="current")
