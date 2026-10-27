"""The project frame: a frozen snapshot of pages, scales and storeys.

Takeoff only runs against the latest frame, and only while it is current. Editing Pre
after freezing makes the frame stale until it is frozen again.
"""

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from typing import Literal

from fastapi import HTTPException

from ...db import now

FrameStatus = Literal["none", "current", "stale"]


class ScaleMissing(Exception):
    def __init__(self, page_id: str):
        super().__init__(f"Page {page_id} has no scale")
        self.page_id = page_id


@dataclass(frozen=True)
class PageFrame:
    page_id: str
    document_id: str
    page_index: int
    width_px: int
    height_px: int
    metres_per_pixel: float | None


@dataclass(frozen=True)
class Storey:
    name: str
    level_m: float


@dataclass(frozen=True)
class Frame:
    project_id: str
    version: int
    pages: dict[str, PageFrame]
    storeys: list[Storey]

    def to_metres(self, page_id: str, pixels: float) -> float:
        page = self.pages.get(page_id)
        if page is None or page.metres_per_pixel is None:
            raise ScaleMissing(page_id)
        return pixels * page.metres_per_pixel

    def storey_names(self) -> set[str]:
        return {storey.name for storey in self.storeys}


def current_inputs(conn: sqlite3.Connection, project_id: str) -> tuple[dict, str]:
    """The Pre inputs as they are now, and a hash of them."""
    pages = conn.execute(
        "SELECT p.id AS page_id, p.document_id, p.page_index, p.width_px, p.height_px, p.metres_per_pixel"
        " FROM pages p JOIN documents d ON d.id = p.document_id"
        " WHERE p.project_id = ? ORDER BY d.created_at, d.rowid, p.page_index",
        (project_id,),
    ).fetchall()
    storeys = conn.execute(
        "SELECT name, level_m FROM storeys WHERE project_id = ? ORDER BY position", (project_id,)
    ).fetchall()
    snapshot = {"pages": [dict(row) for row in pages], "storeys": [dict(row) for row in storeys]}
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return snapshot, hashlib.sha256(canonical.encode()).hexdigest()


def _frame(project_id: str, version: int, snapshot: dict) -> Frame:
    return Frame(
        project_id=project_id,
        version=version,
        pages={page["page_id"]: PageFrame(**page) for page in snapshot["pages"]},
        storeys=[Storey(**storey) for storey in snapshot["storeys"]],
    )


def latest_frame(conn: sqlite3.Connection, project_id: str) -> Frame | None:
    row = conn.execute(
        "SELECT version, snapshot_json FROM frames WHERE project_id = ? ORDER BY version DESC LIMIT 1",
        (project_id,),
    ).fetchone()
    return None if row is None else _frame(project_id, row["version"], json.loads(row["snapshot_json"]))


def frame_status(conn: sqlite3.Connection, project_id: str) -> FrameStatus:
    row = conn.execute(
        "SELECT input_hash FROM frames WHERE project_id = ? ORDER BY version DESC LIMIT 1", (project_id,)
    ).fetchone()
    if row is None:
        return "none"
    _, input_hash = current_inputs(conn, project_id)
    return "current" if input_hash == row["input_hash"] else "stale"


def current_frame(conn: sqlite3.Connection, project_id: str) -> Frame:
    """The latest frame, or 409 if there is none or Pre changed since it was frozen."""
    if frame_status(conn, project_id) != "current":
        raise HTTPException(status_code=409, detail="Freeze the frame first")
    frame = latest_frame(conn, project_id)
    assert frame is not None
    return frame


def freeze_frame(conn: sqlite3.Connection, project_id: str) -> Frame:
    from ..takeoff.observations import on_frame_frozen

    snapshot, input_hash = current_inputs(conn, project_id)
    if not snapshot["pages"]:
        raise HTTPException(status_code=409, detail="Upload at least one drawing before freezing")
    previous = latest_frame(conn, project_id)
    version = 1 if previous is None else previous.version + 1
    conn.execute(
        "INSERT INTO frames (project_id, version, input_hash, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (project_id, version, input_hash, json.dumps(snapshot), now()),
    )
    frame = _frame(project_id, version, snapshot)
    on_frame_frozen(conn, project_id, None if previous is None else previous.version, frame)
    return frame
