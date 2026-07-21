import { useDb } from '../../utils/db';
import { sql, eq } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { aiSettings } from '../../utils/schema';
import { Parser } from '@json2csv/plainjs';
import { DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants';
import { guardSensitiveSql } from '../../utils/sqlGuard';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { query, filename } = body;

  if (!query) {
    throw createError({ statusCode: 400, statusMessage: 'Missing SQL query' });
  }

  // Security: read-only only
  const upperSql = query.trim().toUpperCase();
  if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
    throw createError({ statusCode: 403, statusMessage: 'Only SELECT queries are allowed' });
  }
  guardSensitiveSql(query);

  const cleanSql = query.trim().replace(/;$/, '');

  try {
    const db = await useDb();
    const settingsList = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const maxResultsLimit = settingsList[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT;

    await db.execute(sql.raw('SET SESSION MAX_EXECUTION_TIME = 120000'));

    let rows: any[] = [];
    try {
      // Force limit ตาม maxResultsLimit
      let finalSql = cleanSql;
      const limitRegex = /LIMIT\s+\d+(\s*;)?$/i;
      if (!limitRegex.test(finalSql)) {
        finalSql = `${finalSql} LIMIT ${maxResultsLimit}`;
      }

      const results = await db.execute(sql.raw(finalSql));
      rows = Array.isArray(results[0]) ? results[0] : (results as any[]);
    } finally {
      await db.execute(sql.raw('SET SESSION MAX_EXECUTION_TIME = 0'));
    }

    if (!rows.length) {
      throw createError({ statusCode: 404, statusMessage: 'ไม่พบข้อมูลจากคำสั่ง SQL นี้' });
    }

    const parser = new Parser();
    const csvContent = parser.parse(rows);

    const sanitized = (filename || 'AI_Export')
      .replace(/[^a-zA-Z0-9฀-๿\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'AI_Export';

    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
    setHeader(event, 'Content-Disposition', `attachment; filename="${sanitized}.csv"`);

    return '﻿' + csvContent;

  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Export Direct Error:', error);
    throw createError({ statusCode: 500, statusMessage: error.message || 'Export failed' });
  }
});
