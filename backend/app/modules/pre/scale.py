"""Drawing scale as metres per render pixel. Pages are rendered at 150 DPI."""

import math
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from ...services.pdf import RENDER_DPI

METRES_PER_INCH = 0.0254


def scale_from_ratio(denominator: float, dpi: int = RENDER_DPI) -> float:
    """A printed scale such as 1:100. One render pixel is 0.0254 / dpi metres on paper."""
    if denominator <= 0:
        raise ValueError("Scale ratio must be greater than zero")
    return denominator * METRES_PER_INCH / dpi


def scale_from_points(p1: tuple[float, float], p2: tuple[float, float], distance_m: float) -> float:
    """Two points picked on the page and the real distance between them."""
    if distance_m <= 0:
        raise ValueError("Distance must be greater than zero")
    pixels = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    if pixels < 1:
        raise ValueError("Pick two points further apart")
    return distance_m / pixels


class RatioScale(BaseModel):
    method: Literal["ratio"]
    denominator: float


class PointsScale(BaseModel):
    method: Literal["points"]
    p1: tuple[float, float]
    p2: tuple[float, float]
    distance_m: float


ScaleIn = Annotated[RatioScale | PointsScale, Field(discriminator="method")]


def metres_per_pixel(scale: RatioScale | PointsScale) -> float:
    if isinstance(scale, RatioScale):
        return scale_from_ratio(scale.denominator)
    return scale_from_points(scale.p1, scale.p2, scale.distance_m)
