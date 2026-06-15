<script setup lang="ts">
import { ref, computed } from 'vue'
import { format } from 'sql-formatter'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  LayoutDashboard,
  Database,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  FileSpreadsheet,
  Activity,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  X,
  Download,
  ExternalLink,
  Code,
  Copy,
  TimerOff,
  BarChart3
} from 'lucide-vue-next'

const router = useRouter()
const toast = useToast()

const { data: authData } = await useFetch<any>('/api/auth/me')
const user = computed(() => authData.value?.user || null)
const isAdminOrManager = computed(() => user.value?.role === 'admin' || user.value?.role === 'manager')

const { data: dashboardData, pending, error } = await useFetch<any>('/api/dashboard')
const stats = computed(() => dashboardData.value?.data?.overview || { total: 0, pending: 0, approved: 0, rejected: 0, exportedRows: 0, approvalRate: 0 })
const recentActivity = computed<any[]>(() => dashboardData.value?.data?.recentActivity || [])
const topRequesters = computed<any[]>(() => dashboardData.value?.data?.topRequesters || [])

const getStatusColor = (status: string) => {
  if (status === 'APPROVED') return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800'
  if (status === 'REJECTED') return 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/20 dark:border-rose-800'
  if (status === 'PENDING') return 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800'
  return 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/20 dark:border-slate-800'
}

const getStatusLabel = (status: string) => {
  if (status === 'APPROVED') return 'อนุมัติแล้ว'
  if (status === 'REJECTED') return 'ไม่อนุมัติ'
  if (status === 'PENDING') return 'รออนุมัติ'
  return status
}

// ─── Activity Detail Modal ──────────────────────────────────
const activeActivity = ref<any>(null)

const openActivityModal = (activity: any) => {
  activeActivity.value = activity
}

const closeActivityModal = () => {
  activeActivity.value = null
}

const isActivityExpired = (activity: any) => {
  if (!activity?.expiresAt) return false
  return new Date() > new Date(activity.expiresAt)
}

const formatSql = (sql: string) => {
  if (!sql) return ''
  try {
    return format(sql, { language: 'mysql', tabWidth: 2, keywordCase: 'upper' })
  } catch {
    return sql
  }
}

const highlightSql = (rawSql: string) => {
  if (!rawSql) return ''
  let result = formatSql(rawSql)
  result = result.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  result = result.replace(/'(.*?)'/g, '<span class="text-emerald-600 dark:text-emerald-400">\'$1\'</span>')
  const keywords = ['SELECT','FROM','WHERE','JOIN','ON','GROUP BY','ORDER BY','LIMIT','AND','OR','IN','IS NULL','IS NOT NULL','AS','DISTINCT','HAVING','BETWEEN','LIKE','DESC','ASC','COUNT','SUM','AVG','MIN','MAX','LEFT','RIGHT','INNER','OUTER']
  keywords.forEach(word => {
    const reg = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(reg, `<span class="text-blue-600 dark:text-blue-400 font-black">${word}</span>`)
  })
  result = result.replace(/(?<![.\w-])\b(\d+)\b/g, '<span class="text-amber-600 dark:text-amber-500">$1</span>')
  return result
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('คัดลอกแล้ว', 'คัดลอกคำสั่ง SQL เรียบร้อย')
}

const formatExplanation = (text: string | null | undefined) => {
  if (!text) return ''
  let processedText = text
  if (!processedText.includes('- ') && !processedText.includes('* ')) {
    processedText = processedText.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => `- ${line}`)
      .join('\n')
  }
  return DOMPurify.sanitize(marked.parse(processedText) as string)
}

const isDownloading = ref(false)

const downloadCsv = async (id: string) => {
  isDownloading.value = true
  try {
    toast.info('กำลังเตรียมไฟล์', 'ระบบกำลังดึงข้อมูล...')
    const response = await fetch(`/api/ai-query/export?id=${id}`)
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.statusMessage || 'ดาวน์โหลดไม่สำเร็จ')
    }
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vtiger_export_${id.split('-')[0]?.toUpperCase()}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success('ดาวน์โหลดสำเร็จ', 'ไฟล์ถูกบันทึกลงเครื่องเรียบร้อย')
    if (activeActivity.value?.id === id) {
      activeActivity.value = { ...activeActivity.value, downloadCount: (activeActivity.value.downloadCount || 0) + 1 }
    }
  } catch (e: any) {
    toast.error('ดาวน์โหลดล้มเหลว', e.message || 'ไม่สามารถดาวน์โหลดไฟล์ได้')
  } finally {
    isDownloading.value = false
  }
}

