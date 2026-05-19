import { useDb } from '../../utils/db';
import { aiQueryRequests, users } from '../../utils/schema';
import { getAuthSession } from '../../utils/auth';
import { findOrCreateAiUser } from '../../utils/auth';
import { sendEmail } from '../../utils/mail';
import { or, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { queryText, generatedSql, explanation, resultCount, requestReason, ownerVtigerId, expiresAt } = body;

  if (!queryText || !generatedSql) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  try {
    const db = await useDb();
    
    const requestId = crypto.randomUUID();
    
    const session = await getAuthSession(event);
    if (!session.userId) {
      throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

    const isAdminOrManager = session.role === 'admin' || session.role === 'manager';

    await db.insert(aiQueryRequests).values({
      id: requestId,
      userId: session.userId as string,
      createdBy: session.userId as string,
      queryText: queryText,
      generatedSql: generatedSql,
      explanationTh: explanation,
      resultCount: resultCount || 0,
      requestReason: requestReason,
      status: 'PENDING',
    });

    if (isAdminOrManager) {
      // 3A. อนุมัติอัตโนมัติทันทีสำหรับ Manager/Admin (โดยเรียกใช้งาน API Action)
      try {
        // ใช้ expiresAt ที่ user เลือก หรือ default 7 วัน
        const resolvedExpiresAt = expiresAt
          ? new Date(expiresAt).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await $fetch('/api/ai-query/action', {
          method: 'POST',
          headers: {
            cookie: event.node.req.headers.cookie || ''
          },
          body: {
            requestId,
            status: 'APPROVED',
            managerComment: '✨ อนุมัติอัตโนมัติโดยระบบ (ผู้ขอมีสิทธิ์ Manager/Admin)',
            expiresAt: resolvedExpiresAt
          }
        });

        // อัพเดท userId (owner) ถ้า user เลือก owner ที่ต่างจากตัวเอง
        if (ownerVtigerId) {
          try {
            const db = await useDb();
            const ownerAiUserId = await findOrCreateAiUser(ownerVtigerId);
            await db.update(aiQueryRequests)
              .set({ userId: ownerAiUserId })
              .where(eq(aiQueryRequests.id, requestId));
          } catch (err) {
            console.error('Update owner failed:', err);
          }
        }

        return { success: true, requestId, autoApproved: true };
      } catch (err) {
        console.error('Auto-approval failed:', err);
        // ถ้า auto-approve พลาด ก็ปล่อยให้เป็น PENDING ไป
      }
    } else {
      // 3B. แจ้งเตือน Manager/Admin ทางอีเมล สำหรับ User ทั่วไป (Background task)
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      
      db.select({ email: users.email, displayName: users.displayName })
        .from(users)
        .where(or(eq(users.role, 'admin'), eq(users.role, 'manager')))
        .then(managers => {
          const recipientEmails = managers.map(m => m.email).filter(Boolean) as string[];
          if (recipientEmails.length > 0) {
            sendEmail({
              to: recipientEmails.join(','),
              subject: `🔔 มีคำขออนุมัติดึงข้อมูลใหม่จากคุณ ${session.displayName}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; padding: 30px 10px;">
                  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e1e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <div style="background-color: #4f46e5; padding: 25px; text-align: center;">
                      <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px; border-radius: 12px; margin-bottom: 12px;">
                        <span style="font-size: 32px; line-height: 1;">🤖</span>
                      </div>
                      <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                        มีการขออนุมัติข้อมูลใหม่
                      </h2>
                    </div>

                    <div style="padding: 30px 25px;">
                      <p style="margin: 0 0 15px; font-size: 15px; color: #64748b;">เรียน <b>ผู้ดูแลระบบ/ผู้จัดการ</b>,</p>
                      <p style="margin: 0 0 25px; font-size: 15px; color: #64748b;">มีการส่งคำขออนุมัติดึงข้อมูลใหม่จากระบบ AI Query รายละเอียดดังนี้:</p>
                      
                      <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; border: 1px solid #edf2f7;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
                          <tr>
                            <td style="padding: 6px 0; color: #94a3b8; width: 100px; vertical-align: top;">👤 ผู้ขอ:</td>
                            <td style="padding: 6px 0 6px 10px; color: #1e293b; font-weight: 600;">${session.displayName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; color: #94a3b8; width: 100px; vertical-align: top;">📝 คำสั่ง:</td>
                            <td style="padding: 6px 0 6px 10px; color: #1e293b; line-height: 1.4;"><i>"${queryText}"</i></td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; color: #94a3b8; width: 100px; vertical-align: top;">💡 เหตุผล:</td>
                            <td style="padding: 6px 0 6px 10px; color: #475569;">${requestReason || '-'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; color: #94a3b8; width: 100px;">📊 จำนวน:</td>
                            <td style="padding: 6px 0 6px 10px; color: #4f46e5; font-weight: 700;">${resultCount} รายการ</td>
                          </tr>
                        </table>
                      </div>

                      <div style="margin-top: 30px; text-align: center;">
                        <p style="font-size: 13px; color: #94a3b8; margin-bottom: 15px;">กรุณาตรวจสอบความถูกต้องของ SQL ก่อนอนุมัติ</p>
                        <a href="${baseUrl}/approvals" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.15);">
                          เข้าสู่หน้าการอนุมัติ
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              `
            });
          }
        })
        .catch(err => console.warn('Email notification fetch failed:', err));
    }

    return { 
      success: true, 
      requestId 
    };

  } catch (error: any) {
    console.error('Request Submission Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit request'
    };
  }
});
