<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { format } from 'sql-formatter'
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
  Minimize2,
  CheckCircle2,
  Lightbulb,
  Send,
  MessageSquare,
  MessageSquarePlus,
  ChevronDown,
  Volume2,
  VolumeX,
  Share2,
  Square,
  SquareCheck,
  MousePointerClick,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  FileText,
  Table2,
  Layers
} from 'lucide-vue-next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ApexCharts from 'apexcharts'
import 'apexcharts/features/exports'
import * as XLSX from 'xlsx'


const colorMode = useColorMode()
const isDarkMode = computed(() => colorMode.value === 'dark')
const sqlCaretStyle = computed(() => ({ caretColor: isDarkMode.value ? '#ffffff' : '#1e293b' }))

const prompt = ref('')
const isGenerating = ref(false)
const isOptimizing = ref(false)
const isOptimized = ref(false)
const originalSql = ref<string | null>(null)
const optimizationExplanation = ref<string | null>(null)
const showOriginalSql = ref(false)
const generatedResult = ref<any>(null)
const isRequesting = ref(false)
const isRequestModalOpen = ref(false)
const requestReason = ref('')
const isCopied = ref(false)
const isRefining = ref(false)
const originalPrompt = ref('')
const isSqlModalOpen = ref(false)
const isTipsModalOpen = ref(false)
const isDataGuideModalOpen = ref(false)
const dataGuideContent = ref('')
const isLoadingDataGuide = ref(false)

// Schema Explorer Modal
const isSchemaModalOpen = ref(false)
const schemaTableSearch = ref('')
const schemaSelectedTable = ref<string | null>(null)
const schemaTableList = ref<string[]>([])
const schemaColumns = ref<Array<{ column: string; type: string; nullable: string; key: string; comment: string }>>([])
const isLoadingTables = ref(false)
const isLoadingColumns = ref(false)
const schemaCopied = ref<string | null>(null)

const copySchemaText = (text: string) => {
  navigator.clipboard.writeText(text)
  schemaCopied.value = text
  setTimeout(() => { schemaCopied.value = null }, 1500)
}
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
const generateAbortController = ref<AbortController | null>(null)
const previewAbortController = ref<AbortController | null>(null)
const isCancelled = ref(false)
const reasoningSteps = ref<string[]>([])

// Streaming agentic state
const liveSteps = ref<Array<{
  tool: string
  args: Record<string, unknown>
  status: 'running' | 'done'
  stepElapsed?: number
}>>([])
const validateResult = ref<{ ok: boolean; count?: number; error?: string; elapsed?: number } | null>(null)
const sqlReady = ref(false)
const isFetching = ref(false)
const editableSql = ref('')
const isExplanationOpen = ref(false)
const sqlEditorRef = ref<HTMLTextAreaElement | null>(null)
const sqlHighlightRef = ref<HTMLPreElement | null>(null)
const directSqlEditorRef = ref<HTMLTextAreaElement | null>(null)
const directSqlHighlightRef = ref<HTMLPreElement | null>(null)
const isDirectSqlFullscreen = ref(false)
const directSqlFsEditorRef = ref<HTMLTextAreaElement | null>(null)
const directSqlFsHighlightRef = ref<HTMLPreElement | null>(null)

// Tab state
const activeTab = ref<1 | 2 | 3>(1)
const isAnalysisPanelOpen = ref(true)
const isSqlPanelOpen = ref(true)
const isResultFullscreen = ref(false)
const isEditingPromptInTab = ref(false)
const promptEditBuffer = ref('')

// Direct SQL mode
const inputMode = ref<'natural' | 'sql'>('natural')
const directSql = ref('')
const directSqlError = ref('')
const sqlFixSuggestion = ref<{ cause: string; fix: string; fixedSql: string | null } | null>(null)
const isFixingSql = ref(false)

// Current generate mode (loaded from settings)
const currentGenerateMode = ref<'agentic' | 'static'>('agentic')

// Confirmation modal ก่อน ย้อนกลับ
const isBackConfirmOpen = ref(false)

// AI Fix สำหรับ Tab 2 SQL Editor (แยกจาก Direct SQL mode)
const isFixingSqlInTab = ref(false)
const sqlFixInTabSuggestion = ref<{ cause: string; fix: string; fixedSql: string | null } | null>(null)

// Regenerate AI Analysis Summary เมื่อ SQL เปลี่ยน
const isRegeneratingExplanation = ref(false)

const toggleChatSqlExpand = (idx: number) => {
  const s = new Set(expandedChatSqlIdxs.value)
  s.has(idx) ? s.delete(idx) : s.add(idx)
  expandedChatSqlIdxs.value = s
}

// SQL Chat ใน Tab 2
const isSqlChatOpen = ref(false)
const isSqlEditorExpanded = ref(false)
const expandedChatSqlIdxs = ref(new Set<number>())
const isFixSqlExpanded = ref(false)
const sqlChatMessages = ref<{ role: 'user' | 'model'; text: string; updatedSql?: string }[]>([])
const sqlChatInput = ref('')
const isSqlChatLoading = ref(false)
const sqlChatInputRef = ref<HTMLTextAreaElement | null>(null)
const sqlChatScrollRef = ref<HTMLDivElement | null>(null)
const sqlChatStatus = ref('')   // แสดงสถานะ AI กำลังทำอะไร (tool calls)
const sqlFixStatus = ref('')    // สถานะสำหรับ AI Fix

watch(isSqlChatOpen, async (val) => {
  if (val) {
    await nextTick()
    sqlChatInputRef.value?.focus()
  }
})

// Direct download (no history)
const isDirectDownloading = ref(false)

// File Upload State
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadedData = ref<any[] | null>(null)
const uploadedFileName = ref('')
const isParsingFile = ref(false)
const DATA_CONTEXT_LIMIT = 200

// ใช้ auth data ที่ middleware เก็บไว้ใน useState แทนการ fetch ซ้ำ
// หลีกเลี่ยง await useFetch ที่ทำให้ page เป็น async component → Suspense trigger middleware ซ้ำ
const authData = useState<any>('auth-data')
const user = computed(() => authData.value?.user)
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
const csvExpiresAt = ref('')
const csvSuccessDone = ref(false)
const csvSkipEmail = ref(false)

// Zoho success state
const zohoSuccessDone = ref(false)
const zohoExpiresAt = ref('')
const zohoSkipEmail = ref(false)
const zohoResultLink = ref('')




watch(generatedResult, (newVal, oldVal) => {
  if (!newVal || (oldVal && newVal !== oldVal)) {
    sqlChatMessages.value = []
    sqlChatInput.value = ''
    isSqlChatOpen.value = false
  }
})


const fetchAllRows = async () => {
  if (!generatedResult.value?.sql || isFetchingAllRows.value) return
  // ถ้ามี cache อยู่แล้ว แค่ toggle แสดง ไม่ต้อง fetch ใหม่
  if (allRowsData.value.length > 0) {
    showAllRows.value = true
    showPreview.value = true
    return
  }
  isFetchingAllRows.value = true
  try {
    const res: any = await $fetch('/api/ai-query/preview', {
      method: 'POST',
      body: { query: generatedResult.value.sql, fetchAll: true }
    })
    if (res.success) {
      allRowsData.value = res.data
      showAllRows.value = true
      showPreview.value = true
    }
  } finally {
    isFetchingAllRows.value = false
  }
}

const openCsvModal = () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  csvFilename.value = `AI_Export_${today}`
  // default expired = 7 วันจากวันนี้
  const defaultExpiry = new Date()
  defaultExpiry.setDate(defaultExpiry.getDate() + 7)
  csvExpiresAt.value = defaultExpiry.toISOString().slice(0, 10)
  fetchVtigerUsers().then(() => {
    if (!csvOwnerVtigerId.value && user.value?.vtigerId) {
      csvOwnerVtigerId.value = user.value.vtigerId
      csvOwnerSearch.value = getOwnerLabel(user.value.vtigerId)
    }
  })
  isCsvConfirmModalOpen.value = true
}

