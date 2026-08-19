# SQL EEL Audit

## Safety decision

The original `safespace` schema is read-only and remains unchanged. EEL is
materialized in a new schema named `engagevision_final_eel`. The working main
table and an immutable pre-EEL table copy are created from
`safespace.safespace` before new columns are added.

## Verified source

- Original main table: 88,556 rows.
- `text_embeddings`: 88,424 rows.
- `image_embeddings`: 88,551 rows.
- Inner joined usable population: 88,419 unique `post_id` values.
- Joined sorted-ID SHA-256:
  `28f623f8c2fbb6c1c6b26986ffa18b9376e84b8998c30a601e3100c3c7ab24bc`.
- Six accounts; historical split 61,893 / 13,263 / 13,263.
- No M2 or EEL columns existed in the original main table during the audit.

## Migration order

1. `000_backup_before_eel.sql`
2. `001_add_eel_target_columns.sql`
3. `002_populate_eel_target.sql` with MySQL `--local-infile=1`
4. `003_verify_eel_migration.sql`

The staged CSV contains exactly 88,419 unique IDs and is checked before the
transactional update. Only EEL columns in the cloned table are updated.

## Expected validation

- Total EEL High: 39,941 / 88,419 (45.172%).
- Train: 27,974 / 61,893 (45.197%).
- Validation: 5,990 / 13,263 (45.163%).
- Test: 5,977 / 13,263 (45.065%).
- `legacy_differences` must be 0.
- `original_schema_eel_columns` must be 0.
- EEL target version must be `EEL_V1_W40_C60_BOOTSTRAP_HAC` for every row.

## Rollback

`ROLLBACK_EEL.sql` removes only the ten new EEL columns and the staging table
from the cloned schema. It does not drop the cloned legacy data, the pre-EEL
backup or anything in the original schema.
