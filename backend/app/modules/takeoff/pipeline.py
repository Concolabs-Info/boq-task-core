"""Runs one element for a project: parse observations, quantify, check."""

import sqlite3

from pydantic import ValidationError

from ..pre.frame import latest_frame
from . import registry
from .contracts import ElementResult, Issue, Observed
from .observations import list_for


def run_element(conn: sqlite3.Connection, project_id: str, element: str) -> ElementResult:
    spec = registry.get(element)
    frame = latest_frame(conn, project_id)
    if frame is None:
        return ElementResult(element=element, frame_version=None, observations=[], items=[], issues=[])

    records = list_for(conn, project_id, element, frame.version)
    observed: list[Observed] = []
    issues: list[Issue] = []
    for record in records:
        try:
            observed.append(Observed(record=record, data=spec.observation_model.model_validate(record.values)))
        except ValidationError as error:
            issues.append(
                Issue(
                    code="invalid_observation",
                    message=f"Stored values no longer match the element: {error.error_count()} problem(s)",
                    severity="error",
                    observation_ids=[record.id],
                )
            )

    try:
        items = spec.quantify(observed, frame)
    except Exception as error:  # an element bug should show up in the UI, not as a 500
        issues.append(Issue(code="quantify_failed", message=f"Quantify failed: {error}", severity="error"))
        return ElementResult(
            element=element, frame_version=frame.version, observations=records, items=[], issues=issues
        )

    try:
        issues.extend(spec.check(observed, items, frame))
    except Exception as error:
        issues.append(Issue(code="check_failed", message=f"Check failed: {error}", severity="error"))
    return ElementResult(element=element, frame_version=frame.version, observations=records, items=items, issues=issues)
