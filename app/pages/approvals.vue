<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  Inbox, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Terminal, 
  Info, 
  AlertTriangle,
  AlertCircle,
  User,
  ArrowRight,
  Database,
  RotateCcw,
  X,
  Maximize2,
  Copy,
  Eye,
  Table as TableIcon,
  Search,
  MessageSquare,
  Calendar
} from 'lucide-vue-next'

const pendingRequests = ref<any[]>([])
const isLoading = ref(true)
const systemStatus = useState<any>('system-status')
const isProcessing = ref<string | null>(null)
const toast = useToast()

const fetchRequests = async () => {
  try {
    const response = await $fetch<any>('/api/ai-query/approvals')
    if (response.success) {
      pendingRequests.value = response.requests
    }
  } catch (e) {
    console.error('Failed to fetch requests', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchRequests()
})

// SQL Formatter & Highlighter Logic
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
  
  // 1. Format SQL for readability
  let result = formatSql(sql)
  
  // 2. Highlight Strings
  result = result.replace(/'(.*?)'/g, '<span class="text-emerald-600 dark:text-emerald-400">\'$1\'</span>')
  
  // 3. Highlight Keywords (Use font-black for visibility)
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

// SQL Expand Modal
const isSqlModalOpen = ref(false)
const activeSqlRequestId = ref<string | null>(null)
const activeSql = ref('')
const activeExplanation = ref('')

const openSqlModal = (id: string, sql: string, explanation: string) => {
  activeSqlRequestId.value = id
  activeSql.value = sql
  activeExplanation.value = explanation
  isSqlModalOpen.value = true
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(formatSql(text))
    toast.success('คัดลอกแล้ว', 'คัดลอกคำสั่ง SQL ลง Clipboard เรียบร้อย')
  } catch (e) {
    toast.error('ล้มเหลว', 'ไม่สามารถคัดลอกข้อความได้')
  }
}

// Reject Modal State
const isRejectModalOpen = ref(false)
const rejectReason = ref('')
const requestToReject = ref<string | null>(null)

const isPreviewModalOpen = ref(false)
const previewData = ref<any[]>([])
const isPreviewLoading = ref(false)
const previewError = ref<string | null>(null)
const previewSqlAttempt = ref('')

const openPreview = async (sqlQuery: string) => {
  isPreviewLoading.value = true
  isPreviewModalOpen.value = true
  previewData.value = []
  previewError.value = null
  previewSqlAttempt.value = sqlQuery
  
  try {
    const response = await $fetch<any>('/api/ai-query/preview', {
      method: 'POST',
      body: { query: sqlQuery }
    })
    
    if (response.success) {
      previewData.value = response.data
    } else {
      previewError.value = response.error || 'ไม่สามารถดึงข้อมูลตัวอย่างได้'
      toast.error('เกิดข้อผิดพลาด', previewError.value ?? undefined)
    }
  } catch (e: any) {
    previewError.value = e.data?.message || 'การเชื่อมต่อฐานข้อมูลขัดข้อง'
    toast.error('ล้มเหลว', previewError.value ?? undefined)
  } finally {
    isPreviewLoading.value = false
  }
}

// Confirmation Modal State
const isConfirmModalOpen = ref(false)
const requestToApprove = ref<string | null>(null)

// Expiry selection state
// 'none' = ไม่หมดอายุ, '15' = 15 วัน, '30' = 30 วัน, 'custom' = ระบุเอง
const expiryOption = ref<'none' | '15' | '30' | 'custom'>('30')
const customExpiryDate = ref('')
const approvalComment = ref('')   // Comment เพิ่มเติมจาก Manager (optional)

// คำนวณ ISO string ของวันหมดอายุ ณ ขณะที่กด confirm
const computeExpiresAt = (): string | null => {
  if (expiryOption.value === 'none') return null
  if (expiryOption.value === 'custom') {
    return customExpiryDate.value ? new Date(customExpiryDate.value + 'T23:59:59').toISOString() : null
  }
  const days = parseInt(expiryOption.value)
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(23, 59, 59, 0)
  return date.toISOString()
}

// วันขั้นต่ำสำหรับ custom date picker (วันพรุ่งนี้)
const minCustomDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
})

