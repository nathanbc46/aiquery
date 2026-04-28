<script setup lang="ts">
import { ref } from 'vue'

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
  <div class="space-y-8">
    <div class="flex items-center justify-between border-b border-slate-200 pb-5">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">จัดการผู้ใช้งานระบบ</h2>
        <p class="text-slate-500 mt-1">เพิ่ม แก้ไข หรือลบผู้ใช้งานสำหรับระบบ AI Query</p>
      </div>
      <button 
        @click="isCreateModalOpen = true"
        class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        เพิ่มผู้ใช้งาน
      </button>
    </div>

    <!-- Users Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600 uppercase tracking-wider">
              <th class="px-6 py-4">Username</th>
              <th class="px-6 py-4">ชื่อ-นามสกุล</th>
              <th class="px-6 py-4">สิทธิ์การใช้งาน</th>
              <th class="px-6 py-4">สถานะ</th>
              <th class="px-6 py-4 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="user in users" :key="user.id" class="hover:bg-slate-50/50 transition-colors">
              <td class="px-6 py-4 text-sm font-medium text-slate-900">{{ user.username }}</td>
              <td class="px-6 py-4 text-sm text-slate-600">{{ user.displayName }}</td>
              <td class="px-6 py-4">
                <span 
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
                  :class="{
                    'bg-rose-100 text-rose-700': user.role === 'admin',
                    'bg-amber-100 text-amber-700': user.role === 'manager',
                    'bg-emerald-100 text-emerald-700': user.role === 'user'
                  }"
                >
                  {{ user.role }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <div class="w-2.5 h-2.5 rounded-full" :class="user.isActive ? 'bg-emerald-500' : 'bg-slate-300'"></div>
                  <span class="text-sm text-slate-600">{{ user.isActive ? 'ใช้งานปกติ' : 'ระงับ' }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-right">
                <button class="text-slate-400 hover:text-blue-600 transition-colors p-1 mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button class="text-slate-400 hover:text-rose-600 transition-colors p-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create User Modal Overlay -->
    <transition name="modal">
      <div v-if="isCreateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" @click.stop>
          <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 class="text-lg font-bold text-slate-900">เพิ่มผู้ใช้งานใหม่</h3>
            <button @click="isCreateModalOpen = false" class="text-slate-400 hover:text-slate-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form @submit.prevent="saveUser" class="p-6 space-y-5">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Username <span class="text-rose-500">*</span></label>
              <input 
                v-model="newUser.username" 
                required 
                placeholder="เช่น somchai.p" 
                class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">ชื่อ-นามสกุล <span class="text-rose-500">*</span></label>
              <input 
                v-model="newUser.displayName" 
                required 
                placeholder="เช่น สมชาย พนักงานขาย" 
                class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่าน <span class="text-rose-500">*</span></label>
              <input 
                v-model="newUser.password" 
                type="password" 
                required 
                placeholder="ตั้งรหัสผ่านชั่วคราว" 
                class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">สิทธิ์การใช้งาน <span class="text-rose-500">*</span></label>
              <select 
                v-model="newUser.role" 
                required
                class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
              >
                <option v-for="role in roles" :key="role.value" :value="role.value">{{ role.label }}</option>
              </select>
            </div>
            
            <div class="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <button 
                type="button" 
                @click="isCreateModalOpen = false"
                class="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                class="px-5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
              >
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
