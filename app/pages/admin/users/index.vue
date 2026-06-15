<script setup lang="ts">
import { ref } from 'vue'
import { 
  UserPlus, 
  Edit3, 
  Trash2, 
  Shield, 
  User, 
  Key, 
  Save, 
  X, 
  Users as UsersIcon,
  Search,
  CheckCircle,
  MoreVertical,
  ShieldCheck,
  ShieldAlert
} from 'lucide-vue-next'

const isCreateModalOpen = ref(false)

const users = ref([
  { id: 1, username: 'admin', displayName: 'System Administrator', role: 'admin', isActive: true },
  { id: 2, username: 'manager1', displayName: 'หัวหน้างาน ฝ่ายขาย', role: 'manager', isActive: true },
  { id: 3, username: 'user1', displayName: 'พนักงานขาย 01', role: 'user', isActive: true }
])

const newUser = ref({
  username: '',
  password: '',
  displayName: '',
  role: 'user'
})

const roles = [
  { value: 'user', label: 'User (สำหรับขอข้อมูล)' },
  { value: 'manager', label: 'Manager (สำหรับอนุมัติ)' },
  { value: 'admin', label: 'Admin (ผู้ดูแลระบบ)' }
]

const saveUser = async () => {
  users.value.push({
    id: Date.now(),
    username: newUser.value.username,
    displayName: newUser.value.displayName,
    role: newUser.value.role,
    isActive: true
  })
  isCreateModalOpen.value = false
  newUser.value = { username: '', password: '', displayName: '', role: 'user' }
}
</script>

<template>
  <div class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-8">
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-xs">
          <UsersIcon class="w-4 h-4" />
          User Management
        </div>
        <h2 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">จัดการผู้ใช้งานระบบ</h2>
        <p class="text-slate-500 dark:text-slate-400 text-lg">เพิ่ม แก้ไข หรือลบผู้ใช้งานสำหรับระบบ AI Query</p>
      </div>
      
      <button 
        @click="isCreateModalOpen = true"
        class="group px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest text-sm"
      >
        <UserPlus class="w-5 h-5 group-hover:scale-110 transition-transform" />
        เพิ่มผู้ใช้งาน
      </button>
    </header>

    <!-- Users List Card -->
    <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div class="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield class="w-5 h-5 text-blue-500" />
          รายชื่อผู้ใช้งานทั้งหมด
        </h3>
        
        <div class="relative w-full md:w-80">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="ค้นหาผู้ใช้งาน..." 
            class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 dark:bg-slate-950/50 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
              <th class="px-8 py-5">User Account</th>
              <th class="px-8 py-5">Role & Permissions</th>
              <th class="px-8 py-5">Status</th>
              <th class="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="user in users" :key="user.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
              <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 group-hover:scale-105 transition-transform font-black">
                    {{ user.username.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="text-base font-black text-slate-900 dark:text-white">{{ user.username }}</p>
                    <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">{{ user.displayName }}</p>
                  </div>
                </div>
              </td>
              <td class="px-8 py-6">
                <div class="flex items-center gap-2">
                  <span 
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border"
                    :class="{
                      'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800': user.role === 'admin',
                      'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800': user.role === 'manager',
                      'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800': user.role === 'user'
                    }"
                  >
                    <ShieldCheck v-if="user.role === 'admin'" class="w-3 h-3" />
                    <CheckCircle v-else class="w-3 h-3" />
                    {{ user.role }}
                  </span>
                </div>
              </td>
              <td class="px-8 py-6">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" :class="user.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'"></div>
                  <span class="text-sm font-bold text-slate-600 dark:text-slate-400 tracking-tight">{{ user.isActive ? 'Active' : 'Disabled' }}</span>
                </div>
              </td>
              <td class="px-8 py-6 text-right">
                <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all" title="แก้ไข">
                    <Edit3 class="w-5 h-5" />
                  </button>
                  <button class="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all" title="ลบ">
                    <Trash2 class="w-5 h-5" />
                  </button>
                  <button class="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                    <MoreVertical class="w-5 h-5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create User Modal -->
    <transition name="modal">
      <div v-if="isCreateModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80">
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800" @click.stop>
          <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-50/30 dark:bg-blue-900/10">
            <h3 class="text-xl font-black text-blue-700 dark:text-blue-400 flex items-center gap-3 uppercase tracking-tighter">
              <UserPlus class="w-6 h-6" />
              เพิ่มผู้ใช้งานใหม่
            </h3>
            <button @click="isCreateModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <X class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="saveUser" class="p-8 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <User class="w-3.5 h-3.5" />
                  Username
                </label>
                <input 
                  v-model="newUser.username" 
                  required 
                  placeholder="เช่น somchai.p" 
                  class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all font-bold"
                />
              </div>
              
              <div class="space-y-2">
                <label class="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <Edit3 class="w-3.5 h-3.5" />
                  Full Name
                </label>
                <input 
                  v-model="newUser.displayName" 
                  required 
                  placeholder="สมชาย พนักงานขาย" 
                  class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all font-bold"
                />
              </div>
            </div>
            
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <Key class="w-3.5 h-3.5" />
                Password
              </label>
              <input 
                v-model="newUser.password" 
                type="password" 
                required 
                placeholder="ตั้งรหัสผ่านชั่วคราว" 
                class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all font-bold"
              />
            </div>
            
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <ShieldCheck class="w-3.5 h-3.5" />
                User Role
              </label>
              <select 
                v-model="newUser.role" 
                required
                class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all font-bold appearance-none cursor-pointer"
              >
                <option v-for="role in roles" :key="role.value" :value="role.value">{{ role.label }}</option>
              </select>
            </div>
            
            <div class="pt-6 flex flex-col md:flex-row justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button" 
                @click="isCreateModalOpen = false"
                class="px-8 py-4 text-sm font-black text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-widest"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                class="px-10 py-4 bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest"
              >
                <Save class="w-5 h-5" />
                บันทึกผู้ใช้
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
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

select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1.25rem center;
  background-size: 1.25rem;
}
</style>

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
