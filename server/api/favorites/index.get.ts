import { eq, desc } from 'drizzle-orm';
import { aiFavorites } from '../../utils/schema';
import { useDb } from '../../utils/db';
import { getAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const db = await useDb();

  try {
    const favorites = await db
      .select()
      .from(aiFavorites)
      .where(eq(aiFavorites.userId, session.userId))
      .orderBy(desc(aiFavorites.createdAt));

    return favorites;
  } catch (error: any) {
    console.error('Error fetching favorites:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch favorites',
    });
  }
});
