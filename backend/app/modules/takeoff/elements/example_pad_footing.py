"""Example element: concrete in rectangular pad footings, in m3.

This file shows the whole pattern for an element. To add your own, copy this file,
rename it, change the key, and register it in elements/__init__.py.

How a pad footing gets measured here:

    observe   Each observation is one footing type on one storey: its mark, plan size,
              depth and how many there are. Values are always metres.
    measure   If the user draws a box around the footing on a plan, the plan size comes
              from the box and the page scale. The longer side is the length.
              Anything not visible on the plan (the depth) is typed in, or read by the
              agent from a section or schedule.
    quantify  Volume = count x length x width x depth, one BOQ item per observation,
              with a basis line so a reviewer can follow the sum.
    check     Problems a reviewer should see. Errors block confirming in Review,
              warnings and info do not.
"""

from collections import defaultdict

from pydantic import BaseModel, Field

from ...pre.frame import Frame
from .. import registry
from ..contracts import BoqItem, ElementSpec, Geometry, Issue, Observed

KEY = "example_pad_footing"
SECTION = "Example: In-situ concrete"


class PadFooting(BaseModel):
    """One pad footing type on one storey."""

    mark: str = Field(min_length=1, description="Footing mark as printed on the drawing, for example F1")
    length_m: float = Field(gt=0, description="Longer plan dimension in metres")
    width_m: float = Field(gt=0, description="Shorter plan dimension in metres")
    depth_m: float = Field(gt=0, description="Depth of the footing in metres, from a section or schedule")
    count: int = Field(default=1, ge=1, description="How many footings of this mark there are on this storey")


def measure(geometry: Geometry, frame: Frame) -> dict[str, float]:
    x0, y0, x1, y1 = geometry.bbox
    sides = sorted((frame.to_metres(geometry.page_id, x1 - x0), frame.to_metres(geometry.page_id, y1 - y0)))
    return {"length_m": sides[1], "width_m": sides[0]}


def quantify(observed: list[Observed], frame: Frame) -> list[BoqItem]:
    items = []
    for obs in observed:
        footing: PadFooting = obs.data
        volume = footing.count * footing.length_m * footing.width_m * footing.depth_m
        items.append(
            BoqItem(
                id=f"{KEY}:{obs.record.id}",
                element=KEY,
                section=SECTION,
                description="Pad footing concrete",
                quantity=round(volume, 3),
                unit="m3",
                storey=obs.record.storey,
                observation_ids=[obs.record.id],
                basis=f"{footing.count} x {footing.length_m:.3f} x {footing.width_m:.3f} x {footing.depth_m:.3f}",
            )
        )
    return items


def check(observed: list[Observed], items: list[BoqItem], frame: Frame) -> list[Issue]:
    issues = []
    for obs in observed:
        footing: PadFooting = obs.data
        if obs.record.storey is None:
            issues.append(
                Issue(
                    code="storey_missing",
                    message=f"{footing.mark}: choose a storey",
                    severity="error",
                    observation_ids=[obs.record.id],
                )
            )
        if footing.depth_m > 2.0:
            issues.append(
                Issue(
                    code="depth_unusual",
                    message=f"{footing.mark}: depth {footing.depth_m:.3f} m is unusually deep, check the section",
                    severity="warning",
                    observation_ids=[obs.record.id],
                )
            )

    by_mark: dict[tuple[str, str | None], list[str]] = defaultdict(list)
    for obs in observed:
        by_mark[(obs.data.mark, obs.record.storey)].append(obs.record.id)
    for (mark, storey), ids in by_mark.items():
        if len(ids) > 1:
            issues.append(
                Issue(
                    code="duplicate_mark",
                    message=f"{mark} appears {len(ids)} times on {storey or 'no storey'}, it may be counted twice",
                    severity="warning",
                    observation_ids=ids,
                )
            )
    return issues


SPEC = registry.register(
    ElementSpec(
        key=KEY,
        display_name="Example: Pad footing concrete",
        section=SECTION,
        observation_model=PadFooting,
        quantify=quantify,
        check=check,
        measure=measure,
        prompt_file=f"{KEY}.md",
    )
)
