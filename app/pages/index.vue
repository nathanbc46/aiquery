<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { format } from 'sql-formatter'
import { 
  Sparkles, 
  Search, 
  X, 
  Database, 
  Info, 
  AlertCircle, 
  ArrowRight, 
  History,
  Terminal,
  ShieldCheck,
  RotateCcw,
  BrainCircuit,
  Cpu,
  Wand2,
  Edit3,
  AlertTriangle,
  Copy,
  Mail,
  Star,
  Bookmark,
  Trash2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  LayoutGrid,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Lightbulb,
  Send,
  MessageSquare,
  ChevronDown,
  Volume2,
  VolumeX,
  Share2,
  Square,
  SquareCheck,
  MousePointerClick,
  Upload
} from 'lucide-vue-next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ApexCharts from 'apexcharts'
import 'apexcharts/features/exports'
import * as XLSX from 'xlsx'


const prompt = ref('')
const isGenerating = ref(false)
const isOptimizing = ref(false)
const isOptimized = ref(false)
const originalSql = ref<string | null>(null)
const optimizationExplanation = ref<string | null>(null)
const showOriginalSql = ref(false)
const generatedResult = ref<any>(null)
const isRequesting = ref(false)
const isRequestModalOpen = ref(false)
const requestReason = ref('')
const isCopied = ref(false)
const isRefining = ref(false)
const originalPrompt = ref('')
const isSqlModalOpen = ref(false)
const isTipsModalOpen = ref(false)
const isDataGuideModalOpen = ref(false)
const dataGuideContent = ref('')
const isLoadingDataGuide = ref(false)
const isReportingError = ref(false)
const isZohoModalOpen = ref(false)
const zohoOptions = ref({
  linkName: '',
  password: '',
  setPassword: false,
  setExpiration: false,
  expirationDate: '',
  showDownloadPrint: true,
  requestUserData: false,
  requestUserFields: ['email'] as string[],
  accessLevel: 'edit'
})
const showZohoPassword = ref(false)
const isExportingZoho = ref(false)
const generatedZohoLink = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const generateAbortController = ref<AbortController | null>(null)
const previewAbortController = ref<AbortController | null>(null)
const isCancelled = ref(false)
const useHybridSchema = ref(false)
const isDebugMode = ref(false)
const debugInfo = ref<any>(null)

// File Upload State
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadedData = ref<any[] | null>(null)
const uploadedFileName = ref('')
const isParsingFile = ref(false)
const DATA_CONTEXT_LIMIT = 200

const { data: auth } = await useFetch<any>('/api/auth/me')
const user = computed(() => auth.value?.user)
const isAdmin = computed(() => user.value?.role === 'admin')



const toast = useToast()

// Favorite State
const favorites = ref<any[]>([])
const isFetchingFavorites = ref(false)
const isSavingFavorite = ref(false)
const isFavoriteModalOpen = ref(false)
const favoriteTitle = ref('')

// CSV download confirmation modal
const isCsvConfirmModalOpen = ref(false)
const csvFilename = ref('')
const csvExpiresAt = ref('')
const csvSuccessDone = ref(false)

// Zoho success state
const zohoSuccessDone = ref(false)
const zohoExpiresAt = ref('')

// AI Chat (Admin) state
const isChatModalOpen = ref(false)
const isChatFullscreen = ref(false)
const chatMessages = ref<Array<{ role: 'user' | 'model'; content: string }>>([])
const chatInput = ref('')
const isChatLoading = ref(false)
const isChatInitializing = ref(false)
const chatSessionId = ref<string | null>(null)
const chatScrollRef = ref<HTMLElement | null>(null)
const chatChartRegistry = new Map<string, any>()
const chatChartInstances = new Map<string, any>()

// AI Model selector สำหรับ chat modal
const CHAT_MODELS = [
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    badge: 'ฉลาดที่สุด',
    badgeColor: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800'
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    badge: 'สมดุล · เร็ว',
    badgeColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite Preview',
    badge: 'เบา · เร็วที่สุด',
    badgeColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
  }
] as const

// ค่า default ใช้ '' ก่อน (หมายถึง ใช้ค่าจาก admin settings)
const chatModel = ref<string>('')
const isChatModelDropdownOpen = ref(false)

// Share / PDF export state
const isChatSelectMode = ref(false)
const selectedMsgIdxs = ref<Set<number>>(new Set())
const isShareEmailModalOpen = ref(false)
const isGeneratingPdf = ref(false)
const isSendingEmail = ref(false)
const emailTo = ref('')
const emailSubject = ref('')
const emailMessage = ref('')
const emailError = ref<{ title: string; detail: string } | null>(null)

const selectedMessages = computed(() =>
  chatMessages.value.filter((_, i) => selectedMsgIdxs.value.has(i))
)

const toggleSelectMsg = (idx: number) => {
  const s = new Set(selectedMsgIdxs.value)
  s.has(idx) ? s.delete(idx) : s.add(idx)
  selectedMsgIdxs.value = s
}

// ดึง PNG ของกราฟพร้อม legend ผ่าน ApexCharts dataURI() ที่ 1x scale — เล็กกว่า canvas 3x มาก
const collectChartSvgs = async (): Promise<Map<string, { svgString: string; ratio: number }>> => {
  const result = new Map<string, { svgString: string; ratio: number }>()
  for (const [id, instance] of chatChartInstances.entries()) {
    try {
      const { imgURI } = await instance.dataURI() as { imgURI: string }
      const el = document.querySelector(`.apex-chat-chart[data-chart-id="${id}"]`) as HTMLElement | null
      const w = el?.clientWidth || 580
      const h = el?.clientHeight || 300
      result.set(id, { svgString: imgURI, ratio: h / w })
    } catch (e) {
      console.warn('Chart export failed:', id, e)
    }
  }
  return result
}

const downloadSelectedPdf = async () => {
  if (!selectedMessages.value.length) return
  isGeneratingPdf.value = true
  try {
    const [{ generateChatPdf }, chartSvgs] = await Promise.all([
      import('~/utils/chatPdfExport'),
      collectChartSvgs()
    ])
    const blob = await generateChatPdf(selectedMessages.value, chatContextLabel.value, chartSvgs)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-report-${Date.now()}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    console.error('PDF generation error:', e)
    toast.error('สร้าง PDF ล้มเหลว', e?.message || String(e) || 'ไม่สามารถสร้าง PDF ได้')
  } finally {
    isGeneratingPdf.value = false
  }
}

const openShareEmailModal = () => {
  emailSubject.value = `รายงานการสนทนา AI - ${new Date().toLocaleDateString('th-TH')}`
  emailTo.value = ''
  emailMessage.value = ''
  emailError.value = null
  isShareEmailModalOpen.value = true
}

const sendSelectedEmail = async () => {
  if (!emailTo.value || isSendingEmail.value) return
  // ล้าง error เดิมก่อนเริ่มส่งใหม่
  emailError.value = null
  isSendingEmail.value = true
  try {
    // ขั้นที่ 1: สร้าง PDF
    let blob: Blob
    try {
      const [{ generateChatPdf }, chartSvgs] = await Promise.all([
        import('~/utils/chatPdfExport'),
        collectChartSvgs()
      ])
      blob = await generateChatPdf(selectedMessages.value, chatContextLabel.value, chartSvgs)
    } catch (pdfErr: any) {
      emailError.value = {
        title: 'สร้างไฟล์ PDF ไม่สำเร็จ',
        detail: pdfErr?.message || 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF กรุณาลองใหม่อีกครั้ง'
      }
      return
    }

    // ขั้นที่ 2: ตรวจขนาดไฟล์ก่อนส่ง (max 10 MB)
    if (blob.size > 10 * 1024 * 1024) {
      const sizeMb = (blob.size / 1024 / 1024).toFixed(1)
      emailError.value = {
        title: 'ไฟล์ PDF ใหญ่เกินไป',
        detail: `ขนาดไฟล์ ${sizeMb} MB เกินขีดจำกัด 10 MB กรุณาลดจำนวนข้อความที่เลือก แล้วลองใหม่`
      }
      return
    }

    // ขั้นที่ 3: แปลง Blob เป็น base64
    const base64 = await new Promise<string>((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        res(result.split(',')[1] || '')
      }
      reader.onerror = rej
      reader.readAsDataURL(blob)
    })

    // ขั้นที่ 4: ส่งอีเมลผ่าน API
    await $fetch('/api/ai-query/chat-export-email', {
      method: 'POST',
      body: {
        to: emailTo.value,
        subject: emailSubject.value,
        message: emailMessage.value,
        pdfBase64: base64,
        filename: `chat-report-${Date.now()}.pdf`
      }
    })

    toast.success('ส่งอีเมลสำเร็จ', `ส่งรายงานไปยัง ${emailTo.value} เรียบร้อยแล้ว`)
    isShareEmailModalOpen.value = false
    isChatSelectMode.value = false
    selectedMsgIdxs.value = new Set()
  } catch (e: any) {
    // แปลง HTTP error ให้เป็นข้อความไทยที่เข้าใจได้
    const statusCode: number = e?.status || e?.statusCode || 0
    const serverMsg: string = e?.data?.message || e?.data?.statusMessage || e?.statusMessage || e?.message || ''
    let title = 'ส่งอีเมลไม่สำเร็จ'
    let detail = serverMsg || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'

    if (statusCode === 400 || serverMsg.toLowerCase().includes('invalid email')) {
      title = 'อีเมลผู้รับไม่ถูกต้อง'
      detail = `"${emailTo.value}" ไม่ใช่รูปแบบอีเมลที่ถูกต้อง กรุณาตรวจสอบและลองใหม่`
    } else if (statusCode === 413 || serverMsg.toLowerCase().includes('too large')) {
      title = 'ไฟล์ PDF ใหญ่เกินไป'
      detail = 'ขนาดไฟล์เกินขีดจำกัด 10 MB กรุณาลดจำนวนข้อความที่เลือก แล้วลองใหม่'
    } else if (statusCode === 401) {
      title = 'ไม่มีสิทธิ์เข้าใช้งาน'
      detail = 'Session หมดอายุ กรุณา Refresh หน้าแล้วลองใหม่'
    } else if (statusCode === 500 || serverMsg.toLowerCase().includes('mail') || serverMsg.toLowerCase().includes('smtp') || serverMsg.toLowerCase().includes('connect')) {
      title = 'เซิร์ฟเวอร์อีเมลไม่ตอบสนอง'
      detail = serverMsg || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์อีเมล กรุณาตรวจสอบการตั้งค่า SMTP หรือลองใหม่ภายหลัง'
    } else if (!serverMsg && !navigator.onLine) {
      title = 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต'
      detail = 'กรุณาตรวจสอบการเชื่อมต่อเครือข่ายแล้วลองใหม่'
    }

    emailError.value = { title, detail }
  } finally {
    isSendingEmail.value = false
  }
}

// Text-to-Speech
const speakingIdx = ref<number | null>(null)
let currentUtt: SpeechSynthesisUtterance | null = null

