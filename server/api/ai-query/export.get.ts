import { useDb } from '../../utils/db';
import { aiQueryRequests, aiSettings, vtigerUsers } from '../../utils/schema';
import { eq, and, sql } from 'drizzle-orm';
import { Parser } from '@json2csv/plainjs';
import { DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const requestId = query.id as string;
  const customFilename = query.filename as string | undefined;
  const ownerVtigerId = query.ownerVtigerId ? Number(query.ownerVtigerId) : null;

  if (!requestId) {
    throw createError({ statusCode: 400, statusMessage: 'Request ID is required' });
  }

  try {
    const db = await useDb();

    // 1. Verify the request exists and is APPROVED
    const requests = await db.select()
      .from(aiQueryRequests)
      .where(and(
        eq(aiQueryRequests.id, requestId),
        eq(aiQueryRequests.status, 'APPROVED')
      ))
      .limit(1);

    const request = requests[0];
    if (!request) {
      throw createError({ statusCode: 404, statusMessage: 'Request not found' });
    }

    // ตรวจสอบวันหมดอายุของลิงก์ดาวน์โหลด
    if (request.expiresAt && new Date() > new Date(request.expiresAt)) {
      throw createError({ statusCode: 410, statusMessage: 'ลิงก์ดาวน์โหลดนี้หมดอายุแล้ว (Link Expired)' });
    }

    // 2. ดึงข้อมูลจาก Snapshot Storage
    const storage = useStorage('snapshots');
    const csv = await storage.getItem(`${requestId}.csv`);

    if (!csv) {
      throw createError({
        statusCode: 404,
        statusMessage: 'ไม่พบไฟล์ Snapshot (ไฟล์อาจถูกลบหรือยังไม่ได้สร้างตอนอนุมัติ)'
      });
    }

    // 3. Increment download count
    await db.update(aiQueryRequests)
      .set({ downloadCount: sql`download_count + 1` })
      .where(eq(aiQueryRequests.id, requestId));

    // 4. Resolve owner name if provided
    let ownerMeta = '';
    if (ownerVtigerId) {
      const ownerRows = await db
        .select({ firstName: vtigerUsers.firstName, lastName: vtigerUsers.lastName, email1: vtigerUsers.email1 })
        .from(vtigerUsers)
        .where(eq(vtigerUsers.id, ownerVtigerId))
        .limit(1);
      if (ownerRows[0]) {
        const o = ownerRows[0];
        const name = [o.firstName, o.lastName].filter(Boolean).join(' ') || 'N/A';
        ownerMeta = `# Owner: ${name}${o.email1 ? ` (${o.email1})` : ''}\n`;
      }
    }

    // 5. Return as CSV file with UTF-8 BOM for Excel compatibility
    const sanitized = customFilename
      ? customFilename.replace(/[^a-zA-Z0-9฀-๿\s_-]/g, '').trim().replace(/\s+/g, '_') || 'AI_Export'
      : `vtiger_export_${(requestId.split('-')[0] || 'FILE').toUpperCase()}`;
    const fileName = `${sanitized}.csv`;

    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
    setHeader(event, 'Content-Disposition', `attachment; filename="${fileName}"`);

    return '﻿' + ownerMeta + csv;

  } catch (error: any) {
    console.error('Export Error:', error);
    throw createError({ statusCode: 500, statusMessage: `Export failed: ${error.message}` });
  }
});
