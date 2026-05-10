<script setup lang="ts">
import { 
  Home, 
  History,
  LayoutDashboard,
  CheckSquare, 
  Users, 
  Menu, 
  X, 
  Zap,
  ChevronRight,
  LogOut,
  Settings,
  Cpu,
  User,
  AlertTriangle,
  Mail,
  UserCircle,
  Bot
} from 'lucide-vue-next'

const isMobileMenuOpen = ref(false)
const showLogoutModal = ref(false)
const systemStatus = useState<any>('system-status', () => ({ 
  database: 'Checking...', 
  status: 'loading',
  pendingApprovals: 0 
}))

// Authentication State — no await (keeps component sync, prevents Suspense mismatch)
// useRequestHeaders forwards session cookie so SSR & client see the same auth state
const reqHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: auth, refresh: refreshAuth } = useFetch<any>('/api/auth/me', { headers: reqHeaders })
const user = computed(() => auth.value?.user)

const logout = () => {
  showLogoutModal.value = true
}

const confirmLogout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refreshAuth()
  navigateTo('/login')
}

const fetchStatus = async () => {
  try {
    const data = await $fetch<any>('/api/system/status')
    if (data.success) {
      systemStatus.value.status = data.status
      systemStatus.value.database = data.database
      systemStatus.value.pendingApprovals = data.pendingApprovals
      systemStatus.value.myPendingRequests = data.myPendingRequests
    }
  } catch (e) {
    systemStatus.value.status = 'offline'
    systemStatus.value.database = 'Disconnected'
  }
}

let statusInterval: any = null

onMounted(() => {
  fetchStatus()
  // อัปเดตสถานะอัตโนมัติทุก 30 วินาที
  statusInterval = setInterval(fetchStatus, 30000)
})

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
})

const navItems = computed(() => {
  const items = [
    { to: '/', label: 'หน้าแรก', icon: Home },
    { to: '/dashboard', label: 'ภาพรวมระบบ', icon: LayoutDashboard },
    { to: '/history', label: 'ประวัติการใช้งาน', icon: History },
  ]

  // Show Approvals for managers/admins
  if (user.value?.role === 'manager' || user.value?.role === 'admin') {
    items.push({ to: '/approvals', label: 'รอการอนุมัติ', icon: CheckSquare })
  }

  return items
})

