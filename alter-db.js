import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root', // Assumed, but maybe I should read from .env
    password: '',
    database: 'vtiger' // Assuming from context
  });
  
  await connection.execute(`ALTER TABLE ai_settings ADD COLUMN optimize_model VARCHAR(100) NOT NULL DEFAULT 'gemini-3.1-pro';`);
  console.log('Altered table successfully');
  await connection.end();
}

run().catch(console.error);
