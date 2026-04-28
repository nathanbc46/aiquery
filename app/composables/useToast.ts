import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  title: string
  message?: string
  type: ToastType
  duration?: number
}

const toasts = ref<Toast[]>([])

export const useToast = () => {
  const add = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    toasts.value.push({ ...toast, id })
    
    if (toast.duration !== 0) {
      setTimeout(() => {
        remove(id)
      }, toast.duration || 3000)
    }
  }

  const remove = (id: string) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  const success = (title: string, message?: string) => add({ title, message, type: 'success' })
  const error = (title: string, message?: string) => add({ title, message, type: 'error', duration: 5000 })
  const warning = (title: string, message?: string) => add({ title, message, type: 'warning' })
  const info = (title: string, message?: string) => add({ title, message, type: 'info' })

  return {
    toasts,
    add,
    remove,
    success,
    error,
    warning,
    info
  }
}
