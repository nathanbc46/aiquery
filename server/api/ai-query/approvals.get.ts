import { useDb } from '../../utils/db';
import { aiQueryRequests, users } from '../../utils/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthSession, requireAuthRole } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // 1. ตรวจสอบสิทธิ์ (Security Check)
    await requireAuthRole(event, ['manager', 'admin']);

    const db = await useDb();
    
    // 2. ดึงรายการรอนุมัติพร้อมชื่อพนักงาน (Join)
    const results = await db.select({
      id: aiQueryRequests.id,
      userName: users.displayName,
      queryText: aiQueryRequests.queryText,
      generatedSql: aiQueryRequests.generatedSql,
      explanationTh: aiQueryRequests.explanationTh,
      requestReason: aiQueryRequests.requestReason,
      resultCount: aiQueryRequests.resultCount,
      createdAt: aiQueryRequests.createdAt
    })
      .from(aiQueryRequests)
      .leftJoin(users, eq(aiQueryRequests.userId, users.id))
      .where(eq(aiQueryRequests.status, 'PENDING'))
      .orderBy(desc(aiQueryRequests.createdAt));

    return {
      success: true,
      requests: results.map(req => ({
        id: req.id,
        user: req.userName || 'Unknown User',
        prompt: req.queryText,
        sql: req.generatedSql,
        explanation: req.explanationTh,
        reason: req.requestReason,
        count: req.resultCount,
        time: req.createdAt ? new Date(req.createdAt).toLocaleString('th-TH') : ''
      }))
    };

  } catch (error: any) {
    console.error('Fetch Approvals Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch pending requests'
    };
  }
});
