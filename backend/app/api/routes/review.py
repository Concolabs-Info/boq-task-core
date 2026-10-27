from fastapi import APIRouter

from ...modules.pre.service import get_project
from ...modules.review import service
from ...modules.review.service import ReviewRow
from ..deps import Conn

router = APIRouter(tags=["review"])


@router.get("/api/projects/{project_id}/review", response_model=list[ReviewRow])
def get_review(project_id: str, conn: Conn) -> list[ReviewRow]:
    get_project(conn, project_id)
    return service.review_rows(conn, project_id)


@router.post("/api/projects/{project_id}/elements/{element}/confirm")
def confirm_element(project_id: str, element: str, conn: Conn) -> dict[str, str]:
    get_project(conn, project_id)
    service.confirm(conn, project_id, element)
    return {"status": "confirmed"}