const stripHtml = (html: string) => {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

const stopSpeech = () => {
  if (!window.speechSynthesis) return
  currentUtt = null
  speakingIdx.value = null
  window.speechSynthesis.pause()
  window.speechSynthesis.cancel()
  // Chrome bug: cancel ไม่หยุดทันที ต้อง cancel ซ้ำใน next tick
  setTimeout(() => window.speechSynthesis.cancel(), 0)
}

const speakMessage = (content: string, idx: number) => {
  if (!window.speechSynthesis) return
  if (speakingIdx.value === idx) {
    stopSpeech()
    return
  }
  stopSpeech()
  const text = stripHtml(content).replace(/[#*`_~]/g, '').trim()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'th-TH'
  utt.rate = 1.05
  currentUtt = utt
  speakingIdx.value = idx
  utt.onend = () => { if (currentUtt === utt) { speakingIdx.value = null; currentUtt = null } }
  utt.onerror = () => { if (currentUtt === utt) { speakingIdx.value = null; currentUtt = null } }
  // หน่วงเล็กน้อยหลัง cancel เพื่อให้ browser reset ก่อน speak ใหม่
  setTimeout(() => { if (currentUtt === utt) window.speechSynthesis.speak(utt) }, 50)
}

onUnmounted(() => { stopSpeech() })

// Chat helpers
const chatHashStr = (str: string): string => {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

const renderChatMarkdown = (text: string): string => {
  if (!text) return ''
  const entries: { id: string }[] = []
  let html = text.replace(/```chart\n([\s\S]*?)\n```/gim, (_, json) => {
    try {
      const config = JSON.parse(json)
      const id = `chat-chart-${chatHashStr(json)}`
      chatChartRegistry.set(id, config)
      entries.push({ id })
      return `__CHART_${entries.length - 1}__`
    } catch {
      return ''
    }
  })

  html = html
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h3 class="text-[13px] font-black text-indigo-900 dark:text-indigo-300 mt-5 mb-2 uppercase tracking-wide">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-sm font-black text-indigo-900 dark:text-indigo-300 mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-base font-black text-indigo-900 dark:text-indigo-300 mt-5 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-black text-slate-900 dark:text-white">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em class="italic text-slate-600 dark:text-slate-400">$1</em>')
    .replace(/^\s*\*\s+(.*)$/gim, '<li class="ml-5 list-disc py-0.5">$1</li>')
    .replace(/^\s*-\s+(.*)$/gim, '<li class="ml-5 list-disc py-0.5">$1</li>')
    .replace(/`(.*?)`/gim, '<code class="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800/50 rounded-md text-indigo-600 dark:text-indigo-300 text-[11px] font-mono">$1</code>')

  // Table support
  html = html.replace(/((?:\|[^\n]+\|(?:\n|$)){2,})/gim, (match) => {
    const rows = match.trim().split('\n').filter(r => r.trim() !== '')
    if (rows.length < 2) return match
    const tableRows = rows.map((row, index) => {
      const cells = row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1)
      if (index === 1 && cells.every(c => c.trim().match(/^:?-+:?$/))) return ''
      const tag = index === 0 ? 'th' : 'td'
      const cellStyle = tag === 'th'
        ? 'px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black uppercase tracking-wider text-[10px] border border-slate-300 dark:border-slate-600 text-left'
        : 'px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
      const renderedCells = cells.map(c => `<${tag} class="${cellStyle}">${c.trim()}</${tag}>`).join('')
      const rowStyle = index === 0 ? '' : (index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/60')
      return `<tr class="${rowStyle}">${renderedCells}</tr>`
    }).filter(r => r !== '').join('')
    return `<div class="overflow-x-auto my-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table class="w-full text-[11px] border-collapse min-w-full">${tableRows}</table></div>`
  })

  html = html
    .replace(/\n/gim, '<br/>')
    .replace(/(<li.*?>.*?<\/li><br\/>)+/gim, '<ul class="my-3 space-y-1">$&</ul>')
    .replace(/<\/li><br\/>/gim, '</li>')
    .replace(/(<br\/>){3,}/gim, '<br/><br/>')
    .replace(/<br\/>(<ul|<h1|<h2|<h3)/gim, '$1')

  entries.forEach(({ id }, index) => {
    html = html.replace(
      `__CHART_${index}__`,
      `<div class="apex-chat-chart my-4" data-chart-id="${id}" style="min-height:300px"></div>`
    )
  })
  return html
}

const renderChatApexCharts = async () => {
  await nextTick()
  const placeholders = document.querySelectorAll('.apex-chat-chart[data-chart-id]')
  placeholders.forEach(el => {
    const id = el.getAttribute('data-chart-id')!
    if (!id || el.children.length > 0) return
    const config = chatChartRegistry.get(id) as any
    if (!config) return
    const isPie = config.type === 'pie' || config.type === 'donut'
    const isDark = document.documentElement.classList.contains('dark')
    const rawSeries = Array.isArray(config.series) ? config.series : (config.series != null ? [config.series] : [])
    const series = isPie
      ? rawSeries.map((item: any) => (typeof item === 'number' ? item : Number(item?.value ?? item?.data?.[0] ?? 0)))
      : rawSeries.map((item: any, i: number) => ({
          name: item?.name || `ชุดที่ ${i + 1}`,
          data: Array.isArray(item?.data) ? item.data.map((d: any) => (typeof d === 'object' ? d : Number(d))) : []
        }))
    const options: any = {
      chart: { type: config.type || 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Outfit, sans-serif', background: 'transparent' },
      theme: { mode: isDark ? 'dark' : 'light' },
      title: { text: config.title || '', style: { fontSize: '13px', fontWeight: '700' } },
      series: series.length ? series : (isPie ? [1] : [{ name: 'ข้อมูล', data: [] }]),
      colors: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#f97316'],
      dataLabels: { 
        enabled: true,
        formatter: (val: any) => typeof val === 'number' ? val.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : val
      },
      legend: { position: 'bottom' },
      tooltip: { 
        theme: isDark ? 'dark' : 'light',
        y: {
          formatter: (val: any) => typeof val === 'number' ? val.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : val
        }
      },
      yaxis: isPie ? undefined : {
        labels: {
          formatter: (val: any) => typeof val === 'number' ? val.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : val
        }
      }
    }
    if (isPie) { options.labels = Array.isArray(config.labels) ? config.labels : [] }
    else { options.xaxis = { categories: Array.isArray(config.categories) ? config.categories : [] } }
    const chart = new ApexCharts(el as HTMLElement, options)
    chart.render()
      .then(() => { chatChartInstances.set(id, chart) })
      .catch((err: any) => console.error('Chat chart render error', id, err))
  })
}

const scrollToLastMessage = () => {
  nextTick(() => {
    if (!chatScrollRef.value) return
    const messages = chatScrollRef.value.querySelectorAll('.chat-message')
    if (messages.length > 0) {
      const last = messages[messages.length - 1] as HTMLElement
      chatScrollRef.value.scrollTop = last.offsetTop - 16
    } else {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  })
}

watch(chatMessages, () => {
  renderChatApexCharts()
}, { deep: true, flush: 'post' })

watch(isChatFullscreen, () => {
  renderChatApexCharts()
}, { flush: 'post' })

watch(isChatModalOpen, (open) => {
  if (!open) {
    stopSpeech()
  } else {
    renderChatApexCharts()
  }
})

const openChatModal = async () => {
  isChatFullscreen.value = true
  isChatModalOpen.value = true
  scrollToLastMessage()
  if (!chatSessionId.value && generatedResult.value?.sql) {
    const preview = generatedResult.value.previewData ?? []
    const total = generatedResult.value.previewCount ?? 0
    const allDataInPreview = preview.length > 0 && preview.length >= total
    isChatInitializing.value = true
    try {
      const body = allDataInPreview
        ? { previewData: preview }
        : { sql: generatedResult.value.sql }
      const res = await $fetch<any>('/api/ai-query/chat-direct-init', { method: 'POST', body })
      chatSessionId.value = res.sessionId
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถเตรียมข้อมูลสำหรับ AI ได้')
    } finally {
      isChatInitializing.value = false
    }
  }
}

const resetChat = () => {
  chatMessages.value = []
  chatInput.value = ''
  showChatSuggest.value = false
  isChatSelectMode.value = false
  selectedMsgIdxs.value = new Set()
  chatChartInstances.forEach(inst => { try { inst.destroy() } catch {} })
  chatChartInstances.clear()
  chatChartRegistry.clear()
  if (chatSessionId.value) {
    $fetch('/api/ai-query/chat-direct-session', {
      method: 'DELETE',
      body: { sessionId: chatSessionId.value }
    }).catch(() => {})
    chatSessionId.value = null
  }
}

watch(generatedResult, (newVal, oldVal) => {
  if (!newVal || (oldVal && newVal !== oldVal)) resetChat()
})

const showChatSuggest = ref(false)

const sendQuickReply = (q: string) => {
  showChatSuggest.value = false
  chatInput.value = q
  sendChatMessage()
}

const sendChatMessage = async () => {
  const msg = chatInput.value.trim()
  if (!msg || isChatLoading.value || isChatInitializing.value || !chatSessionId.value) return
  chatInput.value = ''
  chatMessages.value.push({ role: 'user', content: msg })
  isChatLoading.value = true
  scrollToLastMessage()
  try {
    const history = chatMessages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
    const res = await $fetch<any>('/api/ai-query/chat-direct', {
      method: 'POST',
      body: {
        sessionId: chatSessionId.value,
        queryText: prompt.value,
        userMessage: msg,
        messages: history,
        // ส่ง model ที่เลือกไว้ ('' = ใช้ default จาก admin settings)
        modelOverride: chatModel.value || undefined
      }
    })
    chatMessages.value.push({ role: 'model', content: res.reply })
    await renderChatApexCharts()
    scrollToLastMessage()
  } catch (err: any) {
    chatMessages.value.push({ role: 'model', content: `เกิดข้อผิดพลาด: ${err?.data?.message || err.message || 'ไม่สามารถติดต่อ AI ได้'}` })
    scrollToLastMessage()
  } finally {
    isChatLoading.value = false
  }
}

const openCsvModal = () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  csvFilename.value = `AI_Export_${today}`
  // default expired = 7 วันจากวันนี้
  const defaultExpiry = new Date()
  defaultExpiry.setDate(defaultExpiry.getDate() + 7)
  csvExpiresAt.value = defaultExpiry.toISOString().slice(0, 10)
  fetchVtigerUsers().then(() => {
    if (!csvOwnerVtigerId.value && user.value?.vtigerId) {
      csvOwnerVtigerId.value = user.value.vtigerId
      csvOwnerSearch.value = getOwnerLabel(user.value.vtigerId)
    }
  })
  isCsvConfirmModalOpen.value = true
}

const openZohoModal = () => {
  const defaultExpiry = new Date()
  defaultExpiry.setDate(defaultExpiry.getDate() + 7)
  zohoExpiresAt.value = defaultExpiry.toISOString().slice(0, 10)
  fetchVtigerUsers().then(() => {
    if (!zohoOwnerVtigerId.value && user.value?.vtigerId) {
      zohoOwnerVtigerId.value = user.value.vtigerId
      zohoOwnerSearch.value = getOwnerLabel(user.value.vtigerId)
    }
  })
  isZohoModalOpen.value = true
}

// User Owner state (for CSV & Zoho modals)
interface VtigerUser { id: number; firstName: string | null; lastName: string | null; userName: string; email1: string | null }
const vtigerUsersList = ref<VtigerUser[]>([])
const vtigerUsersLoaded = ref(false)
const csvOwnerVtigerId = ref<number | null>(null)
const csvOwnerSearch = ref('')
const showCsvOwnerDropdown = ref(false)
const zohoOwnerVtigerId = ref<number | null>(null)
const zohoOwnerSearch = ref('')
const showZohoOwnerDropdown = ref(false)

const getOwnerLabel = (vtigerId: number | null): string => {
  if (!vtigerId) return ''
  const u = vtigerUsersList.value.find(u => u.id === vtigerId)
  if (!u) return String(vtigerId)
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.userName
}

const filterUsers = (search: string): VtigerUser[] => {
  const q = search.toLowerCase()
  return vtigerUsersList.value.filter(u =>
    [u.firstName, u.lastName, u.userName, u.email1].some(v => v?.toLowerCase().includes(q))
  )
}

const filteredCsvUsers = computed(() => filterUsers(csvOwnerSearch.value))
const filteredZohoUsers = computed(() => filterUsers(zohoOwnerSearch.value))

const fetchVtigerUsers = async () => {
  if (vtigerUsersLoaded.value) return
  try {
    const data = await $fetch<{ users: VtigerUser[] }>('/api/ai-query/vtiger-users')
    vtigerUsersList.value = data.users
    vtigerUsersLoaded.value = true
  } catch { /* fallback: empty list */ }
}

const selectCsvOwner = (u: VtigerUser) => {
  csvOwnerVtigerId.value = u.id
  csvOwnerSearch.value = getOwnerLabel(u.id)
  showCsvOwnerDropdown.value = false
}

const selectZohoOwner = (u: VtigerUser) => {
  zohoOwnerVtigerId.value = u.id
  zohoOwnerSearch.value = getOwnerLabel(u.id)
  showZohoOwnerDropdown.value = false
}

const hideCsvOwnerDropdown = () => { setTimeout(() => { showCsvOwnerDropdown.value = false }, 150) }
const hideZohoOwnerDropdown = () => { setTimeout(() => { showZohoOwnerDropdown.value = false }, 150) }

// Delete confirmation state
const isDeleteConfirmModalOpen = ref(false)
const favoriteToDelete = ref<any>(null)

const fetchFavorites = async () => {
  isFetchingFavorites.value = true
  try {
    const data = await $fetch<any[]>('/api/favorites')
    favorites.value = data
  } catch (e) {
    console.error('Failed to fetch favorites:', e)
  } finally {
    isFetchingFavorites.value = false
  }
}

const saveFavorite = async () => {
  if (!favoriteTitle.value || isSavingFavorite.value || !generatedResult.value) return
  
  isSavingFavorite.value = true
  try {
    const response = await $fetch<any>('/api/favorites', {
      method: 'POST',
      body: {
        title: favoriteTitle.value,
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanationTh: generatedResult.value.explanation
      }
    })
    
    if (response.success) {
      toast.success('บันทึกสำเร็จ', 'เพิ่มรายการโปรดเรียบร้อยแล้ว')
      isFavoriteModalOpen.value = false
      favoriteTitle.value = ''
      fetchFavorites()
    }
  } catch (e: any) {
    toast.error('ล้มเหลว', 'ไม่สามารถบันทึกรายการโปรดได้')
  } finally {
    isSavingFavorite.value = false
  }
}

const deleteFavorite = (fav: any) => {
  favoriteToDelete.value = fav
  isDeleteConfirmModalOpen.value = true
}

const confirmDeleteFavorite = async () => {
  if (!favoriteToDelete.value) return
  
  try {
    const response = await $fetch<any>(`/api/favorites/${favoriteToDelete.value.id}`, {
      method: 'DELETE'
    })
    if (response.success) {
      toast.info('ลบแล้ว', 'ลบรายการโปรดเรียบร้อย')
      fetchFavorites()
    }
  } catch (e) {
    toast.error('ล้มเหลว', 'ไม่สามารถลบรายการโปรดได้')
  } finally {
    isDeleteConfirmModalOpen.value = false
    favoriteToDelete.value = null
  }
}

const submitBtnRef = ref<HTMLElement | null>(null)

const useFavorite = (fav: any) => {
  prompt.value = fav.queryText
  focusAndEnd()
  if (window.innerWidth < 1024) {
    nextTick(() => {
      submitBtnRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}

onMounted(() => {
  fetchFavorites()
})

const { data: systemConfig } = useFetch<any>('/api/system-config')
const suggestions = computed(() => systemConfig.value?.suggestions || [])

// \u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32 default chatModel \u0e08\u0e32\u0e01 admin settings \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e42\u0e2b\u0e25\u0e14\u0e40\u0e2a\u0e23\u0e47\u0e08
const settingsInitialized = ref(false)
watch(systemConfig, (cfg) => {
  if (cfg && !settingsInitialized.value) {
    if (cfg.chatModel && !chatModel.value) {
      chatModel.value = cfg.chatModel
    }
    if (cfg.useHybridSchema !== undefined) {
      useHybridSchema.value = cfg.useHybridSchema
    }
    if (cfg.isDebugMode !== undefined) {
      isDebugMode.value = cfg.isDebugMode
    }
    settingsInitialized.value = true
  }
}, { immediate: true })

const focusAndEnd = () => {
  setTimeout(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      textareaRef.value.setSelectionRange(prompt.value.length, prompt.value.length)
    }
  }, 50)
}

const useSuggestion = (text: string) => {
  prompt.value = text
  focusAndEnd()
}

const fetchDataGuide = async () => {
  if (dataGuideContent.value) {
    isDataGuideModalOpen.value = true
    return
  }
  
  isLoadingDataGuide.value = true
  isDataGuideModalOpen.value = true
  try {
    const response = await $fetch<any>('/api/data-guide')
    if (response.success) {
      dataGuideContent.value = response.data
    } else {
      toast.error('ล้มเหลว', 'ไม่สามารถโหลดข้อมูลคู่มือได้')
    }
  } catch (e) {
    toast.error('ล้มเหลว', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
  } finally {
    isLoadingDataGuide.value = false
  }
}

const renderedDataGuide = computed(() => {
  if (!dataGuideContent.value) return ''
  return DOMPurify.sanitize(marked.parse(dataGuideContent.value) as string)
})

const chatContextLabel = computed(() => {
  const preview = generatedResult.value?.previewData ?? []
  const total = generatedResult.value?.previewCount ?? 0
  const allInPreview = preview.length > 0 && preview.length >= total
  if (allInPreview) {
    return `${total} รายการ · ข้อมูลครบใน context`
  }
  return `${total} รายการ · AI เห็นข้อมูลครบทั้งหมด`
})

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadedFileName.value = file.name
  isParsingFile.value = true
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        toast.error('ไฟล์ไม่ถูกต้อง', 'ไม่พบแผ่นงานในไฟล์ที่อัปโหลด')
        clearFile()
        return
      }
      const worksheet = workbook.Sheets[firstSheetName]
      if (!worksheet) {
        toast.error('ไฟล์ไม่ถูกต้อง', 'ไม่สามารถอ่านข้อมูลแผ่นงานได้')
        clearFile()
        return
      }
      const json = XLSX.utils.sheet_to_json(worksheet)
      
      if (Array.isArray(json) && json.length > 0) {
        uploadedData.value = json
        toast.success('อัปโหลดไฟล์สำเร็จ', `โหลดข้อมูลจาก ${file.name} จำนวน ${json.length} แถว เรียบร้อยแล้ว`)
      } else {
        toast.error('ไฟล์ไม่มีข้อมูล', 'ไม่พบข้อมูลในไฟล์ที่อัปโหลด')
        clearFile()
      }
    } catch (err) {
      console.error('File parsing error:', err)
      toast.error('ข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ได้ โปรดตรวจสอบรูปแบบไฟล์')
      clearFile()
    } finally {
      isParsingFile.value = false
    }
  }
  reader.readAsArrayBuffer(file)
}

const clearFile = () => {
  uploadedData.value = null
  uploadedFileName.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const triggerFileUpload = () => {
  fileInputRef.value?.click()
}

const formatExplanation = (text: string | null | undefined) => {
  if (!text) return ''
  let processedText = text
  
  // Auto-convert legacy history items or plain text to bullet points
  if (!processedText.includes('- ') && !processedText.includes('* ')) {
    processedText = processedText.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => `- ${line}`)
      .join('\n')
  }
  
  return DOMPurify.sanitize(marked.parse(processedText) as string)
}

const renderedExplanation = computed(() => {
  return formatExplanation(generatedResult.value?.explanation)
})

const isExplanationCopied = ref(false)
const copyExplanation = async () => {
  if (!generatedResult.value?.explanation) return
  try {
    const textToCopy = generatedResult.value.explanation.replace(/\*/g, '')
    
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy)
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = textToCopy
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (!successful) throw new Error('Fallback copy failed')
    }
    
    isExplanationCopied.value = true
    toast.success('คัดลอกสำเร็จ', 'คัดลอกคำอธิบายลงคลิปบอร์ดแล้ว')
    setTimeout(() => {
      isExplanationCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Clipboard error:', err)
    toast.error('ผิดพลาด', 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก (อาจเป็นเพราะไม่ได้ใช้ HTTPS)')
  }
}

const handleZohoExport = async () => {
  isExportingZoho.value = true
  try {
    // Set default owner if not yet selected
    if (!zohoOwnerVtigerId.value && user.value?.vtigerId) {
      zohoOwnerVtigerId.value = user.value.vtigerId
    }

    // 1. Create request + auto-approve (same as CSV flow)
    const zohoResolvedExpiry = zohoExpiresAt.value
      ? new Date(zohoExpiresAt.value + 'T23:59:59').toISOString()
      : null
    const requestResp = await $fetch<any>('/api/ai-query/request', {
      method: 'POST',
      body: {
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation,
        resultCount: generatedResult.value.previewCount,
        requestReason: 'Export to Zoho WorkDrive',
        ownerVtigerId: zohoOwnerVtigerId.value || null,
        expiresAt: zohoResolvedExpiry,
      }
    })

    if (!requestResp.success) {
      toast.error('ล้มเหลว', 'ไม่สามารถบันทึกการขอข้อมูลได้')
      return
    }

    // 2. Upload to Zoho WorkDrive
    const response = await $fetch<any>('/api/ai-query/export-zoho', {
      method: 'POST',
      body: {
        sql: generatedResult.value.sql,
        options: { ...zohoOptions.value, ownerVtigerId: zohoOwnerVtigerId.value, expiresAt: zohoResolvedExpiry },
        requestId: requestResp.requestId
      }
    })

    if (response.success) {
      zohoSuccessDone.value = true
      zohoOptions.value.linkName = ''
      prompt.value = ''
      requestReason.value = ''
      generatedResult.value = null
    } else if (response.needsAuth) {
      window.location.href = response.authUrl
    } else {
      toast.error('ล้มเหลว', response.message || 'ไม่สามารถอัพโหลดไปยัง Zoho ได้')
    }
  } catch (e: any) {
    toast.error('ล้มเหลว', e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
  } finally {
    isExportingZoho.value = false
  }
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('คัดลอกแล้ว', 'คัดลอกลิงก์ไปยัง Clipboard เรียบร้อยแล้ว')
}

const handleClarification = () => {
  generatedResult.value = null
  focusAndEnd()
}

const clearInput = () => {
  prompt.value = ''
  originalPrompt.value = ''
  generatedResult.value = null
  debugInfo.value = null
  clearFile()
  if (textareaRef.value) textareaRef.value.focus()
}

const revertToOriginal = () => {
  if (!originalPrompt.value) return
  const current = prompt.value
  prompt.value = originalPrompt.value
  originalPrompt.value = current // Allow toggling back and forth
  focusAndEnd()
  toast.info('คืนค่าข้อความ', 'กลับไปใช้ข้อความเดิมของคุณแล้ว')
}

const error = ref<string | null>(null)
const showPreview = ref(false)
const resultSection = ref<HTMLElement | null>(null)

const refineQuestion = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  setTimeout(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      const len = textareaRef.value.value.length
      textareaRef.value.setSelectionRange(len, len)
    }
  }, 500)
}

const copySql = async () => {
  if (!generatedResult.value?.sql) return
  try {
    const textToCopy = formatSql(generatedResult.value.sql)
    
    // Check if clipboard API is available and context is secure
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy)
    } else {
      // Fallback for non-HTTPS connections (e.g. local IP testing)
      const textArea = document.createElement("textarea")
      textArea.value = textToCopy
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (!successful) throw new Error('Fallback copy failed')
    }
    
    isCopied.value = true
    setTimeout(() => { isCopied.value = false }, 2000)
    toast.success('คัดลอกแล้ว', 'คัดลอกคำสั่ง SQL ลง Clipboard เรียบร้อย')
  } catch (err) {
    console.error('Clipboard error:', err)
    toast.error('ล้มเหลว', 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก (อาจเป็นเพราะไม่ได้ใช้ HTTPS)')
  }
}

const refinePrompt = async () => {
  if (!prompt.value || isRefining.value) return
  
  isRefining.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/refine', {
      method: 'POST',
      body: { prompt: prompt.value }
    })
    
    if (response.success) {
      originalPrompt.value = prompt.value
      prompt.value = response.refinedText
      toast.info('ขัดเกลาคำถามสำเร็จ', 'AI ได้ปรับปรุงคำถามของคุณให้ชัดเจนขึ้นแล้ว')
      focusAndEnd()
    } else {
      toast.error('เกิดข้อผิดพลาด', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('ล้มเหลว', 'ไม่สามารถขัดเกลาคำถามได้ในขณะนี้')
  } finally {
    isRefining.value = false
  }
}

