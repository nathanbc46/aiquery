import { useDb } from '../../../utils/db';
import { aiSettings } from '../../../utils/schema';
import { eq, sql } from 'drizzle-orm';
import { 
  DEFAULT_GENERATE_INSTRUCTION,
  VALID_PROVINCES 
} from '../../../utils/constants';

export default defineEventHandler(async (event) => {
  const db = await useDb();

  try {
    // 1. ดึงข้อมูลจากฐานข้อมูล Vtiger จริง (ยกเว้น Province)
    const fetchValues = async (query: string, key: string) => {
      try {
        const [rows]: any = await db.execute(sql.raw(query));
        return rows as any[];
      } catch (e) {
        console.warn(`Failed to fetch ${key}:`, e);
        return [];
      }
    };

    const industries = await fetchValues("SELECT industry FROM vtiger_industry WHERE industry != '' AND industry IS NOT NULL ORDER BY industry ASC", "industry");
    const roles = await fetchValues("SELECT rolename FROM vtiger_role WHERE rolename != '' AND rolename IS NOT NULL ORDER BY rolename ASC", "rolename");
    const categories = await fetchValues("SELECT productcategory FROM vtiger_productcategory WHERE productcategory != '' AND productcategory IS NOT NULL ORDER BY productcategory ASC", "productcategory");
    const stages = await fetchValues("SELECT sales_stage FROM vtiger_sales_stage WHERE sales_stage != '' AND sales_stage IS NOT NULL ORDER BY sales_stage_id ASC", "sales_stage");

    const cleanList = (rows: any[], key: string) => {
      if (!rows || rows.length === 0) return [];
      
      return rows
        .map(r => String(r[key]).trim())
        .filter(val => {
          if (!val || val === '' || val.toLowerCase() === '--none--') return false;
          
          const lowerVal = val.toLowerCase();
          const isGarbage = 
            lowerVal.includes('select') || 
            lowerVal.includes('sleep(') || 
            lowerVal.includes('waitfor') || 
            lowerVal.includes('@@') || 
            lowerVal.includes('concat(') || 
            lowerVal.includes('union') || 
            lowerVal.includes('--') ||
            lowerVal.includes('(') ||
            val.length > 50;
          
          return !isGarbage;
        });
    };

    const finalIndustries = [...new Set(cleanList(industries, 'industry'))].sort();
    const finalRoles = [...new Set(cleanList(roles, 'rolename'))].sort();
    const finalCategories = [...new Set(cleanList(categories, 'productcategory'))].sort();
    const finalStages = cleanList(stages, 'sales_stage');

    const formatForPrompt = (list: string[]) => {
      if (list.length === 0) return "''";
      return list.map(item => `'${item.replace(/'/g, "''")}'`).join(',');
    };

    const newIndustries = formatForPrompt(finalIndustries);
    const newRoles = formatForPrompt(finalRoles);
    const newCategories = formatForPrompt(finalCategories);
    const newStages = formatForPrompt(finalStages);

    // 2. ดึงค่าปัจจุบันจากฐานข้อมูล
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    let currentInstruction = settings[0]?.generateSystemInstruction || DEFAULT_GENERATE_INSTRUCTION;

    // 3. สร้างก้อนข้อความ MASTER PICKLIST VALUES ใหม่ (Province ใช้ค่าจาก constants.ts)
    const picklistSection = `MASTER PICKLIST VALUES:
- INDUSTRIES: ${newIndustries}
- PROVINCES: ${VALID_PROVINCES}
- PRODUCT_CATEGORIES: ${newCategories}
- ROLES: ${newRoles}
- SALES_STAGES: ${newStages}`;

    // Regex เพื่อค้นหาและแทนที่ส่วน MASTER PICKLIST VALUES เดิม
    const regex = /MASTER PICKLIST VALUES:[\s\S]*?(?=\n\nTable:|\n\nCRITICAL RULES)/;
    
    let updatedInstruction = currentInstruction;
    if (regex.test(currentInstruction)) {
      updatedInstruction = currentInstruction.replace(regex, picklistSection);
    } else {
      updatedInstruction = picklistSection + '\n\n' + currentInstruction;
    }

    // 4. บันทึกลงฐานข้อมูล
    await db.update(aiSettings)
      .set({ generateSystemInstruction: updatedInstruction })
      .where(eq(aiSettings.id, 'global'));

    return { 
      success: true, 
      message: 'อัปเดต Master Picklist เรียบร้อยแล้ว (ใช้รายชื่อจังหวัดมาตรฐาน)',
      updatedInstruction
    };

  } catch (error: any) {
    console.error('Sync Picklists Error:', error);
    return { 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการประมวลผล: ' + error.message 
    };
  }
});
