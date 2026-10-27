from fastapi import APIRouter, Response

from ...modules.boq.service import BoqLine, build_boq, to_csv
from ...modules.pre.service import get_project
from ..deps import Conn

router = APIRouter(tags=["boq"])


@router.get("/api/projects/{project_id}/boq", response_model=list[BoqLine])
def get_boq(project_id: str, conn: Conn) -> list[BoqLine]:
    get_project(conn, project_id)
    return build_boq(conn, project_id)


@router.get("/api/projects/{project_id}/boq.csv")
def get_boq_csv(project_id: str, conn: Conn) -> Response:
    get_project(conn, project_id)
    return Response(
        content=to_csv(build_boq(conn, project_id)),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="boq.csv"'},
    )
