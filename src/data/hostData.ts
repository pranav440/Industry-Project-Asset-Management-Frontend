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

// =====================================================================
// Host Gate Passes Module Data & Types
// =====================================================================

export interface HostGatePassesKpis {
  totalPasses: {
    total: number;
    badgeText: string;
    subtext: string;
  };
  pendingVerification: {
    total: number;
    badgeText: string;
    subtext: string;
  };
  inProgress: {
    total: number;
    badgeText: string;
    subtext: string;
  };
  completed: {
    total: number;
    badgeText: string;
    subtext: string;
  };
}

export const HOST_GATE_PASSES_KPIS_DATA: HostGatePassesKpis = {
  totalPasses: {
    total: 38,
    badgeText: '+4 today',
    subtext: 'Across all active gate queues',
  },
  pendingVerification: {
    total: 5,
    badgeText: 'Priority Action',
    subtext: 'Physical custody & check-in required',
  },
  inProgress: {
    total: 9,
    badgeText: 'Active Movement',
    subtext: 'In-transit or perimeter clearance',
  },
  completed: {
    total: 22,
    badgeText: '98.2% Clearance Rate',
    subtext: 'Archived & verified cleared today',
  },
};

export type MovementDirection = 'Outbound Dispatch' | 'Inbound Intake';

export interface HostDetailedGatePass {
  id: string;
  requesterName: string;
  requesterInitials: string;
  requesterBadge: string;
  requesterRole: string;
  requesterExt: string;
  requesterEmail: string;
  department: 'Engineering' | 'Facilities' | 'QA Labs' | 'IT Operations' | 'Finance' | 'Executive';
  assetName: string;
  assetTag: string;
  assetSpec: string;
  assetCondition: string;
  serialNumber: string;
  isSerialMismatch?: boolean;
  movementType: MovementDirection;
  movementClass: string;
  originPoint: string;
  destination: string;
  scheduledDate: string;
  scheduledWindow: string;
  carrier: string;
  status: 'Pending' | 'Approved' | 'In Progress' | 'Escalated' | 'Completed' | 'Rejected';
  documents: Array<{
    name: string;
    type: string;
    size: string;
    isVerified?: boolean;
  }>;
  auditTrail: Array<{
    time: string;
    event: string;
    isIncident?: boolean;
    isCurrent?: boolean;
  }>;
}

