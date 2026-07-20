import { useDb } from './db'
import { aiTokenUsage } from './schema'

interface TokenUsageParams {
  endpoint: string
  modelUsed: string
  userId?: string
  tokensIn: number
  tokensOut: number
  iterations?: number
  durationMs?: number
}

// Fire-and-forget — ไม่ block response หลัก ไม่ propagate error
export function logTokenUsage(params: TokenUsageParams): void {
  const values = {
    endpoint: params.endpoint,
    modelUsed: params.modelUsed ?? 'unknown',
    userId: params.userId,
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    totalTokens: params.tokensIn + params.tokensOut,
    iterations: params.iterations ?? 1,
    durationMs: params.durationMs,
  }

  useDb()
    .then(db => db.insert(aiTokenUsage).values(values))
    .catch((err) => {
      console.error('[TokenLogger] Failed to log token usage:', err?.message ?? err)
      console.error('[TokenLogger] Params:', JSON.stringify({ ...values, userId: '***' }))
    })
}
