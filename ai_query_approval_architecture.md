# Architecture & Implementation Plan: AI Query & Approval System (Vtiger CRM)

## 1. System Overview
ระบบเปลี่ยนภาษาธรรมชาติ (Natural Language) เป็น SQL สำหรับสอบถามข้อมูลจาก Vtiger CRM 8.4 โดยเน้นความปลอดภัยของข้อมูล (Read-only) และมีระบบ Workflow การอนุมัติ (Approval) จากหัวหน้างานก่อนดึงข้อมูลจริง ทำงานบน Nuxt 4 + Drizzle ORM / MySQL2 + Google Gemini API

## 2. Core Workflow (2-Step Execution)
1. **User Request & Preview:**
   - ผู้ใช้งานพิมพ์คำถาม (เช่น "ขอลูกค้าที่มียอดสั่งซื้อเกิน 1 แสนบาทในปีนี้")
   - ระบบส่งไปยัง Gemini API พร้อม Context โครงสร้างตาราง Vtiger
   - Gemini สร้าง SQL (เฉพาะ `SELECT`) และคำอธิบายภาษาไทย
   - ระบบจำลองรันคำสั่ง `SELECT COUNT(*) FROM (...)` ด้วย Database User ที่เป็น Read-Only
   - แสดงตัวอย่าง (จำนวนรายการที่พบ) ให้ผู้ใช้งานดู
2. **Approval & Execution:**
   - ผู้ใช้กด "ขออนุมัติดึงข้อมูล" (Request Approval)
   - หัวหน้างาน (Manager) เข้ามาดู Dashboard เห็นคำถาม, คำอธิบายภาษาไทย, โค้ด SQL, และจำนวนรายการ
   - หัวหน้ากด "Approve"
   - ระบบรัน SQL จริงเพื่อดึงข้อมูลเต็มรูปแบบ และสร้างไฟล์ CSV/JSON สำหรับ Download

## 3. Tech Stack & Tools
- **Framework:** Nuxt 4 (Server Routes & Auto-imports)
- **UI:** Tailwind CSS + Nuxt UI (เน้น Enterprise-look)
- **Database:** MySQL2 (เชื่อมต่อตรงกับ Vtiger) + Drizzle ORM (เพื่อความปลอดภัยและ Type-safety)
- **AI:** Google Gemini API (หรือ `@google/generative-ai`)
- **State Management:** Pinia (สำหรับเก็บ State ของ User/Manager)

## 4. Directory Structure (Nuxt 4)
```text
project-root/
├── app/
│   ├── components/
│   │   └── ai-query/
│   │       ├── ChatBox.vue           # ช่องกรอกคำถามภาษาไทย
│   │       ├── SqlPreview.vue        # แสดง SQL แบบ Read-only Code Block พร้อม Highlight
│   │       └── ApprovalList.vue      # ตารางแสดงรายการรออนุมัติสำหรับ Manager
│   ├── pages/
│   │   └── ai-query/
│   │       ├── index.vue             # หน้าจอหลักสำหรับพนักงาน (User) ขอข้อมูล
│   │       └── approvals.vue         # หน้าจอ Dashboard สำหรับ Manager
├── server/
│   ├── api/
│   │   └── ai-query/
│   │       ├── generate.post.ts      # เรียก Gemini แปลง Text-to-SQL + คำอธิบาย
│   │       ├── preview.post.ts       # รัน COUNT(*)
│   │       ├── request.post.ts       # บันทึกคำขอลงฐานข้อมูล (สถานะ PENDING)
│   │       ├── pending.get.ts        # ดึงรายการ PENDING สำหรับ Manager
│   │       ├── approve.post.ts       # อนุมัติและรัน SQL ดึงข้อมูลจริง
│   │       └── export.get.ts         # ให้ดาวน์โหลดผลลัพธ์เป็น CSV
│   └── utils/
│       ├── db.ts                     # ตั้งค่า MySQL2/Drizzle (เน้น Read-only User)
│       ├── gemini.ts                 # ตั้งค่า Gemini Prompt & System Instructions
│       └── vtigerSchema.ts           # RAG Context สำหรับ Vtiger CRM Schema
```

## 5. Security Guardrails (สำคัญมาก)
1. **Database Level:** ต้องสร้าง User ใน MySQL ที่มีสิทธิ์แค่ `SELECT` เท่านั้น ห้ามมีสิทธิ์ `INSERT`, `UPDATE`, `DELETE`, `DROP` เด็ดขาด
2. **AI Level:** System Prompt ต้องสั่ง Gemini อย่างชัดเจน: 
   - "ห้ามสร้างคำสั่งที่แก้ไขข้อมูลเด็ดขาด"
   - "ใช้เฉพาะ SELECT"
   - "จำกัด LIMIT เสมอ หากไม่ได้ระบุ"
3. **Application Level:** 
   - ระบบจะตรวจจับคำสั่ง SQL ก่อนรัน หากพบคำว่า `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `EXEC` ระบบจะ Block ทันที
   - ก่อนรันจริงจะครอบด้วย `SELECT COUNT(*) FROM (...) AS sub` เสมอในตอน Preview

## 6. Database Schema (ระบบ Approval Workflow)
เราจำเป็นต้องมีตารางสำหรับเก็บ History การขอข้อมูล (สามารถสร้างใน Vtiger DB หรือแยกฐานข้อมูลได้):
```sql
CREATE TABLE ai_query_requests (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    query_text TEXT NOT NULL,
    generated_sql TEXT NOT NULL,
    explanation_th TEXT NOT NULL,
    result_count INT DEFAULT 0,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 7. Next Steps (การดำเนินการต่อไป)
1. ติดตั้ง Dependencies (Drizzle ORM, MySQL2, Google Generative AI)
2. สร้างหน้า UI Layouts (User Request & Manager Dashboard)
3. พัฒนาฝั่ง Server API (เชื่อม Gemini และ MySQL)
4. ทดสอบและเพิ่ม Guardrails ความปลอดภัย
