import { useDb } from '../../utils/db';
import { aiQueryRequests } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { requireAuthRole } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing request ID' });
  }

  await requireAuthRole(event, ['admin']);

  const db = await useDb();

  const [req] = await db.select({ id: aiQueryRequests.id })
    .from(aiQueryRequests)
    .where(eq(aiQueryRequests.id, id))
    .limit(1);

  if (!req) {
    throw createError({ statusCode: 404, statusMessage: 'Request not found' });
  }

  // ลบไฟล์ CSV snapshot (ถ้ามี)
  const storage = useStorage('snapshots');
  await storage.removeItem(`${id}.csv`).catch(() => {});

  await db.delete(aiQueryRequests).where(eq(aiQueryRequests.id, id));

  return { success: true };
});
