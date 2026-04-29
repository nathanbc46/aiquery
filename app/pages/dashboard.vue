<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
  ShieldCheck
} from 'lucide-vue-next'

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
              <div v-for="(activity, i) in recentActivity" :key="activity.id" class="flex gap-4 relative">
                <!-- Timeline Line -->
                <div v-if="i !== recentActivity.length - 1" class="absolute top-8 left-5 w-px h-full bg-slate-100 dark:bg-slate-800 -z-10"></div>
                
                <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border-4 border-white dark:border-slate-900 z-10">
                  <span class="text-xs font-black text-slate-500">{{ i + 1 }}</span>
                </div>
                
                <div class="flex-1 pb-4">
                  <div class="flex justify-between items-start mb-1">
                    <p class="font-bold text-slate-900 dark:text-white">
                      {{ isAdminOrManager ? activity.user : 'คุณ' }} 
                      <span class="font-medium text-slate-500 dark:text-slate-400">ร้องขอข้อมูล</span>
                    </p>
                    <span class="text-xs font-bold text-slate-400">{{ new Date(activity.createdAt).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
                  </div>
                  <p class="text-sm text-slate-600 dark:text-slate-300 mb-2">"{{ activity.queryText }}"</p>
                  <div class="flex gap-2">
                    <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border" :class="getStatusColor(activity.status)">
                      {{ getStatusLabel(activity.status) }}
                    </span>
                    <span class="px-2 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-md text-[10px] font-bold border border-slate-100 dark:border-slate-700">
                      {{ activity.resultCount.toLocaleString() }} รายการ
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
              <div v-for="(person, i) in topRequesters" :key="i" class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/50 transition-colors">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
                       :class="i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'">
                    {{ i + 1 }}
                  </div>
                  <div>
                    <p class="font-bold text-sm text-slate-900 dark:text-white">{{ person.user }}</p>
                    <p class="text-xs text-slate-500">{{ person.approvedRows.toLocaleString() }} แถวที่ได้ไป</p>
                  </div>
                </div>
                <div class="text-right">
                  <span class="font-black text-lg text-blue-600">{{ person.count }}</span>
                  <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">คำขอ</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
