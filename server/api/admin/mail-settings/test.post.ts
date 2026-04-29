import { createTransport } from 'nodemailer'

export default defineEventHandler(async (event) => {
  // ตรวจสอบสิทธิ์ (เฉพาะ Admin เท่านั้น)
  const session = await requireAuthRole(event, ['admin'])

  const body = await readBody(event)
  const config = body.settings

  if (!config.host) {
    throw createError({
      statusCode: 400,
      message: 'กรุณาระบุ SMTP Host'
    })
  }

  try {
    // สร้าง Transporter ชั่วคราวจากค่าที่ส่งมา
    const transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.requireAuth ? {
        user: config.user,
        pass: config.password,
      } : undefined,
      tls: {
        // ยอมรับ self-signed certificate สำหรับการทดสอบ (ถ้าจำเป็น)
        rejectUnauthorized: false 
      }
    })

    // ข้อมูลผู้ส่ง
    const fromName = config.fromName || 'AI Query System Test'
    const fromEmail = config.fromEmail || config.user
    const targetEmail = session.email || fromEmail

    if (!targetEmail) {
      throw new Error('ไม่พบที่อยู่อีเมลสำหรับรับการทดสอบ (กรุณาระบุ Username หรือ From Email)')
    }

    // ทดสอบส่งเมล
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: targetEmail,
      subject: '🔔 ทดสอบการเชื่อมต่อระบบเมล - AI Query System',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2563eb;">ยินดีด้วย! ระบบเมลของคุณทำงานได้ปกติ</h2>
          <p>อีเมลฉบับนี้คือการทดสอบการเชื่อมต่อ SMTP จากระบบ <strong>AI Query & Approval</strong></p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 14px; color: #64748b;">
            <strong>รายละเอียดการเชื่อมต่อ:</strong><br>
            Host: ${config.host}<br>
            Port: ${config.port}<br>
            Secure: ${config.secure ? 'Yes (SSL/TLS)' : 'No'}<br>
            Auth: ${config.requireAuth ? 'Enabled' : 'Disabled'}
          </p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
            หากคุณได้รับอีเมลนี้ แสดงว่าการตั้งค่าของคุณถูกต้องแล้ว คุณสามารถบันทึกการตั้งค่าได้ทันที
          </p>
        </div>
      `
    })

    return { success: true, target: targetEmail }
  } catch (error: any) {
    console.error('SMTP Test Error:', error)
    throw createError({
      statusCode: 500,
      message: 'ไม่สามารถเชื่อมต่อกับ SMTP Server ได้',
      data: { error: error.message }
    })
  }
})
