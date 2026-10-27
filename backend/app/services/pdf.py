"""PDF reading and page rendering with PyMuPDF."""

from dataclasses import dataclass
from pathlib import Path

import pymupdf

RENDER_DPI = 150


class InvalidPdf(ValueError):
    pass


@dataclass(frozen=True)
class RenderedPage:
    index: int
    width_px: int
    height_px: int
    png: bytes


def render_pdf(data: bytes, dpi: int = RENDER_DPI) -> list[RenderedPage]:
    """Render every page to PNG. Raises InvalidPdf if the bytes are not a readable PDF."""
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as error:
        raise InvalidPdf(str(error)) from error
    try:
        if doc.page_count == 0:
            raise InvalidPdf("PDF has no pages")
        pages = []
        for page in doc:
            pixmap = page.get_pixmap(dpi=dpi)
            pages.append(RenderedPage(page.number, pixmap.width, pixmap.height, pixmap.tobytes("png")))
        return pages
    finally:
        doc.close()


def crop_png(path: Path, bbox: tuple[float, float, float, float]) -> bytes:
    """Crop a rendered page PNG to bbox (x0, y0, x1, y1) in render pixels, clamped to the page."""
    pixmap = pymupdf.Pixmap(str(path))
    x0, y0, x1, y1 = bbox
    x0, x1 = max(0, int(x0)), min(pixmap.width, int(round(x1)))
    y0, y1 = max(0, int(y0)), min(pixmap.height, int(round(y1)))
    if x1 <= x0 or y1 <= y0:
        raise ValueError("Crop area is outside the page")
    cropped = pymupdf.Pixmap(pixmap, pixmap.width, pixmap.height, pymupdf.IRect(x0, y0, x1, y1))
    return cropped.tobytes("png")
