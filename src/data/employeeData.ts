// =====================================================================
// AssetMX Employee Scoped Data Store & Types
// Scopes requests, assigned assets, and consumption to the authenticated employee
// =====================================================================

import { type AuthUser } from '../auth/session';
import { getStoredRequests, addStoredRequest, type RequestItemData } from './requestsData';

export interface EmployeeAssignedAsset {
  id: string;
  legacyId?: string;
  name: string;
  altName?: string;
  category: string;
  categoryKey?: 'compute' | 'displays' | 'peripherals' | 'mobile';
  location: string;
  status: string;
  statusCode?: 'active' | 'maintenance' | 'transit' | 'disposed';
  icon: string;
  verificationStatus: 'Verified' | 'Active';
  specification?: string;
  assignedDate?: string;
  custodianName?: string;
  custodianEmpId?: string;
  custodianDepartment?: string;
  serialNumber?: string;
  hardwareModel?: string;
  technicalSpecs?: Array<{ label: string; value: string }>;
  custodyLog?: Array<{ date: string; time: string; event: string }>;
  acquisition?: {
    purchaseDate?: string;
    warrantyStatus?: string;
    warrantyCover?: string;
    totalCost?: string;
  };
}

export interface EmployeeConsumptionCategory {
  name: string;
  units: number;
  percentage: number;
  color: string;
}

export interface EmployeeConsumptionSummary {
  period: string;
  cycleReference: string;
  totalIssued: number;
  activeCategoriesCount: number;
  categories: EmployeeConsumptionCategory[];
}

export interface EmployeeDashboardMetrics {
  openRequests: number;
  awaitingApproval: number;
  assignedAssetsCount: number;
  consumablesReceived: number;
}

