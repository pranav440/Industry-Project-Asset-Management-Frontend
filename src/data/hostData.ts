// =====================================================================
// AssetMX Host Dashboard Data Store & Demonstration Records
// Realistic operational records matching the approved Host Stitch design
// =====================================================================

export interface HostKpis {
  activeGatePasses: {
    total: number;
    outbound: number;
    inboundScheduled: number;
    badgeText: string;
  };
  pendingHostActions: {
    total: number;
    subtext: string;
    badgeText: string;
  };
  todaysMovement: {
    total: number;
    completed: number;
    inTransit: number;
    trend: string;
  };
  escalatedGatePasses: {
    total: number;
    subtext: string;
    badgeText: string;
  };
}

export type HostGatePassType =
  | 'Returnable'
  | 'Non-Returnable'
  | 'Maint. Dispatch'
  | 'Inter-Site Transfer';

export type HostGatePassStatus =
  | 'In Progress'
  | 'Approved'
  | 'Escalated'
  | 'Pending';

export interface HostGatePassActivityItem {
  id: string; // e.g. GP-2026-0418
  passType: HostGatePassType;
  assetName: string;
  serialNumber: string;
  requesterName: string;
  department: string;
  schedule: string;
  status: HostGatePassStatus;
  destination?: string;
  gateLocation?: string;
}

export interface HostMovementScanItem {
  id: string; // e.g. MOV-2026-0182
  status: 'Verified In-Transit' | 'Gate Clearance' | 'Return Check-In';
  assetTag: string;
  assetName: string;
  route: string;
  station: string;
  timeAgo: string;
}

export interface HostPendingActionItem {
  id: string;
  passId: string;
  title: string;
  requester: string;
  actionText: string;
  actionType: 'verify' | 'inspect' | 'carrier';
  icon: string;
  isPrimary: boolean;
  buttonText: string;
  assetName: string;
  serialNumber: string;
  destination: string;
  carrier: string;
  instructions: string;
}

export interface HostOperationalAlertItem {
  id: string;
  title: string;
  description: string;
  location: string;
  timeAgo: string;
  severity: 'critical' | 'info' | 'warning';
  icon: string;
  dotColor: string;
}

export const HOST_KPIS_DATA: HostKpis = {
  activeGatePasses: {
    total: 24,
    outbound: 18,
    inboundScheduled: 6,
    badgeText: 'Live',
  },
  pendingHostActions: {
    total: 5,
    subtext: 'Verification & check-in required',
    badgeText: 'Priority',
  },
  todaysMovement: {
    total: 14,
    completed: 9,
    inTransit: 5,
    trend: '+18%',
  },
  escalatedGatePasses: {
    total: 2,
    subtext: 'Security officer review queue',
    badgeText: 'Review',
  },
};