const generateSql = async (isDraft = false) => {
  if (!prompt.value) return
  
  isGenerating.value = true
  isCancelled.value = false
  isOptimized.value = false
  originalSql.value = null
  optimizationExplanation.value = null
  showOriginalSql.value = false
  generatedResult.value = null // Clear old result immediately
  error.value = null
  showPreview.value = false
  
  if (generateAbortController.value) {
    generateAbortController.value.abort()
  }
  generateAbortController.value = new AbortController()
  
  try {
    const response = await $fetch<any>('/api/ai-query/generate', {
      method: 'POST',
      body: { 
        prompt: prompt.value,
        contextData: uploadedData.value,
        useHybridSchema: useHybridSchema.value,
        isDebugMode: isDebugMode.value,
        generateOnly: isDraft
      },
      signal: generateAbortController.value.signal
    })
    
    if (response.success && (response.status === 'success' || response.status === 'error' || response.status === 'draft')) {
      generatedResult.value = response
      debugInfo.value = response.debug || null
      
      // ถ้าเป็น Admin หรือ Manager ให้เปิด Preview อัตโนมัติเลย (ยกเว้น Draft)
      if ((isAdmin.value || user.value?.role === 'manager') && response.status !== 'draft') {
        showPreview.value = true
      }
      
      // Auto-scroll to result
      setTimeout(() => {
        resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else if (response.status === 'clarification_needed') {
      generatedResult.value = response
      toast.info('AI มีข้อสงสัย', 'โปรดให้รายละเอียดเพิ่มเติมตามที่ AI แนะนำ')
    } else {
      error.value = response.error || 'ไม่สามารถสร้างคำสั่ง SQL ได้ โปรดลองระบุคำถามใหม่ให้ชัดเจนขึ้น'
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      error.value = 'ยกเลิกการทำงานแล้ว (Cancelled by user)'
      return
    }
    console.error(e)
    error.value = e.data?.statusMessage || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI หรือ Database ล้มเหลว'
  } finally {
    isGenerating.value = false
    generateAbortController.value = null
  }
}

const optimizeSql = async () => {
  if (!generatedResult.value?.sql || isOptimizing.value) return
  
  isOptimizing.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/optimize', {
      method: 'POST',
      body: { 
        sql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation
      }
    })
    
    if (response.success) {
      originalSql.value = generatedResult.value.sql
      generatedResult.value.sql = response.optimizedSql
      if (response.optimizationExplanation) {
        optimizationExplanation.value = response.optimizationExplanation
      }
      if (response.modelUsed) {
        generatedResult.value.optimizeModelUsed = response.modelUsed
      }
      isOptimized.value = true
      toast.success('ปรับปรุงสำเร็จ', 'AI ได้ปรับปรุง SQL ให้ทำงานได้เร็วขึ้นแล้ว')
    } else {
      toast.error('ไม่สามารถปรับปรุงได้', response.error || 'เกิดข้อผิดพลาดในการปรับปรุง SQL')
    }
  } catch (e: any) {
    console.error(e)
    toast.error('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้')
  } finally {
    isOptimizing.value = false
  }
}

const cancelGenerate = () => {
  if (generateAbortController.value) {
    generateAbortController.value.abort()
    isCancelled.value = true
  }
}

const revertToOriginalSql = () => {
  if (originalSql.value && generatedResult.value) {
    generatedResult.value.sql = originalSql.value
    isOptimized.value = false
    optimizationExplanation.value = null
    originalSql.value = null
    showOriginalSql.value = false
    toast.info('คืนค่าเดิม', 'กลับไปใช้คำสั่ง SQL เดิมก่อนการปรับปรุงแล้ว')
  }
}

const requestApproval = async (skipDownload: boolean = false) => {
  if (!generatedResult.value) return

  isRequesting.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/request', {
      method: 'POST',
      body: {
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation,
        resultCount: generatedResult.value.previewCount,
        requestReason: requestReason.value,
        ownerVtigerId: csvOwnerVtigerId.value || null,
        expiresAt: csvExpiresAt.value ? new Date(csvExpiresAt.value + 'T23:59:59').toISOString() : null,
      }
    })
    
    if (response.success) {
      if (response.autoApproved) {
        // เริ่มดาวน์โหลดไฟล์ทันที (สำหรับ Admin)
        if (isAdmin.value && response.requestId && !skipDownload) {
          const fn = (csvFilename.value || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙\s_-]/g, '').trim().replace(/\s+/g, '_') || 'AI_Export'
          const ownerParam = csvOwnerVtigerId.value ? `&ownerVtigerId=${csvOwnerVtigerId.value}` : ''
          window.location.href = `/api/ai-query/export?id=${response.requestId}&filename=${encodeURIComponent(fn)}${ownerParam}`
        }
        // แสดง success state ใน modal แทนการปิดทันที
        csvSuccessDone.value = true
        isRequestModalOpen.value = false
      } else {
        toast.success('ส่งคำขอสำเร็จ', 'ส่งคำขออนุมัติไปยังหัวหน้างานเรียบร้อยแล้ว!')
        isCsvConfirmModalOpen.value = false
        isRequestModalOpen.value = false
        prompt.value = ''
        requestReason.value = ''
        generatedResult.value = null
      }
    } else {
      toast.error('ส่งคำขอไม่สำเร็จ', 'โปรดตรวจสอบการเชื่อมต่อ Database หรือติดต่อ Admin')
    }
  } catch (e: any) {
    console.error(e)
    toast.error('ส่งคำขอไม่สำเร็จ', 'โปรดตรวจสอบการเชื่อมต่อ Database หรือติดต่อ Admin')
  } finally {
    isRequesting.value = false
  }
}

const reportError = async () => {
  if (!generatedResult.value?.dbError) return
  
  isReportingError.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/report-error', {
      method: 'POST',
      body: {
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation,
        dbError: generatedResult.value.dbError,
        userDisplayName: user.value?.displayName || 'Unknown User'
      }
    })
    
    if (response.success) {
      toast.success('ส่งรายงานสำเร็จ', 'แจ้งเตือนผู้ดูแลระบบเรียบร้อยแล้ว ขอบคุณสำหรับข้อมูลครับ')
      generatedResult.value = null // Clear to allow retry
    } else {
      toast.error('ส่งรายงานล้มเหลว', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('เกิดข้อผิดพลาด', 'ไม่สามารถส่งรายงานได้ในขณะนี้')
  } finally {
    isReportingError.value = false
  }
}

const isEditingSql = ref(false)
const editedSql = ref('')
const isUpdatingSql = ref(false)
const isSqlModalFullscreen = ref(false)
const sqlModalError = ref('')

watch(isSqlModalOpen, (open) => {
  if (!open) {
    isSqlModalFullscreen.value = false
    sqlModalError.value = ''
    isEditingSql.value = false
  }
})

const startEditingSql = () => {
  editedSql.value = formatSql(generatedResult.value?.sql || '')
  isEditingSql.value = true
  sqlModalError.value = ''
}

const openManualSqlEditor = () => {
  if (!generatedResult.value) {
    generatedResult.value = { sql: '', explanation: 'แก้ไข SQL ด้วยตัวเอง (Manual Query)' }
  }
  isSqlModalOpen.value = true
  startEditingSql()
}

const cancelEditingSql = () => {
  isEditingSql.value = false
  sqlModalError.value = ''
}

const updateSql = async () => {
  if (!editedSql.value || isUpdatingSql.value) return

  isUpdatingSql.value = true
  sqlModalError.value = ''
  try {
    const response = await $fetch<any>('/api/ai-query/preview', {
      method: 'POST',
      body: { query: editedSql.value }
    })

    if (response.success) {
      if (!generatedResult.value) {
        generatedResult.value = { explanation: 'แก้ไข SQL ด้วยตัวเอง (Manual Query)' }
      }
      generatedResult.value.sql = editedSql.value
      generatedResult.value.previewData = response.data
      generatedResult.value.previewCount = response.totalCount
      generatedResult.value.status = 'success'
      generatedResult.value.dbError = null
      showPreview.value = true

      toast.success('อัปเดตสำเร็จ', 'ระบบอัปเดตข้อมูลตามคำสั่ง SQL ใหม่ของคุณเรียบร้อยแล้ว')
      isEditingSql.value = false
      isSqlModalOpen.value = false
    } else {
      sqlModalError.value = response.error || 'SQL ไม่ถูกต้อง'
    }
  } catch (e: any) {
    sqlModalError.value = e?.data?.message || e?.message || 'ไม่สามารถรันคำสั่ง SQL นี้ได้'
  } finally {
    isUpdatingSql.value = false
  }
}