// ─── Top Requesters → ไปหน้าประวัติพร้อม filter ──────────────
const goToHistoryFiltered = (ownerName: string) => {
  router.push({ path: '/history', query: { search: ownerName } })
}
</script>

<template>
  <div class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="border-b border-slate-200 dark:border-slate-800 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-bold uppercase tracking-widest text-xs">
          <LayoutDashboard class="w-4 h-4" />
          {{ isAdminOrManager ? 'System Overview' : 'My Dashboard' }}
        </div>
        <h2 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          ภาพรวมระบบข้อมูล
        </h2>
        <p class="text-slate-500 dark:text-slate-400 text-lg">
          {{ isAdminOrManager ? 'สถิติการดึงข้อมูลและการอนุมัติของทั้งระบบ' : 'สถิติการขอข้อมูลส่วนตัวของคุณ' }}
        </p>
      </div>
      
      <div v-if="isAdminOrManager" class="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl text-sm font-bold border border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
        <ShieldCheck class="w-4 h-4" /> Manager / Admin View
      </div>
    </header>

    <div v-if="pending" class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-violet-600 animate-spin"></div>
      <p class="text-slate-400 font-medium animate-pulse">กำลังโหลดข้อมูลเชิงลึก...</p>
    </div>

    <div v-else-if="error" class="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-600">
      <AlertTriangle class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <h3 class="font-bold text-lg mb-2">ไม่สามารถดึงข้อมูลได้</h3>
      <p>{{ error }}</p>
    </div>

    <div v-else class="space-y-8">
      <!-- 1. KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Total Requests -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:border-violet-300 transition-colors">
          <div class="flex justify-between items-start mb-4">
            <div class="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Database class="w-6 h-6" />
            </div>
            <span class="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg uppercase tracking-wider">Total</span>
          </div>
          <div>
            <h3 class="text-4xl font-black text-slate-900 dark:text-white mb-1">{{ stats.total.toLocaleString() }}</h3>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">คำขอข้อมูลทั้งหมด</p>
          </div>
        </div>

        <!-- Pending -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:border-amber-300 transition-colors">
          <div class="flex justify-between items-start mb-4">
            <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock class="w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 class="text-4xl font-black text-slate-900 dark:text-white mb-1">{{ stats.pending.toLocaleString() }}</h3>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">ค้างรออนุมัติ (Pending)</p>
          </div>
        </div>

        <!-- Approval Rate -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:border-emerald-300 transition-colors">
          <div class="flex justify-between items-start mb-4">
            <div class="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp class="w-6 h-6" />
            </div>
            <span class="text-xs font-bold px-2 py-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">Approved {{ stats.approved }}</span>
          </div>
          <div>
            <h3 class="text-4xl font-black text-slate-900 dark:text-white mb-1">{{ stats.approvalRate }}%</h3>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">อัตราการอนุมัติข้อมูล</p>
          </div>
        </div>

        <!-- Exported Rows -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:border-blue-300 transition-colors">
          <div class="flex justify-between items-start mb-4">
            <div class="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileSpreadsheet class="w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 class="text-4xl font-black text-slate-900 dark:text-white mb-1">{{ stats.exportedRows.toLocaleString() }}</h3>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">จำนวนแถวที่ถูกดึงออกไป</p>
          </div>
        </div>
      </div>

      <!-- 2. Split View: Recent Activity & Top Requesters -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Recent Activity Feed -->
        <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/30 dark:shadow-none">
          <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-between items-center">
            <div class="flex items-center gap-3">
              <Activity class="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h3 class="font-bold text-lg text-slate-900 dark:text-white">กิจกรรมล่าสุด</h3>
            </div>
            <NuxtLink to="/history" class="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1">
              ดูประวัติทั้งหมด <ArrowRight class="w-3 h-3" />
            </NuxtLink>
          </div>
          
          <div class="p-8">
            <div v-if="recentActivity.length === 0" class="text-center py-10 text-slate-400">
              ยังไม่มีประวัติการใช้งาน
            </div>
            <div v-else class="space-y-6">
              <div
                v-for="(activity, i) in recentActivity"
                :key="activity.id"
                class="flex gap-4 relative cursor-pointer group"
                @click="openActivityModal(activity)"
              >
                <!-- Timeline Line -->
                <div v-if="i !== recentActivity.length - 1" class="absolute top-8 left-5 w-px h-full bg-slate-100 dark:bg-slate-800 -z-10"></div>

                <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 flex items-center justify-center shrink-0 border-4 border-white dark:border-slate-900 z-10 transition-colors">
                  <span class="text-xs font-black text-slate-500 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{{ i + 1 }}</span>
                </div>

                <div class="flex-1 pb-4 rounded-2xl p-3 -mx-3 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 transition-colors">
                  <div class="flex justify-between items-start mb-1">
                    <p class="font-bold text-slate-900 dark:text-white">
                      {{ isAdminOrManager ? activity.user : 'คุณ' }}
                      <span class="font-medium text-slate-500 dark:text-slate-400">ร้องขอข้อมูล</span>
                    </p>
                    <span class="text-xs font-bold text-slate-400">{{ new Date(activity.createdAt).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
                  </div>
                  <p class="text-sm text-slate-600 dark:text-slate-300 mb-2 line-clamp-1">"{{ activity.queryText }}"</p>
                  <div class="flex gap-2 flex-wrap">
                    <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border" :class="getStatusColor(activity.status)">
                      {{ getStatusLabel(activity.status) }}
                    </span>
                    <span class="px-2 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-md text-[10px] font-bold border border-slate-100 dark:border-slate-700">
                      {{ activity.resultCount.toLocaleString() }} รายการ
                    </span>
                    <span v-if="activity.status === 'APPROVED'" class="px-2 py-1 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-md text-[10px] font-bold border border-violet-100 dark:border-violet-800 flex items-center gap-1">
                      คลิกดูรายละเอียด <ArrowRight class="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Requesters (Admin Only) -->
        <div v-if="isAdminOrManager" class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/30 dark:shadow-none h-fit">
           <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <div class="flex items-center gap-3">
              <Users class="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 class="font-bold text-lg text-slate-900 dark:text-white">ผู้ที่ดึงข้อมูลบ่อยที่สุด</h3>
            </div>
          </div>
          
          <div class="p-6">
            <div v-if="topRequesters.length === 0" class="text-center py-10 text-slate-400">
              ไม่มีข้อมูล
            </div>
            <div v-else class="space-y-4">
              <div
                v-for="(person, i) in topRequesters"
                :key="i"
                class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 dark:bg-slate-950 dark:hover:bg-blue-900/10 transition-colors cursor-pointer group border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30"
                @click="goToHistoryFiltered(person.user)"
                :title="`ดูประวัติของ ${person.user}`"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
                       :class="i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'">
                    {{ i + 1 }}
                  </div>
                  <div>
                    <p class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{{ person.user }}</p>
                    <p class="text-xs text-slate-500">{{ person.approvedRows.toLocaleString() }} แถวที่ได้ไป</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-right">
                    <span class="font-black text-lg text-blue-600">{{ person.count }}</span>
                    <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">คำขอ</p>
                  </div>
                  <ArrowRight class="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Activity Detail Modal -->
  <ClientOnly>
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="activeActivity"
          class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70"
          @click.self="closeActivityModal"
        >
          <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="px-8 py-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 shrink-0">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center"
                     :class="activeActivity.status === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-900/40' : activeActivity.status === 'REJECTED' ? 'bg-rose-100 dark:bg-rose-900/40' : 'bg-amber-100 dark:bg-amber-900/40'">
                  <CheckCircle v-if="activeActivity.status === 'APPROVED'" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <XCircle v-else-if="activeActivity.status === 'REJECTED'" class="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <Clock v-else class="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 class="font-bold text-slate-900 dark:text-white text-sm">รายละเอียดคำขอข้อมูล</h3>
                  <p class="text-[11px] text-slate-400 font-mono">{{ activeActivity.id?.slice(0, 8) }}...</p>
                </div>
              </div>
              <button @click="closeActivityModal" class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400">
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Body -->
            <div class="overflow-y-auto flex-1 p-8 space-y-6">
              <!-- Meta info -->
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                  <p class="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">ผู้ขอข้อมูล</p>
                  <p class="font-bold text-slate-900 dark:text-white text-sm">{{ isAdminOrManager ? activeActivity.user : 'คุณ' }}</p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                  <p class="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">วันที่ขอ</p>
                  <p class="font-bold text-slate-900 dark:text-white text-sm">{{ new Date(activeActivity.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                  <p class="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">สถานะ</p>
                  <span class="px-2.5 py-1 rounded-lg text-xs font-bold border" :class="getStatusColor(activeActivity.status)">
                    {{ getStatusLabel(activeActivity.status) }}
                  </span>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                  <p class="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">จำนวนข้อมูล</p>
                  <p class="font-black text-2xl text-violet-600 dark:text-violet-400">{{ activeActivity.resultCount?.toLocaleString() }}</p>
                  <p class="text-[10px] text-slate-400">รายการ · ดาวน์โหลดแล้ว {{ activeActivity.downloadCount || 0 }} ครั้ง</p>
                </div>
              </div>

              <!-- วันหมดอายุ -->
              <div v-if="activeActivity.expiresAt" class="flex items-center gap-3 px-4 py-3 rounded-2xl border"
                   :class="isActivityExpired(activeActivity) ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'">
                <TimerOff class="w-4 h-4 shrink-0" />
                <span class="text-xs font-bold">
                  {{ isActivityExpired(activeActivity) ? '⚠️ ลิงก์นี้หมดอายุแล้ว' : `ลิงก์หมดอายุ: ${new Date(activeActivity.expiresAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}` }}
                </span>
              </div>

              <!-- Query Text -->
              <div>
                <p class="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">คำถามที่ขอ</p>
                <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl px-5 py-4">
                  <p class="text-sm text-indigo-900 dark:text-indigo-200 italic leading-relaxed">"{{ activeActivity.queryText }}"</p>
                </div>
              </div>

              <!-- AI Explanation -->
              <div v-if="activeActivity.explanationTh">
                <p class="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">คำอธิบาย AI</p>
                <div class="bg-violet-50/60 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800/30 rounded-2xl px-5 py-4">
                  <div
                    class="text-slate-700 dark:text-slate-200 leading-relaxed text-sm font-medium prose prose-slate dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-1 max-w-none prose-markdown"
                    v-html="formatExplanation(activeActivity.explanationTh)"
                  ></div>
                </div>
              </div>

              <!-- SQL -->
              <div v-if="activeActivity.generatedSql">
                <div class="flex items-center justify-between mb-2">
                  <p class="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-1.5">
                    <Code class="w-3 h-3" /> SQL Query
                  </p>
                  <button @click="copyToClipboard(activeActivity.generatedSql)" class="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors">
                    <Copy class="w-3 h-3" /> คัดลอก
                  </button>
                </div>
                <div class="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-x-auto shadow-inner">
                  <pre class="p-5 text-xs font-mono leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300" v-html="highlightSql(activeActivity.generatedSql)"></pre>
                </div>
              </div>

              <!-- Zoho Link -->
              <div v-if="activeActivity.zohoLink">
                <p class="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Zoho WorkDrive</p>
                <a :href="activeActivity.zohoLink" target="_blank" rel="noopener"
                   class="flex items-center gap-3 px-5 py-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors group">
                  <ExternalLink class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span class="text-sm text-emerald-700 dark:text-emerald-300 font-medium truncate flex-1">{{ activeActivity.zohoLink }}</span>
                  <ArrowRight class="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 flex items-center justify-between gap-3 shrink-0">
              <button @click="closeActivityModal" class="px-6 py-2.5 text-sm font-bold text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border border-slate-200 dark:border-white/10">
                ปิด
              </button>
              <div class="flex gap-3">
                <NuxtLink
                  :to="`/history`"
                  class="px-6 py-2.5 text-sm font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-all border border-violet-200 dark:border-violet-800 flex items-center gap-2"
                >
                  <BarChart3 class="w-4 h-4" /> ดูในประวัติ
                </NuxtLink>
                <button
                  v-if="activeActivity.status === 'APPROVED' && !isActivityExpired(activeActivity)"
                  @click="downloadCsv(activeActivity.id)"
                  :disabled="isDownloading"
                  class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <Download class="w-4 h-4" />
                  {{ isDownloading ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด CSV' }}
                </button>
                <span
                  v-else-if="activeActivity.status === 'APPROVED' && isActivityExpired(activeActivity)"
                  class="px-6 py-2.5 text-sm font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2"
                >
                  <TimerOff class="w-4 h-4" /> ลิงก์หมดอายุแล้ว
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-active > div, .modal-leave-active > div {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-enter-from > div, .modal-leave-to > div {
  transform: scale(0.94);
}

:deep(.prose-markdown ul) {
  @apply space-y-2 list-none pl-6 my-3;
}
:deep(.prose-markdown ul li) {
  @apply relative leading-relaxed;
}
:deep(.prose-markdown ul li::before) {
  content: '•';
  @apply absolute -left-5 text-violet-500 font-black text-xl top-[-2px] leading-none;
}
:deep(.prose-markdown strong) {
  @apply text-slate-900 dark:text-white font-black px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700;
}
:deep(.prose-markdown p) {
  @apply my-1.5;
}
</style>
