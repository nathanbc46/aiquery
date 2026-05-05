import { useDb } from '../../utils/db';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { getValidZohoToken } from '../../utils/zoho';
import { aiQueryRequests } from '../../utils/schema';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { sql: querySql, options, requestId } = body;

  if (!querySql) {
    throw createError({ statusCode: 400, statusMessage: 'SQL query is required' });
  }

  if (!/^\s*SELECT\s/i.test(querySql)) {
    throw createError({ statusCode: 400, statusMessage: 'Only SELECT queries are allowed for export' });
  }

  try {
    // 1. Get Valid Token
    const accessToken = await getValidZohoToken();

    // 2. Execute SQL to get data
    const db = await useDb();
    const [rows]: any = await db.execute(sql.raw(querySql));
    const data = rows as any[];

    if (data.length === 0) {
      throw new Error('No data found to export');
    }

    // 3. Generate CSV
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // 4. Upload CSV to WorkDrive AI Queries folder
    const targetFolderId = process.env.ZOHO_FOLDER_ID || '32746828f57533b77410b951b061e7005d255';
    const safeName = (options?.linkName || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙]/g, '_');
    const fileName = `${safeName}_${Date.now()}.csv`;

    const formData = new FormData();
    formData.append('content', new Blob([csvContent], { type: 'text/csv' }), fileName);
    formData.append('filename', fileName);
    formData.append('parent_id', targetFolderId);
    formData.append('override-name-exist', 'false');

    const uploadResponse: any = await $fetch('https://www.zohoapis.com/workdrive/api/v1/upload', {
      method: 'POST',
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` },
      body: formData
    }).catch((e: any) => { throw new Error(`WorkDrive Upload Error: ${JSON.stringify(e.response?._data) || e.message}`); });

    const fileInfo = uploadResponse?.data?.[0]?.attributes;
    if (!fileInfo?.resource_id) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadResponse)}`);
    }

    const fileLink = fileInfo.Permalink || `https://workdrive.zoho.com/file/${fileInfo.resource_id}`;

    // Save Zoho link back to request record if requestId provided
    if (requestId) {
      await db.update(aiQueryRequests)
        .set({ zohoLink: fileLink })
        .where(eq(aiQueryRequests.id, requestId));
    }

    return {
      success: true,
      link: fileLink,
      fileName,
      message: 'อัพโหลดไฟล์ไปยัง Zoho WorkDrive เรียบร้อยแล้ว'
    };

  } catch (error: any) {
    console.error('Zoho Export Error:', error);

    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('not authorized') || errorMessage.includes('invalid_code') || errorMessage.includes('invalid_grant')) {
      return {
        success: false,
        needsAuth: true,
        authUrl: '/api/zoho/auth',
        message: 'การเชื่อมต่อ Zoho หมดอายุหรือถูกยกเลิก กรุณายืนยันตัวตนใหม่อีกครั้ง'
      };
    }

    return {
      success: false,
      message: error.message || 'Failed to export to Zoho'
    };
  }
});
