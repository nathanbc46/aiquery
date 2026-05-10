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
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(to)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email address' })
  }

  const pdfBuffer = Buffer.from(pdfBase64, 'base64')
  if (pdfBuffer.byteLength > 10 * 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'PDF file too large (max 10MB)' })
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
    throw createError({ statusCode: 500, statusMessage: result.error || 'Failed to send email' })
  }

  return { success: true, messageId: result.messageId }
})
