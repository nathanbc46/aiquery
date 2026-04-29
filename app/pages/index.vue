<script setup lang="ts">
import { ref } from 'vue'
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
  Copy
} from 'lucide-vue-next'

const prompt = ref('')
const isGenerating = ref(false)
const generatedResult = ref<any>(null)
const isRequesting = ref(false)
const isRequestModalOpen = ref(false)
const requestReason = ref('')
const isCopied = ref(false)
const isRefining = ref(false)
const originalPrompt = ref('')
const isSqlModalOpen = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const toast = useToast()

const suggestions = [
  "รายชื่อลูกค้าใหม่ที่เพิ่มเข้ามาในเดือนนี้",
  "บริษัททั้งหมดที่อยู่ในกลุ่มอุตสาหกรรมไอที",
  "ลูกค้าที่มีอีเมล แต่ไม่มีเบอร์โทรศัพท์",
  "ใบสั่งขายทั้งหมดที่มีสถานะ 'Approved'"
]

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

const handleClarification = () => {
  generatedResult.value = null
  focusAndEnd()
}

const clearInput = () => {
  prompt.value = ''
  originalPrompt.value = ''
  generatedResult.value = null
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
    await navigator.clipboard.writeText(generatedResult.value.sql)
    isCopied.value = true
    setTimeout(() => { isCopied.value = false }, 2000)
    toast.success('คัดลอกแล้ว', 'คัดลอกคำสั่ง SQL ลง Clipboard เรียบร้อย')
  } catch (err) {
    toast.error('ล้มเหลว', 'ไม่สามารถคัดลอกคำสั่งได้')
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

const generateSql = async () => {
  if (!prompt.value) return
  
  isGenerating.value = true
  generatedResult.value = null // Clear old result immediately
  error.value = null
  showPreview.value = false
  
  try {
    const response = await $fetch<any>('/api/ai-query/generate', {
      method: 'POST',
      body: { prompt: prompt.value }
    })
    
    if (response.success && response.status === 'success') {
      generatedResult.value = response
      
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
    console.error(e)
    error.value = e.data?.statusMessage || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI หรือ Database ล้มเหลว'
  } finally {
    isGenerating.value = false
  }
}

const requestApproval = async () => {
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
        requestReason: requestReason.value
      }
    })
    
    if (response.success) {
      if (response.autoApproved) {
        toast.success('อนุมัติอัตโนมัติสำเร็จ', 'เนื่องจากคุณมีสิทธิ์ Manager ระบบจึงอนุมัติและเตรียมข้อมูลให้ทันที!')
      } else {
        toast.success('ส่งคำขอสำเร็จ', 'ส่งคำขออนุมัติไปยังหัวหน้างานเรียบร้อยแล้ว!')
      }
      isRequestModalOpen.value = false
      prompt.value = ''
      requestReason.value = ''
      generatedResult.value = null
    } else {
      toast.error('เกิดข้อผิดพลาด', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('ส่งคำขอไม่สำเร็จ', 'โปรดตรวจสอบการเชื่อมต่อ Database หรือติดต่อ Admin')
  } finally {
    isRequesting.value = false
  }
}

