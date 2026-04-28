import { useDb } from '../../utils/db';
import { aiQueryRequests } from '../../utils/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { requestId, status, reason } = body;

  if (!requestId || !status) {
    throw createError({ statusCode: 400, statusMessage: 'Missing requestId or status' });
  }

  try {
    const db = await useDb();
    
    await db.update(aiQueryRequests)
      .set({
        status: status, // 'APPROVED' or 'REJECTED'
        errorMessage: reason || null,
        reviewedAt: new Date(),
        managerId: 'manager-001' // TODO: Get from auth
      })
      .where(eq(aiQueryRequests.id, requestId));

    return { 
      success: true 
    };

  } catch (error: any) {
    console.error('Update Request Status Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update request status'
    };
  }
});
