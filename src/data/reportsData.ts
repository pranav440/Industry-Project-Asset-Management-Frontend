// =====================================================================
// AssetMX Reports & Analytics Synthetic Data Store & Demonstration Records
// Local storage state with realistic synthetic organizational data
// =====================================================================

export interface AssetUtilizationItem {
  id: string; // AST-NC-2026-0012
  name: string;
  category: 'Hardware' | 'Furniture' | 'Lab Equipment' | 'IT Equipment';
  location: 'HQ - Floor 4' | 'HQ - Floor 2' | 'Lab - Building A' | 'Warehouse' | 'Server Room';
  custodian: string;
  status: 'In Use' | 'Available' | 'In Maintenance';
  acquisitionDate: string;
  assetValue: number; // in INR
  maintenanceCost: number; // in INR
  lastServiceDate: string;
  estimatedEndOfLife: string; // YYYY-MM
  lifecycleAction: 'Disposal' | 'Replacement';
  quarterApproaching: 'Q3 2026' | 'Q4 2026' | 'Q1 2027' | 'Q2 2027' | 'Q3 2027' | 'Q4 2027';
}

export interface ReassignmentMovementRecord {
  id: string; // MOV-2026-0001
  assetId: string;
  assetName: string;
  category: 'Hardware' | 'Furniture' | 'Lab Equipment' | 'IT Equipment';
  previousCustodian: string;
  newCustodian: string;
  previousLocation: string;
  newLocation: string;
  movementDate: string; // YYYY-MM-DD
  reason: string;
}

export interface ReportRequestRecord {
  id: string; // REQ-2026-0012
  requester: string;
  department: 'Software Engineering' | 'Operations' | 'Finance' | 'Human Resources' | 'IT Administration' | 'Marketing';
  requestType: 'Asset Request' | 'Consumable Request';
  requestedItem: string;
  category: 'Hardware' | 'Furniture' | 'Lab Equipment' | 'IT Equipment' | 'Office Supplies';
  priority: 'High' | 'Medium' | 'Low';
  requestDate: string; // YYYY-MM-DD
  status: 'Fulfilled' | 'Pending' | 'Backlog';
}

// ---------------------------------------------------------------------
// Mock Datasets
// ---------------------------------------------------------------------

