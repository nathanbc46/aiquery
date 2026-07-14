/**
 * schemaTools.ts
 * Database exploration tools for Agentic Text-to-SQL mode.
 * AI calls these tools via Gemini Function Calling to discover schema at runtime.
 */

import { useDb } from './db'
import { sql } from 'drizzle-orm'
import {
  VALID_INDUSTRIES, VALID_PROVINCES, VALID_PRODUCT_CATEGORIES,
  VALID_ROLES, VALID_SALES_STAGES, VALID_ACCOUNT_TYPES
} from './constants'

// ─── Schema Cache (module-level singleton) ────────────────────────────────────

const schemaCache = new Map<string, { data: unknown; expiry: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 ชั่วโมง

function getCached<T>(key: string): T | null {
  const entry = schemaCache.get(key)
  if (!entry || Date.now() > entry.expiry) {
    schemaCache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache(key: string, data: unknown): void {
  schemaCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDbName(): string {
  const dbUrl = process.env.DATABASE_URL || ''
  // รูปแบบ: mysql://user:pass@host:port/dbname หรือ mysql://user:pass@host/dbname
  const match = dbUrl.match(/\/([^/?]+)(\?|$)/)
  return match?.[1] || 'vtigercrm'
}

function maskValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  const str = String(value)
  if (str.length <= 3) return str + '***'
  if (str.length > 7) return str.substring(0, 3) + '****' + str.substring(str.length - 2)
  return str.substring(0, 3) + '****'
}

// Module keyword map (reuse pattern from schemaPruning.ts)
const MODULE_KEYWORD_MAP = [
  { keywords: ['contact', 'ผู้ติดต่อ', 'รายชื่อผู้ติดต่อ'], tables: ['vtiger_contactdetails'] },
  { keywords: ['lead', 'ลีด', 'ผู้สนใจ', 'converted', 'แปลง'], tables: ['vtiger_leaddetails', 'vtiger_leadaddress', 'vtiger_leadscf', 'vtiger_campaignleadrel', 'app_converted'] },
  { keywords: ['potential', 'opportunity', 'โอกาสการขาย', 'ดีล', 'deal'], tables: ['vtiger_potential', 'vtiger_potentialscf', 'vtiger_contpotentialrel', 'app_potential_product'] },
  { keywords: ['campaign', 'แคมเปญ'], tables: ['vtiger_campaign', 'vtiger_campaignleadrel'] },
  { keywords: ['salesorder', 'sales order', 'ใบสั่งขาย', 'ยอดขาย', 'revenue', 'รายได้'], tables: ['vtiger_salesorder', 'vtiger_salesordercf', 'vtiger_inventoryproductrel'] },
  { keywords: ['quote', 'ใบเสนอราคา', 'เสนอราคา'], tables: ['vtiger_quotes', 'vtiger_inventoryproductrel'] },
  { keywords: ['product', 'สินค้า', 'ราคาขาย', 'หมวดหมู่สินค้า'], tables: ['vtiger_products', 'vtiger_productcategory', 'vtiger_inventoryproductrel'] },
  { keywords: ['asset', 'ทรัพย์สิน', 'serial', 'sn', 'หมดอายุ'], tables: ['vtiger_assets', 'vtiger_assetscf'] },
]

const CORE_TABLES = [
  'vtiger_crmentity', 'vtiger_users', 'vtiger_user2role',
  'vtiger_role', 'vtiger_account', 'vtiger_accountscf'
]

// ─── Tool 1: list_tables ──────────────────────────────────────────────────────

export async function listTables(moduleHint?: string): Promise<string[]> {
  const cacheKey = 'list_tables_all'
  let allTables = getCached<string[]>(cacheKey)

  if (!allTables) {
    const db = await useDb()
    const dbName = getDbName()
    const [rows]: any = await db.execute(
      sql.raw(`
        SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = '${dbName}'
          AND (TABLE_NAME LIKE 'vtiger_%' OR TABLE_NAME LIKE 'app_%')
        ORDER BY TABLE_NAME
      `)
    )
    allTables = (rows as any[]).map((r: any) => (r.TABLE_NAME as string).toLowerCase())
    setCache(cacheKey, allTables)
  }

  if (!moduleHint) return allTables

  // กรองตามคำใบ้ของ module
  const hint = moduleHint.toLowerCase()
  const matched = new Set<string>(CORE_TABLES.map(t => t.toLowerCase()))

  for (const mod of MODULE_KEYWORD_MAP) {
    if (mod.keywords.some(kw => hint.includes(kw.toLowerCase()))) {
      mod.tables.forEach(t => matched.add(t.toLowerCase()))
    }
  }

  return allTables.filter(t => matched.has(t))
}

// ─── Tool 2: describe_table ───────────────────────────────────────────────────

export async function describeTable(tableName: string): Promise<Array<{
  column: string; type: string; nullable: string; key: string; comment: string
}>> {
  // Sanitize: เฉพาะ a-z, 0-9, _ เท่านั้น
  const safe = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '')
  const cacheKey = `describe_${safe}`
  const cached = getCached<any[]>(cacheKey)
  if (cached) return cached

  // Whitelist: ตรวจว่าตารางนี้มีอยู่จริง
  const allowed = await listTables()
  if (!allowed.includes(safe)) {
    return [{ column: 'error', type: 'string', nullable: 'NO', key: '', comment: `Table '${safe}' not found in database` }]
  }

  const db = await useDb()
  const dbName = getDbName()
  const [rows]: any = await db.execute(
    sql.raw(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = '${safe}'
      ORDER BY ORDINAL_POSITION
    `)
  )

  const result = (rows as any[]).map((r: any) => ({
    column: r.COLUMN_NAME,
    type: r.COLUMN_TYPE,
    nullable: r.IS_NULLABLE,
    key: r.COLUMN_KEY,
    comment: r.COLUMN_COMMENT || ''
  }))

  setCache(cacheKey, result)
  return result
}

// ─── Tool 3: search_columns ───────────────────────────────────────────────────

export async function searchColumns(keyword: string): Promise<Array<{
  table: string; column: string; type: string
}>> {
  // Sanitize keyword — อนุญาตเฉพาะ alphanumeric, _, ภาษาไทย
  const safe = keyword.replace(/[^a-zA-Z0-9_ก-๙]/g, '').substring(0, 50)
  if (!safe) return []

  const db = await useDb()
  const dbName = getDbName()
  const [rows]: any = await db.execute(
    sql.raw(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = '${dbName}'
        AND (TABLE_NAME LIKE 'vtiger_%' OR TABLE_NAME LIKE 'app_%')
        AND COLUMN_NAME LIKE '%${safe}%'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
      LIMIT 20
    `)
  )

  return (rows as any[]).map((r: any) => ({
    table: r.TABLE_NAME,
    column: r.COLUMN_NAME,
    type: r.COLUMN_TYPE
  }))
}

// ─── Tool 4: list_picklist_values ─────────────────────────────────────────────

export async function listPicklistValues(fieldName: string): Promise<string[]> {
  const f = fieldName.toLowerCase()
  const parse = (raw: string) => raw.split("','").map(v => v.replace(/'/g, '').trim())

  if (f.includes('industry') || f.includes('อุตสาหกรรม')) return parse(VALID_INDUSTRIES)
  if (f.includes('province') || f.includes('จังหวัด')) return parse(VALID_PROVINCES)
  if (f.includes('product_category') || f.includes('category') || f.includes('หมวดหมู่')) return parse(VALID_PRODUCT_CATEGORIES)
  if (f.includes('role') || f.includes('ตำแหน่ง') || f.includes('ทีม')) return parse(VALID_ROLES)
  if (f.includes('sales_stage') || f.includes('stage') || f.includes('สถานะการขาย')) return parse(VALID_SALES_STAGES)
  if (f.includes('account_type') || f.includes('ประเภทลูกค้า')) return parse(VALID_ACCOUNT_TYPES)
  return []
}

// ─── Tool 5: sample_data ──────────────────────────────────────────────────────

export async function sampleData(
  tableName: string,
  limit: number = 3,
  userRole: string = 'user'
): Promise<Record<string, unknown>[]> {
  const safe = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '')
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 5)

  // Whitelist: ตรวจว่าตารางนี้มีอยู่จริง
  const allowed = await listTables()
  if (!allowed.includes(safe)) {
    return [{ error: `Table '${safe}' not found` }]
  }

  const db = await useDb()
  const [rows]: any = await db.execute(
    sql.raw(`SELECT * FROM \`${safe}\` LIMIT ${safeLimit}`)
  )

  const isAdminOrManager = userRole === 'admin' || userRole === 'manager'
  const dataRows: any[] = Array.isArray(rows[0]) ? rows[0] : rows

  return dataRows.map(row => {
    if (isAdminOrManager) return row
    const masked: Record<string, unknown> = {}
    for (const key in row) masked[key] = maskValue(row[key])
    return masked
  })
}

// ─── Gemini Function Declarations ─────────────────────────────────────────────

export const TOOL_DECLARATIONS = [
  {
    name: 'list_tables',
    description: 'List available database tables. Optionally filter by module hint. ALWAYS call this first before writing SQL to know which tables exist.',
    parameters: {
      type: 'object',
      properties: {
        module_hint: {
          type: 'string',
          description: 'Optional keyword to filter tables by module (e.g. "salesorder", "lead", "asset", "ยอดขาย", "ลีด")'
        }
      }
    }
  },
  {
    name: 'describe_table',
    description: 'Get all column definitions (name, type, nullable, key, comment) for a specific table. Call this before writing JOIN conditions to verify exact column names.',
    parameters: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'Exact table name (e.g. "vtiger_salesorder", "vtiger_account", "vtiger_crmentity")'
        }
      },
      required: ['table_name']
    }
  },
  {
    name: 'search_columns',
    description: 'Search for columns matching a keyword across all vtiger/app tables. Use when unsure which table contains a specific field.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Column name keyword to search for (e.g. "accountname", "amount", "status", "salesorderid")'
        }
      },
      required: ['keyword']
    }
  },
  {
    name: 'list_picklist_values',
    description: 'Get valid enum/picklist values for a specific field type. Use exact values from this list in WHERE clauses — never guess picklist values.',
    parameters: {
      type: 'object',
      properties: {
        field_name: {
          type: 'string',
          description: 'Field name or category (e.g. "industry", "province", "sales_stage", "account_type", "role", "product_category")'
        }
      },
      required: ['field_name']
    }
  },
  {
    name: 'sample_data',
    description: 'Get a few sample rows from a table to understand the actual data format and values. Use to verify field formats before writing WHERE conditions.',
    parameters: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'Table name to sample (e.g. "vtiger_account", "vtiger_salesorder")'
        },
        limit: {
          type: 'number',
          description: 'Number of rows to return (1-5, default 3)'
        }
      },
      required: ['table_name']
    }
  }
]

// ─── Tool Dispatcher ──────────────────────────────────────────────────────────

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  userRole: string = 'user'
): Promise<unknown> {
  switch (name) {
    case 'list_tables':
      return listTables(args.module_hint as string | undefined)
    case 'describe_table':
      return describeTable(args.table_name as string)
    case 'search_columns':
      return searchColumns(args.keyword as string)
    case 'list_picklist_values':
      return listPicklistValues(args.field_name as string)
    case 'sample_data':
      return sampleData(args.table_name as string, (args.limit as number) ?? 3, userRole)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}
