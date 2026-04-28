import { mysqlTable, varchar, text, int, timestamp, mysqlEnum, boolean } from 'drizzle-orm/mysql-core';

// Users Table for Authentication and Roles
export const users = mysqlTable('ai_users', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['admin', 'manager', 'user']).notNull().default('user'),
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
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED', 'FAILED']).notNull().default('PENDING'),
  managerId: varchar('manager_id', { length: 36 }).references(() => users.id),
  errorMessage: text('error_message'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