export const REPORT_ASSETS_DATA: AssetUtilizationItem[] = [
  {
    id: 'AST-NC-2026-0012',
    name: 'Dell Latitude 5430',
    category: 'Hardware',
    location: 'HQ - Floor 4',
    custodian: 'Marcus Vance',
    status: 'In Use',
    acquisitionDate: '2024-01-15',
    assetValue: 84500,
    maintenanceCost: 4500,
    lastServiceDate: '2026-05-10',
    estimatedEndOfLife: '2027-01',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q1 2027',
  },
  {
    id: 'AST-NC-2026-0013',
    name: 'Ergonomic Task Chair High-Back',
    category: 'Furniture',
    location: 'HQ - Floor 4',
    custodian: 'Sarah Jenkins',
    status: 'In Use',
    acquisitionDate: '2022-03-10',
    assetValue: 24000,
    maintenanceCost: 1200,
    lastServiceDate: '2025-11-04',
    estimatedEndOfLife: '2026-12',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q4 2026',
  },
  {
    id: 'AST-NC-2026-0014',
    name: 'Spectrophotometer Thermo UV-Vis',
    category: 'Lab Equipment',
    location: 'Lab - Building A',
    custodian: 'Dr. Aris Thorne',
    status: 'In Use',
    acquisitionDate: '2021-08-20',
    assetValue: 450000,
    maintenanceCost: 38000,
    lastServiceDate: '2026-04-18',
    estimatedEndOfLife: '2026-11',
    lifecycleAction: 'Disposal',
    quarterApproaching: 'Q4 2026',
  },
  {
    id: 'AST-NC-2026-0015',
    name: 'Cisco Catalyst 9300 48-Port Switch',
    category: 'IT Equipment',
    location: 'Server Room',
    custodian: 'Network Infrastructure Team',
    status: 'In Use',
    acquisitionDate: '2022-11-05',
    assetValue: 195000,
    maintenanceCost: 14200,
    lastServiceDate: '2026-06-02',
    estimatedEndOfLife: '2027-04',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q2 2027',
  },
  {
    id: 'AST-NC-2026-0016',
    name: 'MacBook Pro 16" M3 Max',
    category: 'Hardware',
    location: 'HQ - Floor 2',
    custodian: 'Elena Rostova',
    status: 'In Use',
    acquisitionDate: '2024-02-14',
    assetValue: 249000,
    maintenanceCost: 3200,
    lastServiceDate: '2026-07-15',
    estimatedEndOfLife: '2027-08',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q3 2027',
  },
  {
    id: 'AST-NC-2026-0017',
    name: 'Dell Precision 7780 Workstation',
    category: 'Hardware',
    location: 'HQ - Floor 4',
    custodian: 'Priya Sharma',
    status: 'In Maintenance',
    acquisitionDate: '2023-05-18',
    assetValue: 185000,
    maintenanceCost: 16500,
    lastServiceDate: '2026-09-01',
    estimatedEndOfLife: '2027-02',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q1 2027',
  },
  {
    id: 'AST-NC-2026-0018',
    name: 'Executive Conference Table (10-Seater)',
    category: 'Furniture',
    location: 'HQ - Floor 2',
    custodian: 'Facilities Dept',
    status: 'In Use',
    acquisitionDate: '2020-04-12',
    assetValue: 78000,
    maintenanceCost: 6200,
    lastServiceDate: '2025-08-10',
    estimatedEndOfLife: '2026-10',
    lifecycleAction: 'Disposal',
    quarterApproaching: 'Q4 2026',
  },
  {
    id: 'AST-NC-2026-0019',
    name: 'Centrifuge Refrigerated 5424R',
    category: 'Lab Equipment',
    location: 'Lab - Building A',
    custodian: 'Biochem Lab Ops',
    status: 'Available',
    acquisitionDate: '2022-09-01',
    assetValue: 320000,
    maintenanceCost: 22000,
    lastServiceDate: '2026-03-25',
    estimatedEndOfLife: '2027-06',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q2 2027',
  },
  {
    id: 'AST-NC-2026-0020',
    name: 'APC Smart-UPS RT 10kVA On-Line',
    category: 'IT Equipment',
    location: 'Server Room',
    custodian: 'IT Systems Admin',
    status: 'In Use',
    acquisitionDate: '2021-02-19',
    assetValue: 285000,
    maintenanceCost: 31000,
    lastServiceDate: '2026-08-12',
    estimatedEndOfLife: '2026-09',
    lifecycleAction: 'Disposal',
    quarterApproaching: 'Q3 2026',
  },
  {
    id: 'AST-NC-2026-0021',
    name: 'ThinkPad T14s Gen 4',
    category: 'Hardware',
    location: 'Warehouse',
    custodian: 'Inventory Staging',
    status: 'Available',
    acquisitionDate: '2024-06-10',
    assetValue: 92000,
    maintenanceCost: 0,
    lastServiceDate: '2026-06-10',
    estimatedEndOfLife: '2027-10',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q4 2027',
  },
  {
    id: 'AST-NC-2026-0022',
    name: 'Steel Mobile Pedestal Drawer Unit',
    category: 'Furniture',
    location: 'Warehouse',
    custodian: 'Storage Admin',
    status: 'Available',
    acquisitionDate: '2023-01-15',
    assetValue: 8500,
    maintenanceCost: 400,
    lastServiceDate: '2025-05-12',
    estimatedEndOfLife: '2027-11',
    lifecycleAction: 'Disposal',
    quarterApproaching: 'Q4 2027',
  },
  {
    id: 'AST-NC-2026-0023',
    name: 'Fortinet FortiGate 100F Firewall',
    category: 'IT Equipment',
    location: 'Server Room',
    custodian: 'SecOps Team',
    status: 'In Use',
    acquisitionDate: '2023-08-22',
    assetValue: 165000,
    maintenanceCost: 11500,
    lastServiceDate: '2026-05-18',
    estimatedEndOfLife: '2027-09',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q3 2027',
  },
  {
    id: 'AST-NC-2026-0024',
    name: 'Digital Analytical Balance Explorer',
    category: 'Lab Equipment',
    location: 'Lab - Building A',
    custodian: 'Quality Assurance Lab',
    status: 'In Maintenance',
    acquisitionDate: '2022-07-14',
    assetValue: 145000,
    maintenanceCost: 18200,
    lastServiceDate: '2026-08-30',
    estimatedEndOfLife: '2026-10',
    lifecycleAction: 'Disposal',
    quarterApproaching: 'Q4 2026',
  },
  {
    id: 'AST-NC-2026-0025',
    name: 'Dell UltraSharp 32" 4K Monitor',
    category: 'Hardware',
    location: 'HQ - Floor 4',
    custodian: 'Dev Team Pod 4',
    status: 'In Use',
    acquisitionDate: '2024-03-20',
    assetValue: 62000,
    maintenanceCost: 1500,
    lastServiceDate: '2026-04-02',
    estimatedEndOfLife: '2027-05',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q2 2027',
  },
  {
    id: 'AST-NC-2026-0026',
    name: 'Acoustic Privacy Pod Single',
    category: 'Furniture',
    location: 'HQ - Floor 2',
    custodian: 'Facilities Dept',
    status: 'In Use',
    acquisitionDate: '2023-10-05',
    assetValue: 140000,
    maintenanceCost: 4800,
    lastServiceDate: '2026-02-14',
    estimatedEndOfLife: '2027-12',
    lifecycleAction: 'Replacement',
    quarterApproaching: 'Q4 2027',
  },
  {
    id: 'AST-NC-2026-0027',
    name: 'HPE ProLiant DL380 Gen10 Server',
    category: 'IT Equipment',
    location: 'Server Room',
    custodian: 'Infrastructure Engineering',
    status: 'In Maintenance',
    acquisitionDate: '2021-06-11',
    assetValue: 520000,
    maintenanceCost: 56000,
    lastServiceDate: '2026-09-05',
    estimatedEndOfLife: '2026-09',
    lifecycleAction: 'Disposal',
    quarterApproaching: 'Q3 2026',
  },
];

