<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
    <header class="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <!-- Custom Icon placeholder -->
          <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
            AI
          </div>
          <h1 class="text-xl font-semibold tracking-tight text-slate-900">Vtiger AI Query</h1>
        </div>
        <nav class="flex gap-1">
          <NuxtLink 
            to="/" 
            class="px-4 py-2 text-sm font-medium rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            active-class="bg-slate-100 text-slate-900"
          >
            ระบบขอข้อมูล
          </NuxtLink>
          <NuxtLink 
            to="/history" 
            class="px-4 py-2 text-sm font-medium rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            active-class="bg-slate-100 text-slate-900"
          >
            ประวัติคำขอ
          </NuxtLink>
          <NuxtLink 
            to="/approvals" 
            class="px-4 py-2 text-sm font-medium rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
            active-class="bg-slate-100 text-slate-900"
          >
            รออนุมัติ
            <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500"></span>
          </NuxtLink>
          <NuxtLink 
            to="/admin/users" 
            class="px-4 py-2 text-sm font-medium rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            active-class="bg-slate-100 text-slate-900"
          >
            จัดการผู้ใช้
          </NuxtLink>
        </nav>
      </div>
    </header>
    <main class="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
      <slot />
    </main>
  </div>
</template>

<style>
/* Add Inter font globally or let tailwind handle it */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
body {
  font-family: 'Inter', sans-serif;
}
</style>
