import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/utils/schema.ts',
  out: './server/database/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://user:password@localhost:3306/vtiger',
  },
});
