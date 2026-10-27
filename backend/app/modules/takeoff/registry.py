"""Known elements. Each element module calls register() when it is imported."""

from fastapi import HTTPException

from .contracts import ElementInfo, ElementSpec

_SPECS: dict[str, ElementSpec] = {}


def register(spec: ElementSpec) -> ElementSpec:
    if spec.key in _SPECS and _SPECS[spec.key] is not spec:
        raise ValueError(f"Element {spec.key} is already registered")
    _SPECS[spec.key] = spec
    return spec


def unregister(key: str) -> None:
    _SPECS.pop(key, None)


def get(key: str) -> ElementSpec:
    try:
        return _SPECS[key]
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown element: {key}") from None


def all_specs() -> list[ElementSpec]:
    return sorted(_SPECS.values(), key=lambda spec: spec.key)


def all_specs_by_key() -> dict[str, ElementSpec]:
    return dict(_SPECS)


def schema_for(key: str) -> dict:
    return get(key).observation_model.model_json_schema()


def info(spec: ElementSpec) -> ElementInfo:
    return ElementInfo(
        key=spec.key,
        display_name=spec.display_name,
        section=spec.section,
        schema=spec.observation_model.model_json_schema(),
        has_prompt=spec.prompt_file is not None,
    )
