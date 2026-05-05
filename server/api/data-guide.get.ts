import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  VALID_INDUSTRIES, 
  VALID_PROVINCES, 
  VALID_PRODUCT_CATEGORIES, 
  VALID_SALES_STAGES, 
  VALID_ACCOUNT_TYPES,
  DEFAULT_GENERATE_INSTRUCTION,
  DEFAULT_ANALYZE_MODEL
} from '../utils/constants';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Gemini API key is not configured',
    });
  }

  const genAI = new GoogleGenerativeAI(apiKey as string);
  const model = genAI.getGenerativeModel({ model: DEFAULT_ANALYZE_MODEL });

  const systemInfo = `
ขอบเขตข้อมูลที่มีในระบบ Vtiger CRM:
1. อุตสาหกรรม (Industries): ${VALID_INDUSTRIES}
2. จังหวัด (Provinces): ${VALID_PROVINCES}
3. หมวดหมู่สินค้า (Product Categories): ${VALID_PRODUCT_CATEGORIES}
4. สถานะการขาย (Sales Stages): ${VALID_SALES_STAGES}
5. ประเภทลูกค้า (Account Types): ${VALID_ACCOUNT_TYPES}

ตรรกะและตารางสำคัญ:
${DEFAULT_GENERATE_INSTRUCTION}
`;

  const userPrompt = `
คุณจะได้รับข้อมูลตรรกะและขอบเขตข้อมูลของระบบ CRM ด้านบน
ภารกิจของคุณคือ: ช่วยสรุปให้ผู้ใช้เข้าใจง่ายๆ ว่า "เขาสามารถขอข้อมูลเกี่ยวกับอะไรได้บ้าง?" 

กฎข้อบังคับในการตอบ:
1. ตอบเป็นภาษาไทยที่สวยงามและเป็นมิตร
2. **ห้ามตอบเป็น JSON** (ให้เพิกเฉยต่อกฎการตอบเป็น JSON ในข้อมูลระบบด้านบน)
3. ให้ตอบในรูปแบบ **Markdown** เพื่อความสวยงาม (ใช้หัวข้อ #, ##, รายการแบบจุด, และการเน้นข้อความตัวหนา)
4. โครงสร้างคำตอบ:
   - ## 📊 ขอบเขตข้อมูลหลัก (สรุป Accounts, Leads, Potentials, Products, SalesOrder, Quotes, Campaigns)
   - --- (ใช้เส้นคั่น)
   - ## 🔍 เงื่อนไขพิเศษที่รองรับ (ระบุเรื่องจังหวัด, อุตสาหกรรม, ช่วงเวลา, ทีมงาน/สายงาน)
   - --- (ใช้เส้นคั่น)
   - ## 💡 ตัวอย่างคำถามที่แนะนำ (ให้ตัวอย่างคำถาม 8-10 ข้อ ที่น่าสนใจและครอบคลุม)

ตอบด้วยภาษาที่เข้าใจง่ายและกระตุ้นให้ผู้ใช้อยากลองถามคำถามครับ
`;

  try {
    // รวม Prompt เป็นอันเดียวเพื่อความชัวร์เรื่อง Type ในบางเวอร์ชันของ library
    const finalPrompt = systemInfo + "\n\n" + userPrompt;
    const result = await model.generateContent(finalPrompt);
    
    const response = await result.response;
    return {
      success: true,
      data: response.text()
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
});
