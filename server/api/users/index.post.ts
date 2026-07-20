import { users } from '../../utils/schema';
import { useDb } from '../../utils/db';
import { requireAuthRole } from '../../utils/auth';
import crypto from 'crypto';

export default defineEventHandler(async (event) => {
  await requireAuthRole(event, ['admin']);

  const body = await readBody(event);
  const { username, displayName, role, vtigerId } = body;

  if (!username || !displayName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  const db = await useDb();
  const newId = crypto.randomUUID();

  await db.insert(users).values({
    id: newId,
    vtigerId: vtigerId ?? 0,
    username,
    displayName,
    role: role || 'user',
    isActive: true,
  });

  return { success: true, message: 'User created successfully', id: newId };
});
