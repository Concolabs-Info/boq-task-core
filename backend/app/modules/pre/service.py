"""Pre: projects, uploaded drawings and their rendered pages."""

import hashlib
import json
import sqlite3
from pathlib import Path

from fastapi import HTTPException

from ...db import new_id, now
from ...services.pdf import InvalidPdf, RenderedPage, render_pdf
from .models import Document, Page, Project, StoreyIn
from .scale import PointsScale, RatioScale, metres_per_pixel


def create_project(conn: sqlite3.Connection, name: str) -> Project:
    project = Project(id=new_id(), name=name, created_at=now())
    conn.execute("INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)", (project.id, name, project.created_at))
    return project


def list_projects(conn: sqlite3.Connection) -> list[Project]:
    rows = conn.execute("SELECT id, name, created_at FROM projects ORDER BY created_at DESC, name").fetchall()
    return [Project(**dict(row)) for row in rows]


def get_project(conn: sqlite3.Connection, project_id: str) -> Project:
    row = conn.execute("SELECT id, name, created_at FROM projects WHERE id = ?", (project_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**dict(row))


def add_documents(
    conn: sqlite3.Connection, storage_root: Path, project_id: str, files: list[tuple[str, bytes]]
) -> list[Document]:
    """Store PDFs and their page renders. Every file is checked before anything is written."""
    get_project(conn, project_id)
    rendered: list[tuple[str, bytes, list[RenderedPage]]] = []
    for filename, data in files:
        try:
            rendered.append((filename, data, render_pdf(data)))
        except InvalidPdf as error:
            raise HTTPException(status_code=400, detail=f"{filename} is not a readable PDF") from error

    source_dir = storage_root / project_id / "source"
    render_dir = storage_root / project_id / "renders"
    source_dir.mkdir(parents=True, exist_ok=True)
    render_dir.mkdir(parents=True, exist_ok=True)

    documents = []
    for filename, data, pages in rendered:
        document = Document(
            id=new_id(), filename=filename, sha256=hashlib.sha256(data).hexdigest(), page_count=len(pages)
        )
        (source_dir / f"{document.id}.pdf").write_bytes(data)
        conn.execute(
            "INSERT INTO documents (id, project_id, filename, sha256, page_count, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (document.id, project_id, filename, document.sha256, document.page_count, now()),
        )
        for page in pages:
            page_id = new_id()
            (render_dir / f"{page_id}.png").write_bytes(page.png)
            conn.execute(
                "INSERT INTO pages (id, document_id, project_id, page_index, width_px, height_px)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (page_id, document.id, project_id, page.index, page.width_px, page.height_px),
            )
        documents.append(document)
    return documents


def _page(row: sqlite3.Row) -> Page:
    return Page(
        id=row["id"],
        document_id=row["document_id"],
        page_index=row["page_index"],
        width_px=row["width_px"],
        height_px=row["height_px"],
        metres_per_pixel=row["metres_per_pixel"],
        scale=json.loads(row["scale_json"]) if row["scale_json"] else None,
        image_url=f"/api/pages/{row['id']}/image",
    )


PAGE_COLUMNS = "p.id, p.document_id, p.page_index, p.width_px, p.height_px, p.metres_per_pixel, p.scale_json"


def list_pages(conn: sqlite3.Connection, project_id: str) -> list[Page]:
    get_project(conn, project_id)
    rows = conn.execute(
        f"SELECT {PAGE_COLUMNS} FROM pages p JOIN documents d ON d.id = p.document_id"
        " WHERE p.project_id = ? ORDER BY d.created_at, d.rowid, p.page_index",
        (project_id,),
    ).fetchall()
    return [_page(row) for row in rows]


def get_page(conn: sqlite3.Connection, page_id: str) -> tuple[Page, str]:
    """The page and its project id."""
    row = conn.execute(f"SELECT {PAGE_COLUMNS}, p.project_id FROM pages p WHERE p.id = ?", (page_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Page not found")
    return _page(row), row["project_id"]


def render_path(storage_root: Path, project_id: str, page_id: str) -> Path:
    return storage_root / project_id / "renders" / f"{page_id}.png"


def set_scale(conn: sqlite3.Connection, page_id: str, scale: RatioScale | PointsScale) -> Page:
    get_page(conn, page_id)
    try:
        value = metres_per_pixel(scale)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    conn.execute(
        "UPDATE pages SET metres_per_pixel = ?, scale_json = ? WHERE id = ?",
        (value, scale.model_dump_json(), page_id),
    )
    return get_page(conn, page_id)[0]


def list_storeys(conn: sqlite3.Connection, project_id: str) -> list[StoreyIn]:
    get_project(conn, project_id)
    rows = conn.execute(
        "SELECT name, level_m FROM storeys WHERE project_id = ? ORDER BY position", (project_id,)
    ).fetchall()
    return [StoreyIn(**dict(row)) for row in rows]


def replace_storeys(conn: sqlite3.Connection, project_id: str, storeys: list[StoreyIn]) -> list[StoreyIn]:
    get_project(conn, project_id)
    names = [storey.name.strip() for storey in storeys]
    if len(set(names)) != len(names):
        raise HTTPException(status_code=422, detail="Storey names must be unique")
    conn.execute("DELETE FROM storeys WHERE project_id = ?", (project_id,))
    conn.executemany(
        "INSERT INTO storeys (project_id, name, level_m, position) VALUES (?, ?, ?, ?)",
        [
            (project_id, name, storey.level_m, index)
            for index, (name, storey) in enumerate(zip(names, storeys, strict=True))
        ],
    )
    return list_storeys(conn, project_id)
