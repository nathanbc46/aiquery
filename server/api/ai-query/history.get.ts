import { useDb } from '../../utils/db';
import { aiQueryRequests, users } from '../../utils/schema';
import { getAuthSession } from '../../utils/auth';
import { eq, desc, count, like, or, and, inArray } from 'drizzle-orm';

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
    
    // non-admin เห็น record ที่ตัวเองเป็น owner (user_id) หรือเป็นผู้สร้าง (created_by)
    let baseCondition = role === 'admin'
      ? undefined
      : or(eq(aiQueryRequests.userId, userId), eq(aiQueryRequests.createdBy, userId));
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

    // 2. ดึงข้อมูลตาม page/limit
    const rows = await db.select()
      .from(aiQueryRequests)
      .where(whereClause)
      .orderBy(desc(aiQueryRequests.createdAt))
      .limit(limit)
      .offset(offset);

    // 3. รวบรวม user ids ทั้งหมด แล้ว lookup ครั้งเดียว
    const allUserIds = [...new Set(
      rows.flatMap(r => [r.userId, r.createdBy]).filter(Boolean) as string[]
    )];

    const userList = allUserIds.length
      ? await db.select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, allUserIds))
      : [];

    const userMap = Object.fromEntries(userList.map(u => [u.id, u.displayName]));

    return {
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + rows.length < total
      },
      requests: rows.map(req => {
        const isExpired = req.expiresAt ? new Date() > new Date(req.expiresAt) : false;
        const ownerName = userMap[req.userId] || 'Unknown User';
        const creatorName = userMap[req.createdBy] || 'Unknown User';
        return {
          id: req.id,
          user: creatorName,
          ownerName,
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