// Default demonstration assigned assets formally allocated to the employee (Marcus Vance)
export const DEFAULT_EMPLOYEE_ASSETS: EmployeeAssignedAsset[] = [
  {
    id: 'AST-2024-0042',
    legacyId: 'AST-NC-2026-0012',
    name: 'Apple MacBook Pro 16"',
    altName: 'Dell Latitude 5430 Laptop',
    category: 'Laptops & Compute',
    categoryKey: 'compute',
    location: 'HQ - Bldg B, Floor 4, Desk B-412',
    status: 'Active / In Custody',
    statusCode: 'active',
    icon: 'laptop_mac',
    verificationStatus: 'Verified',
    specification: 'M3 Max, 36GB Unified Memory, 1TB SSD • Space Black',
    assignedDate: '12 Jan 2024',
    custodianName: 'Marcus Vance',
    custodianEmpId: 'EMP-4092',
    custodianDepartment: 'Product Design & UX',
    serialNumber: 'C02G901QMD6T',
    hardwareModel: 'Model A2991 • Space Black • Released Late 2023',
    technicalSpecs: [
      { label: 'Hardware Serial Number', value: 'C02G901QMD6T' },
      { label: 'SoC / Processor', value: 'Apple M3 Max (14c CPU / 30c GPU)' },
      { label: 'Memory', value: '36 GB Unified Memory' },
      { label: 'Internal Storage', value: '1 TB NVMe SSD' },
      { label: 'Operating System', value: 'macOS Sonoma 14.4 (Managed MDM)' },
    ],
    custodyLog: [
      { date: '12 Jan 2024', time: '09:30 AM', event: 'Formally assigned and handed over to Marcus Vance (Workstation deployment).' },
      { date: '10 Jan 2024', time: '02:15 PM', event: 'Received into corporate inventory by IT Hardware Operations.' },
    ],
    acquisition: {
      purchaseDate: '10 Jan 2024',
      warrantyStatus: 'Valid until Jan 2027',
      warrantyCover: 'AppleCare+ for Enterprise (3 Yrs)',
      totalCost: '₹3,49,900',
    },
  },
  {
    id: 'AST-2024-0109',
    legacyId: 'AST-DS-2025-0489',
    name: 'Dell UltraSharp 32" 4K PremierColor',
    altName: 'Apple Studio Display 27"',
    category: 'Displays & Monitors',
    categoryKey: 'displays',
    location: 'HQ - Bldg B, Floor 4, Desk B-412',
    status: 'Active / In Custody',
    statusCode: 'active',
    icon: 'monitor',
    verificationStatus: 'Verified',
    specification: 'U3223QE, IPS Black, 90W USB-C Hub integrated',
    assignedDate: '15 Mar 2024',
    custodianName: 'Marcus Vance',
    custodianEmpId: 'EMP-4092',
    custodianDepartment: 'Product Design & UX',
    serialNumber: 'CN-0V2Y89-74261-43M-091A',
    hardwareModel: 'U3223QE • IPS Black • 90W USB-C Hub',
    technicalSpecs: [
      { label: 'Hardware Serial Number', value: 'CN-0V2Y89-74261-43M-091A' },
      { label: 'Resolution', value: '3840 x 2160 at 60Hz (4K UHD)' },
      { label: 'Panel Type', value: 'IPS Black Technology, Contrast 2000:1' },
      { label: 'Connectivity', value: 'USB-C Hub (90W Power Delivery), DisplayPort 1.4, HDMI 2.0' },
      { label: 'Color Gamut', value: '100% sRGB, 98% DCI-P3, Delta E < 2' },
    ],
    custodyLog: [
      { date: '15 Mar 2024', time: '11:00 AM', event: 'Allocated to Marcus Vance for desk setup B-412.' },
      { date: '14 Mar 2024', time: '04:30 PM', event: 'Unboxed and color calibrated by IT Operations.' },
    ],
    acquisition: {
      purchaseDate: '14 Mar 2024',
      warrantyStatus: 'Valid until Mar 2027',
      warrantyCover: '3-Year Advanced Exchange Service',
      totalCost: '₹89,500',
    },
  },
  {
    id: 'AST-2024-0322',
    legacyId: 'AST-AU-2025-1102',
    name: 'Keychron Q1 Pro Mechanical Keyboard',
    altName: 'Jabra Evolve2 65 Headset',
    category: 'Peripherals & Input',
    categoryKey: 'peripherals',
    location: 'Remote / Home Office',
    status: 'Active / In Custody',
    statusCode: 'active',
    icon: 'keyboard',
    verificationStatus: 'Active',
    specification: 'QMK Wireless 75% Layout, Red Switches, Carbon Black',
    assignedDate: '08 Aug 2024',
    custodianName: 'Marcus Vance',
    custodianEmpId: 'EMP-4092',
    custodianDepartment: 'Product Design & UX',
    serialNumber: 'KC-Q1P-2024-8841',
    hardwareModel: 'Keychron Q1 Pro (75% ANSI QMK/VIA)',
    technicalSpecs: [
      { label: 'Hardware Serial Number', value: 'KC-Q1P-2024-8841' },
      { label: 'Connectivity', value: 'Bluetooth 5.1 & Type-C Wired' },
      { label: 'Switch Type', value: 'K Pro Red Mechanical (Hot-swappable)' },
      { label: 'Body Material', value: 'Full CNC machined 6063 aluminum' },
      { label: 'Battery Capacity', value: '4000mAh Rechargeable Li-polymer' },
    ],
    custodyLog: [
      { date: '08 Aug 2024', time: '02:00 PM', event: 'Issued for approved hybrid ergonomic workstation policy.' },
      { date: '05 Aug 2024', time: '01:15 PM', event: 'Received from vendor and inventoried.' },
    ],
    acquisition: {
      purchaseDate: '05 Aug 2024',
      warrantyStatus: 'Valid until Aug 2025',
      warrantyCover: '1-Year Manufacturer Warranty',
      totalCost: '₹18,900',
    },
  },
  {
    id: 'AST-2023-0881',
    legacyId: 'AST-SC-2024-0095',
    name: 'Apple iPad Pro 12.9"',
    altName: 'YubiKey 5C NFC Security Key',
    category: 'Mobile Devices',
    categoryKey: 'mobile',
    location: 'HQ - IT Service Lab (B-102)',
    status: 'In Maintenance',
    statusCode: 'maintenance',
    icon: 'tablet_mac',
    verificationStatus: 'Active',
    specification: '6th Gen, Wi-Fi 256GB Space Gray • Liquid Retina XDR',
    assignedDate: '20 Nov 2024',
    custodianName: 'Marcus Vance',
    custodianEmpId: 'EMP-4092',
    custodianDepartment: 'Product Design & UX',
    serialNumber: 'DMPXQ29VHP50',
    hardwareModel: 'Model A2436 • Space Gray • Wi-Fi 256GB',
    technicalSpecs: [
      { label: 'Hardware Serial Number', value: 'DMPXQ29VHP50' },
      { label: 'Chip', value: 'Apple M2 (8-core CPU / 10-core GPU / 16-core Neural Engine)' },
      { label: 'Display', value: '12.9-inch Liquid Retina XDR with ProMotion 120Hz' },
      { label: 'Storage', value: '256 GB High-speed Flash' },
      { label: 'Service Ticket', value: 'TKT-IT-2026-4491 (Battery diagnostic & thermal servicing)' },
    ],
    custodyLog: [
      { date: '20 Nov 2024', time: '10:15 AM', event: 'Handed over to IT Service Lab (B-102) for battery diagnostic inspection.' },
      { date: '15 Jan 2024', time: '09:00 AM', event: 'Initially issued to Marcus Vance for tablet UX testing.' },
    ],
    acquisition: {
      purchaseDate: '15 Jan 2024',
      warrantyStatus: 'Active (Covered under Enterprise Support)',
      warrantyCover: 'AppleCare+ for Enterprise',
      totalCost: '₹1,12,900',
    },
  },
];