// โหลดค่ากำหนดพื้นฐานจากระบบ
// SQL Formatter & Highlighter Logic (From approvals.vue)
const formatSql = (sqlStr: string) => {
  if (!sqlStr) return ''
  return sqlStr
    .replace(/\s+/g, ' ') // บีบช่องว่างที่เกินมา
    .replace(/\b(SELECT|FROM|WHERE|INNER JOIN|LEFT JOIN|RIGHT JOIN|ORDER BY|GROUP BY|LIMIT|HAVING|VALUES|UPDATE|SET|INSERT INTO|DELETE FROM)\b/gi, '\n$1')
    .replace(/\b(AND|OR|ON)\b/gi, '\n  $1')
    .replace(/,\s*/g, ',\n  ')
    .trim()
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

const { data: systemConfig } = useFetch<any>('/api/system-config')
</script>

<template>
  <div class="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8 relative z-10">
      <div class="space-y-3">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100/50 dark:border-blue-800/50 shadow-sm backdrop-blur-md">
          <Sparkles class="w-3.5 h-3.5 animate-pulse" />
          AI SQL ENGINE PRO
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
    <section class="rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:shadow-indigo-500/10 relative z-10 border border-indigo-100 dark:border-indigo-900/30 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl">
      <form @submit.prevent="generateSql" class="p-8 md:p-10 space-y-6">
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
                  <span>จำกัดการดึงข้อมูลสูงสุด {{ systemConfig?.maxResultsLimit || '...' }} รายการ (ระบุจำนวนที่ต้องการในคำถามได้)</span>
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
          </div>
          
          <div class="relative group">
            <textarea 
              ref="textareaRef"
              v-model="prompt" 
              :readonly="isGenerating"
              placeholder="เช่น ขอลูกค้าที่มียอดสั่งซื้อเกิน 1 แสนบาทในปีนี้ พร้อมเบอร์ติดต่อ..." 
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] px-6 py-5 pr-14 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all resize-none h-40 text-lg leading-relaxed shadow-inner disabled:opacity-50"
              :disabled="isGenerating"
            ></textarea>
            <div class="absolute right-5 bottom-5 flex items-center gap-2">
              <ClientOnly>
                <button 
                  v-if="prompt"
                  type="button"
                  @click="refinePrompt"
                  :disabled="isRefining"
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
                  class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-widest"
                  title="กลับไปใช้ข้อความก่อนขัดเกลา"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                  ใช้ข้อความเดิม
                </button>
                
                <button 
                  v-if="prompt"
                  type="button"
                  @click="clearInput"
                  class="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
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
                <p class="text-amber-800 dark:text-amber-400 leading-relaxed">{{ generatedResult.explanation }}</p>
                <button type="button" @click="handleClarification" class="mt-2 text-sm font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1.5 underline underline-offset-8 decoration-amber-500/30 hover:decoration-amber-500 transition-all">
                  ตกลง ฉันจะระบุข้อมูลใหม่
                  <ArrowRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </transition>
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-10 pt-2">
          <div class="flex flex-wrap gap-2">
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
          </div>
          
          <button 
            type="submit" 
            :disabled="isGenerating || !prompt"
            class="relative group px-12 py-5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-blue-600 dark:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-[2rem] shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 overflow-hidden uppercase tracking-widest text-sm"
          >
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
            <RotateCcw v-if="isGenerating" class="w-6 h-6 animate-spin text-white" />
            <div v-else class="flex items-center gap-2">
              <Database class="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div class="w-px h-4 bg-white/20"></div>
              <Sparkles class="w-5 h-5 text-blue-200" />
            </div>
            <span class="text-base">{{ isGenerating ? 'กำลังคิด...' : 'ประมวลผลด้วย AI' }}</span>
          </button>
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

      </form>
    </section>

    <!-- Skeleton Loading State -->
    <transition name="fade">
      <div v-if="isGenerating" class="mt-12 space-y-6 animate-pulse">
        <div class="h-40 bg-slate-200 dark:bg-slate-800 rounded-[2.5rem]"></div>
        <div class="h-20 bg-slate-100 dark:bg-slate-900 rounded-2xl w-3/4"></div>
      </div>
    </transition>

    <!-- AI Output & Preview (Result Zone) -->
    <transition name="fade">
      <div v-if="generatedResult && generatedResult.status === 'success'" ref="resultSection" class="mt-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
        <div class="rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 bg-white dark:bg-slate-950 backdrop-blur-xl">
          
          <!-- Section 1: Header (Summary & Count) -->
          <div class="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
            <div class="flex-1 p-8 bg-slate-50/30 dark:bg-slate-900/20 relative group/summary">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  <Wand2 class="w-4 h-4" />
                  AI Analysis Summary
                </div>
                <button 
                  @click="isSqlModalOpen = true"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider"
                  title="ดูคำสั่ง SQL ที่ใช้ดึงข้อมูล"
                >
                  <Terminal class="w-3.5 h-3.5" />
                  View SQL
                </button>
              </div>
              <p class="text-slate-700 dark:text-slate-200 leading-relaxed text-lg font-medium">{{ generatedResult.explanation }}</p>
            </div>
            
            <div class="md:w-56 p-8 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-center items-center text-center">
              <span class="font-bold text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Total Records</span>
              <div class="text-5xl font-black tracking-tighter" :class="generatedResult.previewCount > 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'">
                {{ generatedResult.previewCount ?? 0 }}
              </div>
              <p class="text-[10px] font-black mt-1 text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">รายการที่พบ</p>
            </div>
          </div>

          <!-- Zero Records Warning & Refine Button -->
          <div v-if="generatedResult.previewCount === 0" class="p-8 bg-rose-50/50 dark:bg-rose-900/10 border-b border-slate-200 dark:border-slate-800">
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

          <!-- Data Over Limit Warning -->
          <div v-if="generatedResult.previewCount > generatedResult.maxResultsLimit" class="mx-8 mt-8 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
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
          <div v-if="generatedResult.previewData && generatedResult.previewData.length > 0" class="p-8 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-700">
                  <Database class="w-4 h-4" />
                </div>
                <div>
                  <div class="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">Data Insights</div>
                  <h4 class="text-sm font-bold text-slate-900 dark:text-white">ตัวอย่างข้อมูล 10 รายการแรก</h4>
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
          <div class="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8">
            <div class="flex items-center gap-4">
              <div class="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm">
                <ShieldCheck class="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Ready for Approval</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">ชุดคำสั่งนี้ปลอดภัยและพร้อมสำหรับการส่งคำขออนุมัติ</p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <button @click="generatedResult = null" class="flex-1 md:flex-none px-6 py-4 text-xs font-black text-slate-400 hover:text-rose-600 transition-all uppercase tracking-widest">
                ยกเลิก
              </button>
              <button 
                @click="refineQuestion"
                class="flex-1 md:flex-none px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest border border-slate-200 dark:border-slate-700"
              >
                <Edit3 class="w-3.5 h-3.5" />
                ปรับปรุงคำถาม
              </button>
              <button 
                @click="isRequestModalOpen = true"
                :disabled="isRequesting || generatedResult.previewCount === 0"
                class="flex-1 md:flex-none px-10 py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale text-white text-sm font-black rounded-3xl shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest"
              >
                <span>ขออนุมัติดึงข้อมูล</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </transition>

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
                    @click="requestApproval"
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
          <div v-if="isSqlModalOpen" class="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md" @click="isSqlModalOpen = false">
            <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Terminal class="w-6 h-6" />
                  </div>
                  <div>
                    <h3 class="text-lg font-black text-slate-900 dark:text-white">Generated SQL Command</h3>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ชุดคำสั่งที่ใช้ในการดึงข้อมูลจาก Database</p>
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <button 
                    @click="copySql"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95 text-xs font-bold"
                  >
                    <Copy class="w-4 h-4" />
                    {{ isCopied ? 'คัดลอกแล้ว' : 'คัดลอก SQL' }}
                  </button>
                  <button @click="isSqlModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X class="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div class="p-8">
                <div class="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 shadow-inner overflow-x-auto max-h-[500px] custom-scrollbar">
                  <pre class="text-sm font-mono leading-relaxed whitespace-pre-wrap"><code class="sql-highlight" v-html="highlightSql(generatedResult?.sql)"></code></pre>
                </div>
                
                <div class="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-center gap-3">
                  <ShieldCheck class="w-5 h-5 text-emerald-500" />
                  <span class="text-xs font-medium text-emerald-700 dark:text-emerald-400">คำสั่งนี้ผ่านการตรวจสอบความปลอดภัยและอนุญาตให้ใช้งานแบบ Read-only เท่านั้น</span>
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
</style>
