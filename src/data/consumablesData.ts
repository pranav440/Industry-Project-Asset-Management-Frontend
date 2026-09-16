// =====================================================================
// AssetMX Consumables Data Store & Demonstration Records
// Local storage state with initial realistic synthetic data
// =====================================================================

export type ConsumableStockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface ConsumableItem {
  id: string; // e.g. CON-2026-0811
  name: string;
  category: string;
  batchId: string;
  location: string;
  availableStock: number;
  threshold: number;
  expiryDate?: string; // YYYY-MM-DD or empty
  status: ConsumableStockStatus;
}

export interface ConsumptionHistoryEntry {
  id: string;
  issueDate: string;
  quantity: number;
  requestReference: string;
  issuedBy: string;
  remainingStock: number;
}

export interface StockMovementEntry {
  id: string;
  timestamp: string;
  operationType: 'Disbursement / Issue' | 'Stock Adjustment / Correction' | 'Initial Inward / Batch Receipt';
  deltaQuantity: number; // positive or negative
  postBalance: number;
  reference: string;
}

export interface ConsumableDetailsData extends ConsumableItem {
  batchQuantity: number;
  issueHistory: ConsumptionHistoryEntry[];
  movementLedger: StockMovementEntry[];
}

export const INITIAL_CONSUMABLES: ConsumableDetailsData[] = [
  {
    id: 'CON-2026-0101',
    name: 'Cyan Dye Ink Cartridge (T502)',
    category: 'Printing & Inks',
    batchId: 'BAT-2026-09A',
    location: 'HQ - Floor 4 IT Storage',
    availableStock: 12,
    threshold: 15,
    expiryDate: '2026-10-15',
    status: 'Low Stock',
    batchQuantity: 50,
    issueHistory: [
      {
        id: 'ISS-001',
        issueDate: '2026-09-12 14:30',
        quantity: 3,
        requestReference: 'REQ-PRN-8821 (Graphic Design Dept)',
        issuedBy: 'Marcus Vance (Admin)',
        remainingStock: 12,
      },
      {
        id: 'ISS-002',
        issueDate: '2026-09-01 10:15',
        quantity: 5,
        requestReference: 'REQ-PRN-8790 (Marketing Suite)',
        issuedBy: 'Sarah Jenkins (IT Lead)',
        remainingStock: 15,
      },
    ],
    movementLedger: [
      {
        id: 'MOV-001',
        timestamp: '2026-09-12 14:30',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -3,
        postBalance: 12,
        reference: 'Disbursed to Graphic Design Dept (REQ-PRN-8821)',
      },
      {
        id: 'MOV-002',
        timestamp: '2026-09-01 10:15',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -5,
        postBalance: 15,
        reference: 'Disbursed to Marketing Suite (REQ-PRN-8790)',
      },
      {
        id: 'MOV-003',
        timestamp: '2026-08-15 09:00',
        operationType: 'Initial Inward / Batch Receipt',
        deltaQuantity: 50,
        postBalance: 50,
        reference: 'PO-2026-771 Batch Intake Inward',
      },
    ],
  },
  {
    id: 'CON-2026-0102',
    name: 'Cat6 Shielded RJ45 Patch Cables (2m)',
    category: 'Networking Cables',
    batchId: 'BAT-2026-14B',
    location: 'Server Room - Rack B04',
    availableStock: 85,
    threshold: 20,
    expiryDate: '',
    status: 'In Stock',
    batchQuantity: 100,
    issueHistory: [
      {
        id: 'ISS-003',
        issueDate: '2026-09-10 11:20',
        quantity: 15,
        requestReference: 'REQ-NET-4401 (Switch Expansion)',
        issuedBy: 'Marcus Vance (Admin)',
        remainingStock: 85,
      },
    ],
    movementLedger: [
      {
        id: 'MOV-004',
        timestamp: '2026-09-10 11:20',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -15,
        postBalance: 85,
        reference: 'Switch Expansion Deployment (REQ-NET-4401)',
      },
      {
        id: 'MOV-005',
        timestamp: '2026-08-20 14:00',
        operationType: 'Initial Inward / Batch Receipt',
        deltaQuantity: 100,
        postBalance: 100,
        reference: 'Inward PO-2026-802 Batch',
      },
    ],
  },
  {
    id: 'CON-2026-0103',
    name: 'Thermal Compound Paste (Artic MX-4 4g)',
    category: 'Hardware Maintenance',
    batchId: 'BAT-2025-88X',
    location: 'HQ - Floor 2 Workshop',
    availableStock: 0,
    threshold: 5,
    expiryDate: '2026-08-30',
    status: 'Out of Stock',
    batchQuantity: 25,
    issueHistory: [
      {
        id: 'ISS-004',
        issueDate: '2026-09-05 16:45',
        quantity: 4,
        requestReference: 'REQ-HW-1192 (Server Heatsink Repasting)',
        issuedBy: 'David Kim (Hardware Tech)',
        remainingStock: 0,
      },
    ],
    movementLedger: [
      {
        id: 'MOV-006',
        timestamp: '2026-09-05 16:45',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -4,
        postBalance: 0,
        reference: 'Server Heatsink Overhaul (REQ-HW-1192)',
      },
      {
        id: 'MOV-007',
        timestamp: '2026-07-10 09:30',
        operationType: 'Initial Inward / Batch Receipt',
        deltaQuantity: 25,
        postBalance: 25,
        reference: 'Initial Inward PO-2025-993',
      },
    ],
  },
  {
    id: 'CON-2026-0104',
    name: 'Standard A4 Multipurpose Copy Paper (500 Sheets)',
    category: 'Stationery & Office',
    batchId: 'BAT-2026-44P',
    location: 'Warehouse - Bay C2',
    availableStock: 140,
    threshold: 30,
    expiryDate: '',
    status: 'In Stock',
    batchQuantity: 200,
    issueHistory: [
      {
        id: 'ISS-005',
        issueDate: '2026-09-14 09:00',
        quantity: 20,
        requestReference: 'REQ-ADM-3022 (Finance Monthly Auditing)',
        issuedBy: 'Elena Rostova (Office Mgr)',
        remainingStock: 140,
      },
    ],
    movementLedger: [
      {
        id: 'MOV-008',
        timestamp: '2026-09-14 09:00',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -20,
        postBalance: 140,
        reference: 'Finance Dept Monthly Allotment (REQ-ADM-3022)',
      },
      {
        id: 'MOV-009',
        timestamp: '2026-08-01 10:00',
        operationType: 'Initial Inward / Batch Receipt',
        deltaQuantity: 200,
        postBalance: 200,
        reference: 'Quarterly Office Supply PO-2026-610',
      },
    ],
  },
  {
    id: 'CON-2026-0105',
    name: 'Nitrile Antistatic Cleanroom Gloves (Size L)',
    category: 'Lab Equipment',
    batchId: 'BAT-2026-03L',
    location: 'Lab - Building A',
    availableStock: 6,
    threshold: 25,
    expiryDate: '2026-11-01',
    status: 'Low Stock',
    batchQuantity: 50,
    issueHistory: [
      {
        id: 'ISS-006',
        issueDate: '2026-09-11 13:00',
        quantity: 14,
        requestReference: 'REQ-LAB-703 (Cleanroom Restock)',
        issuedBy: 'Dr. Aris Thorne',
        remainingStock: 6,
      },
    ],
    movementLedger: [
      {
        id: 'MOV-010',
        timestamp: '2026-09-11 13:00',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -14,
        postBalance: 6,
        reference: 'Cleanroom Restock (REQ-LAB-703)',
      },
      {
        id: 'MOV-011',
        timestamp: '2026-07-25 11:30',
        operationType: 'Initial Inward / Batch Receipt',
        deltaQuantity: 50,
        postBalance: 50,
        reference: 'Lab Safety Batch PO-2026-550',
      },
    ],
  },
  {
    id: 'CON-2026-0106',
    name: 'Lithium CR2032 3V CMOS Batteries (10-pack)',
    category: 'Hardware Maintenance',
    batchId: 'BAT-2026-21M',
    location: 'HQ - Floor 4 IT Storage',
    availableStock: 4,
    threshold: 10,
    expiryDate: '2026-09-28',
    status: 'Low Stock',
    batchQuantity: 30,
    issueHistory: [
      {
        id: 'ISS-007',
        issueDate: '2026-09-08 15:20',
        quantity: 6,
        requestReference: 'REQ-HW-1180 (Motherboard CMOS Replacements)',
        issuedBy: 'Marcus Vance (Admin)',
        remainingStock: 4,
      },
    ],
    movementLedger: [
      {
        id: 'MOV-012',
        timestamp: '2026-09-08 15:20',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -6,
        postBalance: 4,
        reference: 'Workstation Battery Service (REQ-HW-1180)',
      },
      {
        id: 'MOV-013',
        timestamp: '2026-06-15 08:30',
        operationType: 'Initial Inward / Batch Receipt',
        deltaQuantity: 30,
        postBalance: 30,
        reference: 'Inward PO-2026-412',
      },
    ],
  },
  {
    id: 'CON-2026-0107',
    name: 'Isopropyl Alcohol 99.9% Electronic Cleaner (500ml)',
    category: 'Hardware Maintenance',
    batchId: 'BAT-2024-19X',
    location: 'HQ - Floor 2 Workshop',
    availableStock: 18,
    threshold: 10,
    expiryDate: '2026-07-15',
    status: 'In Stock',
    batchQuantity: 40,
    issueHistory: [
      {
        id: 'ISS-008',
        issueDate: '2026-08-22 10:00',
        quantity: 2,
        requestReference: 'REQ-HW-1014 (PCB Cleaning Workshop)',
        issuedBy: 'David Kim (Hardware Tech)',
        remainingStock: 18,
      },
    ],
    movementLedger: [
      {
        id: 'MOV-014',
        timestamp: '2026-08-22 10:00',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -2,
        postBalance: 18,
        reference: 'Routine Maintenance Dispense (REQ-HW-1014)',
      },
      {
        id: 'MOV-015',
        timestamp: '2024-08-01 10:00',
        operationType: 'Initial Inward / Batch Receipt',
        deltaQuantity: 40,
        postBalance: 40,
        reference: 'Chemical Supply PO-2024-210',
      },
    ],
  },
  {
    id: 'CON-2026-0108',
    name: 'Label Tape Cartridge Black on White (12mm)',
    category: 'Printing & Inks',
    batchId: 'BAT-2026-02K',
    location: 'Warehouse - Bay C2',
    availableStock: 35,
    threshold: 10,
    expiryDate: '',
    status: 'In Stock',
    batchQuantity: 50,
    issueHistory: [
      {
        id: 'ISS-009',
        issueDate: '2026-09-02 11:00',
        quantity: 5,
        requestReference: 'REQ-LOG-092 (Asset Tagging Project)',
        issuedBy: 'Marcus Vance (Admin)',
        remainingStock: 35,
      },
    ],
    movementLedger: [
      {
        id: 'MOV-016',
        timestamp: '2026-09-02 11:00',
        operationType: 'Disbursement / Issue',
        deltaQuantity: -5,
        postBalance: 35,
        reference: 'Asset Tagging Campaign (REQ-LOG-092)',
      },
      {
        id: 'MOV-017',
        timestamp: '2026-08-10 14:00',
        operationType: 'Initial Inward / Batch Receipt',
        deltaQuantity: 50,
        postBalance: 50,
        reference: 'Label Supplies PO-2026-780',
      },
    ],
  },
];

