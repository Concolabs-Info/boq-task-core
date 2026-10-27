"""BOQ: confirmed items grouped into lines."""

import csv
import io
import sqlite3

from pydantic import BaseModel

from ..review.service import element_status
from ..takeoff import registry
from ..takeoff.contracts import BoqItem
from ..takeoff.pipeline import run_element


class BoqLine(BaseModel):
    section: str
    item_code: str | None
    description: str
    unit: str
    quantity: float
    items: list[BoqItem]


def build_boq(conn: sqlite3.Connection, project_id: str) -> list[BoqLine]:
    """Only elements whose review status is confirmed are included."""
    groups: dict[tuple[str, str | None, str, str], list[BoqItem]] = {}
    for spec in registry.all_specs():
        result = run_element(conn, project_id, spec.key)
        if element_status(conn, project_id, spec.key, result) != "confirmed":
            continue
        for item in result.items:
            groups.setdefault((item.section, item.item_code, item.description, item.unit), []).append(item)

    lines = [
        BoqLine(
            section=section,
            item_code=item_code,
            description=description,
            unit=unit,
            quantity=round(sum(item.quantity for item in items), 3),
            items=items,
        )
        for (section, item_code, description, unit), items in groups.items()
    ]
    return sorted(lines, key=lambda line: (line.section, line.description, line.unit))


def _number(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".")


def to_csv(lines: list[BoqLine]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["Section", "Item code", "Description", "Quantity", "Unit"])
    for line in lines:
        writer.writerow([line.section, line.item_code or "", line.description, _number(line.quantity), line.unit])
    return buffer.getvalue()