export const HOST_GATE_PASS_ACTIVITY_DATA: HostGatePassActivityItem[] = [
  {
    id: 'GP-2026-0418',
    passType: 'Returnable',
    assetName: 'Apple MacBook Pro 16" M3 Max',
    serialNumber: 'SN: MBP-9941-X4',
    requesterName: 'Elena Rostova',
    department: 'Engineering',
    schedule: 'Today, 14:30',
    status: 'In Progress',
    destination: 'Client Demo Facility - Tech Park',
    gateLocation: 'Main Gate Checkpoint',
  },
  {
    id: 'GP-2026-0415',
    passType: 'Non-Returnable',
    assetName: 'Dell Precision 5820 Workstation',
    serialNumber: 'SN: DWS-8129-K8',
    requesterName: 'David Kim',
    department: 'Infrastructure',
    schedule: 'Today, 16:00',
    status: 'Approved',
    destination: 'Permanent Data Center Bay B',
    gateLocation: 'East Logistics Bay',
  },
  {
    id: 'GP-2026-0412',
    passType: 'Maint. Dispatch',
    assetName: 'Cisco Catalyst 9300 Switch',
    serialNumber: 'SN: CS-9300-8801',
    requesterName: 'Marcus Vance',
    department: 'Product Design',
    schedule: 'Tomorrow, 09:15',
    status: 'Escalated',
    destination: 'Authorized Vendor Diagnostic Lab',
    gateLocation: 'North Security Gate',
  },
  {
    id: 'GP-2026-0409',
    passType: 'Inter-Site Transfer',
    assetName: 'HP Color LaserJet Enterprise',
    serialNumber: 'SN: HP-ENT-4421',
    requesterName: 'Rachel Adams',
    department: 'QA Labs',
    schedule: '18 Feb 2026',
    status: 'Pending',
    destination: 'West Campus Office Suite 402',
    gateLocation: 'Central Loading Dock',
  },
  {
    id: 'GP-2026-0401',
    passType: 'Returnable',
    assetName: 'Fluke Industrial Multimeter Kit',
    serialNumber: 'SN: FLK-789-PRO',
    requesterName: 'Jonathan Blake',
    department: 'Facilities',
    schedule: '19 Feb 2026',
    status: 'Approved',
    destination: 'HVAC Calibration Site Sector 7',
    gateLocation: 'South Gate 3',
  },
  // Additional realistic passes to support pagination & filter testing (38 total records)
  {
    id: 'GP-2026-0398',
    passType: 'Returnable',
    assetName: 'Sony Alpha A7 IV Camera Kit',
    serialNumber: 'SN: SNY-A7IV-0182',
    requesterName: 'Sarah Jenkins',
    department: 'Creative Media',
    schedule: '20 Feb 2026',
    status: 'Approved',
    destination: 'Offsite Marketing Studio',
    gateLocation: 'Main Gate Checkpoint',
  },
  {
    id: 'GP-2026-0395',
    passType: 'Maint. Dispatch',
    assetName: 'Schneider Electric Smart-UPS 3000VA',
    serialNumber: 'SN: APC-UPS-4491',
    requesterName: 'David Kim',
    department: 'Infrastructure',
    schedule: '21 Feb 2026',
    status: 'Pending',
    destination: 'Battery Replacement Depot',
    gateLocation: 'East Logistics Bay',
  },
  {
    id: 'GP-2026-0392',
    passType: 'Returnable',
    assetName: 'Thermo Scientific Spectrometer',
    serialNumber: 'SN: TMS-SPEC-0551',
    requesterName: 'Dr. Aris Thorne',
    department: 'Research & Lab',
    schedule: '21 Feb 2026',
    status: 'Escalated',
    destination: 'Central Analysis Facility',
    gateLocation: 'Gate 3 Checkpoint',
  },
  {
    id: 'GP-2026-0388',
    passType: 'Non-Returnable',
    assetName: 'Archival Document Storage Crates (x8)',
    serialNumber: 'SN: BOX-DOC-2026-A',
    requesterName: 'Elena Rostova',
    department: 'Finance & Operations',
    schedule: '22 Feb 2026',
    status: 'Approved',
    destination: 'Secure Enterprise Archive Vault',
    gateLocation: 'East Logistics Bay',
  },
  {
    id: 'GP-2026-0384',
    passType: 'Inter-Site Transfer',
    assetName: 'Dell UltraSharp 38" Curved Monitor',
    serialNumber: 'SN: DEL-U38-9901',
    requesterName: 'Jonathan Blake',
    department: 'Executive Office',
    schedule: '22 Feb 2026',
    status: 'In Progress',
    destination: 'Downtown Executive Suites',
    gateLocation: 'Main Gate Checkpoint',
  },
];

export const HOST_MOVEMENT_OVERVIEW_DATA: HostMovementScanItem[] = [
  {
    id: 'MOV-2026-0182',
    status: 'Verified In-Transit',
    assetTag: 'AST-2024-0042',
    assetName: 'Mac Studio M2',
    route: 'Main Gate Checkpoint → Tech Hub Bldg B',
    station: 'Station: Kiosk G1',
    timeAgo: '10 mins ago',
  },
  {
    id: 'MOV-2026-0181',
    status: 'Gate Clearance',
    assetTag: 'AST-2024-0118',
    assetName: 'Dell UltraSharp 32"',
    route: 'Server Room 2 → Lab 4 Corridor',
    station: 'Station: Internal Scan 03',
    timeAgo: '35 mins ago',
  },
  {
    id: 'MOV-2026-0179',
    status: 'Return Check-In',
    assetTag: 'AST-2023-0892',
    assetName: 'Cisco Switch 48P',
    route: 'Dispatched to Remote Custodian',
    station: 'Station: Dispatch Bay 2',
    timeAgo: '1 hr ago',
  },
];

