<script setup lang="ts">
import {
  Cpu,
  Save,
  Wand2,
  Terminal,
  RotateCcw,
  Sparkles,
  Database,
  BarChart3,
  Bot,
  AlertCircle,
  Link,
  CheckCircle2,
  XCircle,
  EyeOff,
  Zap,
  FileText,
  ChevronDown
} from 'lucide-vue-next'

definePageMeta({
  layout: 'default'
})

const toast = useToast()
const isLoading = ref(true)
const isSaving = ref(false)
const activeTab = ref<'sql'|'agentic'|'refine'|'analyze'|'chat'>('agentic')

const settings = ref({
  refineModel: '',
  refineSystemPrompt: '',
  generateModel: '',
  generateSystemInstruction: '',
  analyzeModel: '',
  analyzeSystemInstruction: '',
  chatModel: '',
  chatSystemInstruction: '',
  optimizeModel: '',
  maxResultsLimit: 5000,
  useHybridSchema: false,
  isDebugMode: false,
  customHints: '',
  agenticModel: 'gemini-2.5-flash',
  generateMode: 'agentic' as 'agentic' | 'static',
  agenticMaxIterations: 12
})

const availableModels = ref<string[]>([])
const isFetchingModels = ref(false)
const openModelPickers = ref<Record<string, boolean>>({})

const toggleModelPicker = async (key: string) => {
  if (openModelPickers.value[key]) {
    openModelPickers.value[key] = false
  } else {
    if (availableModels.value.length === 0) {
      await fetchAvailableModels()
    }
    openModelPickers.value[key] = true
  }
}

const fetchAvailableModels = async () => {
  isFetchingModels.value = true
  try {
    const response = await $fetch<any>('/api/admin/models')
    if (response.success && response.models) {
      availableModels.value = response.models.map((m: any) => m.name)
    } else {
      toast.error('ล้มเหลว', response.error || 'ไม่สามารถดึงข้อมูลโมเดลได้')
    }
  } catch (e) {
    toast.error('ล้มเหลว', 'เกิดข้อผิดพลาดในการดึงข้อมูลโมเดล')
  } finally {
    isFetchingModels.value = false
  }
}

const restoreRefineDefaults = async () => {
  try {
    const { defaults } = await $fetch<any>('/api/admin/ai-settings/defaults')
    settings.value.refineModel = defaults.refineModel
    settings.value.refineSystemPrompt = defaults.refineSystemPrompt
    toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบขัดเกลาคำถามแล้ว')
  } catch (e) {
    toast.error('ล้มเหลว', 'ไม่สามารถดึงค่าเริ่มต้นได้')
  }
}

const restoreGenerateDefaults = async () => {
  try {
    const { defaults } = await $fetch<any>('/api/admin/ai-settings/defaults')
    settings.value.generateModel = defaults.generateModel
    settings.value.generateSystemInstruction = defaults.generateSystemInstruction
    toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบสร้าง SQL แล้ว')
  } catch (e) {
    toast.error('ล้มเหลว', 'ไม่สามารถดึงค่าเริ่มต้นได้')
  }
}

const restoreAnalyzeDefaults = async () => {
  try {
    const { defaults } = await $fetch<any>('/api/admin/ai-settings/defaults')
    settings.value.analyzeModel = defaults.analyzeModel
    settings.value.analyzeSystemInstruction = defaults.analyzeSystemInstruction
    toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบวิเคราะห์ข้อมูลแล้ว')
  } catch (e) {
    toast.error('ล้มเหลว', 'ไม่สามารถดึงค่าเริ่มต้นได้')
  }
}

const restoreChatDefaults = async () => {
  try {
    const { defaults } = await $fetch<any>('/api/admin/ai-settings/defaults')
    settings.value.chatModel = defaults.chatModel
    settings.value.chatSystemInstruction = defaults.chatSystemInstruction
    toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบ Chatbot แล้ว')
  } catch (e) {
    toast.error('ล้มเหลว', 'ไม่สามารถดึงค่าเริ่มต้นได้')
  }
}

const restoreOtherDefaults = async () => {
  try {
    const { defaults } = await $fetch<any>('/api/admin/ai-settings/defaults')
    settings.value.maxResultsLimit = defaults.maxResultsLimit
    settings.value.useHybridSchema = defaults.useHybridSchema
    settings.value.isDebugMode = defaults.isDebugMode
    toast.info('คืนค่าเริ่มต้น', 'กู้คืนการตั้งค่าทั่วไปแล้ว')
  } catch (e) {
    toast.error('ล้มเหลว', 'ไม่สามารถดึงค่าเริ่มต้นได้')
  }
}


