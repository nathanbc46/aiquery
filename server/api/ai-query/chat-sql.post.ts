import { GoogleGenerativeAI } from '@google/generative-ai'
import { createEventStream } from 'h3'
import { useDb } from '../../utils/db'
import { eq } from 'drizzle-orm'
import { aiSettings } from '../../utils/schema'
import { getAuthSession } from '../../utils/auth'
import { DEFAULT_AGENTIC_MODEL } from '../../utils/constants'
import { dispatchTool, TOOL_DECLARATIONS } from '../../utils/schemaTools'
import { logTokenUsage } from '../../utils/tokenLogger'

// ไม่รวม sample_data — ไม่เหมาะกับ chat context (ป้องกันข้อมูล sensitive รั่ว)
const CHAT_TOOL_DECLARATIONS = TOOL_DECLARATIONS.filter(t => t.name !== 'sample_data')

// ดึงชื่อตารางจาก SQL (FROM / JOIN)
function extractTableNames(sqlText: string): string[] {
  const tables: string[] = []
  const regex = /(?:FROM|JOIN)\s+([`"]?[a-zA-Z_][a-zA-Z0-9_]*[`"]?)/gi
  let match
  while ((match = regex.exec(sqlText)) !== null) {
    const tbl = (match[1] ?? '').replace(/[`"]/g, '')
    if (tbl && !tables.includes(tbl)) tables.push(tbl)
  }
  return tables
}

const FORBIDDEN_KEYWORDS = ['UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'INSERT', 'EXEC']

const SYSTEM_INSTRUCTION = `You are a SQL Expert for Vtiger CRM 8.4 database.
Always respond in Thai language — concise, clear, and helpful.
You can suggest SQL fixes or explain why a query does not work as expected.

STRICT RULES — never guess table or column names:
1. Never use table/column names not confirmed from the real DB.
2. If Schema Context shows a table does not exist in DB, never use that name. Call list_tables() first.
3. If an error says "Table X doesn't exist", do not guess or suggest X or similar names. Call list_tables() to find the real name before proposing any SQL.

MANDATORY STEPS when a table does not exist:
- Call list_tables(module_hint) to see real table names.
- Call describe_table(found_name) to verify columns.
- Only then propose SQL using names discovered above.

When proposing improved SQL, wrap it in a code block:
\`\`\`sql
SELECT ...
\`\`\`

Security: SELECT only. Never suggest UPDATE, DELETE, DROP, INSERT, TRUNCATE, ALTER.`

function extractSql(text: string): string | undefined {
  const match = text.match(/```sql\s*([\s\S]*?)```/)
  if (!match) return undefined
  const sql = (match[1] ?? '').trim()
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
              liveSchemas.push(`### ${tbl}\nWARNING: Table does not exist in DB: ${cols[0].comment}\nUse list_tables or search_columns to find the correct table name.`)
            } else {
              const colLines = cols.map((c: any) =>
                `  - ${c.column}: ${c.type}${c.key === 'PRI' ? ' (PK)' : ''}${c.nullable === 'NO' ? ' NOT NULL' : ''}${c.comment ? ` -- ${c.comment}` : ''}`
              )
              liveSchemas.push(`### ${tbl}\n${colLines.join('\n')}`)
            }
          } catch { /* ข้าม */ }
        }

        const liveSchemaText = liveSchemas.length > 0
          ? `## Live Table Schema (verified from DB — use only these columns)\n\n${liveSchemas.join('\n\n')}`
          : ''
        const fallbackSchema = schemaContext.trim() || settings[0]?.generateSystemInstruction || ''
        const dbSchema = liveSchemaText || fallbackSchema
        if (dbSchema) {
          instruction += `\n\n## Database Schema Context — use only these columns, do not hallucinate\n${dbSchema}`
        }
        if (customHints?.trim()) {
          instruction += `\n\n## Business Rules & Custom Hints\n${customHints.trim()}`
        }
      } catch { /* ใช้ default */ }

      let chatModelName = DEFAULT_AGENTIC_MODEL
      try {
        const modelSettings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1)
        if (modelSettings[0]?.agenticModel) chatModelName = modelSettings[0].agenticModel
      } catch { /* ใช้ default */ }

      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: chatModelName,
        systemInstruction: instruction
      })

      const contextParts: string[] = []
      if (sql.trim()) contextParts.push(`**[CURRENT SQL] — Active SQL in editor. Always use this as reference, ignoring any SQL from chat history.**\n\`\`\`sql\n${sql}\n\`\`\``)
      if (error.trim()) contextParts.push(`**DB Error:**\n\`\`\`\n${error}\n\`\`\``)
      const contextMessage = contextParts.join('\n\n')

      const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
      if (contextMessage) {
        history.push({ role: 'user', parts: [{ text: `${contextMessage}\n\nPlease review this SQL.` }] })
        history.push({ role: 'model', parts: [{ text: 'Understood. I have read the current SQL from the editor. Please ask your question.' }] })
      }
      for (const msg of messages) {
        history.push({ role: msg.role, parts: [{ text: msg.text }] })
      }

      const chat = model.startChat({
        history,
        tools: [{ functionDeclarations: CHAT_TOOL_DECLARATIONS }]
      })

      const chatSqlStart = Date.now()
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
            'Please respond in Thai text now. Do not call any more tools.'
          )
        }
      }

      const chatSqlUsage = chatResult.response.usageMetadata
      logTokenUsage({
        endpoint: 'chat-sql',
        modelUsed: chatModelName,
        userId: session.userId,
        tokensIn: chatSqlUsage?.promptTokenCount ?? 0,
        tokensOut: chatSqlUsage?.candidatesTokenCount ?? 0,
        durationMs: Date.now() - chatSqlStart,
      })

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
