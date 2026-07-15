import { useDb } from '../../utils/db'
import { sql, eq } from 'drizzle-orm'
import { getAuthSession } from '../../utils/auth'
import { aiSettings } from '../../utils/schema'
import { DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants'

export default defineEventHandler(async (event) => {
  // 1. ตรวจสอบสิทธิ์
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event)
  const { query, fetchAll } = body

  if (!query) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing SQL query'
    })
  }

  // Security: Basic check for read-only
  const upperSql = query.trim().toUpperCase()
  if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only SELECT queries are allowed for preview'
    })
  }

  // Remove trailing semicolon if any (prevent syntax error when appending LIMIT)
  let cleanSql = query.trim().replace(/;$/, '')

  const isAdminOrManager = session.role === 'admin' || session.role === 'manager';

  try {
    const db = await useDb()
    // 1. ดึงขีดจำกัดสูงสุดจาก Settings
    const settingsList = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const maxResultsLimit = settingsList[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT;

    // เลือก limit ตาม mode: fetchAll ใช้ maxResultsLimit, ปกติใช้ preview sample
    const previewLimit = fetchAll ? maxResultsLimit : (isAdminOrManager ? 50 : 10);

    let previewSql = cleanSql
    const limitRegex = /LIMIT\s+\d+$/i

    if (limitRegex.test(previewSql)) {
      previewSql = previewSql.replace(limitRegex, `LIMIT ${previewLimit}`)
    } else {
      previewSql = `${previewSql} LIMIT ${previewLimit}`
    }

    // ตั้งเวลา Timeout สำหรับ SQL นี้ (ป้องกันค้าง) - 60 วินาที
    await db.execute(sql.raw('SET SESSION MAX_EXECUTION_TIME = 60000'));

    let totalCount = 0;
    let dataRows = [];

    try {
      // 2. รัน COUNT(*) เพื่อดูจำนวนรายการทั้งหมด
      const countSql = `SELECT COUNT(*) as total FROM (${cleanSql}) as subq`;
      const [countRes]: any = await db.execute(sql.raw(countSql));
      totalCount = countRes[0]?.total || 0;

      // 3. รันตัวอย่างข้อมูล 10 หรือ 50 แถว
      const results = await db.execute(sql.raw(previewSql))
      dataRows = Array.isArray(results[0]) ? results[0] : results
    } finally {
      // รีเซ็ตค่ากลับเป็น Default เพื่อไม่ให้กระทบ Connection อื่นใน Pool
      await db.execute(sql.raw('SET SESSION MAX_EXECUTION_TIME = 0'));
    }

    return {
      success: true,
      data: dataRows,
      count: dataRows.length,
      totalCount: totalCount,
      maxResultsLimit: maxResultsLimit
    }
  } catch (error: any) {
    console.error('Preview SQL Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
