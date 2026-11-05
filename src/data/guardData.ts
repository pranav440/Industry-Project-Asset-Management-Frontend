// =====================================================================
// AssetMX Guard Dashboard Data Store & Types
// Scoped to physical checkpoint inspection, barrier verification, entry/exit logging
// =====================================================================

export interface GuardKpiItem {
  total: number;
  badgeText: string;
  subtext: string;
}

export interface GuardKpis {
  expectedInbound: GuardKpiItem;
  expectedOutbound: GuardKpiItem;
  pendingVerification: GuardKpiItem;
  todaysCompletedEntries: GuardKpiItem;
}

export type GuardPassType = 'Outbound' | 'Inbound' | 'Inbound Return';
export type GuardQueueStatus = 'Awaiting Exit' | 'Awaiting Entry' | 'Flagged' | 'In Transit' | 'Cleared';
export type GuardActionType = 'verify' | 'flagged' | 'cleared';

export interface GuardVerificationQueueItem {
  id: string; // e.g. GP-2026-0422
  requesterName: string;
  requesterBadge: string;
  department: string;
  assetName: string;
  serialNumber: string;
  type: GuardPassType;
  status: GuardQueueStatus;
  action: GuardActionType;
  carrier?: string;
  destination?: string;
  origin?: string;
  flagReason?: string;
}

export interface GuardRecentActivityItem {
  id: string;
  title: string;
  time: string;
  passId: string;
  plateOrBadge: string;
  assetName: string;
  notes: string;
  badgeText: string;
  isFlagged?: boolean;
  type: 'entry' | 'exit' | 'flagged';
}

export interface GuardUpcomingMovementItem {
  id: string;
  time: string;
  title: string;
  type: 'Outbound' | 'Inbound';
  personLabel: string;
  personName: string;
  details: string;
  statusBadge: string;
}

export interface GuardCheckpointAlertItem {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'notice';
  badgeText: string;
  icon: string;
  description: string;
  passId?: string;
  serialNumber?: string;
  acknowledged?: boolean;
}

export const GUARD_KPIS_DATA: GuardKpis = {
  expectedInbound: {
    total: 14,
    badgeText: '+3 arriving soon',
    subtext: 'Scheduled intakes',
  },
  expectedOutbound: {
    total: 19,
    badgeText: '4 pending clearance',
    subtext: 'Authorized dispatches',
  },
  pendingVerification: {
    total: 6,
    badgeText: 'Priority Action',
    subtext: 'Physical barrier queue',
  },
  todaysCompletedEntries: {
    total: 31,
    badgeText: '96.9% Verified',
    subtext: 'Cleared checkpoint logs',
  },
};

export const GUARD_VERIFICATION_QUEUE_DATA: GuardVerificationQueueItem[] = [
  {
    id: 'GP-2026-0422',
    requesterName: 'Elena Rostova',
    requesterBadge: 'ENG-9042',
    department: 'Engineering',
    assetName: 'Cisco Catalyst 9300 Switch',
    serialNumber: 'CS-9300-8801',
    type: 'Outbound',
    status: 'Awaiting Exit',
    action: 'verify',
    carrier: 'Dedicated Carrier CA-894-MX',
    destination: 'Remote Colocation Datacenter #3',
  },
  {
    id: 'GP-2026-0420',
    requesterName: 'Marcus Kane',
    requesterBadge: 'FAC-3109',
    department: 'Facilities',
    assetName: 'Fluke Networks Versiv DSX',
    serialNumber: 'FLK-789-PRO',
    type: 'Inbound',
    status: 'Awaiting Entry',
    action: 'verify',
    carrier: 'Internal Courier',
    destination: 'Central Equipment Depot',
  },
  {
    id: 'GP-2026-0418',
    requesterName: 'Travis Henderson',
    requesterBadge: 'IT-4420',
    department: 'IT Infrastructure',
    assetName: 'Dell PowerEdge R750xs Server',
    serialNumber: 'DL-9014',
    type: 'Outbound',
    status: 'Flagged',
    action: 'flagged',
    carrier: 'Freight Courier NY-512-AB',
    destination: 'East Server Annex',
    flagReason:
      'Physical serial CS-9300-8801 reported tag mismatch against digital manifest at East Barrier. Secondary inspection required prior to barrier release.',
  },
  {
    id: 'GP-2026-0414',
    requesterName: 'Chloe Lin',
    requesterBadge: 'ENG-7120',
    department: 'AI Research',
    assetName: 'NVIDIA DGX A100 Workstation',
    serialNumber: 'NV-DGX-1024',
    type: 'Inbound Return',
    status: 'In Transit',
    action: 'verify',
    carrier: 'Logistics Van TX-440-KM',
    destination: 'AI Research Lab Sector 4',
  },
  {
    id: 'GP-2026-0411',
    requesterName: 'David Vance',
    requesterBadge: 'FAC-0941',
    department: 'Facilities',
    assetName: 'Honeywell HVAC Industrial Board',
    serialNumber: 'HW-0553',
    type: 'Outbound',
    status: 'Cleared',
    action: 'cleared',
    carrier: 'Facilities Van #12',
    destination: 'West Campus Sector 3',
  },
  {
    id: 'GP-2026-0408',
    requesterName: 'Jonathan Blake',
    requesterBadge: 'FAC-0012',
    department: 'Facilities',
    assetName: 'Fluke Industrial Multimeter Kit',
    serialNumber: 'FLK-789-PRO',
    type: 'Inbound',
    status: 'Awaiting Entry',
    action: 'verify',
    carrier: 'Commercial Courier',
    destination: 'Facilities Workshop Bay 4',
  },
];

