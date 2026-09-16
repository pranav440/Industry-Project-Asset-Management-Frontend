// =====================================================================
// AssetMX Gate Pass Data Store & Demonstration Records
// Local storage state with realistic synthetic organizational gate passes
// =====================================================================

export type GatePassType = 'Asset Movement' | 'Returnable' | 'Non-Returnable' | 'Maintenance';
export type GatePassStatus = 'Pending' | 'Approved' | 'Rejected' | 'Active' | 'Completed' | 'Escalated';

export interface GateActivity {
  exitStatus: 'Pending' | 'Verified' | 'N/A';
  exitTimestamp?: string;
  exitGate?: string;
  exitOfficer?: string;
  exitNotes?: string;
  entryStatus: 'Pending' | 'Verified' | 'N/A';
  entryTimestamp?: string;
  entryGate?: string;
  entryOfficer?: string;
  entryNotes?: string;
}

export interface EscalationRecord {
  isEscalated: boolean;
  reason?: string;
  timestamp?: string;
  actionRequired?: string;
  escalatedBy?: string;
}

export interface GatePassHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  note?: string;
  statusSnapshot?: GatePassStatus;
}

export interface GatePassItemData {
  id: string; // e.g. GP-2026-0012
  passType: GatePassType;
  requestDate: string; // YYYY-MM-DD
  status: GatePassStatus;
  requesterName: string;
  department: string;
  assetOrItem: string;
  quantity: number;
  currentLocation: string;
  destination: string;
  movementDate: string; // YYYY-MM-DD
  purpose: string;
  authorizationState: string;
  decisionStatus: string;
  decisionDate?: string;
  decisionBy?: string;
  gateActivity: GateActivity;
  escalation: EscalationRecord;
  history: GatePassHistoryEntry[];
}

