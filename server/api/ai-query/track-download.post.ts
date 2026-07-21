import { useDb } from '../../utils/db';
import { aiQueryRequests } from '../../utils/schema';
import { eq, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { id } = body as { id?: string };

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Request ID is required' });
  }

  const db = await useDb();

  const result = await db.update(aiQueryRequests)
    .set({ downloadCount: sql`download_count + 1` })
    .where(eq(aiQueryRequests.id, id));

  return { ok: true };
});