const adminSettingsItems = computed(() => {
  if (user.value?.role !== 'admin') return []
  
  return [
    { to: '/admin/users', label: 'จัดการผู้ใช้งาน', icon: Users },
    { to: '/admin/ai-settings', label: 'ตั้งค่า AI', icon: Cpu },
    { to: '/admin/mail-settings', label: 'ตั้งค่า Server Mail', icon: Mail },
  ]
})

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500 overflow-x-hidden relative">
    
    <!-- Background Blobs (Desktop only — heavy GPU on mobile) -->
    <div class="hidden lg:block fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div class="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-400/25 dark:bg-blue-600/20 rounded-full blur-[120px] animate-blob"></div>
      <div class="absolute top-1/4 -right-40 w-[600px] h-[600px] bg-indigo-400/25 dark:bg-indigo-600/20 rounded-full blur-[140px] animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-purple-400/25 dark:bg-purple-600/20 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
    </div>

    <!-- Desktop Sidebar -->
    <aside class="hidden lg:flex flex-col w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-r border-white/20 dark:border-slate-800/50 h-screen sticky top-0 z-30 transition-all duration-300">
      <div class="p-8">
          <div class="flex items-center gap-3 group">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 group-hover:rotate-12 transition-all duration-500">
              <div class="animate-bounce flex items-center justify-center">
                <Bot class="w-6 h-6" />
              </div>
            </div>
            <div>
              <h1 class="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">AI-Query</h1>
              <div class="flex items-center gap-1.5 mt-1.5">
                <div class="w-2 h-2 rounded-full animate-pulse" :class="{
                  'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]': systemStatus.status === 'online',
                  'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]': systemStatus.status === 'offline',
                  'bg-amber-500 animate-bounce': systemStatus.status === 'loading'
                }"></div>
                <span class="text-[10px] font-black uppercase tracking-widest" :class="{
                  'text-emerald-600 dark:text-emerald-400': systemStatus.status === 'online',
                  'text-rose-600 dark:text-rose-400': systemStatus.status === 'offline',
                  'text-slate-400': systemStatus.status === 'loading'
                }">DB: {{ systemStatus.database }}</span>
              </div>
            </div>
          </div>
      </div>

      <nav class="flex-1 px-4 py-4 space-y-8 overflow-y-auto">
        <!-- Main Navigation -->
        <div class="space-y-1">
          <ClientOnly>
            <NuxtLink 
              v-for="item in navItems" 
              :key="item.to"
              :to="item.to"
              class="flex items-center justify-between px-4 py-3.5 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all group"
              active-class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 !hover:bg-blue-50"
            >
              <div class="flex items-center gap-3">
                <div class="relative">
                  <component :is="item.icon" class="w-5 h-5 transition-transform group-hover:scale-110" />
                </div>
                <span class="text-sm tracking-tight">{{ item.label }}</span>
              </div>
              <div class="flex items-center gap-2">
                <!-- Badge for My Pending Requests (User specific) -->
                <div v-if="item.to === '/history' && systemStatus.myPendingRequests > 0" class="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-blue-500/20 animate-in zoom-in duration-300">
                  {{ systemStatus.myPendingRequests }}
                </div>

                <!-- Badge for Global Pending Approvals (Manager/Admin) -->
                <div v-if="item.to === '/approvals' && systemStatus.pendingApprovals > 0" class="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-orange-500/20 animate-in zoom-in duration-300">
                  {{ systemStatus.pendingApprovals }}
                </div>
                <ChevronRight class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </div>
            </NuxtLink>
          </ClientOnly>
        </div>

        <!-- Admin Settings Group -->
        <ClientOnly>
          <div v-if="adminSettingsItems.length > 0" class="space-y-2">
            <div class="px-4 flex items-center gap-2 mb-2">
              <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">System Settings</span>
            </div>
            <NuxtLink
              v-for="item in adminSettingsItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center justify-between px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all group"
              active-class="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 !hover:bg-indigo-50"
            >
              <div class="flex items-center gap-3">
                <component :is="item.icon" class="w-4 h-4 transition-transform group-hover:scale-110" />
                <span class="text-[13px] tracking-tight">{{ item.label }}</span>
              </div>
              <ChevronRight class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </NuxtLink>
          </div>
        </ClientOnly>
      </nav>

      <div class="p-6 space-y-3">
        <div class="glass-card rounded-2xl p-2 border border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
          <div class="flex items-center justify-between p-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <UserCircle class="w-4 h-4 text-slate-500" />
              </div>
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Account Center</span>
            </div>
            <ClientOnly>
              <ThemeToggle />
            </ClientOnly>
          </div>
          
          <div class="flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-800 mb-1">
            <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <User class="w-5 h-5" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-black text-slate-900 dark:text-white truncate">{{ user?.displayName || 'Guest' }}</p>
              <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{{ user?.role || 'Guest' }}</p>
            </div>
          </div>
          
          <button @click="logout" class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 transition-all group">
            <div class="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <LogOut class="w-4 h-4" />
            </div>
            <span class="text-xs font-black uppercase tracking-widest">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- Mobile Header -->
    <header class="lg:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-16 px-6 flex items-center justify-between z-40">
      <NuxtLink to="/" class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
          <Bot class="w-5 h-5" />
        </div>
        <span class="font-black tracking-tighter text-slate-900 dark:text-white uppercase">AI-Query</span>
      </NuxtLink>
      
      <button @click="isMobileMenuOpen = true" class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
        <Menu class="w-6 h-6" />
      </button>
    </header>

    <!-- Mobile Menu Overlay -->
    <transition name="fade">
      <div v-if="isMobileMenuOpen" class="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50" @click="closeMobileMenu"></div>
    </transition>

    <!-- Mobile Sidebar -->
    <transition name="slide">
      <aside v-if="isMobileMenuOpen" class="lg:hidden fixed top-0 left-0 bottom-0 w-80 bg-white dark:bg-slate-900 z-[60] shadow-2xl flex flex-col transition-transform duration-500">
        <div class="p-8 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white">
              <div class="animate-bounce flex items-center justify-center">
                <Bot class="w-6 h-6" />
              </div>
            </div>
            <div>
              <h1 class="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">AI-Query</h1>
              <div class="flex items-center gap-1.5 mt-1">
                <div class="w-2 h-2 rounded-full" :class="{
                  'bg-emerald-500': systemStatus.status === 'online',
                  'bg-rose-500': systemStatus.status === 'offline',
                  'bg-amber-500': systemStatus.status === 'loading'
                }"></div>
                <span class="text-[10px] font-black uppercase tracking-widest" :class="{
                  'text-emerald-600 dark:text-emerald-400': systemStatus.status === 'online',
                  'text-rose-600 dark:text-rose-400': systemStatus.status === 'offline',
                  'text-slate-400': systemStatus.status === 'loading'
                }">{{ systemStatus.database }}</span>
              </div>
            </div>
          </div>
          <button @click="closeMobileMenu" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <X class="w-6 h-6" />
          </button>
        </div>

        <nav class="flex-1 px-4 space-y-2">
          <NuxtLink 
            v-for="item in navItems" 
            :key="item.to"
            :to="item.to"
            @click="closeMobileMenu"
            class="flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            active-class="bg-blue-600 text-white shadow-xl shadow-blue-500/20"
          >
            <div class="relative">
              <component :is="item.icon" class="w-6 h-6" />
              <div v-if="item.to === '/approvals' && systemStatus.pendingApprovals > 0" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xl">
                {{ systemStatus.pendingApprovals }}
              </div>
            </div>
            <span class="text-base">{{ item.label }}</span>
            <div v-if="item.to === '/approvals' && systemStatus.pendingApprovals > 0" class="ml-auto px-2.5 py-1 bg-white/20 text-white text-[10px] font-black rounded-lg">
              {{ systemStatus.pendingApprovals }} PENDING
            </div>
          </NuxtLink>

          <!-- Mobile Admin Settings -->
          <ClientOnly><div v-if="adminSettingsItems.length > 0" class="pt-6 space-y-2">
            <div class="px-6 flex items-center gap-2 mb-2">
              <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">System Settings</span>
            </div>
            <NuxtLink 
              v-for="item in adminSettingsItems" 
              :key="item.to"
              :to="item.to"
              @click="closeMobileMenu"
              class="flex items-center gap-4 px-6 py-3.5 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              active-class="bg-indigo-600 text-white shadow-xl shadow-indigo-500/20"
            >
              <component :is="item.icon" class="w-5 h-5" />
              <span class="text-sm">{{ item.label }}</span>
            </NuxtLink>
          </div></ClientOnly>
        </nav>

        <div class="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <ThemeToggle />
          <button @click="logout" class="flex items-center gap-2 text-rose-500 font-bold">
            <LogOut class="w-5 h-5" />
            ออกจากระบบ
          </button>
        </div>
      </aside>
    </transition>

    <!-- Main Content -->
    <main class="flex-1 lg:h-screen lg:overflow-y-auto pt-20 lg:pt-0 relative">
      <div class="max-w-7xl mx-auto p-6 md:p-10 lg:p-12 min-h-full flex flex-col">
        <div class="flex-1">
          <slot />
        </div>
        
        <footer class="mt-20 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-400 font-medium">
          <p>&copy; 2024 Vtiger AI-Query System. All rights reserved.</p>
          <div class="flex items-center gap-8">
            <a href="#" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</a>
            <a href="#" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</a>
            <a href="#" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Docs</a>
          </div>
        </footer>
      </div>
    </main>
    <!-- Logout Confirmation Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showLogoutModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-md" @click="showLogoutModal = false"></div>
          
          <!-- Modal Card -->
          <div class="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 p-8 overflow-hidden">
            <div class="absolute top-0 right-0 p-8 opacity-5">
              <LogOut class="w-32 h-32 text-slate-900 dark:text-white" />
            </div>
            
            <div class="relative text-center">
              <div class="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto mb-6">
                <AlertTriangle class="w-8 h-8" />
              </div>
              
              <h3 class="text-xl font-black text-slate-900 dark:text-white mb-2">ยืนยันการออกจากระบบ?</h3>
              <p class="text-slate-500 dark:text-slate-400 font-medium mb-8">คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบในขณะนี้?</p>
              
              <div class="grid grid-cols-2 gap-4">
                <button 
                  @click="showLogoutModal = false"
                  class="py-3.5 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  @click="confirmLogout"
                  class="py-3.5 px-6 rounded-xl bg-rose-600 text-white font-black shadow-xl shadow-rose-500/20 hover:bg-rose-700 active:scale-95 transition-all"
                >
                  ออกจากระบบ
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

body {
  font-family: 'Outfit', sans-serif;
  @apply antialiased bg-slate-50 dark:bg-slate-950;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  @apply bg-transparent;
}
::-webkit-scrollbar-thumb {
  @apply bg-slate-200 dark:bg-slate-800 rounded-full;
}
::-webkit-scrollbar-thumb:hover {
  @apply bg-slate-300 dark:bg-slate-700;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }
</style>
