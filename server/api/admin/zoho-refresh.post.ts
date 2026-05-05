import { useDb } from '../../utils/db';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId || session.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden' });
  }

  const db = await useDb();
  const [rows]: any = await db.execute(sql.raw(`SELECT * FROM ai_zoho_config WHERE id = 'global' LIMIT 1`));
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

  if (tokenResponse.error) {
    return { success: false, message: `Refresh failed: ${tokenResponse.error}` };
  }

  const newExpiresAt = new Date(Date.now() + (tokenResponse.expires_in ?? 3600) * 1000);
  const newExpiresAtStr = newExpiresAt.toISOString().slice(0, 19).replace('T', ' ');
  const newAccessToken = tokenResponse.access_token as string;

  console.log('[zoho-refresh] new expires_at:', newExpiresAtStr);
  console.log('[zoho-refresh] access_token length:', newAccessToken?.length);

  const [updateResult]: any = await db.execute(sql.raw(`
    UPDATE ai_zoho_config
    SET access_token = '${newAccessToken}',
        expires_at = '${newExpiresAtStr}'
    WHERE id = 'global'
  `));

  console.log('[zoho-refresh] affectedRows:', updateResult?.affectedRows, 'changedRows:', updateResult?.changedRows);

  // Verify the update
  const [verifyRows]: any = await db.execute(sql.raw(`SELECT expires_at FROM ai_zoho_config WHERE id = 'global' LIMIT 1`));
  const verifiedExpiresAt = verifyRows[0]?.expires_at;

  return {
    success: true,
    message: 'รีเฟรช token สำเร็จ',
    debug: {
      affectedRows: updateResult?.affectedRows,
      changedRows: updateResult?.changedRows,
      newExpiresAt: newExpiresAtStr,
      verifiedExpiresAt,
      tokenLength: newAccessToken?.length
    }
  };
});
