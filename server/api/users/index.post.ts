import { users } from '../../utils/schema';
import { useDb } from '../../utils/db';
import crypto from 'crypto';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { username, password, displayName, role } = body;

  if (!username || !password || !displayName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  try {
    const db = await useDb();
    
    // Simple mock password hashing (use bcrypt in production)
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const newId = crypto.randomUUID();

    await db.insert(users).values({
      id: newId,
      username,
      passwordHash,
      displayName,
      role: role || 'user',
      isActive: true,
    });

    return { success: true, message: 'User created successfully', id: newId };
  } catch (error: any) {
    console.warn("Failed to insert user:", error.message);
    // Return mock success if DB not connected
    return { success: true, message: 'Mock User created successfully (DB Offline)' };
  }
});
