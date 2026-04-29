<script setup lang="ts">
definePageMeta({
  layout: false
})

import { 
  Bot, 
  AlertCircle, 
  User, 
  Lock, 
  Loader2, 
  ArrowRight, 
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-vue-next'

const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')
const showPassword = ref(false)

const handleLogin = async () => {
  if (!username.value || !password.value) {
    errorMsg.value = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { 
        username: username.value, 
        password: password.value,
        rememberMe: rememberMe.value 
      }
    })

    // Success - Redirect to home or history
    navigateTo('/history')
  } catch (e: any) {
    errorMsg.value = e.data?.message || 'การเข้าสู่ระบบล้มเหลว'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans">
    <!-- Background Decoration -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full"></div>
      <div class="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-violet-500/5 blur-[120px] rounded-full"></div>
    </div>

    <div class="w-full max-w-[440px] relative">
      <!-- Logo/Brand Section -->
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-500/20 mb-6 transform hover:rotate-12 transition-transform duration-500">
          <Bot class="w-10 h-10 text-white animate-bounce" />
        </div>
        <h1 class="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">AI Query <span class="text-blue-600">System</span></h1>
        <p class="text-slate-500 dark:text-slate-400 font-medium">เข้าสู่ระบบด้วยบัญชี Vtiger CRM ของคุณ</p>
      </div>

      <!-- Login Card -->
      <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden">
        <form @submit.prevent="handleLogin" class="space-y-6">
          <!-- Error Alert -->
          <transition name="fade">
            <div v-if="errorMsg" class="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/50 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm font-bold">
              <AlertCircle class="w-5 h-5 shrink-0" />
              {{ errorMsg }}
            </div>
          </transition>

          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">Username</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User class="w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input 
                v-model="username"
                type="text" 
                placeholder="ชื่อผู้ใช้งาน Vtiger" 
                class="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">Password</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock class="w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input 
                v-model="password"
                :type="showPassword ? 'text' : 'password'" 
                placeholder="รหัสผ่าน" 
                class="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
              />
              <button 
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
              >
                <Eye v-if="!showPassword" class="w-5 h-5" />
                <EyeOff v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Remember Me -->
          <div class="flex items-center justify-between px-1">
            <label class="flex items-center gap-3 cursor-pointer group">
              <div class="relative flex items-center">
                <input 
                  v-model="rememberMe"
                  type="checkbox" 
                  class="peer appearance-none w-5 h-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                />
                <ShieldCheck class="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 left-0.5 pointer-events-none transition-opacity" />
              </div>
              <span class="text-sm font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">จดจำฉันไว้ในระบบ</span>
            </label>
          </div>

          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
          >
            <Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
            <span v-else>เข้าสู่ระบบ</span>
            <ArrowRight v-if="!isLoading" class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <!-- Decoration Line -->
        <div class="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
          <p class="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck class="w-4 h-4" /> Secure Vtiger Authentication
          </p>
        </div>
      </div>

      <!-- Footer Info -->
      <p class="text-center mt-8 text-slate-400 dark:text-slate-600 text-xs font-medium">
        &copy; 2026 CRM AI-Query System. All rights reserved.
      </p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: all 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
