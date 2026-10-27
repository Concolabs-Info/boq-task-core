"""Write the shared JSON contracts from the backend models.

Run from the repo root after changing a contract model or an API route:

    python backend/scripts/export_contracts.py
"""

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
CONTRACTS_DIR = BACKEND_DIR.parent / "shared" / "contracts"

sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.modules.takeoff.contracts import BoqItem, Geometry, Issue, ObservationRecord  # noqa: E402

MODELS = {
    "boq-item.schema.json": BoqItem,
    "geometry.schema.json": Geometry,
    "issue.schema.json": Issue,
    "observation-record.schema.json": ObservationRecord,
}


def _write(path: Path, data: dict) -> Path:
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return path


def export(out_dir: Path = CONTRACTS_DIR) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = [_write(out_dir / name, model.model_json_schema()) for name, model in MODELS.items()]
    app = create_app(Settings(database_path=out_dir / "unused.db", storage_root=out_dir / "unused"))
    written.append(_write(out_dir / "openapi.json", app.openapi()))
    return written


if __name__ == "__main__":
    for path in export():
        print(f"wrote {path.relative_to(BACKEND_DIR.parent)}")
