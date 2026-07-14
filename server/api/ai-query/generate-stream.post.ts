import { GoogleGenerativeAI } from '@google/generative-ai'
import { createEventStream } from 'h3'
import {
  DEFAULT_AGENTIC_SYSTEM_PROMPT,
  DEFAULT_AGENTIC_MODEL,
  DEFAULT_MAX_RESULTS_LIMIT
} from '../../utils/constants'
import { useDb } from '../../utils/db'
import { sql, eq } from 'drizzle-orm'
import { aiSettings } from '../../utils/schema'
import { getAuthSession } from '../../utils/auth'
import { TOOL_DECLARATIONS, dispatchTool } from '../../utils/schemaTools'

const MAX_ITERATIONS = 12
const FORBIDDEN_KEYWORDS = ['UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'INSERT', 'EXEC']

function cleanJson(text: string): string {
  let t = text.trim()
  if (t.startsWith('```json')) t = t.replace(/^```json/, '').replace(/```$/, '').trim()
  else if (t.startsWith('```')) t = t.replace(/^```/, '').replace(/```$/, '').trim()
  return t
}

function enforceSecurity(rawSql: string): string {
  const upper = rawSql.toUpperCase()
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(upper)) {
      throw new Error(`Security Violation: generated SQL contains forbidden keyword '${kw}'`)
    }
  }
  return rawSql
}

