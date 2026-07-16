export default defineNuxtRouteMiddleware(async (to, from) => {
  const nuxtApp = useNuxtApp()

  const ssrAuthPassed = useState<boolean>('ssr-auth-passed', () => false)

  if (import.meta.client) {
    // ระหว่าง hydration ให้ข้ามเสมอ
    if (nuxtApp.isHydrating) return

    // from.matched.length === 0 = Vue Router START_LOCATION (initial post-SSR navigation)
    // ข้ามครั้งแรกหลัง SSR เสมอ และ clear ssrAuthPassed เพื่อให้ navigation จริงถัดไปตรวจ auth จริง
    if (from.matched.length === 0) {
      ssrAuthPassed.value = false
      return
    }

    // safety net: หาก Suspense trigger ซ้ำก่อนที่ user จะ navigate จริง
    if (ssrAuthPassed.value) {
      ssrAuthPassed.value = false
      return
    }
  }

  // useRequestFetch forwards cookies server-side and is never cached unlike useFetch
  const fetchWithSession = useRequestFetch()
  const auth = await fetchWithSession<any>('/api/auth/me').catch(() => ({ authenticated: false }))

  if (!auth?.authenticated) {
    if (to.path !== '/login') return navigateTo('/login')
    return
  }

  // อัปเดต auth-data ทั้งบน server และ client เพื่อให้ page components เข้าถึงข้อมูล user ได้เสมอ
  useState<any>('auth-data').value = auth
  if (import.meta.server) {
    ssrAuthPassed.value = true
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
