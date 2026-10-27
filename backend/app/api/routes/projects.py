from fastapi import APIRouter

from ...modules.pre import service
from ...modules.pre.models import Project, ProjectIn
from ..deps import Conn

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=Project)
def create_project(body: ProjectIn, conn: Conn) -> Project:
    return service.create_project(conn, body.name)


@router.get("", response_model=list[Project])
def list_projects(conn: Conn) -> list[Project]:
    return service.list_projects(conn)


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str, conn: Conn) -> Project:
    return service.get_project(conn, project_id)
