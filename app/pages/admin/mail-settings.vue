<script setup lang="ts">
import { Mail, Server, Shield, Send, RotateCcw, Save, CheckCircle2, XCircle, Loader2 } from 'lucide-vue-next'

const settings = ref({
  host: '',
  port: 587,
  user: '',
  password: '',
  fromName: 'AI Query System',
  fromEmail: '',
  secure: false,
  requireAuth: true
})

const isLoading = ref(true)
const isSaving = ref(false)
const isTesting = ref(false)
const message = ref({ text: '', type: '' })
const toast = useToast()

// ดึงข้อมูลการตั้งค่าเดิม
const fetchSettings = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<any>('/api/admin/mail-settings')
    if (data.success) {
      settings.value = { ...settings.value, ...data.settings }
    }
  } catch (e: any) {
    message.value = { text: 'ไม่สามารถโหลดข้อมูลการตั้งค่าได้', type: 'error' }
  } finally {
    isLoading.value = false
  }
}

const saveSettings = async () => {
  isSaving.value = true
  message.value = { text: '', type: '' }
  try {
    const data = await $fetch<any>('/api/admin/mail-settings', {
      method: 'POST',
      body: { settings: settings.value }
    })
    if (data.success) {
      message.value = { text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว', type: 'success' }
    }
  } catch (e: any) {
    message.value = { text: e.data?.message || 'เกิดข้อผิดพลาดในการบันทึก', type: 'error' }
  } finally {
    isSaving.value = false
  }
}

const testConnection = async () => {
  isTesting.value = true
  message.value = { text: '', type: '' }
  try {
    const data = await $fetch<any>('/api/admin/mail-settings/test', {
      method: 'POST',
      body: { settings: settings.value }
    })
    if (data.success) {
      message.value = { text: `ส่งอีเมลทดสอบสำเร็จไปยัง ${data.target} เรียบร้อยแล้ว! กรุณาตรวจสอบกล่องขาเข้าของคุณ`, type: 'success' }
    }
  } catch (e: any) {
    message.value = { text: e.data?.message || 'การทดสอบล้มเหลว: ' + (e.data?.error || 'Unknown error'), type: 'error' }
  } finally {
    isTesting.value = false
  }
}

const resetToDefault = () => {
  if (confirm('คุณต้องการรีเซ็ตเป็นค่าเริ่มต้นใช่หรือไม่?')) {
    settings.value = {
      host: '',
      port: 587,
      user: '',
      password: '',
      fromName: 'AI Query System',
      fromEmail: '',
      secure: false,
      requireAuth: true
    }
    toast.info('รีเซ็ตสำเร็จ', 'คืนค่าเริ่มต้นเรียบร้อยแล้ว')
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-xs">
          <Mail class="w-4 h-4" />
          System Configuration
        </div>
        <h2 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">การตั้งค่าเซิร์ฟเวอร์เมล (SMTP)</h2>
        <p class="text-slate-500 dark:text-slate-400 text-lg">กำหนดค่าการส่งอีเมลขาออกสำหรับการแจ้งเตือนในระบบ</p>
      </div>

      <button @click="resetToDefault" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all bg-slate-100 dark:bg-slate-800 rounded-xl">
        <RotateCcw class="w-4 h-4" />
        รีเซ็ตเป็นค่าเริ่มต้น
      </button>
    </header>

    <div v-if="isLoading" class="py-20 flex flex-col items-center justify-center space-y-4">
      <Loader2 class="w-10 h-10 text-blue-500 animate-spin" />
      <p class="text-slate-500 font-medium animate-pulse">กำลังโหลดการตั้งค่า...</p>
    </div>

    <div v-else class="grid lg:grid-cols-3 gap-8">
      <!-- Main Settings Form -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div class="space-y-6">
            <!-- Server Connection -->
            <div class="space-y-4">
              <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Server class="w-5 h-5 text-blue-500" />
                ข้อมูลเซิร์ฟเวอร์
              </h3>
              
              <div class="grid md:grid-cols-3 gap-4">
                <div class="md:col-span-2 space-y-2">
                  <label class="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">ชื่อเซิร์ฟเวอร์ (SMTP Host) *</label>
                  <input v-model="settings.host" type="text" placeholder="เช่น smtp.gmail.com" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">พอร์ต (Port)</label>
                  <input v-model.number="settings.port" type="number" placeholder="587" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium" />
                </div>
              </div>
            </div>

            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Shield class="w-5 h-5 text-blue-500" />
                การยืนยันตัวตน
              </h3>

              <div class="grid md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">ชื่อผู้ใช้ (Username)</label>
                  <input v-model="settings.user" type="text" placeholder="อีเมลของผู้ส่ง" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">รหัสผ่าน (Password)</label>
                  <input v-model="settings.password" type="password" placeholder="รหัสผ่านของระบบเมล" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium" />
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-8 p-6 bg-slate-50 dark:bg-slate-950 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                <label class="flex items-center gap-4 cursor-pointer group">
                  <div class="relative w-14 h-7 rounded-full transition-all duration-300" :class="settings.requireAuth ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-800'">
                    <div class="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300" :class="settings.requireAuth ? 'translate-x-7' : 'translate-x-0'"></div>
                    <input type="checkbox" v-model="settings.requireAuth" class="hidden" />
                  </div>
                  <div class="flex flex-col">
                    <span class="text-sm font-black text-slate-900 dark:text-white">ต้องมีการตรวจสอบสิทธิ์</span>
                    <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Authentication</span>
                  </div>
                </label>

                <label class="flex items-center gap-4 cursor-pointer group border-l border-slate-200 dark:border-slate-800 pl-8">
                  <div class="relative w-14 h-7 rounded-full transition-all duration-300" :class="settings.secure ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-800'">
                    <div class="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300" :class="settings.secure ? 'translate-x-7' : 'translate-x-0'"></div>
                    <input type="checkbox" v-model="settings.secure" class="hidden" />
                  </div>
                  <div class="flex flex-col">
                    <span class="text-sm font-black text-slate-900 dark:text-white">SSL/TLS (Secure)</span>
                    <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Encryption</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Send class="w-5 h-5 text-blue-500" />
                ข้อมูลผู้ส่ง
              </h3>

              <div class="grid md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">ชื่อผู้แสดงผล (From Name)</label>
                  <input v-model="settings.fromName" type="text" placeholder="เช่น AI Query Admin" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">อีเมลผู้ส่ง (From Email)</label>
                  <input v-model="settings.fromEmail" type="email" placeholder="ทิ้งว่างไว้เพื่อใช้ Email เดียวกับ Username" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium" />
                </div>
              </div>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                หมายเหตุ: หากฟิลด์ "อีเมลผู้ส่ง" ว่างไว้ ระบบจะใช้ที่อยู่อีเมลเดียวกับชื่อผู้ใช้ในการส่งออก
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions & Summary -->
      <div class="space-y-6">
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm h-fit sticky top-6">
          <h3 class="text-xl font-black text-slate-900 dark:text-white mb-6">ดำเนินการ</h3>
          
          <div v-if="message.text" :class="message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'" class="p-4 rounded-2xl border mb-6 flex items-start gap-3 text-sm font-bold leading-relaxed">
            <CheckCircle2 v-if="message.type === 'success'" class="w-5 h-5 shrink-0" />
            <XCircle v-else class="w-5 h-5 shrink-0" />
            <span>{{ message.text }}</span>
          </div>

          <div class="space-y-4">
            <button 
              @click="saveSettings" 
              :disabled="isSaving || isTesting"
              class="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 group"
            >
              <Loader2 v-if="isSaving" class="w-5 h-5 animate-spin" />
              <Save v-else class="w-5 h-5" />
              {{ isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า' }}
            </button>

            <button 
              @click="testConnection" 
              :disabled="isSaving || isTesting"
              class="w-full py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-900 dark:text-white font-black rounded-2xl border border-slate-200 dark:border-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3 group"
            >
              <Loader2 v-if="isTesting" class="w-5 h-5 animate-spin text-blue-600" />
              <Send v-else class="w-5 h-5 text-blue-600" />
              {{ isTesting ? 'กำลังทดสอบ...' : 'ทดสอบการส่งเมล' }}
            </button>
          </div>

          <div class="mt-8 space-y-4">
            <h4 class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">สถานะระบบเมล</h4>
            <div class="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-500">SMTP Host</span>
                <span class="text-xs font-black text-slate-900 dark:text-white truncate max-w-[120px]">{{ settings.host || 'ยังไม่ได้ตั้งค่า' }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-500">Authentication</span>
                <span class="text-xs font-black" :class="settings.requireAuth ? 'text-emerald-500' : 'text-slate-400'">{{ settings.requireAuth ? 'เปิดใช้งาน' : 'ปิด' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
