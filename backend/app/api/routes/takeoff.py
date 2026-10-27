from fastapi import APIRouter, Response

from ...modules.pre.service import get_project
from ...modules.takeoff import observations, registry
from ...modules.takeoff.contracts import ElementInfo, ElementResult, ObservationIn, ObservationRecord
from ...modules.takeoff.pipeline import run_element
from ..deps import Conn

router = APIRouter(tags=["takeoff"])

BASE = "/api/projects/{project_id}/elements/{element}"


@router.get("/api/elements", response_model=list[ElementInfo], response_model_by_alias=True)
def list_elements() -> list[ElementInfo]:
    return [registry.info(spec) for spec in registry.all_specs()]


@router.get(BASE, response_model=ElementResult)
def get_element(project_id: str, element: str, conn: Conn) -> ElementResult:
    get_project(conn, project_id)
    return run_element(conn, project_id, element)


@router.post(f"{BASE}/observations", response_model=ObservationRecord)
def add_observation(project_id: str, element: str, body: ObservationIn, conn: Conn) -> ObservationRecord:
    get_project(conn, project_id)
    return observations.create(conn, project_id, element, body, "manual")


@router.put(f"{BASE}/observations/{{observation_id}}", response_model=ObservationRecord)
def update_observation(
    project_id: str, element: str, observation_id: str, body: ObservationIn, conn: Conn
) -> ObservationRecord:
    get_project(conn, project_id)
    return observations.update(conn, project_id, element, observation_id, body)


@router.delete(f"{BASE}/observations/{{observation_id}}", status_code=204)
def delete_observation(project_id: str, element: str, observation_id: str, conn: Conn) -> Response:
    get_project(conn, project_id)
    observations.delete(conn, project_id, element, observation_id)
    return Response(status_code=204)
