"""Observations: the facts read from drawings for one element.

Observations belong to the frame version they were made on. Only observations of the
current frame can be added, changed or removed.
"""

import json
import sqlite3
from typing import Any, Literal

from fastapi import HTTPException
from pydantic import ValidationError

from ...db import new_id, now
from ..pre.frame import Frame, ScaleMissing, current_frame
from . import registry
from .contracts import ElementSpec, Geometry, ObservationIn, ObservationRecord

Source = Literal["agent", "manual"]


class ObservationErrors(Exception):
    """Raised by create_many. Each error has the index of the item it belongs to."""

    def __init__(self, errors: list[dict[str, Any]]):
        super().__init__(f"{len(errors)} invalid observation(s)")
        self.errors = errors


def _validation_detail(error: ValidationError) -> list[dict[str, Any]]:
    return error.errors(include_url=False, include_context=False, include_input=False)


def _prepare(spec: ElementSpec, frame: Frame, item: ObservationIn, source: Source) -> dict[str, Any]:
    """Validate one observation against the frame and the element. Returns the values to store.

    For manual entry the drawn box is the source of truth, so measured values replace typed
    ones. For the agent, values it read from the drawing win and the box only fills gaps.
    """
    if item.storey is not None and item.storey not in frame.storey_names():
        raise HTTPException(status_code=422, detail=f"Unknown storey: {item.storey}")
    values = dict(item.values)
    if item.geometry is not None:
        if item.geometry.page_id not in frame.pages:
            raise HTTPException(status_code=422, detail="Unknown page")
        if spec.measure is not None:
            try:
                measured = spec.measure(item.geometry, frame)
            except ScaleMissing:
                if source == "manual":
                    raise HTTPException(status_code=409, detail="Set the scale for this page first") from None
                measured = {}
            values = {**measured, **values} if source == "agent" else {**values, **measured}
    try:
        return spec.observation_model.model_validate(values).model_dump(mode="json")
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=_validation_detail(error)) from None


def _record(row: sqlite3.Row) -> ObservationRecord:
    return ObservationRecord(
        id=row["id"],
        project_id=row["project_id"],
        element=row["element"],
        frame_version=row["frame_version"],
        storey=row["storey"],
        source=row["source"],
        geometry=json.loads(row["geometry_json"]) if row["geometry_json"] else None,
        values=json.loads(row["values_json"]),
        created_at=row["created_at"],
    )


def _insert(
    conn: sqlite3.Connection,
    project_id: str,
    element: str,
    frame_version: int,
    storey: str | None,
    source: str,
    geometry: Geometry | None,
    values: dict[str, Any],
) -> str:
    observation_id = new_id()
    conn.execute(
        "INSERT INTO observations"
        " (id, project_id, element, frame_version, storey, source, geometry_json, values_json, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            observation_id,
            project_id,
            element,
            frame_version,
            storey,
            source,
            geometry.model_dump_json() if geometry else None,
            json.dumps(values),
            now(),
        ),
    )
    return observation_id


def get_record(conn: sqlite3.Connection, project_id: str, element: str, observation_id: str) -> ObservationRecord:
    row = conn.execute(
        "SELECT * FROM observations WHERE id = ? AND project_id = ? AND element = ?",
        (observation_id, project_id, element),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    return _record(row)


def list_for(conn: sqlite3.Connection, project_id: str, element: str, frame_version: int) -> list[ObservationRecord]:
    rows = conn.execute(
        "SELECT * FROM observations WHERE project_id = ? AND element = ? AND frame_version = ?"
        " ORDER BY created_at, rowid",
        (project_id, element, frame_version),
    ).fetchall()
    return [_record(row) for row in rows]


def create(
    conn: sqlite3.Connection, project_id: str, element: str, item: ObservationIn, source: Source
) -> ObservationRecord:
    spec = registry.get(element)
    frame = current_frame(conn, project_id)
    values = _prepare(spec, frame, item, source)
    observation_id = _insert(conn, project_id, element, frame.version, item.storey, source, item.geometry, values)
    return get_record(conn, project_id, element, observation_id)


def create_many(
    conn: sqlite3.Connection, project_id: str, element: str, items: list[dict[str, Any]], source: Source
) -> list[ObservationRecord]:
    """Add several observations at once. If any is invalid, none are saved."""
    spec = registry.get(element)
    frame = current_frame(conn, project_id)
    prepared, errors = [], []
    for index, raw in enumerate(items):
        try:
            item = ObservationIn.model_validate(raw)
            prepared.append((item, _prepare(spec, frame, item, source)))
        except ValidationError as error:
            errors.append({"index": index, "detail": _validation_detail(error)})
        except HTTPException as error:
            errors.append({"index": index, "detail": error.detail})
    if errors:
        raise ObservationErrors(errors)
    ids = [
        _insert(conn, project_id, element, frame.version, item.storey, source, item.geometry, values)
        for item, values in prepared
    ]
    return [get_record(conn, project_id, element, observation_id) for observation_id in ids]


def update(
    conn: sqlite3.Connection, project_id: str, element: str, observation_id: str, item: ObservationIn
) -> ObservationRecord:
    spec = registry.get(element)
    frame = current_frame(conn, project_id)
    existing = get_record(conn, project_id, element, observation_id)
    if existing.frame_version != frame.version:
        raise HTTPException(status_code=409, detail="This observation belongs to an older frame")
    values = _prepare(spec, frame, item, existing.source)
    conn.execute(
        "UPDATE observations SET storey = ?, geometry_json = ?, values_json = ? WHERE id = ?",
        (item.storey, item.geometry.model_dump_json() if item.geometry else None, json.dumps(values), observation_id),
    )
    return get_record(conn, project_id, element, observation_id)


def delete(conn: sqlite3.Connection, project_id: str, element: str, observation_id: str) -> None:
    registry.get(element)
    frame = current_frame(conn, project_id)
    existing = get_record(conn, project_id, element, observation_id)
    if existing.frame_version != frame.version:
        raise HTTPException(status_code=409, detail="This observation belongs to an older frame")
    conn.execute("DELETE FROM observations WHERE id = ?", (observation_id,))


def on_frame_frozen(conn: sqlite3.Connection, project_id: str, old_version: int | None, new_frame: Frame) -> None:
    """Carry every observation forward to a newly frozen frame.

    Manual observations made from a drawn box are measured again with the new scale. If that
    fails (the scale was removed, or the element's measure raises), the old values are kept.
    """
    if old_version is None:
        return
    rows = conn.execute(
        "SELECT * FROM observations WHERE project_id = ? AND frame_version = ? ORDER BY created_at, rowid",
        (project_id, old_version),
    ).fetchall()
    for row in rows:
        record = _record(row)
        values = dict(record.values)
        spec = registry.all_specs_by_key().get(record.element)
        if spec is not None and spec.measure is not None and record.geometry is not None and record.source == "manual":
            try:
                values.update(spec.measure(record.geometry, new_frame))
            except Exception:  # keep the old values; a measure bug must not block freezing
                pass
        _insert(
            conn,
            project_id,
            record.element,
            new_frame.version,
            record.storey,
            record.source,
            record.geometry,
            values,
        )
