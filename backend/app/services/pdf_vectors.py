"""Deterministic reading of a PDF page: text, vector paths and layers. No AI involved.

CAD exports keep a lot of exact information that a page image loses:

- text with its exact position (marks, dimensions, schedules, notes)
- vector paths: the lines and rectangles the drawing is made of
- layers (PDF "optional content groups"), often named after CAD layers such as FOUNDATIONS

Everything is returned in render pixels (150 DPI, origin top left), the same coordinates the
rest of the app uses, so a box from the viewer can be passed straight in.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import pymupdf

from .pdf import RENDER_DPI

PathKind = Literal["line", "rect", "curve", "quad"]
BBox = tuple[float, float, float, float]


@dataclass(frozen=True)
class TextLine:
    text: str
    bbox: BBox


@dataclass(frozen=True)
class VectorPath:
    kind: PathKind
    bbox: BBox
    layer: str | None
    points: list[tuple[float, float]] = field(default_factory=list)


@dataclass(frozen=True)
class PageVectors:
    layers: list[str]
    text: list[TextLine]
    paths: list[VectorPath]


def _to_px(value: float, dpi: int) -> float:
    return value * dpi / 72


def _rect_px(rect: pymupdf.Rect, dpi: int) -> BBox:
    return (_to_px(rect.x0, dpi), _to_px(rect.y0, dpi), _to_px(rect.x1, dpi), _to_px(rect.y1, dpi))


def _text_lines(page: pymupdf.Page, clip: pymupdf.Rect | None, dpi: int) -> list[TextLine]:
    """Words grouped into the lines PyMuPDF found them in, in reading order."""
    words = page.get_text("words", clip=clip, sort=True)
    lines: dict[tuple[int, int], list] = {}
    for word in words:
        lines.setdefault((word[5], word[6]), []).append(word)
    result = []
    for group in lines.values():
        rect = pymupdf.Rect(group[0][:4])
        for word in group[1:]:
            rect |= pymupdf.Rect(word[:4])
        result.append(TextLine(" ".join(word[4] for word in group), _rect_px(rect, dpi)))
    return result


def _segment_hits_box(a: pymupdf.Point, b: pymupdf.Point, clip: pymupdf.Rect) -> bool:
    """Liang-Barsky clipping: does the segment a-b pass through the box?"""
    t0, t1 = 0.0, 1.0
    dx, dy = b.x - a.x, b.y - a.y
    for p, q in ((-dx, a.x - clip.x0), (dx, clip.x1 - a.x), (-dy, a.y - clip.y0), (dy, clip.y1 - a.y)):
        if p == 0:
            if q < 0:
                return False
            continue
        t = q / p
        if p < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
        if t0 > t1:
            return False
    return True


def _touches(kind: PathKind, rect: pymupdf.Rect, points: list, clip: pymupdf.Rect) -> bool:
    """True when the path is in or crosses the box. A closed shape that only surrounds the box,
    such as the drawing border, is left out: none of its lines are inside."""
    if kind == "line":
        return _segment_hits_box(points[0], points[1], clip)
    if not (rect.intersects(clip) or clip.contains(rect)):
        return False
    surrounds = rect.x0 < clip.x0 and rect.y0 < clip.y0 and rect.x1 > clip.x1 and rect.y1 > clip.y1
    return not (kind in ("rect", "quad") and surrounds)


def _paths(page: pymupdf.Page, clip: pymupdf.Rect | None, layers: set[str] | None, dpi: int) -> list[VectorPath]:
    result = []
    for drawing in page.get_drawings():
        layer = drawing.get("layer") or None
        if layers is not None and layer not in layers:
            continue
        for item in drawing["items"]:
            op = item[0]
            if op == "l":
                points = [item[1], item[2]]
                rect = pymupdf.Rect(item[1], item[2]).normalize()
                kind: PathKind = "line"
            elif op == "re":
                rect = pymupdf.Rect(item[1])
                points = [rect.tl, rect.tr, rect.br, rect.bl]
                kind = "rect"
            elif op == "qu":
                quad = item[1]
                rect = quad.rect
                points = [quad.ul, quad.ur, quad.lr, quad.ll]
                kind = "quad"
            elif op == "c":
                points = list(item[1:5])
                rect = pymupdf.Rect(points[0], points[0])
                for point in points[1:]:
                    rect |= point
                kind = "curve"
            else:
                continue
            if clip is not None and not _touches(kind, rect, points, clip):
                continue
            result.append(
                VectorPath(
                    kind=kind,
                    bbox=_rect_px(rect, dpi),
                    layer=layer,
                    points=[(_to_px(p.x, dpi), _to_px(p.y, dpi)) for p in points],
                )
            )
    return result


def read_vectors(
    pdf_path: Path,
    page_index: int,
    bbox: BBox | None = None,
    layers: set[str] | None = None,
    dpi: int = RENDER_DPI,
) -> PageVectors:
    """Text, vector paths and layer names of one page, optionally limited to a box and to some layers.

    bbox is (x0, y0, x1, y1) in render pixels. Paths are kept when they touch the box.
    """
    doc = pymupdf.open(pdf_path)
    try:
        page = doc[page_index]
        clip = None
        if bbox is not None:
            x0, y0, x1, y1 = (value * 72 / dpi for value in bbox)
            clip = pymupdf.Rect(x0, y0, x1, y1)
        return PageVectors(
            layers=sorted({group["name"] for group in doc.get_ocgs().values()}),
            text=_text_lines(page, clip, dpi),
            paths=_paths(page, clip, layers, dpi),
        )
    finally:
        doc.close()