export const INITIAL_GATE_PASSES: GatePassItemData[] = [
  {
    id: 'GP-2026-0012',
    passType: 'Asset Movement',
    requestDate: '2026-09-14',
    status: 'Pending',
    requesterName: 'Sarah Jenkins',
    department: 'Software Engineering',
    assetOrItem: 'Dell UltraSharp 32" 4K Monitor (U3223QE)',
    quantity: 1,
    currentLocation: 'Main Office - Floor 3',
    destination: 'Branch Office - West Campus',
    movementDate: '2026-09-16',
    purpose: 'Temporary hardware allocation for frontend UI design system rollout and accessibility verification.',
    authorizationState: 'Pending Administrative Decision',
    decisionStatus: 'Awaiting Review',
    gateActivity: {
      exitStatus: 'Pending',
      exitGate: 'North Gate - Commercial Bay 1',
      entryStatus: 'Pending',
      entryGate: 'West Campus Gate 2',
    },
    escalation: {
      isEscalated: false,
    },
    history: [
      {
        id: 'EVT-GP-001',
        timestamp: '2026-09-14 09:30',
        action: 'Gate pass created',
        performedBy: 'Sarah Jenkins (Software Engineering)',
        note: 'Initial movement request submitted for West Campus rollout.',
        statusSnapshot: 'Pending',
      },
    ],
  },
  {
    id: 'GP-2026-0013',
    passType: 'Maintenance',
    requestDate: '2026-09-15',
    status: 'Approved',
    requesterName: 'David Kim',
    department: 'Hardware Maintenance',
    assetOrItem: 'Fluke 87V Industrial Digital Multimeter',
    quantity: 1,
    currentLocation: 'Workshop Bay 2',
    destination: 'Authorized Vendor Calibration Center',
    movementDate: '2026-09-16',
    purpose: 'Annual precision recalibration and laboratory compliance certification.',
    authorizationState: 'Administrative Clearance Granted',
    decisionStatus: 'Approved by Administrator',
    decisionDate: '2026-09-15 14:20',
    decisionBy: 'Administrator',
    gateActivity: {
      exitStatus: 'Pending',
      exitGate: 'South Gate 3',
      entryStatus: 'Pending',
      entryGate: 'South Gate 3',
    },
    escalation: {
      isEscalated: false,
    },
    history: [
      {
        id: 'EVT-GP-002',
        timestamp: '2026-09-15 14:20',
        action: 'Approval decision',
        performedBy: 'Administrator',
        note: 'Approved for external calibration facility transfer.',
        statusSnapshot: 'Approved',
      },
      {
        id: 'EVT-GP-003',
        timestamp: '2026-09-15 11:00',
        action: 'Gate pass created',
        performedBy: 'David Kim (Hardware Maintenance)',
        note: 'Mandatory annual diagnostic recalibration.',
        statusSnapshot: 'Pending',
      },
    ],
  },
  {
    id: 'GP-2026-0014',
    passType: 'Returnable',
    requestDate: '2026-09-13',
    status: 'Active',
    requesterName: 'Marcus Vance',
    department: 'IT Support',
    assetOrItem: 'Cisco Catalyst 9200 48-Port Switch',
    quantity: 2,
    currentLocation: 'Main Server Room B04',
    destination: 'Data Center Annex - Bay 12',
    movementDate: '2026-09-14',
    purpose: 'Emergency network failover backup installation for cluster failover testing.',
    authorizationState: 'Active in Transit',
    decisionStatus: 'Approved by Administrator',
    decisionDate: '2026-09-13 16:00',
    decisionBy: 'Administrator',
    gateActivity: {
      exitStatus: 'Verified',
      exitTimestamp: '2026-09-14 08:45',
      exitGate: 'North Gate - Cargo Bay 1',
      exitOfficer: 'Guard Station A',
      exitNotes: 'Items verified against pass record. Sealed in transit crate #4.',
      entryStatus: 'Pending',
      entryGate: 'Data Center Annex Gate',
    },
    escalation: {
      isEscalated: false,
    },
    history: [
      {
        id: 'EVT-GP-004',
        timestamp: '2026-09-14 08:45',
        action: 'Exit verification',
        performedBy: 'Guard Station A',
        note: 'Physical items checked and outbound dispatch verified.',
        statusSnapshot: 'Active',
      },
      {
        id: 'EVT-GP-005',
        timestamp: '2026-09-13 16:00',
        action: 'Approval decision',
        performedBy: 'Administrator',
        note: 'Authorized for network emergency change window.',
        statusSnapshot: 'Approved',
      },
      {
        id: 'EVT-GP-006',
        timestamp: '2026-09-13 10:15',
        action: 'Gate pass created',
        performedBy: 'Marcus Vance (IT Support)',
        statusSnapshot: 'Pending',
      },
    ],
  },
  {
    id: 'GP-2026-0015',
    passType: 'Non-Returnable',
    requestDate: '2026-09-10',
    status: 'Completed',
    requesterName: 'Elena Rostova',
    department: 'Finance & Operations',
    assetOrItem: 'Archival Storage File Boxes (Batch 2021-2023)',
    quantity: 12,
    currentLocation: 'Finance Archive Room 2B',
    destination: 'Central Enterprise Records Repository',
    movementDate: '2026-09-11',
    purpose: 'Permanent document archiving transfer per corporate retention regulations.',
    authorizationState: 'Completed & Archived',
    decisionStatus: 'Approved by Administrator',
    decisionDate: '2026-09-10 15:30',
    decisionBy: 'Administrator',
    gateActivity: {
      exitStatus: 'Verified',
      exitTimestamp: '2026-09-11 09:15',
      exitGate: 'East Logistics Gate',
      exitOfficer: 'Guard Station B',
      exitNotes: '12 document boxes checked and logged.',
      entryStatus: 'Verified',
      entryTimestamp: '2026-09-11 11:30',
      entryGate: 'Repository Central Dock',
      entryOfficer: 'Host Receiving Desk',
      entryNotes: 'Received and verified into archive room.',
    },
    escalation: {
      isEscalated: false,
    },
    history: [
      {
        id: 'EVT-GP-007',
        timestamp: '2026-09-11 11:30',
        action: 'Entry verification',
        performedBy: 'Host Receiving Desk',
        note: 'Complete shipment accepted at destination.',
        statusSnapshot: 'Completed',
      },
      {
        id: 'EVT-GP-008',
        timestamp: '2026-09-11 09:15',
        action: 'Exit verification',
        performedBy: 'Guard Station B',
        note: 'Outbound dispatch completed.',
        statusSnapshot: 'Active',
      },
      {
        id: 'EVT-GP-009',
        timestamp: '2026-09-10 15:30',
        action: 'Approval decision',
        performedBy: 'Administrator',
        statusSnapshot: 'Approved',
      },
      {
        id: 'EVT-GP-010',
        timestamp: '2026-09-10 11:00',
        action: 'Gate pass created',
        performedBy: 'Elena Rostova (Finance)',
        statusSnapshot: 'Pending',
      },
    ],
  },
  {
    id: 'GP-2026-0016',
    passType: 'Asset Movement',
    requestDate: '2026-09-12',
    status: 'Escalated',
    requesterName: 'Dr. Aris Thorne',
    department: 'Research & Lab',
    assetOrItem: 'High-Precision Oscilloscope 100MHz 4-CH',
    quantity: 1,
    currentLocation: 'Lab Room 101',
    destination: 'Research Facility North',
    movementDate: '2026-09-13',
    purpose: 'Sensor firmware signal measurement cross-validation.',
    authorizationState: 'Escalated — Clearance Discrepancy',
    decisionStatus: 'Escalated for Inspection',
    decisionDate: '2026-09-13 10:00',
    decisionBy: 'Guard Station A',
    gateActivity: {
      exitStatus: 'Pending',
      exitGate: 'North Gate - Cargo Bay 1',
      exitNotes: 'Transit delayed due to packaging verification mismatch.',
      entryStatus: 'Pending',
      entryGate: 'Research Facility North Gate',
    },
    escalation: {
      isEscalated: true,
      reason: 'Physical packaging serial label mismatched with listed manifest during preliminary gate check.',
      timestamp: '2026-09-13 10:00',
      actionRequired: 'Administrative verification and clearance confirmation required before gate dispatch.',
      escalatedBy: 'Guard Station A',
    },
    history: [
      {
        id: 'EVT-GP-011',
        timestamp: '2026-09-13 10:00',
        action: 'Escalation',
        performedBy: 'Guard Station A',
        note: 'Gate dispatch held: packaging discrepancy flagged for administrative review.',
        statusSnapshot: 'Escalated',
      },
      {
        id: 'EVT-GP-012',
        timestamp: '2026-09-12 16:45',
        action: 'Approval decision',
        performedBy: 'Administrator',
        note: 'Approved for research transport.',
        statusSnapshot: 'Approved',
      },
      {
        id: 'EVT-GP-013',
        timestamp: '2026-09-12 14:00',
        action: 'Gate pass created',
        performedBy: 'Dr. Aris Thorne (Research & Lab)',
        statusSnapshot: 'Pending',
      },
    ],
  },
  {
    id: 'GP-2026-0017',
    passType: 'Asset Movement',
    requestDate: '2026-09-08',
    status: 'Rejected',
    requesterName: 'Ananya Sharma',
    department: 'Product Design',
    assetOrItem: 'Wacom Cintiq Pro 24 Creative Display',
    quantity: 1,
    currentLocation: 'Design Studio Studio 4',
    destination: 'Offsite Remote Location',
    movementDate: '2026-09-09',
    purpose: 'Offsite personal workstation setup.',
    authorizationState: 'Administrative Request Denied',
    decisionStatus: 'Rejected by Administrator',
    decisionDate: '2026-09-08 17:00',
    decisionBy: 'Administrator',
    gateActivity: {
      exitStatus: 'N/A',
      entryStatus: 'N/A',
    },
    escalation: {
      isEscalated: false,
    },
    history: [
      {
        id: 'EVT-GP-014',
        timestamp: '2026-09-08 17:00',
        action: 'Rejection decision',
        performedBy: 'Administrator',
        note: 'AssetMX policy does not permit studio master displays for offsite personal transport.',
        statusSnapshot: 'Rejected',
      },
      {
        id: 'EVT-GP-015',
        timestamp: '2026-09-08 13:30',
        action: 'Gate pass created',
        performedBy: 'Ananya Sharma (Product Design)',
        statusSnapshot: 'Pending',
      },
    ],
  },
];

