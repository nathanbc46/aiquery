<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
const route = useRoute()
import { format } from 'sql-formatter'
import ApexCharts from 'apexcharts'
import { 
  History, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download, 
  User, 
  Calendar, 
  TimerOff, 
  HardDrive,
  Infinity,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Bot,
  Sparkles,
  BarChart3,
  X,
  Maximize2,
  Minimize2,
  Volume2,
  Square,
  Send,
  ArrowDown,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  Code,
  Copy,
  RefreshCw,
  ArrowRight,
  Search,
  Filter,
  Trash2,
  Database,
  LayoutGrid,
  Pencil,
  Link
} from 'lucide-vue-next'

const requests  = ref<any[]>([])
const isLoading = ref(true)

// ─── Edit Zoho Link ─────────────────────────────────────────
const editZohoModal = ref(false)
const editZohoRequestId = ref('')
const editZohoLink = ref('')
const isSavingZohoLink = ref(false)

const editZohoShareLink = ref('')
const editZohoSharePassword = ref('')

const copyZohoShareInfo = (req: any) => {
  const lines = [`🔗 Link: ${req.zohoShareLink}`]
  if (req.zohoSharePassword) lines.push(`🔑 Password: ${req.zohoSharePassword}`)
  navigator.clipboard.writeText(lines.join('\n'))
  toast.success('คัดลอกแล้ว', 'คัดลอก Share Link และรหัสผ่านเรียบร้อย')
}

const openEditZoho = (req: any) => {
  editZohoRequestId.value = req.id
  editZohoLink.value = req.zohoLink || ''
  editZohoShareLink.value = req.zohoShareLink || ''
  editZohoSharePassword.value = req.zohoSharePassword || ''
  editZohoModal.value = true
}

const saveZohoLink = async () => {
  isSavingZohoLink.value = true
  try {
    await $fetch('/api/ai-query/update-zoho-link', {
      method: 'POST',
      body: {
        requestId: editZohoRequestId.value,
        zohoLink: editZohoLink.value,
        zohoShareLink: editZohoShareLink.value,
        zohoSharePassword: editZohoSharePassword.value
      }
    })
    const req = requests.value.find(r => r.id === editZohoRequestId.value)
    if (req) {
      req.zohoLink = editZohoLink.value || null
      req.zohoShareLink = editZohoShareLink.value || null
      req.zohoSharePassword = editZohoSharePassword.value || null
    }
    editZohoModal.value = false
    toast.success('บันทึกแล้ว', 'อัพเดต Zoho Link เรียบร้อย')
  } catch (e: any) {
    toast.error('ล้มเหลว', e.message || 'ไม่สามารถบันทึกได้')
  } finally {
    isSavingZohoLink.value = false
  }
}
const isLoadingMore = ref(false)
const systemStatus  = useState<any>('system-status')
const toast = useToast()
const searchQuery = ref('')
const isSearching = ref(false)
let searchTimeout: any = null

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('คัดลอกแล้ว', 'คัดลอกคำสั่ง SQL ลง Clipboard เรียบร้อย')
}

// Get User Role for Admin/Manager features
const { data: authData } = await useFetch<any>('/api/auth/me')
const user = computed(() => authData.value?.user || null)
const isAdmin = computed(() => user.value?.role === 'admin')

// SQL Expand Modal (for Admin/Manager)
const isSqlModalOpen = ref(false)
const activeSql = ref('')
const activeSqlExplanation = ref('')

// ─── Delete State ────────────────────────────────────────────
const deleteConfirmId = ref<string | null>(null)
const isDeleting = ref(false)

