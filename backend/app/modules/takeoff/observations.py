"""Observations: the facts read from drawings for one element."""

import sqlite3

from ..pre.frame import Frame


def on_frame_frozen(conn: sqlite3.Connection, project_id: str, old_version: int | None, new_frame: Frame) -> None:
    """Carry observations forward to a newly frozen frame."""
