import { useDb } from './server/utils/db';
import { sql } from 'drizzle-orm';

async function explore() {
  const db = await useDb();
  try {
    const [tables]: any = await db.execute(sql.raw("SHOW TABLES"));
    const tableNames = tables.map((t: any) => Object.values(t)[0] as string);
    
    console.log("Found " + tableNames.length + " tables");
    
    const modules = ['industry', 'sales_stage', 'productcategory', 'rating', 'leadstatus'];
    for (const mod of modules) {
        const matches = tableNames.filter(n => n.includes(mod));
        console.log(`Tables matching ${mod}:`, matches);
        for (const table of matches) {
            try {
                const [rows]: any = await db.execute(sql.raw(`SELECT * FROM ${table} LIMIT 3`));
                console.log(`Content of ${table}:`, rows);
            } catch (err) {}
        }
    }

  } catch (e) {
    console.error("Critical error:", e);
  }
  process.exit();
}

explore();
