-- AI Query & Approval System - Database Initialization
-- Target: Vtiger CRM 8.4 Database (MySQL)
-- 1. Table for AI Query Requests and Approval Workflow
CREATE TABLE IF NOT EXISTS `ai_query_requests` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `query_text` text NOT NULL,
  `generated_sql` text NOT NULL,
  `explanation_th` text NOT NULL,
  `result_count` int(11) DEFAULT 0,
  `download_count` int(11) DEFAULT 0,
  `request_reason` text DEFAULT NULL,
  `status` enum('PENDING', 'APPROVED', 'REJECTED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `manager_id` varchar(36) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `manager_comment` text DEFAULT NULL,
  `zoho_link` text DEFAULT NULL,
  `zoho_share_link` text DEFAULT NULL,
  `zoho_share_password` varchar(255) DEFAULT NULL,
  -- Comment จาก Manager ตอนอนุมัติ (optional)
  `expires_at` timestamp NULL DEFAULT NULL,
  -- วันหมดอายุของลิงก์ดาวน์โหลด (NULL = ไม่มีวันหมดอายุ)
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 2. Table for AI System Users (Linked to Vtiger users)
CREATE TABLE IF NOT EXISTS `ai_users` (
  `id` varchar(36) NOT NULL,
  `vtiger_id` int(11) DEFAULT NULL,
  -- ID จาก vtiger_users เพื่อเชื่อมความสัมพันธ์
  `username` varchar(255) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `role` enum('admin', 'manager', 'user') NOT NULL DEFAULT 'user',
  `email` varchar(255) DEFAULT NULL,
  -- อีเมลสำหรับรับแจ้งเตือน
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `vtiger_id` (`vtiger_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 3. Initial Demo Users Setup
-- หมายเหตุ: รหัสผ่านจะใช้ของ Vtiger CRM โดยตรง ระบบนี้ไม่เก็บรหัสผ่าน
-- ให้เปลี่ยน vtiger_id ให้ตรงกับ ID ในฐานข้อมูล vtiger_users จริงๆ ของคุณ
INSERT INTO `ai_users` (
    `id`,
    `vtiger_id`,
    `username`,
    `display_name`,
    `role`
  )
VALUES (
    'admin-root',
    1,
    'admin',
    'ผู้ดูแลระบบ (Admin)',
    'admin'
  ) ON DUPLICATE KEY
UPDATE role = 'admin';
-- 4. Table for AI Global Settings
CREATE TABLE IF NOT EXISTS `ai_settings` (
  `id` varchar(50) NOT NULL DEFAULT 'global',
  `refine_model` varchar(100) NOT NULL DEFAULT 'gemini-1.5-flash-8b',
  `refine_system_prompt` text NOT NULL,
  `generate_model` varchar(100) NOT NULL DEFAULT 'gemini-3.1-flash-lite-preview',
  `generate_system_instruction` text NOT NULL,
  `analyze_model` varchar(100) NOT NULL DEFAULT 'gemini-2.0-flash',
  `analyze_system_instruction` text NOT NULL,
  `chat_model` varchar(100) NOT NULL DEFAULT 'gemini-2.0-flash',
  `chat_system_instruction` text NOT NULL,
  `max_results_limit` int(11) DEFAULT 5000,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 5. Table for Mail Server Settings (SMTP)
CREATE TABLE IF NOT EXISTS `ai_mail_settings` (
  `id` varchar(50) NOT NULL DEFAULT 'global',
  `host` varchar(255) NOT NULL,
  `port` int(11) NOT NULL DEFAULT 587,
  `user` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `from_name` varchar(255) DEFAULT NULL,
  `from_email` varchar(255) DEFAULT NULL,
  `secure` tinyint(1) DEFAULT 0,
  `require_auth` tinyint(1) DEFAULT 1,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 6. Table for AI Favorites (User Saved Queries)
CREATE TABLE IF NOT EXISTS `ai_favorites` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `query_text` text NOT NULL,
  `generated_sql` text NOT NULL,
  `explanation_th` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 7. Migration: Ensure all columns exist for existing databases
-- เพิ่มคอลัมน์ใหม่ๆ ในกรณีที่ตารางมีอยู่แล้ว
SET @dbname = DATABASE();
-- Check ai_query_requests for expires_at
SET @tablename = 'ai_query_requests';
SET @columnname = 'expires_at';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' timestamp NULL DEFAULT NULL AFTER error_message'
        )
      )
  );
PREPARE stmt
FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Check ai_query_requests for manager_comment
SET @columnname = 'manager_comment';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' text DEFAULT NULL AFTER expires_at'
        )
      )
  );
PREPARE stmt
FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Check ai_users for email
SET @tablename = 'ai_users';
SET @columnname = 'email';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' varchar(255) DEFAULT NULL AFTER role'
        )
      )
  );
PREPARE stmt
FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Check ai_query_requests for download_count
SET @tablename = 'ai_query_requests';
SET @columnname = 'download_count';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' int(11) DEFAULT 0 AFTER result_count'
        )
      )
  );
PREPARE stmt
FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Check ai_query_requests for zoho_link
SET @tablename = 'ai_query_requests';
SET @columnname = 'zoho_link';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' text DEFAULT NULL AFTER manager_comment'
        )
      )
  );
PREPARE stmt
FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Check ai_query_requests for zoho_share_link
SET @tablename = 'ai_query_requests';
SET @columnname = 'zoho_share_link';
SET @preparedStatement = (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
        'SELECT 1',
        CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' text DEFAULT NULL AFTER zoho_link')
      )
  );
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Check ai_query_requests for zoho_share_password
SET @columnname = 'zoho_share_password';
SET @preparedStatement = (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
        'SELECT 1',
        CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' varchar(255) DEFAULT NULL AFTER zoho_share_link')
      )
  );
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Check ai_settings for max_results_limit
SET @tablename = 'ai_settings';
SET @columnname = 'max_results_limit';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' int(11) DEFAULT 5000 AFTER chat_system_instruction'
        )
      )
  );
PREPARE stmt
FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;