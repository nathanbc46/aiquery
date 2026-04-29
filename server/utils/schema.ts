import { mysqlTable, varchar, text, int, timestamp, mysqlEnum, boolean } from 'drizzle-orm/mysql-core';

// Vtiger CRM Users Table (Reference)
export const vtigerUsers = mysqlTable('vtiger_users', {
  id: int('id').primaryKey(),
  userName: varchar('user_name', { length: 255 }).notNull(),
  userPassword: varchar('user_password', { length: 255 }).notNull(),
  status: varchar('status', { length: 25 }).notNull(),
  firstName: varchar('first_name', { length: 30 }),
  lastName: varchar('last_name', { length: 30 }),
  email1: varchar('email1', { length: 255 }),
});

// Users Table for AI System Roles
export const users = mysqlTable('ai_users', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID
  vtigerId: int('vtiger_id').notNull().unique(), // Link to vtiger_users.id
  username: varchar('username', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['admin', 'manager', 'user']).notNull().default('user'),
  email: varchar('email', { length: 255 }), // อีเมลสำหรับรับแจ้งเตือน
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// AI Query Requests Table for Workflow
export const aiQueryRequests = mysqlTable('ai_query_requests', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  queryText: text('query_text').notNull(),
  generatedSql: text('generated_sql').notNull(),
  explanationTh: text('explanation_th').notNull(),
  resultCount: int('result_count').default(0),
  downloadCount: int('download_count').default(0),
  requestReason: text('request_reason'),
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED', 'FAILED']).notNull().default('PENDING'),
  managerId: varchar('manager_id', { length: 36 }).references(() => users.id),
  errorMessage: text('error_message'),
  managerComment: text('manager_comment'),  // Comment เพิ่มเติมจาก Manager ตอนอนุมัติ (optional)
  expiresAt: timestamp('expires_at'),   // วันหมดอายุของลิงก์ดาวน์โหลด (null = ไม่มีวันหมดอายุ)
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// AI Global Settings Table
export const aiSettings = mysqlTable('ai_settings', {
  id: varchar('id', { length: 50 }).primaryKey().default('global'),
  refineModel: varchar('refine_model', { length: 100 }).notNull().default('gemini-1.5-flash-8b'),
  refineSystemPrompt: text('refine_system_prompt').notNull(),
  generateModel: varchar('generate_model', { length: 100 }).notNull().default('gemini-3.1-flash-lite-preview'),
  generateSystemInstruction: text('generate_system_instruction').notNull(),
  analyzeModel: varchar('analyze_model', { length: 100 }).notNull().default('gemini-2.0-flash'),
  analyzeSystemInstruction: text('analyze_system_instruction').notNull(),
  chatModel: varchar('chat_model', { length: 100 }).notNull().default('gemini-2.0-flash'),
  chatSystemInstruction: text('chat_system_instruction').notNull(),
  maxResultsLimit: int('max_results_limit').default(5000),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Mail Server Settings Table (SMTP)
export const aiMailSettings = mysqlTable('ai_mail_settings', {
  id: varchar('id', { length: 50 }).primaryKey().default('global'),
  host: varchar('host', { length: 255 }).notNull(),
  port: int('port').notNull().default(587),
  user: varchar('user', { length: 255 }),
  password: varchar('password', { length: 255 }),
  fromName: varchar('from_name', { length: 255 }),
  fromEmail: varchar('from_email', { length: 255 }),
  secure: boolean('secure').default(false), // true สำหรับพอร์ต 465
  requireAuth: boolean('require_auth').default(true),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