export const HOST_DETAILED_GATE_PASSES: HostDetailedGatePass[] = [
  {
    id: 'GP-2026-0418',
    requesterName: 'Elena Rostova',
    requesterInitials: 'ER',
    requesterBadge: '#ENG-9042',
    requesterRole: 'Lead Hardware Architect • Engineering',
    requesterExt: 'x4819 (HQ-Net)',
    requesterEmail: 'elena.rostova@enterprise.internal',
    department: 'Engineering',
    assetName: 'Cisco Catalyst 9300 PoE+',
    assetTag: 'AST-2024-0042',
    assetSpec: '48-Port PoE+, Modular Uplink, C9300-48P',
    assetCondition: 'Good / Calibrated',
    serialNumber: 'CS-9300-8801',
    isSerialMismatch: true,
    movementType: 'Outbound Dispatch',
    movementClass: 'Outbound Hardware Dispatch',
    originPoint: 'Tech Hub Bldg B, Server Room 2',
    destination: 'Remote Datacenter Colocation (#3)',
    scheduledDate: '18 Feb 2026, 14:00',
    scheduledWindow: '18 Feb 2026, 14:00 - 16:30',
    carrier: 'Secure Logistics Van (CA-894-MX)',
    status: 'Escalated',
    documents: [
      {
        name: 'Transfer_Manifest_GP0418.pdf',
        type: 'Digital Signature: Verified',
        size: '1.4 MB',
        isVerified: true,
      },
      {
        name: 'Chain_of_Custody_Form.pdf',
        type: 'Host Physical Form',
        size: '840 KB',
        isVerified: false,
      },
    ],
    auditTrail: [
      { time: '09:15', event: 'Gate pass requisition initiated by Elena Rostova.' },
      { time: '10:45', event: 'Administrative pre-clearance completed by Facilities Ops.' },
      {
        time: '13:30 • INCIDENT FLAGGED',
        event: 'Checkpoint arrival; Serial mismatch flagged during perimeter inspection (chassis physical tag vs digital manifest review).',
        isIncident: true,
      },
      {
        time: '13:32 • Current Status',
        event: 'Escalated to Host Security Officer (Sarah Jenkins).',
        isCurrent: true,
      },
    ],
  },
  {
    id: 'GP-2026-0415',
    requesterName: 'Marcus Kane',
    requesterInitials: 'MK',
    requesterBadge: '#FAC-3109',
    requesterRole: 'Senior Facilities Engineer',
    requesterExt: 'x3109',
    requesterEmail: 'marcus.kane@enterprise.internal',
    department: 'Facilities',
    assetName: 'Fluke Networks Versiv DSX',
    assetTag: 'AST-2025-1108',
    assetSpec: 'CableAnalyzer High-Speed Copper Certifier',
    assetCondition: 'Good / Calibrated',
    serialNumber: 'FLK-DSX-9941',
    movementType: 'Inbound Intake',
    movementClass: 'Equipment Return Check-in',
    originPoint: 'HVAC Substation Bay 4',
    destination: 'Main Depot Storage Rack A',
    scheduledDate: '18 Feb 2026, 15:15',
    scheduledWindow: '18 Feb 2026, 15:00 - 17:00',
    carrier: 'Internal Courier',
    status: 'Pending',
    documents: [
      { name: 'Intake_Manifest_GP0415.pdf', type: 'Intake Manifest', size: '920 KB' },
      { name: 'Calibration_Cert_2026.pdf', type: 'Calibration Certificate', size: '1.2 MB' },
    ],
    auditTrail: [
      { time: '10:00', event: 'Requisition submitted by Marcus Kane.' },
      { time: '11:30', event: 'Scheduled for inbound perimeter check.' },
    ],
  },
  {
    id: 'GP-2026-0412',
    requesterName: 'Amina Latif',
    requesterInitials: 'AL',
    requesterBadge: '#QAL-8821',
    requesterRole: 'Principal QA Systems Engineer',
    requesterExt: 'x8821',
    requesterEmail: 'amina.latif@enterprise.internal',
    department: 'QA Labs',
    assetName: 'Keysight Infiniium Scope',
    assetTag: 'AST-2023-7729',
    assetSpec: '4-Channel High Bandwidth Oscilloscope',
    assetCondition: 'Good / Calibrated',
    serialNumber: 'KY-INF-7729-A',
    movementType: 'Outbound Dispatch',
    movementClass: 'Inter-Facility Lab Transfer',
    originPoint: 'QA Cleanroom Lab 3',
    destination: 'External Vendor Calibration Lab',
    scheduledDate: '18 Feb 2026, 13:45',
    scheduledWindow: '18 Feb 2026, 13:30 - 15:30',
    carrier: 'FedEx Precision Freight',
    status: 'In Progress',
    documents: [
      { name: 'Transfer_Manifest_GP0412.pdf', type: 'Transfer Manifest', size: '1.1 MB' },
      { name: 'Chain_of_Custody_Form.pdf', type: 'Custody Form', size: '750 KB' },
    ],
    auditTrail: [
      { time: '08:45', event: 'Gate pass requisition approved by QA Director.' },
      { time: '12:00', event: 'Equipment packed in anti-static flight container #12.' },
      { time: '13:40', event: 'Carrier vehicle CA-490 verified at East Checkpoint.' },
    ],
  },
  {
    id: 'GP-2026-0409',
    requesterName: 'Travis Henderson',
    requesterInitials: 'TH',
    requesterBadge: '#ITO-4420',
    requesterRole: 'Datacenter Systems Admin',
    requesterExt: 'x4420',
    requesterEmail: 'travis.h@enterprise.internal',
    department: 'IT Operations',
    assetName: 'Dell PowerEdge R750xs',
    assetTag: 'AST-2024-9014',
    assetSpec: '2U Rackmount Server, Dual Xeon Silver',
    assetCondition: 'Operational',
    serialNumber: 'DPE-R750-9014',
    movementType: 'Outbound Dispatch',
    movementClass: 'Server Cluster Relocation',
    originPoint: 'Primary Datacenter Pod 4',
    destination: 'Disaster Recovery Secondary Site',
    scheduledDate: '18 Feb 2026, 16:00',
    scheduledWindow: '18 Feb 2026, 16:00 - 18:00',
    carrier: 'Secure Transit Logistics',
    status: 'Approved',
    documents: [
      { name: 'Transfer_Manifest_GP0409.pdf', type: 'Manifest', size: '1.3 MB' },
      { name: 'Security_Clearance_Doc.pdf', type: 'Security Clearance', size: '640 KB' },
    ],
    auditTrail: [
      { time: '11:15', event: 'Relocation ticket approved by Infrastructure Admin.' },
      { time: '14:30', event: 'Gate pass clearance generated for Departure Gate 3.' },
    ],
  },
  {
    id: 'GP-2026-0405',
    requesterName: 'Chloe Lin',
    requesterInitials: 'CL',
    requesterBadge: '#ENG-7120',
    requesterRole: 'ML Infrastructure Engineer',
    requesterExt: 'x7120',
    requesterEmail: 'chloe.lin@enterprise.internal',
    department: 'Engineering',
    assetName: 'NVIDIA DGX Station A100',
    assetTag: 'AST-2023-3392',
    assetSpec: 'AI Workstation 4x A100 GPUs 320GB',
    assetCondition: 'Good / Calibrated',
    serialNumber: 'NV-DGX-3392-X',
    movementType: 'Inbound Intake',
    movementClass: 'Research Return Transfer',
    originPoint: 'Offsite Research Partner Lab',
    destination: 'Engineering Research Bay 1',
    scheduledDate: '18 Feb 2026, 11:30',
    scheduledWindow: '18 Feb 2026, 11:00 - 13:00',
    carrier: 'Specialized Transport Unit',
    status: 'Completed',
    documents: [
      { name: 'Return_Manifest_GP0405.pdf', type: 'Return Manifest', size: '1.6 MB' },
      { name: 'Intake_Inspection_Passed.pdf', type: 'Inspection Report', size: '980 KB' },
    ],
    auditTrail: [
      { time: '09:30', event: 'Arrival at Perimeter Gate-04A.' },
      { time: '11:15', event: 'Physical serial matched and intake seal verified.' },
      { time: '11:30', event: 'Delivered to Engineering Bay 1. Gate pass closed.' },
    ],
  },
  {
    id: 'GP-2026-0401',
    requesterName: 'David Vance',
    requesterInitials: 'DV',
    requesterBadge: '#FAC-0941',
    requesterRole: 'Senior Facilities Coordinator',
    requesterExt: 'x0941',
    requesterEmail: 'david.vance@enterprise.internal',
    department: 'Facilities',
    assetName: 'Honeywell HVAC Logic Board',
    assetTag: 'AST-2025-0553',
    assetSpec: 'Building Automation Control Module',
    assetCondition: 'Good / Calibrated',
    serialNumber: 'HW-HVAC-0553',
    movementType: 'Outbound Dispatch',
    movementClass: 'Campus Infrastructure Maintenance',
    originPoint: 'Central Plant Operations',
    destination: 'East Campus Sector 9',
    scheduledDate: '18 Feb 2026, 16:45',
    scheduledWindow: '18 Feb 2026, 16:30 - 18:30',
    carrier: 'Campus Service Van #2',
    status: 'Approved',
    documents: [
      { name: 'Transfer_Manifest_GP0401.pdf', type: 'Work Order Form', size: '540 KB' },
    ],
    auditTrail: [
      { time: '13:00', event: 'Emergency replacement work order authorized.' },
      { time: '15:20', event: 'Board verified by Facilities Lead.' },
    ],
  },
  {
    id: 'GP-2026-0398',
    requesterName: 'Samantha Reed',
    requesterInitials: 'SR',
    requesterBadge: '#ITO-8012',
    requesterRole: 'Storage Systems Lead',
    requesterExt: 'x8012',
    requesterEmail: 'samantha.reed@enterprise.internal',
    department: 'IT Operations',
    assetName: 'SAN Storage Array Shelf (24-Bay)',
    assetTag: 'AST-2022-8902',
    assetSpec: 'Enterprise Fibre Channel Storage Enclosure',
    assetCondition: 'Decommissioned',
    serialNumber: 'SAN-24B-8902-C',
    movementType: 'Outbound Dispatch',
    movementClass: 'Asset Disposal Transfer',
    originPoint: 'Legacy Server Room B02',
    destination: 'Offsite Recycling Center',
    scheduledDate: '18 Feb 2026, 09:30',
    scheduledWindow: '18 Feb 2026, 09:00 - 11:00',
    carrier: 'Electronic Disposal Specialists',
    status: 'Rejected',
    documents: [
      { name: 'Rejection_Notice_GP0398.pdf', type: 'Disposal Rejection Notice', size: '420 KB' },
    ],
    auditTrail: [
      { time: '08:00', event: 'Gate pass requisition submitted for disposal.' },
      { time: '09:15', event: 'Rejected: Mandatory data sanitization certificate missing from manifest.' },
    ],
  },
  // Additional records to support complete 38-pass dataset
  {
    id: 'GP-2026-0394',
    requesterName: 'Dr. Aris Thorne',
    requesterInitials: 'AT',
    requesterBadge: '#RES-1104',
    requesterRole: 'Principal Research Scientist',
    requesterExt: 'x1104',
    requesterEmail: 'aris.thorne@enterprise.internal',
    department: 'Engineering',
    assetName: 'Thermo Scientific Spectrometer',
    assetTag: 'AST-2023-0551',
    assetSpec: 'UV-Vis Dual Beam Precision Spectrophotometer',
    assetCondition: 'Operational',
    serialNumber: 'TMS-SPEC-0551',
    movementType: 'Inbound Intake',
    movementClass: 'Vendor Calibration Return',
    originPoint: 'Vendor Calibration Facility',
    destination: 'Central Analysis Laboratory',
    scheduledDate: '19 Feb 2026, 10:00',
    scheduledWindow: '19 Feb 2026, 09:30 - 11:30',
    carrier: 'Special Courier Express',
    status: 'Pending',
    documents: [
      { name: 'Calibration_Report_Spectro.pdf', type: 'Cert', size: '1.8 MB' },
    ],
    auditTrail: [{ time: '14:00', event: 'Scheduled return flight manifest confirmed.' }],
  },
  {
    id: 'GP-2026-0390',
    requesterName: 'Jonathan Blake',
    requesterInitials: 'JB',
    requesterBadge: '#FAC-0082',
    requesterRole: 'Electrical Systems Lead',
    requesterExt: 'x0082',
    requesterEmail: 'j.blake@enterprise.internal',
    department: 'Facilities',
    assetName: 'Fluke 87V Industrial Multimeter Kit',
    assetTag: 'AST-2024-0319',
    assetSpec: 'True-RMS Digital Multimeter with Temperature',
    assetCondition: 'Calibrated',
    serialNumber: 'FLK-87V-4412',
    movementType: 'Outbound Dispatch',
    movementClass: 'Field Service Allocation',
    originPoint: 'Electrical Workshop Bay 1',
    destination: 'Substation Alpha Site',
    scheduledDate: '19 Feb 2026, 11:30',
    scheduledWindow: '19 Feb 2026, 11:00 - 13:00',
    carrier: 'Field Operations Van #4',
    status: 'Approved',
    documents: [
      { name: 'Field_Service_GP0390.pdf', type: 'Dispatch Form', size: '610 KB' },
    ],
    auditTrail: [{ time: '09:00', event: 'Work order approved by Facilities Manager.' }],
  },
  {
    id: 'GP-2026-0386',
    requesterName: 'Rachel Adams',
    requesterInitials: 'RA',
    requesterBadge: '#QAL-7741',
    requesterRole: 'QA Test Lead',
    requesterExt: 'x7741',
    requesterEmail: 'rachel.adams@enterprise.internal',
    department: 'QA Labs',
    assetName: 'HP Color LaserJet Enterprise M555',
    assetTag: 'AST-2023-8820',
    assetSpec: 'High-Volume Color Laser Printer',
    assetCondition: 'Functional',
    serialNumber: 'HP-ENT-4421',
    movementType: 'Inbound Intake',
    movementClass: 'Maintenance Intake',
    originPoint: 'Workshop Bay 2',
    destination: 'QA Documentation Suite',
    scheduledDate: '19 Feb 2026, 14:15',
    scheduledWindow: '19 Feb 2026, 14:00 - 16:00',
    carrier: 'Internal Logistics Cart',
    status: 'In Progress',
    documents: [
      { name: 'Maintenance_Return_GP0386.pdf', type: 'Return Receipt', size: '720 KB' },
    ],
    auditTrail: [{ time: '10:30', event: 'Toner and roller replacement complete.' }],
  },
  {
    id: 'GP-2026-0382',
    requesterName: 'David Kim',
    requesterInitials: 'DK',
    requesterBadge: '#ITO-9912',
    requesterRole: 'Infrastructure Engineer',
    requesterExt: 'x9912',
    requesterEmail: 'david.kim@enterprise.internal',
    department: 'IT Operations',
    assetName: 'Dell Precision 5820 Workstation',
    assetTag: 'AST-2024-0019',
    assetSpec: 'Intel Xeon W-2245, 64GB ECC, RTX A4000',
    assetCondition: 'Operational',
    serialNumber: 'DWS-8129-K8',
    movementType: 'Inbound Intake',
    movementClass: 'Hardware Depot Return',
    originPoint: 'Infrastructure Lab 2',
    destination: 'Hardware Depot Shelf B2',
    scheduledDate: '20 Feb 2026, 09:00',
    scheduledWindow: '20 Feb 2026, 09:00 - 11:00',
    carrier: 'Internal Courier',
    status: 'Completed',
    documents: [
      { name: 'Intake_Receipt_GP0382.pdf', type: 'Intake Receipt', size: '890 KB' },
    ],
    auditTrail: [{ time: '09:00', event: 'Return check-in logged and inventory updated.' }],
  },
  {
    id: 'GP-2026-0378',
    requesterName: 'Marcus Vance',
    requesterInitials: 'MV',
    requesterBadge: '#DES-4402',
    requesterRole: 'Product Design Lead',
    requesterExt: 'x4402',
    requesterEmail: 'm.vance@enterprise.internal',
    department: 'Engineering',
    assetName: 'Apple Studio Display 27" 5K',
    assetTag: 'AST-NC-2026-0012',
    assetSpec: '27-inch 5K Retina Display, Tilt Stand',
    assetCondition: 'Excellent',
    serialNumber: 'ASD-27-8891-B',
    movementType: 'Outbound Dispatch',
    movementClass: 'Offsite Client Exhibition',
    originPoint: 'Design Studio 4B',
    destination: 'Downtown Convention Center',
    scheduledDate: '20 Feb 2026, 13:30',
    scheduledWindow: '20 Feb 2026, 13:00 - 15:30',
    carrier: 'Corporate Event Courier',
    status: 'Approved',
    documents: [
      { name: 'Event_Dispatch_GP0378.pdf', type: 'Dispatch Permit', size: '1.2 MB' },
    ],
    auditTrail: [{ time: '11:00', event: 'Requisition approved by Creative Director.' }],
  },
];