export const HOST_PENDING_ACTIONS_DATA: HostPendingActionItem[] = [
  {
    id: 'ACT-001',
    passId: 'GP-2026-0418',
    title: 'Outbound Hardware Dispatch',
    requester: 'Elena Rostova (Engineering)',
    actionText: 'Action: Verify Physical Asset Serial & Photo ID',
    actionType: 'verify',
    icon: 'verified_user',
    isPrimary: true,
    buttonText: 'View Details & Verify',
    assetName: 'Apple MacBook Pro 16" M3 Max',
    serialNumber: 'MBP-9941-X4',
    destination: 'Client Demo Facility - Tech Park',
    carrier: 'Self-Transport (Elena Rostova)',
    instructions:
      'Inspect physical asset serial number against pass record. Confirm bearer identity via government/corporate photo ID before dispatch.',
  },
  {
    id: 'ACT-002',
    passId: 'GP-2026-0415',
    title: 'Equipment Return Check-in',
    requester: 'David Kim (Infrastructure)',
    actionText: 'Action: Inspect Physical Seal & Confirm Intake',
    actionType: 'inspect',
    icon: 'inventory_2',
    isPrimary: false,
    buttonText: 'View Details',
    assetName: 'Dell Precision 5820 Workstation',
    serialNumber: 'DWS-8129-K8',
    destination: 'Hardware Depot Shelf B2',
    carrier: 'Internal Logistics Courier',
    instructions:
      'Inspect tamper-evident transit seal #8821. Verify hardware chassis integrity and log return intake in AssetMX.',
  },
  {
    id: 'ACT-003',
    passId: 'GP-2026-0409',
    title: 'Inter-Facility Transfer',
    requester: 'Rachel Adams (QA Labs)',
    actionText: 'Action: Awaiting Carrier Manifest Confirmation',
    actionType: 'carrier',
    icon: 'local_shipping',
    isPrimary: false,
    buttonText: 'View Details',
    assetName: 'HP Color LaserJet Enterprise',
    serialNumber: 'HP-ENT-4421',
    destination: 'West Campus Office Suite 402',
    carrier: 'FedEx Express Freight (Tracking: 7892-0012-441)',
    instructions:
      'Match freight bill of lading with listed hardware manifest before clearing vehicle at Central Loading Dock.',
  },
];

export const HOST_OPERATIONAL_ALERTS_DATA: HostOperationalAlertItem[] = [
  {
    id: 'ALT-001',
    title: 'Overdue Inbound Gate Pass GP-2026-0392',
    description:
      'Asset AST-2023-0551 (Spectrometer) was scheduled for return checkpoint by 12:00 PM today. Carrier not yet checked in at Gate 3.',
    location: 'Gate 3 Checkpoint',
    timeAgo: '1 hr ago',
    severity: 'critical',
    icon: 'warning',
    dotColor: '#ba1a1a',
  },
  {
    id: 'ALT-002',
    title: 'Scheduled Bulk Dispatch Window',
    description:
      '5 assets scheduled for IT Lab relocation through East Loading Bay between 15:00 and 16:30.',
    location: 'East Bay',
    timeAgo: 'Today, 11:00',
    severity: 'info',
    icon: 'info',
    dotColor: '#00687a',
  },
  {
    id: 'ALT-003',
    title: 'Gate Pass Discrepancy Escalated',
    description:
      'Serial number mismatch on GP-2026-0404 flagged during preliminary scan. Sent to Security Admin queue.',
    location: 'Central Gate',
    timeAgo: '2 hrs ago',
    severity: 'warning',
    icon: 'error_outline',
    dotColor: '#e06d53',
  },
];

