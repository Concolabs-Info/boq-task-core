from pydantic import BaseModel, Field, field_validator


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value


class Project(BaseModel):
    id: str
    name: str
    created_at: str


class Document(BaseModel):
    id: str
    filename: str
    sha256: str
    page_count: int


class Page(BaseModel):
    id: str
    document_id: str
    page_index: int
    width_px: int
    height_px: int
    metres_per_pixel: float | None
    scale: dict | None
    image_url: str


class StoreyIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    level_m: float


class FrameInfo(BaseModel):
    version: int | None
    status: str
