import { eq, and } from 'drizzle-orm';
import { aiFavorites } from '../../utils/schema';
import { useDb } from '../../utils/db';
import { getAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing favorite ID' });
  }

  const body = await readBody(event);
  const { title, queryText, generatedSql, explanationTh } = body;

  const db = await useDb();

  try {
    const existing = await db
      .select({ id: aiFavorites.id })
      .from(aiFavorites)
      .where(and(eq(aiFavorites.id, id), eq(aiFavorites.userId, session.userId)))
      .limit(1);

    if (!existing.length) {
      throw createError({ statusCode: 404, statusMessage: 'Favorite not found' });
    }

    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (queryText !== undefined) updateData.queryText = queryText;
    if (generatedSql !== undefined) updateData.generatedSql = generatedSql;
    if (explanationTh !== undefined) updateData.explanationTh = explanationTh;

    await db
      .update(aiFavorites)
      .set(updateData)
      .where(and(eq(aiFavorites.id, id), eq(aiFavorites.userId, session.userId)));

    return { success: true };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error updating favorite:', error);
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to update favorite' });
  }
});
