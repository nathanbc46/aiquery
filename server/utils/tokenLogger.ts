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
  useDb()
    .then(db => db.insert(aiTokenUsage).values({
      endpoint: params.endpoint,
      modelUsed: params.modelUsed,
      userId: params.userId,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      totalTokens: params.tokensIn + params.tokensOut,
      iterations: params.iterations ?? 1,
      durationMs: params.durationMs,
    }))
    .catch(() => { /* silent fail */ })
}
