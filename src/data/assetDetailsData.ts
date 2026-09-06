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
};

export const DEFAULT_ASSET_DETAILS_DATA = ASSET_DETAILS_MOCK_DATA['AST-NC-2026-0012'];
