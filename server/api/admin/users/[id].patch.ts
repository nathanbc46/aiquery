import { users } from '../../../utils/schema';
import { eq } from 'drizzle-orm';
import { getAuthSession, requireAuthRole } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'id');
  const body = await readBody(event);
  
  try {
    // 1. ตรวจสอบสิทธิ์ (Admin เท่านั้น)
    await requireAuthRole(event, ['admin']);

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'User ID is required',
      });
    }

    const db = await useDb();

    // 2. ตรวจสอบว่าห้ามแก้บัญชี Admin หลัก
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (targetUser?.username === 'admin') {
      // ถ้าเป็นบัญชี admin ห้ามเปลี่ยน Role และห้าม Inactive
      if (body.role && body.role !== 'admin') {
        throw createError({ statusCode: 400, message: 'ไม่สามารถเปลี่ยนสิทธิ์ของบัญชี Admin หลักได้' });
      }
      if (typeof body.isActive === 'boolean' && body.isActive === false) {
        throw createError({ statusCode: 400, message: 'ไม่สามารถระงับการใช้งานบัญชี Admin หลักได้' });
      }
    }
    
    const updateData: any = {};
    if (body.role) updateData.role = body.role;
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;
    if (body.email !== undefined) updateData.email = body.email;

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    return {
      status: 'success',
      message: 'User updated successfully'
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal Server Error',
    });
  }
});
