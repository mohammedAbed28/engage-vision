from conftest import ROOT


EXPECTED = {
    "expected_likes_eel", "expected_comments_eel", "like_residual_eel",
    "comment_residual_eel", "like_percentile_eel", "comment_percentile_eel",
    "expected_engagement_lift_score", "eel_hac_boundary",
    "engagement_class_eel", "target_version_eel",
}


def test_sql_migration_contains_every_eel_column():
    sql = (ROOT / "database" / "sql" / "001_add_eel_target_columns.sql").read_text(encoding="utf-8")
    assert all(column in sql for column in EXPECTED)
    assert "DROP COLUMN engagement_class" not in sql