function enforceLimit(rawSql: string, maxLimit: number): { sql: string; overridden: boolean } {
  let finalSql = rawSql.trim().replace(/;$/, '')
  const limitMatch = finalSql.match(/LIMIT\s+(\d+)/i)
  let overridden = false
  if (limitMatch) {
    if (parseInt(limitMatch[1]) > maxLimit) {
      finalSql = finalSql.replace(/LIMIT\s+\d+/i, `LIMIT ${maxLimit}`)
      overridden = true
    }
  } else {
    finalSql += ` LIMIT ${maxLimit}`
  }
  return { sql: finalSql, overridden }
}

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const prompt: string = body.prompt
  const contextData = body.contextData

  if (!prompt) {
    throw createError({ statusCode: 400, statusMessage: 'Prompt is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured' })
  }

  const eventStream = createEventStream(event)

  ;(async () => {
    const startTime = Date.now()
    const elapsed = () => Date.now() - startTime
    // createEventStream.push() adds "data: ...\n\n" automatically — do NOT add prefix manually
    const send = async (data: object) => {
      await eventStream.push(JSON.stringify(data))
    }

    try {
      const db = await useDb()

      let maxLimit = DEFAULT_MAX_RESULTS_LIMIT
      let customHints = ''
      let agenticModelName = DEFAULT_AGENTIC_MODEL
      try {
        const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1)
        if (settings[0]?.maxResultsLimit) maxLimit = settings[0].maxResultsLimit
        customHints = settings[0]?.customHints || ''
        if (settings[0]?.agenticModel) agenticModelName = settings[0].agenticModel
      } catch { /* ใช้ default */ }

      let systemInstruction = DEFAULT_AGENTIC_SYSTEM_PROMPT.replace('{MAX_LIMIT}', maxLimit.toString())
      if (customHints.trim()) {
        systemInstruction += `\n\n## Business Rules & Custom Hints\n${customHints.trim()}`
      }

      let finalPrompt = prompt
      if (Array.isArray(contextData) && contextData.length > 0) {
        const dataSample = contextData.slice(0, 200)
        finalPrompt = `[ข้อมูลประกอบจากไฟล์]\nจำนวนทั้งหมด: ${contextData.length} แถว\nตัวอย่าง: ${JSON.stringify(dataSample, null, 2)}\n\n[คำถาม]\n${prompt}`
      }

      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: agenticModelName,
        systemInstruction
      })

      const chat = model.startChat({ tools: [{ functionDeclarations: TOOL_DECLARATIONS }] })
      let chatResult = await chat.sendMessage(finalPrompt)
      let iteration = 0

      // Agentic loop — stream แต่ละ tool call
      while (iteration < MAX_ITERATIONS) {
        const candidate = chatResult.response.candidates?.[0]
        if (!candidate) break

        const parts = candidate.content.parts
        const fnCalls = parts.filter((p: any) => p.functionCall)
        if (!fnCalls.length) break

        const toolResponses: any[] = []
        for (const part of fnCalls) {
          const { name, args } = part.functionCall
          const stepStart = Date.now()

          await send({ type: 'step_start', tool: name, args: args ?? {}, elapsed: elapsed() })

          const toolResult = await dispatchTool(name, args ?? {}, session.role ?? 'user')

          await send({ type: 'step_done', tool: name, stepElapsed: Date.now() - stepStart, elapsed: elapsed() })

          toolResponses.push({
            functionResponse: {
              name,
              response: { result: toolResult }
            }
          })
        }

        chatResult = await chat.sendMessage(toolResponses)
        iteration++
      }

      // ถ้าถึง MAX_ITERATIONS และ AI ยังมี pending function calls → ส่ง dummy responses บังคับให้สร้าง SQL
      if (iteration >= MAX_ITERATIONS) {
        const lastParts = chatResult.response.candidates?.[0]?.content.parts ?? []
        const pendingFnCalls = lastParts.filter((p: any) => p.functionCall)
        if (pendingFnCalls.length > 0) {
          const dummyResponses = pendingFnCalls.map((p: any) => ({
            functionResponse: {
              name: p.functionCall.name,
              response: { result: { note: 'Tool call limit reached. Generate SQL from information gathered so far.' } }
            }
          }))
          chatResult = await chat.sendMessage(dummyResponses)
        }
      }

      // ตรวจสอบว่า response ยังเป็น function call หรือ text ว่าง → force final JSON output
      {
        const finalParts = chatResult.response.candidates?.[0]?.content?.parts ?? []
        const stillHasFnCalls = finalParts.some((p: any) => p.functionCall)
        const rawText = chatResult.response.text?.() ?? ''
        if (stillHasFnCalls || !rawText.trim()) {
          console.warn('[Stream] Response is empty or still has function calls after loop — forcing final JSON prompt')
          chatResult = await chat.sendMessage(
            'Stop using tools. Based on all information gathered so far, generate the final SQL query immediately as a JSON object with exactly these keys: "status", "sql", "explanation". Output only pure JSON with no markdown or code blocks.'
          )
        }
      }

      // แจ้งว่ากำลังสร้าง SQL
      await send({ type: 'generating', elapsed: elapsed() })

      // Parse JSON response
      const responseText = cleanJson(chatResult.response.text())
      let jsonResult: any
      try {
        jsonResult = JSON.parse(responseText)
      } catch {
        const finishReason = chatResult.response.candidates?.[0]?.finishReason ?? 'unknown'
        console.error('[Stream] JSON parse failed. finishReason:', finishReason, 'raw:', responseText.substring(0, 500))
        throw new Error(`AI returned invalid JSON. Raw: ${responseText.substring(0, 200)}`)
      }

      // กรณีขอ clarification
      if (jsonResult.status === 'clarification_needed') {
        await send({ type: 'clarification', explanation: jsonResult.explanation, elapsed: elapsed() })
        await eventStream.close()
        return
      }

      // Security + Limit enforcement
      const secureSql = enforceSecurity(jsonResult.sql || '')
      const { sql: finalSql, overridden: limitOverridden } = enforceLimit(secureSql, maxLimit)

      await send({
        type: 'sql_ready',
        sql: finalSql,
        explanation: jsonResult.explanation,
        limitOverridden,
        elapsed: elapsed()
      })

      // Validate ด้วย EXPLAIN — เร็วกว่า COUNT(*) มาก (ไม่ scan ข้อมูลจริง)
      const validateStart = Date.now()
      await send({ type: 'validating', elapsed: elapsed() })

      let validateOk = false
      let validateError: string | null = null

      try {
        await db.execute(sql.raw(`EXPLAIN ${finalSql.replace(/;$/, '')}`))
        validateOk = true
      } catch (err: any) {
        validateError = err.message || 'Validation failed'
      }

      await send({
        type: 'validated',
        ok: validateOk,
        error: validateError,
        stepElapsed: Date.now() - validateStart,
        elapsed: elapsed()
      })

      // Done
      await send({
        type: 'done',
        sql: finalSql,
        explanation: jsonResult.explanation,
        maxResultsLimit: maxLimit,
        limitOverridden,
        totalElapsed: elapsed()
      })

    } catch (err: any) {
      console.error('[Stream] Error:', err)
      await send({ type: 'error', message: err.message || 'Generation failed' })
    }

    await eventStream.close()
  })()

  return eventStream.send()
})