const confirmDelete = async () => {
  if (!deleteConfirmId.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/ai-query/${deleteConfirmId.value}`, { method: 'DELETE' })
    requests.value = requests.value.filter(r => r.id !== deleteConfirmId.value)
    pagination.value.total = Math.max(0, pagination.value.total - 1)
    toast.success('ลบสำเร็จ', 'ลบรายการและไฟล์ CSV เรียบร้อยแล้ว')
  } catch (e: any) {
    toast.error('ลบไม่สำเร็จ', e?.data?.statusMessage || 'ไม่สามารถลบรายการได้')
  } finally {
    isDeleting.value = false
    deleteConfirmId.value = null
  }
}

// ─── Renewal State ──────────────────────────────────────────
const renewRequestId = ref<string | null>(null)
const renewReason = ref('')
const isRenewing = ref(false)

const openRenewModal = (id: string) => {
  renewRequestId.value = id
  renewReason.value = ''
}

const submitRenewal = async () => {
  if (!renewRequestId.value || !renewReason.value.trim()) {
    toast.error('กรุณาระบุเหตุผล', 'โปรดระบุเหตุผลในการขอต่ออายุข้อมูล')
    return
  }

  const req = requests.value.find(r => r.id === renewRequestId.value)
  if (!req) return

  isRenewing.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/request', {
      method: 'POST',
      body: {
        queryText: req.query,
        generatedSql: req.sql,
        explanation: req.explanation,
        resultCount: req.resultCount,
        requestReason: renewReason.value.trim()
      }
    })

    if (response.success) {
      if (response.autoApproved) {
        toast.success('ต่ออายุอัตโนมัติสำเร็จ', 'เนื่องจากคุณมีสิทธิ์ Manager ระบบจึงต่ออายุและเตรียมข้อมูลให้ทันที!')
      } else {
        toast.success('ส่งคำขอต่ออายุสำเร็จ', 'ส่งคำขออนุมัติใหม่ไปยังหัวหน้างานเรียบร้อยแล้ว')
      }
      renewRequestId.value = null
      fetchHistory(1) // รีเฟรชรายการ
    } else {
      toast.error('เกิดข้อผิดพลาด', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('ส่งคำขอไม่สำเร็จ', 'ไม่สามารถส่งคำขอต่ออายุได้ในขณะนี้')
  } finally {
    isRenewing.value = false
  }
}

const openSqlModal = (sql: string, explanation: string) => {
  activeSql.value = sql
  activeSqlExplanation.value = explanation
  isSqlModalOpen.value = true
}

const formatSql = (sql: string) => {
  if (!sql) return ''
  try {
    return format(sql, {
      language: 'mysql',
      tabWidth: 2,
      useTabs: false,
      keywordCase: 'upper',
      dataTypeCase: 'upper',
      functionCase: 'upper',
      indentStyle: 'standard',
      logicalOperatorNewline: 'before',
      expressionWidth: 60,
    })
  } catch {
    return sql
  }
}

const highlightSql = (sql: string) => {
  if (!sql) return ''
  let result = formatSql(sql)

  result = result.replace(/'(.*?)'/g, '<span class="text-emerald-600 dark:text-emerald-400">\'$1\'</span>')

  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'LIMIT', 'AND', 'OR', 'IN', 'IS NULL', 'IS NOT NULL',
    'INSERT INTO', 'UPDATE', 'DELETE', 'VALUES', 'SET', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'AS', 'DISTINCT', 'HAVING', 'BETWEEN', 'LIKE', 'DESC', 'ASC'
  ]
  keywords.forEach(word => {
    const reg = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(reg, `<span class="text-blue-600 dark:text-blue-400 font-black">${word}</span>`)
  })

  result = result.replace(/(?<![\w\-\.])\b(\d+)\b/g, '<span class="text-amber-600 dark:text-amber-500">$1</span>')

  return result
}

const chartRegistry = new Map<string, object>()

const hashStr = (str: string): string => {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// Markdown Helper
const renderMarkdown = (text: string) => {
  if (!text) return ''

  // Extract chart blocks ก่อน HTML escaping เพื่อกันไม่ให้ < > ถูก escape
  // ใช้ text placeholder ชั่วคราว แล้วค่อย restore เป็น HTML หลัง escaping
  const chartEntries: { id: string }[] = []
  let html = text.replace(/```chart\n([\s\S]*?)\n```/gim, (_, json) => {
    try {
      const config = JSON.parse(json)
      const id = `chart-${hashStr(json)}`
      chartRegistry.set(id, config)
      chartEntries.push({ id })
      return `__CHART_BLOCK_${chartEntries.length - 1}__`
    } catch {
      return ''
    }
  })

  html = html
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") // Escape HTML
    .replace(/^### (.*$)/gim, '<h3 class="text-[13px] font-black text-indigo-900 dark:text-indigo-300 mt-5 mb-2 uppercase tracking-wide">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-sm font-black text-indigo-900 dark:text-indigo-300 mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-base font-black text-indigo-900 dark:text-indigo-300 mt-5 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-black text-slate-900 dark:text-white">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em class="italic text-slate-600 dark:text-slate-400">$1</em>')
    .replace(/^\s*\*\s+(.*)$/gim, '<li class="ml-5 list-disc py-0.5">$1</li>')
    .replace(/^\s*-\s+(.*)$/gim, '<li class="ml-5 list-disc py-0.5">$1</li>')
    .replace(/`(.*?)`/gim, '<code class="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800/50 rounded-md text-indigo-600 dark:text-indigo-300 text-[11px] font-mono">$1</code>')
  
  // Table Support
  html = html.replace(/((?:\|[^\n]+\|(?:\n|$)){2,})/gim, (match) => {
    const rows = match.trim().split('\n').filter(r => r.trim() !== '')
    if (rows.length < 2) return match // Not a valid table

    const tableRows = rows.map((row, index) => {
      // Split by | and remove empty strings from ends
      const cells = row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1)
      
      // Check if this is a separator row (|---|---|)
      if (index === 1 && cells.every(c => c.trim().match(/^:?-+:?$/))) return ''
      
      const tag = index === 0 ? 'th' : 'td'
      const cellStyle = tag === 'th' 
        ? 'px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black uppercase tracking-wider text-[10px] border border-slate-200 dark:border-slate-700 text-left'
        : 'px-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
      
      const renderedCells = cells.map(c => `<${tag} class="${cellStyle}">${c.trim()}</${tag}>`).join('')
      const rowStyle = index === 0 ? '' : (index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/50 dark:bg-slate-900/30')
      
      return `<tr class="${rowStyle}">${renderedCells}</tr>`
    }).filter(r => r !== '').join('')

    return `<div class="overflow-x-auto my-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"><table class="w-full text-[11px] border-collapse min-w-full">${tableRows}</table></div>`
  })

  html = html.replace(/\n/gim, '<br/>')

  html = html.replace(/(<li.*?>.*?<\/li><br\/>)+/gim, '<ul class="my-3 space-y-1">$&</ul>')
  html = html.replace(/<\/li><br\/>/gim, '</li>')
  html = html.replace(/(<br\/>){3,}/gim, '<br/><br/>')
  html = html.replace(/<br\/>(<ul|<h1|<h2|<h3)/gim, '$1')

  // Restore chart placeholders เป็น HTML จริงหลัง escaping เสร็จแล้ว
  chartEntries.forEach(({ id }, index) => {
    html = html.replace(
      `__CHART_BLOCK_${index}__`,
      `<div class="apex-chart-placeholder my-6" data-chart-id="${id}" style="min-height:300px"></div>`
    )
  })

  return html
}

const normalizeSeries = (config: any, isPie: boolean) => {
  const raw = config.series
  const arr = Array.isArray(raw) ? raw : (raw != null ? [raw] : [])

  if (isPie) {
    const result = arr.map((item: any) => {
      if (typeof item === 'number') return item
      if (typeof item === 'object' && item !== null)
        return Number(item.value ?? item.y ?? item.data?.[0] ?? 0)
      return Number(item) || 0
    })
    return result.length ? result : [1]
  }

  // bar / line / area — ต้องการ [{ name, data: number[] }]
  const result = arr.map((item: any, i: number) => {
    if (typeof item === 'object' && item !== null) {
      // ตรวจสอบให้ data เป็น array เสมอ
      const data = Array.isArray(item.data)
        ? item.data.map((d: any) => (typeof d === 'object' ? d : Number(d)))
        : []
      return { name: item.name || `ชุดที่ ${i + 1}`, data }
    }
    return { name: `ชุดที่ ${i + 1}`, data: [Number(item) || 0] }
  })
  return result.length ? result : [{ name: 'ข้อมูล', data: [] }]
}

const buildApexOptions = (config: any) => {
  const isPie = config.type === 'pie' || config.type === 'donut'
  const isDark = document.documentElement.classList.contains('dark')

  const options: any = {
    chart: {
      type: config.type || 'bar',
      height: 320,
      toolbar: { show: false },
      fontFamily: 'Outfit, sans-serif',
      background: 'transparent'
    },
    theme: { mode: isDark ? 'dark' : 'light' },
    title: { text: config.title || '', style: { fontSize: '13px', fontWeight: '700' } },
    series: normalizeSeries(config, isPie),
    colors: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#f97316'],
    dataLabels: { enabled: true },
    legend: { position: 'bottom' },
    tooltip: { theme: isDark ? 'dark' : 'light' }
  }

  // เพิ่มเฉพาะ property ที่จำเป็น ไม่ส่ง undefined ให้ ApexCharts
  if (isPie) {
    options.labels = Array.isArray(config.labels) ? config.labels : []
  } else {
    options.xaxis = { categories: Array.isArray(config.categories) ? config.categories : [] }
  }

  return options
}

const renderApexCharts = async () => {
  await nextTick()
  const placeholders = document.querySelectorAll('.apex-chart-placeholder[data-chart-id]')
  placeholders.forEach(el => {
    const id = el.getAttribute('data-chart-id')!
    if (!id || el.children.length > 0) return
    const config = chartRegistry.get(id) as any
    if (!config) return
    const options = buildApexOptions(config)
    const chart = new ApexCharts(el as HTMLElement, options)
    chart.render().catch((err: any) => console.error('ApexCharts render error', id, err))
  })
}

// Pagination state
const pagination = ref({ page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false })

// Toggle เหตุผลในแต่ละ card (เก็บ id ที่เปิดอยู่)
const openReasonIds  = ref<Set<string>>(new Set())
const openCommentIds = ref<Set<string>>(new Set())

const toggleReason = (id: string) => {
  const next = new Set(openReasonIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openReasonIds.value = next
}

const toggleComment = (id: string) => {
  const next = new Set(openCommentIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openCommentIds.value = next
}

const fetchHistory = async (page = 1) => {
  if (page === 1) {
    if (requests.value.length === 0) isLoading.value = true
    else isSearching.value = true
  } else {
    isLoadingMore.value = true
  }

  try {
    const q = searchQuery.value.trim()
    const response = await $fetch<any>(`/api/ai-query/history?page=${page}&limit=10&search=${encodeURIComponent(q)}`)
    if (response.success) {
      if (page === 1) {
        // โหลดหน้าแรก: replace ข้อมูล
        requests.value = response.requests
      } else {
        // โหลดหน้าถัดไป: append ต่อท้าย ไม่ replace
        requests.value = [...requests.value, ...response.requests]
      }
      pagination.value = response.pagination
    }
  } catch (e) {
    console.error(e)
    toast.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงประวัติการขอข้อมูลได้')
  } finally {
    isLoading.value     = false
    isSearching.value   = false
    isLoadingMore.value = false
  }
}

// Watch search with debounce
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => fetchHistory(1), 500)
})

// ล้างช่องค้นหาและ fetch ทันที (ป้องกัน watch debounce ทำให้โหลด 2 ครั้ง)
const clearSearch = () => {
  searchQuery.value = ''
  fetchHistory(1)
  nextTick(() => clearTimeout(searchTimeout))
}

const loadMore = () => {
  fetchHistory(pagination.value.page + 1)
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'APPROVED': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    case 'REJECTED': return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
    case 'PENDING':  return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    default:         return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'APPROVED': return 'อนุมัติแล้ว'
    case 'REJECTED': return 'ปฏิเสธ'
    case 'PENDING':  return 'รออนุมัติ'
    default:         return status
  }
}

const downloadCsv = async (id: string) => {
  try {
    toast.info('กำลังเตรียมไฟล์', 'ระบบกำลังดึงข้อมูลและสร้างไฟล์ CSV...')
    
    const response = await fetch(`/api/ai-query/export?id=${id}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.statusMessage || 'ดาวน์โหลดไม่สำเร็จ')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const fileId = id.split('-')[0] || 'FILE'
    a.download = `vtiger_export_${fileId.toUpperCase()}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    toast.success('ดาวน์โหลดสำเร็จ', 'ไฟล์ข้อมูลถูกบันทึกลงเครื่องเรียบร้อย')
    
    // อัปเดตจำนวนดาวน์โหลดใน UI ทันที (Optional: ถ้ามีการแสดงผล)
    const req = requests.value.find(r => r.id === id)
    if (req) req.downloadCount = (req.downloadCount || 0) + 1
    
  } catch (e: any) {
    console.error('Download error:', e)
    toast.error('ดาวน์โหลดล้มเหลว', e.message || 'ไม่สามารถดาวน์โหลดไฟล์ได้')
  }
}

// ─── AI Analyze ───────────────────────────────────────────
// เก็บสถานะ + ผลสรุป ต่อ requestId
const analyzeState = ref<Record<string, { loading: boolean; summary: string | null; error: string | null }>>({})

const analyzeData = async (id: string) => {
  if (!analyzeState.value[id]) {
    analyzeState.value[id] = { loading: false, summary: null, error: null }
  }
  analyzeState.value[id].loading = true
  analyzeState.value[id].error   = null
  try {
    const res = await $fetch<any>('/api/ai-query/analyze', {
      method: 'POST',
      body: { requestId: id }
    })
    analyzeState.value[id].summary = res.summary
  } catch (e: any) {
    analyzeState.value[id].error = e?.data?.message || 'ไม่สามารถวิเคราะห์ข้อมูลได้'
  } finally {
    analyzeState.value[id].loading = false
  }
}

// ─── AI Chat ──────────────────────────────────────────────
// เก็บ chat session แยกต่อ requestId
interface ChatMsg { role: 'user' | 'ai'; content: string }
const chatState = ref<Record<string, { open: boolean; messages: ChatMsg[]; input: string; loading: boolean; abortController?: AbortController | null }>>({})
const chatScrollRefs = ref<Record<string, HTMLElement | null>>({})
const chatInput = ref<HTMLTextAreaElement | null>(null)
const showScrollButton = ref(false)

const handleChatScroll = (e: Event) => {
  const el = e.target as HTMLElement
  // Show button if we are more than 100px from bottom
  showScrollButton.value = el.scrollHeight - el.scrollTop - el.clientHeight > 100
}

const scrollToBottom = (id: string) => {
  const el = chatScrollRefs.value[id]
  if (el) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
}

const openChat = (id: string) => {
  openModal(id, 'chat')
}

const clearChatHistory = (id: string) => {
  if (chatState.value[id]) {
    // ตัดการเชื่อมต่อทันทีถ้ามี Request ค้างอยู่
    if (chatState.value[id].abortController) {
      chatState.value[id].abortController.abort()
    }
    chatState.value[id].messages = []
    chatState.value[id].loading = false
    chatState.value[id].abortController = null
  }
}

const stopChat = (id: string) => {
  if (chatState.value[id] && chatState.value[id].abortController) {
    chatState.value[id].abortController.abort()
    chatState.value[id].loading = false
    chatState.value[id].abortController = null
    chatState.value[id].messages.push({ role: 'ai', content: '⚠️ ยกเลิกการประมวลผลโดยผู้ใช้' })
  }
}

const sendChat = async (id: string) => {
  const state = chatState.value[id]
  if (!state || !state.input.trim() || state.loading) return

  const userMsg = state.input.trim()
  state.messages.push({ role: 'user', content: userMsg })
  state.input   = ''
  state.loading = true

  await nextTick()
  const el = chatScrollRefs.value[id]
  if (el) el.scrollTop = el.scrollHeight

  try {
    // สร้าง AbortController ใหม่สำหรับการถามครั้งนี้
    const controller = new AbortController()
    state.abortController = controller

    // ส่ง messages history ยกเว้นข้อความล่าสุด (userMsg) ที่เพิ่งส่งไปแล้ว
    const history = state.messages.slice(0, -1).map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.content }))
    const res = await $fetch<any>('/api/ai-query/chat', {
      method: 'POST',
      body: { requestId: id, messages: history, userMessage: userMsg },
      signal: controller.signal // เชื่อมต่อสัญญาณการตัดการเชื่อมต่อ
    })
    state.messages.push({ role: 'ai', content: res.reply })
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.log('Chat request aborted')
      return // ไม่ต้องแสดง Error ถ้าเราเป็นคนสั่งหยุดเอง
    }
    state.messages.push({ role: 'ai', content: `❌ ${e?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}` })
  } finally {
    state.loading = false
    state.abortController = null
    await nextTick()
    const el2 = chatScrollRefs.value[id]
    if (el2) el2.scrollTop = el2.scrollHeight
  }
}

const handleQuickReply = (id: string, question: string) => {
  if (!chatState.value[id]) {
    chatState.value[id] = { open: true, messages: [], input: '', loading: false, abortController: null }
  }
  chatState.value[id].input = question
  sendChat(id)
}

// ─── Text-to-Speech (TTS) ──────────────────────────────────
const currentlyReadingId = ref<string | null>(null)
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

const toggleSpeak = (text: string, id: string) => {
  if (!synth) return
  
  if (synth.speaking && currentlyReadingId.value === id) {
    synth.cancel()
    currentlyReadingId.value = null
    return
  }

  if (synth.speaking) synth.cancel()

  // Clean markdown for better reading
  let cleanText = text
    .replace(/```chart\n([\s\S]*?)\n```/gim, 'มีกราฟแสดงผล')
    .replace(/```[\s\S]*?```/gim, 'มีข้อมูลตาราง')
    .replace(/#+\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/<br\/>/g, ' ')
    .replace(/<.*?>/g, '')

  const utterance = new SpeechSynthesisUtterance(cleanText)
  
  // Try to find a Thai voice
  const voices = synth.getVoices()
  const thaiVoice = voices.find(v => v.lang.includes('th'))
  if (thaiVoice) utterance.voice = thaiVoice
  
  utterance.onend = () => { currentlyReadingId.value = null }
  utterance.onerror = () => { currentlyReadingId.value = null }
  
  currentlyReadingId.value = id
  synth.speak(utterance)
}

const stopSpeak = () => {
  if (synth) {
    synth.cancel()
  }
  currentlyReadingId.value = null
}

const activeModalRequestId = ref<string | null>(null)
const activeModalTab = ref<'analyze' | 'chat'>('analyze')
const isModalFullscreen = ref(false)
const isReferenceExpanded = ref(true)
const activeRequestData = computed(() => requests.value.find(r => r.id === activeModalRequestId.value))

const openModal = (id: string, tab: 'analyze' | 'chat') => {
  // ถ้าเป็นการเปิดใหม่จากที่เคยปิดอยู่ ให้เริ่มที่แบบไม่เต็มจอ
  // แต่ถ้าเปิดค้างไว้อยู่แล้ว (เช่น สลับ Tab) ให้คงสถานะเดิมไว้
  if (!activeModalRequestId.value) {
    isModalFullscreen.value = false
  }
  
  activeModalRequestId.value = id
  activeModalTab.value = tab
  if (tab === 'chat') {
    if (!chatState.value[id]) {
      chatState.value[id] = { open: true, messages: [], input: '', loading: false, abortController: null }
    }
    // Auto focus when opening chat
    nextTick(() => {
      chatInput.value?.focus()
    })
  }
}

const switchTab = (tab: 'analyze' | 'chat') => {
  if (activeModalTab.value !== tab) {
    stopSpeak()
  }
  if (activeModalRequestId.value) {
    openModal(activeModalRequestId.value, tab)
  }
}

const closeModal = () => {
  stopSpeak()
  activeModalRequestId.value = null
  isModalFullscreen.value = false
}

const openAnalyze = (id: string) => {
  openModal(id, 'analyze')
  if (!analyzeState.value[id] || (!analyzeState.value[id].summary && !analyzeState.value[id].loading)) {
    analyzeData(id)
  }
}

onMounted(() => {
  // อ่าน ?search= จาก URL (เช่น มาจาก dashboard คลิก top requester)
  if (route.query.search) {
    searchQuery.value = String(route.query.search)
    // watcher จะตั้ง debounce ไว้ — ยกเลิกทันที แล้วเรียก fetchHistory ครั้งเดียว
    nextTick(() => clearTimeout(searchTimeout))
  }
  fetchHistory(1)

  // โหลดประวัติการวิเคราะห์และแชตจาก Offline (localStorage)
  const savedAnalyze = localStorage.getItem('aiquery_analyzeState')
  if (savedAnalyze) {
    try { analyzeState.value = JSON.parse(savedAnalyze) } catch (e) {}
  }
  const savedChat = localStorage.getItem('aiquery_chatState')
  if (savedChat) {
    try { chatState.value = JSON.parse(savedChat) } catch (e) {}
  }
})

// บันทึกการเปลี่ยนแปลงลง Offline
watch(analyzeState, (val) => {
  localStorage.setItem('aiquery_analyzeState', JSON.stringify(val))
  renderApexCharts()
}, { deep: true, flush: 'post' })

watch(chatState, (val) => {
  localStorage.setItem('aiquery_chatState', JSON.stringify(val))
  renderApexCharts()
}, { deep: true, flush: 'post' })

watch(activeModalTab, () => {
  renderApexCharts()
}, { flush: 'post' })

watch(activeModalRequestId, (val) => {
  if (val) renderApexCharts()
}, { flush: 'post' })

watch(isModalFullscreen, () => {
  renderApexCharts()
}, { flush: 'post' })
onUnmounted(() => {
  stopSpeak()
})
</script>

<template>
  <div class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="border-b border-slate-200 dark:border-slate-800 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-xs">
          <History class="w-4 h-4" />
          Request Logs
        </div>
        <h2 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">ประวัติการขอข้อมูล</h2>
        <p class="text-slate-500 dark:text-slate-400 text-lg">ตรวจสอบสถานะคำขอและดาวน์โหลดไฟล์ CSV เมื่อได้รับอนุมัติ</p>
      </div>
      <div class="flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <!-- Search Bar -->
        <div class="relative group">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
          <input
            v-model="searchQuery"
            @keyup.enter="fetchHistory(1)"
            type="text"
            placeholder="ค้นหาตามคำถาม หรือ ID..."
            class="pl-11 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors w-full md:w-80 shadow-sm outline-none"
            :class="searchQuery ? 'pr-9' : 'pr-4'"
          />
          <button
            v-if="searchQuery"
            type="button"
            @click="clearSearch"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Total count badge -->
        <div v-if="!isLoading" class="px-5 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:blue-300 rounded-2xl text-sm font-black border border-blue-100 dark:border-blue-800 flex items-center gap-2 shrink-0 shadow-sm shadow-blue-500/5">
          <History class="w-4 h-4" />
          {{ pagination.total }} รายการที่พบ
        </div>
      </div>
    </header>

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
      <div class="relative">
        <div class="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-800"></div>
        <div class="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin absolute top-0 left-0"></div>
      </div>
      <p class="text-slate-400 dark:text-slate-500 font-medium animate-pulse">กำลังโหลดประวัติ...</p>
    </div>

    <!-- DB Error State -->
    <div v-else-if="!isLoading && requests.length === 0 && systemStatus?.status === 'offline'" class="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/50 rounded-[2.5rem] p-16 text-center animate-in zoom-in-95 duration-500">
      <div class="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-rose-100 dark:bg-rose-900/40 mb-6 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <AlertCircle class="w-12 h-12" />
      </div>
      <h3 class="text-2xl font-bold text-rose-900 dark:text-rose-400">การเชื่อมต่อฐานข้อมูลล้มเหลว</h3>
      <p class="text-rose-700 dark:text-rose-300 mt-2 text-lg max-w-md mx-auto">ไม่สามารถดึงข้อมูลได้เนื่องจากระบบไม่สามารถเชื่อมต่อกับ MySQL ได้ กรุณาตรวจสอบไฟล์ .env หรือสถานะของ Database Server</p>
      <button @click="fetchHistory(1)" class="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/20 active:scale-95 group">
        <RotateCcw class="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
        ลองใหม่อีกครั้ง
      </button>
    </div>
    <!-- Empty State -->
    <div v-else-if="requests.length === 0 && !isSearching" class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-16 text-center shadow-xl shadow-slate-200/50 dark:shadow-none animate-in fade-in zoom-in-95 duration-500">
      <div class="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-slate-50 dark:bg-slate-950 mb-6 text-slate-300 dark:text-slate-700 border border-slate-100 dark:border-slate-800">
        <Clock class="w-12 h-12" />
      </div>
      <h3 class="text-2xl font-bold text-slate-900 dark:text-white">ไม่พบประวัติการขอข้อมูล</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2 text-lg">ลองเปลี่ยนคำค้นหาใหม่อีกครั้งครับ</p>
    </div>

    <!-- Request List Content -->
    <div v-else class="relative min-h-[300px]">
      <!-- Searching Overlay -->
      <transition name="fade">
        <div v-if="isSearching" class="absolute inset-0 z-20 flex items-center justify-center bg-white/20 dark:bg-slate-900/20 backdrop-blur-[2px] rounded-[2.5rem]">
           <div class="flex flex-col items-center gap-4 bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <div class="relative">
                <div class="w-12 h-12 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                <div class="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin absolute top-0 left-0"></div>
              </div>
              <div class="flex flex-col items-center gap-1">
                <span class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Searching</span>
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500">กำลังอัปเดตรายการ...</span>
              </div>
           </div>
        </div>
      </transition>

      <!-- Grid List -->
      <div :class="['grid gap-4 md:gap-6 transition-all duration-700 ease-in-out', isSearching ? 'opacity-30 blur-[4px] grayscale-[0.8] scale-[0.98]' : 'opacity-100 blur-0 grayscale-0 scale-100']">
        <div
          v-for="req in requests"
          :key="req.id"
          class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-blue-500/40 dark:hover:border-blue-400/40 transition-all group/card"
        >
        <div class="p-6 md:p-8">
          <!-- 1. Top Meta Bar (Ultra Compact) -->
          <div class="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/50">
            <div class="flex items-center gap-2 overflow-hidden">
              <div class="px-2 py-0.5 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest shrink-0">
                #{{ req.id.split('-')[0].toUpperCase() }}
              </div>
              <div class="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded text-[9px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800/50 shrink-0">
                <User class="w-3 h-3" />
                {{ req.ownerName }}
              </div>
              <div v-if="req.ownerName !== req.user" class="flex items-center gap-1 px-2 py-0.5 bg-slate-100/80 dark:bg-white/5 text-slate-400 dark:text-slate-500 rounded text-[9px] font-medium border border-slate-200 dark:border-white/10 shrink-0">
                ดึงข้อมูลโดย {{ req.user }}
              </div>
              <div class="hidden sm:flex items-center gap-1.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                <Calendar class="w-3 h-3" />
                {{ req.time }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5" :class="getStatusClass(req.status)">
                <CheckCircle v-if="req.status === 'APPROVED'" class="w-3 h-3" />
                <XCircle v-else-if="req.status === 'REJECTED'" class="w-3 h-3" />
                <Clock v-else class="w-3 h-3" />
                {{ getStatusLabel(req.status) }}
              </div>
              <button
                v-if="isAdmin"
                @click="deleteConfirmId = req.id"
                class="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-400 hover:text-rose-600 flex items-center justify-center transition-all shrink-0"
                title="ลบรายการนี้"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- 2. Main Content Row -->
          <div class="flex flex-col lg:flex-row gap-6 items-start">
            <!-- Left: Query & Meta Details -->
            <div class="flex-1 min-w-0 space-y-5">
              <h4 class="text-lg font-medium text-slate-700 dark:text-slate-300 leading-tight">"{{ req.query }}"</h4>
              
              <!-- Reason/Comment Buttons (Inline & Compact) -->
              <div class="flex flex-wrap gap-2">
                <button
                  v-if="req.requestReason"
                  @click="toggleReason(req.id)"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all active:scale-95"
                  :class="openReasonIds.has(req.id)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800 hover:bg-blue-50'"
                >
                  <MessageSquare class="w-3.5 h-3.5" />
                  เหตุผลในการขอ
                  <ChevronUp v-if="openReasonIds.has(req.id)" class="w-3.5 h-3.5" />
                  <ChevronDown v-else class="w-3.5 h-3.5" />
                </button>

                <button
                  v-if="req.managerComment"
                  @click="toggleComment(req.id)"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all active:scale-95"
                  :class="openCommentIds.has(req.id)
                    ? req.status === 'REJECTED' ? 'bg-rose-600 text-white border-rose-600' : 'bg-emerald-600 text-white border-emerald-600'
                    : req.status === 'REJECTED' ? 'bg-white dark:bg-slate-800 text-rose-600 border-rose-200' : 'bg-white dark:bg-slate-800 text-emerald-600 border-emerald-200 hover:bg-emerald-50/50'"
                >
                  <MessageSquare class="w-3.5 h-3.5" />
                  Manager Comment
                  <ChevronUp v-if="openCommentIds.has(req.id)" class="w-3.5 h-3.5" />
                  <ChevronDown v-else class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Collapsible Content -->
              <transition name="expand">
                <div v-if="openReasonIds.has(req.id)" class="p-4 bg-blue-50/40 dark:bg-blue-900/5 border border-blue-100 dark:border-blue-800/30 rounded-xl">
                  <p class="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1.5">วัตถุประสงค์ในการดึงข้อมูล</p>
                  <p class="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">{{ req.requestReason }}</p>
                </div>
              </transition>

              <transition name="expand">
                <div v-if="openCommentIds.has(req.id)" class="p-4 border rounded-xl" :class="req.status === 'REJECTED' ? 'bg-rose-50/40 border-rose-100' : 'bg-emerald-50/40 border-emerald-100'">
                  <p class="text-[9px] font-black uppercase tracking-widest mb-1.5" :class="req.status === 'REJECTED' ? 'text-rose-600' : 'text-emerald-600'">Comment จาก Manager</p>
                  <p class="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">{{ req.managerComment }}</p>
                </div>
              </transition>

              <div v-if="req.status === 'REJECTED' && req.reason" class="p-4 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-xl flex gap-3">
                <AlertCircle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p class="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest mb-1">เหตุผลที่ไม่อนุมัติ</p>
                  <p class="text-rose-600 dark:text-rose-300 text-xs font-medium">{{ req.reason }}</p>
                </div>
              </div>
            </div>

            <!-- Right: Action Bar (Compact) -->
            <div v-if="req.status === 'APPROVED'" class="w-full lg:w-60 shrink-0 space-y-3">
              <div v-if="req.isExpired" class="space-y-2">
                <div class="px-4 py-2 bg-slate-50 dark:bg-slate-800/30 text-slate-400 text-[11px] font-bold rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
                  <TimerOff class="w-3.5 h-3.5" /> ลิงก์หมดอายุแล้ว
                </div>
                <button @click="openRenewModal(req.id)" class="w-full px-4 py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-[11px] font-black uppercase tracking-widest rounded-xl border border-blue-200 transition-all flex items-center justify-center gap-2 shadow-sm">
                  <RefreshCw class="w-3.5 h-3.5" /> ขอต่ออายุ
                </button>
              </div>
              <!-- Zoho section (for Zoho exports) -->
              <div v-else-if="req.zohoLink || req.zohoShareLink || req.requestReason === 'Export to Zoho WorkDrive'" class="space-y-2">
                <!-- Admin: ลิ้งค์จริงของไฟล์ -->
                <div v-if="user?.role === 'admin'" class="bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-3 flex items-center gap-2">
                  <a v-if="req.zohoLink" :href="req.zohoLink" target="_blank" rel="noopener" class="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 transition-all active:scale-90 shrink-0">
                    <LayoutGrid class="w-4 h-4" />
                  </a>
                  <div v-else class="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <LayoutGrid class="w-4 h-4 text-slate-400" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">ไฟล์ใน WorkDrive</p>
                    <p class="text-[10px] text-slate-400 truncate">{{ req.zohoLink ? 'เปิดไฟล์ต้นฉบับ' : 'ยังไม่มีลิ้งค์' }}</p>
                  </div>
                  <button @click="openEditZoho(req)" class="w-7 h-7 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-400 hover:text-blue-600 flex items-center justify-center transition-all shrink-0" title="แก้ไข">
                    <Pencil class="w-3 h-3" />
                  </button>
                </div>

                <!-- ทุก role: Share Link + Password -->
                <div v-if="req.zohoShareLink" class="bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl p-3 space-y-2">
                  <div class="flex items-center gap-2">
                    <a :href="req.zohoShareLink" target="_blank" rel="noopener" class="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 transition-all active:scale-90 shrink-0">
                      <Link class="w-4 h-4" />
                    </a>
                    <div class="min-w-0 flex-1">
                      <p class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Share Link</p>
                      <p class="text-[10px] text-slate-400 truncate">{{ (req.resultCount || 0).toLocaleString() }} รายการ</p>
                    </div>
                    <button
                      @click="copyZohoShareInfo(req)"
                      class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-all shrink-0"
                      :title="req.zohoSharePassword ? 'คัดลอก Link + Password' : 'คัดลอก Link'"
                    >
                      <Copy class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div v-if="req.zohoSharePassword" class="flex items-center gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-1.5">
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Password</span>
                    <span class="text-xs font-mono text-slate-700 dark:text-white/70 select-all flex-1">{{ req.zohoSharePassword }}</span>
                  </div>
                </div>
                <div v-else-if="user?.role === 'admin'" class="bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] text-slate-400 text-center">
                  ยังไม่มี Share Link — กดแก้ไขเพื่อเพิ่ม
                </div>
              </div>
              <!-- CSV download -->
              <div v-else class="bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl p-3 flex items-center gap-3">
                <button @click="downloadCsv(req.id)" class="w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 transition-all active:scale-90 shrink-0">
                  <Download class="w-5 h-5" />
                </button>
                <div class="min-w-0 pr-1">
                  <p class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Download CSV</p>
                  <p class="text-xs font-bold text-slate-600 truncate">{{ (req.resultCount || 0).toLocaleString() }} รายการ</p>
                </div>
              </div>
              
              <!-- Expiry metadata -->
              <div class="flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-widest">
                <div class="flex items-center gap-1.5 text-slate-400">
                  <Clock class="w-3 h-3" />
                  <span v-if="req.expiresAt === null">ตลอดชีพ</span>
                  <span v-else>EXP: {{ new Date(req.expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) }}</span>
                </div>
                <div class="flex items-center gap-1.5 text-blue-500">
                  <HardDrive class="w-3 h-3" />
                  {{ req.downloadCount || 0 }} โหลด
                </div>
              </div>
            </div>
          </div>

          <!-- 3. AI Insights Box (Integrated) -->
          <div class="mt-6 bg-slate-50/50 dark:bg-slate-950/30 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 space-y-4">
            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <FileSpreadsheet class="w-4 h-4 text-blue-500" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1.5">
                  <p class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">AI Insight & Explanation</p>
                  <button
                    v-if="user?.role === 'admin' || user?.role === 'manager' || authData?.user?.role === 'admin' || authData?.user?.role === 'manager'"
                    @click="openSqlModal(req.sql, req.explanation)"
                    class="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-[9px] font-black uppercase tracking-widest rounded-md border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
                  >
                    <Code class="w-3 h-3 text-indigo-500" /> View SQL
                  </button>
                </div>
                <p class="text-slate-600 dark:text-slate-400 text-xs leading-relaxed line-clamp-2 hover:line-clamp-none transition-all cursor-help">{{ req.explanation }}</p>
              </div>
            </div>

            <!-- AI Action Buttons Row -->
            <div v-if="req.status === 'APPROVED'" class="pt-3 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <!-- Data Context Badge -->
                <div class="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-md border border-blue-100/50 dark:border-blue-800/50 shrink-0">
                  <Database class="w-3 h-3" />
                  จากข้อมูลชุดนี้
                </div>

                <div v-if="(req.resultCount || 0) > 5000" class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle class="w-3.5 h-3.5" />
                  <span class="text-[9px] font-bold uppercase tracking-tight">AI 5K LIMIT</span>
                </div>
              </div>

              <div class="flex gap-2">
                <button @click="openAnalyze(req.id)" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all active:scale-95 text-violet-700 border-violet-200 bg-violet-50 hover:bg-violet-100">
                  <Sparkles class="w-3.5 h-3.5" /> วิเคราะห์ด้วย AI
                </button>
                <button @click="openChat(req.id)" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all active:scale-95 text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100">
                  <Bot class="w-3.5 h-3.5" /> แชตถาม AI
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

        <!-- Pagination Footer -->
        <div class="flex flex-col items-center gap-4 py-4">
          <p class="text-sm text-slate-400 dark:text-slate-500 font-medium">
            แสดง <span class="font-black text-slate-700 dark:text-slate-300">{{ requests.length }}</span>
            จาก <span class="font-black text-slate-700 dark:text-slate-300">{{ pagination.total }}</span> รายการ
          </p>
          <button
            v-if="pagination.hasMore"
            @click="loadMore"
            :disabled="isLoadingMore"
            class="flex items-center gap-3 px-10 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-black rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="isLoadingMore" class="w-5 h-5 animate-spin" />
            <ChevronDown v-else class="w-5 h-5" />
            {{ isLoadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม' }}
          </button>
          <p v-else-if="requests.length > 0" class="text-xs text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest">
            แสดงครบทุกรายการแล้ว
          </p>
        </div>
      </div>
    </div>

    <ClientOnly>
    <Teleport to="body">
      <transition name="fade">
        <div v-if="activeModalRequestId" class="fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300" :class="isModalFullscreen ? 'p-0' : 'p-4'">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-900/60"></div>
          
          <!-- Modal Content -->
          <div 
            class="relative w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 transition-all duration-300 overflow-hidden"
            :class="isModalFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-5xl h-[85vh] rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)]'"
          >
            
            <!-- Header & Tabs -->
            <div class="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 rounded-t-[2rem] shrink-0 transition-all duration-300" :class="isReferenceExpanded ? 'px-6 pt-6' : 'px-4 pt-2'">
              
              <!-- Upper Header (Title & Controls) -->
              <transition name="expand">
                <div v-if="isReferenceExpanded" class="flex justify-between items-start mb-4 overflow-hidden">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                      <Sparkles class="w-5 h-5 text-violet-600 dark:text-violet-400" v-if="activeModalTab === 'analyze'" />
                      <Bot class="w-5 h-5 text-blue-600 dark:text-blue-400" v-else />
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-0.5">
                          <h3 class="font-black text-slate-900 dark:text-white text-lg">AI Assistant</h3>
                          <span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-black rounded-full uppercase tracking-widest">Beta</span>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"></span>
                          <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic line-clamp-1">
                            อ้างอิงจากข้อมูล: <span class="font-bold text-slate-800 dark:text-slate-200">"{{ activeRequestData?.query || 'ไม่ระบุ' }}"</span>
                          </p>
                        </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button @click="isReferenceExpanded = false" class="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 shadow-sm border border-slate-200 dark:border-slate-700" title="ซ่อนรายละเอียด">
                      <ChevronUp class="w-4 h-4" />
                    </button>
                    <button @click="isModalFullscreen = !isModalFullscreen" class="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 shadow-sm border border-slate-200 dark:border-slate-700">
                      <Minimize2 v-if="isModalFullscreen" class="w-5 h-5" />
                      <Maximize2 v-else class="w-5 h-5" />
                    </button>
                    <button @click="closeModal" class="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm border border-slate-200 dark:border-slate-700">
                      <X class="w-5 h-5 text-slate-500" />
                    </button>
                  </div>
                </div>
              </transition>
              
              <!-- Tabs row -->
              <div class="flex justify-between items-end gap-4">
                <div class="flex gap-2 md:gap-4 overflow-x-auto no-scrollbar shrink-0">
                  <button @click="switchTab('analyze')" class="px-4 md:px-6 py-3 font-bold text-xs md:text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap" :class="activeModalTab === 'analyze' ? 'border-violet-600 text-violet-700 dark:text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'">
                    <BarChart3 class="w-4 h-4" /> สรุปข้อมูล
                  </button>
                  <button @click="switchTab('chat')" class="px-4 md:px-6 py-3 font-bold text-xs md:text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap" :class="activeModalTab === 'chat' ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'">
                    <Bot class="w-4 h-4" /> แชตกับ AI
                  </button>
                </div>

                <!-- Compact Context Indicator (แสดงเฉพาะตอนซ่อนด้านบน) -->
                <div v-if="!isReferenceExpanded" class="flex-1 min-w-0 hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/50 dark:bg-slate-800/40 rounded-xl mb-2 group/ref cursor-help" :title="activeRequestData?.query">
                  <span class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">อ้างอิง:</span>
                  <p class="text-[10px] font-medium text-slate-500 dark:text-slate-400 italic truncate border-l border-slate-200 dark:border-slate-700 pl-2">
                    "{{ activeRequestData?.query }}"
                  </p>
                </div>
                
                <!-- Action Buttons & Compact Controls -->
                <div class="mb-2 flex items-center gap-2 shrink-0">
                  <!-- Analyze Actions -->
                  <div v-if="activeModalTab === 'analyze' && activeModalRequestId && analyzeState[activeModalRequestId]?.summary" class="hidden md:flex items-center gap-2">
                    <button 
                      @click="activeModalRequestId && toggleSpeak(analyzeState[activeModalRequestId]?.summary || '', 'summary-' + activeModalRequestId)" 
                      class="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-xl border border-slate-200/50 dark:border-slate-800/50 transition-all active:scale-95 shadow-sm"
                    >
                      <Volume2 v-if="currentlyReadingId !== 'summary-' + activeModalRequestId" class="w-3 h-3" />
                      <Square v-else class="w-3 h-3 fill-current text-blue-500" />
                      {{ currentlyReadingId === 'summary-' + activeModalRequestId ? 'หยุดอ่าน' : 'อ่าน' }}
                    </button>

                    <button 
                      @click="analyzeData(activeModalRequestId)" 
                      class="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-xl border border-slate-200/50 dark:border-slate-800/50 transition-all active:scale-95 shadow-sm"
                      :disabled="!activeModalRequestId || analyzeState[activeModalRequestId]?.loading"
                    >
                      <RotateCcw class="w-3 h-3" :class="{ 'animate-spin': analyzeState[activeModalRequestId!]?.loading }" />
                      วิเคราะห์ใหม่
                    </button>
                  </div>

                  <!-- Chat Actions -->
                  <div v-if="activeModalTab === 'chat' && activeModalRequestId && chatState[activeModalRequestId]?.messages?.length" class="hidden md:flex items-center gap-2">
                    <button 
                      @click="activeModalRequestId && clearChatHistory(activeModalRequestId)"
                      class="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-rose-50 dark:bg-slate-800 text-slate-600 dark:text-rose-400 text-[10px] font-bold rounded-xl border border-slate-200/50 dark:border-slate-800/50 transition-all active:scale-95 shadow-sm"
                    >
                      <Trash2 class="w-3 h-3 text-rose-500" />
                      เคลียร์ประวัติ
                    </button>
                  </div>

                  <!-- Controls when Compact -->
                  <div v-if="!isReferenceExpanded" class="flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                    <button @click="isReferenceExpanded = true" class="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-all" title="แสดงรายละเอียด">
                      <ChevronDown class="w-4 h-4" />
                    </button>
                    <button @click="isModalFullscreen = !isModalFullscreen" class="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-500">
                      <Minimize2 v-if="isModalFullscreen" class="w-4 h-4" />
                      <Maximize2 v-else class="w-4 h-4" />
                    </button>
                    <button @click="closeModal" class="p-1.5 bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-900/40 rounded-lg transition-all text-slate-500 hover:text-rose-600">
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Content Area -->
            <div class="flex-1 flex flex-col p-6 bg-white dark:bg-slate-900 rounded-b-[2rem] overflow-hidden">
              <div v-if="activeModalTab === 'analyze'" class="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-1">
                  <div v-if="!analyzeState[activeModalRequestId!]?.summary && !analyzeState[activeModalRequestId!]?.loading" class="flex justify-center py-10">
                     <button @click="analyzeData(activeModalRequestId!)" class="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-violet-500/25 active:scale-95">
                        <Sparkles class="w-4 h-4" />
                        เริ่มวิเคราะห์ข้อมูลด้วย AI
                     </button>
                  </div>
                 
                 <div v-if="analyzeState[activeModalRequestId!]?.error" class="p-5 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/50 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-medium">
                   ❌ {{ analyzeState[activeModalRequestId!]?.error }}
                 </div>
                 
                 <div v-else-if="analyzeState[activeModalRequestId!]?.summary" class="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium" v-html="renderMarkdown(analyzeState[activeModalRequestId!]?.summary || '')"></div>
                 
                 <div v-else-if="analyzeState[activeModalRequestId!]?.loading" class="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                   <Loader2 class="w-8 h-8 animate-spin text-violet-500" />
                   <p class="font-bold text-sm">กำลังวิเคราะห์ข้อมูล กรุณารอสักครู่...</p>
                 </div>
              </div>
              
              <div v-else-if="activeModalTab === 'chat'" class="flex-1 flex flex-col min-h-0">
                 <div class="relative flex-1 flex flex-col min-h-0 mb-4">
                    <div 
                      :ref="el => { chatScrollRefs[activeModalRequestId!] = el as HTMLElement }" 
                      @scroll="handleChatScroll"
                      class="flex-1 overflow-y-auto space-y-4 pr-2 scroll-smooth custom-scrollbar"
                    >
                      <div v-for="(msg, idx) in chatState[activeModalRequestId!]?.messages" :key="idx" class="flex gap-3" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                        <div v-if="msg.role === 'ai'" class="flex flex-col items-center gap-2 mt-1">
                          <div class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Bot class="w-4 h-4" />
                          </div>
                          <button @click="toggleSpeak(msg.content, 'chat-' + idx)" class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm border border-slate-100 dark:border-slate-800" :class="currentlyReadingId === 'chat-' + idx ? 'text-blue-600 animate-pulse' : ''">
                            <Volume2 v-if="currentlyReadingId !== 'chat-' + idx" class="w-3 h-3" />
                            <Square v-else class="w-3 h-3 fill-current" />
                          </button>
                        </div>
                        <div class="max-w-[85%] px-5 py-4 rounded-2xl text-sm leading-relaxed" :class="msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap' : 'bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm font-medium shadow-sm'" v-html="msg.role === 'ai' ? renderMarkdown(msg.content) : msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')"></div>
                      </div>
                      <div v-if="chatState[activeModalRequestId!]?.loading" class="flex gap-3 justify-start">
                        <div class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Bot class="w-4 h-4" />
                        </div>
                        <div class="px-5 py-4 rounded-2xl rounded-bl-sm bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex gap-1.5 items-center shadow-sm">
                          <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
                          <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
                          <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
                        </div>
                      </div>
                    </div>

                    <!-- Scroll to Bottom Button (Soft Blue Floating) -->
                    <transition name="fade">
                      <button 
                        v-if="showScrollButton" 
                        @click="scrollToBottom(activeModalRequestId!)"
                        class="absolute bottom-4 right-4 w-10 h-10 bg-white/90 dark:bg-slate-800/90 text-blue-600 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-700 transition-all hover:bg-white dark:hover:bg-slate-700 active:scale-90 z-10"
                      >
                        <ArrowDown class="w-5 h-5" />
                      </button>
                    </transition>
                 </div>
                 
                 <!-- Suggested Questions (Quick Replies) -->
                  <div v-if="activeModalRequestId && chatState[activeModalRequestId!]?.messages?.length === 0 && !chatState[activeModalRequestId!]?.loading" class="flex flex-wrap gap-2 mb-4 px-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <button 
                      v-for="q in ['สรุปภาพรวมข้อมูลนี้', 'มีข้อมูลไหนผิดปกติไหม?', 'ช่วยสร้างตารางสรุปยอดให้ที', 'วิเคราะห์แนวโน้มสำคัญ']" 
                      :key="q"
                      @click="activeModalRequestId && handleQuickReply(activeModalRequestId, q)"
                      class="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white text-slate-600 dark:text-slate-400 text-[11px] font-black rounded-xl transition-all border border-slate-200 dark:border-slate-700 hover:border-blue-500 active:scale-95 shadow-sm uppercase tracking-wider"
                    >
                      {{ q }}
                    </button>
                  </div>

                  <!-- Input -->
                  <div class="flex gap-3 items-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto shrink-0">
                   <textarea ref="chatInput" v-model="chatState[activeModalRequestId!]!.input" @keydown.enter.exact.prevent="sendChat(activeModalRequestId!)" placeholder="พิมพ์คำถามเกี่ยวกับข้อมูลนี้... (Enter เพื่อส่ง)" rows="2" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none leading-relaxed shadow-inner"></textarea>
                   
                   <!-- ปุ่มส่ง หรือ ปุ่มหยุด -->
                   <button 
                     v-if="chatState[activeModalRequestId]?.loading"
                     @click="stopChat(activeModalRequestId!)"
                     class="p-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all active:scale-95 shrink-0 shadow-lg shadow-rose-500/20 flex flex-col items-center gap-1 group"
                     title="หยุดการทำงาน"
                   >
                     <Square class="w-5 h-5 fill-current" />
                   </button>
                   <button 
                     v-else
                     @click="sendChat(activeModalRequestId!)" 
                     :disabled="!chatState[activeModalRequestId]?.input?.trim()" 
                     class="p-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all active:scale-95 shrink-0 shadow-lg shadow-blue-500/20"
                   >
                     <Send class="w-5 h-5" />
                   </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- SQL Explorer Modal (for Admin/Manager) -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="isSqlModalOpen" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/60"></div>
          
          <div class="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <!-- Header -->
            <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/50">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <Code class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 class="text-xl font-black text-slate-900 dark:text-white">SQL Explorer</h3>
                  <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">ตรวจสอบชุดคำสั่งฐานข้อมูล</p>
                </div>
              </div>
              <button @click="isSqlModalOpen = false" class="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X class="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div class="space-y-8">
                <!-- SQL Code Block -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Generated SQL Query</p>
                    <div class="flex items-center gap-2">
                      <button 
                        @click="copyToClipboard(activeSql)" 
                        class="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 rounded-lg transition-all active:scale-95 shadow-sm group"
                      >
                        <Copy class="w-3 h-3 group-hover:text-blue-500 transition-colors" />
                        Copy
                      </button>
                      <div class="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-100 dark:border-emerald-800/50 uppercase tracking-widest">
                        Read-Only
                      </div>
                    </div>
                  </div>
                  <div class="relative group">
                    <pre class="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-x-auto text-sm leading-relaxed font-mono shadow-inner text-slate-700 dark:text-slate-300"><code v-html="highlightSql(activeSql)"></code></pre>
                  </div>
                </div>

                <!-- Logic Explanation -->
                <div v-if="activeSqlExplanation" class="space-y-3">
                  <p class="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Logic Explanation</p>
                  <div class="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium" v-html="renderMarkdown(activeSqlExplanation || '')">
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-8 py-6 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 text-center shrink-0">
              <button @click="isSqlModalOpen = false" class="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl transition-all active:scale-95 text-sm uppercase tracking-widest">
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Renewal Modal -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="renewRequestId" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/60"></div>
          
          <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 bg-blue-50/50 dark:bg-blue-950/20">
              <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                <RefreshCw class="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 class="text-xl font-black text-slate-900 dark:text-white">ขอต่ออายุข้อมูล</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">ลิงก์เดิมหมดอายุแล้ว โปรดระบุเหตุผลเพื่อขออนุมัติใหม่</p>
              </div>
            </div>

            <!-- Body -->
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">เหตุผลในการขอต่ออายุ <span class="text-rose-500">*</span></label>
                <textarea 
                  v-model="renewReason" 
                  rows="3" 
                  placeholder="เช่น ต้องการนำข้อมูลมาสรุปรายงานประจำเดือนอีกครั้ง..."
                  class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <!-- Footer -->
            <div class="p-6 pt-0 flex gap-3">
              <button 
                @click="renewRequestId = null" 
                :disabled="isRenewing"
                class="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button 
                @click="submitRenewal" 
                :disabled="!renewReason.trim() || isRenewing"
                class="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                <Loader2 v-if="isRenewing" class="w-5 h-5 animate-spin" />
                <RefreshCw v-else class="w-5 h-5" />
                ส่งคำขอต่ออายุ
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </ClientOnly>

  <!-- Fixed Top Loading Bar (Teleport to Body) -->
  <ClientOnly>
    <Teleport to="body">
      <div v-if="isSearching" class="fixed top-0 left-0 right-0 z-[2000] h-1.5 bg-blue-100/50 dark:bg-blue-900/20 overflow-hidden">
        <div class="h-full bg-blue-600 w-1/3 animate-progress-slide rounded-full shadow-[0_0_15px_rgba(37,99,235,0.8)]"></div>
      </div>
    </Teleport>
  </ClientOnly>

  <!-- Edit Zoho Link Modal -->
  <ClientOnly>
    <Teleport to="body">
      <transition name="modal">
        <div v-if="editZohoModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80" @click.self="editZohoModal = false">
          <div class="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-white/10 overflow-hidden">
            <div class="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <LayoutGrid class="w-4 h-4 text-blue-500" />
                <h3 class="font-bold text-slate-900 dark:text-white">แก้ไข Zoho Link</h3>
              </div>
              <button @click="editZohoModal = false" class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-400">
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="p-5 space-y-4">
              <!-- ลิ้งค์จริง (Admin only) -->
              <div>
                <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">ลิ้งค์ไฟล์ (Admin เท่านั้น)</label>
                <input
                  v-model="editZohoLink"
                  type="url"
                  placeholder="https://workdrive.zoho.com/file/..."
                  class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-blue-500/50 transition-all"
                />
                <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1">ลิ้งค์ต้นฉบับจาก WorkDrive — เห็นได้เฉพาะ Admin</p>
              </div>
              <!-- Share Link (ทุก role เห็น) -->
              <div>
                <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">Share Link (ทุกคนเห็น)</label>
                <input
                  v-model="editZohoShareLink"
                  type="url"
                  placeholder="https://workdrive.zoho.com/external/..."
                  class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                />
                <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1">External Share Link ที่สร้างจาก Zoho WorkDrive UI</p>
              </div>
              <!-- Password -->
              <div>
                <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">รหัสผ่าน Share Link</label>
                <input
                  v-model="editZohoSharePassword"
                  type="text"
                  placeholder="ถ้าไม่มีรหัสผ่านให้เว้นว่าง"
                  class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                  @keydown.enter="saveZohoLink"
                />
              </div>
            </div>
            <div class="p-5 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3">
              <button @click="editZohoModal = false" class="px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border border-slate-200 dark:border-white/10">
                ยกเลิก
              </button>
              <button
                @click="saveZohoLink"
                :disabled="isSavingZohoLink"
                class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
              >
                <Loader2 v-if="isSavingZohoLink" class="w-3.5 h-3.5 animate-spin" />
                บันทึก
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </ClientOnly>

  <!-- Delete Confirm Modal -->
  <ClientOnly>
    <Teleport to="body">
      <transition name="modal">
        <div v-if="deleteConfirmId" class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80">
          <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
            <div class="p-8 text-center space-y-6">
              <div class="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center text-rose-500 mx-auto border border-rose-100 dark:border-rose-800/50">
                <Trash2 class="w-10 h-10" />
              </div>
              <div class="space-y-2">
                <h3 class="text-xl font-black text-slate-900 dark:text-white">ยืนยันการลบ?</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">รายการและไฟล์ CSV จะถูกลบถาวร<br>ไม่สามารถกู้คืนได้</p>
              </div>
              <div class="flex gap-3 pt-2">
                <button
                  @click="deleteConfirmId = null"
                  :disabled="isDeleting"
                  class="flex-1 px-6 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all border border-slate-200 dark:border-slate-700"
                >
                  ยกเลิก
                </button>
                <button
                  @click="confirmDelete"
                  :disabled="isDeleting"
                  class="flex-1 px-6 py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-black rounded-2xl transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
                >
                  <RotateCcw v-if="isDeleting" class="w-4 h-4 animate-spin" />
                  <Trash2 v-else class="w-4 h-4" />
                  ลบถาวร
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-active > div, .modal-leave-active > div {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-enter-from > div, .modal-leave-to > div {
  transform: scale(0.92);
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.expand-enter-active, .expand-leave-active {
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.expand-enter-from, .expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@keyframes progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

.animate-progress-slide {
  animation: progress-slide 1.5s infinite linear;
}
</style>
