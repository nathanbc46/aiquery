import { eq, and } from 'drizzle-orm';
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
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing favorite ID',
    });
  }

  try {
    await db
      .delete(aiFavorites)
      .where(and(eq(aiFavorites.id, id), eq(aiFavorites.userId, session.userId)));

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error deleting favorite:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to delete favorite',
    });
  }
});
