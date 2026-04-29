import { useDb } from '../../utils/db';
import { aiMailSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { requireAuthRole } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // 1. ตรวจสอบสิทธิ์ (Admin เท่านั้น)
    await requireAuthRole(event, ['admin']);

    const db = await useDb();
    
    const settings = await db.select().from(aiMailSettings).where(eq(aiMailSettings.id, 'global')).limit(1);
    
    // ถ้ายังไม่มีข้อมูล ให้คืนค่า default
    if (settings.length === 0) {
      return {
        success: true,
        settings: {
          host: '',
          port: 587,
          user: '',
          password: '',
          fromName: 'AI Query System',
          fromEmail: '',
          secure: false,
          requireAuth: true
        }
      };
    }

    return {
      success: true,
      settings: settings[0]
    };

  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal Server Error'
    });
  }
});
