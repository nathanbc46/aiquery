import { useDb } from '../../utils/db';
import { aiQueryRequests } from '../../utils/schema';
import { eq, and, sql } from 'drizzle-orm';
import { Parser } from '@json2csv/plainjs';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const requestId = query.id as string;

  if (!requestId) {
    throw createError({ statusCode: 400, statusMessage: 'Request ID is required' });
  }

  try {
    const db = await useDb();
    
    // 1. Verify the request exists and is APPROVED
    const requests = await db.select()
      .from(aiQueryRequests)
      .where(and(
        eq(aiQueryRequests.id, requestId),
        eq(aiQueryRequests.status, 'APPROVED')
      ))
      .limit(1);

    const request = requests[0];
    if (!request) {
      throw createError({ statusCode: 404, statusMessage: 'Request not found' });
    }
    
    const sqlToRun = request.generatedSql;

    // 2. Execute the full SQL query
    const [rows]: any = await db.execute(sql.raw(sqlToRun));

    if (!rows || rows.length === 0) {
      return "No data found for this query.";
    }

    // 3. Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(rows);

    // 4. Set headers for file download
    setHeaders(event, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="vtiger_export_${requestId}.csv"`
    });

    return csv;

  } catch (error: any) {
    console.error('Export Error:', error);
    throw createError({ statusCode: 500, statusMessage: `Export failed: ${error.message}` });
  }
});
