-- EngageVision EEL: create a protected working copy without modifying safespace.
-- Run with a user that can CREATE SCHEMA/TABLE. This script never updates the
-- original safespace schema.

SET @source_schema = 'safespace';
SET @target_schema = 'engagevision_final_eel';

CREATE SCHEMA IF NOT EXISTS engagevision_final_eel
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS engagevision_final_eel.safespace
  LIKE safespace.safespace;

DELIMITER $$
DROP PROCEDURE IF EXISTS engagevision_final_eel.copy_source_if_safe$$
CREATE PROCEDURE engagevision_final_eel.copy_source_if_safe()
BEGIN
  DECLARE source_rows BIGINT DEFAULT 0;
  DECLARE target_rows BIGINT DEFAULT 0;

  SELECT COUNT(*) INTO source_rows FROM safespace.safespace;
  SELECT COUNT(*) INTO target_rows FROM engagevision_final_eel.safespace;

  IF target_rows = 0 THEN
    INSERT INTO engagevision_final_eel.safespace
      SELECT * FROM safespace.safespace;
  ELSEIF target_rows <> source_rows THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing copy: EEL working table is partially populated';
  END IF;
END$$
DELIMITER ;

CALL engagevision_final_eel.copy_source_if_safe();
DROP PROCEDURE engagevision_final_eel.copy_source_if_safe;

CREATE TABLE IF NOT EXISTS engagevision_final_eel.safespace_backup_before_eel
  LIKE engagevision_final_eel.safespace;

DELIMITER $$
DROP PROCEDURE IF EXISTS engagevision_final_eel.backup_source_if_safe$$
CREATE PROCEDURE engagevision_final_eel.backup_source_if_safe()
BEGIN
  DECLARE source_rows BIGINT DEFAULT 0;
  DECLARE backup_rows BIGINT DEFAULT 0;

  SELECT COUNT(*) INTO source_rows FROM engagevision_final_eel.safespace;
  SELECT COUNT(*) INTO backup_rows FROM engagevision_final_eel.safespace_backup_before_eel;

  IF backup_rows = 0 THEN
    INSERT INTO engagevision_final_eel.safespace_backup_before_eel
      SELECT * FROM engagevision_final_eel.safespace;
  ELSEIF backup_rows <> source_rows THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing backup: existing pre-EEL backup is incomplete';
  END IF;
END$$
DELIMITER ;

CALL engagevision_final_eel.backup_source_if_safe();
DROP PROCEDURE engagevision_final_eel.backup_source_if_safe;

SELECT
  (SELECT COUNT(*) FROM safespace.safespace) AS original_rows,
  (SELECT COUNT(*) FROM engagevision_final_eel.safespace) AS working_rows,
  (SELECT COUNT(*) FROM engagevision_final_eel.safespace_backup_before_eel) AS backup_rows;
