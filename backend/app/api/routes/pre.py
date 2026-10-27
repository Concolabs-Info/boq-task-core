from fastapi import APIRouter, UploadFile
from fastapi.responses import FileResponse

from ...modules.pre import service
from ...modules.pre.models import Document, Page
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
