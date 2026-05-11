import { getAuthSession } from '../../utils/auth'
import { sendEmail } from '../../utils/mail'

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const { to, subject, message, pdfBase64, filename } = body

  if (!to || !pdfBase64) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields', message: 'กรุณาระบุอีเมลผู้รับก่อนส่ง' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(to)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email address', message: `"${to}" ไม่ใช่รูปแบบอีเมลที่ถูกต้อง กรุณาตรวจสอบและลองใหม่` })
  }

  const pdfBuffer = Buffer.from(pdfBase64, 'base64')
  if (pdfBuffer.byteLength > 10 * 1024 * 1024) {
    const sizeMb = (pdfBuffer.byteLength / 1024 / 1024).toFixed(1)
    throw createError({ statusCode: 413, statusMessage: 'PDF file too large (max 10MB)', message: `ไฟล์ PDF ขนาด ${sizeMb} MB เกินขีดจำกัด 10 MB กรุณาลดจำนวนข้อความที่เลือก แล้วลองใหม่` })
  }

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 16px 16px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 20px;">รายงานการสนทนา AI</h2>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">ส่งจากระบบ Vtiger AI Query System</p>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 16px 16px; background: #f8fafc;">
        <p style="color: #475569; font-size: 14px; margin: 0 0 16px;">ไฟล์ PDF รายงานการสนทนา AI แนบมาด้วยในอีเมลฉบับนี้</p>
        ${message ? `<div style="background: white; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 0 8px 8px 0; color: #64748b; font-size: 13px; white-space: pre-wrap;">${message}</div>` : ''}
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">ส่งโดย <strong>${session.displayName || 'ผู้ใช้งาน'}</strong> ผ่านระบบ AI Query System</p>
      </div>
    </div>
  `

  const result = await sendEmail({
    to,
    subject: subject || 'รายงานการสนทนา AI',
    html: htmlBody,
    attachments: [{
      filename: filename || 'chat-report.pdf',
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  })

  if (!result.success) {
    // แปลง error จาก nodemailer ให้เป็นข้อความที่บอกสาเหตุได้ชัดเจน
    const rawError = result.error || ''
    let friendlyMsg = `ส่งอีเมลไม่สำเร็จ: ${rawError}`

    if (rawError.includes('not configured')) {
      friendlyMsg = 'ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์อีเมล กรุณาติดต่อ Admin เพื่อตั้งค่า SMTP ในหน้า Settings'
    } else if (rawError.toLowerCase().includes('connect') || rawError.toLowerCase().includes('econnrefused') || rawError.toLowerCase().includes('enotfound')) {
      friendlyMsg = `ไม่สามารถเชื่อมต่อ SMTP Server ได้ (${rawError}) กรุณาตรวจสอบ Host/Port หรือลองใหม่ภายหลัง`
    } else if (rawError.toLowerCase().includes('auth') || rawError.toLowerCase().includes('username') || rawError.toLowerCase().includes('password') || rawError.toLowerCase().includes('535')) {
      friendlyMsg = `การยืนยันตัวตน SMTP ล้มเหลว กรุณาตรวจสอบ Username/Password ใน Settings`
    } else if (rawError.toLowerCase().includes('recipient') || rawError.toLowerCase().includes('550') || rawError.toLowerCase().includes('551')) {
      friendlyMsg = `เซิร์ฟเวอร์ปฏิเสธเอียมไปยัง "${to}" (อาจไม่มีอีเมลนี้ หรือถูก Block) กรุณาตรวจสอบอีเมลผู้รับ`
    } else if (rawError.toLowerCase().includes('timeout')) {
      friendlyMsg = 'การเชื่อมต่อ SMTP Server หมดเวลา (Timeout) กรุณาลองใหม่'
    }

    throw createError({ statusCode: 500, statusMessage: 'Failed to send email', message: friendlyMsg })
  }

  return { success: true, messageId: result.messageId }
})