export const REPORT_REQUESTS_DATA: ReportRequestRecord[] = [
  {
    id: 'REQ-2026-0012',
    requester: 'Sarah Jenkins',
    department: 'Software Engineering',
    requestType: 'Asset Request',
    requestedItem: 'Dell UltraSharp 32" 4K Monitor',
    category: 'Hardware',
    priority: 'High',
    requestDate: '2026-09-14',
    status: 'Pending',
  },
  {
    id: 'REQ-2026-0013',
    requester: 'Vikram Mehta',
    department: 'Operations',
    requestType: 'Consumable Request',
    requestedItem: 'A4 Printer Paper Multi-Ream Pack',
    category: 'Office Supplies',
    priority: 'Medium',
    requestDate: '2026-09-12',
    status: 'Fulfilled',
  },
  {
    id: 'REQ-2026-0014',
    requester: 'Dr. Aris Thorne',
    department: 'Software Engineering',
    requestType: 'Asset Request',
    requestedItem: 'High-Precision Micro-Pipette Set',
    category: 'Lab Equipment',
    priority: 'High',
    requestDate: '2026-09-10',
    status: 'Backlog',
  },
  {
    id: 'REQ-2026-0015',
    requester: 'Ananya Roy',
    department: 'Finance',
    requestType: 'Asset Request',
    requestedItem: 'Ergonomic Task Chair High-Back',
    category: 'Furniture',
    priority: 'Low',
    requestDate: '2026-09-08',
    status: 'Fulfilled',
  },
  {
    id: 'REQ-2026-0016',
    requester: 'Marcus Vance',
    department: 'IT Administration',
    requestType: 'Asset Request',
    requestedItem: 'Cisco SFP+ 10G Transceiver Module (Pack of 4)',
    category: 'IT Equipment',
    priority: 'High',
    requestDate: '2026-09-05',
    status: 'Fulfilled',
  },
  {
    id: 'REQ-2026-0017',
    requester: 'Rohit Verma',
    department: 'Human Resources',
    requestType: 'Consumable Request',
    requestedItem: 'Thermal ID Badge Printable Cards (100-Pack)',
    category: 'Office Supplies',
    priority: 'Medium',
    requestDate: '2026-09-03',
    status: 'Pending',
  },
  {
    id: 'REQ-2026-0018',
    requester: 'Kavita Nair',
    department: 'Marketing',
    requestType: 'Asset Request',
    requestedItem: 'MacBook Pro 16" M3 Max',
    category: 'Hardware',
    priority: 'High',
    requestDate: '2026-08-28',
    status: 'Backlog',
  },
  {
    id: 'REQ-2026-0019',
    requester: 'Amit Patel',
    department: 'Operations',
    requestType: 'Consumable Request',
    requestedItem: 'Industrial Poly Bubble Wrap (50m Roll)',
    category: 'Office Supplies',
    priority: 'Low',
    requestDate: '2026-08-25',
    status: 'Fulfilled',
  },
  {
    id: 'REQ-2026-0020',
    requester: 'Deepak Rao',
    department: 'Software Engineering',
    requestType: 'Asset Request',
    requestedItem: 'Keychron Q1 Pro Mechanical Keyboard',
    category: 'Hardware',
    priority: 'Medium',
    requestDate: '2026-08-20',
    status: 'Fulfilled',
  },
  {
    id: 'REQ-2026-0021',
    requester: 'Siddharth Sen',
    department: 'IT Administration',
    requestType: 'Asset Request',
    requestedItem: 'Cat6A Ethernet Patch Cable 50m Box',
    category: 'IT Equipment',
    priority: 'Low',
    requestDate: '2026-08-15',
    status: 'Pending',
  },
  {
    id: 'REQ-2026-0022',
    requester: 'Neha Kapoor',
    department: 'Finance',
    requestType: 'Consumable Request',
    requestedItem: 'LaserJet Black Toner Cartridge HP 89A',
    category: 'Office Supplies',
    priority: 'Medium',
    requestDate: '2026-08-10',
    status: 'Fulfilled',
  },
  {
    id: 'REQ-2026-0023',
    requester: 'Tarun Bose',
    department: 'Operations',
    requestType: 'Asset Request',
    requestedItem: 'Heavy Duty 4-Shelf Storage Rack',
    category: 'Furniture',
    priority: 'High',
    requestDate: '2026-08-05',
    status: 'Backlog',
  },
];

