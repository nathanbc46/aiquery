import type { H3Event } from 'h3';

export const getSessionPassword = () => {
  const password = process.env.SESSION_PASSWORD;
  if (!password) {
    throw createError({ statusCode: 500, message: 'SESSION_PASSWORD environment variable is not configured' });
  }
  return password;
};

export const getAuthSession = async (event: H3Event) => {
  const session = await useSession(event, {
    password: getSessionPassword(),
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
