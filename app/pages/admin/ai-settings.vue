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
  AlertCircle
} from 'lucide-vue-next'

definePageMeta({
  layout: 'default'
})

const toast = useToast()
const isLoading = ref(true)
const isSaving = ref(false)

const DEFAULT_REFINE_PROMPT = `
คุณคือผู้เชี่ยวชาญด้านการเขียน Prompt สำหรับระบบ Text-to-SQL (Vtiger CRM).
หน้าที่ของคุณคือรับ "คำถามภาษาไทย" จากผู้ใช้ และปรับปรุงให้เป็นประโยคที่ชัดเจนขึ้น เพื่อให้ AI ตัวอื่นนำไปสร้าง SQL ได้ถูกต้องที่สุด.

กฎการทำงาน:
1. คงเนื้อหาเดิมของผู้ใช้ไว้ แต่ขยายความให้ชัดเจน (เช่น ระบุชื่อตารางที่เกี่ยวข้อง: Accounts, Contacts, Products, SalesOrder).
2. ถ้าผู้ใช้ไม่ได้ระบุ Column ให้แนะนำ Column พื้นฐานที่ควรมี (เช่น ชื่อบริษัท, เบอร์โทร, วันที่สร้าง).
3. ใช้ภาษาไทยที่สุภาพและเป็นมืออาชีพ.
4. ตอบกลับเฉพาะ "ประโยคที่ปรับปรุงแล้วเท่านั้น" ไม่ต้องมีคำอธิบายอื่น.
`.trim()

const DEFAULT_GENERATE_INSTRUCTION = `
You are an expert SQL generator for Vtiger CRM 8.4 (MySQL).
The database contains the following key tables and columns. 
Remember that Vtiger heavily relies on the 'vtiger_crmentity' table to store base information (like createdtime, deleted, smownerid) for all modules.

Table: vtiger_crmentity (Base table for all entities)
- crmid (INT, Primary Key)
- smownerid (INT, Owner User ID)
- setype (VARCHAR, Module Name e.g. 'Accounts', 'Contacts', 'SalesOrder')
- createdtime (DATETIME)
- modifiedtime (DATETIME)
- deleted (INT, 0=Active, 1=Deleted. ALWAYS add "deleted = 0" in queries!)

Table: vtiger_account (Accounts / บริษัทลูกค้า)
- accountid (INT, Primary Key, joins with vtiger_crmentity.crmid)
- accountname (VARCHAR, Company Name)
- phone (VARCHAR)
- website (VARCHAR)
- annualrevenue (DECIMAL)
- industry (VARCHAR)

Table: vtiger_contactdetails (Contacts / ผู้ติดต่อ)
- contactid (INT, Primary Key, joins with vtiger_crmentity.crmid)
- accountid (INT, Joins with vtiger_account.accountid)
- firstname (VARCHAR)
- lastname (VARCHAR)
- email (VARCHAR)
- phone (VARCHAR)
- title (VARCHAR, Job Title)

Table: vtiger_salesorder (Sales Orders / ใบสั่งขาย)
- salesorderid (INT, Primary Key, joins with vtiger_crmentity.crmid)
- subject (VARCHAR)
- accountid (INT, Joins with vtiger_account.accountid)
- contactid (INT, Joins with vtiger_contactdetails.contactid)
- total (DECIMAL, Total Amount)
- sostatus (VARCHAR, Status e.g. 'Created', 'Approved', 'Cancelled')

CRITICAL RULES FOR SQL GENERATION:
1. ONLY generate SELECT statements. DO NOT generate INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, or EXEC.
2. If querying a specific module (e.g. Accounts), you MUST JOIN with vtiger_crmentity (e.g. ON vtiger_account.accountid = vtiger_crmentity.crmid) and ALWAYS add "vtiger_crmentity.deleted = 0" to filter out deleted records.
3. Unless a limit is specified in the prompt, ALWAYS append "LIMIT 100" to prevent overwhelming the database.
4. Output your response as a pure JSON object WITHOUT any Markdown code blocks (\`\`\`json) or extra text.
5. The JSON must have exactly three keys: "status", "sql", "explanation" (written in THAI).
`.trim()

const DEFAULT_ANALYZE_INSTRUCTION = `คุณคือ AI นักวิเคราะห์ข้อมูล CRM ที่เชี่ยวชาญ
ตอบเป็นภาษาไทยเสมอ ใช้ภาษาที่อ่านง่าย เข้าใจได้โดยไม่ต้องมีความรู้ด้าน IT
สรุปข้อมูลให้เป็นประโยชน์ต่อธุรกิจ ระบุ Insight ที่น่าสนใจ และข้อสังเกตที่สำคัญ
ตอบในรูปแบบที่มีโครงสร้างชัดเจน ใช้ bullet point หรือหัวข้อย่อย`

