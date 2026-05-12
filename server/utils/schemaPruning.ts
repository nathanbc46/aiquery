/**
 * Utility for Hybrid Schema Selection (Schema Pruning)
 * Helps reduce prompt size by including only relevant Vtiger tables based on user query keywords.
 */

export interface PruningResult {
  finalInstruction: string;
  selectedTables: string[];
  isHybrid: boolean;
  reductionPercentage: number;
}

const MODULE_DEFINITIONS = [
  {
    name: 'Contacts',
    keywords: ['contact', 'ผู้ติดต่อ', 'รายชื่อผู้ติดต่อ', 'เบอร์โทรผู้ติดต่อ'],
    tables: ['vtiger_contactdetails'],
    patterns: [/contact/i, /ผู้ติดต่อ/i]
  },
  {
    name: 'Leads',
    keywords: ['lead', 'ลีด', 'ผู้สนใจ', 'รายชื่อผู้สนใจ', 'บริษัทที่สนใจ', 'converted', 'แปลงเป็นลูกค้า'],
    tables: ['vtiger_leaddetails', 'vtiger_leadaddress', 'vtiger_leadscf', 'vtiger_campaignleadrel', 'app_converted'],
    patterns: [/lead/i, /ลีด/i, /ผู้สนใจ/i, /converted/i, /แปลง/i]
  },
  {
    name: 'Opportunities',
    keywords: ['potential', 'opportunity', 'โอกาสการขาย', 'ดีล', 'deal', 'ยอดคาดการณ์'],
    tables: ['vtiger_potential', 'vtiger_potentialscf', 'vtiger_contpotentialrel', 'app_potential_product', 'vtiger_productcategory'],
    patterns: [/potential/i, /opp/i, /โอกาสการขาย/i, /ดีล/i, /deal/i]
  },
  {
    name: 'Campaigns',
    keywords: ['campaign', 'แคมเปญ', 'กิจกรรมการตลาด'],
    tables: ['vtiger_campaign', 'vtiger_campaignleadrel'],
    patterns: [/campaign/i, /แคมเปญ/i]
  },
  {
    name: 'Sales Orders',
    keywords: ['salesorder', 'so', 'ใบสั่งขาย', 'ยอดขาย', 'sales', 'revenue', 'รายได้'],
    tables: ['vtiger_salesorder', 'vtiger_salesordercf', 'vtiger_inventoryproductrel'],
    patterns: [/sales/i, /order/i, /ใบสั่งขาย/i, /ยอดขาย/i, /รายได้/i, /so\b/i]
  },
  {
    name: 'Quotes',
    keywords: ['quote', 'ใบเสนอราคา', 'เสนอราคา'],
    tables: ['vtiger_quotes', 'vtiger_inventoryproductrel'],
    patterns: [/quote/i, /ใบเสนอราคา/i, /เสนอราคา/i]
  },
  {
    name: 'Products',
    keywords: ['product', 'สินค้า', 'ราคาขาย', 'หมวดหมู่สินค้า'],
    tables: ['vtiger_products', 'vtiger_productcategory', 'vtiger_inventoryproductrel'],
    patterns: [/product/i, /สินค้า/i]
  },
  {
    name: 'Assets',
    keywords: ['asset', 'ทรัพย์สิน', 'serial', 'sn', 'หมดอายุ', 'วันที่ขาย'],
    tables: ['vtiger_assets', 'vtiger_assetscf'],
    patterns: [/asset/i, /ทรัพย์สิน/i, /serial/i, /sn\b/i, /หมดอายุ/i]
  }
];

// Tables that are ALWAYS included
const CORE_TABLES = [
  'vtiger_crmentity',
  'vtiger_users',
  'vtiger_user2role',
  'vtiger_role',
  'vtiger_account',
  'vtiger_accountscf'
];

/**
 * Prunes the system instruction to include only relevant tables.
 * @param fullInstruction The complete system instruction string.
 * @param userPrompt The user's natural language query.
 * @returns Object containing pruned instruction and debug info.
 */
export function pruneSchema(fullInstruction: string, userPrompt: string): PruningResult {
  // 1. Identify which modules are needed
  const selectedModules = MODULE_DEFINITIONS.filter(mod => 
    mod.patterns.some(pattern => pattern.test(userPrompt)) ||
    mod.keywords.some(kw => userPrompt.toLowerCase().includes(kw.toLowerCase()))
  );

  const neededTables = new Set([...CORE_TABLES]);
  selectedModules.forEach(mod => mod.tables.forEach(t => neededTables.add(t)));

  // 2. Parse the instruction and keep only relevant sections
  // We look for sections starting with "Table: vtiger_..." or "Table: app_..."
  const lines = fullInstruction.split('\n');
  const resultLines: string[] = [];
  
  let isInsideDiscardedTable = false;
  let currentTableName = '';

  for (const line of lines) {
    
    // Check if this line starts a new Table definition
    const tableMatch = line.match(/^Table: (vtiger_[a-z0-9_]+|app_[a-z0-9_]+)/i);
    if (tableMatch) {
      currentTableName = tableMatch[1]?.toLowerCase() || '';
      if (!neededTables.has(currentTableName)) {
        isInsideDiscardedTable = true;
      } else {
        isInsideDiscardedTable = false;
      }
    }

    // Check for other special sections like "Note on Sales Reporting"
    if (line.startsWith('Note on Sales Reporting:')) {
      if (!neededTables.has('vtiger_salesorder')) {
        isInsideDiscardedTable = true;
      } else {
        isInsideDiscardedTable = false;
      }
    }
    
    // Special case for Asset patterns (long explanation)
    if (line.startsWith('IMPORTANT QUERY PATTERN — ACTIVE ASSETS')) {
       if (!neededTables.has('vtiger_assets')) {
         isInsideDiscardedTable = true;
       } else {
         isInsideDiscardedTable = false;
       }
    }

    // Header and Rules are always included (they don't start with "Table:")
    // Rules start around line 295 in the original file
    if (line.startsWith('CRITICAL RULES FOR SQL GENERATION:')) {
      isInsideDiscardedTable = false;
    }

    if (!isInsideDiscardedTable) {
      resultLines.push(line);
    }
  }

  const finalInstruction = resultLines.join('\n');
  const reductionPercentage = Math.round((1 - finalInstruction.length / fullInstruction.length) * 100);

  return {
    finalInstruction,
    selectedTables: Array.from(neededTables),
    isHybrid: true,
    reductionPercentage
  };
}
