import type { H3Event } from 'h3';

/**
 * ดึงข้อมูล Session ของผู้ใช้ที่ล็อกอินอยู่
 */
export const getAuthSession = async (event: H3Event) => {
  const session = await useSession(event, {
    password: process.env.SESSION_PASSWORD || 'a_very_long_and_secure_password_for_session_encryption',
  });
  
  return session.data;
};

/**
 * ตรวจสอบว่าผู้ใช้มีสิทธิ์ตามที่กำหนดหรือไม่
 */
export const requireAuthRole = async (event: H3Event, roles: string[]) => {
  const session = await getAuthSession(event);
  
  if (!session || !session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }
  
  if (!roles.includes(session.role as string)) {
    throw createError({ statusCode: 403, message: 'Forbidden: You do not have permission' });
  }
  
  return session;
};
