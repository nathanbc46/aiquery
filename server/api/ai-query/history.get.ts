import { useDb } from '../../utils/db';
import { aiQueryRequests, users } from '../../utils/schema';
import { getAuthSession, requireAuthRole } from '../../utils/auth';
import { eq, desc, count, like, or, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb();
    const query = getQuery(event);

    // รับ pagination params จาก query string
    const page   = Math.max(1, parseInt(query.page as string) || 1);
    const limit  = Math.min(20, Math.max(1, parseInt(query.limit as string) || 10)); // สูงสุด 20 ต่อหน้า
    const offset = (page - 1) * limit;

    // ดึงข้อมูล User จาก Session
    const session = await getAuthSession(event);
    if (!session.userId) {
      throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

    const { userId, role } = session;

    // 1. จัดการเงื่อนไขการค้นหา (Where Clause)
    // - ถ้าเป็น Admin ให้เห็นทั้งหมด, ถ้าไม่ใช่ให้เห็นเฉพาะของตัวเอง
    // - ถ้ามีการค้นหา ให้ค้นหาใน queryText หรือ id
    const search = (query.search as string || '').trim();
    
    let baseCondition = role === 'admin' ? undefined : eq(aiQueryRequests.userId, userId);
    let whereClause = baseCondition;

    if (search) {
      const searchCondition = or(
        like(aiQueryRequests.queryText, `%${search}%`),
        like(aiQueryRequests.id, `%${search}%`)
      );
      
      whereClause = baseCondition 
        ? and(baseCondition, searchCondition)
        : searchCondition;
    }

    const countResult = await db
      .select({ total: count() })
      .from(aiQueryRequests)
      .where(whereClause);
    const total = countResult[0]?.total ?? 0;

    // 2. ดึงข้อมูลตาม page/limit พร้อมชื่อผู้ขอ
    const results = await db.select({
      request: aiQueryRequests,
      userName: users.displayName
    })
      .from(aiQueryRequests)
      .leftJoin(users, eq(aiQueryRequests.userId, users.id))
      .where(whereClause)
      .orderBy(desc(aiQueryRequests.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + results.length < total
      },
      requests: results.map(row => {
        const req = row.request;
        const isExpired = req.expiresAt ? new Date() > new Date(req.expiresAt) : false;
        return {
          id: req.id,
          user: row.userName || 'Unknown User',
          query: req.queryText,
          sql: req.generatedSql,
          explanation: req.explanationTh,
          requestReason: req.requestReason || null,
          managerComment: req.managerComment || null,
          status: req.status,
          reason: req.errorMessage,
          expiresAt: req.expiresAt ? new Date(req.expiresAt).toISOString() : null,
          isExpired,
          time: req.createdAt ? new Date(req.createdAt).toLocaleString('th-TH') : '',
          resultCount: req.resultCount || 0,
          downloadCount: req.downloadCount || 0,
          zohoLink: role === 'admin' ? (req.zohoLink || null) : null,
          zohoShareLink: req.zohoShareLink || null,
          zohoSharePassword: req.zohoSharePassword || null
        };
      })
    };

  } catch (error: any) {
    console.error('Fetch History Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch history'
    };
  }
});