const DEFAULT_CHAT_INSTRUCTION = `คุณคือ AI นักวิเคราะห์ข้อมูล CRM ที่เชี่ยวชาญ ชื่อ "DataBot"
ตอบเป็นภาษาไทยเสมอ ใช้ภาษาที่อ่านง่ายและเป็นกันเอง
คุณมีข้อมูลชุดหนึ่งที่ user ถามมา และสามารถวิเคราะห์ ตอบคำถาม และให้ insight ได้
ถ้าถามนอกเหนือจากข้อมูลที่มี ให้บอกอย่างสุภาพว่าไม่มีข้อมูลนั้น
ห้ามสร้างข้อมูลขึ้นมาเอง ตอบจากข้อมูลที่ได้รับเท่านั้น`

const settings = ref({
  refineModel: 'gemini-1.5-flash-8b',
  refineSystemPrompt: DEFAULT_REFINE_PROMPT,
  generateModel: 'gemini-3.1-flash-lite-preview',
  generateSystemInstruction: DEFAULT_GENERATE_INSTRUCTION,
  analyzeModel: 'gemini-2.0-flash',
  analyzeSystemInstruction: DEFAULT_ANALYZE_INSTRUCTION,
  chatModel: 'gemini-2.0-flash',
  chatSystemInstruction: DEFAULT_CHAT_INSTRUCTION,
  maxResultsLimit: 5000
})

const restoreOtherDefaults = () => {
  settings.value.maxResultsLimit = 5000
  toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าขีดจำกัดการดึงข้อมูลเป็น 5,000 รายการแล้ว')
}

const restoreRefineDefaults = () => {
  settings.value.refineModel = 'gemini-1.5-flash-8b'
  settings.value.refineSystemPrompt = DEFAULT_REFINE_PROMPT
  toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบขัดเกลาคำถามแล้ว')
}

const restoreGenerateDefaults = () => {
  settings.value.generateModel = 'gemini-3.1-flash-lite-preview'
  settings.value.generateSystemInstruction = DEFAULT_GENERATE_INSTRUCTION
  toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบสร้าง SQL แล้ว')
}

const restoreAnalyzeDefaults = () => {
  settings.value.analyzeModel = 'gemini-2.0-flash'
  settings.value.analyzeSystemInstruction = DEFAULT_ANALYZE_INSTRUCTION
  toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบวิเคราะห์ข้อมูลแล้ว')
}

