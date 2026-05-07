<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { 
  Sparkles, 
  Search, 
  X, 
  Database, 
  Info, 
  AlertCircle, 
  ArrowRight, 
  History,
  Terminal,
  ShieldCheck,
  RotateCcw,
  BrainCircuit,
  Cpu,
  Wand2,
  Edit3,
  AlertTriangle,
  Copy,
  HelpCircle,
  Mail,
  Star,
  Bookmark,
  Trash2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  LayoutGrid,
  Maximize2,
  Minimize2
} from 'lucide-vue-next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'


const prompt = ref('')
const isGenerating = ref(false)
const generatedResult = ref<any>(null)
const isRequesting = ref(false)
const isRequestModalOpen = ref(false)
const requestReason = ref('')
const isCopied = ref(false)
const isRefining = ref(false)
const originalPrompt = ref('')
const isSqlModalOpen = ref(false)
const isGuideModalOpen = ref(false)
const isDataGuideModalOpen = ref(false)
const dataGuideContent = ref('')
const isLoadingDataGuide = ref(false)
const isReportingError = ref(false)
const isZohoModalOpen = ref(false)
const zohoOptions = ref({
  linkName: '',
  password: '',
  setPassword: false,
  setExpiration: false,
  expirationDate: '',
  showDownloadPrint: true,
  requestUserData: false,
  requestUserFields: ['email'] as string[],
  accessLevel: 'edit'
})
const showZohoPassword = ref(false)
const isExportingZoho = ref(false)
const generatedZohoLink = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const { data: auth } = await useFetch<any>('/api/auth/me')
const user = computed(() => auth.value?.user)
const isAdmin = computed(() => user.value?.role === 'admin')



const toast = useToast()

// Favorite State
const favorites = ref<any[]>([])
const isFetchingFavorites = ref(false)
const isSavingFavorite = ref(false)
const isFavoriteModalOpen = ref(false)
const favoriteTitle = ref('')

// CSV download confirmation modal
const isCsvConfirmModalOpen = ref(false)
const csvFilename = ref('')

const openCsvModal = () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  csvFilename.value = `AI_Export_${today}`
  fetchVtigerUsers().then(() => {
    if (!csvOwnerVtigerId.value && user.value?.vtigerId) {
      csvOwnerVtigerId.value = user.value.vtigerId
      csvOwnerSearch.value = getOwnerLabel(user.value.vtigerId)
    }
  })
  isCsvConfirmModalOpen.value = true
}

const openZohoModal = () => {
  fetchVtigerUsers().then(() => {
    if (!zohoOwnerVtigerId.value && user.value?.vtigerId) {
      zohoOwnerVtigerId.value = user.value.vtigerId
      zohoOwnerSearch.value = getOwnerLabel(user.value.vtigerId)
    }
  })
  isZohoModalOpen.value = true
}

// User Owner state (for CSV & Zoho modals)
interface VtigerUser { id: number; firstName: string | null; lastName: string | null; userName: string; email1: string | null }
const vtigerUsersList = ref<VtigerUser[]>([])
const vtigerUsersLoaded = ref(false)
const csvOwnerVtigerId = ref<number | null>(null)
const csvOwnerSearch = ref('')
const showCsvOwnerDropdown = ref(false)
const zohoOwnerVtigerId = ref<number | null>(null)
const zohoOwnerSearch = ref('')
const showZohoOwnerDropdown = ref(false)

const getOwnerLabel = (vtigerId: number | null): string => {
  if (!vtigerId) return ''
  const u = vtigerUsersList.value.find(u => u.id === vtigerId)
  if (!u) return String(vtigerId)
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.userName
}

const filterUsers = (search: string): VtigerUser[] => {
  const q = search.toLowerCase()
  return vtigerUsersList.value.filter(u =>
    [u.firstName, u.lastName, u.userName, u.email1].some(v => v?.toLowerCase().includes(q))
  )
}

const filteredCsvUsers = computed(() => filterUsers(csvOwnerSearch.value))
const filteredZohoUsers = computed(() => filterUsers(zohoOwnerSearch.value))

const fetchVtigerUsers = async () => {
  if (vtigerUsersLoaded.value) return
  try {
    const data = await $fetch<{ users: VtigerUser[] }>('/api/ai-query/vtiger-users')
    vtigerUsersList.value = data.users
    vtigerUsersLoaded.value = true
  } catch { /* fallback: empty list */ }
}

const selectCsvOwner = (u: VtigerUser) => {
  csvOwnerVtigerId.value = u.id
  csvOwnerSearch.value = getOwnerLabel(u.id)
  showCsvOwnerDropdown.value = false
}

const selectZohoOwner = (u: VtigerUser) => {
  zohoOwnerVtigerId.value = u.id
  zohoOwnerSearch.value = getOwnerLabel(u.id)
  showZohoOwnerDropdown.value = false
}

const hideCsvOwnerDropdown = () => { setTimeout(() => { showCsvOwnerDropdown.value = false }, 150) }
const hideZohoOwnerDropdown = () => { setTimeout(() => { showZohoOwnerDropdown.value = false }, 150) }

// Delete confirmation state
const isDeleteConfirmModalOpen = ref(false)
const favoriteToDelete = ref<any>(null)

const fetchFavorites = async () => {
  isFetchingFavorites.value = true
  try {
    const data = await $fetch<any[]>('/api/favorites')
    favorites.value = data
  } catch (e) {
    console.error('Failed to fetch favorites:', e)
  } finally {
    isFetchingFavorites.value = false
  }
}

const saveFavorite = async () => {
  if (!favoriteTitle.value || isSavingFavorite.value || !generatedResult.value) return
  
  isSavingFavorite.value = true
  try {
    const response = await $fetch<any>('/api/favorites', {
      method: 'POST',
      body: {
        title: favoriteTitle.value,
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanationTh: generatedResult.value.explanation
      }
    })
    
    if (response.success) {
      toast.success('บันทึกสำเร็จ', 'เพิ่มรายการโปรดเรียบร้อยแล้ว')
      isFavoriteModalOpen.value = false
      favoriteTitle.value = ''
      fetchFavorites()
    }
  } catch (e: any) {
    toast.error('ล้มเหลว', 'ไม่สามารถบันทึกรายการโปรดได้')
  } finally {
    isSavingFavorite.value = false
  }
}

const deleteFavorite = (fav: any) => {
  favoriteToDelete.value = fav
  isDeleteConfirmModalOpen.value = true
}

const confirmDeleteFavorite = async () => {
  if (!favoriteToDelete.value) return
  
  try {
    const response = await $fetch<any>(`/api/favorites/${favoriteToDelete.value.id}`, {
      method: 'DELETE'
    })
    if (response.success) {
      toast.info('ลบแล้ว', 'ลบรายการโปรดเรียบร้อย')
      fetchFavorites()
    }
  } catch (e) {
    toast.error('ล้มเหลว', 'ไม่สามารถลบรายการโปรดได้')
  } finally {
    isDeleteConfirmModalOpen.value = false
    favoriteToDelete.value = null
  }
}

const useFavorite = (fav: any) => {
  prompt.value = fav.queryText
  // Optionally auto-run, but better to let user review first
  toast.info('โหลดรายการโปรด', `ใช้คำค้นหา: ${fav.title}`)
  focusAndEnd()
}

onMounted(() => {
  fetchFavorites()
})

const { data: systemConfig } = useFetch<any>('/api/system-config')
const suggestions = computed(() => systemConfig.value?.suggestions || [])

const focusAndEnd = () => {
  setTimeout(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      textareaRef.value.setSelectionRange(prompt.value.length, prompt.value.length)
    }
  }, 50)
}

const useSuggestion = (text: string) => {
  prompt.value = text
  focusAndEnd()
}

