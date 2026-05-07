export default defineNuxtRouteMiddleware(async (to) => {
  // useRequestFetch forwards cookies server-side and is never cached unlike useFetch
  const fetchWithSession = useRequestFetch()
  const auth = await fetchWithSession<any>('/api/auth/me').catch(() => ({ authenticated: false }))

  if (!auth?.authenticated) {
    if (to.path !== '/login') {
      return navigateTo('/login')
    }
  } else {
    if (to.path === '/login') {
      return navigateTo('/history')
    }

    const user = auth.user

    if (to.path === '/approvals' && user.role !== 'manager' && user.role !== 'admin') {
      return navigateTo('/history')
    }

    if (to.path.startsWith('/admin') && user.role !== 'admin') {
      return navigateTo('/history')
    }
  }
})
