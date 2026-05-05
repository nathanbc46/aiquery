import { useDb } from '../../utils/db';
import { users } from '../../utils/schema';
import { eq, or } from 'drizzle-orm';
import { sendEmail } from '../../utils/mail';
import { getAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { 
    queryText, 
    generatedSql, 
    explanation, 
    dbError,
    userDisplayName
  } = body;

  if (!dbError) {
    throw createError({ statusCode: 400, statusMessage: 'Error message is required' });
  }

  const escapeHtml = (str: string) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  try {
    const db = await useDb();

    // 1. ค้นหา Admin เพื่อส่งเมลแจ้งเตือน
    const admins = await db.select()
      .from(users)
      .where(eq(users.role, 'admin'));

    if (admins.length === 0) {
      return { success: false, error: 'No administrators found to receive the report' };
    }

    const adminEmails = admins.map(a => a.email).filter(e => !!e) as string[];
    
    if (adminEmails.length === 0) {
      return { success: false, error: 'Administrators found but none have emails configured' };
    }

    // 2. เตรียมเนื้อหาอีเมล
    const emailHtml = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #f44336; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🚨 รายงานข้อผิดพลาด SQL (AI Query)</h1>
        </div>
        <div style="padding: 30px;">
          <p>เรียน ผู้ดูแลระบบ,</p>
          <p>พบข้อผิดพลาดในการประมวลผลคำสั่ง SQL ที่สร้างโดย AI โดยมีรายละเอียดดังนี้:</p>
          
          <div style="background-color: #fff3f3; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0;">
            <strong style="color: #d32f2f;">ข้อผิดพลาดจากฐานข้อมูล:</strong><br/>
            <code style="font-family: monospace; display: block; margin-top: 5px;">${escapeHtml(dbError)}</code>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px;"><strong>ผู้แจ้ง:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(userDisplayName || 'ไม่ระบุชื่อ')} (${escapeHtml(session.userName)})</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>คำถามของผู้ใช้:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(queryText)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>คำอธิบายจาก AI:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(explanation)}</td>
            </tr>
          </table>

          <div style="margin-top: 30px;">
            <strong>คำสั่ง SQL ที่ผิดพลาด:</strong>
            <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; overflow-x: auto; font-size: 13px;">${escapeHtml(generatedSql)}</pre>
          </div>

          <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #888;">
            <p>รายงานนี้ถูกส่งโดยอัตโนมัติจากระบบ AI-Query เมื่อผู้ใช้กดปุ่มรายงานปัญหา</p>
          </div>
        </div>
      </div>
    `;

    // 3. ส่งเมลหา Admin ทุกคน
    await sendEmail({
      to: adminEmails.join(','),
      subject: `[AI-Query Error] พบข้อผิดพลาด SQL จากผู้ใช้: ${userDisplayName || session.userName}`,
      html: emailHtml
    });

    return { success: true };

  } catch (error: any) {
    console.error('Report Error API Failure:', error);
    return { success: false, error: error.message };
  }
});
