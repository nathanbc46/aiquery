import { useDb } from '../../utils/db';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { getAuthSession, findOrCreateAiUser } from '../../utils/auth';
import { getValidZohoToken } from '../../utils/zoho';
import { aiQueryRequests, users } from '../../utils/schema';
import { sendEmail } from '../../utils/mail';

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

  const upperSql = querySql.trim().toUpperCase();
  if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
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

    // 4. Update user_id (owner) if ownerVtigerId provided
    let ownerSuffix = '';
    if (options?.ownerVtigerId && requestId) {
      const ownerAiUserId = await findOrCreateAiUser(Number(options.ownerVtigerId));
      await db.update(aiQueryRequests)
        .set({ userId: ownerAiUserId })
        .where(eq(aiQueryRequests.id, requestId));
      ownerSuffix = `_${String(options.ownerVtigerId)}`;
    }

    // 5. Upload CSV to WorkDrive AI Queries folder
    const targetFolderId = process.env.ZOHO_FOLDER_ID || '32746828f57533b77410b951b061e7005d255';
    const safeName = (options?.linkName || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙]/g, '_');
    const fileName = `${safeName}${ownerSuffix}_${Date.now()}.csv`;

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

    // Save Zoho link + expiresAt back to request record if requestId provided
    const zohoExpiresAt = options?.expiresAt ? new Date(options.expiresAt) : null;
    if (requestId) {
      await db.update(aiQueryRequests)
        .set({
          zohoLink: fileLink,
          ...(zohoExpiresAt ? { expiresAt: zohoExpiresAt } : {}),
        })
        .where(eq(aiQueryRequests.id, requestId));
    }

    // ส่งเมลล์แจ้ง owner ถ้า owner เป็นคนละคนกับผู้ login
    if (options?.ownerVtigerId && options.ownerVtigerId !== session.vtigerId) {
      const ownerVtigerId = Number(options.ownerVtigerId);
      const ownerRecord = await db.query.users.findFirst({ where: eq(users.vtigerId, ownerVtigerId) });
      const ownerEmail = ownerRecord?.email;
      if (ownerEmail) {
        const ownerName = ownerRecord?.displayName || `User #${ownerVtigerId}`;
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const creatorName = session.displayName as string || 'ผู้ดูแลระบบ';
        sendEmail({
          to: ownerEmail,
          subject: `📊 ${creatorName} ได้เตรียมข้อมูลสำหรับคุณแล้ว (Zoho WorkDrive)`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f7fa;padding:30px 10px;">
              <div style="max-width:580px;margin:0 auto;background-color:#fff;border-radius:12px;overflow:hidden;border:1px solid #e1e8f0;box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                <div style="background-color:#0f9d58;padding:25px;text-align:center;">
                  <div style="display:inline-block;background:rgba(255,255,255,0.2);padding:12px;border-radius:12px;margin-bottom:12px;">
                    <span style="font-size:32px;line-height:1;">📊</span>
                  </div>
                  <h2 style="margin:0;color:#fff;font-size:20px;font-weight:700;">ไฟล์ข้อมูลพร้อมแล้วบน Zoho WorkDrive</h2>
                </div>
                <div style="padding:30px 25px;">
                  <p style="margin:0 0 15px;font-size:15px;color:#64748b;">เรียน <b>${ownerName}</b>,</p>
                  <p style="margin:0 0 20px;font-size:14px;color:#64748b;"><strong>${creatorName}</strong> ได้อัพโหลดไฟล์ข้อมูลสำหรับคุณไปยัง Zoho WorkDrive เรียบร้อยแล้ว</p>
                  <div style="text-align:center;margin-bottom:24px;">
                    <a href="${fileLink}" style="display:inline-block;background-color:#0f9d58;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">เปิดไฟล์ใน Zoho WorkDrive</a>
                  </div>
                  <div style="background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #edf2f7;margin-bottom:16px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">📁 ชื่อไฟล์</p>
                    <p style="margin:0;font-size:13px;color:#1e293b;font-family:monospace;">${fileName}</p>
                  </div>
                  ${zohoExpiresAt ? `<p style="margin:0 0 16px;font-size:13px;color:#ef4444;"><strong>⏰ ลิงก์นี้จะหมดอายุวันที่:</strong> ${new Date(zohoExpiresAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                  <p style="margin:0;font-size:12px;color:#94a3b8;">นอกจากนี้ยังสามารถดาวน์โหลดข้อมูลได้ที่ <a href="${baseUrl}/history" style="color:#4f46e5;">หน้าประวัติข้อมูล</a> โดยใช้ Username และ Password ของ Vtiger CRM เพื่อเข้าสู่ระบบ</p>
                </div>
                <div style="padding:16px 25px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="margin:0;font-size:11px;color:#94a3b8;">อีเมลนี้ส่งโดยอัตโนมัติจาก Vtiger AI Query System</p>
                </div>
              </div>
            </div>
          `
        }).catch(err => console.warn('Owner Zoho notification email failed:', err));
      }
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
