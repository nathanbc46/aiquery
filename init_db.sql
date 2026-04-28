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
  `status` enum('PENDING','APPROVED','REJECTED','FAILED') NOT NULL DEFAULT 'PENDING',
  `manager_id` varchar(36) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table for AI System Users (Independent from Vtiger users for security)
CREATE TABLE IF NOT EXISTS `ai_users` (
  `id` varchar(36) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `role` enum('admin','manager','user') NOT NULL DEFAULT 'user',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Initial Demo Users
-- ID: user-001 (Employee), manager-001 (Manager), admin-001 (Admin)
-- Note: password_hash should be properly hashed in production
INSERT INTO `ai_users` (`id`, `username`, `password_hash`, `display_name`, `role`) VALUES
('user-001', 'user1', 'hashed_password_here', 'สมชาย พนักงานขาย', 'user'),
('manager-001', 'manager1', 'hashed_password_here', 'วิภาดา หัวหน้างาน', 'manager'),
('admin-001', 'admin', 'hashed_password_here', 'ผู้ดูแลระบบ', 'admin')
ON DUPLICATE KEY UPDATE username=username;