export const GUARD_RECENT_ACTIVITY_DATA: GuardRecentActivityItem[] = [
  {
    id: 'ACT-01',
    title: 'Record Entry / Cleared',
    time: '14:12',
    passId: 'GP-2026-0409',
    plateOrBadge: 'CA-894-MX',
    assetName: 'Fluke Calibrator & Test Units (3 items)',
    notes: 'Physical barrier pass logged',
    badgeText: 'Barrier Cleared',
    type: 'entry',
  },
  {
    id: 'ACT-02',
    title: 'Record Exit / Cleared',
    time: '13:50',
    passId: 'GP-2026-0405',
    plateOrBadge: 'NY-512-AB',
    assetName: 'Dell UltraSharp 32" Monitors (2 units)',
    notes: 'Physical gate exit completed',
    badgeText: 'Barrier Cleared',
    type: 'exit',
  },
  {
    id: 'ACT-03',
    title: 'Record Entry / Cleared',
    time: '13:15',
    passId: 'GP-2026-0402',
    plateOrBadge: 'Badge #SEC-014',
    assetName: 'Hardware Toolkit & Diagnostic Kit',
    notes: 'Staff passage registered',
    badgeText: 'Logged Entry',
    type: 'entry',
  },
  {
    id: 'ACT-04',
    title: 'Barrier Exit Flagged',
    time: '12:40',
    passId: 'GP-2026-0399',
    plateOrBadge: 'TX-440-KM',
    assetName: 'SAN Storage Array Shelf',
    notes: 'Barrier locked: tag mismatch logged',
    badgeText: 'Discrepancy',
    isFlagged: true,
    type: 'flagged',
  },
];

export const GUARD_UPCOMING_MOVEMENTS_DATA: GuardUpcomingMovementItem[] = [
  {
    id: 'MOV-UP-01',
    time: '16:30',
    title: 'Keysight Infiniium Scope',
    type: 'Outbound',
    personLabel: 'Custodian',
    personName: 'Amina Latif (QA Labs)',
    details: 'Destination: Remote Colocation Datacenter #3 • Transporter: Dedicated Courier',
    statusBadge: 'Pass Approved',
  },
  {
    id: 'MOV-UP-02',
    time: '17:00',
    title: 'HP LaserJet Enterprise Printer',
    type: 'Inbound',
    personLabel: 'Requester',
    personName: 'David Vance (Facilities)',
    details: 'Origin: Central Depot • Transporter: Internal Logistics',
    statusBadge: 'In Transit',
  },
  {
    id: 'MOV-UP-03',
    time: '17:30',
    title: 'Cisco Nexus Spine Switches (x2)',
    type: 'Outbound',
    personLabel: 'Custodian',
    personName: 'Elena Rostova',
    details: 'Destination: Lab 4 Corridor • Transporter: Hand Carry',
    statusBadge: 'Manifest Pending',
  },
];

export const GUARD_CHECKPOINT_ALERTS_DATA: GuardCheckpointAlertItem[] = [
  {
    id: 'ALT-G01',
    title: 'Gate Pass Discrepancy Flagged',
    severity: 'critical',
    badgeText: 'Critical',
    icon: 'gpp_maybe',
    passId: 'GP-2026-0418',
    serialNumber: 'CS-9300-8801',
    description:
      'GP-2026-0418: Physical serial CS-9300-8801 reported tag mismatch against digital manifest at East Barrier. Secondary inspection required prior to barrier release.',
    acknowledged: false,
  },
  {
    id: 'ALT-G02',
    title: 'Delayed Outbound Transit',
    severity: 'warning',
    badgeText: 'Warning',
    icon: 'schedule',
    passId: 'GP-2026-0407',
    description:
      'GP-2026-0407: Scheduled exit 13:00 exceeded 60-min departure window. Vehicle CA-201-PL not yet presented at checkpoint.',
    acknowledged: false,
  },
  {
    id: 'ALT-G03',
    title: 'Unscheduled Delivery Vehicle',
    severity: 'notice',
    badgeText: 'Notice',
    icon: 'no_crash',
    description:
      'Van delivery arrived at North Barrier without pre-cleared asset manifest. Directing driver to temporary holding bay for paperwork.',
    acknowledged: false,
  },
];

