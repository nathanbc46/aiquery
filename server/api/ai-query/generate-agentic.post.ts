import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  DEFAULT_AGENTIC_SYSTEM_PROMPT,
  DEFAULT_AGENTIC_MODEL,
  DEFAULT_MAX_RESULTS_LIMIT,
  DEFAULT_GENERATE_INSTRUCTION
} from '../../utils/constants'
import { useDb } from '../../utils/db'
import { sql, eq } from 'drizzle-orm'
import { aiSettings } from '../../utils/schema'
import { getAuthSession } from '../../utils/auth'
import { TOOL_DECLARATIONS, dispatchTool } from '../../utils/schemaTools'
import { pruneSchema } from '../../utils/schemaPruning'
import { logTokenUsage } from '../../utils/tokenLogger'

const FORBIDDEN_KEYWORDS = ['UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'INSERT', 'EXEC']

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const prompt: string = body.prompt
  const contextData = body.contextData
  const isDebugMode: boolean = body.isDebugMode ?? false

  if (!prompt) {
    throw createError({ statusCode: 400, statusMessage: 'Prompt is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured' })
  }

  try {
    const db = await useDb()

    let maxLimit = DEFAULT_MAX_RESULTS_LIMIT
    let modelName = DEFAULT_AGENTIC_MODEL
    let customHints = ''
    let MAX_ITERATIONS = 8

    try {
      const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1)
      const config = settings[0]
      if (config) {
        maxLimit = config.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT
        modelName = config.agenticModel || DEFAULT_AGENTIC_MODEL
        customHints = config.customHints || ''
        if (config.agenticMaxIterations) MAX_ITERATIONS = config.agenticMaxIterations
      }
    } catch {
      // ใช้ default ถ้า settings ไม่สำเร็จ
    }

    let systemInstruction = DEFAULT_AGENTIC_SYSTEM_PROMPT.replace('{MAX_LIMIT}', maxLimit.toString())
    if (customHints.trim()) {
      systemInstruction += `\n\n## Business Rules & Custom Hints\n${customHints.trim()}`
    }

    // เพิ่ม context data จากไฟล์ที่ผู้ใช้อัปโหลด (เหมือน generate.post.ts)
    let finalPrompt = prompt
    if (Array.isArray(contextData) && contextData.length > 0) {
      const dataSample = contextData.slice(0, 200)
      finalPrompt = `[ข้อมูลประกอบจากไฟล์]\nจำนวนทั้งหมด: ${contextData.length} แถว\nตัวอย่าง: ${JSON.stringify(dataSample, null, 2)}\n\n[คำถาม]\n${prompt}`
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction
    })

    const chat = model.startChat({
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }]
    })

    const reasoningSteps: string[] = []
    let iteration = 0
    const agenticStartTime = Date.now()
    let chatResult = await chat.sendMessage(finalPrompt)

    // Agentic loop — ทำซ้ำจนกว่า AI จะตอบ text สุดท้าย หรือเกิน MAX_ITERATIONS
    while (iteration < MAX_ITERATIONS) {
      const candidate = chatResult.response.candidates?.[0]
      if (!candidate) break

      const parts = candidate.content.parts
      const fnCalls = parts.filter((p: any) => p.functionCall)

      if (!fnCalls.length) break // AI ตอบ text แล้ว — จบ loop

      // Execute tool calls และรวม responses
      const toolResponses: any[] = []
      for (const part of fnCalls) {
        const { name, args } = part.functionCall
        const toolResult = await dispatchTool(name, args ?? {}, session.role ?? 'user')

        if (isDebugMode) {
          reasoningSteps.push(`${name}(${JSON.stringify(args ?? {})})`)
        } else {
          reasoningSteps.push(name)
        }

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

    // ถ้าเกิน MAX_ITERATIONS → fallback เป็น hybrid static mode
    if (iteration >= MAX_ITERATIONS) {
      console.warn('[Agentic] MAX_ITERATIONS reached, falling back to hybrid static mode')
      return fallbackToStaticMode(prompt, contextData, maxLimit, session, db, isDebugMode)
    }

    // Parse JSON response จาก AI
    let responseText = chatResult.response.text().trim()
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim()
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim()
    }

    let jsonResult: any
    try {
      jsonResult = JSON.parse(responseText)
    } catch {
      throw new Error(`AI returned invalid JSON. Raw: ${responseText.substring(0, 200)}`)
    }

    // ถาม clarification
    if (jsonResult.status === 'clarification_needed') {
      return {
        success: true,
        status: 'clarification_needed',
        explanation: jsonResult.explanation,
        reasoningSteps,
        mode: 'agentic',
        iterationsUsed: iteration
      }
    }

    // Security check
    const sqlUpper = (jsonResult.sql || '').toUpperCase()
    for (const kw of FORBIDDEN_KEYWORDS) {
      if (new RegExp(`\\b${kw}\\b`).test(sqlUpper)) {
        throw new Error(`Security Violation: generated SQL contains forbidden keyword '${kw}'`)
      }
    }

    // Hard limit enforcement
    let finalSql = (jsonResult.sql || '').trim().replace(/;$/, '')
    const limitMatch = finalSql.match(/LIMIT\s+(\d+)/i)
    let limitOverridden = false

    if (limitMatch) {
      if (parseInt(limitMatch[1]) > maxLimit) {
        finalSql = finalSql.replace(/LIMIT\s+\d+/i, `LIMIT ${maxLimit}`)
        limitOverridden = true
      }
    } else {
      finalSql += ` LIMIT ${maxLimit}`
    }

    // Preview data
    const isAdminOrManager = session.role === 'admin' || session.role === 'manager'
    const previewLimit = isAdminOrManager ? 50 : 10
    const previewSql = finalSql.replace(/LIMIT\s+\d+$/i, '').replace(/;$/, '') + ` LIMIT ${previewLimit}`

    let previewData: any[] = []
    let previewCount = 0
    let dbError: string | null = null

    try {
      await db.execute(sql.raw('SET SESSION MAX_EXECUTION_TIME = 60000'))
      try {
        const countSql = `SELECT COUNT(*) as total FROM (${finalSql.replace(/;$/, '')}) as subq`
        const [countRes]: any = await db.execute(sql.raw(countSql))
        previewCount = countRes[0]?.total || 0

        const [rows]: any = await db.execute(sql.raw(previewSql))
        const rawRows: any[] = Array.isArray(rows[0]) ? rows[0] : rows

        previewData = rawRows.map(row => {
          if (isAdminOrManager) return row
          const masked: any = {}
          for (const key in row) masked[key] = maskSensitiveData(row[key])
          return masked
        })
      } finally {
        await db.execute(sql.raw('SET SESSION MAX_EXECUTION_TIME = 0'))
      }
    } catch (err: any) {
      dbError = err.message || 'Database execution failed'
    }

    const agenticUsage = chatResult.response.usageMetadata
    logTokenUsage({
      endpoint: 'agentic',
      modelUsed: modelName,
      userId: session.userId,
      tokensIn: agenticUsage?.promptTokenCount ?? 0,
      tokensOut: agenticUsage?.candidatesTokenCount ?? 0,
      iterations: iteration + 1,
      durationMs: Date.now() - agenticStartTime,
    })

    return {
      success: true,
      status: dbError ? 'error' : 'success',
      sql: finalSql,
      explanation: jsonResult.explanation,
      previewData,
      previewCount,
      maxResultsLimit: maxLimit,
      limitOverridden,
      dbError,
      reasoningSteps,
      mode: 'agentic',
      iterationsUsed: iteration,
      modelUsed: modelName
    }

  } catch (error: any) {
    console.error('[Agentic] Generation Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to generate SQL (agentic mode)'
    })
  }
})

