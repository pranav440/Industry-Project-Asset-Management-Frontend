// =====================================================================
// AssetMX Asset Details Data Types & Demonstration Records
// Business/Display-Independent Types for Admin Asset Details
// =====================================================================

import { type AssetStatus } from './assetsData';

export type LifecycleStageId = 1 | 2 | 3 | 4;

export interface LifecycleStage {
  step: LifecycleStageId;
  name: string;
  subtitle: string;
  statusLabel: string;
  statusType: 'completed' | 'current' | 'scheduled' | 'pending';
  dateLabel: string;
}

export interface AcquisitionFinancials {
  purchaseDate: string;
  vendorName: string;
  invoiceReference: string;
  poNumber: string;
  totalCost: string;
  warrantyPeriod: string;
  configuredDepreciation: string;
}

export interface CustodyLocation {
  assignedCustodian: string;
  department: string;
  assignedLocation: string;
  allocationDate: string;
  designatedUser: string;
  accountabilityStatus: string;
}

export interface MovementHistoryRecord {
  id: string;
  date: string;
  movementType: string;
  from: string;
  to: string;
  custodian: string;
  verification: string;
}

export interface MaintenanceHistoryRecord {
  id: string;
  date: string;
  serviceEvent: string;
  vendor: string;
  cost: string;
  status: 'Completed' | 'Scheduled' | 'In Progress';
}

export interface AuditHistoryRecord {
  id: string;
  event: string;
  icon: string;
  iconColor?: string;
  dateTime: string;
  performedBy: string;
}

export interface AssetDetailsData {
  id: string;
  name: string;
  status: AssetStatus;
  category: string;
  specification: string;
  serialNumber: string;
  assignedCustodianDepartment: string;
  assignedCustodianName: string;
  assignedLocation: string;
  assignedSubLocation: string;
  warrantyStatus: string;
  warrantyCover: string;
  lifecycleStageText: string;
  estimatedEndOfLife: string;
  qrVerifiedText: string;
  qrExplanation: string;
  lifecycleStages: LifecycleStage[];
  acquisition: AcquisitionFinancials;
  custody: CustodyLocation;
  movementHistory: MovementHistoryRecord[];
  maintenanceHistory: MaintenanceHistoryRecord[];
  auditHistory: AuditHistoryRecord[];
  qrCodeDataUrl?: string;
}

