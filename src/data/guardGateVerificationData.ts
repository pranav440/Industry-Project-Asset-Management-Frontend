// =====================================================================
// AssetMX Guard Gate Verification Data Store & Types
// Operational data for physical checkpoint inspection and barrier release
// =====================================================================

export interface ManifestAssetItem {
  tag: string;
  name: string;
  spec: string;
  classification: string;
  physicalSerial: string;
  expectedQty: number;
  inspectedQty: number;
  status: 'Verified' | 'Pending Check' | 'Flagged';
  icon: string;
}

export interface ChecklistItem {
  id: number;
  title: string;
  description: string;
  checked: boolean;
  locked: boolean;
}

export interface GuardGatePassManifest {
  passId: string;
  direction: 'Outward' | 'Inward';
  directionLabel: string;
  status: string;
  approver: string;
  requester: {
    name: string;
    badge: string;
    dept: string;
    initials: string;
  };
  authorizer: {
    name: string;
    code: string;
    window: string;
  };
  routing: {
    origin: string;
    destination: string;
  };
  carrier: {
    type: string;
    plate: string;
    driver: string;
  };
  hash: string;
  terminalId: string;
  defaultRemarks: string;
  assets: ManifestAssetItem[];
  checklist: ChecklistItem[];
}

export interface RecentVerificationLogItem {
  id: string;
  passId: string;
  description: string;
  direction: 'Outward' | 'Inward';
  time: string;
  status: 'Cleared' | 'Flagged Discrepancy';
  guard: string;
}

