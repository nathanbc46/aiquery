import { useDb } from '../../utils/db'
import { aiTokenUsage } from '../../utils/schema'
import { requireAuthRole } from '../../utils/auth'
import { desc, gte, sql } from 'drizzle-orm'
import { THB_PER_USD } from '../../utils/constants'

export const MODEL_COST: Record<string, { inPer1M: number; outPer1M: number }> = {
  'gemini-2.5-pro':        { inPer1M: 1.25,   outPer1M: 10.00 },
  'gemini-2.5-flash':      { inPer1M: 0.30,   outPer1M: 2.50  },
  'gemini-2.5-flash-lite': { inPer1M: 0.10,   outPer1M: 0.40  },
  'gemini-2.0-flash':      { inPer1M: 0.10,   outPer1M: 0.40  },
  'gemini-1.5-flash':      { inPer1M: 0.075,  outPer1M: 0.30  },
  'gemini-1.5-flash-8b':   { inPer1M: 0.0375, outPer1M: 0.15  },
}

function estimateCostTHB(model: string, tokensIn: number, tokensOut: number): number {
  const key = Object.keys(MODEL_COST).find(k => (model || '').toLowerCase().includes(k)) ?? 'gemini-2.5-flash'
  const p = MODEL_COST[key]!
  return ((tokensIn * p.inPer1M + tokensOut * p.outPer1M) / 1_000_000) * THB_PER_USD
}

const ENDPOINT_LABELS: Record<string, string> = {
  generate:  'สร้าง SQL (Standard)',
  agentic:   'สร้าง SQL (Agentic)',
  stream:    'สร้าง SQL (Stream)',
  refine:    'ขัดเกลาคำถาม',
  'chat-sql':'Chat SQL',
  'fix-sql': 'แก้ไข SQL',
  analyze:   'วิเคราะห์ข้อมูล',
  optimize:  'ปรับปรุง SQL',
  explain:   'อธิบาย SQL',
}

export default defineEventHandler(async (event) => {
  await requireAuthRole(event, ['admin'])

  const query = getQuery(event)
  const days = Math.min(parseInt(String(query.days || '30')), 365)

  const db = await useDb()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await db
    .select()
    .from(aiTokenUsage)
    .where(gte(aiTokenUsage.createdAt, since))
    .orderBy(desc(aiTokenUsage.createdAt))
    .limit(1000)

  // Summary totals
  let totalCalls = 0
  let totalTokensIn = 0
  let totalTokensOut = 0
  let totalCostTHB = 0

  // Group by endpoint
  const byEndpointMap: Record<string, { calls: number; tokensIn: number; tokensOut: number; costTHB: number }> = {}

  for (const r of rows) {
    const tIn = r.tokensIn ?? 0
    const tOut = r.tokensOut ?? 0
    const cost = estimateCostTHB(r.modelUsed ?? '', tIn, tOut)

    totalCalls++
    totalTokensIn += tIn
    totalTokensOut += tOut
    totalCostTHB += cost

    const ep = r.endpoint
    if (!byEndpointMap[ep]) byEndpointMap[ep] = { calls: 0, tokensIn: 0, tokensOut: 0, costTHB: 0 }
    byEndpointMap[ep].calls++
    byEndpointMap[ep].tokensIn += tIn
    byEndpointMap[ep].tokensOut += tOut
    byEndpointMap[ep].costTHB += cost
  }

  const byEndpoint = Object.entries(byEndpointMap).map(([endpoint, data]) => ({
    endpoint,
    label: ENDPOINT_LABELS[endpoint] ?? endpoint,
    ...data,
    costTHB: parseFloat(data.costTHB.toFixed(4)),
  })).sort((a, b) => b.calls - a.calls)

  const recent = rows.slice(0, 100).map(r => ({
    id: r.id,
    endpoint: r.endpoint,
    label: ENDPOINT_LABELS[r.endpoint] ?? r.endpoint,
    modelUsed: r.modelUsed,
    tokensIn: r.tokensIn ?? 0,
    tokensOut: r.tokensOut ?? 0,
    totalTokens: r.totalTokens ?? 0,
    iterations: r.iterations ?? 1,
    durationMs: r.durationMs,
    costTHB: parseFloat(estimateCostTHB(r.modelUsed ?? '', r.tokensIn ?? 0, r.tokensOut ?? 0).toFixed(4)),
    createdAt: r.createdAt,
  }))

  const modelPricing = Object.entries(MODEL_COST).map(([name, p]) => ({
    name,
    inUSD: p.inPer1M,
    outUSD: p.outPer1M,
    inTHB: parseFloat((p.inPer1M * THB_PER_USD).toFixed(2)),
    outTHB: parseFloat((p.outPer1M * THB_PER_USD).toFixed(2)),
  }))

  return {
    days,
    summary: {
      totalCalls,
      totalTokensIn,
      totalTokensOut,
      totalTokens: totalTokensIn + totalTokensOut,
      totalCostTHB: parseFloat(totalCostTHB.toFixed(4)),
    },
    byEndpoint,
    recent,
    modelPricing,
    thbPerUsd: THB_PER_USD,
  }
})
