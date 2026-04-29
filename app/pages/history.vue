<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import mermaid from 'mermaid'
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
  ArrowRight
} from 'lucide-vue-next'

const requests  = ref<any[]>([])
const isLoading = ref(true)
const isLoadingMore = ref(false)
const systemStatus  = useState<any>('system-status')
const toast = useToast()

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('คัดลอกแล้ว', 'คัดลอกคำสั่ง SQL ลง Clipboard เรียบร้อย')
}

// Get User Role for Admin/Manager features
const { data: authData } = await useFetch<any>('/api/auth/me')
const user = computed(() => authData.value?.user || null)

// SQL Expand Modal (for Admin/Manager)
const isSqlModalOpen = ref(false)
const activeSql = ref('')
const activeSqlExplanation = ref('')

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
  return sql
    .replace(/\s+/g, ' ') // บีบช่องว่างที่เกินมา
    .replace(/\b(SELECT|FROM|WHERE|INNER JOIN|LEFT JOIN|RIGHT JOIN|ORDER BY|GROUP BY|LIMIT|HAVING|VALUES|UPDATE|SET|INSERT INTO|DELETE FROM)\b/gi, '\n$1')
    .replace(/\b(AND|OR|ON)\b/gi, '\n  $1')
    .replace(/,\s*/g, ',\n  ')
    .trim()
}

const highlightSql = (sql: string) => {
  if (!sql) return ''
  // จัดรูปแบบก่อนทำ highlight
  const formatted = formatSql(sql)
  
  return formatted
    .replace(/\b(SELECT|FROM|WHERE|INNER JOIN|LEFT JOIN|RIGHT JOIN|ON|AND|OR|GROUP BY|ORDER BY|LIMIT|OFFSET|DESC|ASC|DISTINCT|COUNT|SUM|AVG|MAX|MIN|AS|IN|BETWEEN|LIKE|IS NULL|IS NOT NULL|HAVING|VALUES|UPDATE|SET|INSERT INTO|DELETE FROM)\b/gi, '<span class="text-blue-600 dark:text-blue-400 font-bold">$1</span>')
    .replace(/\b(vtiger_[a-zA-Z0-9_]+)\b/gi, '<span class="text-emerald-600 dark:text-emerald-400">$1</span>')
    .replace(/('.*?')/g, '<span class="text-rose-600 dark:text-rose-400">$1</span>')
}