// Fallback: ใช้ hybrid static schema เมื่อ agentic loop เกิน MAX_ITERATIONS
async function fallbackToStaticMode(
  prompt: string,
  contextData: any,
  maxLimit: number,
  session: any,
  db: any,
  isDebugMode: boolean
) {
  const apiKey = process.env.GEMINI_API_KEY!

  let instruction = DEFAULT_GENERATE_INSTRUCTION.replace('{MAX_LIMIT}', maxLimit.toString())
  const pruned = pruneSchema(instruction, prompt)
  instruction = pruned.finalInstruction

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction: instruction
  })

  let finalPrompt = prompt
  if (Array.isArray(contextData) && contextData.length > 0) {
    const dataSample = contextData.slice(0, 200)
    finalPrompt = `[ข้อมูลประกอบจากไฟล์]\nจำนวนทั้งหมด: ${contextData.length} แถว\nตัวอย่าง: ${JSON.stringify(dataSample, null, 2)}\n\n[คำถาม]\n${prompt}`
  }

  const result = await model.generateContent(finalPrompt)
  let responseText = result.response.text().trim()
  if (responseText.startsWith('```json')) responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim()
  else if (responseText.startsWith('```')) responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim()

  const jsonResult = JSON.parse(responseText)

  if (jsonResult.status === 'clarification_needed') {
    return { success: true, status: 'clarification_needed', explanation: jsonResult.explanation, mode: 'static-fallback', reasoningSteps: [] }
  }

  const sqlUpper = (jsonResult.sql || '').toUpperCase()
  const FORBIDDEN = ['UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'INSERT', 'EXEC']
  for (const kw of FORBIDDEN) {
    if (new RegExp(`\\b${kw}\\b`).test(sqlUpper)) throw new Error(`Security Violation: '${kw}'`)
  }

  let finalSql = (jsonResult.sql || '').trim().replace(/;$/, '')
  if (!finalSql.match(/LIMIT\s+\d+/i)) finalSql += ` LIMIT ${maxLimit}`

  return {
    success: true,
    status: 'success',
    sql: finalSql,
    explanation: jsonResult.explanation,
    previewData: [],
    previewCount: 0,
    maxResultsLimit: maxLimit,
    limitOverridden: false,
    reasoningSteps: ['(fallback: static hybrid mode — agentic loop exceeded max iterations)'],
    mode: 'static-fallback',
    iterationsUsed: MAX_ITERATIONS,
    modelUsed: 'gemini-2.0-flash'
  }
}

function maskSensitiveData(value: any): string {
  if (value === null || value === undefined) return '-'
  const str = String(value)
  if (str.length <= 3) return str + '***'
  if (str.length > 7) return str.substring(0, 3) + '****' + str.substring(str.length - 2)
  return str.substring(0, 3) + '****'
}
