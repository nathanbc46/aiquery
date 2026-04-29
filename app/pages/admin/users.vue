<script setup lang="ts">
import { 
  Users, UserPlus, Shield, CheckCircle2, XCircle, 
  Search, MoreVertical, Edit2, Trash2, ShieldCheck, 
  ShieldAlert, UserCheck, Mail, Save
} from 'lucide-vue-next'

definePageMeta({
  // No need to specify middleware here as auth.global.ts covers all routes
})

const { data: usersData, refresh } = await useFetch<any>('/api/admin/users')
const users = computed(() => usersData.value?.users || [])
const searchQuery = ref('')

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter((u: any) => 
    u.username.toLowerCase().includes(q) || 
    u.displayName.toLowerCase().includes(q)
  )
})

const getRoleBadgeClass = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
    case 'manager': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
    default: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
  }
}

const getRoleIcon = (role: string) => {
  if (role === 'admin') return ShieldAlert
  if (role === 'manager') return ShieldCheck
  return UserCheck
}

const updateRole = async (userId: string, newRole: string) => {
  try {
    await $fetch(`/api/admin/users/${userId}` as any, {
      method: 'PATCH',
      body: { role: newRole }
    })
    refresh()
  } catch (e) {
    alert('ไม่สามารถอัปเดตสิทธิ์ได้')
  }
}

const updateEmail = async (userId: string, newEmail: string) => {
  try {
    await $fetch(`/api/admin/users/${userId}` as any, {
      method: 'PATCH',
      body: { email: newEmail }
    })
    // Silently refresh or show toast
  } catch (e) {
    alert('ไม่สามารถอัปเดตอีเมลได้')
  }
}

const toggleStatus = async (user: any) => {
  try {
    await $fetch(`/api/admin/users/${user.id}` as any, {
      method: 'PATCH',
      body: { isActive: !user.isActive }
    })
    refresh()
  } catch (e) {
    alert('ไม่สามารถอัปเดตสถานะได้')
  }
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold uppercase tracking-widest text-xs">
          <Users class="w-4 h-4" />
          User Administration
        </div>
        <h2 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">จัดการผู้ใช้งานระบบ</h2>
        <p class="text-slate-500 dark:text-slate-400 text-lg">กำหนดสิทธิ์และควบคุมการเข้าถึงระบบ AI สำหรับพนักงาน Vtiger</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="relative group">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="ค้นหาชื่อพนักงาน..." 
            class="pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all w-64 shadow-sm"
          />
        </div>
      </div>
    </header>

    <div class="grid gap-4">
      <div v-if="filteredUsers.length === 0" class="py-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-300 dark:border-slate-800">
        <Users class="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
        <p class="text-slate-500 dark:text-slate-400 font-medium">ไม่พบรายชื่อพนักงานที่ค้นหา</p>
      </div>

      <div 
        v-for="user in filteredUsers" 
        :key="user.id"
        class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all group"
      >
        <div class="flex items-center gap-5">
          <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-500 transition-all duration-500">
            <Users class="w-7 h-7" />
          </div>
          <div>
            <div class="flex items-center gap-3 mb-1">
              <h3 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{{ user.displayName }}</h3>
              <div class="px-2.5 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" :class="getRoleBadgeClass(user.role)">
                <component :is="getRoleIcon(user.role)" class="w-3 h-3" />
                {{ user.role }}
              </div>
            </div>
            <div class="space-y-1">
              <p class="text-slate-500 dark:text-slate-400 text-sm font-medium flex items-center gap-2">
                <span class="opacity-50">Vtiger Username:</span>
                <span class="font-bold text-slate-700 dark:text-slate-300">{{ user.username }}</span>
              </p>
              <div class="flex items-center gap-2 group/email relative">
                <Mail class="w-3.5 h-3.5 text-slate-400 group-focus-within/email:text-blue-500 transition-colors" />
                <input 
                  v-model="user.email" 
                  @blur="updateEmail(user.id, user.email)"
                  placeholder="เพิ่มอีเมลสำหรับแจ้งเตือน..."
                  class="bg-transparent border-none p-0 text-xs font-bold text-blue-600 dark:text-blue-400 focus:ring-0 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 w-48 placeholder:font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Role Switcher -->
          <div class="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button 
              v-for="role in ['user', 'manager', 'admin']" 
              :key="role"
              @click="updateRole(user.id, role)"
              :disabled="user.username === 'admin'"
              class="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              :class="user.role === role 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'"
            >
              {{ role }}
            </button>
          </div>

          <!-- Status Toggle -->
          <button 
            @click="toggleStatus(user)"
            :disabled="user.username === 'admin'"
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-black transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            :class="user.isActive 
              ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100' 
              : 'bg-rose-50 dark:bg-rose-900/10 text-rose-600 border-rose-100 dark:border-rose-900/50 hover:bg-rose-100'"
          >
            <CheckCircle2 v-if="user.isActive" class="w-4 h-4" />
            <XCircle v-else class="w-4 h-4" />
            {{ user.isActive ? 'Active' : 'Suspended' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
