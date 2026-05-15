import { useDb } from './server/utils/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = await useDb();
  await db.execute(sql`ALTER TABLE ai_settings ADD COLUMN optimize_model VARCHAR(100) NOT NULL DEFAULT 'gemini-3.1-pro';`);
  console.log("Migration complete");
  process.exit(0);
}

main().catch(e => {
  console.log(e);
  process.exit(0); // Ignore error if column already exists
});
