-- Migration: Add 'Live' to workshop_sessions status ENUM
-- Target: MySQL 8.0+ / MariaDB 10.4+ (Hostinger / phpMyAdmin)

ALTER TABLE `workshop_sessions`
  MODIFY COLUMN `status` ENUM('Scheduled', 'Live', 'In Progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Scheduled';
