import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.execute('SELECT generate_system_instruction FROM ai_settings WHERE id = "global"');
    let instruction = rows[0].generate_system_instruction;
    
    const oldRule = '2. DELETED RECORDS — MAIN MODULE: Every Vtiger module has a corresponding row in vtiger_crmentity. When querying any primary module, you MUST JOIN vtiger_crmentity ON <module>.<id> = vtiger_crmentity.crmid and ALWAYS add "vtiger_crmentity.deleted = 0" in the WHERE clause.';
    const newRule = oldRule + '\n\n3. RESERVED WORDS ALIASING: NEVER use reserved words like "lead", "order", "group", "rank", or "window" as table aliases. Use short abbreviations instead (e.g., ld, so, pot, acc, ce).';
    
    if (instruction.includes(oldRule) && !instruction.includes('RESERVED WORDS ALIASING')) {
      const updated = instruction.replace(oldRule, newRule);
      await connection.execute('UPDATE ai_settings SET generate_system_instruction = ? WHERE id = "global"', [updated]);
      console.log('Database system instruction updated successfully.');
    } else {
      console.log('Rule already exists or old rule not found.');
    }
  } catch (e) {
    console.error('Error updating database:', e);
  } finally {
    await connection.end();
  }
}

run();
