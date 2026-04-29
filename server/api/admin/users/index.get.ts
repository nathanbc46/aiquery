import { users } from '../../../utils/schema';
import { desc } from 'drizzle-orm';
import { getAuthSession, requireAuthRole } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // 1. ตรวจสอบสิทธิ์ (Admin เท่านั้น)
    await requireAuthRole(event, ['admin']);

    const db = await useDb();
  
    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)]
    });

    return {
      status: 'success',
      users: allUsers
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal Server Error',
    });
  }
});