export const ASSET_DETAILS_MOCK_DATA: Record<string, AssetDetailsData> = {
  'AST-NC-2026-0012': {
    id: 'AST-NC-2026-0012',
    name: 'Dell Latitude 5430',
    status: 'Active',
    category: 'Hardware',
    specification: 'Standard Enterprise Laptop',
    serialNumber: 'SN-88294-DL5430',
    assignedCustodianDepartment: 'IT Department',
    assignedCustodianName: 'Marcus Vance',
    assignedLocation: 'HQ - Floor 4',
    assignedSubLocation: 'Dev Pod 4B',
    warrantyStatus: 'Valid until Jan 2027',
    warrantyCover: '3-Year Onsite Cover',
    lifecycleStageText: 'Stage 2: Active Usage',
    estimatedEndOfLife: 'Jan 2028',
    qrVerifiedText: 'Verified & Active',
    qrExplanation: 'Unique QR tag linked to asset profile. Scan via terminal or mobile reader for verification.',
    lifecycleStages: [
      {
        step: 1,
        name: '1. Allocation',
        subtitle: 'Procured, tagged & assigned',
        statusLabel: 'Completed',
        statusType: 'completed',
        dateLabel: '15 Jan 2024',
      },
      {
        step: 2,
        name: '2. Active Usage',
        subtitle: 'In daily deployment at HQ Floor 4',
        statusLabel: 'Current Stage',
        statusType: 'current',
        dateLabel: 'Since 18 Jan 2024',
      },
      {
        step: 3,
        name: '3. Maintenance',
        subtitle: 'Routine diagnostics & thermal servicing',
        statusLabel: 'Scheduled',
        statusType: 'scheduled',
        dateLabel: 'Next: Oct 2025',
      },
      {
        step: 4,
        name: '4. Disposal',
        subtitle: 'E-waste recycling / vendor buyback',
        statusLabel: 'Pending',
        statusType: 'pending',
        dateLabel: 'Jan 2028 (Est.)',
      },
    ],
    acquisition: {
      purchaseDate: '15 Jan 2024',
      vendorName: 'TechSupply Co. Ltd.',
      invoiceReference: 'INV-2024-0891 / PO-9921-A',
      poNumber: 'PO-9921-A',
      totalCost: '₹84,500',
      warrantyPeriod: '3-Year Onsite Cover (Jan 2027)',
      configuredDepreciation: 'Straight Line (Asset Policy: 4 Yrs)',
    },
    custody: {
      assignedCustodian: 'IT Department',
      department: 'Information Technology',
      assignedLocation: 'HQ - Floor 4, Dev Pod 4B',
      allocationDate: '18 Jan 2024',
      designatedUser: 'Marcus Vance (EMP-4019)',
      accountabilityStatus: 'Active Assignment',
    },
    movementHistory: [
      {
        id: 'MOV-001',
        date: '12 Mar 2024',
        movementType: 'Department Transfer',
        from: 'HQ - Floor 2',
        to: 'HQ - Floor 4',
        custodian: 'Marcus Vance',
        verification: 'QR Verified',
      },
      {
        id: 'MOV-002',
        date: '18 Jan 2024',
        movementType: 'Initial Allocation',
        from: 'Central Warehouse',
        to: 'HQ - Floor 4',
        custodian: 'IT Department (Marcus Vance)',
        verification: 'QR Verified',
      },
    ],
    maintenanceHistory: [
      {
        id: 'MNT-001',
        date: '15 Oct 2024',
        serviceEvent: 'Routine Inspection & Diagnostics',
        vendor: 'TechSupply Co. Ltd.',
        cost: 'Covered under Warranty',
        status: 'Completed',
      },
      {
        id: 'MNT-002',
        date: '10 Oct 2025',
        serviceEvent: 'Scheduled Preventive Maintenance',
        vendor: 'Hardware Services Inc.',
        cost: '₹1,200',
        status: 'Scheduled',
      },
    ],
    auditHistory: [
      {
        id: 'AUD-001',
        event: 'Location Transfer Logged',
        icon: 'swap_horiz',
        iconColor: '#0891B2',
        dateTime: '12 Mar 2024, 04:10 PM',
        performedBy: 'Admin (S. Jenkins)',
      },
      {
        id: 'AUD-002',
        event: 'Asset Allocated',
        icon: 'assignment_turned_in',
        iconColor: '#0891B2',
        dateTime: '18 Jan 2024, 02:45 PM',
        performedBy: 'Custodian Lead (M. Vance)',
      },
      {
        id: 'AUD-003',
        event: 'QR Tag Linked & Verified',
        icon: 'qr_code_2',
        iconColor: '#059669',
        dateTime: '15 Jan 2024, 11:15 AM',
        performedBy: 'Admin (S. Jenkins)',
      },
      {
        id: 'AUD-004',
        event: 'Asset Created',
        icon: 'add_circle',
        iconColor: '#0891B2',
        dateTime: '15 Jan 2024, 10:30 AM',
        performedBy: 'Admin (S. Jenkins)',
      },
    ],
  },
  'AST-2024-0042': {
    id: 'AST-2024-0042',
    name: 'Apple MacBook Pro 16"',
    status: 'Active',
    category: 'Laptops & Compute',
    specification: 'M3 Max, 36GB Unified Memory, 1TB SSD • Space Black',
    serialNumber: 'C02G901QMD6T',
    assignedCustodianDepartment: 'Product Design & UX',
    assignedCustodianName: 'Marcus Vance',
    assignedLocation: 'HQ - Bldg B, Floor 4',
    assignedSubLocation: 'Desk B-412 (Workstation Hub)',
    warrantyStatus: 'Valid until Jan 2027',
    warrantyCover: 'AppleCare+ for Enterprise (3 Yrs)',
    lifecycleStageText: 'Stage 2: Active Usage',
    estimatedEndOfLife: 'Jan 2028',
    qrVerifiedText: 'Verified & Active',
    qrExplanation: 'Hardware tag linked to Marcus Vance custodian record.',
    lifecycleStages: [
      { step: 1, name: '1. Allocation', subtitle: 'Procured & tagged', statusLabel: 'Completed', statusType: 'completed', dateLabel: '10 Jan 2024' },
      { step: 2, name: '2. Active Usage', subtitle: 'In daily deployment at HQ Floor 4', statusLabel: 'Current Stage', statusType: 'current', dateLabel: 'Since 12 Jan 2024' },
      { step: 3, name: '3. Maintenance', subtitle: 'Hardware diagnostics', statusLabel: 'Scheduled', statusType: 'scheduled', dateLabel: 'Next: Jan 2026' },
      { step: 4, name: '4. Disposal', subtitle: 'Buyback / Refresh cycle', statusLabel: 'Pending', statusType: 'pending', dateLabel: 'Jan 2028' },
    ],
    acquisition: {
      purchaseDate: '10 Jan 2024',
      vendorName: 'Apple Enterprise Sales',
      invoiceReference: 'INV-APL-2024-9912',
      poNumber: 'PO-9912-APL',
      totalCost: '₹3,49,900',
      warrantyPeriod: '3-Year Onsite Cover (Jan 2027)',
      configuredDepreciation: 'Straight Line (3 Yrs)',
    },
    custody: {
      assignedCustodian: 'Marcus Vance (EMP-4092)',
      department: 'Product Design & UX',
      assignedLocation: 'HQ - Bldg B, Floor 4, Desk B-412',
      allocationDate: '12 Jan 2024',
      designatedUser: 'Marcus Vance (EMP-4092)',
      accountabilityStatus: 'Active Assignment',
    },
    movementHistory: [
      { id: 'MOV-MBP-01', date: '12 Jan 2024', movementType: 'Initial Handover', from: 'Central IT Depot', to: 'HQ Floor 4 Desk B-412', custodian: 'Marcus Vance', verification: 'QR Verified' },
    ],
    maintenanceHistory: [],
    auditHistory: [
      { id: 'AUD-MBP-01', event: 'Asset Allocated to Custodian', icon: 'assignment_turned_in', iconColor: '#0891B2', dateTime: '12 Jan 2024, 09:30 AM', performedBy: 'Hardware Ops (R. Davis)' },
      { id: 'AUD-MBP-02', event: 'Asset Tagged & Inventoried', icon: 'add_circle', iconColor: '#0891B2', dateTime: '10 Jan 2024, 02:15 PM', performedBy: 'Admin (S. Jenkins)' },
    ],
  },
  'AST-2024-0109': {
    id: 'AST-2024-0109',
    name: 'Dell UltraSharp 32" 4K PremierColor',
    status: 'Active',
    category: 'Displays & Monitors',
    specification: 'U3223QE, IPS Black, 90W USB-C Hub integrated',
    serialNumber: 'CN-0V2Y89-74261-43M-091A',
    assignedCustodianDepartment: 'Product Design & UX',
    assignedCustodianName: 'Marcus Vance',
    assignedLocation: 'HQ - Bldg B, Floor 4',
    assignedSubLocation: 'Desk B-412',
    warrantyStatus: 'Valid until Mar 2027',
    warrantyCover: '3-Year Advanced Exchange Service',
    lifecycleStageText: 'Stage 2: Active Usage',
    estimatedEndOfLife: 'Mar 2029',
    qrVerifiedText: 'Verified & Active',
    qrExplanation: 'Linked to Marcus Vance workstation hub.',
    lifecycleStages: [
      { step: 1, name: '1. Allocation', subtitle: 'Procured & deployed', statusLabel: 'Completed', statusType: 'completed', dateLabel: '14 Mar 2024' },
      { step: 2, name: '2. Active Usage', subtitle: 'Operational at desk B-412', statusLabel: 'Current Stage', statusType: 'current', dateLabel: 'Since 15 Mar 2024' },
      { step: 3, name: '3. Maintenance', subtitle: 'Panel diagnostics', statusLabel: 'Scheduled', statusType: 'scheduled', dateLabel: 'Next: Mar 2026' },
      { step: 4, name: '4. Disposal', subtitle: 'Refresh cycle', statusLabel: 'Pending', statusType: 'pending', dateLabel: 'Mar 2029' },
    ],
    acquisition: {
      purchaseDate: '14 Mar 2024',
      vendorName: 'Dell Commercial',
      invoiceReference: 'INV-DEL-2024-8812',
      poNumber: 'PO-8812-DEL',
      totalCost: '₹89,500',
      warrantyPeriod: '3-Year Onsite Cover (Mar 2027)',
      configuredDepreciation: 'Straight Line (4 Yrs)',
    },
    custody: {
      assignedCustodian: 'Marcus Vance (EMP-4092)',
      department: 'Product Design & UX',
      assignedLocation: 'HQ - Bldg B, Floor 4, Desk B-412',
      allocationDate: '15 Mar 2024',
      designatedUser: 'Marcus Vance (EMP-4092)',
      accountabilityStatus: 'Active Assignment',
    },
    movementHistory: [],
    maintenanceHistory: [],
    auditHistory: [
      { id: 'AUD-MON-01', event: 'Asset Allocated', icon: 'assignment_turned_in', iconColor: '#0891B2', dateTime: '15 Mar 2024, 11:00 AM', performedBy: 'Hardware Ops' },
    ],
  },
  'AST-2024-0322': {
    id: 'AST-2024-0322',
    name: 'Keychron Q1 Pro Mechanical Keyboard',
    status: 'Active',
    category: 'Peripherals & Input',
    specification: 'QMK Wireless 75% Layout, Red Switches, Carbon Black',
    serialNumber: 'KC-Q1P-2024-8841',
    assignedCustodianDepartment: 'Product Design & UX',
    assignedCustodianName: 'Marcus Vance',
    assignedLocation: 'Remote / Home Office',
    assignedSubLocation: 'Ergonomic Pod',
    warrantyStatus: 'Valid until Aug 2025',
    warrantyCover: '1-Year Manufacturer Warranty',
    lifecycleStageText: 'Stage 2: Active Usage',
    estimatedEndOfLife: 'Aug 2027',
    qrVerifiedText: 'Verified & Active',
    qrExplanation: 'Hybrid policy peripheral equipment.',
    lifecycleStages: [
      { step: 1, name: '1. Allocation', subtitle: 'Issued for hybrid work', statusLabel: 'Completed', statusType: 'completed', dateLabel: '05 Aug 2024' },
      { step: 2, name: '2. Active Usage', subtitle: 'Home office deployment', statusLabel: 'Current Stage', statusType: 'current', dateLabel: 'Since 08 Aug 2024' },
      { step: 3, name: '3. Maintenance', subtitle: 'N/A', statusLabel: 'N/A', statusType: 'pending', dateLabel: 'N/A' },
      { step: 4, name: '4. Disposal', subtitle: 'N/A', statusLabel: 'N/A', statusType: 'pending', dateLabel: 'Aug 2027' },
    ],
    acquisition: {
      purchaseDate: '05 Aug 2024',
      vendorName: 'Keychron Direct',
      invoiceReference: 'INV-KC-2024-1102',
      poNumber: 'PO-1102-KC',
      totalCost: '₹18,900',
      warrantyPeriod: '1-Year Cover (Aug 2025)',
      configuredDepreciation: 'Straight Line (3 Yrs)',
    },
    custody: {
      assignedCustodian: 'Marcus Vance (EMP-4092)',
      department: 'Product Design & UX',
      assignedLocation: 'Remote / Home Office',
      allocationDate: '08 Aug 2024',
      designatedUser: 'Marcus Vance (EMP-4092)',
      accountabilityStatus: 'Active Assignment',
    },
    movementHistory: [],
    maintenanceHistory: [],
    auditHistory: [
      { id: 'AUD-KBD-01', event: 'Asset Allocated', icon: 'assignment_turned_in', iconColor: '#0891B2', dateTime: '08 Aug 2024, 02:00 PM', performedBy: 'Hardware Ops' },
    ],
  },
  'AST-2023-0881': {
    id: 'AST-2023-0881',
    name: 'Apple iPad Pro 12.9"',
    status: 'In Maintenance',
    category: 'Mobile Devices',
    specification: '6th Gen, Wi-Fi 256GB Space Gray • Liquid Retina XDR',
    serialNumber: 'DMPXQ29VHP50',
    assignedCustodianDepartment: 'Product Design & UX',
    assignedCustodianName: 'Marcus Vance',
    assignedLocation: 'HQ - IT Service Lab (B-102)',
    assignedSubLocation: 'Service Bench 2',
    warrantyStatus: 'Active under Enterprise Care',
    warrantyCover: 'AppleCare+ for Enterprise',
    lifecycleStageText: 'Stage 3: Maintenance & Diagnostics',
    estimatedEndOfLife: 'Nov 2027',
    qrVerifiedText: 'In Service Lab',
    qrExplanation: 'Under corporate IT ticket TKT-IT-2026-4491 for battery diagnostic.',
    lifecycleStages: [
      { step: 1, name: '1. Allocation', subtitle: 'Procured & deployed', statusLabel: 'Completed', statusType: 'completed', dateLabel: '15 Jan 2024' },
      { step: 2, name: '2. Active Usage', subtitle: 'UX design & testing', statusLabel: 'Completed', statusType: 'completed', dateLabel: 'Until 20 Nov 2024' },
      { step: 3, name: '3. Maintenance', subtitle: 'Battery diagnostic & servicing', statusLabel: 'Current Stage', statusType: 'current', dateLabel: 'Since 20 Nov 2024' },
      { step: 4, name: '4. Disposal', subtitle: 'N/A', statusLabel: 'Pending', statusType: 'pending', dateLabel: 'Nov 2027' },
    ],
    acquisition: {
      purchaseDate: '15 Jan 2024',
      vendorName: 'Apple Enterprise Sales',
      invoiceReference: 'INV-APL-2024-3312',
      poNumber: 'PO-3312-APL',
      totalCost: '₹1,12,900',
      warrantyPeriod: 'AppleCare+ (Jan 2026)',
      configuredDepreciation: 'Straight Line (3 Yrs)',
    },
    custody: {
      assignedCustodian: 'Marcus Vance (EMP-4092)',
      department: 'Product Design & UX',
      assignedLocation: 'HQ - IT Service Lab (B-102)',
      allocationDate: '20 Nov 2024',
      designatedUser: 'Marcus Vance (EMP-4092)',
      accountabilityStatus: 'In Maintenance',
    },
    movementHistory: [
      { id: 'MOV-IPD-01', date: '20 Nov 2024', movementType: 'Maintenance Transfer', from: 'HQ Floor 4 Desk B-412', to: 'HQ IT Service Lab (B-102)', custodian: 'IT Service Lab', verification: 'QR Verified' },
    ],
    maintenanceHistory: [
      { id: 'MNT-IPD-01', date: '20 Nov 2024', serviceEvent: 'Battery Diagnostic & Thermal Inspection', vendor: 'Apple Authorized Service Provider', cost: 'Covered under AppleCare+', status: 'In Progress' },
    ],
    auditHistory: [
      { id: 'AUD-IPD-01', event: 'Transferred to Service Lab', icon: 'build', iconColor: '#F59E0B', dateTime: '20 Nov 2024, 10:15 AM', performedBy: 'Marcus Vance (Custodian)' },
    ],
  },
};

export const DEFAULT_ASSET_DETAILS_DATA = ASSET_DETAILS_MOCK_DATA['AST-NC-2026-0012'];