const restoreChatDefaults = () => {
  settings.value.chatModel = 'gemini-2.0-flash'
  settings.value.chatSystemInstruction = DEFAULT_CHAT_INSTRUCTION
  toast.info('คืนค่าเริ่มต้น', 'กู้คืนค่าเริ่มต้นของระบบ Chatbot แล้ว')
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

onMounted(() => {
  fetchSettings()
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

    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div v-for="i in 2" :key="i" class="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse"></div>
    </div>

    <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <!-- Refine Engine Settings -->
      <section class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Sparkles class="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">Prompt Refinement</h3>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">ระบบช่วยขัดเกลาคำถาม</p>
            </div>
          </div>
          <button 
            @click="restoreRefineDefaults"
            class="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all"
            title="คืนค่าเริ่มต้น"
          >
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
        
        <div class="p-8 space-y-6 flex-1">
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              AI Model Selection
            </label>
            <input 
              type="text"
              v-model="settings.refineModel"
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
              placeholder="เช่น gemini-2.0-flash"
            />
            <div class="flex flex-wrap gap-2 mt-2 items-center">
              <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">แนะนำ:</span>
              <button @click="settings.refineModel = 'gemini-3.1-flash-lite-preview'" class="px-2 py-1 bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-3.1-flash-lite</button>
              <button @click="settings.refineModel = 'gemini-2.0-flash'" class="px-2 py-1 bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-2.0-flash</button>
              <button @click="settings.refineModel = 'gemini-1.5-pro'" class="px-2 py-1 bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-1.5-pro</button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              System Prompt Instructions
              <span class="text-indigo-500">Editor</span>
            </label>
            <textarea 
              v-model="settings.refineSystemPrompt"
              class="w-full min-h-[600px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-white font-medium text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none custom-scrollbar shadow-sm"
              placeholder="กำหนดบทบาทและกฎเกณฑ์ให้ AI ในการขัดเกลาคำถาม..."
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Generate Engine Settings -->
      <section class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Terminal class="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">SQL Generation</h3>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">ระบบสร้างคำสั่ง SQL</p>
            </div>
          </div>
          <button 
            @click="restoreGenerateDefaults"
            class="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 transition-all"
            title="คืนค่าเริ่มต้น"
          >
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
        
        <div class="p-8 space-y-6 flex-1">
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              AI Model Selection
            </label>
            <input 
              type="text"
              v-model="settings.generateModel"
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
              placeholder="เช่น gemini-2.5-pro"
            />
            <div class="flex flex-wrap gap-2 mt-2 items-center">
              <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">แนะนำ:</span>
              <button @click="settings.generateModel = 'gemini-3.1-flash-lite-preview'" class="px-2 py-1 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-3.1-flash-lite</button>
              <button @click="settings.generateModel = 'gemini-2.5-pro'" class="px-2 py-1 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-2.5-pro</button>
              <button @click="settings.generateModel = 'gemini-2.0-flash'" class="px-2 py-1 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-2.0-flash</button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              Vtiger Schema & Rules
              <span class="text-blue-500">Database Context</span>
            </label>
            <textarea 
              v-model="settings.generateSystemInstruction"
              class="w-full min-h-[600px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-white font-medium text-xs leading-relaxed focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none custom-scrollbar shadow-sm"
              placeholder="ใส่ข้อมูล Schema และเงื่อนไขการสร้าง SQL..."
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Analyze Engine Settings -->
      <section class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <BarChart3 class="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">Data Analysis</h3>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">ระบบสรุปและวิเคราะห์ข้อมูล</p>
            </div>
          </div>
          <button 
            @click="restoreAnalyzeDefaults"
            class="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-violet-600 transition-all"
            title="คืนค่าเริ่มต้น"
          >
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
        
        <div class="p-8 space-y-6 flex-1">
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              AI Model Selection
            </label>
            <input 
              type="text"
              v-model="settings.analyzeModel"
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-medium"
              placeholder="เช่น gemini-2.0-flash"
            />
            <div class="flex flex-wrap gap-2 mt-2 items-center">
              <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">แนะนำ:</span>
              <button @click="settings.analyzeModel = 'gemini-2.0-flash'" class="px-2 py-1 bg-slate-100 hover:bg-violet-100 dark:bg-slate-800 dark:hover:bg-violet-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-2.0-flash</button>
              <button @click="settings.analyzeModel = 'gemini-2.5-pro'" class="px-2 py-1 bg-slate-100 hover:bg-violet-100 dark:bg-slate-800 dark:hover:bg-violet-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-2.5-pro</button>
              <button @click="settings.analyzeModel = 'gemini-1.5-pro'" class="px-2 py-1 bg-slate-100 hover:bg-violet-100 dark:bg-slate-800 dark:hover:bg-violet-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-1.5-pro</button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              Analysis Guidelines
              <span class="text-violet-500">System Instruction</span>
            </label>
            <textarea 
              v-model="settings.analyzeSystemInstruction"
              class="w-full min-h-[300px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-white font-medium text-sm leading-relaxed focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all resize-none custom-scrollbar shadow-sm"
              placeholder="กำหนดบทบาทให้ AI สำหรับการวิเคราะห์และสรุปผล..."
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Chat Engine Settings -->
      <section class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <Bot class="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">Data Chatbot</h3>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">ระบบแชตกับข้อมูล</p>
            </div>
          </div>
          <button 
            @click="restoreChatDefaults"
            class="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-teal-600 transition-all"
            title="คืนค่าเริ่มต้น"
          >
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
        
        <div class="p-8 space-y-6 flex-1">
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              AI Model Selection
            </label>
            <input 
              type="text"
              v-model="settings.chatModel"
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-medium"
              placeholder="เช่น gemini-2.0-flash"
            />
            <div class="flex flex-wrap gap-2 mt-2 items-center">
              <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">แนะนำ:</span>
              <button @click="settings.chatModel = 'gemini-2.0-flash'" class="px-2 py-1 bg-slate-100 hover:bg-teal-100 dark:bg-slate-800 dark:hover:bg-teal-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-2.0-flash</button>
              <button @click="settings.chatModel = 'gemini-2.5-pro'" class="px-2 py-1 bg-slate-100 hover:bg-teal-100 dark:bg-slate-800 dark:hover:bg-teal-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-2.5-pro</button>
              <button @click="settings.chatModel = 'gemini-1.5-pro'" class="px-2 py-1 bg-slate-100 hover:bg-teal-100 dark:bg-slate-800 dark:hover:bg-teal-900/50 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition-colors font-medium border border-slate-200 dark:border-slate-700">gemini-1.5-pro</button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              Chatbot Personality
              <span class="text-teal-500">System Instruction</span>
            </label>
            <textarea 
              v-model="settings.chatSystemInstruction"
              class="w-full min-h-[300px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-white font-medium text-sm leading-relaxed focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all resize-none custom-scrollbar shadow-sm"
              placeholder="กำหนดบทบาทให้ AI สำหรับการแชตตอบคำถาม..."
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Other Settings -->
      <section class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col xl:col-span-2">
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
          </div>
        </div>
      </section>
    </div>

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
