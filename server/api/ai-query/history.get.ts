import { useDb } from '../../utils/db';
import { aiQueryRequests } from '../../utils/schema';
import { eq, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb();
    
    // Fetch all requests for the current user
    const results = await db.select()
      .from(aiQueryRequests)
      .where(eq(aiQueryRequests.userId, 'user-001')) // TODO: Replace with auth
      .orderBy(desc(aiQueryRequests.createdAt));

    return {
      success: true,
      requests: results.map(req => ({
        id: req.id,
        query: req.queryText,
        explanation: req.explanationTh,
        status: req.status,
        reason: req.errorMessage,
        time: req.createdAt ? new Date(req.createdAt).toLocaleString('th-TH') : ''
      }))
    };

  } catch (error: any) {
    console.error('Fetch History Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch history'
    };
  }
});
