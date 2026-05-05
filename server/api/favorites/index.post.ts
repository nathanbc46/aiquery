import { v4 as uuidv4 } from 'uuid';
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
  const body = await readBody(event);
  const { title, queryText, generatedSql, explanationTh } = body;

  if (!title || !queryText || !generatedSql) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields',
    });
  }

  try {
    const id = uuidv4();
    await db.insert(aiFavorites).values({
      id,
      userId: session.userId,
      title,
      queryText,
      generatedSql,
      explanationTh,
    });

    return {
      success: true,
      id,
    };
  } catch (error: any) {
    console.error('Error saving favorite:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to save favorite',
    });
  }
});