const downloadDirect = async () => {
  if (!generatedResult.value?.sql || isDirectDownloading.value) return

  isDirectDownloading.value = true
  try {
    const fn = (csvFilename.value || 'AI_Export')
      .replace(/[^a-zA-Z0-9ก-๙\s_-]/g, '').trim().replace(/\s+/g, '_') || 'AI_Export'

    const response = await fetch('/api/ai-query/export-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: generatedResult.value.sql, filename: fn })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ statusMessage: 'ดาวน์โหลดไม่สำเร็จ' }))
      toast.error('ดาวน์โหลดไม่สำเร็จ', err.statusMessage || 'กรุณาลองใหม่อีกครั้ง')
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fn}.csv`
    a.click()
    URL.revokeObjectURL(url)

    isCsvConfirmModalOpen.value = false
    toast.success('ดาวน์โหลดสำเร็จ', `บันทึกไฟล์ ${fn}.csv เรียบร้อยแล้ว`)
  } catch (e: any) {
    toast.error('ดาวน์โหลดไม่สำเร็จ', e?.message || 'กรุณาลองใหม่อีกครั้ง')
  } finally {
    isDirectDownloading.value = false
  }
}

const openZohoModal = () => {
  const defaultExpiry = new Date()
  defaultExpiry.setDate(defaultExpiry.getDate() + 7)
  zohoExpiresAt.value = defaultExpiry.toISOString().slice(0, 10)
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
        generatedSql: editableSql.value || generatedResult.value.sql,
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

const submitBtnRef = ref<HTMLElement | null>(null)

const useFavorite = (fav: any) => {
  if (inputMode.value === 'sql') {
    directSql.value = formatSql(fav.generatedSql || fav.queryText || '')
    directSqlError.value = ''
    sqlFixSuggestion.value = null
    return
  }
  prompt.value = fav.queryText
  focusAndEnd()
  if (window.innerWidth < 1024) {
    nextTick(() => {
      submitBtnRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}

onMounted(async () => {
  fetchFavorites()
  try {
    const res = await $fetch<any>('/api/admin/ai-settings')
    if (res.success) currentGenerateMode.value = res.settings.generateMode ?? 'agentic'
  } catch { /* ใช้ default agentic */ }
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

// Schema Explorer
const filteredSchemaTables = computed(() =>
  schemaTableList.value.filter(t =>
    t.includes(schemaTableSearch.value.toLowerCase())
  )
)

const openSchemaModal = async () => {
  isSchemaModalOpen.value = true
  schemaSelectedTable.value = null
  schemaColumns.value = []
  schemaTableSearch.value = ''
  if (schemaTableList.value.length === 0) {
    isLoadingTables.value = true
    try {
      const data = await $fetch<{ tables: string[] }>('/api/db-schema/tables')
      schemaTableList.value = data.tables
    } catch {
      toast.error('ล้มเหลว', 'ไม่สามารถดึงรายการตารางได้')
    } finally {
      isLoadingTables.value = false
    }
  }
}

const selectSchemaTable = async (table: string) => {
  schemaSelectedTable.value = table
  isLoadingColumns.value = true
  schemaColumns.value = []
  try {
    const data = await $fetch<{ columns: Array<{ column: string; type: string; nullable: string; key: string; comment: string }> }>('/api/db-schema/describe', { query: { table } })
    schemaColumns.value = data.columns
  } catch {
    toast.error('ล้มเหลว', 'ไม่สามารถดึงข้อมูลฟิลด์ได้')
  } finally {
    isLoadingColumns.value = false
  }
}


const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadedFileName.value = file.name
  isParsingFile.value = true
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        toast.error('ไฟล์ไม่ถูกต้อง', 'ไม่พบแผ่นงานในไฟล์ที่อัปโหลด')
        clearFile()
        return
      }
      const worksheet = workbook.Sheets[firstSheetName]
      if (!worksheet) {
        toast.error('ไฟล์ไม่ถูกต้อง', 'ไม่สามารถอ่านข้อมูลแผ่นงานได้')
        clearFile()
        return
      }
      const json = XLSX.utils.sheet_to_json(worksheet)
      
      if (Array.isArray(json) && json.length > 0) {
        uploadedData.value = json
        toast.success('อัปโหลดไฟล์สำเร็จ', `โหลดข้อมูลจาก ${file.name} จำนวน ${json.length} แถว เรียบร้อยแล้ว`)
      } else {
        toast.error('ไฟล์ไม่มีข้อมูล', 'ไม่พบข้อมูลในไฟล์ที่อัปโหลด')
        clearFile()
      }
    } catch (err) {
      console.error('File parsing error:', err)
      toast.error('ข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ได้ โปรดตรวจสอบรูปแบบไฟล์')
      clearFile()
    } finally {
      isParsingFile.value = false
    }
  }
  reader.readAsArrayBuffer(file)
}

const clearFile = () => {
  uploadedData.value = null
  uploadedFileName.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const triggerFileUpload = () => {
  fileInputRef.value?.click()
}

const formatExplanation = (text: string | null | undefined) => {
  if (!text) return ''
  let processedText = text
  
  // Auto-convert legacy history items or plain text to bullet points
  if (!processedText.includes('- ') && !processedText.includes('* ')) {
    processedText = processedText.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => `- ${line}`)
      .join('\n')
  }
  
  return DOMPurify.sanitize(marked.parse(processedText) as string)
}

const renderedExplanation = computed(() => {
  return formatExplanation(generatedResult.value?.explanation)
})

const isExplanationCopied = ref(false)
const copyExplanation = async () => {
  if (!generatedResult.value?.explanation) return
  try {
    const textToCopy = generatedResult.value.explanation.replace(/\*/g, '')
    
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy)
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = textToCopy
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (!successful) throw new Error('Fallback copy failed')
    }
    
    isExplanationCopied.value = true
    toast.success('คัดลอกสำเร็จ', 'คัดลอกคำอธิบายลงคลิปบอร์ดแล้ว')
    setTimeout(() => {
      isExplanationCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Clipboard error:', err)
    toast.error('ผิดพลาด', 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก (อาจเป็นเพราะไม่ได้ใช้ HTTPS)')
  }
}

const handleZohoExport = async () => {
  isExportingZoho.value = true
  try {
    // Set default owner if not yet selected
    if (!zohoOwnerVtigerId.value && user.value?.vtigerId) {
      zohoOwnerVtigerId.value = user.value.vtigerId
    }

    // 1. Create request + auto-approve (same as CSV flow)
    const zohoResolvedExpiry = zohoExpiresAt.value
      ? new Date(zohoExpiresAt.value + 'T23:59:59').toISOString()
      : null
    const requestResp = await $fetch<any>('/api/ai-query/request', {
      method: 'POST',
      body: {
        queryText: prompt.value,
        generatedSql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation,
        resultCount: generatedResult.value.previewCount,
        requestReason: 'Export to Zoho WorkDrive',
        ownerVtigerId: zohoOwnerVtigerId.value || null,
        expiresAt: zohoResolvedExpiry,
        skipEmail: zohoSkipEmail.value,
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
        options: { ...zohoOptions.value, ownerVtigerId: zohoOwnerVtigerId.value, expiresAt: zohoResolvedExpiry, skipEmail: zohoSkipEmail.value },
        requestId: requestResp.requestId
      }
    })

    if (response.success) {
      zohoSuccessDone.value = true
      zohoResultLink.value = response.link || ''
      zohoOptions.value.linkName = ''
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

// กลับไปแก้ไขคำขอ — keep prompt, only clear result
const backToEdit = () => {
  generatedResult.value = null
  liveSteps.value = []
  validateResult.value = null
  sqlReady.value = false
  editableSql.value = ''
  isExplanationOpen.value = false
  activeTab.value = 1
  isAnalysisPanelOpen.value = true
  isSqlPanelOpen.value = true
  nextTick(() => textareaRef.value?.focus())
}

const clearInput = () => {
  prompt.value = ''
  originalPrompt.value = ''
  generatedResult.value = null
  reasoningSteps.value = []
  liveSteps.value = []
  validateResult.value = null
  sqlReady.value = false
  editableSql.value = ''
  isExplanationOpen.value = false
  activeTab.value = 1
  isAnalysisPanelOpen.value = true
  isSqlPanelOpen.value = true
  clearFile()
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
const previewSearch = ref('')
const showAllRows = ref(false)
const isFetchingAllRows = ref(false)
const allRowsData = ref<any[]>([])
const resultSection = ref<HTMLElement | null>(null)

const filteredPreviewData = computed(() => {
  const data = showAllRows.value ? allRowsData.value : (generatedResult.value?.previewData ?? [])
  if (!previewSearch.value.trim()) return data
  const q = previewSearch.value.toLowerCase()
  return data.filter((row: any) =>
    Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
  )
})

const formatCellValue = (val: any, key?: string | number): string => {
  if (val === null || val === undefined) return '—'
  const colName = String(key ?? '').toLowerCase()

  // คอลัมน์ที่ไม่ควร format: ID, phone, mobile, tel
  const isIdColumn = /\bid\b|_id$|^id_/.test(colName)
  const isRawColumn = isIdColumn || /phone|mobile|\btel\b/i.test(colName)

  if (typeof val === 'number') {
    if (isRawColumn) return String(val)
    // ตัวเลขที่ดูเหมือนปี (integer 1900-2200) ไม่ใส่ comma ไม่ว่า column จะชื่ออะไร
    if (Number.isInteger(val) && val >= 1900 && val <= 2200) return String(val)
    return Number.isInteger(val)
      ? val.toLocaleString('th-TH')
      : val.toLocaleString('th-TH', { maximumFractionDigits: 4 })
  }

  if (typeof val === 'string') {
    const trimmed = val.trim()
    // integer string (ไม่มีจุด)
    if (/^\d+$/.test(trimmed) && trimmed.length > 3) {
      if (isRawColumn) return val
      const num = Number(trimmed)
      if (num >= 1900 && num <= 2200) return val  // ปี
      return num.toLocaleString('th-TH')
    }
    // decimal string เช่น "23567225.979"
    if (/^\d+\.\d+$/.test(trimmed)) {
      if (isRawColumn) return val
      const num = Number(trimmed)
      return num.toLocaleString('th-TH', { maximumFractionDigits: 4 })
    }
  }

  return String(val)
}

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
  const sqlSource = editableSql.value || generatedResult.value?.sql
  if (!sqlSource) return
  try {
    const textToCopy = formatSql(sqlSource)
    
    // Check if clipboard API is available and context is secure
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy)
    } else {
      // Fallback for non-HTTPS connections (e.g. local IP testing)
      const textArea = document.createElement("textarea")
      textArea.value = textToCopy
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (!successful) throw new Error('Fallback copy failed')
    }
    
    isCopied.value = true
    setTimeout(() => { isCopied.value = false }, 2000)
    toast.success('คัดลอกแล้ว', 'คัดลอกคำสั่ง SQL ลง Clipboard เรียบร้อย')
  } catch (err) {
    console.error('Clipboard error:', err)
    toast.error('ล้มเหลว', 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก (อาจเป็นเพราะไม่ได้ใช้ HTTPS)')
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

const toolLabel = (tool: string, args: Record<string, unknown>): string => {
  switch (tool) {
    case 'list_tables':      return args.module_hint ? `สำรวจตาราง "${args.module_hint}"` : 'สำรวจตารางในฐานข้อมูล'
    case 'describe_table':   return `ตรวจสอบโครงสร้าง ${args.table_name}`
    case 'search_columns':   return `ค้นหา column "${args.keyword}"`
    case 'list_picklist_values': return `ดึงค่า dropdown (${args.field_name})`
    case 'sample_data':      return `ดูตัวอย่างข้อมูล ${args.table_name}`
    default:                 return tool
  }
}

const handleStreamEvent = (ev: any) => {
  switch (ev.type) {
    case 'step_start':
      liveSteps.value.push({ tool: ev.tool, args: ev.args ?? {}, status: 'running' })
      break
    case 'step_done': {
      const step = [...liveSteps.value].reverse().find(s => s.tool === ev.tool && s.status === 'running')
      if (step) { step.status = 'done'; step.stepElapsed = ev.stepElapsed }
      break
    }
    case 'sql_ready':
      sqlReady.value = true
      break
    case 'validated':
      validateResult.value = { ok: ev.ok, error: ev.error, elapsed: ev.stepElapsed }
      break
    case 'clarification':
      generatedResult.value = { status: 'clarification_needed', explanation: ev.explanation }
      activeTab.value = 2
      toast.info('AI มีข้อสงสัย', 'โปรดให้รายละเอียดเพิ่มเติมตามที่ AI แนะนำ')
      break
    case 'done':
      generatedResult.value = {
        sql: ev.sql,
        explanation: ev.explanation,
        previewData: null,
        previewCount: 0,
        status: validateResult.value?.ok === false ? 'error' : 'success',
        dbError: validateResult.value?.ok === false ? validateResult.value.error : null,
        maxResultsLimit: ev.maxResultsLimit,
        limitOverridden: ev.limitOverridden,
        schemaContext: ev.schemaContext || '',
        mode: 'agentic'
      }
      editableSql.value = formatSql(ev.sql)
      isExplanationOpen.value = false
      activeTab.value = 2
      isAnalysisPanelOpen.value = true
      isSqlPanelOpen.value = true
      setTimeout(() => {
        resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      break
    case 'error':
      error.value = ev.message || 'เกิดข้อผิดพลาดในการประมวลผล'
      break
  }
}

// ตรวจว่า SQL ถูกแก้ไขจากต้นฉบับ (ใช้ทั้งกดเองและผ่าน AI Fix)
const isSqlEditedFromOriginal = computed(() => {
  if (!generatedResult.value?.sql || !editableSql.value) return false
  return editableSql.value.trim() !== formatSql(generatedResult.value.sql).trim()
})

// เรียก AI fix สำหรับ Tab 2
const fetchSqlFixForTab = async () => {
  const sqlText = editableSql.value || generatedResult.value?.sql || ''
  const errorMsg = generatedResult.value?.dbError || ''
  if (!sqlText || !errorMsg || isFixingSqlInTab.value) return
  isFixingSqlInTab.value = true
  sqlFixInTabSuggestion.value = null
  sqlFixStatus.value = 'กำลังวิเคราะห์โครงสร้าง DB...'
  try {
    const response = await fetch('/api/ai-query/fix-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: sqlText,
        error: errorMsg,
        schemaContext: generatedResult.value?.schemaContext || ''
      })
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const processFixEvent = (ev: any) => {
      if (ev.type === 'tool_start') {
        sqlFixStatus.value = toolStatusText(ev.tool, ev.args)
      } else if (ev.type === 'tool_done') {
        sqlFixStatus.value = 'กำลังวิเคราะห์...'
      } else if (ev.type === 'done' && ev.suggestion) {
        sqlFixInTabSuggestion.value = ev.suggestion
      } else if (ev.type === 'error') {
        sqlFixInTabSuggestion.value = { cause: ev.message || 'เกิดข้อผิดพลาด', fix: 'กรุณาลองใหม่อีกครั้ง', fixedSql: null }
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.replace(/^data:\s*/, '').trim()
        if (!line) continue
        try { processFixEvent(JSON.parse(line)) } catch { /* skip */ }
      }
    }
    if (buffer.trim()) {
      const line = buffer.replace(/^data:\s*/, '').trim()
      if (line) { try { processFixEvent(JSON.parse(line)) } catch { /* skip */ } }
    }
  } catch (err: any) {
    sqlFixInTabSuggestion.value = { cause: err?.message || 'เกิดข้อผิดพลาด', fix: 'กรุณาลองใหม่อีกครั้ง', fixedSql: null }
  } finally {
    isFixingSqlInTab.value = false
    sqlFixStatus.value = ''
  }
}

// Apply AI fix ไปที่ editableSql
const applyAiFixInTab = () => {
  if (!sqlFixInTabSuggestion.value?.fixedSql) return
  editableSql.value = formatSql(sqlFixInTabSuggestion.value.fixedSql)
  sqlFixInTabSuggestion.value = null
  if (generatedResult.value) {
    generatedResult.value.dbError = null
  }
}

// แปลง tool name เป็นข้อความสถานะภาษาไทย
const toolStatusText = (tool: string, args: any): string => {
  if (tool === 'list_tables') return `กำลังค้นหาตาราง${args?.module_hint ? ` "${args.module_hint}"` : ''}...`
  if (tool === 'describe_table') return `กำลังดูโครงสร้างตาราง "${args?.table_name}"...`
  if (tool === 'search_columns') return `กำลังค้นหาคอลัมน์ "${args?.keyword}"...`
  if (tool === 'list_picklist_values') return `กำลังดึงค่า "${args?.field_name}"...`
  return 'กำลังค้นหาข้อมูล...'
}

// เลื่อน chat scroll ลงล่างสุด
const scrollSqlChatToBottom = async () => {
  await nextTick()
  if (sqlChatScrollRef.value) {
    sqlChatScrollRef.value.scrollTop = sqlChatScrollRef.value.scrollHeight
  }
}

// ล้างประวัติแชตและเริ่มใหม่โดยใช้ SQL ปัจจุบัน
function startNewChat() {
  sqlChatMessages.value = []
  sqlChatInput.value = ''
  sqlChatStatus.value = ''
  toast.info('เริ่มแชตใหม่โดยใช้ SQL ปัจจุบันใน Editor')
}

// SQL Chat functions
const sendSqlChat = async () => {
  const q = sqlChatInput.value.trim()
  if (!q || isSqlChatLoading.value) return
  const sqlText = editableSql.value || generatedResult.value?.sql || ''

  sqlChatMessages.value.push({ role: 'user', text: q })
  sqlChatInput.value = ''
  isSqlChatLoading.value = true
  sqlChatStatus.value = 'กำลังวิเคราะห์...'
  await scrollSqlChatToBottom()

  try {
    const history = sqlChatMessages.value.slice(0, -1).map(m => ({ role: m.role, text: m.text }))
    const response = await fetch('/api/ai-query/chat-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: sqlText,
        error: generatedResult.value?.dbError || '',
        question: q,
        messages: history,
        schemaContext: generatedResult.value?.schemaContext || ''
      })
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let gotReply = false

    const processChatEvent = async (ev: any) => {
      if (ev.type === 'tool_start') {
        sqlChatStatus.value = toolStatusText(ev.tool, ev.args)
      } else if (ev.type === 'tool_done') {
        sqlChatStatus.value = 'กำลังวิเคราะห์...'
      } else if (ev.type === 'done') {
        const replyText = ev.reply || '(ไม่มีคำตอบ กรุณาลองใหม่)'
        sqlChatMessages.value.push({ role: 'model', text: replyText, updatedSql: ev.updatedSql })
        gotReply = true
        await scrollSqlChatToBottom()
      } else if (ev.type === 'error') {
        sqlChatMessages.value.push({ role: 'model', text: `❌ ${ev.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}` })
        gotReply = true
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.replace(/^data:\s*/, '').trim()
        if (!line) continue
        try { await processChatEvent(JSON.parse(line)) } catch { /* skip bad json */ }
      }
    }
    // process ส่วนที่เหลือใน buffer (chunk สุดท้ายที่ไม่มี \n\n)
    if (buffer.trim()) {
      const line = buffer.replace(/^data:\s*/, '').trim()
      if (line) {
        try { await processChatEvent(JSON.parse(line)) } catch { /* skip */ }
      }
    }
    // ถ้า stream จบโดยไม่มี done/error event เลย
    if (!gotReply) {
      sqlChatMessages.value.push({ role: 'model', text: 'ไม่ได้รับคำตอบจาก AI กรุณาลองใหม่อีกครั้ง' })
    }
  } catch (err: any) {
    sqlChatMessages.value.push({ role: 'model', text: `❌ ${err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}` })
  } finally {
    isSqlChatLoading.value = false
    sqlChatStatus.value = ''
  }
}

const applySqlFromChat = (sql: string) => {
  editableSql.value = formatSql(sql)
}

// SQL chat cleared เมื่อมี result ใหม่ (ดู watch generatedResult)

const fetchData = async () => {
  const sqlToRun = editableSql.value || generatedResult.value?.sql
  if (!sqlToRun || isFetching.value) return
  isFetching.value = true
  const hadSqlError = generatedResult.value?.explanation?.startsWith('SQL Error:')
  try {
    const response = await $fetch<any>('/api/ai-query/preview', {
      method: 'POST',
      body: { query: sqlToRun }
    })
    if (response.success) {
      generatedResult.value.previewData = response.data
      generatedResult.value.previewCount = response.totalCount
      generatedResult.value.status = 'success'
      generatedResult.value.dbError = null
      showPreview.value = true
      previewSearch.value = ''
      showAllRows.value = false
      allRowsData.value = []
      activeTab.value = 3
      toast.success('ดึงข้อมูลสำเร็จ', `พบข้อมูล ${(response.totalCount ?? 0).toLocaleString()} รายการ`)
      // ถ้า explanation เดิมเป็น error ให้ดึง explanation ใหม่จาก AI
      if (hadSqlError) {
        try {
          const explainRes = await $fetch<any>('/api/ai-query/explain-sql', {
            method: 'POST',
            body: { sql: sqlToRun }
          })
          if (explainRes.success) {
            generatedResult.value.explanation = explainRes.explanation
            if (inputMode.value === 'sql') prompt.value = explainRes.humanReadable
          } else {
            generatedResult.value.explanation = 'คำสั่ง SQL โดยตรง'
          }
        } catch {
          generatedResult.value.explanation = 'คำสั่ง SQL โดยตรง'
        }
      }
    } else {
      generatedResult.value.status = 'error'
      generatedResult.value.dbError = response.error
    }
  } catch (e: any) {
    generatedResult.value.status = 'error'
    generatedResult.value.dbError = e?.data?.message || e?.message || 'Database execution failed'
  } finally {
    isFetching.value = false
  }
}

const generateSql = async () => {
  if (!prompt.value) return

  isGenerating.value = true
  isCancelled.value = false
  isOptimized.value = false
  originalSql.value = null
  optimizationExplanation.value = null
  showOriginalSql.value = false
  generatedResult.value = null
  error.value = null
  showPreview.value = false
  liveSteps.value = []
  validateResult.value = null
  sqlReady.value = false
  editableSql.value = ''
  isExplanationOpen.value = false
  activeTab.value = 1
  isAnalysisPanelOpen.value = true
  isSqlPanelOpen.value = true
  isResultFullscreen.value = true

  if (generateAbortController.value) {
    generateAbortController.value.abort()
  }
  generateAbortController.value = new AbortController()

  try {
    const response = await fetch('/api/ai-query/generate-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.value, contextData: uploadedData.value }),
      signal: generateAbortController.value.signal
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.statusMessage || `HTTP ${response.status}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim()
        if (line.startsWith('data: ')) {
          try { handleStreamEvent(JSON.parse(line.slice(6))) } catch {}
        }
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      error.value = 'ยกเลิกการทำงานแล้ว (Cancelled by user)'
      return
    }
    console.error(e)
    error.value = e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI หรือ Database ล้มเหลว'
  } finally {
    isGenerating.value = false
    generateAbortController.value = null
  }
}

const optimizeSql = async () => {
  if (!generatedResult.value?.sql || isOptimizing.value) return
  
  isOptimizing.value = true
  try {
    const response = await $fetch<any>('/api/ai-query/optimize', {
      method: 'POST',
      body: { 
        sql: generatedResult.value.sql,
        explanation: generatedResult.value.explanation
      }
    })
    
    if (response.success) {
      originalSql.value = generatedResult.value.sql
      generatedResult.value.sql = response.optimizedSql
      if (response.optimizationExplanation) {
        optimizationExplanation.value = response.optimizationExplanation
      }
      if (response.modelUsed) {
        generatedResult.value.optimizeModelUsed = response.modelUsed
      }
      isOptimized.value = true
      toast.success('ปรับปรุงสำเร็จ', 'AI ได้ปรับปรุง SQL ให้ทำงานได้เร็วขึ้นแล้ว')
    } else {
      toast.error('ไม่สามารถปรับปรุงได้', response.error || 'เกิดข้อผิดพลาดในการปรับปรุง SQL')
    }
  } catch (e: any) {
    console.error(e)
    toast.error('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้')
  } finally {
    isOptimizing.value = false
  }
}