// Default demonstration consumption records for the current monthly cycle
export const DEFAULT_EMPLOYEE_CONSUMPTION: EmployeeConsumptionSummary = {
  period: 'This Month',
  cycleReference: 'REC-2026-M2',
  totalIssued: 18,
  activeCategoriesCount: 4,
  categories: [
    {
      name: 'Office & Printing Supplies',
      units: 8,
      percentage: 44.4,
      color: '#00687a',
    },
    {
      name: 'IT Cables & Adapters',
      units: 4,
      percentage: 22.2,
      color: '#4cd7f6',
    },
    {
      name: 'Cleaning & Sanitization',
      units: 4,
      percentage: 22.2,
      color: '#57dffe',
    },
    {
      name: 'Pantry & Refreshments',
      units: 2,
      percentage: 11.1,
      color: '#8b95ad',
    },
  ],
};

// Stitch-approved initial requests for Marcus Vance / Demo Employee
export const SEED_EMPLOYEE_REQUESTS: RequestItemData[] = [
  {
    id: 'REQ-2026-0841',
    requesterName: 'Marcus Vance',
    requesterEmail: 'employee@assetmx.local',
    department: 'Product Design',
    requestType: 'Asset Request',
    requestedItem: 'Dell UltraSharp 27" 4K Monitor',
    category: 'Hardware • Display',
    quantity: 1,
    priority: 'High',
    requestDate: '2026-02-24',
    status: 'In Review',
    justification: 'High-resolution color-accurate display required for enterprise UI design system overhaul.',
    attachments: [
      {
        id: 'att-841-1',
        name: 'Monitor_Requirements_Justification.pdf',
        size: '1.2 MB',
        uploadDate: '2026-02-24',
      },
      {
        id: 'att-841-2',
        name: 'Workstation_Spec_Sheet.pdf',
        size: '840 KB',
        uploadDate: '2026-02-24',
      },
    ],
    history: [
      {
        id: 'EVT-841-1',
        timestamp: '2026-02-24 09:30',
        stage: 'In Review',
        action: 'Under procurement assessment',
        performedBy: 'Administrator',
      },
      {
        id: 'EVT-841-2',
        timestamp: '2026-02-24 08:45',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Marcus Vance',
      },
    ],
  },
  {
    id: 'REQ-2026-0820',
    requesterName: 'Marcus Vance',
    requesterEmail: 'employee@assetmx.local',
    department: 'Product Design',
    requestType: 'Asset Request',
    requestedItem: 'Logitech MX Master 3S',
    category: 'Peripherals • Input',
    quantity: 1,
    priority: 'Medium',
    requestDate: '2026-02-21',
    status: 'Pending',
    justification: 'Ergonomic mouse for prolonged CAD and vector interface development.',
    history: [
      {
        id: 'EVT-820-1',
        timestamp: '2026-02-21 11:15',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Marcus Vance',
      },
    ],
  },
  {
    id: 'REQ-2026-0792',
    requesterName: 'Marcus Vance',
    requesterEmail: 'employee@assetmx.local',
    department: 'Product Design',
    requestType: 'Asset Request',
    requestedItem: 'Type-C Fast Charging Hub',
    category: 'Accessories • Power',
    quantity: 1,
    priority: 'Medium',
    requestDate: '2026-02-15',
    status: 'Pending',
    justification: 'Multi-device power and peripheral hub for workstation test setup.',
    history: [
      {
        id: 'EVT-792-1',
        timestamp: '2026-02-15 14:00',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Marcus Vance',
      },
    ],
  },
  {
    id: 'REQ-2026-0754',
    requesterName: 'Marcus Vance',
    requesterEmail: 'employee@assetmx.local',
    department: 'Product Design',
    requestType: 'Consumable Request',
    requestedItem: 'Standard A4 Copy Paper (5 Reams)',
    category: 'Consumables • Paper',
    quantity: 5,
    priority: 'Low',
    requestDate: '2026-02-10',
    status: 'Fulfilled',
    justification: 'Design sprint documentation and sketching material.',
    history: [
      {
        id: 'EVT-754-1',
        timestamp: '2026-02-18 10:00',
        stage: 'Fulfilled',
        action: 'Disbursed from Central Store',
        performedBy: 'Administrator',
      },
    ],
  },
  {
    id: 'REQ-2026-0689',
    requesterName: 'Marcus Vance',
    requesterEmail: 'employee@assetmx.local',
    department: 'Product Design',
    requestType: 'Asset Request',
    requestedItem: 'Ergonomic Mesh Task Chair',
    category: 'Office Furniture • Ergonomics',
    quantity: 1,
    priority: 'High',
    requestDate: '2026-02-05',
    status: 'Rejected',
    justification: 'Posture support upgrade for workstation.',
    processingGuidelines: 'Disapproved: Workstation pod chairs were refreshed within 6 months.',
    history: [
      {
        id: 'EVT-689-1',
        timestamp: '2026-02-07 15:30',
        stage: 'Rejected',
        action: 'Request rejected',
        performedBy: 'Administrator',
      },
    ],
  },
];