const openConfirmModal = (id: string) => {
  requestToApprove.value = id
  expiryOption.value = '30'         // reset กลับค่าเริ่มต้น
  customExpiryDate.value = ''
  approvalComment.value = ''        // reset comment
  isConfirmModalOpen.value = true
}

const confirmApprove = async () => {
  if (!requestToApprove.value) return
  const id = requestToApprove.value
  isConfirmModalOpen.value = false

  isProcessing.value = id
  try {
    const expiresAt = computeExpiresAt()
    const response = await $fetch<any>('/api/ai-query/action', {
      method: 'POST',
      body: { requestId: id, status: 'APPROVED', expiresAt, managerComment: approvalComment.value || null }
    })

    if (response.success) {
      pendingRequests.value = pendingRequests.value.filter(req => req.id !== id)
      const expMsg = expiresAt
        ? `ไฟล์จะหมดอายุ ${new Date(expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'ไม่มีวันหมดอายุ'
      toast.success('อนุมัติสำเร็จ', `อนุมัติคำขอเรียบร้อยแล้ว — ${expMsg}`)
    } else {
      toast.error('เกิดข้อผิดพลาด', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
  } finally {
    isProcessing.value = null
    requestToApprove.value = null
  }
}

const approveRequest = async (id: string) => {
  openConfirmModal(id)
}

const openRejectModal = (id: string) => {
  requestToReject.value = id
  rejectReason.value = ''
  isRejectModalOpen.value = true
}

const confirmReject = async () => {
  if (!requestToReject.value || !rejectReason.value) {
    toast.warning('กรุณาระบุเหตุผล', 'คุณต้องระบุเหตุผลที่ไม่อนุมัติให้พนักงานทราบ')
    return
  }

  const id = requestToReject.value
  isProcessing.value = id
  isRejectModalOpen.value = false
  
  try {
    const response = await $fetch<any>('/api/ai-query/action', {
      method: 'POST',
      body: { requestId: id, status: 'REJECTED', reason: rejectReason.value }
    })

    if (response.success) {
      pendingRequests.value = pendingRequests.value.filter(req => req.id !== id)
      toast.info('ปฏิเสธคำขอ', `ไม่อนุมัติคำขอ ${id} เรียบร้อยแล้ว`)
    } else {
      toast.error('เกิดข้อผิดพลาด', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
  } finally {
    isProcessing.value = null
    requestToReject.value = null
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-8">
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest text-xs">
          <Clock class="w-4 h-4" />
          Pending Reviews
        </div>
        <h2 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">รายการรออนุมัติ</h2>
        <p class="text-slate-500 dark:text-slate-400 text-lg">ตรวจสอบชุดคำสั่ง SQL และความปลอดภัยก่อนอนุมัติ</p>
      </div>
      <div v-if="!isLoading && pendingRequests.length > 0" class="px-5 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-2xl text-sm font-black border border-amber-100 dark:border-amber-800 flex items-center gap-3 shadow-sm">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
        รอตรวจสอบ {{ pendingRequests.length }} รายการ
      </div>
    </header>

    <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
      <div class="relative">
        <div class="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-800"></div>
        <div class="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin absolute top-0 left-0"></div>
      </div>
      <p class="text-slate-400 dark:text-slate-500 font-medium animate-pulse">กำลังโหลดรายการรออนุมัติ...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="!isLoading && pendingRequests.length === 0 && systemStatus?.status === 'offline'" class="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/50 rounded-[2.5rem] p-16 text-center animate-in zoom-in-95 duration-500">
      <div class="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-rose-100 dark:bg-rose-900/40 mb-6 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <AlertCircle class="w-12 h-12" />
      </div>
      <h3 class="text-2xl font-bold text-rose-900 dark:text-rose-400">การเชื่อมต่อฐานข้อมูลล้มเหลว</h3>
      <p class="text-rose-700 dark:text-rose-300 mt-2 text-lg max-w-md mx-auto">ไม่สามารถดึงข้อมูลได้เนื่องจากระบบไม่สามารถเชื่อมต่อกับ MySQL ได้ กรุณาตรวจสอบไฟล์ .env หรือสถานะของ Database Server</p>
      <button @click="fetchRequests" class="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/20 active:scale-95 group">
        <RotateCcw class="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
        ลองใหม่อีกครั้ง
      </button>
    </div>

    <div v-else-if="pendingRequests.length === 0" class="text-center py-24 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800">
      <div class="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-emerald-100 dark:border-emerald-800/50">
        <CheckCircle class="w-12 h-12" />
      </div>
      <h3 class="text-2xl font-bold text-slate-900 dark:text-white">ไม่มีรายการรออนุมัติ</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2 text-lg">ยอดเยี่ยมมาก! คุณตรวจสอบครบทุกรายการแล้ว</p>
    </div>

    <div v-else class="space-y-8">
      <div v-for="req in pendingRequests" :key="req.id" class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden relative group transition-all hover:border-blue-500/50 dark:hover:border-blue-400/50">
        <!-- Status Indicator Line -->
        <div class="absolute left-0 top-0 bottom-0 w-2 bg-amber-400 dark:bg-amber-500"></div>
        
        <div class="p-8 md:p-10">
          <div class="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
            <div class="space-y-4">
              <div class="flex flex-wrap items-center gap-3">
                <div class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                  ID: {{ req.id.substring(0, 8).toUpperCase() }}
                </div>
                <div class="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                  <User class="w-3 h-3" />
                  {{ req.user }}
                </div>
                <div class="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-800/50 flex items-center gap-2">
                  <Clock class="w-3 h-3" />
                  รอนุมัติ
                </div>
              </div>
              <p class="text-xl font-medium text-slate-700 dark:text-slate-300 leading-relaxed">"{{ req.prompt }}"</p>
              <div class="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-bold">
                <Calendar class="w-4 h-4" />
                {{ req.time }}
              </div>
            </div>
            
            <div class="text-center bg-blue-50 dark:bg-blue-900/20 px-6 py-4 rounded-[1.5rem] border border-blue-100 dark:border-blue-800 shrink-0 w-full md:w-auto">
              <div class="text-[10px] text-blue-600 dark:text-blue-400 font-black mb-1 uppercase tracking-[0.2em]">รายการที่จะได้</div>
              <div class="text-4xl font-black text-blue-700 dark:text-blue-300 tracking-tighter">{{ req.count }}</div>
              <p class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">Records</p>
            </div>
          </div>

          <!-- Reason for Request -->
          <div v-if="req.reason" class="mb-8 p-6 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/50 rounded-[1.5rem]">
            <h4 class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <Info class="w-4 h-4" />
              เหตุผลในการขอข้อมูล (REASON)
            </h4>
            <p class="text-slate-700 dark:text-slate-300 leading-relaxed font-medium text-lg">{{ req.reason }}</p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- AI Explanation -->
            <div class="bg-slate-50 dark:bg-slate-950/50 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-800/50">
              <h4 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Info class="w-4 h-4 text-blue-500" />
                AI ANALYSIS
              </h4>
              <p class="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{{ req.explanation }}</p>
            </div>
            
            <!-- SQL Code -->
            <div class="bg-slate-50 dark:bg-slate-950 p-6 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 flex flex-col group/sql relative">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Terminal class="w-4 h-4 text-indigo-500" />
                  SQL STATEMENT
                </h4>
                <button 
                  @click="openSqlModal(req.id, req.sql, req.explanation)"
                  class="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:scale-105"
                  title="ขยายใหญ่"
                >
                  <Maximize2 class="w-3.5 h-3.5" />
                </button>
              </div>
              <div class="flex-1 overflow-hidden">
                <pre class="text-slate-700 dark:text-slate-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[160px]" v-html="highlightSql(req.sql)"></pre>
              </div>
              <div class="absolute bottom-4 right-4 opacity-0 group-hover/sql:opacity-100 transition-opacity">
                <button @click="copyToClipboard(req.sql)" class="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-500 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="bg-slate-50/50 dark:bg-slate-900/50 px-8 md:px-10 py-6 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
          <div class="text-xs text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-2 uppercase tracking-widest">
            <ShieldCheck class="w-5 h-5" />
            Verified Read-Only Secured
          </div>
          <div class="flex gap-4 w-full md:w-auto">
            <button 
              @click="openRejectModal(req.id)"
              :disabled="isProcessing !== null"
              class="flex-1 md:flex-none px-8 py-4 text-sm font-black text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50 rounded-2xl transition-all uppercase tracking-widest active:scale-95"
            >
              ไม่อนุมัติ
            </button>
            <button 
              @click="openPreview(req.sql)"
              :disabled="isProcessing !== null"
              class="flex-1 md:flex-none px-6 py-4 text-sm font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95"
            >
              <Eye class="w-5 h-5" />
              ดูตัวอย่างข้อมูล
            </button>
            <button 
              @click="approveRequest(req.id)"
              :disabled="isProcessing !== null"
              class="flex-1 md:flex-none px-10 py-4 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest"
            >
              <RotateCcw v-if="isProcessing === req.id" class="w-5 h-5 animate-spin" />
              <CheckCircle v-else class="w-5 h-5" />
              อนุมัติ & ดึงข้อมูล
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Confirm Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isRejectModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800" @click.stop>

              <!-- Header -->
              <div class="p-8 pb-0 text-center">
                <div class="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <XCircle class="w-10 h-10" />
                </div>
                <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-3">ยืนยันการไม่อนุมัติ?</h3>
                <p class="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
                  กรุณาระบุเหตุผลที่ไม่อนุมัติ เพื่อให้พนักงานทราบและนำไปปรับปรุง
                </p>
              </div>

              <!-- Fields -->
              <div class="px-8 py-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <AlertTriangle class="w-3.5 h-3.5" />
                    เหตุผลที่ไม่อนุมัติ
                    <span class="text-rose-400">*</span>
                  </label>
                  <textarea
                    v-model="rejectReason"
                    placeholder="เช่น ข้อมูลกว้างเกินไป กรุณาระบุเงื่อนไขวันที่ให้ชัดเจนกว่านี้..."
                    rows="4"
                    autofocus
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-rose-200 dark:border-rose-800/60 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all resize-none leading-relaxed"
                  ></textarea>
                </div>
              </div>

              <!-- Actions -->
              <div class="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <button
                  @click="isRejectModalOpen = false"
                  class="flex-1 px-8 py-4 text-sm font-black text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all uppercase tracking-widest"
                >
                  ยกเลิก
                </button>
                <button
                  @click="confirmReject"
                  :disabled="!rejectReason"
                  class="flex-1 px-10 py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black rounded-2xl shadow-xl shadow-rose-500/20 transition-all uppercase tracking-widest active:scale-95"
                >
                  ยืนยันการปฏิเสธ
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- SQL Expand Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isSqlModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col" @click.stop>
              <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/30 dark:bg-indigo-900/10 shrink-0">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                    <Terminal class="w-6 h-6" />
                  </div>
                  <div>
                    <h3 class="text-xl font-black text-slate-900 dark:text-white">SQL Explorer</h3>
                    <p class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">ตรวจสอบชุดคำสั่งอย่างละเอียด</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <button 
                    @click="copyToClipboard(activeSql)"
                    class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:text-emerald-500 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    <Copy class="w-4 h-4" />
                    คัดลอกคำสั่ง
                  </button>
                  <button @click="isSqlModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X class="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div class="flex-1 overflow-hidden flex flex-col lg:flex-row">
                <!-- Left: Explanation Sidebar -->
                <div class="lg:w-80 border-r border-slate-100 dark:border-slate-800 p-8 bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto">
                  <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">AI Explanation</h4>
                  <p class="text-slate-700 dark:text-slate-300 leading-relaxed font-medium text-sm leading-relaxed">{{ activeExplanation }}</p>
                  
                  <div class="mt-10 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-800/50">
                    <div class="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                      <ShieldCheck class="w-4 h-4" />
                      <span class="text-[10px] font-black uppercase tracking-widest">Security Check</span>
                    </div>
                    <p class="text-[11px] text-blue-800/60 dark:text-blue-400/60 leading-relaxed">ชุดคำสั่งได้รับการตรวจสอบความปลอดภัยแล้วว่าเป็นคำสั่งดึงข้อมูล (Read-only) เท่านั้น</p>
                  </div>
                </div>
                
                <!-- Right: SQL Highlighted Code -->
                <div class="flex-1 bg-white dark:bg-slate-950 p-8 overflow-auto custom-scrollbar">
                  <pre class="text-slate-800 dark:text-slate-200 text-lg font-mono leading-relaxed whitespace-pre-wrap" v-html="highlightSql(activeSql)"></pre>
                </div>
              </div>

              <!-- Footer Actions -->
              <div class="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end items-center gap-4 shrink-0">
                <button 
                  @click="isSqlModalOpen = false; openRejectModal(activeSqlRequestId!)"
                  class="px-8 py-3.5 text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl transition-all uppercase tracking-widest active:scale-95"
                >
                  ไม่อนุมัติ
                </button>
                <button 
                  @click="openPreview(activeSql)"
                  class="px-6 py-3.5 text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95"
                >
                  <Eye class="w-4 h-4" />
                  ดูตัวอย่างข้อมูล
                </button>
                <button 
                  @click="isSqlModalOpen = false; approveRequest(activeSqlRequestId!)"
                  class="px-10 py-3.5 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest"
                >
                  <CheckCircle class="w-4 h-4" />
                  อนุมัติ & ดึงข้อมูล
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>
    <!-- Data Preview Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isPreviewModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-slate-900/90 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-7xl h-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col" @click.stop>
              <!-- Modal Header -->
              <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/30 dark:bg-indigo-900/10 shrink-0">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <TableIcon class="w-7 h-7" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-slate-900 dark:text-white">ตัวอย่างข้อมูลจริง</h3>
                    <p class="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">Previewing first 10 records from database</p>
                  </div>
                </div>
                <button @click="isPreviewModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X class="w-7 h-7" />
                </button>
              </div>

              <!-- Modal Content -->
              <div class="flex-1 overflow-hidden relative">
                <div v-if="isPreviewLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10">
                  <div class="relative w-20 h-20">
                    <div class="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
                  </div>
                  <p class="mt-6 text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-[0.2em] animate-pulse">Querying Database...</p>
                </div>

                <div v-else-if="previewData.length > 0" class="h-full overflow-auto custom-scrollbar">
                  <table class="w-full text-left border-collapse min-w-full">
                    <thead class="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-md">
                      <tr>
                        <th v-for="key in Object.keys(previewData[0])" :key="key" class="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                          {{ key }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50 dark:divide-slate-800/50">
                      <tr v-for="(row, idx) in previewData" :key="idx" class="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                        <td v-for="(val, key) in row" :key="key" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          <span v-if="val === null" class="text-slate-300 dark:text-slate-700 italic">null</span>
                          <span v-else>{{ val }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div v-else-if="previewError" class="h-full flex flex-col items-center justify-center p-12 text-center">
                  <div class="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-6 border border-rose-100 dark:border-rose-800">
                    <AlertTriangle class="w-10 h-10" />
                  </div>
                  <h4 class="text-xl font-black text-rose-600 dark:text-rose-400 mb-2">SQL Execution Error</h4>
                  <p class="text-slate-500 dark:text-slate-400 max-w-lg mb-6 leading-relaxed">{{ previewError }}</p>
                  
                  <div class="w-full max-w-3xl bg-slate-900 rounded-2xl p-6 text-left border border-rose-900/30 shadow-2xl">
                    <div class="flex items-center justify-between mb-3">
                       <span class="text-[10px] font-black text-rose-400 uppercase tracking-widest">Failed SQL Query:</span>
                       <button @click="copyToClipboard(previewSqlAttempt)" class="text-rose-400 hover:text-rose-300 transition-colors">
                         <Copy class="w-3.5 h-3.5" />
                       </button>
                    </div>
                    <pre class="text-xs font-mono text-rose-200 whitespace-pre-wrap leading-relaxed">{{ previewSqlAttempt }}</pre>
                  </div>
                </div>

                <div v-else class="h-full flex flex-col items-center justify-center p-20 text-center">
                  <div class="w-24 h-24 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                    <Search class="w-12 h-12 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h4 class="text-xl font-black text-slate-900 dark:text-white mb-2">ไม่พบข้อมูล</h4>
                  <p class="text-slate-500 dark:text-slate-400 max-w-sm">ไม่พบแถวข้อมูลจากการค้นหานี้ หรือคำสั่ง SQL อาจไม่ส่งผลลัพธ์ใดๆ</p>
                </div>
              </div>

              <!-- Modal Footer -->
              <div class="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  แสดงข้อมูลตัวอย่างสูงสุด <span class="font-black text-indigo-600">10</span> รายการ
                </div>
                <button @click="isPreviewModalOpen = false" class="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black rounded-xl hover:bg-black dark:hover:bg-slate-200 transition-all uppercase tracking-widest active:scale-95">
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>
    <!-- Confirm Approval Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isConfirmModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800" @click.stop>
              <!-- Header -->
              <div class="p-8 pb-0 text-center">
                <div class="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <CheckCircle class="w-10 h-10" />
                </div>
                <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-3">ยืนยันการอนุมัติ?</h3>
                <p class="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
                  เมื่ออนุมัติแล้ว ระบบจะดำเนินการรันคำสั่ง SQL เพื่อดึงข้อมูลจริงและเตรียมไฟล์ให้พนักงานดาวน์โหลด
                </p>
              </div>

              <!-- Expiry Selector -->
              <div class="px-8 py-6">
                <div class="bg-slate-50 dark:bg-slate-950 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                  <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Clock class="w-3.5 h-3.5" />
                    กำหนดอายุของลิงก์ดาวน์โหลด
                  </p>
                  <!-- Option Buttons -->
                  <div class="grid grid-cols-2 gap-2 mb-3">
                    <button
                      v-for="opt in [{ val: '15', label: '15 วัน' }, { val: '30', label: '30 วัน' }, { val: 'custom', label: 'ระบุวันเอง' }, { val: 'none', label: 'ไม่หมดอายุ' }]"
                      :key="opt.val"
                      @click="expiryOption = opt.val as any"
                      :class="[
                        'px-4 py-3 rounded-xl text-sm font-black transition-all border',
                        expiryOption === opt.val
                          ? opt.val === 'none'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                            : 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600'
                      ]"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                  <!-- Custom Date Picker -->
                  <transition name="slide-down">
                    <div v-if="expiryOption === 'custom'" class="mt-2">
                      <input
                        v-model="customExpiryDate"
                        type="date"
                        :min="minCustomDate"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                      />
                    </div>
                  </transition>
                  <!-- Summary Label -->
                  <p class="mt-3 text-xs text-slate-400 dark:text-slate-500 font-medium">
                    <span v-if="expiryOption === 'none'">ไฟล์นี้จะ <span class="text-blue-600 dark:text-blue-400 font-black">ไม่มีวันหมดอายุ</span></span>
                    <span v-else-if="expiryOption === '15'">ไฟล์จะหมดอายุใน <span class="text-emerald-600 dark:text-emerald-400 font-black">15 วัน</span></span>
                    <span v-else-if="expiryOption === '30'">ไฟล์จะหมดอายุใน <span class="text-emerald-600 dark:text-emerald-400 font-black">30 วัน</span></span>
                    <span v-else-if="expiryOption === 'custom' && customExpiryDate">ไฟล์จะหมดอายุวันที่ <span class="text-emerald-600 dark:text-emerald-400 font-black">{{ new Date(customExpiryDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) }}</span></span>
                    <span v-else-if="expiryOption === 'custom'">กรุณาเลือกวันที่</span>
                  </p>
                </div>
              </div>

              <!-- Manager Comment (Optional) -->
              <div class="px-8 pb-2">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <MessageSquare class="w-3.5 h-3.5" />
                    Comment สำหรับพนักงาน
                    <span class="text-slate-300 dark:text-slate-600 font-medium normal-case tracking-normal">(ไม่บังคับ)</span>
                  </label>
                  <textarea
                    v-model="approvalComment"
                    placeholder="เช่น ได้รับอนุมัติแล้ว กรุณาใช้ข้อมูลนี้สำหรับการรายงานเดือนเมษายน..."
                    rows="3"
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:focus:border-emerald-400 transition-all resize-none leading-relaxed"
                  ></textarea>
                </div>
              </div>

              <!-- Actions -->
              <div class="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <button
                  @click="isConfirmModalOpen = false"
                  class="flex-1 px-8 py-4 text-sm font-black text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all uppercase tracking-widest"
                >
                  ยกเลิก
                </button>
                <button
                  @click="confirmApprove"
                  :disabled="expiryOption === 'custom' && !customExpiryDate"
                  class="flex-1 px-10 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all uppercase tracking-widest active:scale-95"
                >
                  ยืนยันอนุมัติ
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<style scoped>
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

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-slate-50 dark:bg-slate-900;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-slate-200 dark:bg-slate-800 rounded-full;
}

/* Custom date picker slide animation */
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

</style>