export const REPORT_REASSIGNMENT_DATA: ReassignmentMovementRecord[] = [
  {
    id: 'MOV-2026-0001',
    assetId: 'AST-NC-2026-0012',
    assetName: 'Dell Latitude 5430',
    category: 'Hardware',
    previousCustodian: 'IT Staging Bay',
    newCustodian: 'Marcus Vance',
    previousLocation: 'Warehouse',
    newLocation: 'HQ - Floor 4',
    movementDate: '2026-09-08',
    reason: 'Department allocation for new engineering deployment',
  },
  {
    id: 'MOV-2026-0002',
    assetId: 'AST-NC-2026-0013',
    assetName: 'Ergonomic Task Chair High-Back',
    category: 'Furniture',
    previousCustodian: 'Facilities Warehouse',
    newCustodian: 'Sarah Jenkins',
    previousLocation: 'Warehouse',
    newLocation: 'HQ - Floor 4',
    movementDate: '2026-09-02',
    reason: 'Ergonomic workstation adjustment request',
  },
  {
    id: 'MOV-2026-0003',
    assetId: 'AST-NC-2026-0017',
    assetName: 'Dell Precision 7780 Workstation',
    category: 'Hardware',
    previousCustodian: 'Priya Sharma',
    newCustodian: 'Hardware Maintenance Lab',
    previousLocation: 'HQ - Floor 4',
    newLocation: 'Lab - Building A',
    movementDate: '2026-08-28',
    reason: 'Scheduled GPU thermal maintenance and diagnostic check',
  },
  {
    id: 'MOV-2026-0004',
    assetId: 'AST-NC-2026-0015',
    assetName: 'Cisco Catalyst 9300 48-Port Switch',
    category: 'IT Equipment',
    previousCustodian: 'Staging Room 2',
    newCustodian: 'Network Infrastructure Team',
    previousLocation: 'HQ - Floor 2',
    newLocation: 'Server Room',
    movementDate: '2026-08-19',
    reason: 'Rack expansion for floor aggregation switches',
  },
  {
    id: 'MOV-2026-0005',
    assetId: 'AST-NC-2026-0016',
    assetName: 'MacBook Pro 16" M3 Max',
    category: 'Hardware',
    previousCustodian: 'Karan Mehra',
    newCustodian: 'Elena Rostova',
    previousLocation: 'HQ - Floor 4',
    newLocation: 'HQ - Floor 2',
    movementDate: '2026-08-10',
    reason: 'Inter-department team transfer to Product Design',
  },
  {
    id: 'MOV-2026-0006',
    assetId: 'AST-NC-2026-0020',
    assetName: 'APC Smart-UPS RT 10kVA On-Line',
    category: 'IT Equipment',
    previousCustodian: 'Power Ops Floor 2',
    newCustodian: 'IT Systems Admin',
    previousLocation: 'HQ - Floor 2',
    newLocation: 'Server Room',
    movementDate: '2026-07-25',
    reason: 'Consolidation of backup power systems to central server pod',
  },
  {
    id: 'MOV-2026-0007',
    assetId: 'AST-NC-2026-0024',
    assetName: 'Digital Analytical Balance Explorer',
    category: 'Lab Equipment',
    previousCustodian: 'Dr. Aris Thorne',
    newCustodian: 'Quality Assurance Lab',
    previousLocation: 'Lab - Building A',
    newLocation: 'Lab - Building A',
    movementDate: '2026-07-14',
    reason: 'Calibration servicing transfer between cleanroom zones',
  },
  {
    id: 'MOV-2026-0008',
    assetId: 'AST-NC-2026-0025',
    assetName: 'Dell UltraSharp 32" 4K Monitor',
    category: 'Hardware',
    previousCustodian: 'Central IT Stock',
    newCustodian: 'Dev Team Pod 4',
    previousLocation: 'Warehouse',
    newLocation: 'HQ - Floor 4',
    movementDate: '2026-07-02',
    reason: 'Approved request fulfillment for UI design display',
  },
];