const fetchSettings = async (forceDefaults = false) => {
  isLoading.value = true
  try {
    const response = await $fetch<any>('/api/admin/ai-settings')
    if (response.success) {
      settings.value = { ...response.settings }
      if (forceDefaults) {
         toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบสร้าง SQL แล้ว')
      }
    }
  } catch (error) {
    toast.error('ล้มเหลว', 'ไม่สามารถดึงข้อมูลการตั้งค่าได้')
  } finally {
    isLoading.value = false
  }
}

const saveSettings = async () => {
  isSaving.value = true
  try {
    const response = await $fetch<any>('/api/admin/ai-settings', {
      method: 'POST',
      body: settings.value
    })
    if (response.success) {
      toast.success('สำเร็จ', 'บันทึกการตั้งค่าเรียบร้อยแล้ว')
    } else {
      toast.error('ล้มเหลว', response.error)
    }
  } catch (error) {
    toast.error('ล้มเหลว', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
  } finally {
    isSaving.value = false
  }
}

const syncingPicklists = ref(false)
const syncPicklists = async () => {
  syncingPicklists.value = true
  try {
    const response = await $fetch<any>('/api/admin/ai-settings/sync-picklists', {
      method: 'POST'
    })
    if (response.success) {
      settings.value.generateSystemInstruction = response.updatedInstruction
      toast.success('สำเร็จ', response.message)
    } else {
      toast.error('ล้มเหลว', response.error)
    }
  } catch (error: any) {
    toast.error('ล้มเหลว', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
  } finally {
    syncingPicklists.value = false
  }
}

const zohoStatus = ref<{ connected: boolean; expired?: boolean; expiresAt?: string } | null>(null)
const zohoError = ref('')
const isRefreshingToken = ref(false)

const fetchZohoStatus = async () => {
  try {
    zohoStatus.value = await $fetch<any>('/api/admin/zoho-status')
  } catch {
    zohoStatus.value = { connected: false }
  }
}

const connectZoho = () => {
  window.location.href = '/api/zoho/auth'
}

const forceRefreshToken = async () => {
  isRefreshingToken.value = true
  try {
    const res = await $fetch<any>('/api/admin/zoho-refresh', { method: 'POST' })
    if (res.success) {
      toast.success('สำเร็จ', res.message)
      await fetchZohoStatus()
    } else {
      toast.error('ล้มเหลว', res.message)
    }
  } catch (e: any) {
    toast.error('ล้มเหลว', e.message)
  } finally {
    isRefreshingToken.value = false
  }
}

const route = useRoute()

onMounted(() => {
  fetchSettings()
  fetchZohoStatus()
  if (route.query.zoho === 'connected') {
    useRouter().replace('/admin/ai-settings')
  } else if (route.query.zoho === 'error') {
    zohoError.value = (route.query.msg as string) || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Zoho'
    useRouter().replace('/admin/ai-settings')
  }
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
      <div class="space-y-2">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/50">
          <Cpu class="w-3.5 h-3.5" />
          AI CONFIGURATION
        </div>
        <h2 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">ตั้งค่าปัญญาประดิษฐ์</h2>
        <p class="text-slate-500 dark:text-slate-400 font-medium">จัดการโมเดลและคำสั่งหลัก (System Prompt) สำหรับระบบดึงข้อมูล</p>
      </div>
      
      <button 
        @click="saveSettings"
        :disabled="isSaving || isLoading"
        class="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
      >
        <RotateCcw v-if="isSaving" class="w-4 h-4 animate-spin" />
        <Save v-else class="w-4 h-4" />
        บันทึกการตั้งค่า
      </button>
    </header>

    <div v-if="isLoading" class="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse"></div>

    <div v-else class="space-y-6">
      <!-- Tab Bar -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <!-- Tab navigation -->
        <div class="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 scrollbar-none">
          <button v-for="tab in [
            { key: 'agentic',label: 'Agentic Mode',      icon: 'zap',       color: 'violet' },
            { key: 'sql',    label: 'SQL Generation',    icon: 'terminal',  color: 'blue'   },
            { key: 'refine', label: 'Prompt Refinement', icon: 'sparkles',  color: 'indigo' },
            { key: 'analyze',label: 'Data Analysis',     icon: 'chart',     color: 'violet' },
            { key: 'chat',   label: 'Data Chatbot',      icon: 'bot',       color: 'teal'   },
          ]" :key="tab.key"
            @click="activeTab = tab.key as any"
            class="flex items-center gap-2 px-5 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition-all shrink-0"
            :class="activeTab === tab.key
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'"
          >
            <Terminal v-if="tab.icon === 'terminal'" class="w-4 h-4" />
            <Zap v-else-if="tab.icon === 'zap'" class="w-4 h-4" />
            <Sparkles v-else-if="tab.icon === 'sparkles'" class="w-4 h-4" />
            <BarChart3 v-else-if="tab.icon === 'chart'" class="w-4 h-4" />
            <Bot v-else-if="tab.icon === 'bot'" class="w-4 h-4" />
            {{ tab.label }}
          </button>
        </div>

        <!-- Tab Content -->
        <div class="p-6 space-y-6">

          <!-- ── Tab: SQL Generation ── -->
          <div v-show="activeTab === 'sql'" class="space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-slate-900 dark:text-white">SQL Generation (Static Mode)</h3>
                <p class="text-xs text-slate-500 mt-0.5">โมเดลและ Schema ที่ใช้เมื่อเลือกโหมด Static</p>
              </div>
              <div class="flex items-center gap-2">
                <button @click="syncPicklists" :disabled="syncingPicklists"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-all"
                  title="ดึงข้อมูล Picklist จาก Vtiger">
                  <RotateCcw v-if="syncingPicklists" class="w-3.5 h-3.5 animate-spin" />
                  <Database v-else class="w-3.5 h-3.5" />
                  Sync DB
                </button>
                <button @click="restoreGenerateDefaults" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 transition-all" title="คืนค่าเริ่มต้น">
                  <RotateCcw class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Model (Static)</label>
              <div class="relative">
                <div class="flex gap-2">
                  <input :value="settings.generateModel" readonly @click="toggleModelPicker('generate')"
                    class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/40 font-medium" />
                  <button @click="toggleModelPicker('generate')" :disabled="isFetchingModels"
                    class="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all">
                    <RotateCcw v-if="isFetchingModels" class="w-3.5 h-3.5 animate-spin" />
                    <RotateCcw v-else class="w-3.5 h-3.5" />
                    Fetch
                  </button>
                </div>
                <div v-if="openModelPickers['generate'] && availableModels.length"
                  class="absolute top-full left-0 right-14 z-20 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto max-h-52">
                  <button v-for="m in availableModels" :key="m"
                    @click="settings.generateModel = m; openModelPickers['generate'] = false"
                    class="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                    :class="m === settings.generateModel ? 'text-blue-600 font-bold bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-700 dark:text-slate-300'">
                    {{ m }}
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                Vtiger Schema & Rules <span class="text-blue-500 normal-case font-bold text-[10px]">Database Context</span>
              </label>
              <textarea v-model="settings.generateSystemInstruction"
                class="w-full min-h-[400px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-slate-900 dark:text-white font-medium text-xs leading-relaxed focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 outline-none transition-all resize-y custom-scrollbar"
                placeholder="ใส่ข้อมูล Schema และเงื่อนไขการสร้าง SQL..."></textarea>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Optimize SQL Model <span class="text-rose-500 normal-case font-bold">*สำหรับผู้บริหารและ DBA*</span>
              </label>
              <p class="text-[10px] text-slate-500">โมเดลสำหรับปุ่ม Optimize SQL (แนะนำโมเดลรุ่น Pro)</p>
              <div class="relative">
                <div class="flex gap-2">
                  <input :value="settings.optimizeModel" readonly @click="toggleModelPicker('optimize')"
                    class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/40 font-medium" />
                  <button @click="toggleModelPicker('optimize')" :disabled="isFetchingModels"
                    class="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all">
                    <RotateCcw v-if="isFetchingModels" class="w-3.5 h-3.5 animate-spin" />
                    <RotateCcw v-else class="w-3.5 h-3.5" />
                    Fetch
                  </button>
                </div>
                <div v-if="openModelPickers['optimize'] && availableModels.length"
                  class="absolute top-full left-0 right-14 z-20 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto max-h-52">
                  <button v-for="m in availableModels" :key="'opt-'+m"
                    @click="settings.optimizeModel = m; openModelPickers['optimize'] = false"
                    class="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                    :class="m === settings.optimizeModel ? 'text-blue-600 font-bold bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-700 dark:text-slate-300'">
                    {{ m }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Tab: Agentic Mode ── -->
          <div v-show="activeTab === 'agentic'" class="space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-slate-900 dark:text-white">Agentic Mode Configuration</h3>
                <p class="text-xs text-slate-500 mt-0.5">ตั้งค่าโหมดการสร้าง SQL และ Business Rules</p>
              </div>
            </div>

            <!-- Mode Selector -->
            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generate Mode</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div @click="settings.generateMode = 'agentic'"
                  class="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all"
                  :class="settings.generateMode === 'agentic' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    :class="settings.generateMode === 'agentic' ? 'bg-violet-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'">
                    <Zap class="w-5 h-5" />
                  </div>
                  <div>
                    <p class="font-bold text-sm text-slate-900 dark:text-white">Agentic Mode</p>
                    <p class="text-[11px] text-slate-500">AI ค้นหา Schema จาก DB อัตโนมัติด้วย Tool Calling</p>
                  </div>
                  <div class="ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    :class="settings.generateMode === 'agentic' ? 'border-violet-500 bg-violet-500' : 'border-slate-300'">
                    <div v-if="settings.generateMode === 'agentic'" class="w-1.5 h-1.5 rounded-full bg-white"></div>
                  </div>
                </div>
                <div @click="settings.generateMode = 'static'"
                  class="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all"
                  :class="settings.generateMode === 'static' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    :class="settings.generateMode === 'static' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'">
                    <FileText class="w-5 h-5" />
                  </div>
                  <div>
                    <p class="font-bold text-sm text-slate-900 dark:text-white">Static Mode</p>
                    <p class="text-[11px] text-slate-500">ใช้ Schema คงที่จากแท็บ SQL Generation</p>
                  </div>
                  <div class="ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    :class="settings.generateMode === 'static' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'">
                    <div v-if="settings.generateMode === 'static'" class="w-1.5 h-1.5 rounded-full bg-white"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Agentic Model — แสดงเฉพาะ Agentic mode -->
            <div v-show="settings.generateMode === 'agentic'" class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Model (Agentic)</label>
              <div class="relative">
                <div class="flex gap-2">
                  <input :value="settings.agenticModel" readonly @click="toggleModelPicker('agentic')"
                    class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400/40 font-medium" />
                  <button @click="toggleModelPicker('agentic')" :disabled="isFetchingModels"
                    class="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all">
                    <RotateCcw v-if="isFetchingModels" class="w-3.5 h-3.5 animate-spin" />
                    <RotateCcw v-else class="w-3.5 h-3.5" />
                    Fetch
                  </button>
                </div>
                <div v-if="openModelPickers['agentic'] && availableModels.length"
                  class="absolute top-full left-0 right-14 z-20 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto max-h-52">
                  <button v-for="m in availableModels" :key="'ag-'+m"
                    @click="settings.agenticModel = m; openModelPickers['agentic'] = false"
                    class="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                    :class="m === settings.agenticModel ? 'text-violet-600 font-bold bg-violet-50/50 dark:bg-violet-900/10' : 'text-slate-700 dark:text-slate-300'">
                    {{ m }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Max Iterations — แสดงเฉพาะ Agentic mode -->
            <div v-show="settings.generateMode === 'agentic'" class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Tool-Call Iterations</label>
              <p class="text-[11px] text-slate-500">จำนวนรอบสูงสุดที่ AI สามารถเรียก Tool (เช็ค Schema / ตาราง) ก่อนสร้าง SQL — ค่าแนะนำ 8–20</p>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="settings.agenticMaxIterations"
                  type="number"
                  min="1"
                  max="50"
                  class="w-28 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400/40 font-medium"
                />
                <span class="text-xs text-slate-400">รอบ (default: 12)</span>
              </div>
            </div>

            <!-- Business Hints — แสดงเฉพาะ Agentic mode -->
            <div v-show="settings.generateMode === 'agentic'" class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Business Hints สำหรับ AI
              </label>
              <p class="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Sparkles class="w-3 h-3 text-violet-400 shrink-0" />
                ข้อความนี้จะถูกส่งให้ AI เป็น context เพิ่มเติมทุกครั้งที่สร้างคำสั่ง SQL
              </p>
              <textarea v-model="settings.customHints" rows="8"
                placeholder="อธิบาย business rules พิเศษที่ AI ควรรู้ เช่น:&#10;- หมวดหมู่สินค้าที่ผูกกับ Opportunity ให้ใช้ตาราง app_potential_product JOIN vtiger_productcategory ON app_potential_product.productcategory = vtiger_productcategory.productcategory&#10;- ลูกค้า VIP อยู่ใน vtiger_account โดยดูจาก rating = 'Hot'"
                class="w-full font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 resize-y custom-scrollbar leading-relaxed"></textarea>
            </div>
          </div>

          <!-- ── Tab: Prompt Refinement ── -->
          <div v-show="activeTab === 'refine'" class="space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-slate-900 dark:text-white">Prompt Refinement</h3>
                <p class="text-xs text-slate-500 mt-0.5">ระบบช่วยขัดเกลาคำถามก่อนสร้าง SQL</p>
              </div>
              <button @click="restoreRefineDefaults" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all" title="คืนค่าเริ่มต้น">
                <RotateCcw class="w-4 h-4" />
              </button>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Model</label>
              <div class="relative">
                <div class="flex gap-2">
                  <input :value="settings.refineModel" readonly @click="toggleModelPicker('refine')"
                    class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400/40 font-medium" />
                  <button @click="toggleModelPicker('refine')" :disabled="isFetchingModels"
                    class="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all">
                    <RotateCcw v-if="isFetchingModels" class="w-3.5 h-3.5 animate-spin" />
                    <RotateCcw v-else class="w-3.5 h-3.5" />
                    Fetch
                  </button>
                </div>
                <div v-if="openModelPickers['refine'] && availableModels.length"
                  class="absolute top-full left-0 right-14 z-20 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto max-h-52">
                  <button v-for="m in availableModels" :key="'re-'+m"
                    @click="settings.refineModel = m; openModelPickers['refine'] = false"
                    class="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                    :class="m === settings.refineModel ? 'text-indigo-600 font-bold' : 'text-slate-700 dark:text-slate-300'">
                    {{ m }}
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                System Prompt Instructions <span class="text-indigo-500 normal-case font-bold text-[10px]">Editor</span>
              </label>
              <textarea v-model="settings.refineSystemPrompt"
                class="w-full min-h-[400px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-slate-900 dark:text-white font-medium text-sm leading-relaxed focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 outline-none transition-all resize-y custom-scrollbar"
                placeholder="กำหนดบทบาทและกฎเกณฑ์ให้ AI ในการขัดเกลาคำถาม..."></textarea>
            </div>
          </div>

          <!-- ── Tab: Data Analysis ── -->
          <div v-show="activeTab === 'analyze'" class="space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-slate-900 dark:text-white">Data Analysis</h3>
                <p class="text-xs text-slate-500 mt-0.5">ระบบสรุปและวิเคราะห์ข้อมูล</p>
              </div>
              <button @click="restoreAnalyzeDefaults" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-violet-600 transition-all" title="คืนค่าเริ่มต้น">
                <RotateCcw class="w-4 h-4" />
              </button>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Model</label>
              <div class="relative">
                <div class="flex gap-2">
                  <input :value="settings.analyzeModel" readonly @click="toggleModelPicker('analyze')"
                    class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400/40 font-medium" />
                  <button @click="toggleModelPicker('analyze')" :disabled="isFetchingModels"
                    class="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all">
                    <RotateCcw v-if="isFetchingModels" class="w-3.5 h-3.5 animate-spin" />
                    <RotateCcw v-else class="w-3.5 h-3.5" />
                    Fetch
                  </button>
                </div>
                <div v-if="openModelPickers['analyze'] && availableModels.length"
                  class="absolute top-full left-0 right-14 z-20 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto max-h-52">
                  <button v-for="m in availableModels" :key="'an-'+m"
                    @click="settings.analyzeModel = m; openModelPickers['analyze'] = false"
                    class="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                    :class="m === settings.analyzeModel ? 'text-violet-600 font-bold' : 'text-slate-700 dark:text-slate-300'">
                    {{ m }}
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                Analysis Guidelines <span class="text-violet-500 normal-case font-bold text-[10px]">System Instruction</span>
              </label>
              <textarea v-model="settings.analyzeSystemInstruction"
                class="w-full min-h-[400px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-slate-900 dark:text-white font-medium text-sm leading-relaxed focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 outline-none transition-all resize-y custom-scrollbar"
                placeholder="กำหนดบทบาทให้ AI สำหรับการวิเคราะห์และสรุปผล..."></textarea>
            </div>
          </div>

          <!-- ── Tab: Data Chatbot ── -->
          <div v-show="activeTab === 'chat'" class="space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-slate-900 dark:text-white">Data Chatbot</h3>
                <p class="text-xs text-slate-500 mt-0.5">ระบบแชตกับข้อมูล</p>
              </div>
              <button @click="restoreChatDefaults" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-teal-600 transition-all" title="คืนค่าเริ่มต้น">
                <RotateCcw class="w-4 h-4" />
              </button>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Model</label>
              <div class="relative">
                <div class="flex gap-2">
                  <input :value="settings.chatModel" readonly @click="toggleModelPicker('chat')"
                    class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400/40 font-medium" />
                  <button @click="toggleModelPicker('chat')" :disabled="isFetchingModels"
                    class="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all">
                    <RotateCcw v-if="isFetchingModels" class="w-3.5 h-3.5 animate-spin" />
                    <RotateCcw v-else class="w-3.5 h-3.5" />
                    Fetch
                  </button>
                </div>
                <div v-if="openModelPickers['chat'] && availableModels.length"
                  class="absolute top-full left-0 right-14 z-20 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto max-h-52">
                  <button v-for="m in availableModels" :key="'ch-'+m"
                    @click="settings.chatModel = m; openModelPickers['chat'] = false"
                    class="w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                    :class="m === settings.chatModel ? 'text-teal-600 font-bold' : 'text-slate-700 dark:text-slate-300'">
                    {{ m }}
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                Chatbot Personality <span class="text-teal-500 normal-case font-bold text-[10px]">System Instruction</span>
              </label>
              <textarea v-model="settings.chatSystemInstruction"
                class="w-full min-h-[400px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-slate-900 dark:text-white font-medium text-sm leading-relaxed focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 outline-none transition-all resize-y custom-scrollbar"
                placeholder="กำหนดบทบาทให้ AI สำหรับการแชตตอบคำถาม..."></textarea>
            </div>
          </div>

        </div>
      </div>

      <!-- Other Settings -->
      <section class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
              <Database class="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">Other Settings</h3>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">การตั้งค่าทั่วไปของระบบ</p>
            </div>
          </div>
          <button 
            @click="restoreOtherDefaults"
            class="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"
            title="คืนค่าเริ่มต้น"
          >
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
        
        <div class="p-8 space-y-6 flex-1">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="space-y-3">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Maximum Result Limit
              </label>
              <div class="relative">
                <input 
                  type="number"
                  v-model.number="settings.maxResultsLimit"
                  class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all font-mono font-bold"
                  placeholder="เช่น 5000"
                />
                <div class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Rows</div>
              </div>
              <p class="text-[11px] text-slate-500 leading-relaxed">
                กำหนดจำนวนแถวสูงสุดที่ระบบอนุญาตให้ดึงข้อมูลในหนึ่งครั้ง (Preview และ Export) เพื่อป้องกันภาระหนักต่อฐานข้อมูล
              </p>
            </div>

            <!-- Hybrid & Debug Default -->
            <div class="space-y-4">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Feature Defaults (ค่าเริ่มต้นสำหรับผู้ใช้)
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div 
                  @click="settings.useHybridSchema = !settings.useHybridSchema"
                  class="flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer"
                  :class="settings.useHybridSchema ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-100 dark:bg-slate-950 dark:border-slate-900'"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="settings.useHybridSchema ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400 dark:bg-slate-800'">
                      <Cpu class="w-4 h-4" />
                    </div>
                    <div>
                      <p class="text-xs font-bold text-slate-900 dark:text-white">Hybrid Schema (Default)</p>
                      <p class="text-[10px] text-slate-500">เปิดใช้งานการเลือกตารางอัตโนมัติเป็นค่าเริ่มต้น</p>
                    </div>
                  </div>
                  <div class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="settings.useHybridSchema" class="sr-only peer">
                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                </div>

                <div 
                  @click="settings.isDebugMode = !settings.isDebugMode"
                  class="flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer"
                  :class="settings.isDebugMode ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-100 dark:bg-slate-950 dark:border-slate-900'"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="settings.isDebugMode ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400 dark:bg-slate-800'">
                      <Terminal class="w-4 h-4" />
                    </div>
                    <div>
                      <p class="text-xs font-bold text-slate-900 dark:text-white">Debug Mode (Default)</p>
                      <p class="text-[10px] text-slate-500">แสดงข้อมูล Debug เป็นค่าเริ่มต้น</p>
                    </div>
                  </div>
                  <div class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="settings.isDebugMode" class="sr-only peer">
                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Zoho Integration -->
    <section class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Link class="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h3 class="font-bold text-slate-900 dark:text-white">Zoho Sheet Integration</h3>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">เชื่อมต่อกับ Zoho Sheet เพื่อ Export ข้อมูล</p>
        </div>
      </div>
      <div class="p-8 space-y-4">
        <div class="flex items-center justify-between gap-6">
          <div class="flex items-center gap-3">
            <template v-if="zohoStatus === null">
              <div class="w-4 h-4 rounded-full bg-slate-200 animate-pulse"></div>
              <span class="text-sm text-slate-400 font-medium">กำลังตรวจสอบ...</span>
            </template>
            <template v-else-if="zohoStatus.connected && !zohoStatus.expired">
              <CheckCircle2 class="w-5 h-5 text-emerald-500" />
              <div>
                <p class="text-sm font-bold text-emerald-600 dark:text-emerald-400">เชื่อมต่อแล้ว</p>
                <p v-if="zohoStatus.expiresAt" class="text-[11px] text-slate-400">Token หมดอายุ: {{ new Date(zohoStatus.expiresAt).toLocaleString('th-TH') }}</p>
              </div>
            </template>
            <template v-else-if="zohoStatus.connected && zohoStatus.expired">
              <XCircle class="w-5 h-5 text-amber-400" />
              <div>
                <p class="text-sm font-bold text-amber-600 dark:text-amber-400">Token หมดอายุ — มี Refresh Token อยู่</p>
                <p class="text-[11px] text-slate-400">กด "Refresh Token" เพื่อต่ออายุอัตโนมัติ หรือ Re-connect ถ้า Refresh ไม่ผ่าน</p>
              </div>
            </template>
            <template v-else>
              <XCircle class="w-5 h-5 text-red-400" />
              <div>
                <p class="text-sm font-bold text-red-500 dark:text-red-400">ยังไม่ได้เชื่อมต่อ</p>
                <p class="text-[11px] text-slate-400">กรุณากด Connect เพื่อเชื่อมต่อกับ Zoho</p>
              </div>
            </template>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="fetchZohoStatus"
              class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"
              title="รีเฟรชสถานะ"
            >
              <RotateCcw class="w-4 h-4" />
            </button>
            <button
              v-if="zohoStatus?.connected && zohoStatus?.expired"
              @click="forceRefreshToken"
              :disabled="isRefreshingToken"
              class="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all active:scale-95"
            >
              <RotateCcw :class="['w-4 h-4', { 'animate-spin': isRefreshingToken }]" />
              Refresh Token
            </button>
            <button
              @click="connectZoho"
              class="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-all active:scale-95"
            >
              <Link class="w-4 h-4" />
              {{ zohoStatus?.connected ? 'Re-connect Zoho' : 'Connect Zoho' }}
            </button>
          </div>
        </div>
        <div v-if="zohoError" class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
          <XCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ zohoError }}</span>
        </div>
      </div>
    </section>

    <!-- Security Note -->
    <div class="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-6 rounded-3xl flex gap-4">
      <AlertCircle class="w-6 h-6 text-amber-600 shrink-0" />
      <div class="space-y-1">
        <h4 class="font-bold text-amber-900 dark:text-amber-200 text-sm">ข้อควรระวังสำหรับผู้ดูแลระบบ</h4>
        <p class="text-xs text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
          การเปลี่ยน System Instruction อาจส่งผลกระทบต่อความแม่นยำในการสร้าง SQL กรุณาตรวจสอบให้แน่ใจว่าเงื่อนไขที่กำหนดครอบคลุมตารางและคอลัมน์ที่จำเป็นใน Vtiger CRM 8.4
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.3);
  border-radius: 10px;
}
</style>
