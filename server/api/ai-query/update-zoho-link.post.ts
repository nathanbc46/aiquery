import { useDb } from '../../utils/db';
import { aiQueryRequests } from '../../utils/schema';
import { getAuthSession } from '../../utils/auth';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const { requestId, zohoLink, zohoShareLink, zohoSharePassword } = await readBody(event);

  if (!requestId) {
    throw createError({ statusCode: 400, statusMessage: 'requestId is required' });
  }

  const db = await useDb();

  // Only allow updating own requests (admin can update any)
  const condition = session.role === 'admin'
    ? eq(aiQueryRequests.id, requestId)
    : and(eq(aiQueryRequests.id, requestId), eq(aiQueryRequests.userId, session.userId as string));

  const rows = await db.select({ id: aiQueryRequests.id })
    .from(aiQueryRequests)
    .where(condition)
    .limit(1);

  if (!rows.length) {
    throw createError({ statusCode: 404, statusMessage: 'Request not found' });
  }

  await db.update(aiQueryRequests)
    .set({
      zohoLink: zohoLink || null,
      zohoShareLink: zohoShareLink || null,
      zohoSharePassword: zohoSharePassword || null
    })
    .where(eq(aiQueryRequests.id, requestId));

  return { success: true };
});