export const EMPLOYEE_CUSTOM_REQUESTS_KEY = 'assetmx_employee_custom_requests';

export function getCustomEmployeeRequests(): RequestItemData[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EMPLOYEE_CUSTOM_REQUESTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse employee custom requests', e);
  }
  return [];
}

export function saveEmployeeCustomRequests(requests: RequestItemData[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EMPLOYEE_CUSTOM_REQUESTS_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error('Failed to save employee custom requests', e);
  }
}

/**
 * Persist an employee-submitted request to local mock stores
 */
export function addEmployeeRequest(
  newReq: Omit<RequestItemData, 'id' | 'status' | 'history'> &
    Partial<Pick<RequestItemData, 'id' | 'status' | 'history'>>
): RequestItemData {
  const stored = getStoredRequests();
  const custom = getCustomEmployeeRequests();
  let maxNum = 841;

  [...stored, ...custom, ...SEED_EMPLOYEE_REQUESTS].forEach((r) => {
    const m = r.id.match(/REQ-\d{4}-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  });

  const nextId = newReq.id || `REQ-2026-${String(maxNum + 1).padStart(4, '0')}`;
  const now = new Date();
  const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const fullRecord: RequestItemData = {
    id: nextId,
    requesterName: newReq.requesterName,
    requesterEmail: newReq.requesterEmail,
    department: newReq.department,
    requestType: newReq.requestType,
    requestedItem: newReq.requestedItem,
    category: newReq.category,
    quantity: newReq.quantity,
    priority: newReq.priority,
    requestDate: newReq.requestDate || now.toISOString().split('T')[0],
    status: newReq.status || 'Pending',
    justification: newReq.justification,
    processingGuidelines:
      newReq.processingGuidelines || 'Employee self-service requisition dispatched for departmental review.',
    requestSource: 'Employee Portal',
    dateReceived: newReq.dateReceived || now.toISOString().split('T')[0],
    estimatedCost: newReq.estimatedCost,
    attachments: newReq.attachments,
    history: [
      {
        id: `EVT-${Date.now().toString().slice(-4)}`,
        timestamp: timestampStr,
        stage: 'Pending',
        action: 'Requisition submitted by employee',
        performedBy: newReq.requesterName,
        note: 'Submitted via Employee Portal self-service workflow.',
      },
    ],
  };

  // Add to custom employee requests (top of list)
  const updatedCustom = [fullRecord, ...custom];
  saveEmployeeCustomRequests(updatedCustom);

  // Also add to global stored requests so Admin request views see it
  addStoredRequest(fullRecord);

  return fullRecord;
}

/**
 * Filter requests scoped strictly to the authenticated employee
 */
export function getScopedEmployeeRequests(user: AuthUser | null): RequestItemData[] {
  if (!user) return [];

  const email = (user.email || '').toLowerCase().trim();
  const name = (user.full_name || '').toLowerCase().trim();

  const custom = getCustomEmployeeRequests();
  const userCustom = custom.filter((r) => {
    const rEmail = (r.requesterEmail || '').toLowerCase().trim();
    const rName = (r.requesterName || '').toLowerCase().trim();
    return (email && rEmail === email) || (name && (rName === name || rName.includes(name)));
  });

  const isDemoEmployee =
    email === 'employee@assetmx.local' ||
    email === 'm.vance@assetmx.local' ||
    name === 'employee' ||
    name.includes('marcus');

  if (isDemoEmployee) {
    return [...userCustom, ...SEED_EMPLOYEE_REQUESTS];
  }

  // Any other employee: filter stored requests by email or name + custom
  const all = getStoredRequests();
  const matchingStored = all.filter((r) => {
    const rEmail = (r.requesterEmail || '').toLowerCase().trim();
    const rName = (r.requesterName || '').toLowerCase().trim();
    return (email && rEmail === email) || (name && (rName === name || rName.includes(name)));
  });

  const combined = [...userCustom, ...matchingStored];
  const seen = new Set<string>();
  return combined.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}


/**
 * Get assigned assets scoped to the authenticated employee
 */
export function getScopedEmployeeAssets(user: AuthUser | null): EmployeeAssignedAsset[] {
  if (!user) return [];

  const email = (user.email || '').toLowerCase().trim();
  const name = (user.full_name || '').toLowerCase().trim();

  // Demo employee receives the formally allocated demonstration assets
  if (
    email === 'employee@assetmx.local' ||
    email === 'm.vance@assetmx.local' ||
    name === 'employee' ||
    name.includes('marcus')
  ) {
    return DEFAULT_EMPLOYEE_ASSETS;
  }

  // Any other authenticated employee with no assigned records receives an honest empty state
  return [];
}

/**
 * Get consumption summary scoped to the authenticated employee
 */
export function getScopedEmployeeConsumption(user: AuthUser | null): EmployeeConsumptionSummary | null {
  if (!user) return null;

  const email = (user.email || '').toLowerCase().trim();
  const name = (user.full_name || '').toLowerCase().trim();

  // Demo employee receives the verified monthly consumption breakdown
  if (
    email === 'employee@assetmx.local' ||
    email === 'm.vance@assetmx.local' ||
    name === 'employee' ||
    name.includes('marcus')
  ) {
    return DEFAULT_EMPLOYEE_CONSUMPTION;
  }

  // Any other employee receives an honest empty state
  return null;
}
