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
    const [rows]: any = await db.execute(sql.raw(`SELECT id, access_token, expires_at FROM ai_zoho_config WHERE id = 'global' LIMIT 1`));
    const config = rows[0];

    if (!config || !config.access_token) {
      return { connected: false };
    }

    const expiresDate = config.expires_at instanceof Date
      ? config.expires_at
      : new Date(String(config.expires_at).replace(' ', 'T') + 'Z');
    const expired = expiresDate < new Date();
    return {
      connected: true,
      expired,
      expiresAt: expiresDate.toISOString()
    };
  } catch {
    return { connected: false };
  }
});
