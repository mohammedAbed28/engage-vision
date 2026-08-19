#!/usr/bin/env python3
"""Apply and verify the EEL migration only in the cloned MySQL schema.

Credentials are read from the original local .env at runtime and are never
printed or copied. The mysql client receives the password through MYSQL_PWD.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


FINAL = Path(__file__).resolve().parents[2]
SOURCE_ENV = Path("/Users/hmode/Downloads/files/engagement_predictor/.env")
MYSQL = Path("/usr/local/mysql/bin/mysql")
SQL_FILES = [
    FINAL / "database" / "sql" / "000_backup_before_eel.sql",
    FINAL / "database" / "sql" / "001_add_eel_target_columns.sql",
    FINAL / "database" / "sql" / "002_populate_eel_target.sql",
    FINAL / "database" / "sql" / "003_verify_eel_migration.sql",
]


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> None:
    if not MYSQL.exists():
        raise FileNotFoundError(MYSQL)
    config = read_env(SOURCE_ENV)
    env = dict(os.environ)
    env["MYSQL_PWD"] = config.get("DB_PASSWORD", "")
    command = [
        str(MYSQL), "--local-infile=1", "--batch", "--raw",
        "--host", config.get("DB_HOST", "localhost"),
        "--port", config.get("DB_PORT", "3306"),
        "--user", config.get("DB_USER", "root"),
    ]
    report: dict[str, object] = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "source_schema_modified": False,
        "target_schema": "engagevision_final_eel",
        "steps": [],
    }
    def invoke(sql: str, extra: list[str] | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command + (extra or []), input=sql, text=True, capture_output=True,
            env=env, check=False,
        )

    local_infile_query = invoke("SELECT @@GLOBAL.local_infile;", ["--skip-column-names"])
    if local_infile_query.returncode:
        raise RuntimeError(local_infile_query.stderr)
    original_local_infile = local_infile_query.stdout.strip()
    report["original_global_local_infile"] = original_local_infile

    if original_local_infile == "0":
        enabled = invoke("SET GLOBAL local_infile = 1;")
        if enabled.returncode:
            raise RuntimeError("Could not temporarily enable local_infile: " + enabled.stderr)
        report["temporarily_enabled_local_infile"] = True

    failure: RuntimeError | None = None
    try:
        for path in SQL_FILES:
            completed = invoke(path.read_text(encoding="utf-8"))
            step = {
                "file": str(path),
                "returncode": completed.returncode,
                "stdout": completed.stdout,
                "stderr": completed.stderr.replace(config.get("DB_PASSWORD", ""), "[REDACTED]")
                if config.get("DB_PASSWORD") else completed.stderr,
            }
            report["steps"].append(step)
            if completed.returncode:
                failure = RuntimeError(f"SQL step failed: {path.name}: {step['stderr']}")
                break
    finally:
        if original_local_infile == "0":
            restored = invoke("SET GLOBAL local_infile = 0;")
            report["local_infile_restored"] = restored.returncode == 0
            if restored.returncode and failure is None:
                failure = RuntimeError("Could not restore local_infile: " + restored.stderr)

    if not failure and len(report["steps"]) == len(SQL_FILES):
        backup_output = str(report["steps"][0]["stdout"])
        verify_output = str(report["steps"][-1]["stdout"])

        def captured_int(pattern: str, source: str) -> int:
            match = re.search(pattern, source, flags=re.MULTILINE)
            if not match:
                raise RuntimeError(f"Verification output did not match: {pattern}")
            return int(match.group(1))

        backup_counts = re.search(
            r"original_rows\tworking_rows\tbackup_rows\n(\d+)\t(\d+)\t(\d+)",
            backup_output,
        )
        if not backup_counts:
            raise RuntimeError("Backup row counts were not present in SQL output")
        report["verification"] = {
            "original_rows": int(backup_counts.group(1)),
            "working_rows": int(backup_counts.group(2)),
            "backup_rows": int(backup_counts.group(3)),
            "non_training_rows": captured_int(
                r"\n\d+\t\d+\t\d+\t[0-9.]+\t(\d+)\t\d+\n", verify_output
            ),
            "bad_populated_versions": captured_int(
                r"\n\d+\t\d+\t\d+\t[0-9.]+\t\d+\t(\d+)\n", verify_output
            ),
            "legacy_differences": captured_int(
                r"legacy_differences\n(\d+)", verify_output
            ),
            "original_schema_eel_columns": captured_int(
                r"original_schema_eel_columns\n(\d+)", verify_output
            ),
        }

    report["status"] = "FAILED" if failure else "PASSED"
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    log_path = FINAL / "archive" / "logs" / "sql_clone_migration.json"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    if failure:
        raise failure
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
