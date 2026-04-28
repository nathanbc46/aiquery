import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

let connection: mysql.Connection | null = null;

export const useDb = async () => {
  if (!connection) {
    // In production, use process.env.DATABASE_URL
    // For demo/development without a real DB yet, this will error if no DB is running.
    // Ensure you have a valid MySQL connection string in your .env file
    const dbUrl = process.env.DATABASE_URL || 'mysql://user:password@localhost:3306/vtiger';
    
    try {
      connection = await mysql.createConnection(dbUrl);
    } catch (e) {
      console.warn("⚠️ Failed to connect to MySQL database. Please check your DATABASE_URL in .env");
    }
  }
  
  // Return drizzle instance, even if connection failed (it will throw on query, which is expected)
  // We cast it so the types work nicely.
  return drizzle(connection as mysql.Connection, { schema, mode: 'default' });
};