const fetchDataGuide = async () => {
  if (dataGuideContent.value) {
    isDataGuideModalOpen.value = true
    return
  }
  
  isLoadingDataGuide.value = true
  isDataGuideModalOpen.value = true
  try {
    const response = await $fetch<any>('/api/data-guide')
    if (response.success) {
      dataGuideContent.value = response.data
    } else {
      toast.error('ล้มเหลว', 'ไม่สามารถโหลดข้อมูลคู่มือได้')
    }
  } catch (e) {
    toast.error('ล้มเหลว', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
  } finally {
    isLoadingDataGuide.value = false
  }
}

const renderedDataGuide = computed(() => {
  if (!dataGuideContent.value) return ''
  return DOMPurify.sanitize(marked.parse(dataGuideContent.value) as string)
})

const handleZohoExport = async () => {
  isExportingZoho.value = true
  try {
    // Set default owner if not yet selected
    if (!zohoOwnerVtigerId.value && user.value?.vtigerId) {
      zohoOwnerVtigerId.value = user.value.vtigerId
    }

    // 1. Create request + auto-approve (same as CSV flow)
    const requestResp = await $fetch<any>('/api/ai-query/request', {
      method: 'POST',
      body: {
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation,
        resultCount: generatedResult.value.previewCount,
        requestReason: 'Export to Zoho WorkDrive',
        ownerDisplayName: zohoOwnerVtigerId.value ? getOwnerLabel(zohoOwnerVtigerId.value) : null
      }
    })

    if (!requestResp.success) {
      toast.error('ล้มเหลว', 'ไม่สามารถบันทึกการขอข้อมูลได้')
      return
    }

    // 2. Upload to Zoho WorkDrive
    const response = await $fetch<any>('/api/ai-query/export-zoho', {
      method: 'POST',
      body: {
        sql: generatedResult.value.sql,
        options: { ...zohoOptions.value, ownerVtigerId: zohoOwnerVtigerId.value },
        requestId: requestResp.requestId
      }
    })

    if (response.success) {
      toast.success('สำเร็จ', 'อัพโหลดไฟล์ไปยัง Zoho WorkDrive เรียบร้อยแล้ว')
      isZohoModalOpen.value = false
      zohoOptions.value.linkName = ''
      prompt.value = ''
      requestReason.value = ''
      generatedResult.value = null
    } else if (response.needsAuth) {
      window.location.href = response.authUrl
    } else {
      toast.error('ล้มเหลว', response.message || 'ไม่สามารถอัพโหลดไปยัง Zoho ได้')
    }
  } catch (e: any) {
    toast.error('ล้มเหลว', e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
  } finally {
    isExportingZoho.value = false
  }
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('คัดลอกแล้ว', 'คัดลอกลิงก์ไปยัง Clipboard เรียบร้อยแล้ว')
}

const handleClarification = () => {
  generatedResult.value = null
  focusAndEnd()
}

const clearInput = () => {
  prompt.value = ''
  originalPrompt.value = ''
  generatedResult.value = null
  if (textareaRef.value) textareaRef.value.focus()
}

const revertToOriginal = () => {
  if (!originalPrompt.value) return
  const current = prompt.value
  prompt.value = originalPrompt.value
  originalPrompt.value = current // Allow toggling back and forth
  focusAndEnd()
  toast.info('คืนค่าข้อความ', 'กลับไปใช้ข้อความเดิมของคุณแล้ว')
}

const error = ref<string | null>(null)
const showPreview = ref(false)
const resultSection = ref<HTMLElement | null>(null)

const refineQuestion = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  setTimeout(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      const len = textareaRef.value.value.length
      textareaRef.value.setSelectionRange(len, len)
    }
  }, 500)
}

const copySql = async () => {
  if (!generatedResult.value?.sql) return
  try {
    await navigator.clipboard.writeText(formatSql(generatedResult.value.sql))
    isCopied.value = true
    setTimeout(() => { isCopied.value = false }, 2000)
    toast.success('คัดลอกแล้ว', 'คัดลอกคำสั่ง SQL ลง Clipboard เรียบร้อย')
  } catch (err) {
    toast.error('ล้มเหลว', 'ไม่สามารถคัดลอกคำสั่งได้')
  }
}

const refinePrompt = async () => {
  if (!prompt.value || isRefining.value) return
  
  isRefining.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/refine', {
      method: 'POST',
      body: { prompt: prompt.value }
    })
    
    if (response.success) {
      originalPrompt.value = prompt.value
      prompt.value = response.refinedText
      toast.info('ขัดเกลาคำถามสำเร็จ', 'AI ได้ปรับปรุงคำถามของคุณให้ชัดเจนขึ้นแล้ว')
      focusAndEnd()
    } else {
      toast.error('เกิดข้อผิดพลาด', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('ล้มเหลว', 'ไม่สามารถขัดเกลาคำถามได้ในขณะนี้')
  } finally {
    isRefining.value = false
  }
}

const generateSql = async () => {
  if (!prompt.value) return
  
  isGenerating.value = true
  generatedResult.value = null // Clear old result immediately
  error.value = null
  showPreview.value = false
  
  try {
    const response = await $fetch<any>('/api/ai-query/generate', {
      method: 'POST',
      body: { prompt: prompt.value }
    })
    
    if (response.success && (response.status === 'success' || response.status === 'error')) {
      generatedResult.value = response
      
      // ถ้าเป็น Admin หรือ Manager ให้เปิด Preview อัตโนมัติเลย
      if (isAdmin.value || user.value?.role === 'manager') {
        showPreview.value = true
      }
      
      // Auto-scroll to result
      setTimeout(() => {
        resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else if (response.status === 'clarification_needed') {
      generatedResult.value = response
      toast.info('AI มีข้อสงสัย', 'โปรดให้รายละเอียดเพิ่มเติมตามที่ AI แนะนำ')
    } else {
      error.value = response.error || 'ไม่สามารถสร้างคำสั่ง SQL ได้ โปรดลองระบุคำถามใหม่ให้ชัดเจนขึ้น'
    }
  } catch (e: any) {
    console.error(e)
    error.value = e.data?.statusMessage || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI หรือ Database ล้มเหลว'
  } finally {
    isGenerating.value = false
  }
}

const requestApproval = async (ownerDisplayName?: string) => {
  if (!generatedResult.value) return

  isRequesting.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/request', {
      method: 'POST',
      body: {
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation,
        resultCount: generatedResult.value.previewCount,
        requestReason: requestReason.value,
        ownerDisplayName: ownerDisplayName || null
      }
    })
    
    if (response.success) {
      if (response.autoApproved) {
        toast.success('อนุมัติอัตโนมัติสำเร็จ', 'เนื่องจากคุณมีสิทธิ์ Manager ระบบจึงอนุมัติและเตรียมข้อมูลให้ทันที!')
        
        // ถ้าเป็น Admin ให้เริ่มดาวน์โหลดไฟล์ทันที (ใช้ window.location เพื่อไม่ให้เปิด Tab ใหม่)
        if (isAdmin.value && response.requestId) {
          const fn = (csvFilename.value || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙\s_-]/g, '').trim().replace(/\s+/g, '_') || 'AI_Export'
          const ownerParam = csvOwnerVtigerId.value ? `&ownerVtigerId=${csvOwnerVtigerId.value}` : ''
          window.location.href = `/api/ai-query/export?id=${response.requestId}&filename=${encodeURIComponent(fn)}${ownerParam}`
        }
      } else {
        toast.success('ส่งคำขอสำเร็จ', 'ส่งคำขออนุมัติไปยังหัวหน้างานเรียบร้อยแล้ว!')
      }
      isRequestModalOpen.value = false
      prompt.value = ''
      requestReason.value = ''
      generatedResult.value = null
    } else {
      toast.error('ส่งคำขอไม่สำเร็จ', 'โปรดตรวจสอบการเชื่อมต่อ Database หรือติดต่อ Admin')
    }
  } catch (e: any) {
    console.error(e)
    toast.error('ส่งคำขอไม่สำเร็จ', 'โปรดตรวจสอบการเชื่อมต่อ Database หรือติดต่อ Admin')
  } finally {
    isRequesting.value = false
  }
}

const reportError = async () => {
  if (!generatedResult.value?.dbError) return
  
  isReportingError.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/report-error', {
      method: 'POST',
      body: {
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation,
        dbError: generatedResult.value.dbError,
        userDisplayName: user.value?.displayName || 'Unknown User'
      }
    })
    
    if (response.success) {
      toast.success('ส่งรายงานสำเร็จ', 'แจ้งเตือนผู้ดูแลระบบเรียบร้อยแล้ว ขอบคุณสำหรับข้อมูลครับ')
      generatedResult.value = null // Clear to allow retry
    } else {
      toast.error('ส่งรายงานล้มเหลว', response.error)
    }
  } catch (e: any) {
    console.error(e)
    toast.error('เกิดข้อผิดพลาด', 'ไม่สามารถส่งรายงานได้ในขณะนี้')
  } finally {
    isReportingError.value = false
  }
}

const isEditingSql = ref(false)
const editedSql = ref('')
const isUpdatingSql = ref(false)
const isSqlModalFullscreen = ref(false)
const sqlModalError = ref('')

watch(isSqlModalOpen, (open) => {
  if (!open) {
    isSqlModalFullscreen.value = false
    sqlModalError.value = ''
    isEditingSql.value = false
  }
})

const startEditingSql = () => {
  editedSql.value = formatSql(generatedResult.value?.sql || '')
  isEditingSql.value = true
  sqlModalError.value = ''
}

const cancelEditingSql = () => {
  isEditingSql.value = false
  sqlModalError.value = ''
}

const updateSql = async () => {
  if (!editedSql.value || isUpdatingSql.value) return

  isUpdatingSql.value = true
  sqlModalError.value = ''
  try {
    const response = await $fetch<any>('/api/ai-query/preview', {
      method: 'POST',
      body: { query: editedSql.value }
    })

    if (response.success) {
      generatedResult.value.sql = editedSql.value
      generatedResult.value.previewData = response.data
      generatedResult.value.previewCount = response.totalCount
      generatedResult.value.status = 'success'
      generatedResult.value.dbError = null
      showPreview.value = true

      toast.success('อัปเดตสำเร็จ', 'ระบบอัปเดตข้อมูลตามคำสั่ง SQL ใหม่ของคุณเรียบร้อยแล้ว')
      isEditingSql.value = false
      isSqlModalOpen.value = false
    } else {
      sqlModalError.value = response.error || 'SQL ไม่ถูกต้อง'
    }
  } catch (e: any) {
    sqlModalError.value = e?.data?.message || e?.message || 'ไม่สามารถรันคำสั่ง SQL นี้ได้'
  } finally {
    isUpdatingSql.value = false
  }
}


