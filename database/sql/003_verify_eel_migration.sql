-- Read-only verification after the cloned-schema migration.

SELECT
  COUNT(*) AS rows_total,
  COUNT(DISTINCT post_id) AS unique_post_ids,
  SUM(engagement_class_eel = 1) AS eel_high,
  AVG(engagement_class_eel = 1) AS eel_high_rate,
  SUM(engagement_class_eel IS NULL) AS non_training_rows,
  SUM(
    engagement_class_eel IS NOT NULL
    AND target_version_eel <> 'EEL_V1_W40_C60_BOOTSTRAP_HAC'
  ) AS bad_populated_versions
FROM engagevision_final_eel.safespace;

SELECT username, COUNT(*) AS rows_total,
       SUM(engagement_class_eel = 1) AS eel_high,
       AVG(engagement_class_eel = 1) AS eel_high_rate,
       MIN(eel_hac_boundary) AS min_boundary,
       MAX(eel_hac_boundary) AS max_boundary
FROM engagevision_final_eel.safespace
GROUP BY username ORDER BY username;

SELECT COUNT(*) AS legacy_differences
FROM engagevision_final_eel.safespace current_row
JOIN engagevision_final_eel.safespace_backup_before_eel backup_row
  ON current_row.post_id = backup_row.post_id
WHERE NOT (current_row.engagement_score_pro <=> backup_row.engagement_score_pro)
   OR NOT (current_row.cluster_k2 <=> backup_row.cluster_k2)
   OR NOT (current_row.engagement_class <=> backup_row.engagement_class);

SELECT COUNT(*) AS original_schema_eel_columns
FROM information_schema.columns
WHERE table_schema='safespace' AND table_name='safespace'
  AND column_name IN (
    'expected_likes_eel','expected_comments_eel','like_residual_eel',
    'comment_residual_eel','like_percentile_eel','comment_percentile_eel',
    'expected_engagement_lift_score','eel_hac_boundary',
    'engagement_class_eel','target_version_eel'
  );
