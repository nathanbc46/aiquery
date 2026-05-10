// PDF generation utility สำหรับ export chat messages
// ต้องวางไฟล์ THSarabunNew.ttf ไว้ที่ public/fonts/THSarabunNew.ttf
import { jsPDF } from 'jspdf'
import { applyPlugin } from 'jspdf-autotable'
import { svg2pdf } from 'svg2pdf.js'

applyPlugin(jsPDF)

type Segment =
  | { type: 'text'; content: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'chart'; id: string }

// hash function เดียวกับใน index.vue
function chatHashStr(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// โหลด Thai font จาก public/fonts/ แบบ lazy
async function loadThaiFont(doc: any): Promise<boolean> {
  try {
    const response = await fetch('/fonts/THSarabunNew.ttf')
    if (!response.ok) return false
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i += 1024) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 1024, bytes.byteLength)))
    }
    const base64 = btoa(binary)
    doc.addFileToVFS('THSarabunNew.ttf', base64)
    doc.addFont('THSarabunNew.ttf', 'THSarabunNew', 'normal')
    doc.setFont('THSarabunNew')
    return true
  } catch {
    return false
  }
}

// แยก content ของ AI message ออกเป็น segments
function parseMessageSegments(content: string): Segment[] {
  const segments: Segment[] = []
  const chartRegex = /```chart\n([\s\S]*?)\n```/gim
  const tableRegex = /((?:\|[^\n]+\|(?:\n|$)){2,})/gim

  let remaining = content
  let lastIndex = 0
  const parts: Array<{ start: number; end: number; segment: Segment }> = []

  // หา chart blocks
  let m: RegExpExecArray | null
  chartRegex.lastIndex = 0
  while ((m = chartRegex.exec(content)) !== null) {
    try {
      const json = m[1]
      const id = `chat-chart-${chatHashStr(json)}`
      parts.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'chart', id } })
    } catch { /* skip malformed */ }
  }

  // หา table blocks
  tableRegex.lastIndex = 0
  while ((m = tableRegex.exec(content)) !== null) {
    const block = m[0]
    // ตรวจว่าไม่ทับกับ chart block
    const overlaps = parts.some(p => m!.index < p.end && m!.index + block.length > p.start)
    if (!overlaps) {
      const rows = extractMarkdownTable(block)
      if (rows.length > 1) {
        parts.push({ start: m.index, end: m.index + block.length, segment: { type: 'table', rows } })
      }
    }
  }

  // เรียง parts ตาม position
  parts.sort((a, b) => a.start - b.start)

  lastIndex = 0
  for (const part of parts) {
    if (part.start > lastIndex) {
      const text = content.slice(lastIndex, part.start).trim()
      if (text) segments.push({ type: 'text', content: stripMarkdown(text) })
    }
    segments.push(part.segment)
    lastIndex = part.end
  }

  const tail = content.slice(lastIndex).trim()
  if (tail) segments.push({ type: 'text', content: stripMarkdown(tail) })

  return segments
}

// แยก markdown table เป็น string[][]
function extractMarkdownTable(block: string): string[][] {
  const rows = block.trim().split('\n').filter(r => r.trim())
  const result: string[][] = []
  for (const row of rows) {
    const cells = row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim())
    // ข้าม separator row (---|---|---)
    if (cells.every(c => /^:?-+:?$/.test(c))) continue
    result.push(cells)
  }
  return result
}

// ลบ markdown syntax ออก เหลือแต่ text
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/gim, '')
    .replace(/\*\*(.*?)\*\*/gim, '$1')
    .replace(/\*(.*?)\*/gim, '$1')
    .replace(/^#{1,3}\s+/gim, '')
    .replace(/`(.*?)`/gim, '$1')
    .replace(/^\s*[-*]\s+/gim, '• ')
    .replace(/\|[^\n]+\|/gim, '')
    .trim()
}

const PAGE_H = 297
const BOTTOM_MARGIN = 18
const LEFT = 14
const RIGHT = 196

// ตรวจว่าพื้นที่พอหรือต้องขึ้นหน้าใหม่
function ensureSpace(doc: any, y: number, needed: number): number {
  if (y + needed > PAGE_H - BOTTOM_MARGIN) {
    doc.addPage()
    return 20
  }
  return y
}

// วาด header ของ PDF
function drawPdfHeader(doc: any, contextLabel: string, msgCount: number) {
  // แถบสี
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('THSarabunNew', 'normal')
  doc.text('รายงานการสนทนา AI', LEFT, 12)

  doc.setFontSize(9)
  doc.setTextColor(220, 220, 255)
  doc.text(`Vtiger AI Query System  ·  ${contextLabel}`, LEFT, 20)

  const dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(`วันที่: ${dateStr}  ·  จำนวนข้อความที่เลือก: ${msgCount}`, RIGHT, 20, { align: 'right' })

  doc.setTextColor(30, 30, 30)
}

