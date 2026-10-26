// =====================================================================
// AssetMX Employee Scoped Data Store & Types
// Scopes requests, assigned assets, and consumption to the authenticated employee
// =====================================================================

import { type AuthUser } from '../auth/session';
import { getStoredRequests, addStoredRequest, type RequestItemData } from './requestsData';

export interface EmployeeAssignedAsset {
  id: string;
  name: string;
  category: string;
  location: string;
  status: string;
  icon: string;
  verificationStatus: 'Verified' | 'Active';
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

// Default demonstration assigned assets formally allocated to the employee
export const DEFAULT_EMPLOYEE_ASSETS: EmployeeAssignedAsset[] = [
  {
    id: 'AST-NC-2026-0012',
    name: 'Dell Latitude 5430 Laptop',
    category: 'Hardware • Workstation',
    location: 'HQ - Floor 4, Dev Pod 4B',
    status: 'Active / Verified',
    icon: 'laptop_mac',
    verificationStatus: 'Verified',
  },
  {
    id: 'AST-DS-2025-0489',
    name: 'Apple Studio Display 27"',
    category: 'Hardware • Display',
    location: 'HQ - Floor 4, Dev Pod 4B',
    status: 'Active / Verified',
    icon: 'desktop_windows',
    verificationStatus: 'Verified',
  },
  {
    id: 'AST-AU-2025-1102',
    name: 'Jabra Evolve2 65 Headset',
    category: 'Peripherals • Audio',
    location: 'HQ - Floor 4, Dev Pod 4B',
    status: 'Active',
    icon: 'headphones',
    verificationStatus: 'Active',
  },
  {
    id: 'AST-SC-2024-0095',
    name: 'YubiKey 5C NFC Security Key',
    category: 'Security • 2FA Hardware',
    location: 'Assigned to Custodian',
    status: 'Active',
    icon: 'vpn_key',
    verificationStatus: 'Active',
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
