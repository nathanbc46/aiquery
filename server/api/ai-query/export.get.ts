import { useDb } from '../../utils/db';
import { aiQueryRequests, aiSettings } from '../../utils/schema';
import { eq, and, sql } from 'drizzle-orm';
import { Parser } from '@json2csv/plainjs';
import { DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const requestId = query.id as string;

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

    // 4. Return as CSV file with UTF-8 BOM for Excel compatibility
    const fileId = requestId.split('-')[0] || 'FILE';
    const fileName = `vtiger_export_${fileId.toUpperCase()}.csv`;
    
    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
    setHeader(event, 'Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Prepend UTF-8 BOM (\uFEFF)
    return '\uFEFF' + csv;

  } catch (error: any) {
    console.error('Export Error:', error);
    throw createError({ statusCode: 500, statusMessage: `Export failed: ${error.message}` });
  }
});