const LOCAL_STORAGE_KEY = 'amx_gate_passes_records_v1';

export function getStoredGatePasses(): GatePassItemData[] {
  if (typeof window === 'undefined') return INITIAL_GATE_PASSES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load stored gate passes from localStorage', e);
  }
  return INITIAL_GATE_PASSES;
}

export function saveStoredGatePasses(items: GatePassItemData[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save gate passes to localStorage', e);
  }
}

export const GATE_PASS_FILTER_OPTIONS = {
  passTypes: [
    { value: '', label: 'All Pass Types' },
    { value: 'Asset Movement', label: 'Asset Movement' },
    { value: 'Returnable', label: 'Returnable' },
    { value: 'Non-Returnable', label: 'Non-Returnable' },
    { value: 'Maintenance', label: 'Maintenance' },
  ],
  statuses: [
    { value: '', label: 'All Statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Active', label: 'Active' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Escalated', label: 'Escalated' },
    { value: 'Rejected', label: 'Rejected' },
  ],
  locations: [
    { value: '', label: 'All Locations' },
    { value: 'Main Office - Floor 3', label: 'Main Office - Floor 3' },
    { value: 'Workshop Bay 2', label: 'Workshop Bay 2' },
    { value: 'Main Server Room B04', label: 'Main Server Room B04' },
    { value: 'Finance Archive Room 2B', label: 'Finance Archive Room 2B' },
    { value: 'Lab Room 101', label: 'Lab Room 101' },
    { value: 'Design Studio Studio 4', label: 'Design Studio Studio 4' },
  ],
};
