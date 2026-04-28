import { useDb } from '../../utils/db';
import { aiQueryRequests } from '../../utils/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb();
    
    // Fetch only pending requests
    const results = await db.select()
      .from(aiQueryRequests)
      .where(eq(aiQueryRequests.status, 'PENDING'))
      .orderBy(aiQueryRequests.createdAt);

    return {
      success: true,
      requests: results.map(req => ({
        id: req.id,
        user: 'Employee', // TODO: Join with users table for real name
        query: req.queryText,
        sql: req.generatedSql,
        explanation: req.explanationTh,
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