// =====================================================================
// Host Movement Activity Module Data & Types
// =====================================================================

export interface HostMovementKpis {
  totalMovements: { total: number; badgeText: string; subtext: string };
  inTransit: { total: number; badgeText: string; subtext: string };
  completedToday: { total: number; badgeText: string; subtext: string };
  movementExceptions: { total: number; badgeText: string; subtext: string };
}

export const HOST_MOVEMENT_KPIS_DATA: HostMovementKpis = {
  totalMovements: {
    total: 42,
    badgeText: '+6 today',
    subtext: 'Recorded across perimeter',
  },
  inTransit: {
    total: 8,
    badgeText: 'Active Movement',
    subtext: 'Active between facility zones',
  },
  completedToday: {
    total: 29,
    badgeText: '96.7% Clearance',
    subtext: 'Verified arrival & custody',
  },
  movementExceptions: {
    total: 5,
    badgeText: 'Attention Required',
    subtext: 'Checkpoint delays or seal audit',
  },
};

export type HostMovementStatus =
  | 'Exception'
  | 'Checkpoint Verified'
  | 'In Transit'
  | 'Received'
  | 'Scheduled'
  | 'Dispatched';

export interface HostMovementTimelineEvent {
  title: string;
  time: string;
  desc: string;
  status: 'completed' | 'exception' | 'pending';
  icon: string;
}

