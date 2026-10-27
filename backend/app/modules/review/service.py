"""Review: a person confirms an element's observations before they reach the BOQ.

A confirmation remembers the frame version and a hash of the observations. If either
changes afterwards, or Pre is edited, the element is stale and must be confirmed again.
"""

import hashlib
import json
import sqlite3
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel

from ...db import now
from ..pre.frame import current_frame, frame_status, latest_frame
from ..takeoff import registry
from ..takeoff.contracts import ElementResult, ObservationRecord
from ..takeoff.pipeline import run_element

ReviewStatus = Literal["open", "confirmed", "stale"]


class ReviewRow(BaseModel):
    element: str
    display_name: str
    status: ReviewStatus
    observation_count: int
    error_count: int
    warning_count: int


def observations_hash(observations: list[ObservationRecord]) -> str:
    content = sorted(
        (
            {
                "id": o.id,
                "storey": o.storey,
                "values": o.values,
                "geometry": o.geometry.model_dump() if o.geometry else None,
            }
            for o in observations
        ),
        key=lambda item: item["id"],
    )
    return hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()


def element_status(conn: sqlite3.Connection, project_id: str, element: str, result: ElementResult) -> ReviewStatus:
    row = conn.execute(
        "SELECT frame_version, observations_hash FROM confirmations WHERE project_id = ? AND element = ?",
        (project_id, element),
    ).fetchone()
    if row is None:
        return "open"
    frame = latest_frame(conn, project_id)
    if (
        frame is None
        or frame_status(conn, project_id) != "current"
        or row["frame_version"] != frame.version
        or row["observations_hash"] != observations_hash(result.observations)
    ):
        return "stale"
    return "confirmed"


def review_rows(conn: sqlite3.Connection, project_id: str) -> list[ReviewRow]:
    rows = []
    for spec in registry.all_specs():
        result = run_element(conn, project_id, spec.key)
        rows.append(
            ReviewRow(
                element=spec.key,
                display_name=spec.display_name,
                status=element_status(conn, project_id, spec.key, result),
                observation_count=len(result.observations),
                error_count=sum(issue.severity == "error" for issue in result.issues),
                warning_count=sum(issue.severity == "warning" for issue in result.issues),
            )
        )
    return rows


def confirm(conn: sqlite3.Connection, project_id: str, element: str) -> None:
    registry.get(element)
    frame = current_frame(conn, project_id)
    result = run_element(conn, project_id, element)
    if not result.observations:
        raise HTTPException(status_code=409, detail="Nothing to confirm")
    if any(issue.severity == "error" for issue in result.issues):
        raise HTTPException(status_code=409, detail="Fix errors before confirming")
    conn.execute(
        "INSERT INTO confirmations (project_id, element, frame_version, observations_hash, confirmed_at)"
        " VALUES (?, ?, ?, ?, ?)"
        " ON CONFLICT (project_id, element) DO UPDATE SET"
        " frame_version = excluded.frame_version,"
        " observations_hash = excluded.observations_hash,"
        " confirmed_at = excluded.confirmed_at",
        (project_id, element, frame.version, observations_hash(result.observations), now()),
    )
