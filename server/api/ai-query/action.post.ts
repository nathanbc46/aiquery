import { useDb } from '../../utils/db';
import { aiQueryRequests, users, aiSettings } from '../../utils/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthSession, requireAuthRole } from '../../utils/auth';
import { sendEmail } from '../../utils/mail';
import { Parser } from '@json2csv/plainjs';
import { DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants';

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { requestId, status, reason, expiresAt, managerComment, skipEmail } = body;

  if (!requestId || !status) {
    throw createError({ statusCode: 400, statusMessage: 'Missing requestId or status' });
  }

  try {
    // 1. ตรวจสอบสิทธิ์ (Security Check)
    const session = await requireAuthRole(event, ['manager', 'admin']);
    const db = await useDb();

    // 2. ถ้าอนุมัติ ให้ทำ Data Snapshot ทันที
    let actualCount = 0;
    if (status === 'APPROVED') {
      // 2.1 ดึงข้อมูลคำขอ
      const [request] = await db.select().from(aiQueryRequests).where(eq(aiQueryRequests.id, requestId)).limit(1);
      if (!request) throw createError({ statusCode: 404, statusMessage: 'Request not found' });

      // 2.2 ดึงขีดจำกัดสูงสุด
      const settingsList = await db.select().from(aiSettings).limit(1);
      const globalLimit = settingsList[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT;

      // 2.3 รัน SQL จริง
      let sqlToRun = request.generatedSql.trim().replace(/;$/, '');
      const limitMatch = sqlToRun.match(/LIMIT\s+(\d+)/i);
      if (limitMatch && limitMatch[1]) {
        const existingLimit = parseInt(limitMatch[1]);
        if (existingLimit > globalLimit) {
          sqlToRun = sqlToRun.replace(/LIMIT\s+\d+/i, `LIMIT ${globalLimit}`);
        }
      } else {
        sqlToRun = `${sqlToRun} LIMIT ${globalLimit}`;
      }

      const [rows]: any = await db.execute(sql.raw(sqlToRun));
      const dataRows = Array.isArray(rows) ? rows : [];
      actualCount = dataRows.length;

      // 2.4 แปลงเป็น CSV
      const parser = new Parser();
      const csv = dataRows.length > 0 ? parser.parse(dataRows) : '';

      // 2.5 บันทึกลง Storage (server/storage/snapshots/[requestId].csv)
      // หมายเหตุ: ต้องตั้งค่า nitro storage ใน nuxt.config.ts หรือใช้ fs โดยตรง
      const storage = useStorage('snapshots');
      await storage.setItem(`${requestId}.csv`, csv);
    }

    // แปลง expiresAt จาก string เป็น Date object (หรือ null ถ้าไม่กำหนด)
    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;

    await db.update(aiQueryRequests)
      .set({
        status: status,                         // 'APPROVED' หรือ 'REJECTED'
        errorMessage: reason || null,           // เหตุผลสำหรับการปฏิเสธ
        managerComment: managerComment || null,  // Comment เพิ่มเติมจาก Manager (optional)
        expiresAt: expiresAtDate,               // วันหมดอายุของไฟล์ (null = ไม่หมดอายุ)
        reviewedAt: new Date(),
        managerId: session.userId as string,     // ใช้ ID ของคนที่ล็อกอินอยู่จริง
        resultCount: status === 'APPROVED' ? actualCount : undefined // อัปเดตจำนวนจริงตอนที่ดึงได้
      })
      .where(eq(aiQueryRequests.id, requestId));

    // 3. แจ้งเตือนผู้ขอทางอีเมล (Background task)
    const requestUrl = getRequestURL(event)
    const baseUrl = process.env.APP_URL || `${requestUrl.protocol}//${requestUrl.host}`

    db.select({
      email: users.email,
      displayName: users.displayName,
      queryText: aiQueryRequests.queryText
    })
      .from(aiQueryRequests)
      .leftJoin(users, eq(aiQueryRequests.userId, users.id))
      .where(eq(aiQueryRequests.id, requestId))
      .limit(1)
      .then(rows => {
        const req = rows[0];
        if (req && req.email && !skipEmail) {
          const isApproved = status === 'APPROVED';
          sendEmail({
            to: req.email,
            subject: `${isApproved ? '✅ คำขอของคุณได้รับอนุมัติแล้ว' : '❌ คำขอของคุณไม่ได้รับการอนุมัติ'}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; padding: 30px 10px;">
                <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e1e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                  <!-- Header Area -->
                  <div style="background-color: ${isApproved ? '#10b981' : '#f43f5e'}; padding: 25px; text-align: center;">
                    <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px; border-radius: 12px; margin-bottom: 12px;">
                      <span style="font-size: 32px; line-height: 1;">${isApproved ? '✅' : '❌'}</span>
                    </div>
                    <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                      คำขอข้อมูล: ${isApproved ? 'อนุมัติแล้ว' : 'ไม่ได้รับการอนุมัติ'}
                    </h2>
                  </div>

                  <!-- Main Content -->
                  <div style="padding: 30px 25px;">
                    <p style="margin: 0 0 15px; font-size: 15px; color: #64748b;">เรียนคุณ <b style="color: #1e293b;">${req.displayName}</b>,</p>
                    <p style="margin: 0 0 25px; font-size: 15px; color: #64748b;">สถานะคำขอดึงข้อมูลของคุณได้รับการอัปเดตดังนี้:</p>
                    
                    <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; border: 1px solid #edf2f7;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; width: 100px; vertical-align: top;">📝 รายการ:</td>
                          <td style="padding: 6px 0 6px 10px; color: #1e293b; font-weight: 500; line-height: 1.4;"><i>"${req.queryText}"</i></td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; width: 100px;">🚩 สถานะ:</td>
                          <td style="padding: 6px 0 6px 10px; color: ${isApproved ? '#10b981' : '#f43f5e'}; font-weight: 700;">${status}</td>
                        </tr>
                        
                        <!-- แสดง Comment จาก Manager (ถ้ามี) -->
                        ${managerComment ? `
                        <tr>
                          <td style="padding: 12px 0 6px; color: #1e293b; font-weight: 700; font-size: 13px;" colspan="2">💬 ความเห็นจากผู้อนุมัติ:</td>
                        </tr>
                        <tr>
                          <td style="padding: 0 0 10px; color: #475569; line-height: 1.5; background-color: #ffffff; border-radius: 6px; padding: 10px; border: 1px dashed #e2e8f0;" colspan="2">
                            ${escapeHtml(managerComment)}
                          </td>
                        </tr>` : ''}

                        <!-- แสดงเหตุผลกรณีไม่อนุมัติ (ถ้ามีและไม่ใช่ข้อความเดียวกับ Comment) -->
                        ${!isApproved && reason && reason !== managerComment ? `
                        <tr>
                          <td style="padding: 12px 0 6px; color: #f43f5e; font-weight: 700; font-size: 13px;" colspan="2">❌ เหตุผลที่ไม่ได้รับการอนุมัติ:</td>
                        </tr>
                        <tr>
                          <td style="padding: 0 0 10px; color: #f43f5e; line-height: 1.5; background-color: #fff1f2; border-radius: 6px; padding: 10px; border: 1px solid #fecdd3;" colspan="2">
                            ${escapeHtml(reason)}
                          </td>
                        </tr>` : ''}

                        ${isApproved && expiresAt ? `
                        <tr>
                          <td style="padding: 10px 0 6px; color: #94a3b8; width: 100px;">⏳ หมดอายุ:</td>
                          <td style="padding: 10px 0 6px 10px; color: #1e293b; font-weight: 500;">${new Date(expiresAt).toLocaleString('th-TH')}</td>
                        </tr>` : ''}
                      </table>
                    </div>

                    ${isApproved ? `
                    <div style="margin-top: 30px; text-align: center;">
                      <p style="font-size: 13px; color: #94a3b8; margin-bottom: 15px;">คลิกปุ่มด้านล่างเพื่อดาวน์โหลดข้อมูล</p>
                      <a href="${baseUrl}/history" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.15);">
                        ไปที่หน้าประวัติการใช้งาน
                      </a>
                    </div>
                    ` : `
                    <div style="margin-top: 25px; text-align: center; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
                      <p style="margin: 0; font-size: 13px; color: #94a3b8;">หากมีข้อสงสัย กรุณาติดต่อผู้จัดการที่เกี่ยวข้อง</p>
                    </div>
                    `}
                  </div>

                  <!-- Bottom Footer -->
                  <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #edf2f7;">
                    <p style="margin: 0; font-size: 11px; color: #cbd5e1; letter-spacing: 0.5px; text-transform: uppercase;">
                      © ${new Date().getFullYear()} AI Query System • ระบบแจ้งเตือนอัตโนมัติ
                    </p>
                  </div>
                </div>
              </div>
            `
          });
        }
      })
      .catch(err => console.warn('Email notification to user failed:', err));

    return {
      success: true
    };

  } catch (error: any) {
    console.error('Update Request Status Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to update request status',
    });
  }
});
