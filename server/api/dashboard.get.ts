import { useDb } from '../utils/db';
import { aiQueryRequests, users } from '../utils/schema';
import { getAuthSession } from '../utils/auth';
import { desc, eq, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const session = await getAuthSession(event);
    if (!session.userId) {
      throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

    const db = await useDb();
    const isAdminOrManager = session.role === 'admin' || session.role === 'manager';

    // 1. Overview Stats (Total, Pending, Approved, Rejected, Exported Rows)
    const baseQuery = db.select({
      status: aiQueryRequests.status,
      count: sql<number>`count(*)`,
      totalRows: sql<number>`sum(${aiQueryRequests.resultCount})`
    }).from(aiQueryRequests);

    // Filter by user if not admin/manager
    if (!isAdminOrManager) {
      baseQuery.where(eq(aiQueryRequests.userId, session.userId as string));
    }
    
    const statsQuery = baseQuery.groupBy(aiQueryRequests.status);
    const rawStats = await statsQuery;

    let total = 0, pending = 0, approved = 0, rejected = 0, exportedRows = 0;
    
    rawStats.forEach(stat => {
      const c = Number(stat.count);
      total += c;
      if (stat.status === 'PENDING') pending += c;
      if (stat.status === 'APPROVED') {
        approved += c;
        exportedRows += Number(stat.totalRows || 0);
      }
      if (stat.status === 'REJECTED') rejected += c;
    });

    const approvalRate = (approved + rejected) > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0;

    // 2. Recent Activity (Latest 10 requests)
    const recentQuery = db.select({
      id: aiQueryRequests.id,
      queryText: aiQueryRequests.queryText,
      generatedSql: aiQueryRequests.generatedSql,
      explanationTh: aiQueryRequests.explanationTh,
      status: aiQueryRequests.status,
      resultCount: aiQueryRequests.resultCount,
      downloadCount: aiQueryRequests.downloadCount,
      zohoLink: aiQueryRequests.zohoLink,
      expiresAt: aiQueryRequests.expiresAt,
      createdAt: aiQueryRequests.createdAt,
      user: users.displayName
    })
    .from(aiQueryRequests)
    .leftJoin(users, eq(aiQueryRequests.userId, users.id))
    .orderBy(desc(aiQueryRequests.createdAt))
    .limit(10);

    if (!isAdminOrManager) {
      recentQuery.where(eq(aiQueryRequests.userId, session.userId as string));
    }
    
    const recentActivity = await recentQuery;

    // 3. Top Requesters (Only for Admin/Manager)
    let topRequesters: any[] = [];
    if (isAdminOrManager) {
      topRequesters = await db.select({
        user: users.displayName,
        count: sql<number>`count(*)`,
        approvedRows: sql<number>`sum(CASE WHEN ${aiQueryRequests.status} = 'APPROVED' THEN ${aiQueryRequests.resultCount} ELSE 0 END)`
      })
      .from(aiQueryRequests)
      .leftJoin(users, eq(aiQueryRequests.userId, users.id))
      .groupBy(aiQueryRequests.userId)
      .orderBy(desc(sql`count(*)`))
      .limit(5);
    }

    return {
      success: true,
      data: {
        overview: {
          total,
          pending,
          approved,
          rejected,
          exportedRows,
          approvalRate
        },
        recentActivity,
        topRequesters
      }
    };

  } catch (error: any) {
    console.error('Dashboard Fetch Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch dashboard data'
    };
  }
});
