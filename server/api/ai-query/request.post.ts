import { useDb } from '../../utils/db';
import { aiQueryRequests } from '../../utils/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { queryText, generatedSql, explanation, resultCount } = body;

  if (!queryText || !generatedSql) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  try {
    const db = await useDb();
    
    const requestId = crypto.randomUUID();
    
    await db.insert(aiQueryRequests).values({
      id: requestId,
      userId: 'user-001', // TODO: Replace with actual auth user ID
      queryText: queryText,
      generatedSql: generatedSql,
      explanationTh: explanation,
      resultCount: resultCount || 0,
      status: 'PENDING',
    });

    return { 
      success: true, 
      requestId 
    };

  } catch (error: any) {
    console.error('Request Submission Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit request'
    };
  }
});
