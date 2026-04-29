import nodemailer from 'nodemailer';
import { useDb } from './db';
import { aiMailSettings } from './schema';
import { eq } from 'drizzle-orm';

/**
 * ฟังก์ชันสำหรับส่งอีเมลโดยใช้การตั้งค่าจากฐานข้อมูล
 */
export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  const db = await useDb();
  
  // 1. ดึงการตั้งค่าเมลจาก DB
  const settings = await db.select().from(aiMailSettings).where(eq(aiMailSettings.id, 'global')).limit(1);
  const config = settings[0];
  
  if (!config || !config.host) {
    console.error('Mail settings not configured. Skipping email send.');
    return { success: false, error: 'Mail settings not configured' };
  }

  try {
    // 2. สร้าง Transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure || false,
      auth: config.requireAuth ? {
        user: config.user || '',
        pass: config.password || ''
      } : undefined
    });

    // 3. ส่งอีเมล
    const info = await transporter.sendMail({
      from: `"${config.fromName || 'AI Query System'}" <${config.fromEmail || config.user}>`,
      to,
      subject,
      html
    });

    console.log('Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}
