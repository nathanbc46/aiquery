<script setup lang="ts">
import { ref, onMounted } from 'vue'

const requests = ref<any[]>([])
const isLoading = ref(true)
const toast = useToast()

const fetchHistory = async () => {
  isLoading.value = true
  try {
    // We'll use a new API endpoint for this
    const response = await $fetch<any>('/api/ai-query/history')
    if (response.success) {
      requests.value = response.requests
    }
  } catch (e) {
    console.error(e)
    toast.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงประวัติการขอข้อมูลได้')
  } finally {
    isLoading.value = false
  }
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'APPROVED': return 'bg-emerald-100 text-emerald-700'
    case 'REJECTED': return 'bg-rose-100 text-rose-700'
    case 'PENDING': return 'bg-amber-100 text-amber-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'APPROVED': return 'อนุมัติแล้ว'
    case 'REJECTED': return 'ปฏิเสธ'
    case 'PENDING': return 'รออนุมัติ'
    default: return status
  }
}

const downloadCsv = (id: string) => {
  window.open(`/api/ai-query/export?id=${id}`, '_blank')
}

onMounted(() => {
  fetchHistory()
})
</script>

<template>
  <div class="space-y-8">
    <div class="border-b border-slate-200 pb-5">
      <h2 class="text-2xl font-bold tracking-tight text-slate-900">ประวัติการขอข้อมูล</h2>
      <p class="text-slate-500 mt-1">ตรวจสอบสถานะคำขอและดาวน์โหลดไฟล์ CSV เมื่อได้รับอนุมัติ</p>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>

    <div v-else-if="requests.length === 0" class="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-slate-900">ยังไม่มีประวัติการขอข้อมูล</h3>
      <p class="text-slate-500 mt-1">เริ่มขอข้อมูลใหม่ได้ที่หน้าแรกของระบบ</p>
      <NuxtLink to="/" class="mt-6 inline-flex items-center text-blue-600 font-medium hover:underline">
        ไปที่หน้าขอข้อมูล
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 ml-1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </NuxtLink>
    </div>

    <div v-else class="grid gap-6">
      <div v-for="req in requests" :key="req.id" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="space-y-1">
              <div class="flex items-center gap-3">
                <span class="text-xs font-mono text-slate-400 uppercase tracking-wider">{{ req.id.split('-')[0] }}</span>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide" :class="getStatusClass(req.status)">
                  {{ getStatusLabel(req.status) }}
                </span>
              </div>
              <h3 class="text-lg font-bold text-slate-900">{{ req.query }}</h3>
              <p class="text-xs text-slate-400">ส่งคำขอเมื่อ: {{ req.time }}</p>
            </div>
            
            <button 
              v-if="req.status === 'APPROVED'"
              @click="downloadCsv(req.id)"
              class="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              ดาวน์โหลด CSV
            </button>
          </div>

          <div v-if="req.status === 'REJECTED' && req.reason" class="mb-4 bg-rose-50 rounded-xl p-4 border border-rose-100">
            <p class="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">เหตุผลที่ไม่อนุมัติ:</p>
            <p class="text-sm text-rose-600 leading-relaxed">{{ req.reason }}</p>
          </div>

          <div class="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">คำอธิบายจาก AI:</p>
            <p class="text-sm text-slate-600 leading-relaxed">{{ req.explanation }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