// วาด user message bubble
function renderUserBubble(doc: any, content: string, y: number, useThaiFont: boolean): number {
  const text = content.trim()
  doc.setFontSize(9.5)
  if (useThaiFont) doc.setFont('THSarabunNew', 'normal')
  const lines: string[] = doc.splitTextToSize(text, 110)
  const boxH = lines.length * 5.5 + 8
  y = ensureSpace(doc, y, boxH + 4)

  const boxX = RIGHT - 120
  doc.setFillColor(237, 233, 254) // violet-100
  doc.roundedRect(boxX, y, 120, boxH, 3, 3, 'F')

  doc.setTextColor(76, 29, 149) // violet-900
  doc.setFontSize(7.5)
  doc.text('คุณ', RIGHT, y + 4, { align: 'right' })
  doc.setFontSize(9.5)
  doc.setTextColor(50, 30, 100)
  doc.text(lines, boxX + 4, y + 10)

  doc.setTextColor(30, 30, 30)
  return y + boxH + 5
}

// วาด AI message (รับ segments พร้อม SVG elements)
async function renderAiBubble(
  doc: any,
  segments: Segment[],
  chartSvgs: Map<string, SVGSVGElement>,
  y: number,
  useThaiFont: boolean
): Promise<number> {
  // violet accent bar
  doc.setFillColor(99, 102, 241)
  doc.rect(LEFT, y, 2, 4, 'F')

  doc.setFontSize(7.5)
  doc.setTextColor(99, 102, 241)
  if (useThaiFont) doc.setFont('THSarabunNew', 'normal')
  doc.text('AI', LEFT + 4, y + 3.5)
  doc.setTextColor(30, 30, 30)
  y += 6

  for (const seg of segments) {
    if (seg.type === 'text' && seg.content) {
      doc.setFontSize(10)
      if (useThaiFont) doc.setFont('THSarabunNew', 'normal')
      const lines: string[] = doc.splitTextToSize(seg.content, RIGHT - LEFT - 4)
      const needed = lines.length * 5.5 + 3
      y = ensureSpace(doc, y, needed)
      doc.text(lines, LEFT + 4, y)
      y += needed

    } else if (seg.type === 'table' && seg.rows.length > 1) {
      const head = [seg.rows[0]]
      const body = seg.rows.slice(1)
      y = ensureSpace(doc, y, 20)
      ;(doc as any).autoTable({
        head,
        body,
        startY: y,
        margin: { left: LEFT + 2, right: 14 },
        styles: {
          font: useThaiFont ? 'THSarabunNew' : 'helvetica',
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [99, 102, 241],
          textColor: [255, 255, 255],
          fontStyle: 'normal',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableWidth: 'wrap',
      })
      y = (doc as any).lastAutoTable.finalY + 5

    } else if (seg.type === 'chart') {
      const svgEl = chartSvgs.get(seg.id)
      if (svgEl) {
        const chartW = RIGHT - LEFT - 4
        const chartH = 70
        y = ensureSpace(doc, y, chartH + 4)
        try {
          await svg2pdf(svgEl, doc, { x: LEFT + 2, y, width: chartW, height: chartH })
        } catch (e) {
          console.warn('svg2pdf failed:', seg.id, e)
        }
        y += chartH + 5
      }
    }
  }

  return y + 3
}

// เพิ่มเลขหน้าทุก page
function addPageNumbers(doc: any) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`หน้า ${i} / ${total}  ·  AI Query System`, 105, PAGE_H - 8, { align: 'center' })
  }
}

// ฟังก์ชันหลัก — สร้าง PDF จาก selected messages
export async function generateChatPdf(
  selectedMessages: Array<{ role: string; content: string }>,
  chatContextLabel: string,
  chartSvgs: Map<string, SVGSVGElement>
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const useThaiFont = await loadThaiFont(doc)

  drawPdfHeader(doc, chatContextLabel, selectedMessages.length)

  let y = 35

  for (const msg of selectedMessages) {
    y = ensureSpace(doc, y, 15)
    if (msg.role === 'user') {
      y = renderUserBubble(doc, msg.content, y, useThaiFont)
    } else {
      const segs = parseMessageSegments(msg.content)
      y = await renderAiBubble(doc, segs, chartSvgs, y, useThaiFont)
    }
  }

  addPageNumbers(doc)
  return doc.output('blob')
}