// Markdown Helper
const renderMarkdown = (text: string) => {
  if (!text) return ''
  
  // Extract Mermaid blocks to protect them from standard markdown formatting
  const mermaidBlocks: string[] = []
  let html = text.replace(/```mermaid\n([\s\S]*?)\n```/gim, (match, p1) => {
    mermaidBlocks.push(p1)
    return `__MERMAID_BLOCK_${mermaidBlocks.length - 1}__`
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
    .replace(/\n/gim, '<br/>')

  html = html.replace(/(<li.*?>.*?<\/li><br\/>)+/gim, '<ul class="my-3 space-y-1">$&</ul>')
  html = html.replace(/<\/li><br\/>/gim, '</li>')
  html = html.replace(/(<br\/>){3,}/gim, '<br/><br/>')
  html = html.replace(/<br\/>(<ul|<h1|<h2|<h3)/gim, '$1')

  // Restore Mermaid blocks with specific class
  mermaidBlocks.forEach((block, index) => {
    // Escape quote marks from mermaid string block back to proper quotes if they were html escaped
    let cleanBlock = block.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    html = html.replace(`__MERMAID_BLOCK_${index}__`, `<div class="mermaid flex justify-center w-full my-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-x-auto">${cleanBlock}</div>`)
  })

  return html
}

const renderMermaidGraphs = async () => {
  await nextTick()
  try {
    // Only run if there are mermaid elements
    const elements = document.querySelectorAll('.mermaid')
    if (elements.length > 0) {
      await mermaid.run({
        querySelector: '.mermaid'
      })
    }
  } catch (err) {
    console.error('Mermaid render error', err)
  }
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
  if (page === 1) isLoading.value = true
  else isLoadingMore.value = true

  try {
    const response = await $fetch<any>(`/api/ai-query/history?page=${page}&limit=10`)
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
    isLoadingMore.value = false
  }
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
    .replace(/```mermaid\n([\s\S]*?)\n```/gim, 'มีกราฟแสดงผล')
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
const activeRequestData = computed(() => requests.value.find(r => r.id === activeModalRequestId.value))

const openModal = (id: string, tab: 'analyze' | 'chat') => {
  activeModalRequestId.value = id
  activeModalTab.value = tab
  if (tab === 'chat' && !chatState.value[id]) {
    chatState.value[id] = { open: true, messages: [], input: '', loading: false, abortController: null }
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
  mermaid.initialize({ startOnLoad: false, theme: 'base' })
  
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
  renderMermaidGraphs()
}, { deep: true, flush: 'post' })

watch(chatState, (val) => {
  localStorage.setItem('aiquery_chatState', JSON.stringify(val))
  renderMermaidGraphs()
}, { deep: true, flush: 'post' })

watch(activeModalTab, () => {
  renderMermaidGraphs()
}, { flush: 'post' })

watch(activeModalRequestId, (val) => {
  if (val) renderMermaidGraphs()
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
      <!-- Total count badge -->
      <div v-if="!isLoading && pagination.total > 0" class="px-5 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:blue-300 rounded-2xl text-sm font-black border border-blue-100 dark:border-blue-800 flex items-center gap-2 shrink-0">
        <History class="w-4 h-4" />
        ทั้งหมด {{ pagination.total }} รายการ
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
    <div v-else-if="requests.length === 0" class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-16 text-center shadow-xl shadow-slate-200/50 dark:shadow-none">
      <div class="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-slate-50 dark:bg-slate-950 mb-6 text-slate-300 dark:text-slate-700 border border-slate-100 dark:border-slate-800">
        <Clock class="w-12 h-12" />
      </div>
      <h3 class="text-2xl font-bold text-slate-900 dark:text-white">ยังไม่มีประวัติการขอข้อมูล</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2 text-lg">เริ่มขอข้อมูลใหม่ได้ที่หน้าแรกของระบบ</p>
      <NuxtLink to="/" class="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 group">
        ไปที่หน้าขอข้อมูล
        <ArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </NuxtLink>
    </div>

    <!-- Request List -->
    <div v-else class="grid gap-6">
      <div
        v-for="req in requests"
        :key="req.id"
        class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-blue-500/50 dark:hover:border-blue-400/50 transition-all"
      >
        <div class="p-8 md:p-10">

          <!-- Top Row -->
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
            <div class="space-y-4 flex-1">
              <div class="flex flex-wrap items-center gap-3">
                <div class="px-3 py-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  ID: {{ req.id.split('-')[0].toUpperCase() }}
                </div>
                <div class="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                  <User class="w-3 h-3" />
                  {{ req.user }}
                </div>
                <div class="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5" :class="getStatusClass(req.status)">
                  <CheckCircle v-if="req.status === 'APPROVED'" class="w-3 h-3" />
                  <XCircle v-else-if="req.status === 'REJECTED'" class="w-3 h-3" />
                  <Clock v-else class="w-3 h-3" />
                  {{ getStatusLabel(req.status) }}
                </div>
              </div>

              <p class="text-xl font-medium text-slate-700 dark:text-slate-300 leading-relaxed">"{{ req.query }}"</p>

              <div class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <Calendar class="w-3.5 h-3.5" />
                {{ req.time }}
              </div>
            </div>

            <!-- Download + Expiry column -->
            <div v-if="req.status === 'APPROVED'" class="flex flex-col items-stretch md:items-end gap-2 shrink-0">
              <div v-if="req.isExpired" class="flex flex-col gap-2">
                <div class="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm font-black rounded-xl border border-slate-200 dark:border-slate-700">
                  <TimerOff class="w-4 h-4" />
                  ลิงก์หมดอายุแล้ว
                </div>
                <button
                  @click="openRenewModal(req.id)"
                  class="flex items-center justify-center gap-2 px-6 py-3 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-sm font-black rounded-xl transition-all border border-blue-200 hover:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 active:scale-95 group"
                >
                  <RefreshCw class="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                  ขอต่ออายุลิงก์
                </button>
              </div>
              <button
                v-else
                @click="downloadCsv(req.id)"
                class="flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 group"
              >
                <Download class="w-5 h-5" />
                <div class="flex flex-col items-center">
                  <span class="tracking-widest uppercase">ดาวน์โหลด CSV</span>
                  <span class="text-[10px] font-medium opacity-80 normal-case tracking-normal">(ทั้งหมด {{ (req.resultCount || 0).toLocaleString() }} รายการ)</span>
                </div>
              </button>
              <div class="text-center text-[10px] font-black uppercase tracking-widest">
                <span v-if="req.expiresAt === null" class="flex items-center justify-end gap-1 text-blue-500 dark:text-blue-400">
                  <Infinity class="w-3 h-3" /> ไม่มีวันหมดอายุ
                </span>
                <span v-else class="text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-2">
                  หมดอายุ {{ new Date(req.expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                  <span class="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-bold" :class="req.downloadCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'">
                    <HardDrive class="w-3 h-3" />
                    โหลดแล้ว {{ req.downloadCount || 0 }} ครั้ง
                  </span>
                </span>
              </div>
            </div>
          </div>

          <!-- ปุ่มรายละเอียดเพิ่มเติม (Reason & Comment) -->
          <div class="flex flex-wrap gap-3 mb-4">
            <!-- ปุ่มดูเหตุผลในการขอข้อมูล -->
            <button
              v-if="req.requestReason"
              @click="toggleReason(req.id)"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-black transition-all active:scale-95"
              :class="openReasonIds.has(req.id)
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40'"
            >
              <MessageSquare class="w-4 h-4" />
              เหตุผลในการขอข้อมูล
              <ChevronUp v-if="openReasonIds.has(req.id)" class="w-4 h-4" />
              <ChevronDown v-else class="w-4 h-4" />
            </button>

            <!-- Manager Comment Button -->
            <button
              v-if="req.managerComment"
              @click="toggleComment(req.id)"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-black transition-all active:scale-95"
              :class="openCommentIds.has(req.id)
                ? req.status === 'REJECTED'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-500/20'
                  : 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20'
                : req.status === 'REJECTED'
                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'"
            >
              <MessageSquare class="w-4 h-4" />
              Comment จาก Manager
              <ChevronUp v-if="openCommentIds.has(req.id)" class="w-4 h-4" />
              <ChevronDown v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Content: Reason -->
          <transition name="expand">
            <div v-if="openReasonIds.has(req.id)" class="mb-4 p-5 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-2xl">
              <p class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-2">เหตุผล / วัตถุประสงค์</p>
              <p class="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{{ req.requestReason }}</p>
            </div>
          </transition>

          <!-- Content: Rejected Reason (Alert style) -->
          <div v-if="req.status === 'REJECTED' && req.reason" class="mb-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl p-6 border border-rose-100 dark:border-rose-900/50 flex gap-4">
            <AlertCircle class="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p class="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-[0.2em] mb-1">เหตุผลที่ไม่อนุมัติ</p>
              <p class="text-rose-600 dark:text-rose-300 leading-relaxed font-medium">{{ req.reason }}</p>
            </div>
          </div>

          <!-- Content: Manager Comment -->
          <transition name="expand">
            <div
              v-if="openCommentIds.has(req.id)"
              class="mb-4 p-5 rounded-2xl border"
              :class="req.status === 'REJECTED'
                ? 'bg-rose-50/60 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/50'
                : 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50'"
            >
              <p
                class="text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                :class="req.status === 'REJECTED' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'"
              >Comment จาก Manager</p>
              <p class="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{{ req.managerComment }}</p>
            </div>
          </transition>

          <!-- AI Explanation -->
          <div class="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800/50 flex gap-4 relative">
            <FileSpreadsheet class="w-6 h-6 text-blue-500 shrink-0" />
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">คำอธิบายจาก AI</p>
                
                <!-- ปุ่มดู SQL สำหรับ Admin/Manager -->
                <button
                  v-if="user?.role === 'admin' || user?.role === 'manager' || authData?.user?.role === 'admin' || authData?.user?.role === 'manager'"
                  @click="openSqlModal(req.sql, req.explanation)"
                  class="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-md z-10"
                >
                  <Code class="w-3 h-3" />
                  ดูคำสั่ง SQL
                </button>
              </div>
              <p class="text-slate-600 dark:text-slate-400 leading-relaxed text-sm font-medium">{{ req.explanation }}</p>
            </div>
          </div>

          <!-- ─── AI Tools (แสดงเฉพาะ APPROVED) ─── -->
          <div v-if="req.status === 'APPROVED'" class="mt-6 space-y-4">
            
            <!-- Warning Limit 5000 -->
            <div v-if="(req.resultCount || 0) > 5000" class="flex items-center gap-3 px-5 py-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
              <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle class="w-4 h-4" />
              </div>
              <div>
                <p class="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-0.5">ขีดจำกัดของ AI</p>
                <p class="text-sm font-medium text-amber-600 dark:text-amber-300">ข้อมูลมีทั้งหมด {{ (req.resultCount || 0).toLocaleString() }} รายการ แต่ AI จะประมวลผลจากข้อมูล <span class="font-bold underline decoration-amber-300 underline-offset-4">5,000 แถวแรก</span> เท่านั้น เพื่อให้ระบบตอบกลับได้รวดเร็ว</p>
              </div>
            </div>

            <div class="flex flex-wrap gap-3">
              <!-- สรุปข้อมูลด้วย AI -->
              <button
                @click="openAnalyze(req.id)"
                class="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black border transition-all active:scale-95 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40"
              >
                <Sparkles class="w-4 h-4" />
                สรุปข้อมูลด้วย AI
              </button>

              <!-- แชตกับ AI -->
              <button
                @click="openChat(req.id)"
                class="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black border transition-all active:scale-95 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40"
              >
                <Bot class="w-4 h-4" />
                แชตกับ AI
              </button>
            </div>

          </div>
          <!-- ─── End AI Tools ─── -->

        </div>
      </div>

      <!-- Pagination Footer -->
      <div class="flex flex-col items-center gap-4 py-4">
        <p class="text-sm text-slate-400 dark:text-slate-500 font-medium">
          แสดง <span class="font-black text-slate-700 dark:text-slate-300">{{ requests.length }}</span>
          จาก <span class="font-black text-slate-700 dark:text-slate-300">{{ pagination.total }}</span> รายการ
        </p>
        <!-- Load More button -->
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
          <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeModal"></div>
          
          <!-- Modal Content -->
          <div 
            class="relative w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 transition-all duration-300 overflow-hidden"
            :class="isModalFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-4xl max-h-[85vh] rounded-[2rem]'"
          >
            
            <!-- Header & Tabs -->
            <div class="px-6 pt-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 rounded-t-[2rem] shrink-0">
              <div class="flex justify-between items-center mb-6">
                <div class="flex items-center gap-3">
                   <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="activeModalTab === 'analyze' ? 'bg-violet-500/10' : 'bg-blue-500/10'">
                     <Sparkles class="w-5 h-5 text-violet-600 dark:text-violet-400" v-if="activeModalTab === 'analyze'" />
                     <Bot class="w-5 h-5 text-blue-600 dark:text-blue-400" v-else />
                   </div>
                   <div>
                      <div class="flex items-center gap-2 mb-0.5">
                        <h3 class="font-black text-slate-900 dark:text-white text-lg">AI Assistant</h3>
                        <span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-black rounded-full uppercase tracking-widest">Beta</span>
                        <div class="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-full text-[9px] font-bold text-slate-500 dark:text-slate-400">
                          <HardDrive class="w-3 h-3" />
                          <span>เก็บข้อมูลในเครื่อง (Offline)</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 mt-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                        <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          อ้างอิงจากข้อมูล: <span class="font-bold text-slate-800 dark:text-slate-200">"{{ activeRequestData?.query || 'ไม่ระบุ' }}"</span>
                        </p>
                      </div>
                   </div>
                </div>
                <div class="flex items-center gap-2">
                   <button @click="isModalFullscreen = !isModalFullscreen" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                     <Minimize2 v-if="isModalFullscreen" class="w-5 h-5" />
                     <Maximize2 v-else class="w-5 h-5" />
                   </button>
                   <button @click="closeModal" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors">
                     <X class="w-5 h-5 text-slate-500" />
                   </button>
                 </div>
              </div>
              
              <!-- Tabs -->
              <div class="flex justify-between items-end">
                <div class="flex gap-4">
                  <button @click="switchTab('analyze')" class="px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2" :class="activeModalTab === 'analyze' ? 'border-violet-600 text-violet-700 dark:text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'">
                    <BarChart3 class="w-4 h-4" /> สรุปข้อมูลด้วย AI
                  </button>
                  <button @click="switchTab('chat')" class="px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2" :class="activeModalTab === 'chat' ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'">
                    <Bot class="w-4 h-4" /> แชตกับ AI
                  </button>
                </div>
                
                <!-- Action Buttons -->
                <div class="mb-2 flex items-center gap-2">
                  <!-- สรุปข้อมูลใหม่ (สำหรับ Analyze Tab) -->
                  <div v-if="activeModalTab === 'analyze' && analyzeState[activeModalRequestId!]?.summary" class="flex items-center gap-2">
                    <button 
                      @click="toggleSpeak(analyzeState[activeModalRequestId!]!.summary!, 'summary-' + activeModalRequestId)" 
                      class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-bold rounded-xl border border-slate-200/50 dark:border-slate-800/50 transition-all active:scale-95 shadow-sm"
                      :title="currentlyReadingId === 'summary-' + activeModalRequestId ? 'หยุดอ่าน' : 'อ่านให้ฟัง'"
                    >
                      <Volume2 v-if="currentlyReadingId !== 'summary-' + activeModalRequestId" class="w-3.5 h-3.5" />
                      <Square v-else class="w-3.5 h-3.5 fill-current" />
                      {{ currentlyReadingId === 'summary-' + activeModalRequestId ? 'กำลังอ่าน...' : 'อ่านสรุป' }}
                    </button>

                    <button 
                      @click="analyzeData(activeModalRequestId!)" 
                      :disabled="analyzeState[activeModalRequestId!]?.loading"
                      class="flex items-center gap-2 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 text-[11px] font-bold rounded-full border border-violet-200/50 dark:border-violet-800/50 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                    >
                      <RotateCcw class="w-3.5 h-3.5" :class="analyzeState[activeModalRequestId!]?.loading ? 'animate-spin' : ''" />
                      สรุปใหม่
                    </button>
                  </div>

                  <!-- ล้างประวัติแชต (สำหรับ Chat Tab) -->
                  <button 
                    v-if="activeModalTab === 'chat' && chatState[activeModalRequestId!]?.messages?.length"
                    @click="clearChatHistory(activeModalRequestId!)" 
                    class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-900/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 text-[11px] font-bold rounded-xl border border-slate-200/50 dark:border-slate-800/50 hover:border-rose-200 dark:hover:border-rose-800 transition-all active:scale-95 shadow-sm"
                  >
                    <RotateCcw class="w-3.5 h-3.5" />
                    ล้างประวัติ
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Content Area -->
            <div class="flex-1 flex flex-col p-6 bg-white dark:bg-slate-900 rounded-b-[2rem] overflow-hidden">
              <!-- Analyze Tab -->
              <div v-if="activeModalTab === 'analyze'" class="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-1">
                  <!-- ปุ่มเริ่มวิเคราะห์ (แสดงเฉพาะเมื่อยังไม่มีข้อมูล) -->
                  <div v-if="!analyzeState[activeModalRequestId]?.summary && !analyzeState[activeModalRequestId]?.loading" class="flex justify-center py-10">
                     <button @click="analyzeData(activeModalRequestId)" class="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-violet-500/25 active:scale-95">
                        <Sparkles class="w-4 h-4" />
                        เริ่มวิเคราะห์ข้อมูลด้วย AI
                     </button>
                  </div>
                 
                 <div v-if="analyzeState[activeModalRequestId]?.error" class="p-5 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/50 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-medium">

                   ❌ {{ analyzeState[activeModalRequestId]?.error }}
                 </div>
                 
                 <div v-else-if="analyzeState[activeModalRequestId]?.summary" class="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium" v-html="renderMarkdown(analyzeState[activeModalRequestId]?.summary || '')"></div>
                 
                 <div v-else-if="analyzeState[activeModalRequestId]?.loading" class="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                   <Loader2 class="w-8 h-8 animate-spin text-violet-500" />
                   <p class="font-bold text-sm">กำลังวิเคราะห์ข้อมูล กรุณารอสักครู่...</p>
                 </div>
                 
                 <div v-else class="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                   <BarChart3 class="w-12 h-12 text-slate-300 dark:text-slate-700" />
                   <p class="font-medium text-sm">คลิก "เริ่มวิเคราะห์ข้อมูล" ด้านบนเพื่อให้ AI สรุปสาระสำคัญให้คุณ</p>
                 </div>
              </div>
              
              <!-- Chat Tab -->
              <div v-else-if="activeModalTab === 'chat'" class="flex-1 flex flex-col min-h-0">
                 
                 <!-- Messages -->
                 <div class="relative flex-1 flex flex-col min-h-0 mb-4">

                    <div 
                      :ref="el => { chatScrollRefs[activeModalRequestId!] = el as HTMLElement }" 
                      @scroll="handleChatScroll"
                      class="flex-1 overflow-y-auto space-y-4 pr-2 scroll-smooth custom-scrollbar"
                    >
                      <div v-if="!chatState[activeModalRequestId]?.messages?.length" class="flex flex-col items-center justify-center h-full gap-3 text-slate-400 dark:text-slate-600">
                        <Bot class="w-10 h-10" />
                        <p class="text-sm font-medium text-center">ถามอะไรเกี่ยวกับข้อมูลนี้ก็ได้<br>เช่น "ข้อมูลมีอะไรน่าสนใจบ้าง?"</p>
                      </div>
                      <div v-for="(msg, idx) in chatState[activeModalRequestId]?.messages" :key="idx" class="flex gap-3" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                        <div v-if="msg.role === 'ai'" class="flex flex-col items-center gap-2 mt-1">
                          <div class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Bot class="w-4 h-4" />
                          </div>
                          <!-- ปุ่มลำโพงสำหรับ Chat -->
                          <button 
                            @click="toggleSpeak(msg.content, 'chat-' + idx)"
                            class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm border border-slate-100 dark:border-slate-800"
                            :class="currentlyReadingId === 'chat-' + idx ? 'text-blue-600 animate-pulse' : ''"
                          >
                            <Volume2 v-if="currentlyReadingId !== 'chat-' + idx" class="w-3 h-3" />
                            <Square v-else class="w-3 h-3 fill-current" />
                          </button>
                        </div>
                        <div class="max-w-[85%] px-5 py-4 rounded-2xl text-sm leading-relaxed" :class="msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap' : 'bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm font-medium shadow-sm'" v-html="msg.role === 'ai' ? renderMarkdown(msg.content) : msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')"></div>
                      </div>
                      <!-- Loading -->
                      <div v-if="chatState[activeModalRequestId]?.loading" class="flex gap-3 justify-start">
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
                 
                 <!-- Input -->
                 <div class="flex gap-3 items-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto shrink-0">
                   <textarea v-model="chatState[activeModalRequestId]!.input" @keydown.enter.exact.prevent="sendChat(activeModalRequestId!)" placeholder="พิมพ์คำถามเกี่ยวกับข้อมูลนี้... (Enter เพื่อส่ง)" rows="2" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none leading-relaxed shadow-inner"></textarea>
                   
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
          <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="isSqlModalOpen = false"></div>
          
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
                  <div class="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium">
                    {{ activeSqlExplanation }}
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
          <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="!isRenewing && (renewRequestId = null)"></div>
          
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
</template>

<style scoped>
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
</style>
