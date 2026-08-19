-- Populate only the EEL columns in the cloned working table.
-- mysql client must be started with --local-infile=1.

DROP TABLE IF EXISTS engagevision_final_eel.eel_target_stage;
CREATE TABLE engagevision_final_eel.eel_target_stage (
  post_id VARCHAR(255) PRIMARY KEY,
  expected_likes_eel DOUBLE NOT NULL,
  expected_comments_eel DOUBLE NOT NULL,
  like_residual_eel DOUBLE NOT NULL,
  comment_residual_eel DOUBLE NOT NULL,
  like_percentile_eel DOUBLE NOT NULL,
  comment_percentile_eel DOUBLE NOT NULL,
  expected_engagement_lift_score DOUBLE NOT NULL,
  eel_hac_boundary DOUBLE NOT NULL,
  engagement_class_eel TINYINT NOT NULL,
  target_version_eel VARCHAR(100) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

LOAD DATA LOCAL INFILE '/Users/hmode/Documents/Codex/EngageVision_Final_EEL/database/sql/eel_target_values.csv'
INTO TABLE engagevision_final_eel.eel_target_stage
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

DELIMITER $$
DROP PROCEDURE IF EXISTS engagevision_final_eel.validate_eel_stage$$
CREATE PROCEDURE engagevision_final_eel.validate_eel_stage()
BEGIN
  DECLARE stage_rows BIGINT DEFAULT 0;
  DECLARE matched_rows BIGINT DEFAULT 0;
  DECLARE invalid_rows BIGINT DEFAULT 0;

  SELECT COUNT(*) INTO stage_rows FROM engagevision_final_eel.eel_target_stage;
  SELECT COUNT(*) INTO matched_rows
  FROM engagevision_final_eel.safespace s
  JOIN engagevision_final_eel.eel_target_stage e
    ON CONVERT(CAST(s.post_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci
     = e.post_id COLLATE utf8mb4_unicode_ci;
  SELECT COUNT(*) INTO invalid_rows
  FROM engagevision_final_eel.eel_target_stage
  WHERE engagement_class_eel NOT IN (0,1)
     OR target_version_eel <> 'EEL_V1_W40_C60_BOOTSTRAP_HAC'
     OR like_percentile_eel NOT BETWEEN 0 AND 1
     OR comment_percentile_eel NOT BETWEEN 0 AND 1
     OR expected_engagement_lift_score NOT BETWEEN 0 AND 1;

  IF stage_rows <> 88419 OR matched_rows <> 88419 OR invalid_rows <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'EEL staging validation failed; target table was not updated';
  END IF;
END$$
DELIMITER ;

CALL engagevision_final_eel.validate_eel_stage();
DROP PROCEDURE engagevision_final_eel.validate_eel_stage;

START TRANSACTION;
UPDATE engagevision_final_eel.safespace s
JOIN engagevision_final_eel.eel_target_stage e
  ON CONVERT(CAST(s.post_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci
   = e.post_id COLLATE utf8mb4_unicode_ci
SET
  s.expected_likes_eel = e.expected_likes_eel,
  s.expected_comments_eel = e.expected_comments_eel,
  s.like_residual_eel = e.like_residual_eel,
  s.comment_residual_eel = e.comment_residual_eel,
  s.like_percentile_eel = e.like_percentile_eel,
  s.comment_percentile_eel = e.comment_percentile_eel,
  s.expected_engagement_lift_score = e.expected_engagement_lift_score,
  s.eel_hac_boundary = e.eel_hac_boundary,
  s.engagement_class_eel = e.engagement_class_eel,
  s.target_version_eel = e.target_version_eel;
COMMIT;
