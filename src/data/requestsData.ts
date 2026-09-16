// =====================================================================
// AssetMX Requests Data Store & Demonstration Records
// Local storage state with initial realistic synthetic organizational data
// =====================================================================

export type RequestType = 'Asset Request' | 'Consumable Request';
export type RequestStatus = 'Pending' | 'In Review' | 'Fulfilled' | 'Rejected';
export type RequestPriority = 'High' | 'Medium' | 'Low';

export interface RequestHistoryEntry {
  id: string;
  timestamp: string;
  stage: string;
  action: string;
  performedBy: string;
  note?: string;
}

export interface RequestItemData {
  id: string; // e.g. REQ-2026-0041
  requesterName: string;
  requesterEmail: string;
  department: string;
  requestType: RequestType;
  requestedItem: string;
  category: string;
  quantity: number;
  priority: RequestPriority;
  requestDate: string; // YYYY-MM-DD
  status: RequestStatus;
  justification: string;
  processingGuidelines?: string;
  history: RequestHistoryEntry[];
}

export const INITIAL_REQUESTS: RequestItemData[] = [
  {
    id: 'REQ-2026-0041',
    requesterName: 'Sarah Jenkins',
    requesterEmail: 's.jenkins@assetmx.local',
    department: 'Software Engineering',
    requestType: 'Asset Request',
    requestedItem: 'Dell UltraSharp 32" 4K USB-C Monitor (U3223QE)',
    category: 'Hardware',
    quantity: 1,
    priority: 'High',
    requestDate: '2026-09-14',
    status: 'Pending',
    justification: 'Required for multi-stream microservice debugging and frontend architecture layout verification.',
    processingGuidelines: 'Verify inventory stock in IT Hardware bay before assigning asset allocation.',
    history: [
      {
        id: 'EVT-001',
        timestamp: '2026-09-14 09:30',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Sarah Jenkins (Software Engineering)',
        note: 'Initial submission with priority High.',
      },
    ],
  },
  {
    id: 'REQ-2026-0042',
    requesterName: 'Marcus Vance',
    requesterEmail: 'm.vance@assetmx.local',
    department: 'IT Support',
    requestType: 'Consumable Request',
    requestedItem: 'Cat6 Shielded RJ45 Patch Cables (2m, Pack of 10)',
    category: 'Networking Cables',
    quantity: 3,
    priority: 'High',
    requestDate: '2026-09-15',
    status: 'In Review',
    justification: 'Floor 4 server switch interconnects maintenance and patch panel replacement.',
    processingGuidelines: 'Check consumable batch BAT-2026-14B in Server Room Rack B04.',
    history: [
      {
        id: 'EVT-002',
        timestamp: '2026-09-15 10:15',
        stage: 'In Review',
        action: 'Request moved to In Review',
        performedBy: 'Administrator',
        note: 'Stock verification underway in Rack B04.',
      },
      {
        id: 'EVT-003',
        timestamp: '2026-09-15 08:45',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Marcus Vance (IT Support)',
        note: 'Urgent replacement for degraded cabling.',
      },
    ],
  },
  {
    id: 'REQ-2026-0043',
    requesterName: 'Elena Rostova',
    requesterEmail: 'e.rostova@assetmx.local',
    department: 'Finance & Operations',
    requestType: 'Consumable Request',
    requestedItem: 'Standard A4 Multipurpose Copy Paper (5 Reams)',
    category: 'Stationery & Office',
    quantity: 5,
    priority: 'Medium',
    requestDate: '2026-09-12',
    status: 'Fulfilled',
    justification: 'Quarterly financial audit hardcopy documentation and filing records.',
    processingGuidelines: 'Disbursed from Warehouse Bay C2.',
    history: [
      {
        id: 'EVT-004',
        timestamp: '2026-09-13 14:00',
        stage: 'Fulfilled',
        action: 'Request fulfilled',
        performedBy: 'Administrator',
        note: 'Delivered to Finance 2nd floor archiving room.',
      },
      {
        id: 'EVT-005',
        timestamp: '2026-09-12 11:30',
        stage: 'In Review',
        action: 'Request moved to In Review',
        performedBy: 'Administrator',
      },
      {
        id: 'EVT-006',
        timestamp: '2026-09-12 09:00',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Elena Rostova (Finance)',
      },
    ],
  },
  {
    id: 'REQ-2026-0044',
    requesterName: 'David Kim',
    requesterEmail: 'd.kim@assetmx.local',
    department: 'Hardware Maintenance',
    requestType: 'Consumable Request',
    requestedItem: 'Thermal Compound Paste (Arctic MX-4 4g)',
    category: 'Hardware Maintenance',
    quantity: 2,
    priority: 'Low',
    requestDate: '2026-09-10',
    status: 'Rejected',
    justification: 'Bench maintenance reserve stock for workstation tune-ups.',
    processingGuidelines: 'Disapproved: sufficient workshop tube already active on bench #3.',
    history: [
      {
        id: 'EVT-007',
        timestamp: '2026-09-11 16:30',
        stage: 'Rejected',
        action: 'Request rejected',
        performedBy: 'Administrator',
        note: 'Existing bench reserve active until month end.',
      },
      {
        id: 'EVT-008',
        timestamp: '2026-09-10 14:15',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'David Kim (Hardware Maintenance)',
      },
    ],
  },
  {
    id: 'REQ-2026-0045',
    requesterName: 'Dr. Aris Thorne',
    requesterEmail: 'a.thorne@assetmx.local',
    department: 'Research & Lab',
    requestType: 'Asset Request',
    requestedItem: 'Precision Digital Oscilloscope 100MHz 4-CH',
    category: 'Lab Equipment',
    quantity: 1,
    priority: 'High',
    requestDate: '2026-09-13',
    status: 'Pending',
    justification: 'Hardware signal integrity measurements for sensor firmware telemetry validation.',
    processingGuidelines: 'Calibration cert required prior to lab handover.',
    history: [
      {
        id: 'EVT-009',
        timestamp: '2026-09-13 13:20',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Dr. Aris Thorne (Research & Lab)',
      },
    ],
  },
  {
    id: 'REQ-2026-0046',
    requesterName: 'Ananya Sharma',
    requesterEmail: 'a.sharma@assetmx.local',
    department: 'Product Design',
    requestType: 'Asset Request',
    requestedItem: 'Wacom Cintiq Pro 24 Creative Pen Display',
    category: 'Hardware',
    quantity: 1,
    priority: 'Medium',
    requestDate: '2026-09-08',
    status: 'In Review',
    justification: 'UI design asset rasterization and design system iconography overhaul.',
    processingGuidelines: 'Check graphics team allocation quota.',
    history: [
      {
        id: 'EVT-010',
        timestamp: '2026-09-09 11:00',
        stage: 'In Review',
        action: 'Request moved to In Review',
        performedBy: 'Administrator',
        note: 'Reviewing hardware availability in central store.',
      },
      {
        id: 'EVT-011',
        timestamp: '2026-09-08 10:00',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Ananya Sharma (Product Design)',
      },
    ],
  },
  {
    id: 'REQ-2026-0047',
    requesterName: 'Liam O’Connor',
    requesterEmail: 'l.oconnor@assetmx.local',
    department: 'DevOps & Cloud',
    requestType: 'Consumable Request',
    requestedItem: 'Cyan Dye Ink Cartridge (T502 High Yield)',
    category: 'Printing & Inks',
    quantity: 2,
    priority: 'Low',
    requestDate: '2026-09-07',
    status: 'Pending',
    justification: 'Color diagram printing for architectural compliance reviews.',
    processingGuidelines: 'Verify inventory stock in Floor 4 IT Storage.',
    history: [
      {
        id: 'EVT-012',
        timestamp: '2026-09-07 15:45',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Liam O’Connor (DevOps)',
      },
    ],
  },
  {
    id: 'REQ-2026-0048',
    requesterName: 'Rachel Green',
    requesterEmail: 'r.green@assetmx.local',
    department: 'Human Resources',
    requestType: 'Asset Request',
    requestedItem: 'Ergonomic Mesh Task Chair (Herman Miller Aeron)',
    category: 'Furniture',
    quantity: 1,
    priority: 'Medium',
    requestDate: '2026-09-05',
    status: 'Fulfilled',
    justification: 'Workstation ergonomic accommodation recommendation.',
    processingGuidelines: 'Dispatched from Facilities Bay 1.',
    history: [
      {
        id: 'EVT-013',
        timestamp: '2026-09-06 14:00',
        stage: 'Fulfilled',
        action: 'Request fulfilled',
        performedBy: 'Administrator',
        note: 'Assembled and placed at workstation HR-4B.',
      },
      {
        id: 'EVT-014',
        timestamp: '2026-09-05 09:30',
        stage: 'Pending',
        action: 'Request submitted',
        performedBy: 'Rachel Green (HR)',
      },
    ],
  },
];