// โหลดค่ากำหนดพื้นฐานจากระบบ
// SQL Formatter & Highlighter Logic (From approvals.vue)
const formatSql = (sqlStr: string) => {
  if (!sqlStr) return ''
  
  // 1. แยก String Literals ออกมาเก็บไว้ก่อนเพื่อความปลอดภัย (ป้องกันข้อมูลพัง)
  const strings: string[] = []
  let placeholderSql = sqlStr.replace(/'((?:''|[^'])*)'/g, (match) => {
    strings.push(match)
    return `__SQL_STR_${strings.length - 1}__`
  })
  
  // 2. จัดรูปแบบส่วนที่เป็นคำสั่ง SQL (ยุบช่องว่างที่เกินมา และขึ้นบรรทัดใหม่ที่ Keyword หลัก)
  let formatted = placeholderSql
    .replace(/\s+/g, ' ') // ยุบช่องว่างและตัวขึ้นบรรทัดใหม่เดิมทิ้งทั้งหมดก่อน
    .replace(/\b(SELECT|FROM|WHERE|INNER JOIN|LEFT JOIN|RIGHT JOIN|ORDER BY|GROUP BY|LIMIT|HAVING|VALUES|UPDATE|SET|INSERT INTO|DELETE FROM)\b/gi, '\n$1')
    .replace(/\b(AND|OR|ON)\b/gi, '\n  $1') // ตอนนี้ทำได้ปลอดภัยแล้วเพราะแยก String ออกไปแล้ว
    .trim()
    
  // 3. นำ String Literals กลับมาใส่ที่เดิม
  strings.forEach((originalStr, i) => {
    formatted = formatted.replace(`__SQL_STR_${i}__`, originalStr)
  })
  
  return formatted
}

const highlightSql = (sqlStr: string) => {
  if (!sqlStr) return ''
  
  // 1. Format SQL for readability
  let result = formatSql(sqlStr)
  
  // 2. Highlight Strings
  result = result.replace(/'(.*?)'/g, '<span class="text-emerald-600 dark:text-emerald-400">\'$1\'</span>')
  
  // 3. Highlight Keywords
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'LIMIT', 'AND', 'OR', 'IN', 'IS NULL', 'IS NOT NULL',
    'INSERT INTO', 'UPDATE', 'DELETE', 'VALUES', 'SET', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'AS', 'DISTINCT', 'HAVING', 'BETWEEN', 'LIKE', 'DESC', 'ASC'
  ]
  
  keywords.forEach(word => {
    const reg = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(reg, `<span class="text-blue-600 dark:text-blue-400 font-black">${word}</span>`)
  })
  
  // 4. Highlight Numbers
  result = result.replace(/(?<![\w\-\.])\b(\d+)\b/g, '<span class="text-amber-600 dark:text-amber-500">$1</span>')
  
  return result
}

</script>

