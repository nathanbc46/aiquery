import { GoogleGenerativeAI } from '@google/generative-ai'
import { createEventStream } from 'h3'
import { useDb } from '../../utils/db'
import { eq } from 'drizzle-orm'
import { aiSettings } from '../../utils/schema'
import { getAuthSession } from '../../utils/auth'
import { DEFAULT_AGENTIC_MODEL } from '../../utils/constants'
import { dispatchTool, TOOL_DECLARATIONS } from '../../utils/schemaTools'

// ไม่รวม sample_data — ไม่เหมาะกับ chat context (ป้องกันข้อมูล sensitive รั่ว)
const CHAT_TOOL_DECLARATIONS = TOOL_DECLARATIONS.filter(t => t.name !== 'sample_data')

// ดึงชื่อตารางจาก SQL (FROM / JOIN)
function extractTableNames(sqlText: string): string[] {
  const tables: string[] = []
  const regex = /(?:FROM|JOIN)\s+([`"]?[a-zA-Z_][a-zA-Z0-9_]*[`"]?)/gi
  let match
  while ((match = regex.exec(sqlText)) !== null) {
    const tbl = match[1].replace(/[`"]/g, '')
    if (!tables.includes(tbl)) tables.push(tbl)
  }
  return tables
}

const FORBIDDEN_KEYWORDS = ['UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'INSERT', 'EXEC']

const SYSTEM_INSTRUCTION = `คุณเป็น SQL Expert ผู้เชี่ยวชาญฐานข้อมูล Vtiger CRM 8.4
ตอบคำถามเป็นภาษาไทยเสมอ กระชับ ชัดเจน และเป็นประโยชน์
คุณสามารถแนะนำวิธีแก้ไข SQL หรืออธิบายสาเหตุที่ query ไม่ทำงานตามที่คาดไว้

🚫 กฎเหล็ก — ห้ามเดาชื่อตารางหรือคอลัมน์โดยเด็ดขาด:
1. ห้ามใช้ชื่อตารางหรือคอลัมน์ที่ไม่ได้ยืนยันจาก DB จริง
2. เมื่อ Schema Context แสดง "⚠️ ตารางนี้ไม่มีอยู่ใน DB" → ห้ามใช้ชื่อตารางนั้นในคำตอบเด็ดขาด ต้องเรียก list_tables() ก่อน
3. เมื่อ Error บอกว่า "Table X doesn't exist" → ห้ามสมมติ/เดา/แนะนำชื่อตาราง X หรือชื่อใกล้เคียง ต้องเรียก list_tables() เพื่อหาชื่อที่ถูกต้องจาก DB จริงก่อนเสนอ SQL ทุกครั้ง

⚙️ ขั้นตอนบังคับเมื่อตารางไม่มีอยู่:
- เรียก list_tables(module_hint) เพื่อดูรายชื่อตารางที่มีจริง
- เรียก describe_table(ชื่อที่พบ) เพื่อยืนยันคอลัมน์
- จากนั้นเสนอ SQL ที่ใช้ชื่อตารางที่พบจากขั้นตอนข้างต้นเท่านั้น

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
  const schemaContext: string = body.schemaContext || ''

  if (!question.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Question is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured' })
  }

  const eventStream = createEventStream(event)

  ;(async () => {
    const send = async (data: object) => { await eventStream.push(JSON.stringify(data)) }

    try {
      const db = await useDb()

      let instruction = SYSTEM_INSTRUCTION
      try {
        const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1)
        const customHints = settings[0]?.customHints

        const sqlTables = extractTableNames(sql)
        const liveSchemas: string[] = []
        for (const tbl of sqlTables) {
          try {
            const cols = await dispatchTool('describe_table', { table_name: tbl }, session.role ?? 'user') as any[]
            if (!Array.isArray(cols) || cols.length === 0) continue
            if (cols[0]?.column === 'error') {
              // ตารางนี้ไม่มีอยู่ — บอก AI ตรงๆ เพื่อให้ค้นหาชื่อที่ถูกต้อง
              liveSchemas.push(`### ${tbl}\n⚠️ ตารางนี้ไม่มีอยู่ใน DB: ${cols[0].comment}\nให้ใช้ list_tables หรือ search_columns เพื่อหาชื่อตารางที่ถูกต้อง`)
            } else {
              const colLines = cols.map((c: any) =>
                `  - ${c.column}: ${c.type}${c.key === 'PRI' ? ' (PK)' : ''}${c.nullable === 'NO' ? ' NOT NULL' : ''}${c.comment ? ` -- ${c.comment}` : ''}`
              )
              liveSchemas.push(`### ${tbl}\n${colLines.join('\n')}`)
            }
          } catch { /* ข้าม */ }
        }

        const liveSchemaText = liveSchemas.length > 0
          ? `## โครงสร้างตารางที่ใช้ใน SQL (ข้อมูลจริงจาก DB)\n\n${liveSchemas.join('\n\n')}`
          : ''
        const fallbackSchema = schemaContext.trim() || settings[0]?.generateSystemInstruction || ''
        const dbSchema = liveSchemaText || fallbackSchema
        if (dbSchema) {
          instruction += `\n\n## Database Schema Context — ใช้เฉพาะคอลัมน์เหล่านี้เท่านั้น ห้าม hallucinate\n${dbSchema}`
        }
        if (customHints?.trim()) {
          instruction += `\n\n## Business Rules & Custom Hints\n${customHints.trim()}`
        }
      } catch { /* ใช้ default */ }

      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: DEFAULT_AGENTIC_MODEL,
        systemInstruction: instruction
      })

      const contextParts: string[] = []
      if (sql.trim()) contextParts.push(`**SQL ปัจจุบัน:**\n\`\`\`sql\n${sql}\n\`\`\``)
      if (error.trim()) contextParts.push(`**Error ที่พบ:**\n\`\`\`\n${error}\n\`\`\``)
      const contextMessage = contextParts.join('\n\n')

      const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
      if (contextMessage) {
        history.push({ role: 'user', parts: [{ text: `${contextMessage}\n\nช่วยวิเคราะห์ SQL นี้ให้หน่อย` }] })
        history.push({ role: 'model', parts: [{ text: 'รับทราบครับ ผมได้อ่าน SQL และ error ที่แจ้งมาแล้ว กรุณาถามได้เลย' }] })
      }
      for (const msg of messages) {
        history.push({ role: msg.role, parts: [{ text: msg.text }] })
      }

      const chat = model.startChat({
        history,
        tools: [{ functionDeclarations: CHAT_TOOL_DECLARATIONS }]
      })

      let chatResult = await chat.sendMessage(question)

      // Mini agentic loop — stream tool call status กลับ frontend (max 5 รอบ)
      for (let i = 0; i < 5; i++) {
        const parts = chatResult.response.candidates?.[0]?.content?.parts ?? []
        const fnCalls = parts.filter((p: any) => p.functionCall)
        if (!fnCalls.length) break

        const toolResponses: any[] = []
        for (const part of fnCalls) {
          const { name, args } = (part as any).functionCall
          await send({ type: 'tool_start', tool: name, args: args ?? {} })
          try {
            const toolResult = await dispatchTool(name, args ?? {}, session.role ?? 'user')
            toolResponses.push({ functionResponse: { name, response: { result: toolResult } } })
          } catch {
            toolResponses.push({ functionResponse: { name, response: { result: { error: 'Tool unavailable' } } } })
          }
          await send({ type: 'tool_done', tool: name })
        }
        chatResult = await chat.sendMessage(toolResponses)
      }

      // ถ้า AI ยังมี pending function calls อยู่ → บังคับให้ตอบเป็น text
      {
        const finalParts = chatResult.response.candidates?.[0]?.content?.parts ?? []
        const stillHasFnCalls = finalParts.some((p: any) => p.functionCall)
        let rawText = ''
        try { rawText = chatResult.response.text() } catch { /* จะ force ด้านล่าง */ }
        if (stillHasFnCalls || !rawText.trim()) {
          chatResult = await chat.sendMessage(
            'กรุณาตอบเป็นข้อความภาษาไทยได้เลย อย่าเรียก tool เพิ่มเติมแล้ว'
          )
        }
      }

      let reply: string
      try {
        reply = chatResult.response.text()
      } catch {
        reply = 'AI ไม่สามารถสร้างคำตอบได้ กรุณาลองใหม่อีกครั้ง'
      }
      const updatedSql = extractSql(reply)
      await send({ type: 'done', reply, updatedSql })

    } catch (err: any) {
      console.error('[chat-sql] Error:', err)
      await send({ type: 'error', message: err.message || 'Chat failed' })
    }

    await eventStream.close()
  })()

  return eventStream.send()
})
