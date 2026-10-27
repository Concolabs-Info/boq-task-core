from pathlib import Path

from scripts.export_contracts import CONTRACTS_DIR, export


def test_contracts_up_to_date(tmp_path):
    written = export(tmp_path)
    names = sorted(path.name for path in written)
    assert names == [
        "boq-item.schema.json",
        "geometry.schema.json",
        "issue.schema.json",
        "observation-record.schema.json",
    ]
    for path in written:
        committed = Path(CONTRACTS_DIR) / path.name
        assert committed.exists(), f"{committed} is missing. Run: python backend/scripts/export_contracts.py"
        assert committed.read_text(encoding="utf-8") == path.read_text(encoding="utf-8"), (
            f"{path.name} is out of date. Run: python backend/scripts/export_contracts.py"
        )
