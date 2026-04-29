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
  const { query } = body

  if (!query) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing SQL query'
    })
  }

  // Security: Basic check for read-only
  const upperSql = query.trim().toUpperCase()
  if (!upperSql.startsWith('SELECT')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only SELECT queries are allowed for preview'
    })
  }

  // Remove trailing semicolon if any (prevent syntax error when appending LIMIT)
  let cleanSql = query.trim().replace(/;$/, '')

  // Force limit to 10 for preview
  let previewSql = cleanSql
  const limitRegex = /LIMIT\s+\d+/gi
  
  if (limitRegex.test(previewSql)) {
    // If LIMIT exists, replace it with LIMIT 10
    previewSql = previewSql.replace(limitRegex, 'LIMIT 10')
  } else {
    // If no LIMIT, append it
    previewSql = `${previewSql} LIMIT 10`
  }

  try {
    const db = await useDb()
    // 1. ดึงขีดจำกัดสูงสุดจาก Settings
    const settingsList = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const maxResultsLimit = settingsList[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT;

    // 2. รัน COUNT(*) เพื่อดูจำนวนรายการทั้งหมด
    const countSql = `SELECT COUNT(*) as total FROM (${cleanSql}) as subq`;
    const [countRes]: any = await db.execute(sql.raw(countSql));
    const totalCount = countRes[0]?.total || 0;

    // 3. รันตัวอย่างข้อมูล 10 แถว
    const results = await db.execute(sql.raw(previewSql))
    const dataRows = Array.isArray(results[0]) ? results[0] : results

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
