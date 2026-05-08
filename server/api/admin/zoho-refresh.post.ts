import { useDb } from '../../utils/db';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId || session.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden' });
  }

  try {
    const db = await useDb();
    const [rows]: any = await db.execute(sql`SELECT * FROM ai_zoho_config WHERE id = 'global' LIMIT 1`);
    const config = rows[0];

    if (!config?.refresh_token) {
      return { success: false, message: 'ไม่มี refresh token กรุณา Connect Zoho ใหม่' };
    }

    const tokenResponse: any = await $fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      params: {
        refresh_token: config.refresh_token,
        client_id: config.client_id,
        client_secret: config.client_secret,
        grant_type: 'refresh_token'
      }
    }).catch((e: any) => ({ error: e.message }));

    if (tokenResponse.error || !tokenResponse.access_token) {
      return { success: false, message: `Refresh failed: ${tokenResponse.error || 'no access_token returned'}` };
    }

    const newAccessToken = tokenResponse.access_token as string;
    const newExpiresAt = new Date(Date.now() + (tokenResponse.expires_in ?? 3600) * 1000);
    const newExpiresAtStr = newExpiresAt.toISOString().slice(0, 19).replace('T', ' ');

    // ใช้ parameterized query เพื่อป้องกัน special chars ใน token พัง SQL
    await db.execute(sql`
      UPDATE ai_zoho_config
      SET access_token = ${newAccessToken},
          expires_at   = ${newExpiresAtStr}
      WHERE id = 'global'
    `);

    const [verifyRows]: any = await db.execute(sql`SELECT expires_at FROM ai_zoho_config WHERE id = 'global' LIMIT 1`);

    return {
      success: true,
      message: 'รีเฟรช token สำเร็จ',
      debug: {
        newExpiresAt: newExpiresAtStr,
        verifiedExpiresAt: verifyRows[0]?.expires_at,
        tokenLength: newAccessToken.length
      }
    };

  } catch (error: any) {
    console.error('[zoho-refresh] Error:', error);
    throw createError({ statusCode: 500, message: error.message || 'Refresh token failed' });
  }
});