export interface HostMovementActivityRecord {
  id: string;
  gatePassId: string;
  assetName: string;
  assetTag: string;
  serialNumber: string;
  classification: string;
  origin: string;
  originZone: string;
  originIcon: string;
  destination: string;
  destinationSegment: string;
  destinationIcon: string;
  corridor: string;
  department: 'Engineering' | 'IT Operations' | 'Facilities' | 'QA Labs';
  initiatedBy: string;
  initiatorInitials: string;
  initiatorBadge: string;
  initiatorEmail: string;
  movementDate: string;
  status: HostMovementStatus;
  carrierName: string;
  carrierPlate: string;
  carrierDriver: string;
  justification: string;
  ttl: string;
  discrepancyAlert?: string;
  manifestFiles: Array<{ name: string; size: string }>;
  timeline: HostMovementTimelineEvent[];
}

export const HOST_DETAILED_MOVEMENT_RECORDS: HostMovementActivityRecord[] = [
  {
    id: 'MOV-2026-0182',
    gatePassId: 'GP-2026-0418',
    assetName: 'Cisco Catalyst 9300 Switch',
    assetTag: 'AST-2024-0042',
    serialNumber: 'CS-9300-8801',
    classification: 'Network Infrastructure (Level 3)',
    origin: 'Main Gate Checkpoint (Gate-04A)',
    originZone: 'Zone 1 Perimeter Hub',
    originIcon: 'meeting_room',
    destination: 'Remote Datacenter Colocation #3',
    destinationSegment: 'Rack Segment Bay 14-C',
    destinationIcon: 'dns',
    corridor: 'Gate-04A Main Corridor',
    department: 'Engineering',
    initiatedBy: 'Elena Rostova',
    initiatorInitials: 'ER',
    initiatorBadge: 'ENG-9042',
    initiatorEmail: 'elena.rostova@enterprise.internal',
    movementDate: '18 Feb 2026, 14:15',
    status: 'Exception',
    carrierName: 'Secure Logistics Van',
    carrierPlate: 'CA-894-MX (GPS Monitored)',
    carrierDriver: 'Marcus Vance (#DRV-202)',
    justification:
      'Urgent hardware maintenance dispatch under gate pass GP-2026-0418 for emergency core switch replacement.',
    ttl: 'Authorization TTL: 4 hrs remaining',
    discrepancyAlert:
      'Missing secondary perimeter seal scan at East Checkpoint Corridor. Physical verification required before final carrier release into public transit corridor.',
    manifestFiles: [
      { name: 'Transfer_Manifest_GP0418.pdf', size: '1.4 MB' },
      { name: 'Checkpoint_Scan_Log_0182.pdf', size: '420 KB' },
    ],
    timeline: [
      {
        title: 'Movement Initiated',
        time: '09:15',
        desc: 'Logged by requester Elena Rostova under Gate Pass GP-2026-0418.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Asset Dispatched',
        time: '13:40',
        desc: 'Released from Tech Hub Bldg B, Server Room 2 by IT Custodian.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Checkpoint Scan Verified',
        time: '14:15',
        desc: 'Verified at Main Gate Checkpoint 04A by Host Security Officer Sarah Jenkins (SJ). Serial CS-9300-8801 matched.',
        status: 'completed',
        icon: 'verified',
      },
      {
        title: 'Corridor Transfer / East Checkpoint',
        time: '14:45 • Not Logged',
        desc: 'Checkpoint barcode scanner pending physical re-inspection. Tamper seal mismatch flag.',
        status: 'exception',
        icon: 'priority_high',
      },
      {
        title: 'Destination Arrival',
        time: 'Expected: 16:30 • Unrecorded',
        desc: 'Pending carrier transit into Remote Datacenter Colocation #3 checkpoint gate.',
        status: 'pending',
        icon: 'schedule',
      },
      {
        title: 'Custody Received',
        time: 'Pending Acknowledgment',
        desc: 'Final transfer acknowledgment awaiting Colocation Site Supervisor inspection.',
        status: 'pending',
        icon: 'radio_button_unchecked',
      },
    ],
  },
  {
    id: 'MOV-2026-0181',
    gatePassId: 'GP-2026-0415',
    assetName: 'Dell UltraSharp 32" 4K Monitor',
    assetTag: 'AST-2024-0118',
    serialNumber: 'DL-3200-9941',
    classification: 'Display & Ergonomic Peripherals',
    origin: 'Server Room 2',
    originZone: 'Zone 2 IT Depot',
    originIcon: 'warehouse',
    destination: 'Lab 4 Corridor',
    destinationSegment: 'QA Engineering Bench 08',
    destinationIcon: 'lan',
    corridor: 'Server Room 2 Express',
    department: 'IT Operations',
    initiatedBy: 'Travis Henderson',
    initiatorInitials: 'TH',
    initiatorBadge: 'ITO-4420',
    initiatorEmail: 'travis.henderson@enterprise.internal',
    movementDate: '18 Feb 2026, 15:30',
    status: 'Checkpoint Verified',
    carrierName: 'Internal Facility Cart',
    carrierPlate: 'INT-CART-04',
    carrierDriver: 'David Kim (Infrastructure)',
    justification: 'Relocation to QA Lab for high-resolution graphics compliance testing.',
    ttl: 'Authorization TTL: 6 hrs remaining',
    manifestFiles: [
      { name: 'Internal_Transfer_GP0415.pdf', size: '820 KB' },
    ],
    timeline: [
      {
        title: 'Movement Initiated',
        time: '14:00',
        desc: 'Internal transfer request submitted by Travis Henderson.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Custody Handover',
        time: '15:10',
        desc: 'Released to Internal Facility Cart handler.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Checkpoint Scan Verified',
        time: '15:30',
        desc: 'Verified by Host Officer at Internal Station 03.',
        status: 'completed',
        icon: 'verified',
      },
      {
        title: 'Destination Arrival',
        time: 'Expected: 16:15 • Unrecorded',
        desc: 'Pending arrival at Lab 4 Corridor entry.',
        status: 'pending',
        icon: 'schedule',
      },
    ],
  },
  {
    id: 'MOV-2026-0179',
    gatePassId: 'GP-2026-0412',
    assetName: 'Fluke Networks Versiv DSX',
    assetTag: 'AST-2025-1108',
    serialNumber: 'FLK-789-PRO',
    classification: 'Field Testing & Telemetry Equipment',
    origin: 'Tech Hub Bldg B',
    originZone: 'Facilities Maintenance Locker',
    originIcon: 'domain',
    destination: 'Loading Bay East',
    destinationSegment: 'Logistics Dock Bay 2',
    destinationIcon: 'forklift',
    corridor: 'Tech Hub Building B Bay',
    department: 'Facilities',
    initiatedBy: 'Marcus Kane',
    initiatorInitials: 'MK',
    initiatorBadge: 'FAC-3109',
    initiatorEmail: 'marcus.kane@enterprise.internal',
    movementDate: '18 Feb 2026, 13:45',
    status: 'In Transit',
    carrierName: 'Facilities Maintenance Rover',
    carrierPlate: 'FAC-ROV-02',
    carrierDriver: 'Marcus Kane (#FAC-3109)',
    justification: 'Scheduled fiber optic testing at Loading Bay East communications nexus.',
    ttl: 'Authorization TTL: 3 hrs remaining',
    manifestFiles: [
      { name: 'Equipment_Movement_GP0412.pdf', size: '940 KB' },
    ],
    timeline: [
      {
        title: 'Movement Initiated',
        time: '12:30',
        desc: 'Check-out requisition logged by Marcus Kane.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Dispatched from Locker',
        time: '13:15',
        desc: 'Tools custody checked out with electronic signature.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'In Transit',
        time: '13:45',
        desc: 'En route via Tech Hub Corridor to East Logistics Dock.',
        status: 'completed',
        icon: 'near_me',
      },
      {
        title: 'Arrival & Inspection',
        time: 'Expected: 14:30 • Unrecorded',
        desc: 'Awaiting checkpoint scanner log at Loading Bay East.',
        status: 'pending',
        icon: 'schedule',
      },
    ],
  },
  {
    id: 'MOV-2026-0176',
    gatePassId: 'GP-2026-0405',
    assetName: 'NVIDIA DGX Station A100',
    assetTag: 'AST-2023-3392',
    serialNumber: 'NV-DGX-1024',
    classification: 'High-Performance AI Compute Workstation',
    origin: 'AI Research Lab',
    originZone: 'Zone 4 Deep Learning Pod',
    originIcon: 'biotech',
    destination: 'Main Checkpoint Gate',
    destinationSegment: 'Gate-04A Physical Inspection Bay',
    destinationIcon: 'security',
    corridor: 'Gate-04A Main Corridor',
    department: 'Engineering',
    initiatedBy: 'Chloe Lin',
    initiatorInitials: 'CL',
    initiatorBadge: 'ENG-7120',
    initiatorEmail: 'chloe.lin@enterprise.internal',
    movementDate: '18 Feb 2026, 11:20',
    status: 'Received',
    carrierName: 'Heavy Equipment Pallet Hauler',
    carrierPlate: 'PLT-8820',
    carrierDriver: 'Chloe Lin & Rigging Crew',
    justification: 'Inbound intake return from university collaborative AI research pod.',
    ttl: 'Completed and archived',
    manifestFiles: [
      { name: 'Inbound_Intake_Manifest_GP0405.pdf', size: '1.8 MB' },
    ],
    timeline: [
      {
        title: 'Movement Initiated',
        time: '09:00',
        desc: 'Inbound intake manifest created.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Loaded for Transit',
        time: '10:15',
        desc: 'Secure packing and vibration monitoring verified.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Received & Logged',
        time: '11:20',
        desc: 'Arrived at Main Checkpoint Gate. Physical seal verified and receipt logged by Host.',
        status: 'completed',
        icon: 'check_circle',
      },
    ],
  },
  {
    id: 'MOV-2026-0174',
    gatePassId: 'GP-2026-0401',
    assetName: 'Keysight Infiniium Scope',
    assetTag: 'AST-2023-7729',
    serialNumber: 'KY-INF-4402',
    classification: 'Precision Oscilloscope & Signal Analyzer',
    origin: 'QA Calibration Bay',
    originZone: 'Lab 2 Cleanroom',
    originIcon: 'tune',
    destination: 'Main Gate Checkpoint',
    destinationSegment: 'Dispatch Vehicle Loading Zone',
    destinationIcon: 'meeting_room',
    corridor: 'East Checkpoint Transit',
    department: 'QA Labs',
    initiatedBy: 'Amina Latif',
    initiatorInitials: 'AL',
    initiatorBadge: 'QAL-8821',
    initiatorEmail: 'amina.latif@enterprise.internal',
    movementDate: '18 Feb 2026, 16:00',
    status: 'Scheduled',
    carrierName: 'Precision Instrument Courier',
    carrierPlate: 'PIC-551-EX',
    carrierDriver: 'Courier Agent #901',
    justification: 'Annual ISO calibration dispatch to certified manufacturer facility.',
    ttl: 'Authorization TTL: 5 hrs remaining',
    manifestFiles: [
      { name: 'Calibration_Dispatch_GP0401.pdf', size: '1.1 MB' },
    ],
    timeline: [
      {
        title: 'Calibration Requisition',
        time: '10:00',
        desc: 'Maintenance schedule approved by QA Director.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Pre-dispatch Packing',
        time: '14:30',
        desc: 'Placed in climate-controlled flight case with tamper-evident seal.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Scheduled Pickup Window',
        time: '16:00 • Scheduled',
        desc: 'Courier vehicle scheduled for arrival at Main Gate Checkpoint.',
        status: 'pending',
        icon: 'schedule',
      },
    ],
  },
  {
    id: 'MOV-2026-0170',
    gatePassId: 'GP-2026-0398',
    assetName: 'HP LaserJet Enterprise',
    assetTag: 'AST-2024-4421',
    serialNumber: 'HP-ENT-4421',
    classification: 'Departmental Printing System',
    origin: 'Facilities Depot',
    originZone: 'Storage Room B1',
    originIcon: 'warehouse',
    destination: 'Floor 3 Admin Hub',
    destinationSegment: 'Executive Office Printing Bay',
    destinationIcon: 'apartment',
    corridor: 'Gate-04A Main Corridor',
    department: 'Facilities',
    initiatedBy: 'David Vance',
    initiatorInitials: 'DV',
    initiatorBadge: 'FAC-0941',
    initiatorEmail: 'david.vance@enterprise.internal',
    movementDate: '18 Feb 2026, 10:15',
    status: 'Dispatched',
    carrierName: 'Facilities Rolling Cart',
    carrierPlate: 'CART-11',
    carrierDriver: 'David Vance (#FAC-0941)',
    justification: 'Replacement for decommissioned legacy multifunction unit.',
    ttl: 'Authorization TTL: 2 hrs remaining',
    manifestFiles: [
      { name: 'Internal_Deployment_GP0398.pdf', size: '610 KB' },
    ],
    timeline: [
      {
        title: 'Requisition Filed',
        time: '08:45',
        desc: 'Facilities replacement request approved.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Dispatched',
        time: '10:15',
        desc: 'Loaded onto rolling cart and dispatched from Facilities Depot.',
        status: 'completed',
        icon: 'outbox',
      },
      {
        title: 'Destination Delivery',
        time: 'Pending • Unrecorded',
        desc: 'Awaiting delivery receipt scan on Floor 3.',
        status: 'pending',
        icon: 'schedule',
      },
    ],
  },
  {
    id: 'MOV-2026-0168',
    gatePassId: 'GP-2026-0392',
    assetName: 'SAN Storage Array Shelf 24-Bay',
    assetTag: 'AST-2022-8902',
    serialNumber: 'SN-ARR-9910',
    classification: 'Datacenter Storage Enclosure',
    origin: 'Datacenter Hall A',
    originZone: 'Row 08 Storage Cage',
    originIcon: 'dns',
    destination: 'Main Gate Checkpoint',
    destinationSegment: 'Decommissioning Staging Dock',
    destinationIcon: 'meeting_room',
    corridor: 'Server Room 2 Express',
    department: 'IT Operations',
    initiatedBy: 'Samantha Reed',
    initiatorInitials: 'SR',
    initiatorBadge: 'ITO-8012',
    initiatorEmail: 'samantha.reed@enterprise.internal',
    movementDate: '18 Feb 2026, 09:30',
    status: 'Received',
    carrierName: 'Secure Logistics Transport',
    carrierPlate: 'SLT-4912',
    carrierDriver: 'Transport Team Alpha',
    justification: 'End-of-life hardware staging for certified cryptographic erasure.',
    ttl: 'Completed and archived',
    manifestFiles: [
      { name: 'Decommission_Manifest_GP0392.pdf', size: '1.5 MB' },
    ],
    timeline: [
      {
        title: 'Decommission Authorized',
        time: '07:30',
        desc: 'Storage retirement signed off by IT Director.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Enclosure Unracked',
        time: '08:45',
        desc: 'Chassis unmounted from Datacenter Hall A Row 08.',
        status: 'completed',
        icon: 'check',
      },
      {
        title: 'Received at Checkpoint',
        time: '09:30',
        desc: 'Delivered to Main Gate Checkpoint staging dock and scanned by Host.',
        status: 'completed',
        icon: 'check_circle',
      },
    ],
  },
];
