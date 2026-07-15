export default defineNuxtRouteMiddleware(async (to) => {
  // ระหว่าง client hydration ให้ข้าม — SSR จัดการ auth และ redirect ก่อนส่ง HTML ให้ browser แล้ว
  // การรัน middleware ซ้ำบน client ทำให้เกิด redirect ผิดพลาดและ hydration mismatch
  if (import.meta.client && useNuxtApp().isHydrating) {
    return
  }

  // useRequestFetch forwards cookies server-side and is never cached unlike useFetch
  const fetchWithSession = useRequestFetch()
  const auth = await fetchWithSession<any>('/api/auth/me').catch(() => ({ authenticated: false }))

  if (!auth?.authenticated) {
    if (to.path !== '/login') return navigateTo('/login')
    return
  }

  const user = auth.user
  const isAdmin = user.role === 'admin'
  const isManager = user.role === 'manager'
  const isPrivileged = isAdmin || isManager

  if (to.path === '/login') {
    return navigateTo(isPrivileged ? '/' : '/history')
  }

  // User ธรรมดาห้ามเข้าหน้า AI Query
  if (to.path === '/' && !isPrivileged) {
    return navigateTo('/history')
  }

  if (to.path === '/approvals' && !isPrivileged) {
    return navigateTo('/history')
  }

  if (to.path.startsWith('/admin') && !isAdmin) {
    return navigateTo('/history')
  }
})
