import { useDb } from '../../utils/db';
import { aiMailSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { requireAuthRole } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // 1. ตรวจสอบสิทธิ์ (Admin เท่านั้น)
    await requireAuthRole(event, ['admin']);

    const body = await readBody(event);
    const { settings } = body;

    if (!settings || !settings.host) {
      throw createError({ statusCode: 400, message: 'Host is required' });
    }

    const db = await useDb();
    
    // 2. บันทึกข้อมูล (แบบ Upsert)
    // ตรวจสอบว่ามีข้อมูลเดิมอยู่หรือไม่
    const existing = await db.select().from(aiMailSettings).where(eq(aiMailSettings.id, 'global')).limit(1);

    if (existing.length > 0) {
      // อัปเดตข้อมูลเดิม
      await db.update(aiMailSettings)
        .set({
          host: settings.host,
          port: settings.port,
          user: settings.user,
          password: settings.password,
          fromName: settings.fromName,
          fromEmail: settings.fromEmail,
          secure: settings.secure,
          requireAuth: settings.requireAuth,
          updatedAt: new Date()
        })
        .where(eq(aiMailSettings.id, 'global'));
    } else {
      // เพิ่มข้อมูลใหม่
      await db.insert(aiMailSettings).values({
        id: 'global',
        host: settings.host,
        port: settings.port,
        user: settings.user,
        password: settings.password,
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        secure: settings.secure,
        requireAuth: settings.requireAuth
      });
    }

    return {
      success: true,
      message: 'บันทึกการตั้งค่าเมลเรียบร้อยแล้ว'
    };

  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal Server Error'
    });
  }
});
