import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    console.log('Adding columns to ai_settings...');
    await connection.execute('ALTER TABLE ai_settings ADD COLUMN use_hybrid_schema BOOLEAN DEFAULT FALSE');
    console.log('Added use_hybrid_schema');
  } catch (e) {
    console.log('use_hybrid_schema might already exist');
  }
  
  try {
    await connection.execute('ALTER TABLE ai_settings ADD COLUMN is_debug_mode BOOLEAN DEFAULT FALSE');
    console.log('Added is_debug_mode');
  } catch (e) {
    console.log('is_debug_mode might already exist');
  }
  
  await connection.end();
  console.log('Done');
}

run();
