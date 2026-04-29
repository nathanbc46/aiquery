<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next'

// Use a safe way to get colorMode
const colorMode = (() => {
  try {
    return useColorMode()
  } catch (e) {
    return null
  }
})()

const toggleColorMode = () => {
  if (!colorMode) return
  
  if (colorMode.preference === 'light') {
    colorMode.preference = 'dark'
  } else if (colorMode.preference === 'dark') {
    colorMode.preference = 'system'
  } else {
    colorMode.preference = 'light'
  }
}
</script>

<template>
  <button 
    v-if="colorMode"
    @click="toggleColorMode"
    class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm"
    title="เปลี่ยนโหมดสี"
  >
    <ClientOnly>
      <Sun v-if="colorMode?.preference === 'light'" class="w-5 h-5" />
      <Moon v-else-if="colorMode?.preference === 'dark'" class="w-5 h-5" />
      <Monitor v-else class="w-5 h-5" />
      
      <template #fallback>
        <div class="w-5 h-5"></div>
      </template>
    </ClientOnly>
  </button>
</template>
