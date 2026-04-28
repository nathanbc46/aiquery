<script setup lang="ts">
import { ref, onMounted } from 'vue'

const pendingRequests = ref<any[]>([])
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
  }
}

onMounted(() => {
  fetchRequests()
})

// Reject Modal State
const isRejectModalOpen = ref(false)
const rejectReason = ref('')
const requestToReject = ref<string | null>(null)

const approveRequest = async (id: string) => {
  isProcessing.value = id
  try {
    const response = await $fetch<any>('/api/ai-query/action', {
      method: 'POST',
      body: { requestId: id, status: 'APPROVED' }
    })
    
    if (response.success) {
      pendingRequests.value = pendingRequests.value.filter(req => req.id !== id)
      toast.success('อนุมัติสำเร็จ', `อนุมัติคำขอ ${id} เรียบร้อยแล้ว ระบบกำลังเตรียมไฟล์ข้อมูลให้พนักงาน`)
    } else {
      toast.error('เกิดข้อผิดพลาด', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
  } finally {
    isProcessing.value = null
  }
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
  <div class="max-w-4xl mx-auto space-y-8">
    <div class="flex items-end justify-between mb-8 border-b border-slate-200 pb-5">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">รายการรออนุมัติดึงข้อมูล</h2>
        <p class="text-slate-500 mt-1">ตรวจสอบชุดคำสั่ง SQL และความปลอดภัยก่อนอนุมัติให้ระบบทำงาน</p>
      </div>
      <div class="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        รอตรวจสอบ {{ pendingRequests.length }} รายการ
      </div>
    </div>

    <div v-if="pendingRequests.length === 0" class="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-slate-900">ไม่มีรายการรออนุมัติ</h3>
      <p class="text-slate-500 mt-2">ยอดเยี่ยมมาก! คุณตรวจสอบครบทุกรายการแล้ว</p>
    </div>

    <div v-else class="space-y-6">
      <div v-for="req in pendingRequests" :key="req.id" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative group">
        <!-- Status Indicator Line -->
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
        
        <div class="p-6">
          <div class="flex justify-between items-start mb-5">
            <div>
              <div class="flex items-center gap-2.5 mb-2">
                <div class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                  {{ req.user.charAt(0) }}
                </div>
                <span class="font-medium text-slate-700 text-sm">{{ req.user }}</span>
                <span class="text-slate-400 text-sm">• {{ req.time }}</span>
              </div>
              <p class="text-lg font-semibold text-slate-900">"{{ req.prompt }}"</p>
            </div>
            
            <div class="text-right bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <div class="text-xs text-slate-500 font-medium mb-0.5 uppercase tracking-wider">ผลลัพธ์ที่จะได้</div>
              <div class="text-2xl font-bold text-blue-600 tracking-tight">{{ req.count }} <span class="text-sm font-medium text-slate-500">รายการ</span></div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <!-- AI Explanation -->
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.82 1.508-2.316a7.5 7.5 0 1 0-7.532 0c.85.496 1.508 1.333 1.508 2.316V18" />
                </svg>
                คำอธิบายจาก AI
              </h4>
              <p class="text-sm text-slate-700 leading-relaxed">{{ req.explanation }}</p>
            </div>
            
            <!-- SQL Code -->
            <div class="bg-slate-900 p-4 rounded-xl flex flex-col">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                </svg>
                ชุดคำสั่ง SQL
              </h4>
              <pre class="text-emerald-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap flex-1">{{ req.sql }}</pre>
            </div>
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
          <div class="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clip-rule="evenodd" />
            </svg>
            ปลอดภัย ไม่มีคำสั่งลบ/แก้ไข
          </div>
          <div class="flex gap-3">
            <button 
              @click="openRejectModal(req.id)"
              :disabled="isProcessing !== null"
              class="px-5 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 rounded-lg transition-colors"
            >
              ไม่อนุมัติ
            </button>
            <button 
              @click="approveRequest(req.id)"
              :disabled="isProcessing !== null"
              class="px-5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <svg v-if="isProcessing === req.id" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              อนุมัติ & ดึงข้อมูล
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Reason Modal -->
    <transition name="modal">
      <div v-if="isRejectModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" @click.stop>
          <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
            <h3 class="text-lg font-bold text-rose-700 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
              </svg>
              ไม่อนุมัติคำขอ
            </h3>
            <button @click="isRejectModalOpen = false" class="text-rose-400 hover:text-rose-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="p-6 space-y-4">
            <p class="text-sm text-slate-600">กรุณาระบุเหตุผลที่ไม่อนุมัติคำขอนี้ เพื่อให้พนักงานทราบและนำไปแก้ไข</p>
            <textarea 
              v-model="rejectReason" 
              placeholder="เช่น ข้อมูลกว้างเกินไป กรุณาระบุเงื่อนไขวันที่ให้ชัดเจนกว่านี้..." 
              class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none h-24 text-sm"
              autofocus
            ></textarea>
            
            <div class="pt-2 flex justify-end gap-3">
              <button 
                @click="isRejectModalOpen = false"
                class="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                @click="confirmReject"
                :disabled="!rejectReason"
                class="px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:bg-rose-400 rounded-lg shadow-sm transition-colors"
              >
                ยืนยันการปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-active > div, .modal-leave-active > div {
  transition: transform 0.3s ease;
}
.modal-enter-from > div, .modal-leave-to > div {
  transform: scale(0.95) translateY(10px);
}
</style>
