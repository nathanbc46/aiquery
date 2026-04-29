export default defineNuxtRouteMiddleware(async (to, from) => {
  const { data: auth } = await useFetch('/api/auth/me')
  
  if (!auth.value?.authenticated) {
    if (to.path !== '/login') {
      return navigateTo('/login')
    }
  } else {
    // Authenticated
    if (to.path === '/login') {
      return navigateTo('/history')
    }

    const user = (auth.value as any).user

    // Role-based protection
    if (to.path === '/approvals' && user.role !== 'manager' && user.role !== 'admin') {
      return navigateTo('/history')
    }

    if (to.path.startsWith('/admin') && user.role !== 'admin') {
      return navigateTo('/history')
    }
  }
})
