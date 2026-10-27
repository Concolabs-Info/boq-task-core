import pymupdf


def make_pdf(pages: int = 1, size_pt: tuple[float, float] = (842, 595)) -> bytes:
    """A small PDF with a rectangle and a label on each page."""
    doc = pymupdf.open()
    for index in range(pages):
        page = doc.new_page(width=size_pt[0], height=size_pt[1])
        page.draw_rect(pymupdf.Rect(100, 100, 300, 250), color=(0, 0, 0), width=1)
        page.insert_text((100, 90), f"F{index + 1} 1500 x 1200 x 600 deep", fontsize=10)
    data = doc.tobytes()
    doc.close()
    return data


def upload(client, project_id: str, pdf: bytes, filename: str = "drawings.pdf"):
    return client.post(
        f"/api/projects/{project_id}/documents",
        files=[("files", (filename, pdf, "application/pdf"))],
    )


def new_project(client, name: str = "Demo") -> str:
    return client.post("/api/projects", json={"name": name}).json()["id"]
