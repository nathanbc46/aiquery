import { useDb } from '../../utils/db';
import { vtigerUsers } from '../../utils/schema';
import { getAuthSession } from '../../utils/auth';
import { eq, asc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  try {
    const db = await useDb();
    const users = await db
      .select({
        id: vtigerUsers.id,
        firstName: vtigerUsers.firstName,
        lastName: vtigerUsers.lastName,
        userName: vtigerUsers.userName,
        email1: vtigerUsers.email1,
      })
      .from(vtigerUsers)
      .where(eq(vtigerUsers.status, 'Active'))
      .orderBy(asc(vtigerUsers.firstName));

    return { users };
  } catch (error: any) {
    console.error('vtiger-users fetch error:', error);
    return { users: [] };
  }
});
