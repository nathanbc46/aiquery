import { getAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const { sessionId } = await readBody(event);
  if (!sessionId) return { success: true };

  const storage = useStorage('snapshots');
  await storage.removeItem(`chat-direct-${sessionId}.csv`);

  return { success: true };
});