const LOCAL_STORAGE_KEY = 'amx_consumables_records_v1';

export function getStoredConsumables(): ConsumableDetailsData[] {
  if (typeof window === 'undefined') return INITIAL_CONSUMABLES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load stored consumables from localStorage', e);
  }
  return INITIAL_CONSUMABLES;
}

export function saveStoredConsumables(items: ConsumableDetailsData[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save consumables to localStorage', e);
  }
}

export function computeStockStatus(stock: number, threshold: number): ConsumableStockStatus {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= threshold) return 'Low Stock';
  return 'In Stock';
}

export function getExpiryClassification(expiryDate?: string): 'none' | 'normal' | 'upcoming' | 'expired' {
  if (!expiryDate || expiryDate.trim() === '') return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) return 'none';
  
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'expired';
  if (diffDays <= 45) return 'upcoming';
  return 'normal';
}

export const CONSUMABLE_FILTER_OPTIONS = {
  categories: [
    { value: '', label: 'All Categories' },
    { value: 'Printing & Inks', label: 'Printing & Inks' },
    { value: 'Networking Cables', label: 'Networking Cables' },
    { value: 'Hardware Maintenance', label: 'Hardware Maintenance' },
    { value: 'Stationery & Office', label: 'Stationery & Office' },
    { value: 'Lab Equipment', label: 'Lab Equipment' },
  ],
  stockStatuses: [
    { value: '', label: 'All Stock Statuses' },
    { value: 'In Stock', label: 'In Stock' },
    { value: 'Low Stock', label: 'Low Stock' },
    { value: 'Out of Stock', label: 'Out of Stock' },
  ],
  expiries: [
    { value: '', label: 'All Expiry States' },
    { value: 'normal', label: 'Normal / Long Term' },
    { value: 'upcoming', label: 'Expiring Soon (<=45 days)' },
    { value: 'expired', label: 'Expired' },
    { value: 'none', label: 'No Expiry Set' },
  ],
  locations: [
    { value: '', label: 'All Locations' },
    { value: 'HQ - Floor 4 IT Storage', label: 'HQ - Floor 4 IT Storage' },
    { value: 'HQ - Floor 2 Workshop', label: 'HQ - Floor 2 Workshop' },
    { value: 'Lab - Building A', label: 'Lab - Building A' },
    { value: 'Server Room - Rack B04', label: 'Server Room - Rack B04' },
    { value: 'Warehouse - Bay C2', label: 'Warehouse - Bay C2' },
  ],
};