export const GUARD_GATE_PASS_MANIFESTS: Record<string, GuardGatePassManifest> = {
  'GP-2026-0422': {
    passId: 'GP-2026-0422',
    direction: 'Outward',
    directionLabel: 'Outward / Dispatch',
    status: 'Awaiting Physical Exit Clearance',
    approver: 'Approved by Tech Ops Admin',
    requester: {
      name: 'Elena Rostova',
      badge: 'ENG-9042',
      dept: 'Hardware Engineering',
      initials: 'ER',
    },
    authorizer: {
      name: 'Marcus Kane',
      code: 'FAC-3109',
      window: '16:30 – 17:30 (Today)',
    },
    routing: {
      origin: 'Tech Hub B (Lab 4)',
      destination: 'Offsite Colocation #3',
    },
    carrier: {
      type: 'Secure Logistics Van',
      plate: 'CA-894-MX',
      driver: 'Viktor Chen (DL-6612)',
    },
    hash: 'HASH: 8f9b...e21a (Validated by Identity Gateway)',
    terminalId: 'CP-TER-01A',
    defaultRemarks:
      'Serial numbers matched at barrier bay. Physical transit seal SL-8841-A intact on equipment lockbox. Driver Viktor Chen present with logistics manifest.',
    assets: [
      {
        tag: 'AST-2024-0042',
        name: 'Cisco Catalyst 9300 Switch 48-Port',
        spec: 'PoE+, Network Core Switch Unit',
        classification: 'Network Infra',
        physicalSerial: 'CS-9300-8801',
        expectedQty: 1,
        inspectedQty: 1,
        status: 'Verified',
        icon: 'lan',
      },
      {
        tag: 'AST-2024-0118',
        name: 'Dell UltraSharp 32" 4K USB-C Monitor',
        spec: 'U3223QE IPS Black Color Calibrated (Pair)',
        classification: 'Display Hardware',
        physicalSerial: 'DL-9014-U32-A/B',
        expectedQty: 2,
        inspectedQty: 2,
        status: 'Verified',
        icon: 'desktop_windows',
      },
      {
        tag: 'AST-2025-1108',
        name: 'Fluke Networks Versiv DSX CableAnalyzer',
        spec: 'Mainframe & Remote Optical Time Domain Unit',
        classification: 'Testing Equipment',
        physicalSerial: 'FLK-789-PRO',
        expectedQty: 1,
        inspectedQty: 1,
        status: 'Pending Check',
        icon: 'home_repair_service',
      },
    ],
    checklist: [
      {
        id: 1,
        title: '1. Digital Registry Clearance',
        description: 'Gate pass status verified active, non-expired, and cryptographically valid.',
        checked: true,
        locked: true,
      },
      {
        id: 2,
        title: '2. Transporter Identity Authentication',
        description: 'Physical employee badge ENG-9042 and driver DL-6612 matched photo ID.',
        checked: true,
        locked: true,
      },
      {
        id: 3,
        title: '3. Physical Serial Numbers Matched',
        description: 'Verify barcode stamps on testing instruments (AST-2025-1108 pending).',
        checked: false,
        locked: false,
      },
      {
        id: 4,
        title: '4. Tamper-Evident Packaging & Condition',
        description: 'Casing inspected for hardware anomalies; anti-static wrap undamaged.',
        checked: true,
        locked: true,
      },
      {
        id: 5,
        title: '5. Security Transit Seal Verification',
        description: 'High-security container seal #SL-8841-A verified against outward dispatch record.',
        checked: true,
        locked: true,
      },
      {
        id: 6,
        title: '6. Movement Direction & Vehicle Lane Exit',
        description: 'Confirm lane clear, vehicle CA-894-MX lined up at outbound boom barrier.',
        checked: false,
        locked: false,
      },
    ],
  },
  'GP-2026-0420': {
    passId: 'GP-2026-0420',
    direction: 'Inward',
    directionLabel: 'Inward / Return',
    status: 'Awaiting Physical Entry Clearance',
    approver: 'Approved by Sarah Jenkins (Host)',
    requester: {
      name: 'Marcus Kane',
      badge: 'FAC-3109',
      dept: 'Facilities Operations',
      initials: 'MK',
    },
    authorizer: {
      name: 'Sarah Jenkins',
      code: 'SEC-8802',
      window: '14:00 – 16:00 (Today)',
    },
    routing: {
      origin: 'External Calibration Lab #2',
      destination: 'Central Facilities Depot',
    },
    carrier: {
      type: 'Vendor Courier Express',
      plate: 'NY-512-AB',
      driver: 'Samuel Green (DL-4102)',
    },
    hash: 'HASH: 4e2a...910c (Validated by Identity Gateway)',
    terminalId: 'CP-TER-01A',
    defaultRemarks:
      'Calibration return manifest inspected. Barcode seal SL-9901 confirmed intact. Driver Samuel Green verified.',
    assets: [
      {
        tag: 'AST-2025-1108',
        name: 'Fluke Networks Versiv DSX CableAnalyzer',
        spec: 'Mainframe & Remote Optical Time Domain Unit',
        classification: 'Testing Equipment',
        physicalSerial: 'FLK-789-PRO',
        expectedQty: 1,
        inspectedQty: 1,
        status: 'Verified',
        icon: 'home_repair_service',
      },
    ],
    checklist: [
      {
        id: 1,
        title: '1. Digital Registry Clearance',
        description: 'Inward return pass validated against original outbound authorization.',
        checked: true,
        locked: true,
      },
      {
        id: 2,
        title: '2. Transporter Identity Authentication',
        description: 'Vendor courier badge and vehicle plate NY-512-AB matched manifest.',
        checked: true,
        locked: true,
      },
      {
        id: 3,
        title: '3. Physical Serial Numbers Matched',
        description: 'Calibrated optical unit serial FLK-789-PRO matched returning tag.',
        checked: true,
        locked: false,
      },
      {
        id: 4,
        title: '4. Tamper-Evident Packaging & Condition',
        description: 'Return seal unbroken and calibration test sticker verified.',
        checked: true,
        locked: true,
      },
      {
        id: 5,
        title: '5. Security Transit Seal Verification',
        description: 'Calibration transit seal #SL-9901 verified by gate security.',
        checked: true,
        locked: true,
      },
      {
        id: 6,
        title: '6. Movement Direction & Vehicle Lane Entry',
        description: 'Confirm inbound bay clear, vehicle positioned at inbound boom barrier.',
        checked: false,
        locked: false,
      },
    ],
  },
  'GP-2026-0418': {
    passId: 'GP-2026-0418',
    direction: 'Outward',
    directionLabel: 'Outward / Dispatch',
    status: 'Flagged - Serial Discrepancy',
    approver: 'Under Security Review',
    requester: {
      name: 'Travis Henderson',
      badge: 'IT-4420',
      dept: 'IT Infrastructure',
      initials: 'TH',
    },
    authorizer: {
      name: 'Sarah Jenkins',
      code: 'SEC-8802',
      window: '12:00 – 14:00 (Today)',
    },
    routing: {
      origin: 'Server Room 2',
      destination: 'Disposal & Recycling Facility',
    },
    carrier: {
      type: 'Internal Transit Cart',
      plate: 'TX-440-KM',
      driver: 'Travis Henderson (IT-4420)',
    },
    hash: 'HASH: 7c1f...109b (Tag Flagged - Cryptographic Discrepancy)',
    terminalId: 'CP-TER-01A',
    defaultRemarks:
      'Serial mismatch flagged at barrier: physical chassis stamped CS-9300-8801 but manifest indicated PowerEdge R750xs unit.',
    assets: [
      {
        tag: 'AST-2023-0892',
        name: 'Dell PowerEdge R750xs Server',
        spec: '2U Rackmount Xeon Silver Dual-Socket Unit',
        classification: 'Compute Server',
        physicalSerial: 'DL-R750-9921',
        expectedQty: 1,
        inspectedQty: 1,
        status: 'Flagged',
        icon: 'dns',
      },
    ],
    checklist: [
      {
        id: 1,
        title: '1. Digital Registry Clearance',
        description: 'Digital pass flagged for discrepancy review; barrier hold enforced.',
        checked: true,
        locked: true,
      },
      {
        id: 2,
        title: '2. Transporter Identity Authentication',
        description: 'Employee badge IT-4420 verified.',
        checked: true,
        locked: true,
      },
      {
        id: 3,
        title: '3. Physical Serial Numbers Matched',
        description: 'Physical chassis tag does not match registered manifest tag.',
        checked: false,
        locked: false,
      },
      {
        id: 4,
        title: '4. Tamper-Evident Packaging & Condition',
        description: 'Open rack chassis inspected.',
        checked: true,
        locked: true,
      },
      {
        id: 5,
        title: '5. Security Transit Seal Verification',
        description: 'Discrepancy quarantine tag #QUAR-0418 applied.',
        checked: true,
        locked: true,
      },
      {
        id: 6,
        title: '6. Movement Direction & Vehicle Lane Exit',
        description: 'Exit held. Vehicle directed to secondary inspection bay.',
        checked: false,
        locked: false,
      },
    ],
  },
  'GP-2026-0414': {
    passId: 'GP-2026-0414',
    direction: 'Inward',
    directionLabel: 'Inward / Return',
    status: 'Approved - Awaiting Entry',
    approver: 'Approved by Marcus Kane',
    requester: {
      name: 'Chloe Lin',
      badge: 'ENG-7128',
      dept: 'AI Research Division',
      initials: 'CL',
    },
    authorizer: {
      name: 'Marcus Kane',
      code: 'FAC-3109',
      window: '10:00 – 12:00 (Today)',
    },
    routing: {
      origin: 'Offsite GPU Cluster B',
      destination: 'AI Cluster Bay 2',
    },
    carrier: {
      type: 'Specialized Tech Transport',
      plate: 'WA-409-TR',
      driver: 'Dave Miller (DL-3319)',
    },
    hash: 'HASH: 2b8a...33df (Validated by Identity Gateway)',
    terminalId: 'CP-TER-01A',
    defaultRemarks:
      'NVIDIA Workstation return intact. High-value asset seal #NV-0982 verified by lead security guard.',
    assets: [
      {
        tag: 'AST-2024-0012',
        name: 'NVIDIA DGX A100 Workstation',
        spec: '4x A100 Tensor Core GPU Enterprise Station',
        classification: 'Compute Server',
        physicalSerial: 'NV-DGX-1024',
        expectedQty: 1,
        inspectedQty: 1,
        status: 'Verified',
        icon: 'memory',
      },
    ],
    checklist: [
      {
        id: 1,
        title: '1. Digital Registry Clearance',
        description: 'Gate pass status verified active and cryptographic signature valid.',
        checked: true,
        locked: true,
      },
      {
        id: 2,
        title: '2. Transporter Identity Authentication',
        description: 'Specialized carrier driver DL-3319 and vehicle plate WA-409-TR verified.',
        checked: true,
        locked: true,
      },
      {
        id: 3,
        title: '3. Physical Serial Numbers Matched',
        description: 'DGX Workstation serial NV-DGX-1024 matched chassis laser mark.',
        checked: true,
        locked: false,
      },
      {
        id: 4,
        title: '4. Tamper-Evident Packaging & Condition',
        description: 'Shockwatch sensor on flight case shows 0G impacts.',
        checked: true,
        locked: true,
      },
      {
        id: 5,
        title: '5. Security Transit Seal Verification',
        description: 'Custom tamper seal NV-0982 matched return manifest.',
        checked: true,
        locked: true,
      },
      {
        id: 6,
        title: '6. Movement Direction & Vehicle Lane Entry',
        description: 'Inbound lane clear; driver waiting at Inbound Gate 01.',
        checked: true,
        locked: false,
      },
    ],
  },
};

export const RECENT_CHECKPOINT_VERIFICATIONS_INITIAL: RecentVerificationLogItem[] = [
  {
    id: 'LOG-01',
    passId: 'GP-2026-0409',
    description: 'Fluke Calibrator & Field Test Units (3 items)',
    direction: 'Outward',
    time: '14:12',
    status: 'Cleared',
    guard: 'M. Vance (Gate-01A)',
  },
  {
    id: 'LOG-02',
    passId: 'GP-2026-0405',
    description: 'Dell UltraSharp 32" Monitors (2 units)',
    direction: 'Inward',
    time: '13:50',
    status: 'Cleared',
    guard: 'M. Vance (Gate-01A)',
  },
  {
    id: 'LOG-03',
    passId: 'GP-2026-0399',
    description: 'SAN Storage Array Shelf (Unsealed crate)',
    direction: 'Outward',
    time: '12:40',
    status: 'Flagged Discrepancy',
    guard: 'M. Vance (Gate-01A)',
  },
  {
    id: 'LOG-04',
    passId: 'GP-2026-0392',
    description: 'Keysight N9020B Spectrum Analyzer',
    direction: 'Inward',
    time: '11:15',
    status: 'Cleared',
    guard: 'M. Vance (Gate-01A)',
  },
];

