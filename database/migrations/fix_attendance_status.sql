-- Migration: Fix attendance status ENUM and default value
-- Target: MySQL 8.0+ / MariaDB 10.4+ (Hostinger / phpMyAdmin)

ALTER TABLE `attendance_records`
  MODIFY COLUMN `status` ENUM('PENDING_REVIEW','PENDING_APPROVAL','APPROVED','REJECTED','Present','Absent','Late') NOT NULL DEFAULT 'PENDING_REVIEW';

UPDATE `attendance_records`
  SET `status` = 'PENDING_REVIEW'
  WHERE `status` IS NULL OR TRIM(`status`) = '';
