-- Migration: Create otp_tokens table for MySQL-backed Student Portal OTPs
CREATE TABLE IF NOT EXISTS `otp_tokens` (
  `identifier` VARCHAR(150) NOT NULL,
  `otp_hash` VARCHAR(128) NOT NULL,
  `student_id` VARCHAR(64) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `expires_at` BIGINT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`),
  INDEX `idx_otp_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