const LOCAL_STORAGE_KEY = 'amx_requests_records_v1';

export function getStoredRequests(): RequestItemData[] {
  if (typeof window === 'undefined') return INITIAL_REQUESTS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load stored requests from localStorage', e);
  }
  return INITIAL_REQUESTS;
}

export function saveStoredRequests(items: RequestItemData[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save requests to localStorage', e);
  }
}

export const REQUEST_FILTER_OPTIONS = {
  requestTypes: [
    { value: '', label: 'All Request Types' },
    { value: 'Asset Request', label: 'Asset Request' },
    { value: 'Consumable Request', label: 'Consumable Request' },
  ],
  statuses: [
    { value: '', label: 'All Statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'In Review', label: 'In Review' },
    { value: 'Fulfilled', label: 'Fulfilled' },
    { value: 'Rejected', label: 'Rejected' },
  ],
  priorities: [
    { value: '', label: 'All Priorities' },
    { value: 'High', label: 'High Priority' },
    { value: 'Medium', label: 'Medium Priority' },
    { value: 'Low', label: 'Low Priority' },
  ],
  departments: [
    { value: '', label: 'All Departments' },
    { value: 'Software Engineering', label: 'Software Engineering' },
    { value: 'IT Support', label: 'IT Support' },
    { value: 'Finance & Operations', label: 'Finance & Operations' },
    { value: 'Hardware Maintenance', label: 'Hardware Maintenance' },
    { value: 'Research & Lab', label: 'Research & Lab' },
    { value: 'Product Design', label: 'Product Design' },
    { value: 'DevOps & Cloud', label: 'DevOps & Cloud' },
    { value: 'Human Resources', label: 'Human Resources' },
  ],
};
