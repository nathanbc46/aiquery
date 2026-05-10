import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants';
import { randomUUID } from 'crypto';

const buildCsv = (rows: any[]): string => {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const escape = (val: any) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
  };
  const header = columns.join(',');
  const body = rows.map(row => columns.map(col => escape(row[col])).join(','));
  return [header, ...body].join('\n');
};

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { sql: querySql, previewData } = body;

  if (!querySql && !Array.isArray(previewData)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sql or previewData' });
  }

  try {
    let rows: any[];

    if (Array.isArray(previewData) && previewData.length > 0) {
      // ข้อมูลครบอยู่แล้วใน preview — ไม่ต้อง query DB
      rows = previewData;
    } else {
      // ข้อมูลมีมากกว่า preview — query DB เต็ม
      const upperSql = querySql.trim().toUpperCase();
      if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
        throw createError({ statusCode: 403, statusMessage: 'Only SELECT queries are allowed' });
      }

      const db = await useDb();
      const settingsRows = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
      const maxResultsLimit = settingsRows[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT;

      const cleanSql = querySql.trim().replace(/;$/, '');
      const limitRegex = /LIMIT\s+\d+$/i;
      const fullSql = limitRegex.test(cleanSql)
        ? cleanSql.replace(limitRegex, `LIMIT ${maxResultsLimit}`)
        : `${cleanSql} LIMIT ${maxResultsLimit}`;

      const results = await db.execute(sql.raw(fullSql));
      rows = Array.isArray(results[0]) ? results[0] : (results as any[]);
    }

    const csvContent = buildCsv(rows);
    const sessionId = randomUUID();
    const storage = useStorage('snapshots');
    await storage.setItem(`chat-direct-${sessionId}.csv`, csvContent);

    return { success: true, sessionId, rowCount: rows.length };

  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Chat Direct Init Error:', error);
    throw createError({ statusCode: 500, statusMessage: error.message || 'Init failed' });
  }
});
