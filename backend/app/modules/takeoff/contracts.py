"""The contract every element follows.

An element turns observations (facts read from drawings) into BOQ items in three steps:

1. observe   Facts arrive from the agent or from manual entry, shaped by the element's
             observation_model. If the user drew a box, `measure` fills values from it.
2. quantify  Plain code that turns observations into BoqItems. No AI here.
3. check     Plain code that reports problems as Issues. Errors block confirming in Review.

All values are metres (and counts). Pixel geometry is kept only for traceability.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from ..pre.frame import Frame


class Geometry(BaseModel):
    """A box on a page, in render pixels (150 DPI), origin top left."""

    page_id: str
    bbox: tuple[float, float, float, float] = Field(description="x0, y0, x1, y1 in render pixels")

    @model_validator(mode="after")
    def _ordered(self) -> "Geometry":
        x0, y0, x1, y1 = self.bbox
        if min(self.bbox) < 0 or x1 <= x0 or y1 <= y0:
            raise ValueError("bbox must be x0, y0, x1, y1 with x0 < x1 and y0 < y1, all zero or more")
        return self


class ObservationIn(BaseModel):
    storey: str | None = None
    geometry: Geometry | None = None
    values: dict[str, Any] = Field(default_factory=dict)


class ObservationRecord(BaseModel):
    id: str
    project_id: str
    element: str
    frame_version: int
    storey: str | None
    source: Literal["agent", "manual"]
    geometry: Geometry | None
    values: dict[str, Any]
    created_at: str


@dataclass(frozen=True)
class Observed:
    """A stored observation together with its values parsed by the element's observation_model."""

    record: ObservationRecord
    data: BaseModel


class BoqItem(BaseModel):
    id: str
    element: str
    section: str
    item_code: str | None = None
    description: str
    quantity: float
    unit: str
    storey: str | None
    observation_ids: list[str]
    basis: str = Field(description="How the quantity was worked out, for example 2 x 1.500 x 0.600")


class Issue(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warning", "error"]
    observation_ids: list[str] = Field(default_factory=list)


@dataclass(frozen=True)
class ElementSpec:
    key: str
    display_name: str
    section: str
    observation_model: type[BaseModel]
    quantify: Callable[[list[Observed], Frame], list[BoqItem]]
    check: Callable[[list[Observed], list[BoqItem], Frame], list[Issue]]
    measure: Callable[[Geometry, Frame], dict[str, float]] | None = None
    prompt_file: str | None = None


class ElementResult(BaseModel):
    element: str
    frame_version: int | None
    observations: list[ObservationRecord]
    items: list[BoqItem]
    issues: list[Issue]


class ElementInfo(BaseModel):
    key: str
    display_name: str
    section: str
    schema_: dict = Field(alias="schema")
    has_prompt: bool
