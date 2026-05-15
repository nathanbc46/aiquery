export default defineEventHandler(async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY ยังไม่ได้ตั้งค่าใน .env' };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return { success: false, error: 'ไม่สามารถดึงข้อมูลโมเดลจาก Gemini API ได้' };
    }

    const data = await response.json();
    
    // กรองเฉพาะโมเดลประเภท "generateContent" (Text/Chat/Code) 
    // และตัดพวกเก่าหรือ deprecated ออกบางส่วนถ้าต้องการ
    const models = data.models
      .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
        version: m.version
      }));

    return {
      success: true,
      models
    };
  } catch (error: any) {
    console.error('Fetch Models Error:', error);
    return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลโมเดล' };
  }
});