const cancelGenerate = () => {
  if (generateAbortController.value) {
    generateAbortController.value.abort()
    isCancelled.value = true
    isResultFullscreen.value = false
    liveSteps.value = []
  }
}

const regenerateExplanation = async () => {
  if (!editableSql.value || isRegeneratingExplanation.value) return
  isRegeneratingExplanation.value = true
  try {
    const res = await $fetch<any>('/api/ai-query/explain-sql', {
      method: 'POST',
      body: { sql: editableSql.value }
    })
    if (res.success && generatedResult.value) {
      generatedResult.value.explanation = res.explanation
      toast.success('สร้างใหม่สำเร็จ', 'AI Analysis Summary อัปเดตตาม SQL ที่แก้ไขแล้ว')
    } else {
      toast.error('ไม่สำเร็จ', res.error || 'ไม่สามารถสร้าง AI Analysis ได้')
    }
  } catch (e: any) {
    toast.error('เกิดข้อผิดพลาด', e.message || 'ไม่สามารถเชื่อมต่อ AI ได้')
  } finally {
    isRegeneratingExplanation.value = false
  }
}

const revertToOriginalSql = () => {
  if (originalSql.value && generatedResult.value) {
    generatedResult.value.sql = originalSql.value
    isOptimized.value = false
    optimizationExplanation.value = null
    originalSql.value = null
    showOriginalSql.value = false
    toast.info('คืนค่าเดิม', 'กลับไปใช้คำสั่ง SQL เดิมก่อนการปรับปรุงแล้ว')
  }
}

const requestApproval = async (skipDownload: boolean = false) => {
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
        ownerVtigerId: csvOwnerVtigerId.value || null,
        expiresAt: csvExpiresAt.value ? new Date(csvExpiresAt.value + 'T23:59:59').toISOString() : null,
        skipEmail: csvSkipEmail.value,
      }
    })
    
    if (response.success) {
      if (response.autoApproved) {
        // เริ่มดาวน์โหลดไฟล์ทันที (สำหรับ Admin)
        if (isAdmin.value && response.requestId && !skipDownload) {
          const fn = (csvFilename.value || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙\s_-]/g, '').trim().replace(/\s+/g, '_') || 'AI_Export'
          const ownerParam = csvOwnerVtigerId.value ? `&ownerVtigerId=${csvOwnerVtigerId.value}` : ''
          window.location.href = `/api/ai-query/export?id=${response.requestId}&filename=${encodeURIComponent(fn)}${ownerParam}`
        }
        // แสดง success state ใน modal แทนการปิดทันที
        csvSuccessDone.value = true
        isRequestModalOpen.value = false
      } else {
        toast.success('ส่งคำขอสำเร็จ', 'ส่งคำขออนุมัติไปยังหัวหน้างานเรียบร้อยแล้ว!')
        isCsvConfirmModalOpen.value = false
        isRequestModalOpen.value = false
        prompt.value = ''
        requestReason.value = ''
        generatedResult.value = null
      }
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

const openManualSqlEditor = () => {
  if (!generatedResult.value) {
    generatedResult.value = { sql: '', explanation: 'แก้ไข SQL ด้วยตัวเอง (Manual Query)' }
  }
  isSqlModalOpen.value = true
  startEditingSql()
}

const cancelEditingSql = () => {
  isEditingSql.value = false
  sqlModalError.value = ''
}

const submitDirectSql = async () => {
  if (!directSql.value.trim() || isUpdatingSql.value) return

  isUpdatingSql.value = true
  directSqlError.value = ''
  sqlFixSuggestion.value = null
  editableSql.value = formatSql(directSql.value)
  generatedResult.value = { sql: directSql.value, explanation: 'กำลังวิเคราะห์คำสั่ง SQL...', status: 'success' }
  showPreview.value = false
  isResultFullscreen.value = true
  activeTab.value = 1

  try {
    const [previewRes, explainRes] = await Promise.all([
      $fetch<any>('/api/ai-query/preview', {
        method: 'POST',
        body: { query: directSql.value }
      }),
      $fetch<any>('/api/ai-query/explain-sql', {
        method: 'POST',
        body: { sql: directSql.value }
      })
    ])

    if (previewRes.success) {
      generatedResult.value.previewData = previewRes.data
      generatedResult.value.previewCount = previewRes.totalCount
      generatedResult.value.status = 'success'
      generatedResult.value.dbError = null
      showPreview.value = true
      previewSearch.value = ''
      showAllRows.value = false
      allRowsData.value = []

      if (explainRes.success) {
        generatedResult.value.explanation = explainRes.explanation
        prompt.value = explainRes.humanReadable
      } else {
        generatedResult.value.explanation = 'คำสั่ง SQL โดยตรง'
        prompt.value = 'คำสั่ง SQL โดยตรง'
      }

      toast.success('สำเร็จ', `พบข้อมูล ${(previewRes.totalCount ?? 0).toLocaleString()} รายการ`)
      activeTab.value = 3
    } else {
      const errMsg = previewRes.error || 'SQL ไม่ถูกต้อง'
      directSqlError.value = errMsg
      generatedResult.value.dbError = errMsg
      generatedResult.value.status = 'error'
      generatedResult.value.explanation = `SQL Error: ${errMsg}`
      activeTab.value = 2
      fetchSqlFix(directSql.value, errMsg)
    }
  } catch (e: any) {
    const errMsg = e?.data?.message || e?.message || 'ไม่สามารถรันคำสั่ง SQL นี้ได้'
    directSqlError.value = errMsg
    generatedResult.value.dbError = errMsg
    generatedResult.value.status = 'error'
    generatedResult.value.explanation = `SQL Error: ${errMsg}`
    activeTab.value = 2
    fetchSqlFix(directSql.value, errMsg)
  } finally {
    isUpdatingSql.value = false
  }
}

const fetchSqlFix = async (sqlText: string, errorMsg: string) => {
  isFixingSql.value = true
  sqlFixSuggestion.value = null
  sqlFixStatus.value = 'กำลังวิเคราะห์โครงสร้าง DB...'
  try {
    const response = await fetch('/api/ai-query/fix-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: sqlText,
        error: errorMsg,
        schemaContext: generatedResult.value?.schemaContext || ''
      })
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const processFixDirectEvent = (ev: any) => {
      if (ev.type === 'tool_start') {
        sqlFixStatus.value = toolStatusText(ev.tool, ev.args)
      } else if (ev.type === 'tool_done') {
        sqlFixStatus.value = 'กำลังวิเคราะห์...'
      } else if (ev.type === 'done' && ev.suggestion) {
        sqlFixSuggestion.value = ev.suggestion
      } else if (ev.type === 'error') {
        sqlFixSuggestion.value = { cause: ev.message || 'เกิดข้อผิดพลาด', fix: 'กรุณาลองใหม่', fixedSql: null }
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.replace(/^data:\s*/, '').trim()
        if (!line) continue
        try { processFixDirectEvent(JSON.parse(line)) } catch { /* skip */ }
      }
    }
    if (buffer.trim()) {
      const line = buffer.replace(/^data:\s*/, '').trim()
      if (line) { try { processFixDirectEvent(JSON.parse(line)) } catch { /* skip */ } }
    }
  } catch (err: any) {
    sqlFixSuggestion.value = { cause: err?.message || 'เกิดข้อผิดพลาด', fix: 'กรุณาลองใหม่', fixedSql: null }
  } finally {
    isFixingSql.value = false
    sqlFixStatus.value = ''
  }
}

const applyFixedSql = () => {
  if (!sqlFixSuggestion.value?.fixedSql) return
  directSql.value = sqlFixSuggestion.value.fixedSql
  directSqlError.value = ''
  sqlFixSuggestion.value = null
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
      if (!generatedResult.value) {
        generatedResult.value = { explanation: 'แก้ไข SQL ด้วยตัวเอง (Manual Query)' }
      }
      generatedResult.value.sql = editedSql.value
      generatedResult.value.previewData = response.data
      generatedResult.value.previewCount = response.totalCount
      generatedResult.value.status = 'success'
      generatedResult.value.dbError = null
      showPreview.value = true
      previewSearch.value = ''
      showAllRows.value = false
      allRowsData.value = []
      activeTab.value = 3

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

const runDraftQuery = async () => {
  if (!generatedResult.value?.sql) return
  
  if (isUpdatingSql.value) {
    if (previewAbortController.value) {
      previewAbortController.value.abort()
      isUpdatingSql.value = false
      toast.info('ยกเลิกแล้ว', 'ยกเลิกการดึงข้อมูลตามที่คุณขอแล้ว')
    }
    return
  }
  
  isUpdatingSql.value = true
  previewAbortController.value = new AbortController()
  
  try {
    const response = await $fetch<any>('/api/ai-query/preview', {
      method: 'POST',
      body: { query: generatedResult.value.sql },
      signal: previewAbortController.value.signal
    })
    
    if (response.success) {
      generatedResult.value.previewData = response.data
      generatedResult.value.previewCount = response.totalCount
      generatedResult.value.status = 'success'
      showPreview.value = true
      previewSearch.value = ''
      showAllRows.value = false
      allRowsData.value = []
      activeTab.value = 3

      toast.success('ดึงข้อมูลสำเร็จ', 'ระบบประมวลผลข้อมูลตามคำสั่ง SQL เรียบร้อยแล้ว')

      // Auto-scroll to result
      setTimeout(() => {
        resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else {
      generatedResult.value.status = 'error'
      generatedResult.value.dbError = response.error
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return
    generatedResult.value.status = 'error'
    generatedResult.value.dbError = e?.data?.message || e?.message || 'Database execution failed'
  } finally {
    isUpdatingSql.value = false
    previewAbortController.value = null
  }
}



// โหลดค่ากำหนดพื้นฐานจากระบบ
// SQL Formatter & Highlighter Logic (From approvals.vue)
const formatSql = (sqlStr: string) => {
  if (!sqlStr) return ''
  try {
    return format(sqlStr, {
      language: 'mysql',
      tabWidth: 2,
      useTabs: false,
      keywordCase: 'upper',
      dataTypeCase: 'upper',
      functionCase: 'upper',
      indentStyle: 'standard',
      logicalOperatorNewline: 'before',
      expressionWidth: 60,
    })
  } catch {
    return sqlStr
  }
}

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Parse MySQL error message → extract the problematic token to highlight in red
const extractErrorToken = (errorMsg: string): string | null => {
  if (!errorMsg) return null
  let m = errorMsg.match(/Unknown column '([^']+)'/i)
  if (m) return m[1] ?? null
  m = errorMsg.match(/Table '[^.]*\.([^']+)' doesn't exist/i)
  if (m) return m[1] ?? null
  m = errorMsg.match(/Table '([^']+)' doesn't exist/i)
  if (m) return m[1]?.split('.').pop() ?? null
  m = errorMsg.match(/near '([^']+)'/i)
  if (m) return m[1]?.split(/\s+/)[0]?.trim() || null
  return null
}

// Highlight only — no formatting (used for editor overlay where text must match textarea exactly)
const highlightOnlySql = (sqlStr: string, errorToken?: string | null) => {
  if (!sqlStr) return ''
  let r = escapeHtml(sqlStr)

  // Step 1: protect string literals so keywords inside strings are not highlighted
  const strings: string[] = []
  r = r.replace(/'([^']*)'/g, (m) => { strings.push(m); return `\x01S${strings.length - 1}\x01` })

  // Step 1b: mark error token before other highlighting so it survives untouched
  if (errorToken) {
    const escapedTok = escapeHtml(errorToken).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    r = r.replace(new RegExp(escapedTok, 'gi'), '\x02$&\x03')
  }

  // Step 2: highlight keywords using a single combined regex (multi-word listed first → matched before sub-words)
  const kwList = [
    'IS NOT NULL', 'IS NULL', 'NOT IN', 'GROUP BY', 'ORDER BY',
    'LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN', 'CROSS JOIN',
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'LIMIT', 'OFFSET', 'AND', 'OR', 'IN', 'NOT',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'IFNULL', 'IF',
    'AS', 'DISTINCT', 'HAVING', 'BETWEEN', 'LIKE', 'DESC', 'ASC',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'TRUE', 'FALSE',
    'CONCAT', 'DATE', 'NOW', 'YEAR', 'MONTH', 'DAY',
  ]
  const kwPattern = new RegExp(`\\b(${kwList.join('|')})\\b`, 'g')
  r = r.replace(kwPattern, '<span class="sql-hl-kw">$1</span>')

  // Step 3: highlight numbers (not inside strings, not adjacent to alpha)
  r = r.replace(/(?<![a-zA-Z_])\b(\d+)\b/g, '<span class="sql-hl-num">$1</span>')

  // Step 4: restore string literals with styling
  r = r.replace(/\x01S(\d+)\x01/g, (_, i) => `<span class="sql-hl-str">${escapeHtml(strings[parseInt(i as string)] ?? '')}</span>`)

  // Step 5: restore error token with red styling
  r = r.replace(/\x02([^\x03]*)\x03/g, '<span class="sql-hl-err">$1</span>')

  return r
}

const highlightOnlySqlWithDiff = (editedSql: string, errorToken?: string | null): string => {
  if (!editedSql) return ''
  const originalFormatted = formatSql(generatedResult.value?.sql ?? '')
  const origLineSet = new Set(
    originalFormatted.split('\n').map(l => l.trim()).filter(Boolean)
  )
  return editedSql.split('\n').map(line => {
    const highlighted = highlightOnlySql(line, errorToken)
    const isChanged = line.trim() !== '' && !origLineSet.has(line.trim())
    return isChanged
      ? `<span class="sql-hl-diff">${highlighted}</span>`
      : highlighted
  }).join('\n')
}

// Diff highlight — format + highlight + ไฮไลน์บรรทัดที่เปลี่ยน
// baselineSql: SQL ต้นฉบับที่ใช้เปรียบเทียบ (default = generatedResult.sql)
const highlightSqlWithDiff = (fixedSql: string, baselineSql?: string): string => {
  if (!fixedSql) return ''
  const formattedFixed = formatSql(fixedSql)
  const baseline = baselineSql ?? generatedResult.value?.sql ?? ''
  const formattedOriginal = formatSql(baseline)
  const origLineSet = new Set(
    formattedOriginal.split('\n').map(l => l.trim()).filter(Boolean)
  )
  return formattedFixed.split('\n').map(line => {
    const highlighted = highlightOnlySql(line)
    const isNew = line.trim() !== '' && !origLineSet.has(line.trim())
    return isNew
      ? `<span class="sql-hl-diff">${highlighted}</span>`
      : highlighted
  }).join('\n')
}

const syncHighlightScroll = () => {
  if (sqlHighlightRef.value && sqlEditorRef.value) {
    sqlHighlightRef.value.scrollTop = sqlEditorRef.value.scrollTop
    sqlHighlightRef.value.scrollLeft = sqlEditorRef.value.scrollLeft
  }
}

const syncDirectSqlHighlightScroll = () => {
  if (directSqlHighlightRef.value && directSqlEditorRef.value) {
    directSqlHighlightRef.value.scrollTop = directSqlEditorRef.value.scrollTop
    directSqlHighlightRef.value.scrollLeft = directSqlEditorRef.value.scrollLeft
  }
}