const runDraftQuery = async () => {
  if (!generatedResult.value?.sql) return
  
  if (isUpdatingSql.value) {
    if (previewAbortController.value) {
      previewAbortController.value.abort()
      isUpdatingSql.value = false
      toast.info('ยกเลิกแล้ว', 'ยกเลิกการดึงข้อมูลตามที่คุณขอแล้ว')
    }
    return
  }
  
  isUpdatingSql.value = true
  previewAbortController.value = new AbortController()
  
  try {
    const response = await $fetch<any>('/api/ai-query/preview', {
      method: 'POST',
      body: { query: generatedResult.value.sql },
      signal: previewAbortController.value.signal
    })
    
    if (response.success) {
      generatedResult.value.previewData = response.data
      generatedResult.value.previewCount = response.totalCount
      generatedResult.value.status = 'success'
      showPreview.value = true
      
      toast.success('ดึงข้อมูลสำเร็จ', 'ระบบประมวลผลข้อมูลตามคำสั่ง SQL เรียบร้อยแล้ว')
      
      // Auto-scroll to result
      setTimeout(() => {
        resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else {
      generatedResult.value.status = 'error'
      generatedResult.value.dbError = response.error
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return
    generatedResult.value.status = 'error'
    generatedResult.value.dbError = e?.data?.message || e?.message || 'Database execution failed'
  } finally {
    isUpdatingSql.value = false
    previewAbortController.value = null
  }
}



// โหลดค่ากำหนดพื้นฐานจากระบบ
// SQL Formatter & Highlighter Logic (From approvals.vue)
const formatSql = (sqlStr: string) => {
  if (!sqlStr) return ''
  try {
    return format(sqlStr, {
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
    return sqlStr
  }
}

const highlightSql = (sqlStr: string) => {
  if (!sqlStr) return ''
  
  // 1. Format SQL for readability
  let result = formatSql(sqlStr)
  
  // 2. Highlight Strings
  result = result.replace(/'(.*?)'/g, '<span class="text-emerald-600 dark:text-emerald-400">\'$1\'</span>')
  
  // 3. Highlight Keywords
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'LIMIT', 'AND', 'OR', 'IN', 'IS NULL', 'IS NOT NULL',
    'INSERT INTO', 'UPDATE', 'DELETE', 'VALUES', 'SET', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'AS', 'DISTINCT', 'HAVING', 'BETWEEN', 'LIKE', 'DESC', 'ASC'
  ]
  
  keywords.forEach(word => {
    const reg = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(reg, `<span class="text-blue-600 dark:text-blue-400 font-black">${word}</span>`)
  })
  
  // 4. Highlight Numbers
  result = result.replace(/(?<![\w\-\.])\b(\d+)\b/g, '<span class="text-amber-600 dark:text-amber-500">$1</span>')
  
  return result
}

</script>

<template>
  <div class="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8 relative z-10">
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100/50 dark:border-blue-800/50 shadow-sm backdrop-blur-md">
            <Sparkles class="w-3.5 h-3.5 animate-pulse" />
            AI SQL ENGINE PRO
          </div>
          <button
            @click="fetchDataGuide"
            class="group flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100/50 dark:border-indigo-800/50 shadow-sm backdrop-blur-md hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all active:scale-95"
          >
            <Database class="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            สามารถขอข้อมูลอะไรได้บ้าง?
          </button>
          <button
            @click="isTipsModalOpen = true"
            class="group flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-50/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] border border-amber-100/50 dark:border-amber-800/50 shadow-sm backdrop-blur-md hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all active:scale-95"
            title="เทคนิคการถาม AI"
          >
            <Lightbulb class="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
            เทคนิคการถาม
          </button>
        </div>

        <h2 class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-[1.2] tracking-tight">
          ดึงข้อมูลด้วย<span class="text-gradient">ภาษาธรรมชาติ</span>
        </h2>
        <p class="text-slate-500 dark:text-slate-400 text-lg max-w-2xl leading-relaxed font-medium">
          เปลี่ยนคำถามภาษาไทยของคุณให้เป็นชุดคำสั่งดึงข้อมูลที่ปลอดภัยจากระบบ Vtiger CRM
        </p>
      </div>
    </header>

    <!-- Input Box (Action Zone) -->
    <section class="rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:shadow-indigo-500/10 relative z-10 border border-indigo-100 dark:border-indigo-900/30 bg-slate-100/90 dark:bg-slate-900/90 lg:backdrop-blur-xl shadow-2xl">
      <form @submit.prevent="generateSql()" class="p-8 md:p-10 space-y-6">
        <div class="space-y-6">
          <div class="flex items-center justify-between px-1">
            <label class="flex items-center gap-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
              <div class="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Search class="w-4.5 h-4.5 text-blue-500" />
              </div>
              <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                คุณต้องการค้นหาข้อมูลอะไร?
                <div class="flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300 font-black rounded-xl border-2 border-blue-100 dark:border-blue-800/50 shadow-sm animate-in fade-in zoom-in duration-700">
                  <ShieldCheck class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span class="tracking-tight uppercase opacity-60 mr-1 font-black">Security Policy:</span>
                  <span>จำกัดการดึงข้อมูลสูงสุด {{ (systemConfig?.maxResultsLimit || 0).toLocaleString() }} รายการ (ระบุจำนวนที่ต้องการในคำถามได้)</span>
                </div>
              </div>
            </label>
            <div v-if="isGenerating" class="flex items-center gap-2.5 text-xs font-black text-blue-600 dark:text-blue-400">
              <div class="relative">
                <BrainCircuit class="w-5 h-5 animate-pulse" />
                <div class="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
              </div>
              <span class="uppercase tracking-widest">AI กำลังประมวลผล...</span>
            </div>
            
            <!-- Hybrid Schema & Debug Toggle -->
            <div class="flex items-center gap-4 bg-white/40 dark:bg-slate-800/40 px-4 py-2 rounded-2xl border border-white/50 dark:border-slate-700/50 backdrop-blur-md shadow-sm">
              <label class="flex items-center gap-2 cursor-pointer group" title="เปิดเพื่อเลือกเฉพาะตารางที่เกี่ยวข้อง (ประหยัด Token และ AI โฟกัสดีขึ้น)">
                <div class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="useHybridSchema" class="sr-only peer">
                  <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <span class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">Hybrid Schema</span>
              </label>
              <div class="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
              <label class="flex items-center gap-2 cursor-pointer group" title="เปิดเพื่อดูข้อมูลตารางที่ AI นำไปใช้ประมวลผล">
                <div class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="isDebugMode" class="sr-only peer">
                  <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <span class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">Debug Mode</span>
              </label>
            </div>
          </div>
          
          <div class="relative group">
            <textarea 
              ref="textareaRef"
              v-model="prompt" 
              :readonly="isGenerating"
              @keydown.enter.exact.prevent="generateSql()"
              placeholder="เช่น ขอลูกค้าที่มียอดสั่งซื้อเกิน 1 แสนบาทในปีนี้ พร้อมเบอร์ติดต่อ... (Enter เพื่อประมวลผล)" 
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] px-6 py-5 pr-14 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all resize-y min-h-[160px] text-lg leading-relaxed shadow-inner disabled:opacity-50"
              :disabled="isGenerating"
            ></textarea>

            <!-- File Input (Hidden) -->
            <input 
              type="file" 
              ref="fileInputRef" 
              class="hidden" 
              accept=".csv, .xlsx, .xls"
              @change="handleFileUpload"
            />

            <!-- Uploaded File Badge -->
            <div v-if="uploadedFileName" class="absolute left-6 bottom-5 flex flex-col items-start gap-2 animate-in slide-in-from-left-2 duration-300">
              <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-black rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span class="max-w-[200px] truncate">{{ uploadedFileName }}</span>
                <span class="opacity-50">({{ uploadedData?.length }} แถว)</span>
                <button @click="clearFile" type="button" class="ml-1 p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full transition-colors">
                  <X class="w-3 h-3" />
                </button>
              </div>
              <div v-if="uploadedData && uploadedData.length > DATA_CONTEXT_LIMIT" class="flex items-center gap-1.5 px-2 text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">
                <AlertTriangle class="w-3 h-3" />
                AI จะพิจารณาเฉพาะ {{ DATA_CONTEXT_LIMIT }} แถวแรกของไฟล์นี้
              </div>
              <div v-else class="px-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                ระบบจะส่งข้อมูลในไฟล์นี้ให้ AI ช่วยประมวลผล
              </div>
            </div>

            <div class="absolute right-5 bottom-5 flex items-center gap-2">
              <ClientOnly>
                <button 
                  type="button"
                  @click="triggerFileUpload"
                  :disabled="isGenerating || isParsingFile"
                  class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50"
                  title="แนบไฟล์ CSV หรือ Excel เพื่อใช้เป็นข้อมูลประกอบ"
                >
                  <Upload v-if="!isParsingFile" class="w-3.5 h-3.5" />
                  <Loader2 v-else class="w-3.5 h-3.5 animate-spin" />
                  {{ uploadedFileName ? 'เปลี่ยนไฟล์' : 'แนบไฟล์' }}
                </button>

                <button 
                  v-if="prompt"
                  type="button"
                  @click="refinePrompt"
                  :disabled="isRefining || isGenerating"
                  class="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-xl border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                  title="ขัดเกลาคำถามด้วย AI ให้ชัดเจนขึ้น"
                >
                  <Sparkles v-if="!isRefining" class="w-3.5 h-3.5" />
                  <RotateCcw v-else class="w-3.5 h-3.5 animate-spin" />
                  {{ isRefining ? 'กำลังขัดเกลา...' : 'ช่วยเขียนให้ดีขึ้น' }}
                </button>

                <button 
                  v-if="originalPrompt && prompt !== originalPrompt"
                  type="button"
                  @click="revertToOriginal"
                  :disabled="isGenerating"
                  class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50"
                  title="กลับไปใช้ข้อความก่อนขัดเกลา"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                  ใช้ข้อความเดิม
                </button>
                
                <button 
                  v-if="prompt"
                  type="button"
                  @click="clearInput"
                  :disabled="isGenerating"
                  class="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="ล้างข้อความ"
                >
                  <X class="w-5 h-5" />
                </button>
              </ClientOnly>
            </div>
          </div>
        </div>

        <!-- Clarification Box -->
        <transition name="fade">
          <div v-if="generatedResult?.status === 'clarification_needed'" class="mt-2">
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-6 flex gap-5 shadow-sm">
              <div class="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-2xl h-fit">
                <AlertCircle class="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <div class="space-y-3">
                <h3 class="font-bold text-amber-900 dark:text-amber-200 text-lg">AI ต้องการข้อมูลเพิ่มเติม</h3>
                <div class="text-amber-800 dark:text-amber-400 leading-relaxed prose prose-sm prose-amber dark:prose-invert prose-p:my-1 prose-markdown" v-html="renderedExplanation"></div>
                <button type="button" @click="handleClarification" class="mt-2 text-sm font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1.5 underline underline-offset-8 decoration-amber-500/30 hover:decoration-amber-500 transition-all">
                  ตกลง ฉันจะระบุข้อมูลใหม่
                  <ArrowRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </transition>
        
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
          <div class="flex flex-wrap gap-2 flex-1 min-w-0">
            <button 
              v-for="text in suggestions" 
              :key="text"
              type="button"
              @click="useSuggestion(text)"
              :disabled="isGenerating"
              class="text-[12px] font-bold px-5 py-3 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all active:scale-95 border border-slate-200/50 dark:border-slate-700/50 shadow-sm backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {{ text }}
            </button>

            <!-- Favorites List -->
            <div v-if="favorites.length > 0" class="flex flex-wrap gap-2 items-center">
              <div class="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-2 hidden sm:block"></div>
              <div class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-100 dark:border-amber-800/50">
                <Star class="w-3 h-3 fill-amber-500" />
                Favorites
              </div>
              <div v-for="fav in favorites.slice(0, 5)" :key="fav.id" class="group relative">
                <button 
                  type="button"
                  @click="useFavorite(fav)"
                  :disabled="isGenerating"
                  class="text-[12px] font-bold px-4 py-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white transition-all active:scale-95 border border-amber-200/50 dark:border-amber-800/50 shadow-sm backdrop-blur-sm disabled:opacity-30"
                  :title="fav.queryText"
                >
                  {{ fav.title }}
                </button>
                <button 
                  type="button"
                  @click.stop="deleteFavorite(fav)"
                  class="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white dark:bg-slate-800 text-rose-500 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          
          <div class="flex flex-wrap items-center justify-end gap-3 shrink-0">
            <button 
              v-if="!isGenerating && isCancelled"
              type="button"
              @click="openManualSqlEditor"
              class="px-8 py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-[2rem] shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 uppercase tracking-widest text-sm border border-slate-200 dark:border-slate-700"
              title="เขียนคำสั่ง SQL ด้วยตัวเอง"
            >
              <Terminal class="w-6 h-6" />
              เขียน SQL เอง
            </button>

            <button 
              v-if="!isGenerating"
              type="button"
              @click="generateSql(true)"
              :disabled="!prompt"
              class="px-8 py-5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-[2rem] shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 uppercase tracking-widest text-sm border border-slate-200 dark:border-slate-700"
              title="สร้างเฉพาะคำสั่ง SQL โดยยังไม่รัน Query"
            >
              <Wand2 class="w-6 h-6" />
              สร้าง SQL (ดราฟต์)
            </button>

            <button
              v-if="!isGenerating"
              ref="submitBtnRef"
              type="submit"
              :disabled="!prompt"
              class="relative group px-12 py-5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-blue-600 dark:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-[2rem] shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 overflow-hidden uppercase tracking-widest text-sm"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
              <div class="flex items-center gap-2">
                <Database class="w-6 h-6 group-hover:scale-110 transition-transform" />
              </div>
              ประมวลผลทันที
            </button>

            <button 
              v-else
              type="button" 
              @click="cancelGenerate"
              class="relative group px-12 py-5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-blue-600 dark:to-indigo-600 text-white font-black rounded-[2rem] shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 overflow-hidden uppercase tracking-widest text-sm hover:opacity-90"
              title="ยกเลิกการทำงาน"
            >
              <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
              <Loader2 class="w-5 h-5 relative z-10 animate-spin" />
              <span class="relative z-10">กำลังประมวลผล... (กดเพื่อหยุด)</span>
            </button>
          </div>
        </div>

        <!-- Inline Error Alert -->
        <transition name="fade">
          <div v-if="error" class="mt-6 p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-3xl flex items-start gap-4 animate-in slide-in-from-top-2 duration-300">
            <div class="p-2 bg-white dark:bg-rose-900/30 rounded-xl shadow-sm border border-rose-100 dark:border-rose-800 shrink-0">
              <AlertCircle class="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <p class="text-rose-900 dark:text-rose-300 font-bold uppercase tracking-wider text-xs mb-1">AI Generation Failed</p>
              <p class="text-rose-700 dark:text-rose-400 text-sm font-medium">{{ error }}</p>
            </div>
          </div>
        </transition>
        
        <!-- Debug Info Alert -->
        <transition name="fade">
          <div v-if="debugInfo" class="mt-4 p-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl animate-in slide-in-from-top-2 duration-300">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <Terminal class="w-4 h-4 text-indigo-500" />
                <span class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">Debug: Schema Context Selected</span>
              </div>
              <button @click="debugInfo = null" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="table in debugInfo.selectedTables" 
                :key="table"
                class="px-2 py-1 bg-white dark:bg-slate-900 text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md"
              >
                {{ table }}
              </span>
              <span v-if="debugInfo.isHybrid" class="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-[10px] font-black text-blue-600 dark:text-blue-400 rounded-md border border-blue-100 dark:border-blue-800/50">
                HYBRID ACTIVE ({{ debugInfo.reductionPercentage }}% reduced)
              </span>
            </div>
            <div class="mt-2 text-[9px] text-slate-400 italic">
              * ข้อมูลที่แสดงคือตารางที่ AI ใช้ในการพิจารณาสร้าง SQL สำหรับคำถามนี้
            </div>
          </div>
        </transition>

      </form>
    </section>

    <!-- AI Output Area (Loading or Result) -->
    <div class="grid grid-cols-1 grid-rows-1 mt-12">
      <transition name="fade">
        <!-- Skeleton Loading State (Detailed & Colorful) -->
        <div v-if="isGenerating" key="skeleton" class="col-start-1 row-start-1 space-y-6 animate-pulse">
          <div class="rounded-[2.5rem] overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-xl bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
            <!-- Header Skeleton -->
            <div class="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
              <div class="flex-1 p-8 space-y-5">
                <div class="flex items-center gap-2">
                  <div class="w-4 h-4 bg-blue-200 dark:bg-blue-900/40 rounded-md"></div>
                  <div class="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                </div>
                <div class="space-y-3">
                  <div class="h-5 w-full bg-slate-100 dark:bg-slate-900 rounded-xl"></div>
                  <div class="h-5 w-4/5 bg-slate-100 dark:bg-slate-900 rounded-xl"></div>
                  <div class="h-5 w-2/3 bg-slate-100 dark:bg-slate-900 rounded-xl opacity-50"></div>
                </div>
              </div>
              <div class="md:w-56 p-8 flex flex-col justify-center items-center gap-3 bg-slate-50/30 dark:bg-slate-900/10">
                <div class="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                <div class="h-16 w-32 bg-indigo-100 dark:bg-indigo-900/40 rounded-3xl border border-indigo-200/50 dark:border-indigo-800/50"></div>
                <div class="h-3 w-24 bg-blue-100 dark:bg-blue-900/40 rounded-lg"></div>
              </div>
            </div>
            
            <!-- Footer Skeleton -->
            <div class="p-8 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"></div>
                <div class="space-y-2">
                  <div class="h-3 w-32 bg-slate-300 dark:bg-slate-700 rounded-lg"></div>
                  <div class="h-2.5 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                </div>
              </div>
              <div class="flex gap-4 w-full md:w-auto">
                <div class="h-14 flex-1 md:w-28 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                <div class="h-14 flex-1 md:w-48 bg-blue-500/20 dark:bg-blue-600/20 rounded-3xl border border-blue-500/20 dark:border-blue-500/10"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Output & Preview (Result Zone) -->
        <div v-else-if="generatedResult && (generatedResult.status === 'success' || generatedResult.status === 'error' || generatedResult.status === 'draft')" key="result" ref="resultSection" class="col-start-1 row-start-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <!-- Background Glow Effect (Subtle) -->
          <div class="absolute -inset-4 bg-gradient-to-tr from-blue-500/10 via-indigo-500/5 to-purple-500/10 blur-2xl -z-10 opacity-60"></div>
          
          <div class="rounded-[2.5rem] overflow-hidden border-2 border-white dark:border-slate-800 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] relative z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl ring-1 ring-blue-500/20">
            <!-- Top Accent Gradient Line -->
            <div class="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>
          <div class="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
            <div class="flex-1 p-8 bg-slate-50/30 dark:bg-slate-900/20 relative group/summary">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    <Wand2 class="w-4 h-4" />
                    AI Analysis Summary
                  </div>
                  <span v-if="generatedResult.modelUsed" class="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[8px] font-mono border border-slate-300 dark:border-slate-700">
                    {{ generatedResult.modelUsed }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    @click="copyExplanation"
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider"
                    title="คัดลอกคำอธิบาย"
                  >
                    <Copy v-if="!isExplanationCopied" class="w-3.5 h-3.5" />
                    <CheckCircle2 v-else class="w-3.5 h-3.5 text-emerald-500" />
                    {{ isExplanationCopied ? 'Copied' : 'Copy' }}
                  </button>
                  <button 
                    @click="isSqlModalOpen = true"
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider"
                    title="ดูคำสั่ง SQL ที่ใช้ดึงข้อมูล"
                  >
                    <Terminal class="w-3.5 h-3.5" />
                    View SQL
                  </button>
                </div>
              </div>
              <div class="text-slate-700 dark:text-slate-200 leading-relaxed text-sm font-medium prose prose-slate dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-1 max-w-none prose-markdown" v-html="renderedExplanation"></div>

              <!-- Optimization Explanation -->
              <div v-if="isOptimized && optimizationExplanation" class="mt-6 p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles class="w-4 h-4" />
                    การปรับปรุงประสิทธิภาพโดย AI (Auto-Optimized):
                  </h4>
                  <span v-if="generatedResult.optimizeModelUsed" class="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-md text-[8px] font-mono border border-indigo-200 dark:border-indigo-800">
                    {{ generatedResult.optimizeModelUsed }}
                  </span>
                </div>
                <div class="prose prose-indigo dark:prose-invert prose-sm max-w-none text-indigo-900 dark:text-indigo-200 prose-markdown">
                  <div v-html="formatExplanation(optimizationExplanation)"></div>
                </div>
              </div>
            </div>
            
            <div class="md:w-56 p-8 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-center items-center text-center">
              <span class="font-bold text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Total Records</span>
              <div v-if="generatedResult.status !== 'draft'" class="text-5xl font-black tracking-tighter" :class="generatedResult.previewCount > 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'">
                {{ (generatedResult.previewCount ?? 0).toLocaleString() }}
              </div>
              <div v-else class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Search class="w-6 h-6" />
              </div>
              <p class="text-[10px] font-black mt-1 text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">
                {{ generatedResult.status === 'draft' ? 'พร้อมตรวจสอบ' : 'รายการที่พบ' }}
              </p>
            </div>
          </div>

          <!-- Draft SQL Block -->
          <div v-if="generatedResult.status === 'draft'" class="p-8 bg-blue-50/30 dark:bg-blue-900/10 border-b border-slate-200 dark:border-slate-800">
            <div class="flex flex-col gap-6">
              <div class="flex items-start gap-4 text-blue-600 dark:text-blue-400">
                <div class="p-3 bg-white dark:bg-blue-900/30 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800 shrink-0">
                  <Terminal class="w-6 h-6" />
                </div>
                <div class="space-y-1 flex-1">
                  <h5 class="text-sm font-black uppercase tracking-wider">ตรวจสอบและรันคำสั่ง SQL</h5>
                  <p class="text-xs font-medium leading-relaxed opacity-80">AI ได้สร้างคำสั่ง SQL ดราฟต์ไว้ให้แล้ว คุณสามารถตรวจสอบหรือแก้ไขก่อนรันจริง:</p>
                  
                  <div v-if="isOptimized" class="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <!-- Original SQL -->
                    <div class="p-5 bg-slate-50 dark:bg-slate-950 rounded-3xl font-mono text-[11px] overflow-x-auto border border-slate-200 dark:border-slate-800 shadow-inner group/origsql relative opacity-70">
                      <div class="mb-3 text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-[0.2em] flex justify-between items-center">
                        <span>Original SQL:</span>
                        <button @click="revertToOriginalSql" class="text-[9px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1 transition-colors">
                          <RotateCcw class="w-3 h-3"/> กลับไปใช้คำสั่งเดิม
                        </button>
                      </div>
                      <pre class="whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-400"><code class="sql-highlight" v-html="highlightSql(originalSql || '')"></code></pre>
                    </div>

                    <!-- Optimized SQL -->
                    <div class="p-5 bg-white dark:bg-slate-900 rounded-3xl font-mono text-[11px] overflow-x-auto border-2 border-indigo-200 dark:border-indigo-800 shadow-sm group/optsql relative">
                      <div class="mb-3 text-[9px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-[0.2em] flex justify-between items-center">
                        <span class="flex items-center gap-1"><Sparkles class="w-3 h-3"/> Optimized SQL (ใช้อยู่):</span>
                        <button @click="copySql" class="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                          <Copy class="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <pre class="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-indigo-100"><code class="sql-highlight" v-html="highlightSql(generatedResult.sql)"></code></pre>
                    </div>
                  </div>
                  
                  <div v-else class="mt-4 p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl font-mono text-[11px] overflow-x-auto border border-blue-100 dark:border-blue-900/30 shadow-inner group/draftsql relative">
                    <div class="mb-3 text-[9px] font-black uppercase text-blue-500/50 dark:text-blue-400/30 tracking-[0.2em] flex justify-between items-center">
                      <span>Draft SQL:</span>
                      <button @click="copySql" class="hover:text-blue-600 dark:hover:text-blue-300 transition-colors p-1.5 rounded-lg bg-blue-100/50 dark:bg-white/5">
                        <Copy class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <pre class="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-blue-100"><code class="sql-highlight" v-html="highlightSql(generatedResult.sql)"></code></pre>
                  </div>
                </div>
              </div>
              
              <div class="flex flex-col sm:flex-row items-center justify-end gap-4">
                <button 
                  @click="optimizeSql"
                  :disabled="isOptimizing"
                  class="w-full sm:w-auto px-8 py-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-black rounded-2xl border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest disabled:opacity-50"
                  title="ให้ AI ช่วยปรับปรุง SQL ให้เร็วและมีประสิทธิภาพมากขึ้น"
                >
                  <Sparkles v-if="!isOptimizing" class="w-4 h-4" />
                  <Loader2 v-else class="w-4 h-4 animate-spin" />
                  Optimize SQL
                </button>
                <button 
                  @click="openManualSqlEditor"
                  class="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest"
                >
                  <Edit3 class="w-4 h-4" />
                  แก้ไข SQL
                </button>
                <button 
                  @click="runDraftQuery"
                  class="w-full sm:w-auto px-12 py-4 text-white text-sm font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest"
                  :class="isUpdatingSql ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'"
                >
                  <template v-if="isUpdatingSql">
                    <Loader2 class="w-5 h-5 animate-spin" />
                    <span class="flex items-center gap-2">กำลังดึงข้อมูล... <span class="text-rose-200 text-xs ml-1">(คลิกเพื่อหยุด)</span></span>
                  </template>
                  <template v-else>
                    <Database class="w-5 h-5" />
                    รัน Query ทันที
                  </template>
                </button>
              </div>
            </div>
          </div>

          <!-- SQL Error Block -->
          <div v-if="generatedResult.status === 'error'" class="p-8 bg-rose-50/50 dark:bg-rose-900/10 border-b border-slate-200 dark:border-slate-800">
            <div class="flex flex-col gap-6">
              <div class="flex items-start gap-4 text-rose-600 dark:text-rose-400">
                <div class="p-3 bg-white dark:bg-rose-900/30 rounded-2xl shadow-sm border border-rose-100 dark:border-rose-800 shrink-0">
                  <AlertTriangle class="w-6 h-6" />
                </div>
                <div class="space-y-1">
                  <h5 class="text-sm font-black uppercase tracking-wider">เกิดข้อผิดพลาดในการประมวลผล SQL</h5>
                  <p class="text-xs font-medium leading-relaxed opacity-80">AI อาจสร้างคำสั่ง SQL ที่ไม่ถูกต้องตามโครงสร้างฐานข้อมูลปัจจุบัน:</p>
                  <div class="mt-2 space-y-3">
                    <div class="p-4 bg-rose-100/50 dark:bg-slate-900 rounded-xl font-mono text-[10px] text-rose-700 dark:text-rose-300 overflow-x-auto border border-rose-200 dark:border-rose-900/30">
                      <div class="mb-2 text-[8px] font-black uppercase text-rose-500/50 tracking-widest">Database Error:</div>
                      {{ generatedResult.dbError }}
                    </div>
                    <div class="p-4 bg-rose-100/50 dark:bg-slate-900 rounded-xl font-mono text-[10px] text-rose-800 dark:text-rose-400 overflow-x-auto border border-rose-200 dark:border-rose-900/30 group/errsql relative">
                      <div class="mb-2 text-[8px] font-black uppercase text-rose-500/50 tracking-widest flex justify-between items-center">
                        <span>Attempted SQL Query:</span>
                        <button @click="copySql" class="hover:text-rose-300 transition-colors">
                          <Copy class="w-3 h-3" />
                        </button>
                      </div>
                      <pre class="whitespace-pre-wrap leading-relaxed">{{ generatedResult.sql }}</pre>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="flex flex-col sm:flex-row items-center gap-4">
                <button 
                  @click="refineQuestion"
                  class="w-full sm:w-auto px-8 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest border border-slate-200 dark:border-slate-700"
                >
                  <Edit3 class="w-4 h-4" />
                  ปรับปรุงคำถาม
                </button>
                <button 
                  @click="reportError"
                  :disabled="isReportingError"
                  class="w-full sm:w-auto px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-2xl shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest"
                >
                  <Mail v-if="!isReportingError" class="w-4 h-4" />
                  <RotateCcw v-else class="w-4 h-4 animate-spin" />
                  {{ isReportingError ? 'กำลังส่งรายงาน...' : 'รายงานปัญหานี้ให้ Admin' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Zero Records Warning & Refine Button -->
          <div v-if="generatedResult.status === 'success' && generatedResult.previewCount === 0" class="p-8 bg-rose-50/50 dark:bg-rose-900/10 border-b border-slate-200 dark:border-slate-800">

            <div class="flex flex-col md:flex-row items-center justify-between gap-6">
              <div class="flex items-center gap-4 text-rose-600 dark:text-rose-400">
                <AlertTriangle class="w-6 h-6 shrink-0" />
                <p class="text-sm font-bold">ไม่พบข้อมูลที่ตรงตามเงื่อนไขที่คุณระบุ โปรดลองปรับปรุงคำถามใหม่อีกครั้ง</p>
              </div>
              <button 
                @click="refineQuestion"
                class="w-full md:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest"
              >
                <Edit3 class="w-4 h-4" />
                ปรับปรุงคำถาม
              </button>
            </div>
          </div>

          <!-- Data Over Limit Warning (Case: Overridden by System) -->
          <div v-if="generatedResult.limitOverridden" class="mx-8 mt-8 p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
            <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle class="w-6 h-6 text-amber-600" />
            </div>
            <div class="flex-1">
              <h5 class="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-0.5">จำกัดจำนวนการดึงข้อมูล</h5>
              <p class="text-xs font-medium text-amber-800 dark:text-amber-400 leading-relaxed">
                เนื่องจากจำนวนที่คุณขอมาเกินกว่าที่ระบบอนุญาต ระบบจึงปรับลดให้เหลือเพียง <b class="text-amber-900 dark:text-amber-100">{{ generatedResult.maxResultsLimit.toLocaleString() }}</b> รายการ ตามนโยบายความปลอดภัยและเพื่อประสิทธิภาพของฐานข้อมูลครับ
              </p>
            </div>
          </div>

          <!-- Data Over Limit Warning (Case: Natural Result > Limit) -->
          <div v-else-if="generatedResult.previewCount > generatedResult.maxResultsLimit" class="mx-8 mt-8 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
            <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle class="w-6 h-6 text-amber-600" />
            </div>
            <div class="flex-1">
              <h5 class="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-0.5">จำนวนข้อมูลเกินขีดจำกัดที่กำหนด</h5>
              <p class="text-xs font-medium text-amber-800 dark:text-amber-400 leading-relaxed">
                พบข้อมูลทั้งหมด <b class="text-amber-900 dark:text-amber-100">{{ generatedResult.previewCount.toLocaleString() }}</b> รายการ 
                แต่ระบบจะอนุมัติให้ดึงได้เพียง <b class="text-amber-900 dark:text-amber-100">{{ generatedResult.maxResultsLimit.toLocaleString() }}</b> รายการแรกเท่านั้น 
                ตามนโยบายความปลอดภัยของบริษัท
              </p>
            </div>
          </div>

          <!-- Section 2: Data Preview Table -->
          <div v-if="generatedResult.previewData" class="p-8 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-700">
                  <Database class="w-4 h-4" />
                </div>
                <div>
                  <div class="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">Data Insights</div>
                  <h4 class="text-sm font-bold text-slate-900 dark:text-white">ตัวอย่างข้อมูล {{ generatedResult.previewData.length }} รายการแรก</h4>
                </div>
              </div>
              <button 
                @click="showPreview = !showPreview"
                class="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300"
              >
                <component :is="showPreview ? X : Wand2" class="w-4 h-4" />
                {{ showPreview ? 'ซ่อนตัวอย่าง' : 'แสดงตัวอย่างข้อมูล' }}
              </button>
            </div>

            <transition name="fade">
              <div v-if="showPreview" class="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm max-h-[400px] overflow-y-auto custom-scrollbar">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
                      <th v-for="(val, key) in generatedResult.previewData[0]" :key="key" class="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                        {{ key }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr v-for="(row, idx) in generatedResult.previewData" :key="idx" class="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                      <td v-for="(val, key) in row" :key="key" class="px-5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {{ val }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </transition>
          </div>


          <!-- Section 4: Action Footer -->
          <div class="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-center gap-8">
            <div class="flex items-center gap-4 w-full lg:w-auto">
              <div class="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                <ShieldCheck class="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Ready for Approval</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">ชุดคำสั่งนี้ปลอดภัยและพร้อมสำหรับการส่งคำขออนุมัติ</p>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
              <!-- Secondary Actions Group -->
              <div class="flex flex-nowrap items-center justify-center gap-3 w-full sm:w-auto">
                <button @click="generatedResult = null" class="px-4 py-3 text-xs font-black text-slate-400 hover:text-rose-600 transition-all uppercase tracking-widest">
                  ยกเลิก
                </button>
                <button 
                  @click="refineQuestion"
                  class="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest border border-slate-200 dark:border-slate-700"
                >
                  <Edit3 class="w-3.5 h-3.5" />
                  ปรับปรุงคำถาม
                </button>

                <button 
                  @click="isFavoriteModalOpen = true"
                  class="px-5 py-3.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all border border-amber-200 dark:border-amber-800/50 text-xs font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest whitespace-nowrap"
                >
                  <Star class="w-3.5 h-3.5" />
                  บันทึกรายการโปรด
                </button>
              </div>

              <!-- Vertical Divider (Hidden on mobile) -->
              <div class="hidden sm:block w-px h-10 bg-slate-200 dark:bg-slate-800 mx-2"></div>

              <!-- Primary Action Group -->
              <div class="w-full sm:w-auto flex items-center gap-3">
                <!-- Chat with AI button (Admin only) -->
                <button
                  v-if="isAdmin"
                  @click="openChatModal"
                  :disabled="!generatedResult || generatedResult.previewCount === 0"
                  class="px-5 py-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:grayscale text-white rounded-[2rem] shadow-2xl shadow-violet-500/30 transition-all flex items-center gap-2 active:scale-95"
                  title="แชตถาม AI จากข้อมูลนี้"
                >
                  <MessageSquare class="w-5 h-5" />
                  <span class="text-xs font-black uppercase tracking-widest">แชต AI</span>
                </button>

                <div v-if="isAdmin" class="grid grid-cols-2 shadow-2xl shadow-emerald-500/30 rounded-[2rem] overflow-hidden min-w-[240px]">
                  <button
                    @click="openCsvModal"
                    :disabled="isRequesting || generatedResult.previewCount === 0"
                    class="py-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:grayscale text-white text-sm font-black transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest border-r border-emerald-500/50"
                  >
                    <Download class="w-5 h-5" />
                    <span>CSV</span>
                  </button>
                  <button
                    @click="openZohoModal"
                    :disabled="isRequesting || generatedResult.previewCount === 0"
                    class="py-5 bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center active:scale-95 border-l border-emerald-700/30 group/zoho"
                    title="Export to Zoho Sheet"
                  >
                    <div class="flex items-center gap-2">
                      <LayoutGrid class="w-5 h-5" />
                      <span class="text-xs font-black uppercase">Zoho</span>
                    </div>
                  </button>
                </div>
                
                <button 
                  v-else
                  @click="isRequestModalOpen = true"
                  :disabled="isRequesting || generatedResult.previewCount === 0"
                  class="w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale text-white text-sm font-black rounded-3xl shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest"
                >
                  <span>ขออนุมัติดึงข้อมูล</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </transition>
  </div>

    <!-- Request Approval Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isRequestModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <div class="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-50/30 dark:bg-blue-900/10">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <ShieldCheck class="w-7 h-7" />
                  </div>
                  <div>
                    <h3 class="text-xl font-black text-slate-900 dark:text-white">ส่งคำขออนุมัติ</h3>
                    <p class="text-xs font-bold text-blue-600/60 dark:text-blue-400/60 uppercase tracking-[0.2em] mt-0.5">Final Confirmation</p>
                  </div>
                </div>
                <button @click="isRequestModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X class="w-6 h-6" />
                </button>
              </div>
              
              <div class="p-10 space-y-8">
                <div class="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                  <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">สรุปคำขอของคุณ</h4>
                  <p class="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">"{{ prompt }}"</p>
                  <div class="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600">
                    <Database class="w-4 h-4" />
                    พบข้อมูลประมาณ {{ generatedResult?.previewCount }} รายการ
                  </div>
                </div>

                <div class="space-y-4">
                  <label class="block text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                    เหตุผลในการขอข้อมูล <span class="text-rose-500">*</span>
                  </label>
                  <textarea 
                    v-model="requestReason" 
                    placeholder="อธิบายเหตุผลให้หัวหน้างานทราบ (เช่น ใช้สำหรับรายงานสรุปยอดขายประจำไตรมาส 1)..." 
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl px-6 py-5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all resize-none h-40 text-lg leading-relaxed shadow-inner"
                    autofocus
                  ></textarea>
                  <p class="text-[11px] text-slate-400 font-medium px-1 flex items-center gap-1.5">
                    <Info class="w-3.5 h-3.5" />
                    คำขอที่ระบุเหตุผลชัดเจนจะได้รับการพิจารณาเร็วกว่าปกติ
                  </p>
                </div>
                
                <div class="pt-4 flex flex-col sm:flex-row justify-end gap-4">
                  <button 
                    @click="isRequestModalOpen = false"
                    class="px-8 py-5 text-sm font-black text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-widest"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    @click="() => requestApproval()"
                    :disabled="isRequesting || !requestReason"
                    class="px-12 py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-base font-black rounded-3xl shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest"
                  >
                    <RotateCcw v-if="isRequesting" class="w-5 h-5 animate-spin" />
                    <span>ยืนยันการส่งคำขอ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- SQL Viewer Modal -->

    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div
            v-if="isSqlModalOpen"
            class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md"
            :class="isSqlModalFullscreen ? '' : 'p-6'"
            @click="!isSqlModalFullscreen && (isSqlModalOpen = false)"
          >
            <div
              class="bg-white dark:bg-slate-900 shadow-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col"
              :class="isSqlModalFullscreen ? 'h-full rounded-none max-w-none' : 'rounded-[2rem] max-w-4xl max-h-[90vh]'"
              @click.stop
            >
              <!-- Header -->
              <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 shrink-0">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Terminal class="w-6 h-6" />
                  </div>
                  <div>
                    <h3 class="text-lg font-black text-slate-900 dark:text-white">Generated SQL Command</h3>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ชุดคำสั่งที่ใช้ในการดึงข้อมูลจาก Database</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="isAdmin && !isEditingSql"
                    @click="startEditingSql"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all active:scale-95 text-xs font-bold"
                  >
                    <Edit3 class="w-4 h-4" />
                    แก้ไข SQL
                  </button>
                  <button
                    v-if="!isEditingSql"
                    @click="copySql"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95 text-xs font-bold"
                  >
                    <Copy class="w-4 h-4" />
                    {{ isCopied ? 'คัดลอกแล้ว' : 'คัดลอก SQL' }}
                  </button>
                  <button
                    @click="isSqlModalFullscreen = !isSqlModalFullscreen"
                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    :title="isSqlModalFullscreen ? 'ย่อขนาด' : 'ขยายเต็มจอ'"
                  >
                    <Maximize2 v-if="!isSqlModalFullscreen" class="w-5 h-5" />
                    <Minimize2 v-else class="w-5 h-5" />
                  </button>
                  <button @click="isSqlModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X class="w-6 h-6" />
                  </button>
                </div>
              </div>

              <!-- Content -->
              <div class="p-8 flex flex-col flex-1 overflow-auto gap-6">
                <!-- View mode -->
                <div
                  v-if="!isEditingSql"
                  class="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 shadow-inner overflow-auto custom-scrollbar flex-1"
                >
                  <pre class="text-sm font-mono leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200"><code class="sql-highlight" v-html="highlightSql(generatedResult?.sql)"></code></pre>
                </div>

                <!-- Edit mode -->
                <template v-else>
                  <div class="relative group flex-1 flex flex-col">
                    <textarea
                      v-model="editedSql"
                      class="flex-1 w-full bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm leading-relaxed outline-none resize-none custom-scrollbar text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                      :style="isSqlModalFullscreen ? 'min-height: 0' : 'min-height: 50vh'"
                      placeholder="แก้ไขคำสั่ง SQL ที่นี่..."
                    ></textarea>
                    <div class="absolute top-4 right-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">SQL Editor Mode</div>
                  </div>

                  <!-- Error block -->
                  <div v-if="sqlModalError" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-start gap-3 shrink-0">
                    <AlertCircle class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-red-700 dark:text-red-400">SQL Error</p>
                      <p class="text-xs text-red-600 dark:text-red-400 mt-1 font-mono break-all">{{ sqlModalError }}</p>
                    </div>
                  </div>

                  <div class="flex items-center justify-end gap-4 shrink-0">
                    <button
                      @click="cancelEditingSql"
                      class="px-8 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-sm"
                    >
                      ยกเลิก
                    </button>
                    <button
                      @click="updateSql"
                      :disabled="isUpdatingSql || !editedSql"
                      class="px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl hover:scale-105 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:scale-100 shadow-lg shadow-blue-500/20"
                    >
                      <RotateCcw v-if="isUpdatingSql" class="w-4 h-4 animate-spin" />
                      <ShieldCheck v-else class="w-4 h-4" />
                      ตกลง และ Query ใหม่
                    </button>
                  </div>
                </template>

                <!-- Security badge -->
                <div class="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-center gap-3 shrink-0">
                  <ShieldCheck class="w-5 h-5 text-emerald-500" />
                  <span class="text-xs font-medium text-emerald-700 dark:text-emerald-400">คำสั่งนี้ผ่านการตรวจสอบความปลอดภัยและอนุญาตให้ใช้งานแบบ Read-only เท่านั้น</span>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>
    <!-- Favorite Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isFavoriteModalOpen" class="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-amber-50/30 dark:bg-amber-900/10">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Star class="w-6 h-6 fill-current" />
                  </div>
                  <h3 class="text-lg font-black text-slate-900 dark:text-white">บันทึกเป็นรายการโปรด</h3>
                </div>
                <button @click="isFavoriteModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <X class="w-6 h-6" />
                </button>
              </div>
              
              <div class="p-8 space-y-6">
                <div class="space-y-2">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">ชื่อรายการโปรด</label>
                  <input 
                    v-model="favoriteTitle"
                    type="text"
                    placeholder="เช่น รายงานยอดขายประจำเดือน..."
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold"
                    autofocus
                    @keyup.enter="saveFavorite"
                  />
                </div>

                <div class="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 italic">
                  "{{ prompt }}"
                </div>

                <div class="flex gap-3">
                  <button 
                    @click="isFavoriteModalOpen = false"
                    class="flex-1 py-4 text-xs font-black text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-widest"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    @click="saveFavorite"
                    :disabled="isSavingFavorite || !favoriteTitle"
                    class="flex-[2] py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest"
                  >
                    <RotateCcw v-if="isSavingFavorite" class="w-4 h-4 animate-spin" />
                    <Bookmark v-else class="w-4 h-4" />
                    <span>บันทึกรายการโปรด</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- Zoho Sheet Export Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isZohoModalOpen" class="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div class="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col animate-in zoom-in-95 duration-200">
              <!-- Header -->
              <div class="p-6 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                <div class="flex items-center gap-3">
                  <h3 class="text-xl font-bold tracking-tight">New external share link</h3>
                  <div class="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/20 uppercase">
                    <LayoutGrid class="w-3 h-3" />
                    zoho_sheet
                  </div>
                </div>
                <button @click="isZohoModalOpen = false; zohoSuccessDone = false" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400 dark:text-white/50">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Zoho Success State -->
              <div v-if="zohoSuccessDone" class="p-10 flex flex-col items-center text-center gap-5">
                <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 class="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div class="space-y-1.5">
                  <p class="text-base font-black text-slate-900 dark:text-white">อัพโหลดสำเร็จ!</p>
                  <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">ระบบอนุมัติคำขอนี้อัตโนมัติ<br>บันทึกลงประวัติการใช้งานและอัพโหลดไปยัง Zoho WorkDrive เรียบร้อยแล้ว</p>
                </div>
                <button
                  @click="isZohoModalOpen = false; zohoSuccessDone = false; generatedResult = null"
                  class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all"
                >
                  ปิด
                </button>
              </div>

              <!-- Content -->
              <div v-if="!zohoSuccessDone" class="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <!-- File Name -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">ชื่อไฟล์</label>
                  <input
                    v-model="zohoOptions.linkName"
                    type="text"
                    placeholder="เช่น Sales_Report, Customer_List"
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">ไฟล์จะถูกบันทึกเป็น <span class="font-mono">{{ (zohoOptions.linkName || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙]/g, '_') }}_[timestamp].csv</span></p>
                </div>

                <!-- User Owner -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">เจ้าของไฟล์ (User Owner)</label>
                  <div class="relative" @click="fetchVtigerUsers()">
                    <input
                      v-model="zohoOwnerSearch"
                      type="text"
                      placeholder="ค้นหาชื่อผู้ใช้..."
                      @focus="showZohoOwnerDropdown = true"
                      @blur="hideZohoOwnerDropdown"
                      @input="zohoOwnerVtigerId = null"
                      class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 pr-8 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                    />
                    <button
                      v-if="zohoOwnerVtigerId"
                      @mousedown.prevent="zohoOwnerVtigerId = null; zohoOwnerSearch = ''"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X class="w-4 h-4" />
                    </button>
                    <ul
                      v-show="showZohoOwnerDropdown && filteredZohoUsers.length"
                      class="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-auto max-h-48"
                    >
                      <li
                        v-for="u in filteredZohoUsers"
                        :key="u.id"
                        @mousedown.prevent="selectZohoOwner(u)"
                        class="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        :class="zohoOwnerVtigerId === u.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''"
                      >
                        <span class="text-sm font-medium text-slate-900 dark:text-slate-100">{{ [u.firstName, u.lastName].filter(Boolean).join(' ') || u.userName }}</span>
                        <span class="text-[11px] text-slate-400 dark:text-slate-500 truncate">{{ u.email1 }}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- วันหมดอายุ -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">วันหมดอายุลิงก์</label>
                  <input
                    v-model="zohoExpiresAt"
                    type="date"
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">ลิงก์จะหมดอายุหลังจากวันที่กำหนด (ว่างไว้ = ไม่มีวันหมดอายุ)</p>
                </div>

                <!-- Info Box -->
                <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-4">
                  <ul class="space-y-2 text-xs text-emerald-700 dark:text-emerald-300/80 list-disc pl-4">
                    <li>ไฟล์จะถูกอัพโหลดเป็น <strong>.csv</strong> ไปยัง Zoho WorkDrive โฟลเดอร์ <strong>AI Queries</strong></li>
                    <li>สามารถเปิดและแก้ไขได้ใน Zoho Sheet</li>
                    <li>หากต้องการแชร์ link ให้ผู้อื่น สามารถสร้าง External Share Link ได้จาก WorkDrive UI</li>
                  </ul>
                </div>
              </div>

              <!-- Footer -->
              <div v-if="!zohoSuccessDone" class="p-6 flex items-center justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                <button @click="isZohoModalOpen = false; zohoSuccessDone = false" class="px-7 py-3.5 text-sm font-bold text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border border-slate-200 dark:border-white/10">
                  Cancel
                </button>
                <button
                  @click="handleZohoExport"
                  :disabled="isExportingZoho"
                  class="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <Loader2 v-if="isExportingZoho" class="w-4 h-4 animate-spin" />
                  {{ isExportingZoho ? 'Creating...' : 'Create' }}
                </button>
              </div>

              <!-- Result Link (If exists) -->
              <div v-if="generatedZohoLink" class="p-6 bg-emerald-50 dark:bg-emerald-500/10 border-t border-emerald-100 dark:border-emerald-500/20">
                <div class="flex items-center justify-between gap-3 bg-white dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-white/10">
                  <div class="truncate text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">{{ generatedZohoLink }}</div>
                  <button @click="copyToClipboard(generatedZohoLink)" class="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all shrink-0">
                    <Copy class="w-4 h-4 text-slate-400 dark:text-white/50" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- Data Guide Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isDataGuideModalOpen" class="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10 bg-slate-900/80 backdrop-blur-xl">
            <div class="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <!-- Modal Header -->
              <div class="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Database class="w-6 h-6" />
                  </div>
                  <div>
                    <h3 class="text-xl font-black text-slate-900 dark:text-white">สามารถขอข้อมูลอะไรได้บ้าง?</h3>
                    <p class="text-xs text-slate-500 font-medium">สรุปข้อมูลที่มีในระบบโดย AI (อัปเดตตามสถานะปัจจุบัน)</p>
                  </div>
                </div>
                <button @click="isDataGuideModalOpen = false" class="p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
                  <X class="w-6 h-6" />
                </button>
              </div>

              <!-- Modal Content -->
              <div class="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div v-if="isLoadingDataGuide" class="flex flex-col items-center justify-center py-20 space-y-6">
                  <div class="relative w-20 h-20">
                    <div class="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                      <BrainCircuit class="w-8 h-8 text-indigo-600 animate-pulse" />
                    </div>
                  </div>
                  <div class="text-center space-y-2">
                    <p class="text-lg font-black text-slate-900 dark:text-white">กำลังให้ AI วิเคราะห์ขอบเขตข้อมูล...</p>
                    <p class="text-sm text-slate-500 font-medium">ระบบกำลังประมวลผลค่าคงที่และตรรกะในระบบปัจจุบัน</p>
                  </div>
                </div>

                <div v-else class="prose prose-slate dark:prose-invert max-w-none data-guide-content">
                  <div v-html="renderedDataGuide" class="text-slate-700 dark:text-slate-300 leading-relaxed font-medium"></div>
                </div>
              </div>

              <!-- Modal Footer -->
              <div class="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <button 
                  @click="isDataGuideModalOpen = false"
                  class="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest"
                >
                  เข้าใจแล้ว
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- CSV Download Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isCsvConfirmModalOpen" class="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div class="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col animate-in zoom-in-95 duration-200" @click.stop>
              <!-- Header -->
              <div class="p-6 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                <div class="flex items-center gap-3">
                  <h3 class="text-xl font-bold tracking-tight">ดาวน์โหลดไฟล์ CSV</h3>
                  <div class="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/20 uppercase">
                    <Download class="w-3 h-3" />
                    CSV
                  </div>
                </div>
                <button @click="isCsvConfirmModalOpen = false; csvSuccessDone = false" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400 dark:text-white/50">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Success State -->
              <div v-if="csvSuccessDone" class="p-10 flex flex-col items-center text-center gap-5">
                <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 class="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div class="space-y-1.5">
                  <p class="text-base font-black text-slate-900 dark:text-white">ดำเนินการสำเร็จ!</p>
                  <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">ระบบอนุมัติคำขอนี้อัตโนมัติ<br>บันทึกลงประวัติการใช้งานเรียบร้อยแล้ว</p>
                </div>
                <button
                  @click="isCsvConfirmModalOpen = false; csvSuccessDone = false; prompt = ''; requestReason = ''; generatedResult = null"
                  class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all"
                >
                  ปิด
                </button>
              </div>

              <!-- Content -->
              <div v-if="!csvSuccessDone" class="p-8 space-y-6">
                <!-- File Name Input -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">ชื่อไฟล์</label>
                  <div class="flex items-stretch">
                    <input
                      v-model="csvFilename"
                      type="text"
                      placeholder="เช่น Sales_Report, Customer_List"
                      @keyup.enter="isCsvConfirmModalOpen = false; requestApproval()"
                      class="flex-1 bg-slate-50 dark:bg-white/5 border border-r-0 border-slate-200 dark:border-white/10 rounded-l-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                    />
                    <span class="bg-slate-100 dark:bg-white/10 border border-l-0 border-slate-200 dark:border-white/10 rounded-r-xl px-4 py-3 text-sm text-slate-400 dark:text-white/30 font-mono flex items-center">.csv</span>
                  </div>
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">
                    ไฟล์จะถูกบันทึกเป็น <span class="font-mono">{{ ((csvFilename || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙\s_-]/g, '').trim().replace(/\s+/g, '_') || 'AI_Export') + '.csv' }}</span>
                  </p>
                </div>

                <!-- User Owner -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">เจ้าของไฟล์ (User Owner)</label>
                  <div class="relative" @click="fetchVtigerUsers()">
                    <input
                      v-model="csvOwnerSearch"
                      type="text"
                      placeholder="ค้นหาชื่อผู้ใช้..."
                      @focus="showCsvOwnerDropdown = true"
                      @blur="hideCsvOwnerDropdown"
                      @input="csvOwnerVtigerId = null"
                      class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 pr-8 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                    />
                    <button
                      v-if="csvOwnerVtigerId"
                      @mousedown.prevent="csvOwnerVtigerId = null; csvOwnerSearch = ''"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X class="w-4 h-4" />
                    </button>
                    <ul
                      v-show="showCsvOwnerDropdown && filteredCsvUsers.length"
                      class="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-auto max-h-48"
                    >
                      <li
                        v-for="u in filteredCsvUsers"
                        :key="u.id"
                        @mousedown.prevent="selectCsvOwner(u)"
                        class="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        :class="csvOwnerVtigerId === u.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''"
                      >
                        <span class="text-sm font-medium text-slate-900 dark:text-slate-100">{{ [u.firstName, u.lastName].filter(Boolean).join(' ') || u.userName }}</span>
                        <span class="text-[11px] text-slate-400 dark:text-slate-500 truncate">{{ u.email1 }}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Expiry Date -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">วันหมดอายุ (Expires At)</label>
                  <input
                    v-model="csvExpiresAt"
                    type="date"
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">ไฟล์จะดาวน์โหลดได้ถึงวันที่นี้</p>
                </div>

                <!-- Info Box -->
                <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-4">
                  <p class="text-xs text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                    ระบบจะ<strong>อนุมัติคำขอนี้อัตโนมัติ</strong> บันทึกลงประวัติการใช้งาน และเริ่มดาวน์โหลดไฟล์ทันที
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div v-if="!csvSuccessDone" class="p-6 flex items-center justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                <button
                  @click="isCsvConfirmModalOpen = false; csvSuccessDone = false"
                  class="px-7 py-3.5 text-sm font-bold text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border border-slate-200 dark:border-white/10"
                >
                  ยกเลิก
                </button>
                <button
                  @click="requestApproval(true)"
                  :disabled="isRequesting"
                  class="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  <RotateCcw v-if="isRequesting" class="w-4 h-4 animate-spin" />
                  <CheckCircle2 v-else class="w-4 h-4" />
                  ยืนยัน
                </button>
                <button
                  @click="requestApproval(false)"
                  :disabled="isRequesting"
                  class="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <RotateCcw v-if="isRequesting" class="w-4 h-4 animate-spin" />
                  <Download v-else class="w-4 h-4" />
                  ยืนยัน / ดาวน์โหลด
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- Delete Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isDeleteConfirmModalOpen" class="fixed inset-0 z-[140] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <div class="p-8 text-center space-y-6">
                <div class="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center text-rose-500 mx-auto border border-rose-100 dark:border-rose-800/50">
                  <AlertTriangle class="w-10 h-10" />
                </div>
                
                <div class="space-y-2">
                  <h3 class="text-xl font-black text-slate-900 dark:text-white">ยืนยันการลบ?</h3>
                  <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">คุณแน่ใจหรือไม่ว่าต้องการลบรายการโปรด <br><b class="text-slate-700 dark:text-slate-200">"{{ favoriteToDelete?.title }}"</b></p>
                </div>

                <div class="flex gap-3 pt-2">
                  <button 
                    @click="isDeleteConfirmModalOpen = false"
                    class="flex-1 py-4 text-xs font-black text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-widest"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    @click="confirmDeleteFavorite"
                    class="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-rose-500/20 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    ยืนยันการลบ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- AI Chat Modal (Admin only) -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div
            v-if="isChatModalOpen"
            class="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/90 backdrop-blur-md"
            :class="isChatFullscreen ? 'p-0' : 'p-4'"
          >
            <div
              class="bg-white dark:bg-slate-900 flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 w-full transition-all"
              :class="isChatFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-2xl h-[85vh] rounded-[2rem] shadow-2xl shadow-violet-500/10'"
              @click.stop
            >
              <!-- Header -->
              <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-violet-50/40 dark:bg-violet-900/10 shrink-0">
                <!-- Icon + Title -->
                <div class="flex items-center gap-3 shrink-0">
                  <div class="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <BrainCircuit class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="text-base font-black text-slate-900 dark:text-white">แชตถาม AI จากข้อมูลนี้</h3>
                    <p class="text-[10px] font-bold text-violet-600/60 dark:text-violet-400/60 uppercase tracking-widest">
                      {{ chatContextLabel }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <!-- ปุ่มเลือกข้อความเพื่อแชร์ -->
                  <button
                    v-if="chatMessages.length > 0"
                    @click="isChatSelectMode = !isChatSelectMode; selectedMsgIdxs = new Set()"
                    class="p-2 rounded-xl transition-colors"
                    :class="isChatSelectMode
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
                    title="เลือกข้อความเพื่อแชร์"
                  >
                    <Share2 class="w-5 h-5" />
                  </button>
                  <button
                    @click="isChatFullscreen = !isChatFullscreen"
                    class="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    :title="isChatFullscreen ? 'ย่อหน้าต่าง' : 'ขยายเต็มจอ'"
                  >
                    <Minimize2 v-if="isChatFullscreen" class="w-5 h-5" />
                    <Maximize2 v-else class="w-5 h-5" />
                  </button>
                  <button @click="isChatModalOpen = false" class="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X class="w-5 h-5" />
                  </button>
                </div>
              </div>

              <!-- Messages area wrapper -->
              <div class="flex-1 relative overflow-hidden">
              <!-- Scroll to last message button -->
              <button
                v-if="chatMessages.length > 0"
                @click="scrollToLastMessage"
                class="absolute bottom-4 right-4 z-10 w-9 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-400 transition-all"
                title="เลื่อนไปข้อความล่าสุด"
              >
                <ChevronDown class="w-4 h-4" />
              </button>
              <!-- Hint เมื่อเข้า selection mode แต่ยังไม่เลือก -->
              <Transition name="slide-down">
                <div
                  v-if="isChatSelectMode && selectedMsgIdxs.size === 0"
                  class="mx-3 mt-2 flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl shrink-0"
                >
                  <MousePointerClick class="w-4 h-4 shrink-0 text-violet-500" />
                  <span class="text-xs">แตะที่ข้อความที่ต้องการเพื่อเลือก แล้วดาวน์โหลดเป็น PDF หรือส่งอีเมล</span>
                  <button
                    @click="isChatSelectMode = false; selectedMsgIdxs = new Set()"
                    class="ml-auto p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all shrink-0"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </Transition>
              <!-- Action bar เมื่อเลือกข้อความ -->
              <Transition name="slide-down">
                <div
                  v-if="isChatSelectMode && selectedMsgIdxs.size > 0"
                  class="mx-3 mt-2 flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-2xl shadow-lg shrink-0"
                >
                  <span class="text-sm font-bold flex-1">เลือกแล้ว {{ selectedMsgIdxs.size }} รายการ</span>
                  <button
                    @click="downloadSelectedPdf"
                    :disabled="isGeneratingPdf"
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-xl text-xs font-bold transition-all"
                  >
                    <Loader2 v-if="isGeneratingPdf" class="w-3.5 h-3.5 animate-spin" />
                    <Download v-else class="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    @click="openShareEmailModal"
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all"
                  >
                    <Mail class="w-3.5 h-3.5" />
                    อีเมล
                  </button>
                  <button
                    @click="isChatSelectMode = false; selectedMsgIdxs = new Set()"
                    class="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </Transition>
              <!-- Messages scroll area -->
              <div ref="chatScrollRef" class="h-full overflow-y-auto p-6 space-y-4 custom-scrollbar">

                <!-- Initializing -->
                <div v-if="isChatInitializing" class="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 class="w-10 h-10 text-violet-500 animate-spin" />
                  <p class="text-sm font-medium text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูลทั้งหมด...</p>
                </div>

                <!-- Empty state + Suggested questions -->
                <div v-else-if="chatMessages.length === 0 && !isChatLoading" class="flex flex-col items-center justify-center h-full gap-6">
                  <div class="text-center">
                    <div class="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
                      <BrainCircuit class="w-8 h-8 text-violet-500" />
                    </div>
                    <p class="text-sm font-black text-slate-700 dark:text-slate-300">ถามอะไรก็ได้เกี่ยวกับข้อมูลชุดนี้</p>
                    <p class="text-xs text-slate-400 mt-1">กดคำถามด้านล่าง หรือพิมพ์เองได้เลย</p>
                  </div>
                  <!-- Suggested questions -->
                  <div class="grid grid-cols-2 gap-3 w-full max-w-lg">
                    <button
                      v-for="q in ['สรุปภาพรวมข้อมูลนี้', 'มีข้อมูลไหนผิดปกติไหม?', 'ช่วยสร้างตารางสรุปยอดให้ที', 'วิเคราะห์แนวโน้มสำคัญ']"
                      :key="q"
                      @click="sendQuickReply(q)"
                      class="px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-900/30 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 rounded-2xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-violet-700 dark:hover:text-violet-300 transition-all text-left leading-relaxed"
                    >
                      {{ q }}
                    </button>
                  </div>
                </div>

                <!-- Chat bubbles -->
                <template v-for="(msg, idx) in chatMessages" :key="idx">
                  <!-- User bubble -->
                  <div v-if="msg.role === 'user'" class="chat-message flex justify-end items-start gap-2">
                    <Transition name="fade-fast">
                      <button v-if="isChatSelectMode" @click="toggleSelectMsg(idx)" class="shrink-0 mt-2 transition-colors">
                        <SquareCheck v-if="selectedMsgIdxs.has(idx)" class="w-5 h-5 text-violet-500" />
                        <Square v-else class="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      </button>
                    </Transition>
                    <div
                      class="max-w-[80%] px-5 py-3 text-white rounded-2xl rounded-tr-sm text-sm font-medium leading-relaxed shadow-md transition-all"
                      :class="[
                        isChatSelectMode ? 'cursor-pointer' : '',
                        selectedMsgIdxs.has(idx) && isChatSelectMode
                          ? 'bg-violet-400 ring-2 ring-violet-300 dark:ring-violet-500'
                          : 'bg-violet-600 shadow-violet-500/20'
                      ]"
                      @click="isChatSelectMode ? toggleSelectMsg(idx) : undefined"
                    >
                      {{ msg.content }}
                    </div>
                  </div>
                  <!-- AI bubble -->
                  <div v-else class="chat-message flex justify-start items-start gap-2 group/msg">
                    <Transition name="fade-fast">
                      <button v-if="isChatSelectMode" @click="toggleSelectMsg(idx)" class="shrink-0 mt-1 transition-colors">
                        <SquareCheck v-if="selectedMsgIdxs.has(idx)" class="w-5 h-5 text-violet-500" />
                        <Square v-else class="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      </button>
                    </Transition>
                    <div class="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0 mt-1">
                      <BrainCircuit class="w-4 h-4" />
                    </div>
                    <div class="min-w-0 flex-1 flex flex-col gap-1">
                      <div
                        class="px-5 py-3 rounded-2xl rounded-tl-sm text-sm text-slate-800 dark:text-slate-200 leading-relaxed shadow-sm transition-all"
                        :class="[
                          isChatSelectMode ? 'cursor-pointer' : '',
                          selectedMsgIdxs.has(idx) && isChatSelectMode
                            ? 'bg-violet-50 dark:bg-violet-900/30 ring-2 ring-violet-300 dark:ring-violet-700'
                            : 'bg-slate-100 dark:bg-slate-800'
                        ]"
                        v-html="renderChatMarkdown(msg.content)"
                        @click="isChatSelectMode ? toggleSelectMsg(idx) : undefined"
                      ></div>
                      <div v-if="!isChatSelectMode" class="flex items-center px-1">
                        <button
                          @click="speakMessage(msg.content, idx)"
                          class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all opacity-0 group-hover/msg:opacity-100 focus:opacity-100"
                          :class="speakingIdx === idx
                            ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30'
                            : 'text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'"
                          :title="speakingIdx === idx ? 'หยุดอ่าน' : 'อ่านออกเสียง'"
                        >
                          <VolumeX v-if="speakingIdx === idx" class="w-3.5 h-3.5" />
                          <Volume2 v-else class="w-3.5 h-3.5" />
                          <span>{{ speakingIdx === idx ? 'หยุด' : 'อ่าน' }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Loading -->
                <div v-if="isChatLoading" class="flex justify-start gap-3">
                  <div class="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-500 shrink-0 mt-1">
                    <Loader2 class="w-4 h-4 animate-spin" />
                  </div>
                  <div class="px-5 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <span class="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                    <span class="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                    <span class="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  </div>
                </div>
              </div>
              </div>

              <!-- Input area (Gemini Style) -->
              <div class="border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 p-4">
                <!-- Quick suggest panel -->
                <transition name="suggest">
                  <div v-if="showChatSuggest && chatMessages.length > 0" class="pb-3 grid grid-cols-2 gap-2">
                    <button
                      v-for="q in ['สรุปภาพรวมข้อมูลนี้', 'มีข้อมูลไหนผิดปกติไหม?', 'ช่วยสร้างตารางสรุปยอดให้ที', 'วิเคราะห์แนวโน้มสำคัญ']"
                      :key="q"
                      @click="sendQuickReply(q)"
                      :disabled="isChatLoading"
                      class="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-900/30 border border-slate-200 dark:border-slate-700/50 hover:border-violet-300 dark:hover:border-violet-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-violet-700 dark:hover:text-violet-300 transition-all text-left leading-snug disabled:opacity-40"
                    >
                      {{ q }}
                    </button>
                  </div>
                </transition>
                
                <div class="bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700/60 focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 dark:focus-within:border-violet-400 transition-all flex flex-col relative shadow-sm">
                  <textarea
                    v-model="chatInput"
                    placeholder="ถามเกี่ยวกับข้อมูลชุดนี้... (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัด)"
                    rows="2"
                    @keydown.enter.exact.prevent="sendChatMessage"
                    :disabled="isChatLoading"
                    class="w-full bg-transparent border-none px-5 pt-4 pb-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 resize-none disabled:opacity-50"
                  ></textarea>

                  <!-- Bottom Toolbar -->
                  <div class="flex items-center justify-between px-3 pb-3">
                    <div class="flex items-center gap-2">
                      <button
                        v-if="chatMessages.length > 0"
                        @click="showChatSuggest = !showChatSuggest"
                        class="p-2 rounded-full transition-all text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 dark:hover:text-violet-400"
                        :class="showChatSuggest ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' : ''"
                        title="แนะนำคำถาม"
                      >
                        <Lightbulb class="w-5 h-5" />
                      </button>
                    </div>

                    <div class="flex items-center gap-1.5 pr-1">
                      <!-- Model Selector Dropdown in input area -->
                      <div class="relative" @click.stop>
                        <button
                          @click="isChatModelDropdownOpen = !isChatModelDropdownOpen"
                          class="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold transition-all hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                          :class="isChatModelDropdownOpen
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            : 'bg-transparent text-slate-500 dark:text-slate-400'"
                          title="เลือก AI Model"
                        >
                          <span class="truncate max-w-[150px]">
                            {{ CHAT_MODELS.find(m => m.id === chatModel)?.label || chatModel }}
                          </span>
                          <ChevronDown class="w-3.5 h-3.5 shrink-0 transition-transform" :class="isChatModelDropdownOpen ? 'rotate-180' : ''" />
                        </button>

                        <!-- Dropdown list -->
                        <Transition
                          enter-active-class="transition-all duration-150 ease-out"
                          enter-from-class="opacity-0 translate-y-1 scale-95"
                          enter-to-class="opacity-100 translate-y-0 scale-100"
                          leave-active-class="transition-all duration-100 ease-in"
                          leave-from-class="opacity-100 translate-y-0 scale-100"
                          leave-to-class="opacity-0 translate-y-1 scale-95"
                        >
                          <div
                            v-if="isChatModelDropdownOpen"
                            class="absolute bottom-full mb-2 right-0 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-xl shadow-slate-200/60 dark:shadow-slate-900/60 z-50 overflow-hidden py-2"
                            @click.stop
                          >
                            <div class="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 mb-1">
                              เลือก AI Model
                            </div>
                            <button
                              v-for="m in CHAT_MODELS"
                              :key="m.id"
                              @click="chatModel = m.id; isChatModelDropdownOpen = false"
                              class="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                              :class="chatModel === m.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''"
                            >
                              <div>
                                <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ m.label }}</p>
                              </div>
                              <div class="flex items-center gap-1.5">
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black border" :class="m.badgeColor">
                                  {{ m.badge }}
                                </span>
                                <div v-if="chatModel === m.id" class="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center">
                                  <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                  </svg>
                                </div>
                              </div>
                            </button>
                          </div>
                        </Transition>
                        <!-- Click outside to close -->
                        <div v-if="isChatModelDropdownOpen" class="fixed inset-0 z-40" @click="isChatModelDropdownOpen = false"></div>
                      </div>

                      <button
                        @click="sendChatMessage"
                        :disabled="!chatInput.trim() || isChatLoading"
                        class="p-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:grayscale text-white rounded-full shadow-md shadow-violet-500/20 transition-all active:scale-95 shrink-0"
                      >
                        <Send class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>

      <!-- Email form modal สำหรับส่ง PDF ที่เลือก -->
      <Teleport to="body">
        <Transition name="modal">
          <div
            v-if="isShareEmailModalOpen"
            class="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            @click.self="isShareEmailModalOpen = false"
          >
            <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200" @click.stop>
              <!-- Header -->
              <div class="px-6 py-5 bg-violet-50 dark:bg-violet-900/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Mail class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="text-sm font-black text-slate-900 dark:text-white">ส่งรายงานทางอีเมล</h3>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400">ส่ง {{ selectedMsgIdxs.size }} ข้อความที่เลือกเป็น PDF</p>
                  </div>
                </div>
                <button @click="isShareEmailModalOpen = false" class="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>
              <!-- Form -->
              <div class="p-6 space-y-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">อีเมลผู้รับ *</label>
                  <input
                    v-model="emailTo"
                    type="email"
                    placeholder="someone@example.com"
                    @input="emailError = null"
                    :class="[
                      'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all',
                      emailError ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/30 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-violet-500/30 focus:border-violet-500'
                    ]"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">หัวข้ออีเมล</label>
                  <input
                    v-model="emailSubject"
                    type="text"
                    placeholder="รายงานการสนทนา AI"
                    class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">ข้อความเพิ่มเติม (ไม่บังคับ)</label>
                  <textarea
                    v-model="emailMessage"
                    rows="3"
                    placeholder="ข้อความที่ต้องการส่งพร้อมกับรายงาน..."
                    class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all resize-none"
                  ></textarea>
                </div>

                <!-- Error box: แสดงเมื่อส่งไม่สำเร็จ -->
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-1 scale-95"
                  enter-to-class="opacity-100 translate-y-0 scale-100"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100 translate-y-0 scale-100"
                  leave-to-class="opacity-0 -translate-y-1 scale-95"
                >
                  <div v-if="emailError" class="flex items-start gap-3 px-4 py-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl">
                    <div class="shrink-0 w-7 h-7 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mt-0.5">
                      <AlertCircle class="w-4 h-4" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-black text-rose-700 dark:text-rose-400 leading-tight">{{ emailError.title }}</p>
                      <p class="text-xs text-rose-600/80 dark:text-rose-400/70 mt-1 leading-relaxed">{{ emailError.detail }}</p>
                    </div>
                    <button
                      @click="emailError = null"
                      class="shrink-0 p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-400 dark:text-rose-500 transition-colors"
                    >
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Transition>

                <div class="flex gap-3 pt-2">
                  <button
                    @click="isShareEmailModalOpen = false"
                    class="flex-1 py-3 text-sm font-black text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all uppercase tracking-widest"
                  >
                    ยกเลิก
                  </button>
                  <button
                    @click="sendSelectedEmail"
                    :disabled="!emailTo.trim() || isSendingEmail"
                    class="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-2xl shadow-lg shadow-violet-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Loader2 v-if="isSendingEmail" class="w-4 h-4 animate-spin" />
                    <Mail v-else class="w-4 h-4" />
                    {{ isSendingEmail ? 'กำลังส่ง...' : 'ส่งอีเมล' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Tips Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isTipsModalOpen" class="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" @click="isTipsModalOpen = false">
            <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <!-- Header -->
              <div class="px-7 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/40 dark:bg-amber-900/10">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Lightbulb class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="text-base font-black text-slate-900 dark:text-white">เทคนิคการถาม AI</h3>
                    <p class="text-[10px] font-bold text-amber-600/60 dark:text-amber-400/60 uppercase tracking-widest">Query Tips & Tricks</p>
                  </div>
                </div>
                <button @click="isTipsModalOpen = false" class="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Content -->
              <div class="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">

                <!-- Active Assets -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-emerald-500 rounded-full"></span>
                    ข้อมูล Asset ปัจจุบัน (Active)
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    ใช้คำว่า <span class="font-black text-emerald-600 dark:text-emerald-400">"ปัจจุบัน"  "active"  "current"  "unique"</span> — ระบบจะดึงเฉพาะ SN ล่าสุดต่อบริษัทให้อัตโนมัติ
                  </p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'รายการ asset ปัจจุบันของบริษัท ABC',
                      'SN ที่ยังใช้งานอยู่ แยกตามบริษัท',
                      'จำนวน qty รวมของ AutoCAD LT ในปัจจุบัน',
                      'asset ที่ active แต่หมดอายุในเดือนนี้'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors group border border-emerald-100 dark:border-emerald-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- History -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-slate-400 rounded-full"></span>
                    ต้องการประวัติทั้งหมด (ทุก Renewal)
                  </div>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'ประวัติการต่ออายุทั้งหมดของ SN XXXX',
                      'รายการ asset ทั้งหมดของบริษัท ABC รวมถึงประวัติการต่ออายุ'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-[11px] font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group border border-slate-100 dark:border-slate-800"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Grouping -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-blue-500 rounded-full"></span>
                    จัดกลุ่ม / สรุปข้อมูล
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">ลงท้ายด้วย <span class="font-black text-blue-600 dark:text-blue-400">"แยกตาม..."</span> เพื่อให้ AI สร้าง GROUP BY ให้อัตโนมัติ</p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'นับจำนวน Lead แยกตามจังหวัด',
                      'ยอดขายรวมแยกตามทีมฝ่ายขาย',
                      'จำนวน asset แยกตามสินค้าและบริษัท'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-[11px] font-medium cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group border border-blue-100 dark:border-blue-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Time Filter -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-indigo-500 rounded-full"></span>
                    กรองตามช่วงเวลา
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">ระบุช่วงเวลาให้ชัด เช่น <span class="font-black text-indigo-600 dark:text-indigo-400">"ในปี 2024"  "เดือนนี้"  "ย้อนหลัง 1 ปี"  "ระหว่าง ม.ค.-มี.ค."</span></p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'asset ที่หมดอายุภายใน 30 วันข้างหน้า',
                      'ยอดขายระหว่าง 1 ม.ค. ถึง 31 มี.ค. 2025',
                      'Lead ใหม่ย้อนหลัง 1 ปี แต่ยังไม่ถูกติดต่อ'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 text-[11px] font-medium cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors group border border-indigo-100 dark:border-indigo-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Exclusion -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-rose-500 rounded-full"></span>
                    ยกเว้น / ไม่รวม
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">ใช้คำว่า <span class="font-black text-rose-600 dark:text-rose-400">"ที่ไม่มี..."  "ยกเว้น..."  "แต่ไม่รวม..."</span> เพื่อสร้างเงื่อนไข NOT IN</p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'บริษัทที่มี AutoCAD LT แต่ไม่มี GstarCAD',
                      'ลูกค้าที่มี asset หมดอายุ แต่ไม่มี Opp ใน Topline'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 text-[11px] font-medium cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors group border border-rose-100 dark:border-rose-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Opportunity / Topline -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-amber-500 rounded-full"></span>
                    Opportunity / Topline
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">คำว่า <span class="font-black text-amber-600 dark:text-amber-400">"Topline"  "ใน Pipeline"  "ยังไม่ปิดดีล"</span> จะกรองเฉพาะ Opp ที่ยัง Active อยู่</p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'ดีลที่อยู่ใน Topline ของทีม Mi Software',
                      'Opp ที่เปิดอยู่และมีสินค้าหมวด SolidWorks'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors group border border-amber-100 dark:border-amber-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Team & Hierarchy -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-violet-500 rounded-full"></span>
                    ทีม & สายงาน (Hierarchy)
                  </div>
                  <div class="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <p><span class="font-black text-violet-600 dark:text-violet-400">"ภายใต้..."  "รวมลูกน้อง"  "ในสายงาน"</span> → รวมทีมย่อยทั้งหมดในสายงาน</p>
                    <p><span class="font-black text-slate-600 dark:text-slate-300">"ของทีม..."  "เฉพาะทีม"</span> → เฉพาะทีมนั้นโดยตรง ไม่รวมลูกน้อง</p>
                  </div>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'ยอดขายทั้งหมดในสายงานของ Mi Software รวมลูกน้อง',
                      'จำนวน Lead เฉพาะทีมกรุงเทพ ไม่รวมทีมย่อย',
                      'asset ที่หมดอายุภายใต้ทีม Service'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-300 text-[11px] font-medium cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors group border border-violet-100 dark:border-violet-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Note -->
                <div class="p-3.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex items-start gap-2.5">
                  <Info class="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <p class="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">คลิกที่ตัวอย่างเพื่อใช้คำถามนั้นทันทีได้เลยครับ</p>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.modal-enter-active, .modal-leave-active {
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-active > div, .modal-leave-active > div {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-enter-from > div, .modal-leave-to > div {
  transform: scale(0.9) translateY(30px);
}

.suggest-enter-active, .suggest-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
  max-height: 200px;
}
.suggest-enter-from, .suggest-leave-to {
  opacity: 0;
  transform: translateY(6px);
  max-height: 0;
}

.fade-fast-enter-active, .fade-fast-leave-active { transition: opacity 0.15s ease; }
.fade-fast-enter-from, .fade-fast-leave-to { opacity: 0; }

.slide-down-enter-active, .slide-down-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.2s ease;
  overflow: hidden;
  max-height: 80px;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 2.5s infinite linear;
}

textarea::placeholder {
  font-weight: 500;
}

/* Data Guide Styling */
:deep(.data-guide-content h2) {
  @apply text-xl font-black text-indigo-700 dark:text-indigo-400 mt-16 mb-8 flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-900/20 px-6 py-4 rounded-2xl border-l-8 border-indigo-600 shadow-sm;
}
:deep(.data-guide-content p), :deep(.data-guide-content li) {
  @apply text-slate-600 dark:text-slate-400 text-base leading-loose mb-4 px-2;
}
:deep(.data-guide-content strong) {
  @apply text-slate-900 dark:text-slate-200 font-bold;
}
:deep(.data-guide-content hr) {
  @apply my-16 border-slate-100 dark:border-slate-800 opacity-0;
}
:deep(.data-guide-content blockquote) {
  @apply pl-6 border-l-4 border-amber-500 bg-amber-50/30 dark:bg-amber-900/10 py-6 pr-6 rounded-r-3xl italic my-10 shadow-sm;
}
:deep(.data-guide-content ul) {
  @apply space-y-4 list-none pl-6 my-8;
}
:deep(.data-guide-content ul li) {
  @apply relative;
}
:deep(.data-guide-content ul li::before) {
  content: '•';
  @apply absolute -left-5 text-indigo-500 font-black text-xl top-[-2px] leading-none;
}

/* Markdown Rendering Styling */
:deep(.prose-markdown ul) {
  @apply space-y-3 list-none pl-6 my-4;
}
:deep(.prose-markdown ul li) {
  @apply relative leading-relaxed;
}
:deep(.prose-markdown ul li::before) {
  content: '•';
  @apply absolute -left-5 text-blue-500 font-black text-xl top-[-2px] leading-none;
}
:deep(.prose-markdown strong) {
  @apply text-slate-900 dark:text-white font-black px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700;
}
</style>
