import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

let pool: mysql.Pool | null = null;

export const useDb = async () => {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    
    console.log("🔌 Initializing Database Connection Pool...");
    
    try {
      if (dbUrl) {
        pool = mysql.createPool(dbUrl);
      } else {
        // Fallback for development
        pool = mysql.createPool({
          host: 'localhost',
          user: 'root',
          password: '',
          database: 'vtiger',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        });
      }
      console.log("✅ Database Pool initialized.");
    } catch (e: any) {
      console.error("❌ Database Initialization Error!");
      console.error("Reason:", e.message);
      pool = null;
      throw e;
    }
  }
  
  return drizzle(pool, { schema, mode: 'default' });
};

export const getDbStatus = async () => {
  if (!pool) return false;
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (e) {
    return false;
  }
};