<template>
  <div class="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8 relative z-10">
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100/50 dark:border-blue-800/50 shadow-sm backdrop-blur-md">
            <Sparkles class="w-3.5 h-3.5 animate-pulse" />
            AI SQL ENGINE PRO
          </div>
          <button 
            @click="isGuideModalOpen = true"
            class="group flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-50/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] border border-amber-100/50 dark:border-amber-800/50 shadow-sm backdrop-blur-md hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all active:scale-95"
          >
            <HelpCircle class="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
            คู่มือการใช้งาน
          </button>
          <button 
            @click="fetchDataGuide"
            class="group flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100/50 dark:border-indigo-800/50 shadow-sm backdrop-blur-md hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all active:scale-95"
          >
            <Database class="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            สามารถขอข้อมูลอะไรได้บ้าง?
          </button>
        </div>

        <h2 class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-[1.2] tracking-tight">
          ดึงข้อมูลด้วย<span class="text-gradient">ภาษาธรรมชาติ</span>
        </h2>
        <p class="text-slate-500 dark:text-slate-400 text-lg max-w-2xl leading-relaxed font-medium">
          เปลี่ยนคำถามภาษาไทยของคุณให้เป็นชุดคำสั่งดึงข้อมูลที่ปลอดภัยจากระบบ Vtiger CRM
        </p>
      </div>
    </header>

    <!-- Input Box (Action Zone) -->
    <section class="rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:shadow-indigo-500/10 relative z-10 border border-indigo-100 dark:border-indigo-900/30 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl">
      <form @submit.prevent="generateSql" class="p-8 md:p-10 space-y-6">
        <div class="space-y-6">
          <div class="flex items-center justify-between px-1">
            <label class="flex items-center gap-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
              <div class="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Search class="w-4.5 h-4.5 text-blue-500" />
              </div>
              <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                คุณต้องการค้นหาข้อมูลอะไร?
                <div class="flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300 font-black rounded-xl border-2 border-blue-100 dark:border-blue-800/50 shadow-sm animate-in fade-in zoom-in duration-700">
                  <ShieldCheck class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span class="tracking-tight uppercase opacity-60 mr-1 font-black">Security Policy:</span>
                  <span>จำกัดการดึงข้อมูลสูงสุด {{ (systemConfig?.maxResultsLimit || 0).toLocaleString() }} รายการ (ระบุจำนวนที่ต้องการในคำถามได้)</span>
                </div>
              </div>
            </label>
            <div v-if="isGenerating" class="flex items-center gap-2.5 text-xs font-black text-blue-600 dark:text-blue-400">
              <div class="relative">
                <BrainCircuit class="w-5 h-5 animate-pulse" />
                <div class="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
              </div>
              <span class="uppercase tracking-widest">AI กำลังประมวลผล...</span>
            </div>
          </div>
          
          <div class="relative group">
            <textarea 
              ref="textareaRef"
              v-model="prompt" 
              :readonly="isGenerating"
              @keydown.enter.exact.prevent="generateSql"
              placeholder="เช่น ขอลูกค้าที่มียอดสั่งซื้อเกิน 1 แสนบาทในปีนี้ พร้อมเบอร์ติดต่อ... (Enter เพื่อประมวลผล)" 
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] px-6 py-5 pr-14 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all resize-none h-40 text-lg leading-relaxed shadow-inner disabled:opacity-50"
              :disabled="isGenerating"
            ></textarea>
            <div class="absolute right-5 bottom-5 flex items-center gap-2">
              <ClientOnly>
                <button 
                  v-if="prompt"
                  type="button"
                  @click="refinePrompt"
                  :disabled="isRefining || isGenerating"
                  class="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-xl border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                  title="ขัดเกลาคำถามด้วย AI ให้ชัดเจนขึ้น"
                >
                  <Sparkles v-if="!isRefining" class="w-3.5 h-3.5" />
                  <RotateCcw v-else class="w-3.5 h-3.5 animate-spin" />
                  {{ isRefining ? 'กำลังขัดเกลา...' : 'ช่วยเขียนให้ดีขึ้น' }}
                </button>

                <button 
                  v-if="originalPrompt && prompt !== originalPrompt"
                  type="button"
                  @click="revertToOriginal"
                  :disabled="isGenerating"
                  class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50"
                  title="กลับไปใช้ข้อความก่อนขัดเกลา"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                  ใช้ข้อความเดิม
                </button>
                
                <button 
                  v-if="prompt"
                  type="button"
                  @click="clearInput"
                  :disabled="isGenerating"
                  class="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="ล้างข้อความ"
                >
                  <X class="w-5 h-5" />
                </button>
              </ClientOnly>
            </div>
          </div>
        </div>

        <!-- Clarification Box -->
        <transition name="fade">
          <div v-if="generatedResult?.status === 'clarification_needed'" class="mt-2">
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-6 flex gap-5 shadow-sm">
              <div class="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-2xl h-fit">
                <AlertCircle class="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <div class="space-y-3">
                <h3 class="font-bold text-amber-900 dark:text-amber-200 text-lg">AI ต้องการข้อมูลเพิ่มเติม</h3>
                <p class="text-amber-800 dark:text-amber-400 leading-relaxed">{{ generatedResult.explanation }}</p>
                <button type="button" @click="handleClarification" class="mt-2 text-sm font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1.5 underline underline-offset-8 decoration-amber-500/30 hover:decoration-amber-500 transition-all">
                  ตกลง ฉันจะระบุข้อมูลใหม่
                  <ArrowRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </transition>
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-10 pt-2">
          <div class="flex flex-wrap gap-2">
            <button 
              v-for="text in suggestions" 
              :key="text"
              type="button"
              @click="useSuggestion(text)"
              :disabled="isGenerating"
              class="text-[12px] font-bold px-5 py-3 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all active:scale-95 border border-slate-200/50 dark:border-slate-700/50 shadow-sm backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {{ text }}
            </button>

            <!-- Favorites List -->
            <div v-if="favorites.length > 0" class="flex flex-wrap gap-2 items-center">
              <div class="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-2 hidden sm:block"></div>
              <div class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-100 dark:border-amber-800/50">
                <Star class="w-3 h-3 fill-amber-500" />
                Favorites
              </div>
              <div v-for="fav in favorites.slice(0, 5)" :key="fav.id" class="group relative">
                <button 
                  type="button"
                  @click="useFavorite(fav)"
                  :disabled="isGenerating"
                  class="text-[12px] font-bold px-4 py-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white transition-all active:scale-95 border border-amber-200/50 dark:border-amber-800/50 shadow-sm backdrop-blur-sm disabled:opacity-30"
                  :title="fav.queryText"
                >
                  {{ fav.title }}
                </button>
                <button 
                  type="button"
                  @click.stop="deleteFavorite(fav)"
                  class="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white dark:bg-slate-800 text-rose-500 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          
          <button 
            type="submit" 
            :disabled="isGenerating || !prompt"
            class="relative group px-12 py-5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-blue-600 dark:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-[2rem] shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 overflow-hidden uppercase tracking-widest text-sm"
          >
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
            <RotateCcw v-if="isGenerating" class="w-6 h-6 animate-spin text-white" />
            <div v-else class="flex items-center gap-2">
              <Database class="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div class="w-px h-4 bg-white/20"></div>
              <Sparkles class="w-5 h-5 text-blue-200" />
            </div>
            <span class="text-base">{{ isGenerating ? 'กำลังคิด...' : 'ประมวลผลด้วย AI' }}</span>
          </button>
        </div>

        <!-- Inline Error Alert -->
        <transition name="fade">
          <div v-if="error" class="mt-6 p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-3xl flex items-start gap-4 animate-in slide-in-from-top-2 duration-300">
            <div class="p-2 bg-white dark:bg-rose-900/30 rounded-xl shadow-sm border border-rose-100 dark:border-rose-800 shrink-0">
              <AlertCircle class="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <p class="text-rose-900 dark:text-rose-300 font-bold uppercase tracking-wider text-xs mb-1">AI Generation Failed</p>
              <p class="text-rose-700 dark:text-rose-400 text-sm font-medium">{{ error }}</p>
            </div>
          </div>
        </transition>

      </form>
    </section>

    <!-- AI Output Area (Loading or Result) -->
    <div class="grid grid-cols-1 grid-rows-1 mt-12">
      <transition name="fade">
        <!-- Skeleton Loading State (Detailed & Colorful) -->
        <div v-if="isGenerating" key="skeleton" class="col-start-1 row-start-1 space-y-6 animate-pulse">
          <div class="rounded-[2.5rem] overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-xl bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
            <!-- Header Skeleton -->
            <div class="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
              <div class="flex-1 p-8 space-y-5">
                <div class="flex items-center gap-2">
                  <div class="w-4 h-4 bg-blue-200 dark:bg-blue-900/40 rounded-md"></div>
                  <div class="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                </div>
                <div class="space-y-3">
                  <div class="h-5 w-full bg-slate-100 dark:bg-slate-900 rounded-xl"></div>
                  <div class="h-5 w-4/5 bg-slate-100 dark:bg-slate-900 rounded-xl"></div>
                  <div class="h-5 w-2/3 bg-slate-100 dark:bg-slate-900 rounded-xl opacity-50"></div>
                </div>
              </div>
              <div class="md:w-56 p-8 flex flex-col justify-center items-center gap-3 bg-slate-50/30 dark:bg-slate-900/10">
                <div class="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                <div class="h-16 w-32 bg-indigo-100 dark:bg-indigo-900/40 rounded-3xl border border-indigo-200/50 dark:border-indigo-800/50"></div>
                <div class="h-3 w-24 bg-blue-100 dark:bg-blue-900/40 rounded-lg"></div>
              </div>
            </div>
            
            <!-- Footer Skeleton -->
            <div class="p-8 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"></div>
                <div class="space-y-2">
                  <div class="h-3 w-32 bg-slate-300 dark:bg-slate-700 rounded-lg"></div>
                  <div class="h-2.5 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                </div>
              </div>
              <div class="flex gap-4 w-full md:w-auto">
                <div class="h-14 flex-1 md:w-28 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                <div class="h-14 flex-1 md:w-48 bg-blue-500/20 dark:bg-blue-600/20 rounded-3xl border border-blue-500/20 dark:border-blue-500/10"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Output & Preview (Result Zone) -->
        <div v-else-if="generatedResult && (generatedResult.status === 'success' || generatedResult.status === 'error')" key="result" ref="resultSection" class="col-start-1 row-start-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <!-- Background Glow Effect (Subtle) -->
          <div class="absolute -inset-4 bg-gradient-to-tr from-blue-500/10 via-indigo-500/5 to-purple-500/10 blur-2xl -z-10 opacity-60"></div>
          
          <div class="rounded-[2.5rem] overflow-hidden border-2 border-white dark:border-slate-800 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] relative z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl ring-1 ring-blue-500/20">
            <!-- Top Accent Gradient Line -->
            <div class="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>
          <div class="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
            <div class="flex-1 p-8 bg-slate-50/30 dark:bg-slate-900/20 relative group/summary">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  <Wand2 class="w-4 h-4" />
                  AI Analysis Summary
                </div>
                <button 
                  @click="isSqlModalOpen = true"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider"
                  title="ดูคำสั่ง SQL ที่ใช้ดึงข้อมูล"
                >
                  <Terminal class="w-3.5 h-3.5" />
                  View SQL
                </button>
              </div>
              <p class="text-slate-700 dark:text-slate-200 leading-relaxed text-lg font-medium">{{ generatedResult.explanation }}</p>
            </div>
            
            <div class="md:w-56 p-8 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-center items-center text-center">
              <span class="font-bold text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Total Records</span>
              <div class="text-5xl font-black tracking-tighter" :class="generatedResult.previewCount > 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'">
                {{ (generatedResult.previewCount ?? 0).toLocaleString() }}
              </div>
              <p class="text-[10px] font-black mt-1 text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">รายการที่พบ</p>
            </div>
          </div>

          <!-- SQL Error Block -->
          <div v-if="generatedResult.status === 'error'" class="p-8 bg-rose-50/50 dark:bg-rose-900/10 border-b border-slate-200 dark:border-slate-800">
            <div class="flex flex-col gap-6">
              <div class="flex items-start gap-4 text-rose-600 dark:text-rose-400">
                <div class="p-3 bg-white dark:bg-rose-900/30 rounded-2xl shadow-sm border border-rose-100 dark:border-rose-800 shrink-0">
                  <AlertTriangle class="w-6 h-6" />
                </div>
                <div class="space-y-1">
                  <h5 class="text-sm font-black uppercase tracking-wider">เกิดข้อผิดพลาดในการประมวลผล SQL</h5>
                  <p class="text-xs font-medium leading-relaxed opacity-80">AI อาจสร้างคำสั่ง SQL ที่ไม่ถูกต้องตามโครงสร้างฐานข้อมูลปัจจุบัน:</p>
                  <div class="mt-2 space-y-3">
                    <div class="p-4 bg-slate-900 rounded-xl font-mono text-[10px] text-rose-300 overflow-x-auto border border-rose-900/30">
                      <div class="mb-2 text-[8px] font-black uppercase text-rose-500/50 tracking-widest">Database Error:</div>
                      {{ generatedResult.dbError }}
                    </div>
                    <div class="p-4 bg-slate-900 rounded-xl font-mono text-[10px] text-rose-400 overflow-x-auto border border-rose-900/30 group/errsql relative">
                      <div class="mb-2 text-[8px] font-black uppercase text-rose-500/50 tracking-widest flex justify-between items-center">
                        <span>Attempted SQL Query:</span>
                        <button @click="copySql" class="hover:text-rose-300 transition-colors">
                          <Copy class="w-3 h-3" />
                        </button>
                      </div>
                      <pre class="whitespace-pre-wrap leading-relaxed">{{ generatedResult.sql }}</pre>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="flex flex-col sm:flex-row items-center gap-4">
                <button 
                  @click="refineQuestion"
                  class="w-full sm:w-auto px-8 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest border border-slate-200 dark:border-slate-700"
                >
                  <Edit3 class="w-4 h-4" />
                  ปรับปรุงคำถาม
                </button>
                <button 
                  @click="reportError"
                  :disabled="isReportingError"
                  class="w-full sm:w-auto px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-2xl shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest"
                >
                  <Mail v-if="!isReportingError" class="w-4 h-4" />
                  <RotateCcw v-else class="w-4 h-4 animate-spin" />
                  {{ isReportingError ? 'กำลังส่งรายงาน...' : 'รายงานปัญหานี้ให้ Admin' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Zero Records Warning & Refine Button -->
          <div v-if="generatedResult.status === 'success' && generatedResult.previewCount === 0" class="p-8 bg-rose-50/50 dark:bg-rose-900/10 border-b border-slate-200 dark:border-slate-800">

            <div class="flex flex-col md:flex-row items-center justify-between gap-6">
              <div class="flex items-center gap-4 text-rose-600 dark:text-rose-400">
                <AlertTriangle class="w-6 h-6 shrink-0" />
                <p class="text-sm font-bold">ไม่พบข้อมูลที่ตรงตามเงื่อนไขที่คุณระบุ โปรดลองปรับปรุงคำถามใหม่อีกครั้ง</p>
              </div>
              <button 
                @click="refineQuestion"
                class="w-full md:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest"
              >
                <Edit3 class="w-4 h-4" />
                ปรับปรุงคำถาม
              </button>
            </div>
          </div>

          <!-- Data Over Limit Warning (Case: Overridden by System) -->
          <div v-if="generatedResult.limitOverridden" class="mx-8 mt-8 p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
            <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle class="w-6 h-6 text-amber-600" />
            </div>
            <div class="flex-1">
              <h5 class="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-0.5">จำกัดจำนวนการดึงข้อมูล</h5>
              <p class="text-xs font-medium text-amber-800 dark:text-amber-400 leading-relaxed">
                เนื่องจากจำนวนที่คุณขอมาเกินกว่าที่ระบบอนุญาต ระบบจึงปรับลดให้เหลือเพียง <b class="text-amber-900 dark:text-amber-100">{{ generatedResult.maxResultsLimit.toLocaleString() }}</b> รายการ ตามนโยบายความปลอดภัยและเพื่อประสิทธิภาพของฐานข้อมูลครับ
              </p>
            </div>
          </div>

          <!-- Data Over Limit Warning (Case: Natural Result > Limit) -->
          <div v-else-if="generatedResult.previewCount > generatedResult.maxResultsLimit" class="mx-8 mt-8 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
            <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle class="w-6 h-6 text-amber-600" />
            </div>
            <div class="flex-1">
              <h5 class="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-0.5">จำนวนข้อมูลเกินขีดจำกัดที่กำหนด</h5>
              <p class="text-xs font-medium text-amber-800 dark:text-amber-400 leading-relaxed">
                พบข้อมูลทั้งหมด <b class="text-amber-900 dark:text-amber-100">{{ generatedResult.previewCount.toLocaleString() }}</b> รายการ 
                แต่ระบบจะอนุมัติให้ดึงได้เพียง <b class="text-amber-900 dark:text-amber-100">{{ generatedResult.maxResultsLimit.toLocaleString() }}</b> รายการแรกเท่านั้น 
                ตามนโยบายความปลอดภัยของบริษัท
              </p>
            </div>
          </div>

          <!-- Section 2: Data Preview Table -->
          <div v-if="generatedResult.previewData" class="p-8 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-700">
                  <Database class="w-4 h-4" />
                </div>
                <div>
                  <div class="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">Data Insights</div>
                  <h4 class="text-sm font-bold text-slate-900 dark:text-white">ตัวอย่างข้อมูล {{ generatedResult.previewData.length }} รายการแรก</h4>
                </div>
              </div>
              <button 
                @click="showPreview = !showPreview"
                class="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300"
              >
                <component :is="showPreview ? X : Wand2" class="w-4 h-4" />
                {{ showPreview ? 'ซ่อนตัวอย่าง' : 'แสดงตัวอย่างข้อมูล' }}
              </button>
            </div>

            <transition name="fade">
              <div v-if="showPreview" class="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm max-h-[400px] overflow-y-auto custom-scrollbar">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
                      <th v-for="(val, key) in generatedResult.previewData[0]" :key="key" class="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                        {{ key }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr v-for="(row, idx) in generatedResult.previewData" :key="idx" class="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                      <td v-for="(val, key) in row" :key="key" class="px-5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {{ val }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </transition>
          </div>


          <!-- Section 4: Action Footer -->
          <div class="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-center gap-8">
            <div class="flex items-center gap-4 w-full lg:w-auto">
              <div class="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                <ShieldCheck class="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Ready for Approval</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">ชุดคำสั่งนี้ปลอดภัยและพร้อมสำหรับการส่งคำขออนุมัติ</p>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
              <!-- Secondary Actions Group -->
              <div class="flex flex-nowrap items-center justify-center gap-3 w-full sm:w-auto">
                <button @click="generatedResult = null" class="px-4 py-3 text-xs font-black text-slate-400 hover:text-rose-600 transition-all uppercase tracking-widest">
                  ยกเลิก
                </button>
                <button 
                  @click="refineQuestion"
                  class="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest border border-slate-200 dark:border-slate-700"
                >
                  <Edit3 class="w-3.5 h-3.5" />
                  ปรับปรุงคำถาม
                </button>
                <button 
                  @click="isFavoriteModalOpen = true"
                  class="px-5 py-3.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all border border-amber-200 dark:border-amber-800/50 text-xs font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest whitespace-nowrap"
                >
                  <Star class="w-3.5 h-3.5" />
                  บันทึกรายการโปรด
                </button>
              </div>

              <!-- Vertical Divider (Hidden on mobile) -->
              <div class="hidden sm:block w-px h-10 bg-slate-200 dark:bg-slate-800 mx-2"></div>

              <!-- Primary Action Group -->
              <div class="w-full sm:w-auto relative group/export">
                <div v-if="isAdmin" class="flex items-stretch shadow-2xl shadow-emerald-500/30 rounded-[2rem] overflow-hidden">
                  <button
                    @click="openCsvModal"
                    :disabled="isRequesting || generatedResult.previewCount === 0"
                    class="flex-1 px-8 py-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:grayscale text-white text-sm font-black transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest border-r border-emerald-500/50"
                  >
                    <Download class="w-5 h-5" />
                    <span>CSV</span>
                  </button>
                  <button
                    @click="openZohoModal"
                    :disabled="isRequesting || generatedResult.previewCount === 0"
                    class="px-6 py-5 bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center active:scale-95 border-l border-emerald-700/30 group/zoho"
                    title="Export to Zoho Sheet"
                  >
                    <div class="flex flex-col items-center gap-0.5">
                      <LayoutGrid class="w-5 h-5" />
                      <span class="text-[8px] font-black uppercase">Zoho</span>
                    </div>
                  </button>
                </div>
                
                <button 
                  v-else
                  @click="isRequestModalOpen = true"
                  :disabled="isRequesting || generatedResult.previewCount === 0"
                  class="w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale text-white text-sm font-black rounded-3xl shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest"
                >
                  <span>ขออนุมัติดึงข้อมูล</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </transition>
  </div>

    <!-- Request Approval Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isRequestModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <div class="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-50/30 dark:bg-blue-900/10">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <ShieldCheck class="w-7 h-7" />
                  </div>
                  <div>
                    <h3 class="text-xl font-black text-slate-900 dark:text-white">ส่งคำขออนุมัติ</h3>
                    <p class="text-xs font-bold text-blue-600/60 dark:text-blue-400/60 uppercase tracking-[0.2em] mt-0.5">Final Confirmation</p>
                  </div>
                </div>
                <button @click="isRequestModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X class="w-6 h-6" />
                </button>
              </div>
              
              <div class="p-10 space-y-8">
                <div class="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                  <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">สรุปคำขอของคุณ</h4>
                  <p class="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">"{{ prompt }}"</p>
                  <div class="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600">
                    <Database class="w-4 h-4" />
                    พบข้อมูลประมาณ {{ generatedResult?.previewCount }} รายการ
                  </div>
                </div>

                <div class="space-y-4">
                  <label class="block text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                    เหตุผลในการขอข้อมูล <span class="text-rose-500">*</span>
                  </label>
                  <textarea 
                    v-model="requestReason" 
                    placeholder="อธิบายเหตุผลให้หัวหน้างานทราบ (เช่น ใช้สำหรับรายงานสรุปยอดขายประจำไตรมาส 1)..." 
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl px-6 py-5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all resize-none h-40 text-lg leading-relaxed shadow-inner"
                    autofocus
                  ></textarea>
                  <p class="text-[11px] text-slate-400 font-medium px-1 flex items-center gap-1.5">
                    <Info class="w-3.5 h-3.5" />
                    คำขอที่ระบุเหตุผลชัดเจนจะได้รับการพิจารณาเร็วกว่าปกติ
                  </p>
                </div>
                
                <div class="pt-4 flex flex-col sm:flex-row justify-end gap-4">
                  <button 
                    @click="isRequestModalOpen = false"
                    class="px-8 py-5 text-sm font-black text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-widest"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    @click="requestApproval"
                    :disabled="isRequesting || !requestReason"
                    class="px-12 py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-base font-black rounded-3xl shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest"
                  >
                    <RotateCcw v-if="isRequesting" class="w-5 h-5 animate-spin" />
                    <span>ยืนยันการส่งคำขอ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- Guide Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isGuideModalOpen" class="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 bg-slate-900/90 backdrop-blur-md" @click="isGuideModalOpen = false">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]" @click.stop>
              <!-- Modal Header -->
              <div class="px-8 md:px-12 py-8 md:py-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-amber-50/40 dark:bg-amber-900/10 shrink-0">
                <div class="flex items-center gap-5">
                  <div class="w-14 h-14 rounded-[1.25rem] bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
                    <HelpCircle class="w-8 h-8" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">คู่มือการใช้งานระบบ AI Query</h3>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      <p class="text-[11px] font-black text-amber-600/80 dark:text-amber-400/80 uppercase tracking-[0.3em]">Vtiger CRM Intelligence Engine v2.0</p>
                    </div>
                  </div>
                </div>
                <button @click="isGuideModalOpen = false" class="text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                  <X class="w-7 h-7" />
                </button>
              </div>
              
              <!-- Modal Body (Scrollable) -->
              <div class="p-8 md:p-12 overflow-y-auto custom-scrollbar space-y-16">
                
                <!-- Section 1: Topics & Examples -->
                <section class="space-y-10">
                  <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-1 text-amber-500 bg-amber-500 rounded-full"></div>
                      <h4 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">1. หัวข้อที่ผู้ใช้งานสามารถถามได้</h4>
                    </div>
                    <p class="text-slate-500 dark:text-slate-400 text-sm font-medium ml-13">ระบบรองรับการดึงข้อมูลจากโมดูลหลักและตารางปรับแต่งพิเศษ โดยครอบคลุมหัวข้อดังนี้:</p>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Accounts & Contacts -->
                    <div class="group p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 transition-all">
                      <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 mb-5 group-hover:scale-110 transition-transform">
                        <Database class="w-6 h-6" />
                      </div>
                      <h5 class="font-black text-slate-900 dark:text-white mb-3">ลูกค้าและผู้ติดต่อ</h5>
                      <ul class="space-y-2.5">
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-blue-500 font-bold">"</span>รายชื่อลูกค้าในกลุ่มอุตสาหกรรม Healthcare<span class="text-blue-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-blue-500 font-bold">"</span>ขอเบอร์ติดต่อคุณสมชาย บริษัท ABC<span class="text-blue-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-blue-500 font-bold">"</span>นับจำนวนลูกค้าแยกตามจังหวัด<span class="text-blue-500 font-bold">"</span>
                        </li>
                      </ul>
                    </div>

                    <!-- Opportunities -->
                    <div class="group p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-900 transition-all">
                      <div class="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-5 group-hover:scale-110 transition-transform">
                        <Sparkles class="w-6 h-6" />
                      </div>
                      <h5 class="font-black text-slate-900 dark:text-white mb-3">โอกาสทางการขาย</h5>
                      <ul class="space-y-2.5">
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-amber-500 font-bold">"</span>สรุปดีลที่ปิดการขายได้ในเดือนนี้<span class="text-amber-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-amber-500 font-bold">"</span>ยอดรวมดีลจากแคมเปญ Motor Show<span class="text-amber-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-amber-500 font-bold">"</span>Opp ที่อยู่ในทีมฝ่ายขายภาคกลาง<span class="text-amber-500 font-bold">"</span>
                        </li>
                      </ul>
                    </div>

                    <!-- Leads -->
                    <div class="group p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                      <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-5 group-hover:scale-110 transition-transform">
                        <ArrowRight class="w-6 h-6" />
                      </div>
                      <h5 class="font-black text-slate-900 dark:text-white mb-3">Leads & Conversion</h5>
                      <ul class="space-y-2.5">
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-indigo-500 font-bold">"</span>Lead ใหม่จาก Facebook ในสัปดาห์นี้<span class="text-indigo-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-indigo-500 font-bold">"</span>มูลค่ารวมของ Lead ที่ถูก Convert แล้ว<span class="text-indigo-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-indigo-500 font-bold">"</span>Lead ตำแหน่ง Manager ที่ยังไม่ถูกติดต่อ<span class="text-indigo-500 font-bold">"</span>
                        </li>
                      </ul>
                    </div>

                    <!-- Assets -->
                    <div class="group p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-900 transition-all">
                      <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-5 group-hover:scale-110 transition-transform">
                        <Terminal class="w-6 h-6" />
                      </div>
                      <h5 class="font-black text-slate-900 dark:text-white mb-3">ทรัพย์สินและ SN</h5>
                      <ul class="space-y-2.5">
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-emerald-500 font-bold">"</span>บริษัท XYZ มี SN ใช้งานอยู่กี่รายการ<span class="text-emerald-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-emerald-500 font-bold">"</span>สินค้าที่ประกันจะหมดอายุใน 30 วัน<span class="text-emerald-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-emerald-500 font-bold">"</span>SN นี้ซื้อมาจากใบสั่งขายเลขที่เท่าไหร่<span class="text-emerald-500 font-bold">"</span>
                        </li>
                      </ul>
                    </div>

                    <!-- Sales -->
                    <div class="group p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900 transition-all">
                      <div class="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 mb-5 group-hover:scale-110 transition-transform">
                        <Copy class="w-6 h-6" />
                      </div>
                      <h5 class="font-black text-slate-900 dark:text-white mb-3">งานขายและใบเสนอราคา</h5>
                      <ul class="space-y-2.5">
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-rose-500 font-bold">"</span>สรุปยอดขายรวมรายเดือนในปีนี้<span class="text-rose-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-rose-500 font-bold">"</span>รายการสินค้าในใบเสนอราคาที่ลูกค้าตกลง<span class="text-rose-500 font-bold">"</span>
                        </li>
                        <li class="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2 italic">
                          <span class="text-rose-500 font-bold">"</span>แคมเปญไหนสร้างยอดขายได้มากที่สุด<span class="text-rose-500 font-bold">"</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </section>

                <!-- Section 2: AI Logic -->
                <section class="space-y-8 p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
                  <div class="absolute top-0 right-0 p-10 opacity-10">
                    <BrainCircuit class="w-64 h-64" />
                  </div>
                  <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                    <div class="max-w-md space-y-4">
                      <h4 class="text-2xl font-black uppercase tracking-tight">2. AI ทำงานอย่างไร?</h4>
                      <p class="text-slate-400 text-sm leading-relaxed font-medium">ทุกครั้งที่คุณถาม AI จะประมวลผลผ่าน 4 ขั้นตอนหลักเพื่อให้ได้ชุดคำสั่งที่แม่นยำและปลอดภัยที่สุด</p>
                    </div>
                    <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div class="space-y-2">
                        <div class="flex items-center gap-3">
                          <span class="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs border border-blue-500/30">1</span>
                          <span class="font-bold text-sm">วิเคราะห์ความตั้งใจ</span>
                        </div>
                        <p class="text-[10px] text-slate-500 ml-10">ระบุโมดูลที่เกี่ยวข้อง (เช่น Accounts, Leads, หรือ Assets)</p>
                      </div>
                      <div class="space-y-2">
                        <div class="flex items-center gap-3">
                          <span class="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs border border-blue-500/30">2</span>
                          <span class="font-bold text-sm">เชื่อมโยงตารางอัตโนมัติ</span>
                        </div>
                        <p class="text-[10px] text-slate-500 ml-10">JOIN ตารางที่จำเป็นและกรองข้อมูลที่ถูกลบ (deleted=0)</p>
                      </div>
                      <div class="space-y-2">
                        <div class="flex items-center gap-3">
                          <span class="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs border border-blue-500/30">3</span>
                          <span class="font-bold text-sm">กรองข้อมูลด้วยเงื่อนไข</span>
                        </div>
                        <p class="text-[10px] text-slate-500 ml-10">แปลงภาษาคน (เช่น "เดือนนี้") ให้เป็นเงื่อนไข SQL WHERE</p>
                      </div>
                      <div class="space-y-2">
                        <div class="flex items-center gap-3">
                          <span class="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-500/30">4</span>
                          <span class="font-bold text-sm">ตรวจสอบความปลอดภัย</span>
                        </div>
                        <p class="text-[10px] text-slate-500 ml-10">อนุญาตเฉพาะคำสั่ง SELECT (Read-only) เท่านั้น</p>
                      </div>
                    </div>
                  </div>
                </section>

                <!-- Section 3: Best Practices -->
                <section class="space-y-10">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-1 bg-emerald-500 rounded-full"></div>
                    <h4 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">3. เทคนิคการตั้งคำถามให้ AI ตรงใจ</h4>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <!-- Do's -->
                    <div class="space-y-6">
                      <h5 class="flex items-center gap-2 text-emerald-600 font-black uppercase tracking-widest text-xs">
                        <div class="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center">✓</div>
                        สิ่งที่ควรทำ (Do's)
                      </h5>
                      <div class="space-y-4">
                        <div class="p-6 rounded-3xl bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 space-y-3">
                          <p class="text-xs font-bold text-emerald-900 dark:text-emerald-300">ระบุชื่อเฉพาะที่ชัดเจน</p>
                          <div class="flex flex-col gap-2">
                            <p class="text-[11px] text-emerald-700 dark:text-emerald-400">✅ "ขอรายการสินค้าของบริษัท <b>ABC จำกัด</b>"</p>
                            <p class="text-[11px] text-slate-400 line-through">❌ "ขอดูของบริษัทนั้นหน่อย"</p>
                          </div>
                        </div>
                        <div class="p-6 rounded-3xl bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 space-y-3">
                          <p class="text-xs font-bold text-emerald-900 dark:text-emerald-300">ระบุช่วงเวลาให้ชัดเจน</p>
                          <div class="flex flex-col gap-2">
                            <p class="text-[11px] text-emerald-700 dark:text-emerald-400">✅ "สรุปยอดขายระหว่าง <b>1 ม.ค. ถึง 31 มี.ค. 2024</b>"</p>
                            <p class="text-[11px] text-slate-400 line-through">❌ "สรุปยอดขายช่วงที่ผ่านมา"</p>
                          </div>
                        </div>
                        <div class="p-6 rounded-3xl bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 space-y-3">
                          <p class="text-xs font-bold text-emerald-900 dark:text-emerald-300">ระบุสถานะข้อมูล</p>
                          <div class="flex flex-col gap-2">
                            <p class="text-[11px] text-emerald-700 dark:text-emerald-400">✅ "เอาเฉพาะ Lead ที่สถานะเป็น <b>'Hot'</b>"</p>
                            <p class="text-[11px] text-slate-400 line-through">❌ "เอา Lead ที่น่าสนใจ"</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Don'ts -->
                    <div class="space-y-6">
                      <h5 class="flex items-center gap-2 text-rose-600 font-black uppercase tracking-widest text-xs">
                        <div class="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center">✕</div>
                        ควรหลีกเลี่ยง (Don'ts)
                      </h5>
                      <div class="space-y-4">
                        <div class="p-6 rounded-3xl bg-rose-50/30 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 space-y-2">
                          <p class="text-xs font-bold text-rose-900 dark:text-rose-300">หลีกเลี่ยงคำที่กำกวม</p>
                          <p class="text-[11px] text-rose-700/70 dark:text-rose-400/70">คำว่า "อันที่เยอะที่สุด" ควรเปลี่ยนเป็น "มูลค่ามากที่สุด" หรือ "จำนวนมากที่สุด"</p>
                        </div>
                        <div class="p-6 rounded-3xl bg-rose-50/30 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 space-y-2">
                          <p class="text-xs font-bold text-rose-900 dark:text-rose-300">หลีกเลี่ยงการถามซ้อนกันเกินไป</p>
                          <p class="text-[11px] text-rose-700/70 dark:text-rose-400/70">หากคำถามซับซ้อนมาก ให้ลองแบ่งเป็น 2 คำถามย่อยจะช่วยให้ AI แม่นยำขึ้น</p>
                        </div>
                        <div class="p-6 rounded-3xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 space-y-2">
                          <div class="flex items-center gap-2 mb-1">
                            <Wand2 class="w-4 h-4 text-amber-500" />
                            <p class="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest">เคล็ดลับเด็ด</p>
                          </div>
                          <p class="text-[11px] text-amber-800 dark:text-amber-400 leading-relaxed">หากต้องการจัดกลุ่มข้อมูล ให้ลงท้ายว่า <b>"แยกตาม..."</b> เช่น "นับจำนวน Lead แยกตามจังหวัด" AI จะสร้างคำสั่ง GROUP BY ให้ทันที!</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              
              <!-- Modal Footer -->
              <div class="px-8 md:px-12 py-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm">
                    <ShieldCheck class="w-5 h-5 text-emerald-500" />
                  </div>
                  <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">ความปลอดภัยเป็นที่หนึ่ง: ชุดคำสั่งทั้งหมดถูกตรวจสอบสิทธิ์แบบ Read-only</p>
                </div>
                <button 
                  @click="isGuideModalOpen = false"
                  class="w-full md:w-auto px-16 py-5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-blue-600 dark:to-indigo-600 text-white font-black rounded-3xl hover:scale-105 transition-all active:scale-95 uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20"
                >
                  เข้าใจแล้ว เริ่มใช้งานเลย
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- SQL Viewer Modal -->

    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div
            v-if="isSqlModalOpen"
            class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md"
            :class="isSqlModalFullscreen ? '' : 'p-6'"
            @click="!isSqlModalFullscreen && (isSqlModalOpen = false)"
          >
            <div
              class="bg-white dark:bg-slate-900 shadow-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col"
              :class="isSqlModalFullscreen ? 'h-full rounded-none max-w-none' : 'rounded-[2rem] max-w-4xl max-h-[90vh]'"
              @click.stop
            >
              <!-- Header -->
              <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 shrink-0">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Terminal class="w-6 h-6" />
                  </div>
                  <div>
                    <h3 class="text-lg font-black text-slate-900 dark:text-white">Generated SQL Command</h3>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ชุดคำสั่งที่ใช้ในการดึงข้อมูลจาก Database</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="isAdmin && !isEditingSql"
                    @click="startEditingSql"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all active:scale-95 text-xs font-bold"
                  >
                    <Edit3 class="w-4 h-4" />
                    แก้ไข SQL
                  </button>
                  <button
                    v-if="!isEditingSql"
                    @click="copySql"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95 text-xs font-bold"
                  >
                    <Copy class="w-4 h-4" />
                    {{ isCopied ? 'คัดลอกแล้ว' : 'คัดลอก SQL' }}
                  </button>
                  <button
                    @click="isSqlModalFullscreen = !isSqlModalFullscreen"
                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    :title="isSqlModalFullscreen ? 'ย่อขนาด' : 'ขยายเต็มจอ'"
                  >
                    <Maximize2 v-if="!isSqlModalFullscreen" class="w-5 h-5" />
                    <Minimize2 v-else class="w-5 h-5" />
                  </button>
                  <button @click="isSqlModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X class="w-6 h-6" />
                  </button>
                </div>
              </div>

              <!-- Content -->
              <div class="p-8 flex flex-col flex-1 overflow-auto gap-6">
                <!-- View mode -->
                <div
                  v-if="!isEditingSql"
                  class="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 shadow-inner overflow-auto custom-scrollbar flex-1"
                >
                  <pre class="text-sm font-mono leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200"><code class="sql-highlight" v-html="highlightSql(generatedResult?.sql)"></code></pre>
                </div>

                <!-- Edit mode -->
                <template v-else>
                  <div class="relative group flex-1 flex flex-col">
                    <textarea
                      v-model="editedSql"
                      class="flex-1 w-full bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm leading-relaxed outline-none resize-none custom-scrollbar text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                      :style="isSqlModalFullscreen ? 'min-height: 0' : 'min-height: 260px'"
                      placeholder="แก้ไขคำสั่ง SQL ที่นี่..."
                    ></textarea>
                    <div class="absolute top-4 right-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">SQL Editor Mode</div>
                  </div>

                  <!-- Error block -->
                  <div v-if="sqlModalError" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-start gap-3 shrink-0">
                    <AlertCircle class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-red-700 dark:text-red-400">SQL Error</p>
                      <p class="text-xs text-red-600 dark:text-red-400 mt-1 font-mono break-all">{{ sqlModalError }}</p>
                    </div>
                  </div>

                  <div class="flex items-center justify-end gap-4 shrink-0">
                    <button
                      @click="cancelEditingSql"
                      class="px-8 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-sm"
                    >
                      ยกเลิก
                    </button>
                    <button
                      @click="updateSql"
                      :disabled="isUpdatingSql || !editedSql"
                      class="px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl hover:scale-105 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:scale-100 shadow-lg shadow-blue-500/20"
                    >
                      <RotateCcw v-if="isUpdatingSql" class="w-4 h-4 animate-spin" />
                      <ShieldCheck v-else class="w-4 h-4" />
                      ตกลง และ Query ใหม่
                    </button>
                  </div>
                </template>

                <!-- Security badge -->
                <div class="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-center gap-3 shrink-0">
                  <ShieldCheck class="w-5 h-5 text-emerald-500" />
                  <span class="text-xs font-medium text-emerald-700 dark:text-emerald-400">คำสั่งนี้ผ่านการตรวจสอบความปลอดภัยและอนุญาตให้ใช้งานแบบ Read-only เท่านั้น</span>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>
    <!-- Favorite Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isFavoriteModalOpen" class="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-amber-50/30 dark:bg-amber-900/10">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Star class="w-6 h-6 fill-current" />
                  </div>
                  <h3 class="text-lg font-black text-slate-900 dark:text-white">บันทึกเป็นรายการโปรด</h3>
                </div>
                <button @click="isFavoriteModalOpen = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <X class="w-6 h-6" />
                </button>
              </div>
              
              <div class="p-8 space-y-6">
                <div class="space-y-2">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">ชื่อรายการโปรด</label>
                  <input 
                    v-model="favoriteTitle"
                    type="text"
                    placeholder="เช่น รายงานยอดขายประจำเดือน..."
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold"
                    autofocus
                    @keyup.enter="saveFavorite"
                  />
                </div>

                <div class="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 italic">
                  "{{ prompt }}"
                </div>

                <div class="flex gap-3">
                  <button 
                    @click="isFavoriteModalOpen = false"
                    class="flex-1 py-4 text-xs font-black text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-widest"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    @click="saveFavorite"
                    :disabled="isSavingFavorite || !favoriteTitle"
                    class="flex-[2] py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest"
                  >
                    <RotateCcw v-if="isSavingFavorite" class="w-4 h-4 animate-spin" />
                    <Bookmark v-else class="w-4 h-4" />
                    <span>บันทึกรายการโปรด</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- Zoho Sheet Export Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isZohoModalOpen" class="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div class="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col animate-in zoom-in-95 duration-200">
              <!-- Header -->
              <div class="p-6 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                <div class="flex items-center gap-3">
                  <h3 class="text-xl font-bold tracking-tight">New external share link</h3>
                  <div class="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/20 uppercase">
                    <LayoutGrid class="w-3 h-3" />
                    zoho_sheet
                  </div>
                </div>
                <button @click="isZohoModalOpen = false" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400 dark:text-white/50">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Content -->
              <div class="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <!-- File Name -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">ชื่อไฟล์</label>
                  <input
                    v-model="zohoOptions.linkName"
                    type="text"
                    placeholder="เช่น Sales_Report, Customer_List"
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">ไฟล์จะถูกบันทึกเป็น <span class="font-mono">{{ (zohoOptions.linkName || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙]/g, '_') }}_[timestamp].xlsx</span></p>
                </div>

                <!-- User Owner -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">เจ้าของไฟล์ (User Owner)</label>
                  <div class="relative" @click="fetchVtigerUsers()">
                    <input
                      v-model="zohoOwnerSearch"
                      type="text"
                      placeholder="ค้นหาชื่อผู้ใช้..."
                      @focus="showZohoOwnerDropdown = true"
                      @blur="hideZohoOwnerDropdown"
                      @input="zohoOwnerVtigerId = null"
                      class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 pr-8 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                    />
                    <button
                      v-if="zohoOwnerVtigerId"
                      @mousedown.prevent="zohoOwnerVtigerId = null; zohoOwnerSearch = ''"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X class="w-4 h-4" />
                    </button>
                    <ul
                      v-show="showZohoOwnerDropdown && filteredZohoUsers.length"
                      class="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-auto max-h-48"
                    >
                      <li
                        v-for="u in filteredZohoUsers"
                        :key="u.id"
                        @mousedown.prevent="selectZohoOwner(u)"
                        class="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        :class="zohoOwnerVtigerId === u.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''"
                      >
                        <span class="text-sm font-medium text-slate-900 dark:text-slate-100">{{ [u.firstName, u.lastName].filter(Boolean).join(' ') || u.userName }}</span>
                        <span class="text-[11px] text-slate-400 dark:text-slate-500 truncate">{{ u.email1 }}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Info Box -->
                <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-4">
                  <ul class="space-y-2 text-xs text-emerald-700 dark:text-emerald-300/80 list-disc pl-4">
                    <li>ไฟล์จะถูกอัพโหลดเป็น <strong>.xlsx</strong> ไปยัง Zoho WorkDrive โฟลเดอร์ <strong>AI Queries</strong></li>
                    <li>สามารถเปิดและแก้ไขได้ใน Zoho Sheet</li>
                    <li>หากต้องการแชร์ link ให้ผู้อื่น สามารถสร้าง External Share Link ได้จาก WorkDrive UI</li>
                  </ul>
                </div>
              </div>

              <!-- Footer -->
              <div class="p-6 flex items-center justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                <button @click="isZohoModalOpen = false" class="px-7 py-3.5 text-sm font-bold text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border border-slate-200 dark:border-white/10">
                  Cancel
                </button>
                <button
                  @click="handleZohoExport"
                  :disabled="isExportingZoho"
                  class="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <Loader2 v-if="isExportingZoho" class="w-4 h-4 animate-spin" />
                  {{ isExportingZoho ? 'Creating...' : 'Create' }}
                </button>
              </div>

              <!-- Result Link (If exists) -->
              <div v-if="generatedZohoLink" class="p-6 bg-emerald-50 dark:bg-emerald-500/10 border-t border-emerald-100 dark:border-emerald-500/20">
                <div class="flex items-center justify-between gap-3 bg-white dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-white/10">
                  <div class="truncate text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">{{ generatedZohoLink }}</div>
                  <button @click="copyToClipboard(generatedZohoLink)" class="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all shrink-0">
                    <Copy class="w-4 h-4 text-slate-400 dark:text-white/50" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- Data Guide Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isDataGuideModalOpen" class="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10 bg-slate-900/80 backdrop-blur-xl">
            <div class="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <!-- Modal Header -->
              <div class="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Database class="w-6 h-6" />
                  </div>
                  <div>
                    <h3 class="text-xl font-black text-slate-900 dark:text-white">สามารถขอข้อมูลอะไรได้บ้าง?</h3>
                    <p class="text-xs text-slate-500 font-medium">สรุปข้อมูลที่มีในระบบโดย AI (อัปเดตตามสถานะปัจจุบัน)</p>
                  </div>
                </div>
                <button @click="isDataGuideModalOpen = false" class="p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
                  <X class="w-6 h-6" />
                </button>
              </div>

              <!-- Modal Content -->
              <div class="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div v-if="isLoadingDataGuide" class="flex flex-col items-center justify-center py-20 space-y-6">
                  <div class="relative w-20 h-20">
                    <div class="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                      <BrainCircuit class="w-8 h-8 text-indigo-600 animate-pulse" />
                    </div>
                  </div>
                  <div class="text-center space-y-2">
                    <p class="text-lg font-black text-slate-900 dark:text-white">กำลังให้ AI วิเคราะห์ขอบเขตข้อมูล...</p>
                    <p class="text-sm text-slate-500 font-medium">ระบบกำลังประมวลผลค่าคงที่และตรรกะในระบบปัจจุบัน</p>
                  </div>
                </div>

                <div v-else class="prose prose-slate dark:prose-invert max-w-none data-guide-content">
                  <div v-html="renderedDataGuide" class="text-slate-700 dark:text-slate-300 leading-relaxed font-medium"></div>
                </div>
              </div>

              <!-- Modal Footer -->
              <div class="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <button 
                  @click="isDataGuideModalOpen = false"
                  class="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest"
                >
                  เข้าใจแล้ว
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- CSV Download Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isCsvConfirmModalOpen" class="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div class="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col animate-in zoom-in-95 duration-200" @click.stop>
              <!-- Header -->
              <div class="p-6 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                <div class="flex items-center gap-3">
                  <h3 class="text-xl font-bold tracking-tight">ดาวน์โหลดไฟล์ CSV</h3>
                  <div class="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/20 uppercase">
                    <Download class="w-3 h-3" />
                    CSV
                  </div>
                </div>
                <button @click="isCsvConfirmModalOpen = false" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400 dark:text-white/50">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Content -->
              <div class="p-8 space-y-6">
                <!-- File Name Input -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">ชื่อไฟล์</label>
                  <div class="flex items-stretch">
                    <input
                      v-model="csvFilename"
                      type="text"
                      placeholder="เช่น Sales_Report, Customer_List"
                      @keyup.enter="isCsvConfirmModalOpen = false; requestApproval()"
                      class="flex-1 bg-slate-50 dark:bg-white/5 border border-r-0 border-slate-200 dark:border-white/10 rounded-l-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                    />
                    <span class="bg-slate-100 dark:bg-white/10 border border-l-0 border-slate-200 dark:border-white/10 rounded-r-xl px-4 py-3 text-sm text-slate-400 dark:text-white/30 font-mono flex items-center">.csv</span>
                  </div>
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">
                    ไฟล์จะถูกบันทึกเป็น <span class="font-mono">{{ ((csvFilename || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙\s_-]/g, '').trim().replace(/\s+/g, '_') || 'AI_Export') + '.csv' }}</span>
                  </p>
                </div>

                <!-- User Owner -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">เจ้าของไฟล์ (User Owner)</label>
                  <div class="relative" @click="fetchVtigerUsers()">
                    <input
                      v-model="csvOwnerSearch"
                      type="text"
                      placeholder="ค้นหาชื่อผู้ใช้..."
                      @focus="showCsvOwnerDropdown = true"
                      @blur="hideCsvOwnerDropdown"
                      @input="csvOwnerVtigerId = null"
                      class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 pr-8 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                    />
                    <button
                      v-if="csvOwnerVtigerId"
                      @mousedown.prevent="csvOwnerVtigerId = null; csvOwnerSearch = ''"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X class="w-4 h-4" />
                    </button>
                    <ul
                      v-show="showCsvOwnerDropdown && filteredCsvUsers.length"
                      class="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-auto max-h-48"
                    >
                      <li
                        v-for="u in filteredCsvUsers"
                        :key="u.id"
                        @mousedown.prevent="selectCsvOwner(u)"
                        class="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        :class="csvOwnerVtigerId === u.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''"
                      >
                        <span class="text-sm font-medium text-slate-900 dark:text-slate-100">{{ [u.firstName, u.lastName].filter(Boolean).join(' ') || u.userName }}</span>
                        <span class="text-[11px] text-slate-400 dark:text-slate-500 truncate">{{ u.email1 }}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Info Box -->
                <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-4">
                  <p class="text-xs text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                    ระบบจะ<strong>อนุมัติคำขอนี้อัตโนมัติ</strong> บันทึกลงประวัติการใช้งาน และเริ่มดาวน์โหลดไฟล์ทันที
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div class="p-6 flex items-center justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                <button
                  @click="isCsvConfirmModalOpen = false"
                  class="px-7 py-3.5 text-sm font-bold text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border border-slate-200 dark:border-white/10"
                >
                  ยกเลิก
                </button>
                <button
                  @click="isCsvConfirmModalOpen = false; requestApproval(csvOwnerVtigerId ? getOwnerLabel(csvOwnerVtigerId) : undefined)"
                  :disabled="isRequesting"
                  class="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <RotateCcw v-if="isRequesting" class="w-4 h-4 animate-spin" />
                  <Download v-else class="w-4 h-4" />
                  ยืนยัน / ดาวน์โหลด
                </button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- Delete Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isDeleteConfirmModalOpen" class="fixed inset-0 z-[140] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <div class="p-8 text-center space-y-6">
                <div class="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center text-rose-500 mx-auto border border-rose-100 dark:border-rose-800/50">
                  <AlertTriangle class="w-10 h-10" />
                </div>
                
                <div class="space-y-2">
                  <h3 class="text-xl font-black text-slate-900 dark:text-white">ยืนยันการลบ?</h3>
                  <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">คุณแน่ใจหรือไม่ว่าต้องการลบรายการโปรด <br><b class="text-slate-700 dark:text-slate-200">"{{ favoriteToDelete?.title }}"</b></p>
                </div>

                <div class="flex gap-3 pt-2">
                  <button 
                    @click="isDeleteConfirmModalOpen = false"
                    class="flex-1 py-4 text-xs font-black text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-widest"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    @click="confirmDeleteFavorite"
                    class="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-rose-500/20 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    ยืนยันการลบ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.modal-enter-active, .modal-leave-active {
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-active > div, .modal-leave-active > div {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-enter-from > div, .modal-leave-to > div {
  transform: scale(0.9) translateY(30px);
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 2.5s infinite linear;
}

textarea::placeholder {
  font-weight: 500;
}

/* Data Guide Styling */
.data-guide-content h2 {
  @apply text-xl font-black text-indigo-700 dark:text-indigo-400 mt-16 mb-8 flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-900/20 px-6 py-4 rounded-2xl border-l-8 border-indigo-600 shadow-sm;
}
.data-guide-content p, .data-guide-content li {
  @apply text-slate-600 dark:text-slate-400 text-base leading-loose mb-4 px-2;
}
.data-guide-content strong {
  @apply text-slate-900 dark:text-slate-200 font-bold;
}
.data-guide-content hr {
  @apply my-16 border-slate-100 dark:border-slate-800 opacity-0;
}
.data-guide-content blockquote {
  @apply pl-6 border-l-4 border-amber-500 bg-amber-50/30 dark:bg-amber-900/10 py-6 pr-6 rounded-r-3xl italic my-10 shadow-sm;
}
.data-guide-content ul {
  @apply space-y-4 list-none pl-2 my-8;
}
.data-guide-content ul li {
  @apply flex items-start gap-3 before:content-['•'] before:text-indigo-500 before:font-black before:text-xl before:mt-[-2px];
}
</style>
