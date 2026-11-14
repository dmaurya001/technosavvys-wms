-- ============================================================================
-- TECHNOSAVVYS WORKSHOP MANAGEMENT SYSTEM (WMS) - PRODUCTION MYSQL SCHEMA
-- TARGET PLATFORM: Hostinger MySQL / phpMyAdmin / MariaDB 10.4+ / MySQL 8.0+
-- CHARSET: utf8mb4 / utf8mb4_unicode_ci
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- ----------------------------------------------------------------------------
-- 1. TABLE: admins
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admins` (
  `id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `password_salt` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'teacher',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. TABLE: workshops
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workshops` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'Technology',
  `trainer` VARCHAR(150) NOT NULL DEFAULT 'Lead Instructor',
  `trainer_role` VARCHAR(150) NOT NULL DEFAULT 'Senior Principal Instructor',
  `date` VARCHAR(50) NOT NULL,
  `time` VARCHAR(100) NOT NULL DEFAULT '10:00 AM - 05:00 PM',
  `duration` VARCHAR(100) NOT NULL DEFAULT '6 Hours',
  `location` VARCHAR(255) NOT NULL DEFAULT 'Campus / Virtual Lab',
  `capacity` INT NOT NULL DEFAULT 60,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('Ongoing', 'Scheduled', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Ongoing',
  `description` TEXT,
  `tags` TEXT, -- JSON array string or comma separated
  `enrolled_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_workshops_status` (`status`),
  INDEX `idx_workshops_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. TABLE: workshop_sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workshop_sessions` (
  `id` VARCHAR(64) NOT NULL,
  `workshop_id` VARCHAR(64) NOT NULL,
  `session_title` VARCHAR(255) NOT NULL,
  `date` VARCHAR(50) NOT NULL,
  `start_time` VARCHAR(50) NOT NULL DEFAULT '10:00 AM',
  `end_time` VARCHAR(50) NOT NULL DEFAULT '05:00 PM',
  `location` VARCHAR(255) NOT NULL DEFAULT 'Campus / Virtual Lab',
  `status` ENUM('Scheduled', 'Live', 'In Progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Scheduled',
  `qr_token` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sessions_workshop_id` (`workshop_id`),
  INDEX `idx_sessions_qr_token` (`qr_token`),
  CONSTRAINT `fk_sessions_workshop` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. TABLE: students
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `students` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `phone` VARCHAR(50) NOT NULL,
  `course` VARCHAR(100) NOT NULL DEFAULT 'ADCA',
  `college` VARCHAR(255) DEFAULT 'Campus',
  `year` VARCHAR(50) DEFAULT 'Final Year',
  `total_attended` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_students_email` (`email`),
  INDEX `idx_students_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. TABLE: workshop_enrollments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workshop_enrollments` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `student_id` VARCHAR(64) NOT NULL,
  `workshop_id` VARCHAR(64) NOT NULL,
  `enrolled_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_workshop` (`student_id`, `workshop_id`),
  CONSTRAINT `fk_enrollments_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_enrollments_workshop` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. TABLE: attendance_records
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance_records` (
  `id` VARCHAR(64) NOT NULL,
  `workshop_id` VARCHAR(64) NOT NULL,
  `workshop_title` VARCHAR(255) NOT NULL,
  `session_id` VARCHAR(64) NOT NULL,
  `session_title` VARCHAR(255) NOT NULL,
  `student_id` VARCHAR(64) DEFAULT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `student_email` VARCHAR(150) NOT NULL,
  `student_phone` VARCHAR(50) NOT NULL,
  `student_course` VARCHAR(100) NOT NULL DEFAULT 'ADCA',
  `date` VARCHAR(50) NOT NULL,
  `time` VARCHAR(50) NOT NULL,
  `server_timestamp` VARCHAR(100) NOT NULL,
  `status` ENUM('PENDING_REVIEW','PENDING_APPROVAL','APPROVED','REJECTED','Present','Absent','Late') NOT NULL DEFAULT 'PENDING_REVIEW',
  `check_in_method` VARCHAR(50) NOT NULL DEFAULT 'QR Scan',
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_att_workshop_id` (`workshop_id`),
  INDEX `idx_att_session_id` (`session_id`),
  INDEX `idx_att_student_email` (`student_email`),
  INDEX `idx_att_status` (`status`),
  INDEX `idx_att_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. TABLE: certificates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `certificates` (
  `certificate_no` VARCHAR(64) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `student_email` VARCHAR(150) NOT NULL,
  `student_phone` VARCHAR(50) DEFAULT NULL,
  `student_course` VARCHAR(100) DEFAULT NULL,
  `workshop_id` VARCHAR(64) NOT NULL,
  `workshop_title` VARCHAR(255) NOT NULL,
  `issue_date` VARCHAR(50) NOT NULL,
  `trainer_name` VARCHAR(150) NOT NULL DEFAULT 'Lead Instructor',
  `grade` VARCHAR(50) NOT NULL DEFAULT 'DISTINCTION',
  `verification_code` VARCHAR(64) NOT NULL,
  `score` VARCHAR(50) DEFAULT '95%',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`certificate_no`),
  UNIQUE KEY `uk_verification_code` (`verification_code`),
  INDEX `idx_cert_email` (`student_email`),
  INDEX `idx_cert_workshop_id` (`workshop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. TABLE: audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(64) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_id` VARCHAR(100) DEFAULT NULL,
  `actor` VARCHAR(150) NOT NULL DEFAULT 'system',
  `details` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- SEED DATA (DEFAULT INITIAL STATE)
-- ----------------------------------------------------------------------------
INSERT INTO `admins` (`id`, `username`, `email`, `password_hash`, `password_salt`, `role`)
VALUES (
  'ADM-001',
  'Deepak@8960@techno',
  'techno3deepak@gmail.com',
  'ec0a016e5fd3f3ba9617ff37e7136167eeb0d99dcb637c5f48398b6f562d440ed2189075aef73b250039913a0658fbd60565afcaff383bdaa9408c7ba0c90b46',
  '375bf1a3bdee076d70c05e8bf195ffaab4f11b7fccab97de5badde2244c0e56d',
  'teacher'
) ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

INSERT INTO `workshops` (`id`, `title`, `category`, `trainer`, `trainer_role`, `date`, `time`, `duration`, `location`, `capacity`, `price`, `status`, `description`, `tags`, `enrolled_count`)
VALUES (
  'WS-7745',
  'xy',
  'Web Dev',
  'kjd',
  'Senior Principal Instructor',
  '2026-11-13',
  '10:00 AM - 05:00 PM',
  '6 Hours',
  'Lab 2, Tech Campus / Virtual',
  60,
  0.00,
  'Ongoing',
  'Hands-on practical workshop by Technosavvys.',
  '["Workshop","Technology"]',
  1
) ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

INSERT INTO `workshop_sessions` (`id`, `workshop_id`, `session_title`, `date`, `start_time`, `end_time`, `location`, `status`, `qr_token`)
VALUES (
  'SESS-WS-7745-1',
  'WS-7745',
  'Session 1: Main Workshop',
  '2026-11-13',
  '10:00 AM',
  '05:00 PM',
  'Lab 2, Tech Campus / Virtual',
  'Scheduled',
  'PERM-WS-7745-SESS-WS-7745-1'
) ON DUPLICATE KEY UPDATE `session_title` = VALUES(`session_title`);

INSERT INTO `students` (`id`, `name`, `email`, `phone`, `course`, `college`, `year`, `total_attended`)
VALUES (
  'STU-1001',
  'Deepak',
  'deepakmaurya.aict@gmail.com',
  '8960627330',
  'ADCA',
  'Campus',
  'Final Year',
  1
) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET FOREIGN_KEY_CHECKS = 1;
