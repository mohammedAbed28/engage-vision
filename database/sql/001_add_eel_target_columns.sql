-- Add EEL-only columns to the cloned working table. Legacy columns remain.

DELIMITER $$
DROP PROCEDURE IF EXISTS engagevision_final_eel.add_eel_columns$$
CREATE PROCEDURE engagevision_final_eel.add_eel_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='expected_likes_eel') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN expected_likes_eel DOUBLE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='expected_comments_eel') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN expected_comments_eel DOUBLE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='like_residual_eel') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN like_residual_eel DOUBLE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='comment_residual_eel') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN comment_residual_eel DOUBLE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='like_percentile_eel') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN like_percentile_eel DOUBLE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='comment_percentile_eel') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN comment_percentile_eel DOUBLE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='expected_engagement_lift_score') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN expected_engagement_lift_score DOUBLE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='eel_hac_boundary') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN eel_hac_boundary DOUBLE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='engagement_class_eel') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN engagement_class_eel TINYINT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='engagevision_final_eel' AND table_name='safespace' AND column_name='target_version_eel') THEN
    ALTER TABLE engagevision_final_eel.safespace ADD COLUMN target_version_eel VARCHAR(100) NULL;
  END IF;
END$$
DELIMITER ;

CALL engagevision_final_eel.add_eel_columns();
DROP PROCEDURE engagevision_final_eel.add_eel_columns;
