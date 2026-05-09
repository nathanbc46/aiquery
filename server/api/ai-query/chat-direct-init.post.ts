import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants';
import { randomUUID } from 'crypto';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { sql: querySql } = body;

  if (!querySql) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sql' });
  }

  const upperSql = querySql.trim().toUpperCase();
  if (!upperSql.startsWith('SELECT')) {
    throw createError({ statusCode: 403, statusMessage: 'Only SELECT queries are allowed' });
  }

  try {
    const db = await useDb();

    const settingsRows = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const maxResultsLimit = settingsRows[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT;

    const cleanSql = querySql.trim().replace(/;$/, '');
    const limitRegex = /LIMIT\s+\d+$/i;
    const fullSql = limitRegex.test(cleanSql)
      ? cleanSql.replace(limitRegex, `LIMIT ${maxResultsLimit}`)
      : `${cleanSql} LIMIT ${maxResultsLimit}`;

    const results = await db.execute(sql.raw(fullSql));
    const rows: any[] = Array.isArray(results[0]) ? results[0] : (results as any[]);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    // แปลงเป็น CSV แล้วเก็บใน snapshot storage
    const csvHeader = columns.join(',');
    const csvRows = rows.map(row =>
      columns.map(col => {
        const val = row[col] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
      }).join(',')
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');

    const sessionId = randomUUID();
    const storage = useStorage('snapshots');
    await storage.setItem(`chat-direct-${sessionId}.csv`, csvContent);

    return {
      success: true,
      sessionId,
      rowCount: rows.length
    };

  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Chat Direct Init Error:', error);
    throw createError({ statusCode: 500, statusMessage: error.message || 'Init failed' });
  }
});
