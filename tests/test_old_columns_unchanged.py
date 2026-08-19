import json

from conftest import ROOT


def test_original_schema_and_legacy_columns_are_unchanged():
    audit = json.loads((ROOT / "archive" / "logs" / "sql_clone_migration.json").read_text(encoding="utf-8"))
    assert audit["status"] == "PASSED"
    verification = audit["verification"]
    assert verification["legacy_differences"] == 0
    assert verification["original_schema_eel_columns"] == 0
    assert verification["original_rows"] == verification["working_rows"] == verification["backup_rows"]
