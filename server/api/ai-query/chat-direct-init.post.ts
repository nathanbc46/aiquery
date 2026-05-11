import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants';
import { randomUUID } from 'crypto';

/**
 * แปลง rows เป็น JSON Lines (NDJSON) — แต่ละแถวเป็น JSON object 1 บรรทัด
 * ปลอดภัยกว่า CSV เพราะไม่มีปัญหาเรื่อง delimiter (comma, pipe, newline, quote)
 */
const buildNdjson = (rows: any[]): string => {
  if (rows.length === 0) return '';
  // Sanitize ค่าแต่ละ field ให้เป็น string ที่ปลอดภัย
  return rows
    .map(row => {
      const sanitized: Record<string, string> = {};
      for (const [key, val] of Object.entries(row)) {
        sanitized[key] = val === null || val === undefined ? '' : String(val);
      }
      return JSON.stringify(sanitized);
    })
    .join('\n');
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

    // บันทึกเป็น NDJSON แทน CSV เพื่อหลีกเลี่ยงปัญหาการแบ่งคอลัมน์ผิดพลาด
    const ndjsonContent = buildNdjson(rows);
    const sessionId = randomUUID();
    const storage = useStorage('snapshots');
    await storage.setItem(`chat-direct-${sessionId}.ndjson`, ndjsonContent);

    return { success: true, sessionId, rowCount: rows.length };

  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Chat Direct Init Error:', error);
    throw createError({ statusCode: 500, statusMessage: error.message || 'Init failed' });
  }
});
