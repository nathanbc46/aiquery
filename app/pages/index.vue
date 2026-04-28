<script setup lang="ts">
import { ref } from 'vue'

const prompt = ref('')
const isGenerating = ref(false)
const generatedResult = ref<any>(null)
const isRequesting = ref(false)
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
  generatedResult.value = null
  if (textareaRef.value) textareaRef.value.focus()
}

const generateSql = async () => {
  if (!prompt.value) return
  
  isGenerating.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/generate', {
      method: 'POST',
      body: { prompt: prompt.value }
    })
    
    if (response.success) {
      generatedResult.value = {
        status: response.status,
        sql: response.sql,
        explanation: response.explanation,
        previewCount: response.previewCount
      }
      
      if (response.status === 'clarification_needed') {
        toast.info('AI มีข้อสงสัย', 'โปรดให้รายละเอียดเพิ่มเติมตามที่ AI แนะนำ')
      }
    } else {
      toast.error('เกิดข้อผิดพลาด', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('ไม่สามารถเชื่อมต่อ API ได้', 'หรือตั้งค่า API Key ในไฟล์ .env ไม่ถูกต้อง')
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
        resultCount: generatedResult.value.previewCount
      }
    })
    
    if (response.success) {
      toast.success('ส่งคำขอสำเร็จ', 'ส่งคำขออนุมัติไปยังหัวหน้างานเรียบร้อยแล้ว!')
      prompt.value = ''
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
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-8">
    <div class="text-center space-y-3 mb-10">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900">ระบบดึงข้อมูลอัจฉริยะ</h2>
      <p class="text-slate-500 text-lg">พิมพ์สิ่งที่คุณต้องการค้นหาเป็นภาษาไทย แล้ว AI จะจัดการแปลงเป็น SQL อย่างปลอดภัย</p>
    </div>

    <ClientOnly>
      <!-- Chat Box -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <form @submit.prevent="generateSql" class="p-6">
          <label class="block text-sm font-medium text-slate-700 mb-2">คุณต้องการค้นหาข้อมูลอะไร?</label>
          <div class="relative group">
            <textarea 
              ref="textareaRef"
              v-model="prompt" 
              placeholder="เช่น ขอลูกค้าที่มียอดสั่งซื้อเกิน 1 แสนบาทในปีนี้ พร้อมเบอร์ติดต่อ..." 
              class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 pr-10 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none h-24"
            ></textarea>
            <button 
              v-if="prompt"
              type="button"
              @click="clearInput"
              class="absolute right-3 top-3 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-all"
              title="ล้างข้อความ"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Clarification Box (Immediately under textarea) -->
          <transition name="fade">
            <div v-if="generatedResult?.status === 'clarification_needed'" class="mt-3">
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 shadow-sm">
                <div class="bg-amber-100 p-2 rounded-lg h-fit">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-amber-600">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                </div>
                <div class="space-y-1">
                  <h3 class="font-bold text-amber-900 text-sm">AI ต้องการข้อมูลเพิ่มเติม</h3>
                  <p class="text-amber-800 text-xs leading-relaxed">{{ generatedResult.explanation }}</p>
                  <button type="button" @click="handleClarification" class="mt-1 text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1">
                    ตกลง ฉันจะระบุข้อมูลใหม่
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </transition>
          
          <div class="mt-3 flex flex-wrap gap-2">
            <button 
              v-for="text in suggestions" 
              :key="text"
              type="button"
              @click="useSuggestion(text)"
              class="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-200 hover:border-blue-200"
            >
              {{ text }}
            </button>
          </div>

          <div class="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-blue-500">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <span><strong>หมายเหตุ:</strong> ระบบจะจำกัดผลลัพธ์ที่ 100 รายการแรกเพื่อความรวดเร็ว คุณสามารถพิมพ์ระบุจำนวนที่ต้องการเพิ่มได้ เช่น "ขอดูลูกค้า 500 คน..."</span>
          </div>
          
          <div class="mt-6 flex justify-end">
            <button 
              type="submit" 
              :disabled="isGenerating || !prompt"
              class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <svg v-if="isGenerating" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              {{ isGenerating ? 'กำลังประมวลผล...' : 'สร้างชุดคำสั่งดึงข้อมูล' }}
            </button>
          </div>
        </form>
      </div>

      <!-- AI Output & Preview -->
      <transition name="fade">
        <div v-if="generatedResult" class="space-y-6">
          
          <!-- Explanation & Count -->
          <div v-if="generatedResult.status === 'success'" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2 bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
              <h3 class="font-semibold text-blue-900 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
                เหตุผลและคำอธิบาย
              </h3>
              <p class="text-blue-800/80 leading-relaxed">{{ generatedResult.explanation }}</p>
            </div>
            
            <div class="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex flex-col justify-center items-center text-center">
              <h3 class="font-semibold text-emerald-900 mb-1 text-sm uppercase tracking-wider">รายการที่พบ</h3>
              <div class="text-4xl font-bold text-emerald-600 tracking-tight">{{ generatedResult.previewCount }}</div>
              <p class="text-emerald-600/70 text-sm mt-1">รายการ</p>
            </div>
          </div>

          <!-- SQL Code Block -->
          <div v-if="generatedResult.status === 'success'" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 class="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
                </svg>
                ชุดคำสั่ง SQL (Read-Only)
              </h3>
            </div>
            
            <div class="p-5 bg-slate-900">
              <pre class="text-emerald-400 text-sm font-mono whitespace-pre-wrap leading-relaxed">{{ generatedResult.sql }}</pre>
            </div>
            
            <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <p class="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clip-rule="evenodd" />
                </svg>
                ตรวจสอบความปลอดภัยแล้ว
              </p>
              <div class="flex gap-3">
                <button @click="generatedResult = null" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg transition-colors">
                  ยกเลิก
                </button>
                <button 
                  @click="requestApproval"
                  :disabled="isRequesting"
                  class="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                  <svg v-if="isRequesting" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  ขออนุมัติดึงข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </ClientOnly>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
