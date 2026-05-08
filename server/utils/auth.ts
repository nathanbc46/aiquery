import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { users, vtigerUsers } from './schema';
import { useDb } from './db';

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
 * ค้นหาหรือสร้าง ai_users จาก vtigerId — ใช้ตอนเลือก Owner ใน export modal
 */
export const findOrCreateAiUser = async (vtigerId: number): Promise<string> => {
  const db = await useDb();

  const existing = await db.query.users.findFirst({ where: eq(users.vtigerId, vtigerId) });
  if (existing) return existing.id;

  const vtUser = await db.query.vtigerUsers.findFirst({ where: eq(vtigerUsers.id, vtigerId) });
  if (!vtUser) throw createError({ statusCode: 404, message: `Vtiger user ${vtigerId} not found` });

  const newId = uuidv4();
  await db.insert(users).values({
    id: newId,
    vtigerId: vtUser.id,
    username: vtUser.userName,
    displayName: `${vtUser.firstName || ''} ${vtUser.lastName || ''}`.trim() || vtUser.userName,
    email: vtUser.email1 || null,
    role: 'user',
    isActive: true,
  });

  return newId;
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