// ---------------------------------------------------------------------
// Filter Constants
// ---------------------------------------------------------------------

export const REPORT_FILTER_OPTIONS = {
  locations: [
    { value: '', label: 'All Locations' },
    { value: 'HQ - Floor 4', label: 'HQ - Floor 4' },
    { value: 'HQ - Floor 2', label: 'HQ - Floor 2' },
    { value: 'Lab - Building A', label: 'Lab - Building A' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'Server Room', label: 'Server Room' },
  ],
  categories: [
    { value: '', label: 'All Categories' },
    { value: 'Hardware', label: 'Hardware' },
    { value: 'Furniture', label: 'Furniture' },
    { value: 'Lab Equipment', label: 'Lab Equipment' },
    { value: 'IT Equipment', label: 'IT Equipment' },
  ],
  requestTypes: [
    { value: '', label: 'All Request Types' },
    { value: 'Asset Request', label: 'Asset Request' },
    { value: 'Consumable Request', label: 'Consumable Request' },
  ],
  departments: [
    { value: '', label: 'All Departments' },
    { value: 'Software Engineering', label: 'Software Engineering' },
    { value: 'Operations', label: 'Operations' },
    { value: 'Finance', label: 'Finance' },
    { value: 'Human Resources', label: 'Human Resources' },
    { value: 'IT Administration', label: 'IT Administration' },
    { value: 'Marketing', label: 'Marketing' },
  ],
  priorities: [
    { value: '', label: 'All Priorities' },
    { value: 'High', label: 'High' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Low', label: 'Low' },
  ],
  requestStatuses: [
    { value: '', label: 'All Statuses' },
    { value: 'Fulfilled', label: 'Fulfilled' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Backlog', label: 'Backlog' },
  ],
  dateRanges: [
    { value: '', label: 'All Time' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '180d', label: 'Last 6 Months' },
    { value: '365d', label: 'Last 1 Year' },
  ],
};

// ---------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------

const STORAGE_KEY_REPORT_ASSETS = 'assetmx_report_assets_v1';
const STORAGE_KEY_REPORT_REQUESTS = 'assetmx_report_requests_v1';
const STORAGE_KEY_REPORT_MOVEMENTS = 'assetmx_report_movements_v1';

export function getStoredReportAssets(): AssetUtilizationItem[] {
  if (typeof window === 'undefined') return REPORT_ASSETS_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORT_ASSETS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_REPORT_ASSETS, JSON.stringify(REPORT_ASSETS_DATA));
      return REPORT_ASSETS_DATA;
    }
    return JSON.parse(raw);
  } catch {
    return REPORT_ASSETS_DATA;
  }
}

export function getStoredReportRequests(): ReportRequestRecord[] {
  if (typeof window === 'undefined') return REPORT_REQUESTS_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORT_REQUESTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_REPORT_REQUESTS, JSON.stringify(REPORT_REQUESTS_DATA));
      return REPORT_REQUESTS_DATA;
    }
    return JSON.parse(raw);
  } catch {
    return REPORT_REQUESTS_DATA;
  }
}

export function getStoredReportMovements(): ReassignmentMovementRecord[] {
  if (typeof window === 'undefined') return REPORT_REASSIGNMENT_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORT_MOVEMENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_REPORT_MOVEMENTS, JSON.stringify(REPORT_REASSIGNMENT_DATA));
      return REPORT_REASSIGNMENT_DATA;
    }
    return JSON.parse(raw);
  } catch {
    return REPORT_REASSIGNMENT_DATA;
  }
}
