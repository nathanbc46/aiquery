import { GoogleGenerativeAI } from '@google/generative-ai'
import { useDb } from '../../utils/db'
import { eq } from 'drizzle-orm'
import { aiSettings } from '../../utils/schema'
import { getAuthSession } from '../../utils/auth'
import { DEFAULT_AGENTIC_MODEL } from '../../utils/constants'

const FORBIDDEN_KEYWORDS = ['UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'INSERT', 'EXEC']

const SYSTEM_INSTRUCTION = `คุณเป็น SQL Expert ผู้เชี่ยวชาญฐานข้อมูล Vtiger CRM 8.4
ตอบคำถามเป็นภาษาไทยเสมอ กระชับ ชัดเจน และเป็นประโยชน์
คุณสามารถแนะนำวิธีแก้ไข SQL หรืออธิบายสาเหตุที่ query ไม่ทำงานตามที่คาดไว้

หากคุณเสนอ SQL ที่ปรับปรุงแล้ว ให้ใส่ไว้ใน code block เช่น:
\`\`\`sql
SELECT ...
\`\`\`

กฎความปลอดภัย: อนุญาตเฉพาะ SELECT เท่านั้น ห้ามแนะนำ UPDATE, DELETE, DROP, INSERT, TRUNCATE, ALTER`

function extractSql(text: string): string | undefined {
  const match = text.match(/```sql\s*([\s\S]*?)```/)
  if (!match) return undefined
  const sql = match[1].trim()
  const upper = sql.toUpperCase()
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(upper)) return undefined
  }
  return sql
}

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const sql: string = body.sql || ''
  const error: string = body.error || ''
  const question: string = body.question || ''
  const messages: { role: 'user' | 'model'; text: string }[] = body.messages || []

  if (!question.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Question is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured' })
  }

  try {
    const db = await useDb()

    let instruction = SYSTEM_INSTRUCTION
    try {
      const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1)
      const customHints = settings[0]?.customHints
      if (customHints?.trim()) {
        instruction += `\n\n## Business Rules & Custom Hints\n${customHints.trim()}`
      }
    } catch { /* ใช้ default */ }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: DEFAULT_AGENTIC_MODEL,
      systemInstruction: instruction
    })

    // สร้าง context message ที่ embed SQL + error
    const contextParts: string[] = []
    if (sql.trim()) {
      contextParts.push(`**SQL ปัจจุบัน:**\n\`\`\`sql\n${sql}\n\`\`\``)
    }
    if (error.trim()) {
      contextParts.push(`**Error ที่พบ:**\n\`\`\`\n${error}\n\`\`\``)
    }
    const contextMessage = contextParts.join('\n\n')

    // Build chat history — context message เป็น message แรกสุด
    const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []

    if (contextMessage) {
      history.push({
        role: 'user',
        parts: [{ text: `${contextMessage}\n\nช่วยวิเคราะห์ SQL นี้ให้หน่อย` }]
      })
      history.push({
        role: 'model',
        parts: [{ text: 'รับทราบครับ ผมได้อ่าน SQL และ error ที่แจ้งมาแล้ว กรุณาถามได้เลย' }]
      })
    }

    // เพิ่ม conversation history ก่อนหน้า
    for (const msg of messages) {
      history.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      })
    }

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(question)
    const reply = result.response.text()
    const updatedSql = extractSql(reply)

    return { success: true, reply, updatedSql }
  } catch (err: any) {
    console.error('[chat-sql] Error:', err)
    throw createError({ statusCode: 500, statusMessage: err.message || 'Chat failed' })
  }
})
