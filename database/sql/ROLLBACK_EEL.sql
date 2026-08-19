-- Roll back only EEL additions inside the cloned schema.
-- The original safespace schema and legacy columns are never touched.

ALTER TABLE engagevision_final_eel.safespace
  DROP COLUMN expected_likes_eel,
  DROP COLUMN expected_comments_eel,
  DROP COLUMN like_residual_eel,
  DROP COLUMN comment_residual_eel,
  DROP COLUMN like_percentile_eel,
  DROP COLUMN comment_percentile_eel,
  DROP COLUMN expected_engagement_lift_score,
  DROP COLUMN eel_hac_boundary,
  DROP COLUMN engagement_class_eel,
  DROP COLUMN target_version_eel;

DROP TABLE IF EXISTS engagevision_final_eel.eel_target_stage;

SELECT COUNT(*) AS restored_legacy_rows
FROM engagevision_final_eel.safespace;
