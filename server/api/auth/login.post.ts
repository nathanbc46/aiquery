import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { users, vtigerUsers } from '../../utils/schema';
import { getSessionPassword } from '../../utils/auth';
import { checkLoginRateLimit, clearLoginRateLimit } from '../../utils/rateLimit';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { username, password, rememberMe } = body;

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน',
    });
  }

  checkLoginRateLimit(event);

  const db = await useDb();

  try {
    // 1. ค้นหาผู้ใช้ในตาราง Vtiger CRM
    const vUser = await db.query.vtigerUsers.findFirst({
      where: and(
        eq(vtigerUsers.userName, username),
        eq(vtigerUsers.status, 'Active')
      )
    });

    if (!vUser) {
      throw createError({
        statusCode: 401,
        message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    // 2. ตรวจสอบรหัสผ่าน
    const storedHash = vUser.userPassword;
    let isPasswordCorrect = false;

    if (storedHash.startsWith('$2y$') || storedHash.startsWith('$2a$')) {
      // --- แบบใหม่: Bcrypt ---
      const bcryptHash = storedHash.replace(/^\$2y\$/, '$2a$');
      isPasswordCorrect = await bcrypt.compare(password, bcryptHash);
    } else if (storedHash.startsWith('$1$')) {
      // --- แบบเก่า: MD5-Crypt (Vtiger 5.4) ---
      const md5CryptModule = await import('apache-md5');
      const md5Crypt = ((md5CryptModule as any).default ?? md5CryptModule) as (password: string, salt: string) => string;
      const hashedAttempt = md5Crypt(password, storedHash);
      isPasswordCorrect = (hashedAttempt === storedHash);
    } else {
      // --- แบบเก่า: MD5 ธรรมดา ---
      const crypto = await import('crypto');
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');
      isPasswordCorrect = (md5Hash.toLowerCase() === storedHash.toLowerCase());
    }

    if (!isPasswordCorrect) {
      throw createError({
        statusCode: 401,
        message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    // 3. ตรวจสอบ/สร้างข้อมูลผู้ใช้ในระบบ AI (ai_users)
    let aiUser = await db.query.users.findFirst({
      where: eq(users.vtigerId, vUser.id)
    });

    if (!aiUser) {
      // ถ้ายังไม่มีในระบบเรา ให้ลงทะเบียนพนักงานคนนี้อัตโนมัติเป็นสิทธิ์ 'user'
      const newId = uuidv4();
      await db.insert(users).values({
        id: newId,
        vtigerId: vUser.id,
        username: vUser.userName,
        displayName: `${vUser.firstName || ''} ${vUser.lastName || ''}`.trim() || vUser.userName,
        email: vUser.email1 || null, // ดึงเมลจาก CRM ครั้งแรก
        role: 'user',
        isActive: true,
      });
      
      aiUser = await db.query.users.findFirst({
        where: eq(users.id, newId)
      });
    } else {
      // ถ้ามีอยู่แล้ว แต่อีเมลใน CRM เปลี่ยนไป หรือยังไม่มีเมล ให้ Update ให้ตรงกัน
      if (vUser.email1 && aiUser.email !== vUser.email1) {
        await db.update(users)
          .set({ email: vUser.email1 })
          .where(eq(users.id, aiUser.id));
        
        // อัปเดตตัวแปร aiUser ให้มีข้อมูลล่าสุด
        aiUser.email = vUser.email1;
      }
    }

    if (!aiUser?.isActive) {
      throw createError({
        statusCode: 403,
        message: 'บัญชีของคุณถูกระงับการเข้าใช้งานระบบ AI',
      });
    }

    // 4. บันทึก Session (ใช้ระบบ Session ของ Nitro/Nuxt)
    const session = await useSession(event, {
      password: getSessionPassword(),
      cookie: {
        maxAge: rememberMe ? 60 * 60 * 24 * 30 : undefined, // 30 วัน ถ้าติ๊ก Remember Me
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      }
    });

    await session.update({
      userId: aiUser.id,
      vtigerId: aiUser.vtigerId,
      username: aiUser.username,
      displayName: aiUser.displayName,
      role: aiUser.role,
      email: aiUser.email,
    });

    clearLoginRateLimit(event);

    return {
      status: 'success',
      user: {
        username: aiUser.username,
        displayName: aiUser.displayName,
        role: aiUser.role,
      }
    };

  } catch (error: any) {
    console.error('Login Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์',
    });
  }
});