const syncDirectSqlFsScroll = () => {
  if (directSqlFsHighlightRef.value && directSqlFsEditorRef.value) {
    directSqlFsHighlightRef.value.scrollTop = directSqlFsEditorRef.value.scrollTop
    directSqlFsHighlightRef.value.scrollLeft = directSqlFsEditorRef.value.scrollLeft
  }
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
  <div class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <header class="pb-2">
      <h2 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-[1.2] tracking-tight">
        ดึงข้อมูลด้วย<span class="text-gradient">ภาษาธรรมชาติ</span>
      </h2>
      <p class="text-slate-500 dark:text-slate-400 text-sm max-w-2xl leading-relaxed mt-1">
        เปลี่ยนคำถามภาษาไทยของคุณให้เป็นชุดคำสั่งดึงข้อมูลที่ปลอดภัยจากระบบ Vtiger CRM
      </p>
    </header>

    <!-- Input Box (Action Zone) -->
    <section class="rounded-xl overflow-hidden relative z-10 border border-indigo-100 dark:border-indigo-900/30 bg-slate-100/90 dark:bg-slate-900/90 shadow-lg">
      <form @submit.prevent="inputMode === 'sql' ? submitDirectSql() : generateSql()" class="p-5 md:p-6 space-y-4">

        <!-- แสดงคำขอทันทีทั้งตอน generate และตอน result พร้อม -->
        <div v-if="isGenerating || (generatedResult && !isGenerating)" class="flex items-center gap-3">
          <button
            v-if="generatedResult && !isGenerating"
            type="button"
            @click="isBackConfirmOpen = true"
            class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm shrink-0"
          >
            <ArrowRight class="w-3.5 h-3.5 rotate-180" />
            ย้อนกลับ
          </button>
          <span class="text-[11px] text-slate-400 font-medium truncate max-w-lg">{{ prompt }}</span>
        </div>

        <!-- Form Content — ซ่อนเมื่อกำลัง generate หรือ result พร้อมแล้ว -->
        <div v-show="!isGenerating && !generatedResult" class="space-y-4">

        <!-- Row 1: Mode Switcher + Label + Security Policy (same row) -->
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Mode Switcher -->
          <div class="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/70 rounded-2xl shrink-0">
            <button
              type="button"
              @click="inputMode = 'natural'; directSqlError = ''; sqlFixSuggestion = null"
              :class="inputMode === 'natural'
                ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
              class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest"
            >
              <Sparkles class="w-3.5 h-3.5" />
              ภาษาธรรมชาติ
            </button>
            <button
              type="button"
              @click="inputMode = 'sql'; directSqlError = ''; sqlFixSuggestion = null"
              :class="inputMode === 'sql'
                ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
              class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest"
            >
              <Terminal class="w-3.5 h-3.5" />
              SQL โดยตรง
            </button>
          </div>

          <!-- Label + Security Policy -->
          <div class="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400">
            <div class="flex items-center gap-2">
              <Search class="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span class="uppercase tracking-[0.15em]">คุณต้องการค้นหาข้อมูลอะไร?</span>
            </div>
            <div class="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-[10px] text-blue-700 dark:text-blue-300 font-black rounded-lg border border-blue-100 dark:border-blue-800/50">
              <ShieldCheck class="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span class="opacity-60 uppercase mr-0.5">Security Policy:</span>
              <span>จำกัดสูงสุด {{ (systemConfig?.maxResultsLimit || 0).toLocaleString() }} รายการ</span>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="relative group">
            <!-- Natural Language Input -->
            <textarea
              v-if="inputMode === 'natural'"
              ref="textareaRef"
              v-model="prompt"
              :readonly="isGenerating"
              @keydown.enter.exact.prevent="generateSql()"
              placeholder="เช่น ขอลูกค้าที่มียอดสั่งซื้อเกิน 1 แสนบาทในปีนี้ พร้อมเบอร์ติดต่อ... (Enter เพื่อประมวลผล)"
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] px-6 py-5 pr-14 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-[border-color,box-shadow,opacity] resize-y min-h-[160px] text-lg leading-relaxed shadow-inner disabled:opacity-50"
              :disabled="isGenerating"
            ></textarea>

            <!-- Direct SQL Input -->
            <div v-else class="relative">
              <div class="direct-sql-editor-wrap sql-editor-wrap rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 dark:focus-within:border-indigo-600 transition-colors overflow-hidden shadow-inner" style="min-height: 220px;">
                <pre ref="directSqlHighlightRef" aria-hidden="true" class="sql-editor-pre dark:!text-slate-200"
                     v-html="directSql ? highlightOnlySql(directSql) : ''"></pre>
                <textarea
                  ref="directSqlEditorRef"
                  v-model="directSql"
                  :readonly="isUpdatingSql"
                  @scroll="syncDirectSqlHighlightScroll"
                  @keydown.ctrl.enter.prevent="submitDirectSql()"
                  @paste.prevent="(e) => { const text = e.clipboardData?.getData('text') || ''; const el = e.target as HTMLTextAreaElement; const start = el.selectionStart ?? directSql.length; const end = el.selectionEnd ?? directSql.length; if (!directSql.trim()) { directSql = formatSql(text) || text } else { directSql = directSql.substring(0, start) + text + directSql.substring(end) } }"
                  placeholder="วางคำสั่ง SQL ที่นี่... (Ctrl+Enter เพื่อรัน)"
                  spellcheck="false" autocomplete="off"
                  class="sql-editor-textarea focus:outline-none disabled:opacity-50"
                  :style="sqlCaretStyle"
                  :disabled="isUpdatingSql"
                ></textarea>
              </div>

              <div class="absolute top-4 right-4 flex items-center gap-1 z-10">
                <template v-if="directSql">
                  <button
                    type="button"
                    @click="directSql = formatSql(directSql)"
                    :disabled="isUpdatingSql"
                    class="px-2.5 py-1.5 rounded-lg text-[10px] font-black text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all disabled:opacity-50 uppercase tracking-widest"
                    title="จัดรูปแบบ SQL (Format)"
                  >
                    Format
                  </button>
                  <button
                    type="button"
                    @click="directSql = ''; directSqlError = ''; sqlFixSuggestion = null"
                    :disabled="isUpdatingSql"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 transition-all disabled:opacity-50"
                    title="ล้าง SQL"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </template>
                <button
                  type="button"
                  @click="openSchemaModal()"
                  :disabled="isUpdatingSql"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all disabled:opacity-50"
                  title="สำรวจตารางและฟิลด์ (Schema Explorer)"
                >
                  <Table2 class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  @click="isDirectSqlFullscreen = true"
                  :disabled="isUpdatingSql"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all disabled:opacity-50"
                  title="ขยายเต็มจอ (Fullscreen SQL Editor)"
                >
                  <Maximize2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- File Input (Hidden) -->
            <input 
              type="file" 
              ref="fileInputRef" 
              class="hidden" 
              accept=".csv, .xlsx, .xls"
              @change="handleFileUpload"
            />

            <!-- Uploaded File Badge -->
            <div v-if="uploadedFileName" class="absolute left-6 bottom-5 flex flex-col items-start gap-2 animate-in slide-in-from-left-2 duration-300">
              <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-black rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span class="max-w-[200px] truncate">{{ uploadedFileName }}</span>
                <span class="opacity-50">({{ uploadedData?.length }} แถว)</span>
                <button @click="clearFile" type="button" class="ml-1 p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full transition-colors">
                  <X class="w-3 h-3" />
                </button>
              </div>
              <div v-if="uploadedData && uploadedData.length > DATA_CONTEXT_LIMIT" class="flex items-center gap-1.5 px-2 text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">
                <AlertTriangle class="w-3 h-3" />
                AI จะพิจารณาเฉพาะ {{ DATA_CONTEXT_LIMIT }} แถวแรกของไฟล์นี้
              </div>
              <div v-else class="px-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                ระบบจะส่งข้อมูลในไฟล์นี้ให้ AI ช่วยประมวลผล
              </div>
            </div>

            <div class="absolute right-5 bottom-5 flex items-center gap-2">
              <ClientOnly>
                <template v-if="inputMode === 'natural'">
                <button
                  type="button"
                  @click="triggerFileUpload"
                  :disabled="isGenerating || isParsingFile"
                  class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50"
                  title="แนบไฟล์ CSV หรือ Excel เพื่อใช้เป็นข้อมูลประกอบ"
                >
                  <Upload v-if="!isParsingFile" class="w-3.5 h-3.5" />
                  <Loader2 v-else class="w-3.5 h-3.5 animate-spin" />
                  {{ uploadedFileName ? 'เปลี่ยนไฟล์' : 'แนบไฟล์' }}
                </button>

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
                </template>
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
                <div class="text-amber-800 dark:text-amber-400 leading-relaxed prose prose-sm prose-amber dark:prose-invert prose-p:my-1 prose-markdown" v-html="renderedExplanation"></div>
                <button type="button" @click="handleClarification" class="mt-2 text-sm font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1.5 underline underline-offset-8 decoration-amber-500/30 hover:decoration-amber-500 transition-all">
                  ตกลง ฉันจะระบุข้อมูลใหม่
                  <ArrowRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </transition>
        
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
          <div class="flex flex-wrap gap-2 flex-1 min-w-0">
            <button
              v-for="text in suggestions"
              :key="text"
              type="button"
              @click="useSuggestion(text)"
              :disabled="isGenerating"
              class="text-[12px] font-bold px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {{ text }}
            </button>

            <!-- Favorites List -->
            <div v-if="favorites.length > 0" class="flex flex-wrap gap-2 items-center">
              <div class="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-2 hidden sm:block"></div>
              <div class="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-violet-100 dark:border-violet-800/50">
                <Star class="w-3 h-3 fill-violet-500" />
                Favorites
              </div>
              <div v-for="fav in favorites.slice(0, 5)" :key="fav.id" class="group relative">
                <button
                  type="button"
                  @click="useFavorite(fav)"
                  :disabled="isGenerating"
                  class="text-[12px] font-bold px-4 py-3 rounded-xl bg-violet-50/60 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white transition-all active:scale-95 border border-violet-200/60 dark:border-violet-800/50 shadow-sm backdrop-blur-sm disabled:opacity-30"
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
          
          <div class="flex flex-wrap items-center justify-end gap-2 shrink-0">

            <!-- Utility buttons -->
            <button
              @click="isTipsModalOpen = true"
              type="button"
              class="flex items-center gap-1.5 px-3 py-2 text-amber-600 dark:text-amber-400 text-xs font-bold hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
            >
              <Lightbulb class="w-3.5 h-3.5" />
              เทคนิคการถาม
            </button>
            <!-- Natural Language Mode Buttons -->
            <template v-if="inputMode === 'natural'">
              <button
                v-if="!isGenerating && isCancelled"
                type="button"
                @click="openManualSqlEditor"
                class="px-8 py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-[2rem] shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 uppercase tracking-widest text-sm border border-slate-200 dark:border-slate-700"
                title="เขียนคำสั่ง SQL ด้วยตัวเอง"
              >
                <Terminal class="w-6 h-6" />
                เขียน SQL เอง
              </button>

              <button
                v-if="!isGenerating"
                ref="submitBtnRef"
                type="submit"
                :disabled="!prompt"
                class="relative group px-10 py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-[2rem] shadow-2xl shadow-violet-500/40 hover:shadow-violet-500/60 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2.5 active:scale-95 shrink-0 overflow-hidden text-sm"
              >
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                <div class="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/20"></div>
                <Sparkles class="w-5 h-5 relative z-10 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
                <span class="relative z-10 tracking-wide">สร้างคำสั่ง SQL</span>
              </button>
              <div v-else class="flex items-center gap-3 shrink-0">
                <!-- สถานะกำลังประมวลผล -->
                <div class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <Loader2 class="w-4 h-4 animate-spin text-violet-500" />
                  <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">กำลังประมวลผล...</span>
                </div>
                <!-- ปุ่ม Stop -->
                <button
                  type="button"
                  @click="cancelGenerate"
                  class="relative group px-6 py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black rounded-2xl shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm border border-rose-500"
                  title="หยุดการประมวลผล"
                >
                  <Square class="w-4 h-4 fill-white" />
                  <span>หยุด</span>
                </button>
              </div>
              <!-- Mode badge -->
              <div class="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest"
                :class="currentGenerateMode === 'agentic'
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'">
                <Zap v-if="currentGenerateMode === 'agentic'" class="w-2.5 h-2.5" />
                <FileText v-else class="w-2.5 h-2.5" />
                {{ currentGenerateMode === 'agentic' ? 'Agentic' : 'Static' }}
              </div>
            </template>

            <!-- Direct SQL Mode Buttons -->
            <template v-else>
              <button
                v-if="directSql"
                type="button"
                @click="directSql = ''; directSqlError = ''"
                class="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                title="ล้าง SQL"
              >
                <X class="w-5 h-5" />
              </button>

              <button
                v-if="!isUpdatingSql"
                type="submit"
                :disabled="!directSql.trim()"
                class="relative group px-12 py-5 bg-gradient-to-r from-emerald-700 to-emerald-600 dark:from-emerald-600 dark:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-[2rem] shadow-2xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 overflow-hidden uppercase tracking-widest text-sm"
              >
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                <Terminal class="w-6 h-6 group-hover:scale-110 transition-transform" />
                รัน SQL
              </button>

              <button
                v-else
                type="button"
                @click="isUpdatingSql = false"
                class="relative group px-12 py-5 bg-gradient-to-r from-emerald-700 to-emerald-600 dark:from-emerald-600 dark:to-teal-600 text-white font-black rounded-[2rem] shadow-2xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0 overflow-hidden uppercase tracking-widest text-sm hover:opacity-90"
              >
                <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                <Loader2 class="w-5 h-5 relative z-10 animate-spin" />
                <span class="relative z-10">กำลังรัน... (กดเพื่อหยุด)</span>
              </button>
            </template>

          </div>
        </div>

        <!-- Direct SQL Error Alert -->
        <transition name="fade">
          <div v-if="directSqlError && inputMode === 'sql'" class="mt-6 space-y-3 animate-in slide-in-from-top-2 duration-300">
            <!-- Error Message -->
            <div class="p-5 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-2xl flex items-start gap-4">
              <div class="p-2 bg-white dark:bg-rose-900/30 rounded-xl shadow-sm border border-rose-100 dark:border-rose-800 shrink-0">
                <AlertCircle class="w-5 h-5 text-rose-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-rose-900 dark:text-rose-300 font-bold uppercase tracking-wider text-xs mb-1">SQL Error</p>
                <p class="text-rose-700 dark:text-rose-400 text-sm font-mono break-all">{{ directSqlError }}</p>
              </div>
            </div>

            <!-- AI Fix Loading -->
            <div v-if="isFixingSql" class="flex items-center gap-3 px-5 py-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
              <Loader2 class="w-4 h-4 text-amber-500 animate-spin shrink-0" />
              <p class="text-amber-700 dark:text-amber-400 text-sm font-medium">AI กำลังวิเคราะห์ error และแนะนำวิธีแก้ไข...</p>
            </div>

            <!-- AI Fix Suggestion -->
            <div v-if="sqlFixSuggestion && !isFixingSql"
              class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <!-- Header -->
              <div class="flex items-center gap-2 px-4 py-2.5 bg-amber-500 dark:bg-amber-600">
                <Sparkles class="w-4 h-4 text-white shrink-0" />
                <p class="text-xs font-black text-white uppercase tracking-widest">AI แนะนำวิธีแก้ไข</p>
              </div>
              <div class="p-4 space-y-3">
                <!-- Cause -->
                <div class="rounded-xl bg-rose-50 dark:bg-rose-900/15 border-l-4 border-rose-400 dark:border-rose-500 px-4 py-2.5">
                  <p class="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest mb-1">สาเหตุ</p>
                  <p class="text-sm text-rose-900 dark:text-rose-200 leading-relaxed">{{ sqlFixSuggestion.cause }}</p>
                </div>
                <!-- Fix -->
                <div class="rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border-l-4 border-emerald-400 dark:border-emerald-500 px-4 py-2.5">
                  <p class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">วิธีแก้ไข</p>
                  <p class="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">{{ sqlFixSuggestion.fix }}</p>
                </div>
                <!-- Fixed SQL -->
                <div v-if="sqlFixSuggestion.fixedSql" class="space-y-2">
                  <p class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">SQL ที่แก้ไขแล้ว</p>
                  <div class="relative bg-slate-950 rounded-xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-48 overflow-y-auto">
                    <pre class="whitespace-pre-wrap leading-relaxed">{{ sqlFixSuggestion.fixedSql }}</pre>
                  </div>
                  <button @click="applyFixedSql"
                    class="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all active:scale-95 uppercase tracking-widest shadow-md shadow-emerald-500/20">
                    <CheckCircle2 class="w-3.5 h-3.5" />
                    ใช้ SQL นี้
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>

        <!-- Inline Error Alert (Natural Language Mode) -->
        <transition name="fade">
          <div v-if="error && inputMode === 'natural'" class="mt-6 p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-3xl flex items-start gap-4 animate-in slide-in-from-top-2 duration-300">
            <div class="p-2 bg-white dark:bg-rose-900/30 rounded-xl shadow-sm border border-rose-100 dark:border-rose-800 shrink-0">
              <AlertCircle class="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <p class="text-rose-900 dark:text-rose-300 font-bold uppercase tracking-wider text-xs mb-1">AI Generation Failed</p>
              <p class="text-rose-700 dark:text-rose-400 text-sm font-medium">{{ error }}</p>
            </div>
          </div>
        </transition>
        
        </div><!-- end form content wrapper -->

      </form>
    </section>

    <!-- Tabbed Result Container -->
    <div v-if="isGenerating || isUpdatingSql || liveSteps.length || generatedResult" ref="resultSection"
         :class="isResultFullscreen
           ? 'result-fullscreen fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950 overflow-hidden'
           : 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-md overflow-hidden'">

      <!-- Fullscreen prompt bar — บนสุด เหนือ Tab Bar -->
      <div v-if="isResultFullscreen && generatedResult && !isGenerating && !isUpdatingSql"
           class="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          @click="isBackConfirmOpen = true"
          class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm shrink-0"
        >
          <ArrowRight class="w-3.5 h-3.5 rotate-180" />
          ย้อนกลับ
        </button>
        <span class="text-[11px] text-slate-400 font-medium truncate">"{{ prompt }}"</span>
      </div>

      <!-- Tab Bar -->
      <div class="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70">
        <button @click="activeTab = 1"
          :class="activeTab === 1
            ? 'border-b-2 border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-950'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          class="flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider transition-all">
          <Loader2 v-if="isGenerating || isUpdatingSql" class="w-3.5 h-3.5 animate-spin text-blue-500" />
          <CheckCircle2 v-else-if="generatedResult" class="w-3.5 h-3.5 text-emerald-500" />
          <BrainCircuit v-else class="w-3.5 h-3.5" />
          กำลังสร้าง SQL
        </button>

        <button @click="generatedResult && (activeTab = 2)"
          :disabled="!generatedResult"
          :class="activeTab === 2
            ? 'border-b-2 border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-950'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed'"
          class="flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider transition-all">
          <AlertCircle v-if="generatedResult?.dbError" class="w-3.5 h-3.5 text-rose-500" />
          <Terminal v-else class="w-3.5 h-3.5" />
          ตรวจสอบ SQL
        </button>

        <button @click="generatedResult?.previewData && (activeTab = 3)"
          :disabled="!generatedResult?.previewData"
          :class="activeTab === 3
            ? 'border-b-2 border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-950'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed'"
          class="flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider transition-all">
          <Database class="w-3.5 h-3.5" />
          ผลลัพธ์
          <span v-if="generatedResult?.previewData"
            class="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[9px] font-black">
            {{ generatedResult.previewCount.toLocaleString() }}
          </span>
        </button>

        <!-- Stop button — แสดงขณะ generating -->
        <button
          v-if="isGenerating"
          type="button"
          @click="cancelGenerate"
          class="ml-auto mr-2 my-auto flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black rounded-xl shadow-sm shadow-rose-500/30 transition-all active:scale-95"
          title="หยุดการประมวลผล"
        >
          <Square class="w-3.5 h-3.5 fill-white" />
          หยุด
        </button>

        <!-- Fullscreen toggle -->
        <button
          @click="isResultFullscreen = !isResultFullscreen"
          :class="isGenerating ? 'mr-2' : 'ml-auto mr-2'"
          class="my-auto p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          :title="isResultFullscreen ? 'ย่อขนาด' : 'ขยายเต็มจอ'"
        >
          <Maximize2 v-if="!isResultFullscreen" class="w-4 h-4" />
          <Minimize2 v-else class="w-4 h-4" />
        </button>
      </div>

      <!-- ── Tab 1: Live Generation ── -->
      <div v-show="activeTab === 1" class="p-4 space-y-1.5">
        <div class="flex items-center gap-2 mb-2">
          <BrainCircuit v-if="!isUpdatingSql" class="w-4 h-4 text-indigo-500 shrink-0" />
          <Terminal v-else class="w-4 h-4 text-emerald-500 shrink-0" />
          <span class="text-[10px] font-black uppercase tracking-[0.2em]"
            :class="isUpdatingSql ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-700 dark:text-indigo-400'">
            {{ isUpdatingSql ? 'กำลังรัน SQL โดยตรง' : 'AI กำลังสำรวจฐานข้อมูล' }}
          </span>
        </div>
        <!-- prompt box -->
        <div v-if="!isEditingPromptInTab"
             @click="isEditingPromptInTab = true; promptEditBuffer = prompt"
             class="cursor-text px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 text-sm text-slate-600 dark:text-slate-300 font-medium leading-snug transition-colors group flex items-start gap-2"
             title="คลิกเพื่อแก้ไขคำขอ">
          <span class="flex-1 line-clamp-2">"{{ prompt }}"</span>
          <Edit3 class="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0 mt-0.5 transition-colors" />
        </div>
        <div v-else class="space-y-2">
          <textarea
            v-model="promptEditBuffer"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-blue-400 dark:border-blue-500 text-sm text-slate-700 dark:text-slate-200 font-medium leading-snug focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[60px]"
            @keydown.enter.exact.prevent="prompt = promptEditBuffer; isEditingPromptInTab = false; generateSql()"
            autofocus
          ></textarea>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="prompt = promptEditBuffer; isEditingPromptInTab = false; generateSql()"
              :disabled="!promptEditBuffer.trim() || isGenerating"
              class="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all active:scale-95 uppercase tracking-widest"
            >
              <Sparkles class="w-3.5 h-3.5" />
              ส่งคำขอเพื่อสร้างคำสั่ง SQL ใหม่
            </button>
            <button
              type="button"
              @click="isEditingPromptInTab = false; promptEditBuffer = ''"
              class="px-3 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </div>
        <!-- steps -->
        <div v-for="(step, i) in liveSteps" :key="i" class="flex items-center gap-3">
          <Loader2 v-if="step.status === 'running'" class="w-4 h-4 animate-spin text-blue-500 shrink-0" />
          <CheckCircle2 v-else class="w-4 h-4 text-emerald-500 shrink-0" />
          <span class="text-sm text-slate-700 dark:text-slate-300 flex-1">{{ toolLabel(step.tool, step.args) }}</span>
          <span v-if="step.stepElapsed !== undefined" class="text-[10px] text-slate-400 font-mono">{{ step.stepElapsed }}ms</span>
        </div>
        <!-- Direct SQL loading indicator -->
        <div v-if="isUpdatingSql" class="space-y-3 py-2">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <Loader2 class="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p class="text-sm font-bold text-slate-700 dark:text-slate-200">กำลังรัน SQL...</p>
              <p class="text-[11px] text-slate-400 font-mono truncate max-w-xs">{{ directSql.split('\n')[0] }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Loader2 class="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400" />
            </div>
            <p class="text-sm text-slate-500">วิเคราะห์คำสั่ง SQL ด้วย AI...</p>
          </div>
        </div>

        <!-- generating/validating indicators -->
        <div v-if="isGenerating && sqlReady && !validateResult" class="flex items-center gap-3">
          <Loader2 class="w-4 h-4 animate-spin text-amber-500 shrink-0" />
          <span class="text-sm text-slate-500">กำลังตรวจสอบ SQL...</span>
        </div>
        <div v-else-if="isGenerating && !sqlReady" class="flex items-center gap-3">
          <Loader2 class="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
          <span class="text-sm text-slate-500">กำลังสร้างคำสั่ง SQL...</span>
        </div>
        <!-- validate result -->
        <div v-if="validateResult" class="flex items-center gap-3 mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
          <CheckCircle2 v-if="validateResult.ok" class="w-4 h-4 text-emerald-500 shrink-0" />
          <AlertCircle v-else class="w-4 h-4 text-red-500 shrink-0" />
          <span class="text-sm flex-1" :class="validateResult.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
            {{ validateResult.ok ? 'SQL syntax ถูกต้อง — พร้อมดึงข้อมูล' : `SQL มีข้อผิดพลาด: ${validateResult.error}` }}
          </span>
          <span v-if="validateResult.elapsed" class="text-[10px] text-slate-400 font-mono ml-auto">{{ validateResult.elapsed }}ms</span>
        </div>
      </div>

      <!-- ── Tab 2: AI Analysis + SQL Editor ── -->
      <div v-show="activeTab === 2" class="tab2-content">
        <div v-if="generatedResult && (generatedResult.status === 'success' || generatedResult.status === 'error')"
             class="panel-container flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 min-h-[300px] max-h-[65vh]">

          <!-- Left: AI Analysis Summary — ซ่อนได้จริง -->
          <div v-show="isAnalysisPanelOpen"
               class="md:flex-1 min-h-0 flex flex-col transition-all duration-200 overflow-hidden border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
            <div class="w-full flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <span class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                <Wand2 class="w-3.5 h-3.5" /> AI Analysis Summary
              </span>
              <div class="flex items-center gap-2">
                <!-- Regenerate button — แสดงเมื่อ SQL ถูกแก้ไข -->
                <button
                  v-if="isSqlEditedFromOriginal"
                  @click="regenerateExplanation"
                  :disabled="isRegeneratingExplanation"
                  class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  title="สร้าง AI Analysis ใหม่จาก SQL ที่แก้ไข"
                >
                  <Loader2 v-if="isRegeneratingExplanation" class="w-3 h-3 animate-spin" />
                  <RotateCcw v-else class="w-3 h-3" />
                  {{ isRegeneratingExplanation ? 'กำลังสร้าง...' : 'Regenerate' }}
                </button>
                <button @click="copyExplanation"
                  class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95">
                  <Copy v-if="!isExplanationCopied" class="w-3 h-3" />
                  <CheckCircle2 v-else class="w-3 h-3 text-emerald-500" />
                  {{ isExplanationCopied ? 'Copied' : 'Copy' }}
                </button>
                <button type="button" @click="isAnalysisPanelOpen = false"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  title="ซ่อน AI Analysis">
                  <PanelLeftClose class="w-4 h-4" />
                </button>
              </div>
            </div>
            <div class="p-4 flex-1 min-h-0 overflow-y-auto">
              <div class="text-slate-700 dark:text-slate-200 text-sm leading-relaxed prose prose-slate dark:prose-invert prose-p:my-2 prose-ul:my-2 max-w-none prose-markdown"
                   v-html="renderedExplanation"></div>
            </div>
          </div>

          <!-- Right: SQL Editor -->
          <div class="sql-panel md:flex-1 min-h-0 flex flex-col transition-all duration-200 overflow-x-hidden">
            <div class="w-full flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div class="flex items-center gap-2">
                <!-- ปุ่มแสดง AI Analysis เมื่อซ่อนอยู่ -->
                <button v-if="!isAnalysisPanelOpen"
                  type="button" @click="isAnalysisPanelOpen = true"
                  class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all active:scale-95"
                  title="แสดง AI Analysis Summary">
                  <PanelLeftOpen class="w-3.5 h-3.5" /> AI Analysis
                </button>
                <span class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  <Terminal class="w-3.5 h-3.5" /> SQL Editor
                </span>
              </div>
              <div class="flex items-center gap-2">
                <!-- Format button — แสดงเมื่อ SQL ถูกแก้ไข -->
                <button v-if="editableSql && editableSql !== formatSql(generatedResult?.sql || '')"
                  @click.stop="editableSql = formatSql(editableSql)"
                  class="px-2 py-1 rounded text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-all active:scale-95 flex items-center gap-1"
                  title="จัด format SQL">
                  <LayoutGrid class="w-3 h-3" /> Format
                </button>
                <button @click="isSqlChatOpen = !isSqlChatOpen"
                  class="px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border transition-all active:scale-95"
                  :class="isSqlChatOpen
                    ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800'
                    : 'text-slate-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:text-violet-600'"
                  title="ถามเกี่ยวกับ SQL นี้">
                  <MessageSquarePlus class="w-3 h-3" /> แชต
                </button>
                <button @click="openSchemaModal()"
                  class="px-2 py-1 rounded text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-all active:scale-95 flex items-center gap-1"
                  title="สำรวจตารางและฟิลด์ (Schema Explorer)">
                  <Table2 class="w-3 h-3" /> Schema
                </button>
                <button @click.stop="editableSql = formatSql(generatedResult.sql)"
                  class="px-2 py-1 rounded text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-all active:scale-95 flex items-center gap-1">
                  <RotateCcw class="w-3 h-3" /> Reset
                </button>
                <button @click.stop="copySql"
                  class="px-2 py-1 rounded text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-blue-600 transition-all active:scale-95 flex items-center gap-1">
                  <Copy v-if="!isCopied" class="w-3 h-3" />
                  <CheckCircle2 v-else class="w-3 h-3 text-emerald-500" />
                  {{ isCopied ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
            <div class="sql-panel-content p-3 flex-1 overflow-y-auto" :class="isSqlEditorExpanded ? 'flex flex-col overflow-hidden' : ''">
              <!-- SQL Error in editor panel -->
              <div v-if="generatedResult.status === 'error' && generatedResult.dbError" class="mb-3 space-y-2">
                <!-- Error banner + action buttons -->
                <div class="p-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-lg">
                  <p class="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">SQL Error</p>
                  <p class="text-xs font-mono text-rose-700 dark:text-rose-300 break-all">{{ generatedResult.dbError }}</p>
                  <div class="flex flex-wrap gap-2 mt-2">
                    <button @click="fetchSqlFixForTab" :disabled="isFixingSqlInTab"
                      class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-[10px] font-black rounded-lg transition-all active:scale-95 uppercase tracking-widest">
                      <Loader2 v-if="isFixingSqlInTab" class="w-3 h-3 animate-spin" />
                      <Sparkles v-else class="w-3 h-3" />
                      {{ isFixingSqlInTab ? (sqlFixStatus || 'AI กำลังวิเคราะห์...') : 'Fix ด้วย AI' }}
                    </button>
                  </div>
                </div>
                <!-- AI Fix Loading -->
                <div v-if="isFixingSqlInTab"
                  class="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                  <Loader2 class="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                  <p class="text-amber-700 dark:text-amber-400 text-xs font-medium">AI กำลังวิเคราะห์ error และแนะนำวิธีแก้ไข...</p>
                </div>
                <!-- AI Fix Suggestion -->
                <div v-if="sqlFixInTabSuggestion && !isFixingSqlInTab"
                  class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                  <!-- Header -->
                  <div class="flex items-center gap-2 px-3 py-2 bg-amber-500 dark:bg-amber-600">
                    <Sparkles class="w-3.5 h-3.5 text-white shrink-0" />
                    <p class="text-[10px] font-black text-white uppercase tracking-widest">AI แนะนำวิธีแก้ไข</p>
                  </div>
                  <div class="p-3 space-y-2">
                    <!-- สาเหตุ -->
                    <div class="rounded-lg bg-rose-50 dark:bg-rose-900/15 border-l-4 border-rose-400 dark:border-rose-500 px-3 py-2">
                      <p class="text-[9px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest mb-1">สาเหตุ</p>
                      <p class="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">{{ sqlFixInTabSuggestion.cause }}</p>
                    </div>
                    <!-- วิธีแก้ไข -->
                    <div class="rounded-lg bg-emerald-50 dark:bg-emerald-900/15 border-l-4 border-emerald-400 dark:border-emerald-500 px-3 py-2">
                      <p class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">วิธีแก้ไข</p>
                      <p class="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">{{ sqlFixInTabSuggestion.fix }}</p>
                    </div>
                    <!-- SQL ที่แก้ไขแล้ว -->
                    <div v-if="sqlFixInTabSuggestion.fixedSql" class="space-y-2">
                      <p class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">SQL ที่แก้ไขแล้ว</p>
                      <div class="relative">
                        <div class="bg-slate-50 dark:bg-slate-950 rounded-lg p-3 font-mono text-xs overflow-auto border border-slate-200 dark:border-slate-800 resize-y"
                             :style="isFixSqlExpanded ? 'min-height:6rem; height:auto;' : 'min-height:6rem; height:10rem;'">
                          <pre class="whitespace-pre-wrap leading-relaxed" v-html="highlightSqlWithDiff(sqlFixInTabSuggestion.fixedSql ?? '')"></pre>
                        </div>
                        <button @click.stop="isFixSqlExpanded = !isFixSqlExpanded"
                          class="absolute top-1 right-1 p-0.5 rounded bg-white/90 dark:bg-slate-900/90 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all"
                          :title="isFixSqlExpanded ? 'ย่อ' : 'ขยาย'">
                          <Maximize2 v-if="!isFixSqlExpanded" class="w-3 h-3" />
                          <Minimize2 v-else class="w-3 h-3" />
                        </button>
                      </div>
                      <div class="flex items-center gap-2">
                        <button @click="applyAiFixInTab"
                          class="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition-all active:scale-95 uppercase tracking-widest">
                          <CheckCircle2 class="w-3.5 h-3.5" />
                          Confirm — ใช้ SQL นี้
                        </button>
                        <button @click="sqlFixInTabSuggestion = null; isFixSqlExpanded = false"
                          class="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-700 transition-all active:scale-95 uppercase tracking-widest">
                          <X class="w-3.5 h-3.5" />
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <!-- ปุ่มดึงข้อมูลอีกครั้ง — แสดงเมื่อ SQL ถูกแก้จากต้นฉบับ หรือยังมี error อยู่ (รวมหลัง AI fix ก่อน fetch ใหม่) -->
              <div v-if="isSqlEditedFromOriginal || generatedResult?.status === 'error'" class="mb-3">
                <button @click="fetchData" :disabled="isFetching"
                  class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black rounded-lg transition-all active:scale-95 uppercase tracking-widest">
                  <Loader2 v-if="isFetching" class="w-3 h-3 animate-spin" />
                  <Database v-else class="w-3 h-3" />
                  {{ isFetching ? 'กำลังดึง...' : 'ดึงข้อมูลอีกครั้ง' }}
                </button>
              </div>
              <div class="sql-editor-wrap rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-400 transition-colors" :class="isSqlEditorExpanded ? 'sql-editor-wrap-expanded' : ''">
                <button v-if="!isResultFullscreen" @click="isSqlEditorExpanded = !isSqlEditorExpanded"
                  class="absolute top-1.5 right-1.5 z-20 p-1 rounded bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 transition-all backdrop-blur-sm"
                  :title="isSqlEditorExpanded ? 'ย่อ SQL Editor' : 'ขยาย SQL Editor'">
                  <component :is="isSqlEditorExpanded ? Minimize2 : Maximize2" class="w-3 h-3" />
                </button>
                <pre ref="sqlHighlightRef" aria-hidden="true" class="sql-editor-pre dark:!text-slate-200"
                     v-html="isSqlEditedFromOriginal ? highlightOnlySqlWithDiff(editableSql, extractErrorToken(generatedResult?.dbError)) : highlightOnlySql(editableSql, extractErrorToken(generatedResult?.dbError))"></pre>
                <textarea ref="sqlEditorRef" v-model="editableSql" @scroll="syncHighlightScroll"
                  spellcheck="false" autocomplete="off"
                  class="sql-editor-textarea focus:outline-none"
                  :style="sqlCaretStyle"></textarea>
              </div>

            </div>
          </div>

          <!-- Right: Chat Panel (แสดงเมื่อ isSqlChatOpen) -->
          <div v-if="isSqlChatOpen"
               class="md:flex-1 flex flex-col transition-all duration-200 overflow-hidden border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800">
            <!-- Header -->
            <div class="w-full flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-violet-50/60 dark:bg-violet-900/10">
              <span class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-violet-600 dark:text-violet-400">
                <MessageSquarePlus class="w-3.5 h-3.5" /> ถามเกี่ยวกับ SQL นี้
              </span>
              <div class="flex items-center gap-1">
                <button type="button" @click="startNewChat" :disabled="sqlChatMessages.length === 0"
                  class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="ล้างประวัติแชตและเริ่มใหม่โดยใช้ SQL ปัจจุบัน">
                  <RotateCcw class="w-3 h-3" /> เริ่มแชตใหม่
                </button>
                <button type="button" @click="isSqlChatOpen = false"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  title="ปิดแชต">
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
            <!-- Messages -->
            <div ref="sqlChatScrollRef" class="flex-1 overflow-y-auto p-3 space-y-2 bg-white dark:bg-slate-900 min-h-0">
              <div v-if="sqlChatMessages.length === 0" class="text-center text-xs text-slate-400 py-8">
                พิมพ์คำถามเกี่ยวกับ SQL นี้<br>เช่น "ทำไมได้ 0 รายการ?" หรือ "เพิ่ม filter วันที่ด้วย"
              </div>
              <div v-for="(msg, i) in sqlChatMessages" :key="i" :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
                <div :class="msg.role === 'user'
                  ? 'max-w-[85%] px-3 py-2 bg-blue-600 text-white text-xs rounded-2xl rounded-tr-sm'
                  : 'max-w-[95%] px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-2xl rounded-tl-sm space-y-2'">
                  <p class="whitespace-pre-wrap leading-relaxed">{{ msg.text }}</p>
                  <div v-if="msg.updatedSql" class="mt-2 space-y-1.5">
                    <div class="relative">
                      <div class="bg-white dark:bg-slate-950 rounded-lg p-2 font-mono text-[10px] overflow-auto border border-slate-200 dark:border-slate-800 resize-y"
                           :style="expandedChatSqlIdxs.has(i) ? 'min-height:6rem; height:auto;' : 'min-height:6rem; height:7rem;'">
                        <pre class="whitespace-pre-wrap leading-relaxed" v-html="highlightSqlWithDiff(msg.updatedSql ?? '', editableSql)"></pre>
                      </div>
                      <button @click.stop="toggleChatSqlExpand(i)"
                        class="absolute top-1 right-1 p-0.5 rounded bg-white/90 dark:bg-slate-900/90 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all"
                        :title="expandedChatSqlIdxs.has(i) ? 'ย่อ' : 'ขยาย'">
                        <Maximize2 v-if="!expandedChatSqlIdxs.has(i)" class="w-3 h-3" />
                        <Minimize2 v-else class="w-3 h-3" />
                      </button>
                    </div>
                    <button @click="applySqlFromChat(msg.updatedSql!)"
                      class="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition-all active:scale-95">
                      <CheckCircle2 class="w-3 h-3" /> ใช้ SQL นี้
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="isSqlChatLoading" class="flex justify-start">
                <div class="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                  <Loader2 class="w-3 h-3 text-violet-500 animate-spin" />
                  <span class="text-xs text-slate-500">{{ sqlChatStatus || 'AI กำลังคิด...' }}</span>
                </div>
              </div>
            </div>
            <!-- Input -->
            <div class="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-violet-50/50 dark:bg-violet-900/10 flex gap-2 shrink-0">
              <textarea v-model="sqlChatInput"
                ref="sqlChatInputRef"
                @keydown.enter.exact.prevent="sendSqlChat"
                rows="2"
                placeholder="ถาม AI เกี่ยวกับ SQL นี้... (Enter ส่ง)"
                class="flex-1 resize-none bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40"></textarea>
              <button @click="sendSqlChat" :disabled="!sqlChatInput.trim() || isSqlChatLoading"
                class="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-black rounded-lg transition-all active:scale-95 shrink-0 self-end">
                <Send class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Warnings row -->
        <div v-if="generatedResult?.limitOverridden || (generatedResult?.previewCount > generatedResult?.maxResultsLimit)"
             class="px-4 py-3 border-t border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 flex items-center gap-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle class="w-4 h-4 shrink-0" />
          <span v-if="generatedResult?.limitOverridden">
            ระบบปรับลดผลลัพธ์เหลือ <b>{{ generatedResult.maxResultsLimit?.toLocaleString() }}</b> รายการตามนโยบาย
          </span>
          <span v-else>
            พบข้อมูล <b>{{ generatedResult?.previewCount?.toLocaleString() }}</b> รายการ แต่จะดึงได้เพียง <b>{{ generatedResult?.maxResultsLimit?.toLocaleString() }}</b> รายการแรก
          </span>
        </div>

        <!-- Fetch button footer -->
        <div v-if="generatedResult?.status === 'success' || (generatedResult?.status === 'error' && isSqlEditedFromOriginal)"
             class="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle2 v-if="validateResult?.ok && generatedResult?.status === 'success'" class="w-3.5 h-3.5 text-emerald-500 inline mr-1" />
            {{ generatedResult?.status === 'error' ? 'SQL ถูกแก้ไขแล้ว — กดเพื่อทดสอบอีกครั้ง' : 'SQL ผ่านการตรวจสอบ syntax แล้ว — กดเพื่อดูข้อมูลจริง' }}
          </p>
          <button @click="fetchData" :disabled="isFetching"
            class="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest">
            <Loader2 v-if="isFetching" class="w-4 h-4 animate-spin" />
            <Database v-else class="w-4 h-4" />
            {{ isFetching ? 'กำลังดึงข้อมูล...' : (generatedResult?.status === 'error' ? 'ดึงข้อมูลอีกครั้ง' : 'ดึงข้อมูล') }}
          </button>
        </div>
      </div>

      <!-- ── Tab 3: Data Preview + Actions ── -->
      <div v-show="activeTab === 3" v-if="generatedResult"
           :class="isResultFullscreen ? 'flex-1 flex flex-col overflow-hidden min-h-0' : ''">
        <!-- Total Records row (compact) -->
        <div v-if="generatedResult.previewData !== null" class="flex items-center gap-4 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
          <span class="font-bold text-[10px] uppercase tracking-[0.3em] text-slate-400">Total Records</span>
          <div class="text-3xl font-black tracking-tighter" :class="generatedResult.previewCount > 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'">
            {{ (generatedResult.previewCount ?? 0).toLocaleString() }}
          </div>
          <span class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">รายการที่พบ</span>
          <!-- ปุ่มแสดงทุกเรคคอร์ด -->
          <button
            v-if="!showAllRows && generatedResult.previewCount > (generatedResult.previewData?.length ?? 0)"
            @click="fetchAllRows"
            :disabled="isFetchingAllRows"
            class="ml-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all flex items-center gap-1.5 disabled:opacity-60">
            <Loader2 v-if="isFetchingAllRows" class="w-3 h-3 animate-spin" />
            <Layers v-else class="w-3 h-3" />
            {{ isFetchingAllRows ? 'กำลังโหลด...' : 'แสดงทุกเรคคอร์ด' }}
          </button>
          <!-- ปุ่มกลับไปตัวอย่าง -->
          <button
            v-if="showAllRows"
            @click="showAllRows = false"
            class="ml-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5">
            <X class="w-3 h-3" />
            ตัวอย่าง
          </button>
        </div>

        <!-- Zero Records Warning -->
        <div v-if="generatedResult.status === 'success' && generatedResult.previewData !== null && generatedResult.previewCount === 0"
             class="p-4 bg-rose-50/50 dark:bg-rose-900/10 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-4 text-rose-600 dark:text-rose-400">
            <AlertTriangle class="w-6 h-6 shrink-0" />
            <p class="text-sm font-bold">ไม่พบข้อมูลที่ตรงตามเงื่อนไขที่คุณระบุ โปรดลองปรับปรุงคำถามใหม่อีกครั้ง</p>
          </div>
        </div>

        <!-- Data Preview Table -->
        <div v-if="generatedResult.previewData"
             class="border-b border-slate-200 dark:border-slate-800"
             :class="isResultFullscreen ? 'flex-1 flex flex-col overflow-hidden min-h-0 p-4' : 'p-4'">
          <div class="flex items-center gap-3 mb-3 shrink-0">
            <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-700 shrink-0">
              <Database class="w-4 h-4" />
            </div>
            <div class="shrink-0">
              <div class="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">Data Insights</div>
              <h4 class="text-sm font-bold text-slate-900 dark:text-white">
                {{ showAllRows
                  ? `ข้อมูลทั้งหมด ${allRowsData.length.toLocaleString()} รายการ`
                  : `ตัวอย่างข้อมูล ${generatedResult.previewData.length} รายการแรก` }}
                <span v-if="previewSearch.trim()" class="text-blue-500 dark:text-blue-400 font-normal ml-1">(พบ {{ filteredPreviewData.length }} รายการ)</span>
              </h4>
            </div>
            <!-- ช่องค้นหา — อยู่ตรงกลาง ขยายเต็มพื้นที่ว่าง -->
            <div v-if="showPreview" class="flex-1 relative mx-2">
              <Search class="absolute left-3 inset-y-0 m-auto w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                v-model="previewSearch"
                type="text"
                placeholder="ค้นหาในข้อมูล..."
                class="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400"
              />
            </div>
            <div v-else class="flex-1"></div>
            <button @click="showPreview = !showPreview"
              class="shrink-0 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
              <component :is="showPreview ? X : Wand2" class="w-4 h-4" />
              {{ showPreview ? 'ซ่อนตัวอย่าง' : 'แสดงตัวอย่างข้อมูล' }}
            </button>
          </div>
          <div :class="isResultFullscreen && showPreview ? 'flex-1 flex flex-col overflow-hidden min-h-0' : ''">
            <transition name="fade">
              <div v-if="showPreview" :class="isResultFullscreen ? 'flex-1 flex flex-col overflow-hidden min-h-0' : ''">
                <!-- ตาราง -->
                <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm custom-scrollbar overflow-y-auto"
                     :class="isResultFullscreen ? 'flex-1 min-h-0' : 'max-h-[400px]'">
                  <table class="w-full text-left border-collapse">
                    <thead>
                      <tr class="bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
                        <th v-for="(val, key) in (filteredPreviewData?.[0] ?? generatedResult.previewData?.[0] ?? {})" :key="key" class="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                          {{ key }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr v-for="(row, idx) in filteredPreviewData" :key="idx" class="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                        <td v-for="(val, key) in row" :key="key" class="px-5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                          {{ formatCellValue(val, key) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-if="filteredPreviewData.length === 0 && previewSearch.trim()" class="py-10 text-center text-sm text-slate-400">
                    ไม่พบข้อมูลที่ตรงกับ "{{ previewSearch }}"
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>

        <!-- Action Footer -->
        <div v-if="generatedResult.previewData" class="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-center gap-4 shrink-0">
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
            <div class="flex flex-nowrap items-center justify-center gap-3 w-full sm:w-auto">
              <button @click="isBackConfirmOpen = true" class="px-4 py-3 text-xs font-black text-slate-400 hover:text-rose-600 transition-all uppercase tracking-widest">
                ยกเลิก
              </button>
              <button @click="isFavoriteModalOpen = true"
                class="px-5 py-3.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all border border-amber-200 dark:border-amber-800/50 text-xs font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest whitespace-nowrap">
                <Star class="w-3.5 h-3.5" />
                บันทึกรายการโปรด
              </button>
            </div>

            <div class="hidden sm:block w-px h-10 bg-slate-200 dark:bg-slate-800 mx-2"></div>

            <div class="w-full sm:w-auto flex items-center gap-3">
              <div v-if="isAdmin" class="grid grid-cols-2 shadow-2xl shadow-emerald-500/30 rounded-[2rem] overflow-hidden min-w-[240px]">
                <button @click="openCsvModal"
                  :disabled="isRequesting || generatedResult.previewCount === 0"
                  class="py-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:grayscale text-white text-sm font-black transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest border-r border-emerald-500/50">
                  <Download class="w-5 h-5" />
                  <span>CSV</span>
                </button>
                <button @click="openZohoModal"
                  :disabled="isRequesting || generatedResult.previewCount === 0"
                  class="py-5 bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center active:scale-95 border-l border-emerald-700/30"
                  title="Export to Zoho Sheet">
                  <div class="flex items-center gap-2">
                    <LayoutGrid class="w-5 h-5" />
                    <span class="text-xs font-black uppercase">Zoho</span>
                  </div>
                </button>
              </div>

              <button v-else @click="isRequestModalOpen = true"
                :disabled="isRequesting || generatedResult.previewCount === 0"
                class="w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale text-white text-sm font-black rounded-3xl shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest">
                <span>ขออนุมัติดึงข้อมูล</span>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Request Approval Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isRequestModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80">
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
                    @click="() => requestApproval()"
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

    <!-- SQL Viewer Modal -->

    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div
            v-if="isSqlModalOpen"
            class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80"
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
                      :style="isSqlModalFullscreen ? 'min-height: 0' : 'min-height: 50vh'"
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
          <div v-if="isFavoriteModalOpen" class="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/80">
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
          <div v-if="isZohoModalOpen" class="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90">
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
                <button @click="isZohoModalOpen = false; zohoSuccessDone = false; zohoResultLink = ''" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400 dark:text-white/50">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Zoho Success State -->
              <div v-if="zohoSuccessDone" class="p-10 flex flex-col items-center text-center gap-5">
                <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 class="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div class="space-y-1.5">
                  <p class="text-base font-black text-slate-900 dark:text-white">อัพโหลดสำเร็จ!</p>
                  <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">ระบบอนุมัติคำขอนี้อัตโนมัติ<br>บันทึกลงประวัติการใช้งานและอัพโหลดไปยัง Zoho WorkDrive เรียบร้อยแล้ว</p>
                </div>
                <a v-if="zohoResultLink"
                  :href="zohoResultLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all shadow-sm"
                >
                  <LayoutGrid class="w-4 h-4" />
                  เปิดไฟล์ใน Zoho WorkDrive
                </a>
                <button
                  @click="navigateTo('/history')"
                  class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all"
                >
                  ปิด
                </button>
              </div>

              <!-- Content -->
              <div v-if="!zohoSuccessDone" class="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <!-- File Name -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">ชื่อไฟล์</label>
                  <input
                    v-model="zohoOptions.linkName"
                    type="text"
                    placeholder="เช่น Sales_Report, Customer_List"
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">ไฟล์จะถูกบันทึกเป็น <span class="font-mono">{{ (zohoOptions.linkName || 'AI_Export').replace(/[^a-zA-Z0-9ก-๙]/g, '_') }}_[timestamp].csv</span></p>
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

                <!-- วันหมดอายุ -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">วันหมดอายุลิงก์</label>
                  <input
                    v-model="zohoExpiresAt"
                    type="date"
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">ลิงก์จะหมดอายุหลังจากวันที่กำหนด (ว่างไว้ = ไม่มีวันหมดอายุ)</p>
                </div>

                <!-- Info Box -->
                <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-4">
                  <ul class="space-y-2 text-xs text-emerald-700 dark:text-emerald-300/80 list-disc pl-4">
                    <li>ไฟล์จะถูกอัพโหลดเป็น <strong>.csv</strong> ไปยัง Zoho WorkDrive โฟลเดอร์ <strong>AI Queries</strong></li>
                    <li>สามารถเปิดและแก้ไขได้ใน Zoho Sheet</li>
                    <li>หากต้องการแชร์ link ให้ผู้อื่น สามารถสร้าง External Share Link ได้จาก WorkDrive UI</li>
                  </ul>
                </div>
              </div>

              <!-- Footer -->
              <div v-if="!zohoSuccessDone" class="p-6 space-y-3 bg-slate-50 dark:bg-white/[0.02]">
                <label class="flex items-center gap-2.5 cursor-pointer select-none px-1">
                  <input v-model="zohoSkipEmail" type="checkbox" class="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0" />
                  <span class="text-xs font-medium text-slate-500 dark:text-slate-400">ไม่ต้องส่งเมลล์แจ้งเจ้าของไฟล์</span>
                </label>
                <div class="flex items-center justify-end gap-3">
                  <button @click="isZohoModalOpen = false; zohoSuccessDone = false; zohoSkipEmail = false; zohoResultLink = ''" class="px-7 py-3.5 text-sm font-bold text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border border-slate-200 dark:border-white/10">
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
          <div v-if="isDataGuideModalOpen" class="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10 bg-slate-900/80">
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

    <!-- DB Schema Explorer Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isSchemaModalOpen" class="fixed inset-0 z-[150] flex items-start justify-center p-4 md:pt-[5vh] bg-slate-900/80" @click.self="isSchemaModalOpen = false">
            <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col self-start border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <!-- Header -->
              <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <Table2 class="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 class="text-base font-black text-slate-900 dark:text-white">DB Schema Explorer</h3>
                    <p class="text-[10px] text-slate-500 font-medium">สำรวจตารางและฟิลด์เพื่อใช้ในการสร้างคำสั่ง SQL</p>
                  </div>
                </div>
                <button @click="isSchemaModalOpen = false" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Body: Split Panel -->
              <div class="flex flex-1 min-h-0">
                <!-- Left: Table List -->
                <div class="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/30">
                  <!-- Search -->
                  <div class="p-3 border-b border-slate-200 dark:border-slate-800">
                    <div class="relative">
                      <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        v-model="schemaTableSearch"
                        type="text"
                        placeholder="ค้นหาตาราง..."
                        class="w-full pl-8 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                      />
                      <button
                        v-if="schemaTableSearch"
                        type="button"
                        @click="schemaTableSearch = ''"
                        class="absolute right-2 inset-y-0 my-auto w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 outline-none transition-colors"
                      >
                        <X class="w-3 h-3 pointer-events-none" />
                      </button>
                    </div>
                  </div>
                  <!-- Table List -->
                  <div class="flex-1 overflow-y-auto custom-scrollbar">
                    <div v-if="isLoadingTables" class="flex items-center justify-center py-12">
                      <Loader2 class="w-5 h-5 text-emerald-500 animate-spin" />
                    </div>
                    <div v-else-if="filteredSchemaTables.length === 0" class="px-4 py-8 text-center text-xs text-slate-400">
                      ไม่พบตาราง
                    </div>
                    <div
                      v-for="table in filteredSchemaTables"
                      :key="table"
                      :class="[
                        'group flex items-center justify-between px-3 py-2 text-xs font-mono transition-colors border-b border-slate-100 dark:border-slate-800/60 cursor-pointer',
                        schemaSelectedTable === table
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      ]"
                      @click="selectSchemaTable(table)"
                    >
                      <span class="truncate">{{ table }}</span>
                      <button
                        type="button"
                        @click.stop="copySchemaText(table)"
                        class="shrink-0 ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600"
                        :title="'Copy: ' + table"
                      >
                        <CheckCircle2 v-if="schemaCopied === table" class="w-3 h-3 text-emerald-500" />
                        <Copy v-else class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <!-- Count badge -->
                  <div class="px-3 py-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-medium">
                    {{ filteredSchemaTables.length }} ตาราง
                  </div>
                </div>

                <!-- Right: Column List -->
                <div class="flex-1 flex flex-col min-w-0">
                  <!-- Empty state -->
                  <div v-if="!schemaSelectedTable" class="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                    <Table2 class="w-10 h-10 mb-3 opacity-20" />
                    <p class="text-sm font-medium">เลือกตารางจากรายการทางซ้าย</p>
                    <p class="text-xs mt-1 opacity-70">เพื่อดูฟิลด์และประเภทข้อมูล</p>
                  </div>

                  <!-- Loading columns -->
                  <div v-else-if="isLoadingColumns" class="flex-1 flex items-center justify-center">
                    <Loader2 class="w-5 h-5 text-emerald-500 animate-spin" />
                  </div>

                  <!-- Column table -->
                  <div v-else class="flex-1 overflow-y-auto custom-scrollbar">
                    <!-- Table name header -->
                    <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-2 shrink-0 sticky top-0 z-10">
                      <Database class="w-3.5 h-3.5 text-emerald-500" />
                      <span class="text-xs font-black text-slate-700 dark:text-slate-200 font-mono">{{ schemaSelectedTable }}</span>
                      <span class="ml-auto text-[10px] text-slate-400">{{ schemaColumns.length }} ฟิลด์</span>
                    </div>
                    <!-- Columns table -->
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-[41px] z-10">
                          <th class="px-4 py-2 text-left font-black text-slate-500 uppercase tracking-wider text-[10px]">Column</th>
                          <th class="px-4 py-2 text-left font-black text-slate-500 uppercase tracking-wider text-[10px]">Type</th>
                          <th class="px-4 py-2 text-left font-black text-slate-500 uppercase tracking-wider text-[10px]">Key</th>
                          <th class="px-4 py-2 text-left font-black text-slate-500 uppercase tracking-wider text-[10px]">Null</th>
                          <th class="px-4 py-2 text-left font-black text-slate-500 uppercase tracking-wider text-[10px]">Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="col in schemaColumns"
                          :key="col.column"
                          class="group border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td class="px-4 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">
                            <div class="flex items-center gap-1">
                              <span>{{ col.column }}</span>
                              <button
                                type="button"
                                @click="copySchemaText(col.column)"
                                class="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600"
                                :title="'Copy: ' + col.column"
                              >
                                <CheckCircle2 v-if="schemaCopied === col.column" class="w-3 h-3 text-emerald-500" />
                                <Copy v-else class="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td class="px-4 py-2 font-mono text-indigo-600 dark:text-indigo-400">{{ col.type }}</td>
                          <td class="px-4 py-2">
                            <span v-if="col.key === 'PRI'" class="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">PRI</span>
                            <span v-else-if="col.key === 'MUL'" class="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">MUL</span>
                            <span v-else-if="col.key === 'UNI'" class="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">UNI</span>
                            <span v-else class="text-slate-300 dark:text-slate-600">—</span>
                          </td>
                          <td class="px-4 py-2 text-slate-500">{{ col.nullable === 'YES' ? 'YES' : '' }}</td>
                          <td class="px-4 py-2 text-slate-400 italic truncate max-w-[160px]" :title="col.comment">{{ col.comment || '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
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
          <div v-if="isCsvConfirmModalOpen" class="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/90">
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
                <button @click="isCsvConfirmModalOpen = false; csvSuccessDone = false" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400 dark:text-white/50">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Success State -->
              <div v-if="csvSuccessDone" class="p-10 flex flex-col items-center text-center gap-5">
                <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 class="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div class="space-y-1.5">
                  <p class="text-base font-black text-slate-900 dark:text-white">ดำเนินการสำเร็จ!</p>
                  <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">ระบบอนุมัติคำขอนี้อัตโนมัติ<br>บันทึกลงประวัติการใช้งานเรียบร้อยแล้ว</p>
                </div>
                <button
                  @click="navigateTo('/history')"
                  class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all"
                >
                  ไปหน้าประวัติการใช้งาน
                </button>
              </div>

              <!-- Content -->
              <div v-if="!csvSuccessDone" class="p-8 space-y-6">
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

                <!-- Expiry Date -->
                <div>
                  <label class="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2 block">วันหมดอายุ (Expires At)</label>
                  <input
                    v-model="csvExpiresAt"
                    type="date"
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <p class="text-[11px] text-slate-400 dark:text-white/30 mt-1.5">ไฟล์จะดาวน์โหลดได้ถึงวันที่นี้</p>
                </div>

                <!-- Info Box -->
                <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-4">
                  <p class="text-xs text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                    ระบบจะ<strong>อนุมัติคำขอนี้อัตโนมัติ</strong> บันทึกลงประวัติการใช้งาน และเริ่มดาวน์โหลดไฟล์ทันที
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div v-if="!csvSuccessDone" class="p-6 flex flex-col gap-3 bg-slate-50 dark:bg-white/[0.02]">
                <!-- ปุ่มดาวน์โหลดโดยตรง (ไม่บันทึกประวัติ) -->
                <button
                  @click="downloadDirect"
                  :disabled="isDirectDownloading || isRequesting"
                  class="w-full px-8 py-3.5 bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-600 dark:border-slate-600"
                >
                  <Loader2 v-if="isDirectDownloading" class="w-4 h-4 animate-spin" />
                  <Download v-else class="w-4 h-4" />
                  {{ isDirectDownloading ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด (ไม่บันทึกประวัติ)' }}
                </button>

                <div class="flex items-center gap-2 text-[10px] text-slate-400 dark:text-white/30 px-1">
                  <div class="flex-1 h-px bg-slate-200 dark:bg-white/10"></div>
                  <span class="uppercase tracking-widest font-bold">หรือบันทึกลงประวัติ</span>
                  <div class="flex-1 h-px bg-slate-200 dark:bg-white/10"></div>
                </div>

                <!-- Checkbox skip email -->
                <label class="flex items-center gap-2.5 cursor-pointer select-none px-1">
                  <input v-model="csvSkipEmail" type="checkbox" class="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0" />
                  <span class="text-xs font-medium text-slate-500 dark:text-slate-400">ไม่ต้องส่งเมลล์แจ้งเจ้าของไฟล์</span>
                </label>

                <div class="flex items-center justify-end gap-3">
                  <button
                    @click="isCsvConfirmModalOpen = false; csvSuccessDone = false; csvSkipEmail = false"
                    class="px-7 py-3.5 text-sm font-bold text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border border-slate-200 dark:border-white/10"
                  >
                    ยกเลิก
                  </button>
                  <button
                    @click="requestApproval(true)"
                    :disabled="isRequesting || isDirectDownloading"
                    class="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                  >
                    <RotateCcw v-if="isRequesting" class="w-4 h-4 animate-spin" />
                    <CheckCircle2 v-else class="w-4 h-4" />
                    ยืนยัน
                  </button>
                  <button
                    @click="requestApproval(false)"
                    :disabled="isRequesting || isDirectDownloading"
                    class="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <RotateCcw v-if="isRequesting" class="w-4 h-4 animate-spin" />
                    <Download v-else class="w-4 h-4" />
                    ยืนยัน / ดาวน์โหลด
                  </button>
                </div>
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
          <div v-if="isDeleteConfirmModalOpen" class="fixed inset-0 z-[140] flex items-center justify-center p-6 bg-slate-900/80">
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


    <!-- Direct SQL Fullscreen Editor Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition name="modal">
          <div v-if="isDirectSqlFullscreen"
               class="fixed inset-0 z-[160] flex flex-col bg-white dark:bg-slate-900"
               @keydown.escape.prevent="isDirectSqlFullscreen = false">
            <!-- Header -->
            <div class="flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div class="flex items-center gap-2">
                <Terminal class="w-4 h-4 text-indigo-500" />
                <span class="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">SQL Editor</span>
              </div>
              <div class="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  @click="directSql = formatSql(directSql)"
                  :disabled="!directSql.trim()"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all disabled:opacity-40 uppercase tracking-widest"
                >
                  <Wand2 class="w-3 h-3" />
                  Format
                </button>
                <button
                  type="button"
                  @click="directSql = ''; directSqlError = ''; sqlFixSuggestion = null"
                  :disabled="!directSql.trim()"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-40"
                  title="ล้าง SQL"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
                <div class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <button
                  type="button"
                  @click="isDirectSqlFullscreen = false"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all"
                  title="ย่อกลับ (Esc)"
                >
                  <Minimize2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Editor -->
            <div class="direct-sql-fs-wrap sql-editor-wrap flex-1 overflow-hidden border-b border-slate-200 dark:border-slate-800" style="min-height: 0;">
              <pre ref="directSqlFsHighlightRef" aria-hidden="true" class="sql-editor-pre dark:!text-slate-200"
                   v-html="directSql ? highlightOnlySql(directSql) : ''"></pre>
              <textarea
                ref="directSqlFsEditorRef"
                v-model="directSql"
                @scroll="syncDirectSqlFsScroll"
                @keydown.ctrl.enter.prevent="isDirectSqlFullscreen = false; $nextTick(() => submitDirectSql())"
                @keydown.escape.prevent="isDirectSqlFullscreen = false"
                @paste.prevent="(e) => { const text = e.clipboardData?.getData('text') || ''; const el = e.target as HTMLTextAreaElement; const start = el.selectionStart ?? directSql.length; const end = el.selectionEnd ?? directSql.length; if (!directSql.trim()) { directSql = formatSql(text) || text } else { directSql = directSql.substring(0, start) + text + directSql.substring(end) } }"
                placeholder="วางหรือพิมพ์คำสั่ง SQL ที่นี่..."
                spellcheck="false" autocomplete="off"
                class="sql-editor-textarea focus:outline-none"
                :style="sqlCaretStyle"
              ></textarea>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <span class="text-[11px] text-slate-400 font-mono">Ctrl+Enter เพื่อรัน · Esc เพื่อย่อกลับ</span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="isDirectSqlFullscreen = false"
                  class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  ย่อกลับ
                </button>
                <button
                  type="button"
                  :disabled="!directSql.trim() || isUpdatingSql"
                  @click="isDirectSqlFullscreen = false; $nextTick(() => submitDirectSql())"
                  class="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl shadow-sm shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <Terminal class="w-4 h-4" />
                  รัน SQL
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Tips Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isTipsModalOpen" class="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80" @click="isTipsModalOpen = false">
            <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
              <!-- Header -->
              <div class="px-7 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/40 dark:bg-amber-900/10">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Lightbulb class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="text-base font-black text-slate-900 dark:text-white">เทคนิคการถาม AI</h3>
                    <p class="text-[10px] font-bold text-amber-600/60 dark:text-amber-400/60 uppercase tracking-widest">Query Tips & Tricks</p>
                  </div>
                </div>
                <button @click="isTipsModalOpen = false" class="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Content -->
              <div class="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">

                <!-- Active Assets -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-emerald-500 rounded-full"></span>
                    ข้อมูล Asset ปัจจุบัน (Active)
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    ใช้คำว่า <span class="font-black text-emerald-600 dark:text-emerald-400">"ปัจจุบัน"  "active"  "current"  "unique"</span> — ระบบจะดึงเฉพาะ SN ล่าสุดต่อบริษัทให้อัตโนมัติ
                  </p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'รายการ asset ปัจจุบันของบริษัท ABC',
                      'SN ที่ยังใช้งานอยู่ แยกตามบริษัท',
                      'จำนวน qty รวมของ AutoCAD LT ในปัจจุบัน',
                      'asset ที่ active แต่หมดอายุในเดือนนี้'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors group border border-emerald-100 dark:border-emerald-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- History -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-slate-400 rounded-full"></span>
                    ต้องการประวัติทั้งหมด (ทุก Renewal)
                  </div>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'ประวัติการต่ออายุทั้งหมดของ SN XXXX',
                      'รายการ asset ทั้งหมดของบริษัท ABC รวมถึงประวัติการต่ออายุ'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-[11px] font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group border border-slate-100 dark:border-slate-800"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Grouping -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-blue-500 rounded-full"></span>
                    จัดกลุ่ม / สรุปข้อมูล
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">ลงท้ายด้วย <span class="font-black text-blue-600 dark:text-blue-400">"แยกตาม..."</span> เพื่อให้ AI สร้าง GROUP BY ให้อัตโนมัติ</p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'นับจำนวน Lead แยกตามจังหวัด',
                      'ยอดขายรวมแยกตามทีมฝ่ายขาย',
                      'จำนวน asset แยกตามสินค้าและบริษัท'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-[11px] font-medium cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group border border-blue-100 dark:border-blue-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Time Filter -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-indigo-500 rounded-full"></span>
                    กรองตามช่วงเวลา
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">ระบุช่วงเวลาให้ชัด เช่น <span class="font-black text-indigo-600 dark:text-indigo-400">"ในปี 2024"  "เดือนนี้"  "ย้อนหลัง 1 ปี"  "ระหว่าง ม.ค.-มี.ค."</span></p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'asset ที่หมดอายุภายใน 30 วันข้างหน้า',
                      'ยอดขายระหว่าง 1 ม.ค. ถึง 31 มี.ค. 2025',
                      'Lead ใหม่ย้อนหลัง 1 ปี แต่ยังไม่ถูกติดต่อ'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 text-[11px] font-medium cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors group border border-indigo-100 dark:border-indigo-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Exclusion -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-rose-500 rounded-full"></span>
                    ยกเว้น / ไม่รวม
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">ใช้คำว่า <span class="font-black text-rose-600 dark:text-rose-400">"ที่ไม่มี..."  "ยกเว้น..."  "แต่ไม่รวม..."</span> เพื่อสร้างเงื่อนไข NOT IN</p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'บริษัทที่มี AutoCAD LT แต่ไม่มี GstarCAD',
                      'ลูกค้าที่มี asset หมดอายุ แต่ไม่มี Opp ใน Topline'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 text-[11px] font-medium cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors group border border-rose-100 dark:border-rose-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Opportunity / Topline -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-amber-500 rounded-full"></span>
                    Opportunity / Topline
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">คำว่า <span class="font-black text-amber-600 dark:text-amber-400">"Topline"  "ใน Pipeline"  "ยังไม่ปิดดีล"</span> จะกรองเฉพาะ Opp ที่ยัง Active อยู่</p>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'ดีลที่อยู่ใน Topline ของทีม Mi Software',
                      'Opp ที่เปิดอยู่และมีสินค้าหมวด SolidWorks'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors group border border-amber-100 dark:border-amber-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Team & Hierarchy -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="w-4 h-0.5 bg-violet-500 rounded-full"></span>
                    ทีม & สายงาน (Hierarchy)
                  </div>
                  <div class="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <p><span class="font-black text-violet-600 dark:text-violet-400">"ภายใต้..."  "รวมลูกน้อง"  "ในสายงาน"</span> → รวมทีมย่อยทั้งหมดในสายงาน</p>
                    <p><span class="font-black text-slate-600 dark:text-slate-300">"ของทีม..."  "เฉพาะทีม"</span> → เฉพาะทีมนั้นโดยตรง ไม่รวมลูกน้อง</p>
                  </div>
                  <div class="space-y-1.5">
                    <div v-for="tip in [
                      'ยอดขายทั้งหมดในสายงานของ Mi Software รวมลูกน้อง',
                      'จำนวน Lead เฉพาะทีมกรุงเทพ ไม่รวมทีมย่อย',
                      'asset ที่หมดอายุภายใต้ทีม Service'
                    ]" :key="tip"
                      @click="prompt = tip; isTipsModalOpen = false; focusAndEnd()"
                      class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-300 text-[11px] font-medium cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors group border border-violet-100 dark:border-violet-900/30"
                    >
                      <ArrowRight class="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      {{ tip }}
                    </div>
                  </div>
                </div>

                <!-- Note -->
                <div class="p-3.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex items-start gap-2.5">
                  <Info class="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <p class="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">คลิกที่ตัวอย่างเพื่อใช้คำถามนั้นทันทีได้เลยครับ</p>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>
    </ClientOnly>

    <!-- Back Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <transition name="modal">
          <div v-if="isBackConfirmOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" @click="isBackConfirmOpen = false">
            <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800" @click.stop>
              <!-- Icon -->
              <div class="flex flex-col items-center gap-4 pt-8 pb-2 px-8">
                <div class="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle class="w-8 h-8 text-amber-500" />
                </div>
                <div class="text-center space-y-1.5">
                  <h3 class="text-base font-black text-slate-800 dark:text-slate-100">ยืนยันการย้อนกลับ</h3>
                  <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    ข้อมูลที่ AI สร้างไว้ทั้งหมด รวมถึง SQL และผลลัพธ์<br>จะถูกล้างออกทั้งหมด ต้องการดำเนินการต่อหรือไม่?
                  </p>
                </div>
              </div>
              <!-- Actions -->
              <div class="flex gap-3 px-8 py-6">
                <button
                  @click="isBackConfirmOpen = false"
                  class="flex-1 px-4 py-3 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  ยกเลิก
                </button>
                <button
                  @click="isBackConfirmOpen = false; backToEdit()"
                  class="flex-1 px-4 py-3 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 shadow-lg shadow-rose-500/25 transition-all active:scale-95"
                >
                  ย้อนกลับ
                </button>
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

.suggest-enter-active, .suggest-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
  max-height: 200px;
}
.suggest-enter-from, .suggest-leave-to {
  opacity: 0;
  transform: translateY(6px);
  max-height: 0;
}

.fade-fast-enter-active, .fade-fast-leave-active { transition: opacity 0.15s ease; }
.fade-fast-enter-from, .fade-fast-leave-to { opacity: 0; }

.slide-down-enter-active, .slide-down-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.2s ease;
  overflow: hidden;
  max-height: 80px;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
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

/* ── SQL Editor Overlay ───────────────────────────────── */
.sql-editor-wrap {
  position: relative;
  --sql-font: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  --sql-size: 0.8125rem;   /* ~13px */
  --sql-lh: 1.65;
  --sql-px: 0.75rem;
  --sql-py: 0.625rem;
}
.sql-editor-pre,
.sql-editor-textarea {
  font-family: var(--sql-font);
  font-size: var(--sql-size);
  line-height: var(--sql-lh);
  padding: var(--sql-py) var(--sql-px);
  margin: 0;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: 0;
}
.sql-editor-pre {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  color: #334155; /* slate-700 — dark mode ควบคุมด้วย Tailwind dark:!text-slate-200 บน element โดยตรง */
}
.sql-editor-textarea {
  position: relative;
  display: block;
  width: 100%;
  min-height: 260px;
  resize: vertical;
  background: transparent;
  color: transparent;
  caret-color: #334155;
  overflow-y: auto;
  overflow-x: hidden;
}
:global(.dark) .sql-editor-textarea { caret-color: #94a3b8; }

/* ── Direct SQL Editor (Light Theme) ────────────────────── */
.direct-sql-editor-wrap .sql-editor-pre { color: #334155; /* slate-700 */ }
:global(.dark) .direct-sql-editor-wrap .sql-editor-pre { color: #e2e8f0; /* slate-200 */ }
.direct-sql-editor-wrap .sql-editor-textarea {
  min-height: 220px;
  caret-color: #1e293b;
}
:global(.dark) .direct-sql-editor-wrap .sql-editor-textarea { caret-color: #ffffff; }
.direct-sql-editor-wrap .sql-editor-textarea::placeholder { color: #94a3b8; opacity: 1; }

/* ── Direct SQL Fullscreen Editor ───────────────────────── */
.direct-sql-fs-wrap .sql-editor-pre { color: #334155; }
:global(.dark) .direct-sql-fs-wrap .sql-editor-pre { color: #e2e8f0; }
.direct-sql-fs-wrap .sql-editor-textarea {
  height: 100%;
  min-height: 0 !important;
  resize: none !important;
  caret-color: #1e293b;
}
:global(.dark) .direct-sql-fs-wrap .sql-editor-textarea { caret-color: #ffffff; }
.direct-sql-fs-wrap .sql-editor-textarea::placeholder { color: #94a3b8; opacity: 1; }

/* ── Fullscreen SQL Editor Height Expansion ─────────────── */
.result-fullscreen .tab2-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.result-fullscreen .panel-container {
  flex: 1;
  min-height: 0;
  max-height: none;
}
.result-fullscreen .sql-panel {
  min-height: 0;
}
.result-fullscreen .sql-panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.result-fullscreen .sql-editor-wrap {
  flex: 1;
  min-height: 160px;
}
.result-fullscreen .sql-editor-textarea {
  height: 100%;
  min-height: 160px !important;
  resize: none !important;
}

/* SQL highlight token colors */
:global(.sql-hl-kw) { color: #2563eb; font-weight: 700; } /* blue-600 */
:global(.dark .sql-hl-kw) { color: #93c5fd; font-weight: 700; } /* blue-300 — สว่างขึ้นใน dark mode */
:global(.sql-hl-str) { color: #16a34a; }                   /* green-600 */
:global(.dark .sql-hl-str) { color: #86efac; }             /* green-300 */
:global(.sql-hl-num) { color: #d97706; }                   /* amber-600 */
:global(.dark .sql-hl-num) { color: #fcd34d; }             /* amber-300 */

/* Error token — ไฮไลน์คำที่ทำให้ SQL error (สีแดง + underline wavy) */
:global(.sql-hl-err) {
  color: #dc2626;
  background-color: rgba(254, 226, 226, 0.7);
  border-radius: 2px;
  padding: 0 1px;
  text-decoration: underline wavy #dc2626;
  text-underline-offset: 2px;
}
:global(.dark .sql-hl-err) {
  color: #fca5a5;
  background-color: rgba(127, 29, 29, 0.35);
  text-decoration-color: #fca5a5;
}

/* Diff highlighting — บรรทัดที่ถูกแก้ไข/เพิ่ม (ใช้สีฟ้าเพื่อแยกจาก AI Fix panel สีเหลือง) */
:global(.sql-hl-diff) {
  display: inline-block;
  min-width: 100%;
  background: rgba(59, 130, 246, 0.10);
}
:global(.dark .sql-hl-diff) {
  background: rgba(59, 130, 246, 0.12);
}

/* Expand SQL Editor within its panel column */
.sql-editor-wrap-expanded {
  flex: 1;
  min-height: 0;
}
.sql-editor-wrap-expanded .sql-editor-textarea {
  height: 100%;
  min-height: 0 !important;
  resize: none !important;
}

/* Data Guide Styling */
:deep(.data-guide-content h2) {
  @apply text-xl font-black text-indigo-700 dark:text-indigo-400 mt-16 mb-8 flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-900/20 px-6 py-4 rounded-2xl border-l-8 border-indigo-600 shadow-sm;
}
:deep(.data-guide-content p), :deep(.data-guide-content li) {
  @apply text-slate-600 dark:text-slate-400 text-base leading-loose mb-4 px-2;
}
:deep(.data-guide-content strong) {
  @apply text-slate-900 dark:text-slate-200 font-bold;
}
:deep(.data-guide-content hr) {
  @apply my-16 border-slate-100 dark:border-slate-800 opacity-0;
}
:deep(.data-guide-content blockquote) {
  @apply pl-6 border-l-4 border-amber-500 bg-amber-50/30 dark:bg-amber-900/10 py-6 pr-6 rounded-r-3xl italic my-10 shadow-sm;
}
:deep(.data-guide-content ul) {
  @apply space-y-4 list-none pl-6 my-8;
}
:deep(.data-guide-content ul li) {
  @apply relative;
}
:deep(.data-guide-content ul li::before) {
  content: '•';
  @apply absolute -left-5 text-indigo-500 font-black text-xl top-[-2px] leading-none;
}

/* Markdown Rendering Styling */
:deep(.prose-markdown ul) {
  @apply space-y-3 list-none pl-6 my-4;
}
:deep(.prose-markdown ul li) {
  @apply relative leading-relaxed;
}
:deep(.prose-markdown ul li::before) {
  content: '•';
  @apply absolute -left-5 text-blue-500 font-black text-xl top-[-2px] leading-none;
}
:deep(.prose-markdown strong) {
  @apply font-medium text-indigo-600 dark:text-indigo-400 not-italic;
}
</style>
