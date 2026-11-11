// =====================================================================
// AssetMX Guard Entry / Exit Logs Data Store & Types
// Scoped to immutable physical checkpoint logs and real-time ledger audits
// =====================================================================

export interface GuardLogChecklistItem {
  title: string;
  status: string;
  verified: boolean;
}

export interface GuardLogTimelineEvent {
  time: string;
  title: string;
  desc: string;
  completed: boolean;
}

export interface GuardMovementLogRecord {
  id: string; // e.g. LOG-2026-0048
  passId: string; // e.g. GP-2026-0422
  assetId: string; // e.g. AST-2024-0042
  assetName: string; // e.g. Cisco Catalyst 9300 Switch
  serialNumber: string; // e.g. CS-9300-8801
  category?: 'Physical Movement' | 'Administrative' | 'Security Escalation';
  direction: 'Outward' | 'Inward' | 'N/A';
  directionLabel: string; // 'Outward / Exit' | 'Inward / Entry' | 'Escalation Hold' | 'Administrative'
  requesterName: string; // e.g. Elena Rostova
  requesterBadge: string; // e.g. ENG-9042
  department: string; // e.g. Hardware Engineering
  date: string; // e.g. 2026-05-24
  dateDisplay: string; // e.g. May 24, 2026
  timeDisplay: string; // e.g. 13:42:15 UTC
  status: 'Cleared' | 'Pending' | 'Flagged';
  guardName: string; // e.g. M. Vance
  guardBadge: string; // e.g. SEC-8812
  checkpoint: string; // e.g. Gate-01A (North)
  checkpointFull: string; // e.g. Gate-01A (North Barrier Lane)
  approvingAdmin: string; // e.g. Marcus Kane (Tech Ops Principal)
  custodian: string; // e.g. Elena Rostova (Hardware Eng #9042)
  carrierVehicle: string; // e.g. Viktor Chen (DL-6612) • Van #04 (CA-894-MX)
  manifestHash: string; // e.g. SHA-256: 8f9b...e21a
  tamperSealId: string; // e.g. SL-8841-A (Intact)
  inspectedQty: number;
  expectedQty: number;
  hasDiscrepancy: boolean;
  discrepancyStatusTitle: string;
  discrepancyDetails: string;
  guardRemarks: string;
  checklist: GuardLogChecklistItem[];
  timeline: GuardLogTimelineEvent[];
}

export interface GuardLogsKpis {
  totalMovements: {
    total: number;
    badgeText: string;
    subtext: string;
  };
  inboundEntries: {
    total: number;
    subtext: string;
  };
  outboundExits: {
    total: number;
    subtext: string;
  };
  flaggedMovements: {
    total: number;
    badgeText: string;
    subtext: string;
  };
  totalRecords?: {
    total: number;
    subtext: string;
  };
}

export const INITIAL_GUARD_LOGS_DATA: GuardMovementLogRecord[] = [
  {
    "id": "LOG-2026-0048",
    "passId": "GP-2026-0422",
    "assetId": "AST-2024-0042",
    "assetName": "Cisco Catalyst 9300 Switch",
    "serialNumber": "CS-9300-8801",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Elena Rostova",
    "requesterBadge": "ENG-9042",
    "department": "Hardware Engineering",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "13:42:15 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Marcus Kane (Tech Ops Principal)",
    "custodian": "Elena Rostova (Hardware Eng #9042)",
    "carrierVehicle": "Viktor Chen (DL-6612) • Van #04 (CA-894-MX)",
    "manifestHash": "SHA-256: 8f9b...e21a",
    "tamperSealId": "SL-8841-A (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All hardware serial numbers and custody manifest credentials match physical items. No audit holds or security flags logged for this movement pass.",
    "guardRemarks": "Physical hardware tags verified against outward manifest. Security seal SL-8841-A intact. Driver credentials confirmed. Cleared for outbound dispatch.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Driver Government Photo ID (DL-6612) Matched",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Optical Barcode Scan (CS-9300-8801)",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Physical Pelican Transit Box Security Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Outward Hydraulic Barrier #01 Released",
        "status": "13:42:15",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "13:42:15 UTC",
        "title": "Barrier Release",
        "desc": "Outbound barrier released by Guard M. Vance (Gate-01A)",
        "completed": true
      },
      {
        "time": "13:40:40 UTC",
        "title": "Serial Verified",
        "desc": "Physical Serial CS-9300-8801 scanned & matched",
        "completed": true
      },
      {
        "time": "13:38:15 UTC",
        "title": "Identity Verified",
        "desc": "Transporter Viktor Chen verified at lane intake",
        "completed": true
      },
      {
        "time": "13:25:00 UTC",
        "title": "Manifest Ingested",
        "desc": "Gate Pass ingested to Gate-01A verification bay",
        "completed": true
      },
      {
        "time": "11:30:00 UTC",
        "title": "Admin Approved",
        "desc": "Approved by Tech Ops Admin Marcus Kane",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0047",
    "passId": "GP-2026-0420",
    "assetId": "AST-2023-1189",
    "assetName": "Fluke Networks Versiv DSX",
    "serialNumber": "FLK-789-PRO",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Marcus Kane",
    "requesterBadge": "FAC-3109",
    "department": "Facilities",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "13:50:22 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Marcus Kane (Facilities)",
    "carrierVehicle": "Samuel Green (DL-4102) • Vendor Van (NY-512-AB)",
    "manifestHash": "SHA-256: 4e2a...910c",
    "tamperSealId": "SL-9901 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All optical serial matches and calibration paperwork confirmed. Cleared for entry.",
    "guardRemarks": "Inbound equipment return from calibration lab. Physical unit verified against manifest.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Calibration Cert Attached",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Inward Barrier Released",
        "status": "13:50:22",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "13:50:22 UTC",
        "title": "Barrier Release",
        "desc": "Inbound barrier released",
        "completed": true
      },
      {
        "time": "13:48:10 UTC",
        "title": "Serial Verified",
        "desc": "Serial FLK-789-PRO matched",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0046",
    "passId": "GP-2026-0418",
    "assetId": "AST-2024-9914",
    "assetName": "Dell PowerEdge R750xs Server",
    "serialNumber": "DL-9014-MISMATCH",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Travis Henderson",
    "requesterBadge": "IT-4420",
    "department": "IT Infrastructure",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "12:48:33 UTC",
    "status": "Flagged",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins",
    "custodian": "Travis Henderson",
    "carrierVehicle": "Dedicated Freight (TX-440-KM)",
    "manifestHash": "SHA-256: 7b31...c490",
    "tamperSealId": "SL-8800 (MISMATCH)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": true,
    "discrepancyStatusTitle": "Physical Serial & Seal Mismatch",
    "discrepancyDetails": "Chassis serial on server DL-9014-B does not match digital manifest DL-9014-A. Transit seal SL-8800 shows sign of prior cut. Outbound transit hold engaged.",
    "guardRemarks": "Secondary inspection triggered at barrier lane. Barrier locked in down position. Vehicle directed to inspection bay pending supervisor sign-off.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Driver Identity Verified",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Scan",
        "status": "MISMATCH",
        "verified": false
      },
      {
        "title": "Transit Seal Integrity",
        "status": "DAMAGED",
        "verified": false
      },
      {
        "title": "Barrier Release",
        "status": "HOLD",
        "verified": false
      }
    ],
    "timeline": [
      {
        "time": "12:48:33 UTC",
        "title": "Barrier Hold Engaged",
        "desc": "Barrier locked due to tag mismatch",
        "completed": false
      },
      {
        "time": "12:45:10 UTC",
        "title": "Inspection Scan",
        "desc": "Discrepancy reported during optical scan",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0045",
    "passId": "GP-2026-0417",
    "assetId": "AST-2023-4011",
    "assetName": "Tektronix Mixed Domain Scope",
    "serialNumber": "TK-MDO-BROKEN",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Amina Latif",
    "requesterBadge": "QA-8812",
    "department": "Quality Assurance",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "16:15:10 UTC",
    "status": "Flagged",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins",
    "custodian": "Amina Latif",
    "carrierVehicle": "Expedited Courier (DL-9081)",
    "manifestHash": "SHA-256: 310a...998b",
    "tamperSealId": "SL-7721 (DAMAGED)",
    "inspectedQty": 1,
    "expectedQty": 2,
    "hasDiscrepancy": true,
    "discrepancyStatusTitle": "Missing Item / Quantity Discrepancy",
    "discrepancyDetails": "Manifest specifies 2 items, only 1 physical scope received at checkpoint intake. Seal damaged in transit.",
    "guardRemarks": "Quantity mismatch noted on arrival. Courier acknowledged missing second pelican case. Incident filed.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Package Count",
        "status": "SHORT 1",
        "verified": false
      },
      {
        "title": "Transit Seal",
        "status": "DAMAGED",
        "verified": false
      }
    ],
    "timeline": [
      {
        "time": "16:15:10 UTC",
        "title": "Transit Hold",
        "desc": "Hold placed due to missing unit",
        "completed": false
      }
    ]
  },
  {
    "id": "LOG-2026-0044",
    "passId": "GP-2026-0416",
    "assetId": "AST-2024-5512",
    "assetName": "Rohde & Schwarz Spectrum Analyzer",
    "serialNumber": "RS-FPL-SEAL-ERR",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Sanjay Patel",
    "requesterBadge": "SYS-6640",
    "department": "Compute Architecture",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "11:05:00 UTC",
    "status": "Flagged",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Marcus Kane",
    "custodian": "Sanjay Patel",
    "carrierVehicle": "Sanjay Patel (DL-1102) • Personal Vehicle",
    "manifestHash": "SHA-256: 881a...3319",
    "tamperSealId": "SEAL-BROKEN",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": true,
    "discrepancyStatusTitle": "Transit Seal Damaged at Departure",
    "discrepancyDetails": "Security seal tape on pelican case torn during loading. Held for inspection.",
    "guardRemarks": "Seal breach reported before gate clearance. Incident logged.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Transit Seal Verified",
        "status": "Failed",
        "verified": false
      },
      {
        "title": "Barrier Release",
        "status": "HOLD",
        "verified": false
      }
    ],
    "timeline": [
      {
        "time": "11:05:00 UTC",
        "title": "Departure Hold",
        "desc": "Seal breach recorded",
        "completed": false
      }
    ]
  },
  {
    "id": "LOG-2026-0043",
    "passId": "GP-2026-0443",
    "assetId": "AST-2024-1043",
    "assetName": "Fluke Networks Versiv DSX",
    "serialNumber": "FLK-789-8817",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Karen Wright",
    "requesterBadge": "LOG-1190",
    "department": "Supply Chain & Logistics",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "17:01:19 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Karen Wright (Supply Chain & Logistics)",
    "carrierVehicle": "Karen Wright • Internal Logistics Van",
    "manifestHash": "SHA-256: 08a2...aa36",
    "tamperSealId": "SL-9043 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "17:01:19 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0042",
    "passId": "GP-2026-0442",
    "assetId": "AST-2024-1042",
    "assetName": "Supermicro 4U Storage SuperServer",
    "serialNumber": "SM-4U-8798",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Viktor Chen",
    "requesterBadge": "NET-5510",
    "department": "Network Operations",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "14:54:06 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Viktor Chen (Network Operations)",
    "carrierVehicle": "Viktor Chen • Internal Logistics Van",
    "manifestHash": "SHA-256: 5030...4da5",
    "tamperSealId": "SL-9042 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "14:54:06 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0041",
    "passId": "GP-2026-0441",
    "assetId": "AST-2024-1041",
    "assetName": "Cisco Nexus 9336C Spine Switch",
    "serialNumber": "NX-9336-8779",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Marcus Kane",
    "requesterBadge": "FAC-3109",
    "department": "Facilities Ops",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "11:47:53 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Marcus Kane (Facilities Ops)",
    "carrierVehicle": "Marcus Kane • Internal Logistics Van",
    "manifestHash": "SHA-256: 7382...a2e3",
    "tamperSealId": "SL-9041 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "11:47:53 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0040",
    "passId": "GP-2026-0440",
    "assetId": "AST-2024-1040",
    "assetName": "Cisco Catalyst 9300 Switch",
    "serialNumber": "CS-9300-8760",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Liam Davies",
    "requesterBadge": "OPS-2201",
    "department": "Datacenter Ops",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "08:40:40 UTC",
    "status": "Pending",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Liam Davies (Datacenter Ops)",
    "carrierVehicle": "Liam Davies • Internal Logistics Van",
    "manifestHash": "SHA-256: e3f6...18b1",
    "tamperSealId": "SL-9040 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Vehicle arrived at inspection bay. Awaiting manifest verification.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Pending",
        "verified": false
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Queued",
        "verified": false
      }
    ],
    "timeline": [
      {
        "time": "08:40:40 UTC",
        "title": "In Inspection Bay",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": false
      }
    ]
  },
  {
    "id": "LOG-2026-0039",
    "passId": "GP-2026-0439",
    "assetId": "AST-2024-1039",
    "assetName": "Rohde & Schwarz Spectrum Analyzer",
    "serialNumber": "RS-FPL-8741",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Chloe Lin",
    "requesterBadge": "ENG-7120",
    "department": "AI / R&D Systems",
    "date": "2026-05-21",
    "dateDisplay": "May 21, 2026",
    "timeDisplay": "15:33:27 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Chloe Lin (AI / R&D Systems)",
    "carrierVehicle": "Chloe Lin • Internal Logistics Van",
    "manifestHash": "SHA-256: 26d3...51b2",
    "tamperSealId": "SL-9039 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "15:33:27 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0038",
    "passId": "GP-2026-0438",
    "assetId": "AST-2024-1038",
    "assetName": "HP LaserJet Enterprise MFP",
    "serialNumber": "HP-ENT-8722",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Sanjay Patel",
    "requesterBadge": "SYS-6640",
    "department": "Compute Architecture",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "12:26:14 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Sanjay Patel (Compute Architecture)",
    "carrierVehicle": "Sanjay Patel • Internal Logistics Van",
    "manifestHash": "SHA-256: b05e...6259",
    "tamperSealId": "SL-9038 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "12:26:14 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0037",
    "passId": "GP-2026-0437",
    "assetId": "AST-2024-1037",
    "assetName": "Cisco Catalyst 9500 Core Switch",
    "serialNumber": "CS-9500-8703",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Amina Latif",
    "requesterBadge": "QA-8812",
    "department": "Quality Assurance",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "09:19:01 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Amina Latif (Quality Assurance)",
    "carrierVehicle": "Amina Latif • Internal Logistics Van",
    "manifestHash": "SHA-256: 64aa...7d45",
    "tamperSealId": "SL-9037 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "09:19:01 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0036",
    "passId": "GP-2026-0436",
    "assetId": "AST-2024-1036",
    "assetName": "APC Smart-UPS RT 10000VA Unit",
    "serialNumber": "APC-10K-8684",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Elena Rostova",
    "requesterBadge": "ENG-9042",
    "department": "Hardware Engineering",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "16:12:48 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Elena Rostova (Hardware Engineering)",
    "carrierVehicle": "Elena Rostova • Internal Logistics Van",
    "manifestHash": "SHA-256: ede0...4c28",
    "tamperSealId": "SL-9036 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "16:12:48 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0035",
    "passId": "GP-2026-0435",
    "assetId": "AST-2024-1035",
    "assetName": "Keysight Infiniium Oscilloscope",
    "serialNumber": "KS-INF-8665",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Sarah Jenkins",
    "requesterBadge": "SEC-1092",
    "department": "Physical Security",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "13:05:35 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Sarah Jenkins (Physical Security)",
    "carrierVehicle": "Sarah Jenkins • Internal Logistics Van",
    "manifestHash": "SHA-256: 1929...8305",
    "tamperSealId": "SL-9035 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "13:05:35 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0034",
    "passId": "GP-2026-0434",
    "assetId": "AST-2024-1034",
    "assetName": "Dell Precision 7920 Workstation",
    "serialNumber": "DL-7920-8646",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Travis Henderson",
    "requesterBadge": "IT-4420",
    "department": "IT Infrastructure",
    "date": "2026-05-21",
    "dateDisplay": "May 21, 2026",
    "timeDisplay": "10:58:22 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Travis Henderson (IT Infrastructure)",
    "carrierVehicle": "Travis Henderson • Internal Logistics Van",
    "manifestHash": "SHA-256: 72c7...a00f",
    "tamperSealId": "SL-9034 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "10:58:22 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0033",
    "passId": "GP-2026-0433",
    "assetId": "AST-2024-1033",
    "assetName": "Arista 7050SX3-48YC8 Switch",
    "serialNumber": "AR-7050-8627",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Rachel Gomez",
    "requesterBadge": "LAB-3310",
    "department": "Testing & Validation",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "17:51:09 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Rachel Gomez (Testing & Validation)",
    "carrierVehicle": "Rachel Gomez • Internal Logistics Van",
    "manifestHash": "SHA-256: f075...a3e7",
    "tamperSealId": "SL-9033 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "17:51:09 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0032",
    "passId": "GP-2026-0432",
    "assetId": "AST-2024-1032",
    "assetName": "Honeywell HVAC Industrial Board",
    "serialNumber": "HW-0553-8608",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "David Vance",
    "requesterBadge": "FAC-0741",
    "department": "Building Automation",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "14:44:56 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "David Vance (Building Automation)",
    "carrierVehicle": "David Vance • Internal Logistics Van",
    "manifestHash": "SHA-256: 0ab6...6b6f",
    "tamperSealId": "SL-9032 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "14:44:56 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0031",
    "passId": "GP-2026-0431",
    "assetId": "AST-2024-1031",
    "assetName": "Apple Mac Studio M2 Ultra Test Bench",
    "serialNumber": "MAC-STU-8589",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Karen Wright",
    "requesterBadge": "LOG-1190",
    "department": "Supply Chain & Logistics",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "11:37:43 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Karen Wright (Supply Chain & Logistics)",
    "carrierVehicle": "Karen Wright • Internal Logistics Van",
    "manifestHash": "SHA-256: ae43...2d2b",
    "tamperSealId": "SL-9031 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "11:37:43 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0030",
    "passId": "GP-2026-0430",
    "assetId": "AST-2024-1030",
    "assetName": "Palo Alto PA-5250 Firewall",
    "serialNumber": "PA-5250-8570",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Viktor Chen",
    "requesterBadge": "NET-5510",
    "department": "Network Operations",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "08:30:30 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Viktor Chen (Network Operations)",
    "carrierVehicle": "Viktor Chen • Internal Logistics Van",
    "manifestHash": "SHA-256: 719b...bcff",
    "tamperSealId": "SL-9030 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "08:30:30 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0029",
    "passId": "GP-2026-0429",
    "assetId": "AST-2024-1029",
    "assetName": "NVIDIA DGX A100 Workstation",
    "serialNumber": "NV-DGX-8551",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Marcus Kane",
    "requesterBadge": "FAC-3109",
    "department": "Facilities Ops",
    "date": "2026-05-21",
    "dateDisplay": "May 21, 2026",
    "timeDisplay": "15:23:17 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Marcus Kane (Facilities Ops)",
    "carrierVehicle": "Marcus Kane • Internal Logistics Van",
    "manifestHash": "SHA-256: d250...11c1",
    "tamperSealId": "SL-9029 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "15:23:17 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0028",
    "passId": "GP-2026-0428",
    "assetId": "AST-2024-1028",
    "assetName": "Zebra ZT411 Industrial Label Printer",
    "serialNumber": "ZBR-ZT4-8532",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Liam Davies",
    "requesterBadge": "OPS-2201",
    "department": "Datacenter Ops",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "12:16:04 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Liam Davies (Datacenter Ops)",
    "carrierVehicle": "Liam Davies • Internal Logistics Van",
    "manifestHash": "SHA-256: 678e...2067",
    "tamperSealId": "SL-9028 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "12:16:04 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0027",
    "passId": "GP-2026-0427",
    "assetId": "AST-2024-1027",
    "assetName": "NetApp FAS2750 Hybrid Storage Array",
    "serialNumber": "NA-FAS-8513",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Chloe Lin",
    "requesterBadge": "ENG-7120",
    "department": "AI / R&D Systems",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "09:09:51 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Chloe Lin (AI / R&D Systems)",
    "carrierVehicle": "Chloe Lin • Internal Logistics Van",
    "manifestHash": "SHA-256: 5a5b...b951",
    "tamperSealId": "SL-9027 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "09:09:51 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0026",
    "passId": "GP-2026-0426",
    "assetId": "AST-2024-1026",
    "assetName": "Dell PowerEdge R750xs Server",
    "serialNumber": "DL-9014-8494",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Sanjay Patel",
    "requesterBadge": "SYS-6640",
    "department": "Compute Architecture",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "16:02:38 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Sanjay Patel (Compute Architecture)",
    "carrierVehicle": "Sanjay Patel • Internal Logistics Van",
    "manifestHash": "SHA-256: fd91...18e5",
    "tamperSealId": "SL-9026 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "16:02:38 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0025",
    "passId": "GP-2026-0425",
    "assetId": "AST-2024-1025",
    "assetName": "Eaton 9PX Marine Marine UPS",
    "serialNumber": "ETN-9PX-8475",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Amina Latif",
    "requesterBadge": "QA-8812",
    "department": "Quality Assurance",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "13:55:25 UTC",
    "status": "Pending",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Amina Latif (Quality Assurance)",
    "carrierVehicle": "Amina Latif • Internal Logistics Van",
    "manifestHash": "SHA-256: f44d...e4d6",
    "tamperSealId": "SL-9025 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Vehicle arrived at inspection bay. Awaiting manifest verification.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Pending",
        "verified": false
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Queued",
        "verified": false
      }
    ],
    "timeline": [
      {
        "time": "13:55:25 UTC",
        "title": "In Inspection Bay",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": false
      }
    ]
  },
  {
    "id": "LOG-2026-0024",
    "passId": "GP-2026-0424",
    "assetId": "AST-2024-1024",
    "assetName": "Tektronix Mixed Domain Scope",
    "serialNumber": "TK-MDO-8456",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Elena Rostova",
    "requesterBadge": "ENG-9042",
    "department": "Hardware Engineering",
    "date": "2026-05-21",
    "dateDisplay": "May 21, 2026",
    "timeDisplay": "10:48:12 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Elena Rostova (Hardware Engineering)",
    "carrierVehicle": "Elena Rostova • Internal Logistics Van",
    "manifestHash": "SHA-256: 55a2...f0b7",
    "tamperSealId": "SL-9024 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "10:48:12 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0023",
    "passId": "GP-2026-0423",
    "assetId": "AST-2024-1023",
    "assetName": "Fluke Networks Versiv DSX",
    "serialNumber": "FLK-789-8437",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Sarah Jenkins",
    "requesterBadge": "SEC-1092",
    "department": "Physical Security",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "17:41:59 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Sarah Jenkins (Physical Security)",
    "carrierVehicle": "Sarah Jenkins • Internal Logistics Van",
    "manifestHash": "SHA-256: b11d...ef10",
    "tamperSealId": "SL-9023 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "17:41:59 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0022",
    "passId": "GP-2026-0422",
    "assetId": "AST-2024-1022",
    "assetName": "Supermicro 4U Storage SuperServer",
    "serialNumber": "SM-4U-8418",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Travis Henderson",
    "requesterBadge": "IT-4420",
    "department": "IT Infrastructure",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "14:34:46 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Travis Henderson (IT Infrastructure)",
    "carrierVehicle": "Travis Henderson • Internal Logistics Van",
    "manifestHash": "SHA-256: a9ef...bfe9",
    "tamperSealId": "SL-9022 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "14:34:46 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0021",
    "passId": "GP-2026-0421",
    "assetId": "AST-2024-1021",
    "assetName": "Cisco Nexus 9336C Spine Switch",
    "serialNumber": "NX-9336-8399",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Rachel Gomez",
    "requesterBadge": "LAB-3310",
    "department": "Testing & Validation",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "11:27:33 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Rachel Gomez (Testing & Validation)",
    "carrierVehicle": "Rachel Gomez • Internal Logistics Van",
    "manifestHash": "SHA-256: 3eb8...b556",
    "tamperSealId": "SL-9021 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "11:27:33 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0020",
    "passId": "GP-2026-0420",
    "assetId": "AST-2024-1020",
    "assetName": "Cisco Catalyst 9300 Switch",
    "serialNumber": "CS-9300-8380",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "David Vance",
    "requesterBadge": "FAC-0741",
    "department": "Building Automation",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "08:20:20 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "David Vance (Building Automation)",
    "carrierVehicle": "David Vance • Internal Logistics Van",
    "manifestHash": "SHA-256: 000c...e2dd",
    "tamperSealId": "SL-9020 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "08:20:20 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0019",
    "passId": "GP-2026-0419",
    "assetId": "AST-2024-1019",
    "assetName": "Rohde & Schwarz Spectrum Analyzer",
    "serialNumber": "RS-FPL-8361",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Karen Wright",
    "requesterBadge": "LOG-1190",
    "department": "Supply Chain & Logistics",
    "date": "2026-05-21",
    "dateDisplay": "May 21, 2026",
    "timeDisplay": "15:13:07 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Karen Wright (Supply Chain & Logistics)",
    "carrierVehicle": "Karen Wright • Internal Logistics Van",
    "manifestHash": "SHA-256: c24c...b5e5",
    "tamperSealId": "SL-9019 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "15:13:07 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0018",
    "passId": "GP-2026-0418",
    "assetId": "AST-2024-1018",
    "assetName": "HP LaserJet Enterprise MFP",
    "serialNumber": "HP-ENT-8342",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Viktor Chen",
    "requesterBadge": "NET-5510",
    "department": "Network Operations",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "12:06:54 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Viktor Chen (Network Operations)",
    "carrierVehicle": "Viktor Chen • Internal Logistics Van",
    "manifestHash": "SHA-256: 8904...f55d",
    "tamperSealId": "SL-9018 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "12:06:54 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0017",
    "passId": "GP-2026-0417",
    "assetId": "AST-2024-1017",
    "assetName": "Cisco Catalyst 9500 Core Switch",
    "serialNumber": "CS-9500-8323",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Marcus Kane",
    "requesterBadge": "FAC-3109",
    "department": "Facilities Ops",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "09:59:41 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Marcus Kane (Facilities Ops)",
    "carrierVehicle": "Marcus Kane • Internal Logistics Van",
    "manifestHash": "SHA-256: 7377...94b7",
    "tamperSealId": "SL-9017 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "09:59:41 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0016",
    "passId": "GP-2026-0416",
    "assetId": "AST-2024-1016",
    "assetName": "APC Smart-UPS RT 10000VA Unit",
    "serialNumber": "APC-10K-8304",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Liam Davies",
    "requesterBadge": "OPS-2201",
    "department": "Datacenter Ops",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "16:52:28 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Liam Davies (Datacenter Ops)",
    "carrierVehicle": "Liam Davies • Internal Logistics Van",
    "manifestHash": "SHA-256: d527...4337",
    "tamperSealId": "SL-9016 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "16:52:28 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0015",
    "passId": "GP-2026-0415",
    "assetId": "AST-2024-1015",
    "assetName": "Keysight Infiniium Oscilloscope",
    "serialNumber": "KS-INF-8285",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Chloe Lin",
    "requesterBadge": "ENG-7120",
    "department": "AI / R&D Systems",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "13:45:15 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Chloe Lin (AI / R&D Systems)",
    "carrierVehicle": "Chloe Lin • Internal Logistics Van",
    "manifestHash": "SHA-256: f53c...32fc",
    "tamperSealId": "SL-9015 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "13:45:15 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0014",
    "passId": "GP-2026-0414",
    "assetId": "AST-2024-1014",
    "assetName": "Dell Precision 7920 Workstation",
    "serialNumber": "DL-7920-8266",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Sanjay Patel",
    "requesterBadge": "SYS-6640",
    "department": "Compute Architecture",
    "date": "2026-05-21",
    "dateDisplay": "May 21, 2026",
    "timeDisplay": "10:38:02 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Sanjay Patel (Compute Architecture)",
    "carrierVehicle": "Sanjay Patel • Internal Logistics Van",
    "manifestHash": "SHA-256: 2858...32f0",
    "tamperSealId": "SL-9014 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "10:38:02 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0013",
    "passId": "GP-2026-0413",
    "assetId": "AST-2024-1013",
    "assetName": "Arista 7050SX3-48YC8 Switch",
    "serialNumber": "AR-7050-8247",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Amina Latif",
    "requesterBadge": "QA-8812",
    "department": "Quality Assurance",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "17:31:49 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Amina Latif (Quality Assurance)",
    "carrierVehicle": "Amina Latif • Internal Logistics Van",
    "manifestHash": "SHA-256: 566a...4076",
    "tamperSealId": "SL-9013 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "17:31:49 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0012",
    "passId": "GP-2026-0412",
    "assetId": "AST-2024-1012",
    "assetName": "Honeywell HVAC Industrial Board",
    "serialNumber": "HW-0553-8228",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Elena Rostova",
    "requesterBadge": "ENG-9042",
    "department": "Hardware Engineering",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "14:24:36 UTC",
    "status": "Pending",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Elena Rostova (Hardware Engineering)",
    "carrierVehicle": "Elena Rostova • Internal Logistics Van",
    "manifestHash": "SHA-256: f390...7fe4",
    "tamperSealId": "SL-9012 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Vehicle arrived at inspection bay. Awaiting manifest verification.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Pending",
        "verified": false
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Queued",
        "verified": false
      }
    ],
    "timeline": [
      {
        "time": "14:24:36 UTC",
        "title": "In Inspection Bay",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": false
      }
    ]
  },
  {
    "id": "LOG-2026-0011",
    "passId": "GP-2026-0411",
    "assetId": "AST-2024-1011",
    "assetName": "Apple Mac Studio M2 Ultra Test Bench",
    "serialNumber": "MAC-STU-8209",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Sarah Jenkins",
    "requesterBadge": "SEC-1092",
    "department": "Physical Security",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "11:17:23 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Sarah Jenkins (Physical Security)",
    "carrierVehicle": "Sarah Jenkins • Internal Logistics Van",
    "manifestHash": "SHA-256: e8e6...4650",
    "tamperSealId": "SL-9011 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "11:17:23 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0010",
    "passId": "GP-2026-0410",
    "assetId": "AST-2024-1010",
    "assetName": "Palo Alto PA-5250 Firewall",
    "serialNumber": "PA-5250-8190",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Travis Henderson",
    "requesterBadge": "IT-4420",
    "department": "IT Infrastructure",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "08:10:10 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Travis Henderson (IT Infrastructure)",
    "carrierVehicle": "Travis Henderson • Internal Logistics Van",
    "manifestHash": "SHA-256: ad3b...464f",
    "tamperSealId": "SL-9010 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "08:10:10 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0009",
    "passId": "GP-2026-0409",
    "assetId": "AST-2024-1009",
    "assetName": "NVIDIA DGX A100 Workstation",
    "serialNumber": "NV-DGX-8171",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Rachel Gomez",
    "requesterBadge": "LAB-3310",
    "department": "Testing & Validation",
    "date": "2026-05-21",
    "dateDisplay": "May 21, 2026",
    "timeDisplay": "15:03:57 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Rachel Gomez (Testing & Validation)",
    "carrierVehicle": "Rachel Gomez • Internal Logistics Van",
    "manifestHash": "SHA-256: b32d...a3a7",
    "tamperSealId": "SL-9009 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "15:03:57 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0008",
    "passId": "GP-2026-0408",
    "assetId": "AST-2024-1008",
    "assetName": "Zebra ZT411 Industrial Label Printer",
    "serialNumber": "ZBR-ZT4-8152",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "David Vance",
    "requesterBadge": "FAC-0741",
    "department": "Building Automation",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "12:56:44 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "David Vance (Building Automation)",
    "carrierVehicle": "David Vance • Internal Logistics Van",
    "manifestHash": "SHA-256: 335f...c994",
    "tamperSealId": "SL-9008 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "12:56:44 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0007",
    "passId": "GP-2026-0407",
    "assetId": "AST-2024-1007",
    "assetName": "NetApp FAS2750 Hybrid Storage Array",
    "serialNumber": "NA-FAS-8133",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Karen Wright",
    "requesterBadge": "LOG-1190",
    "department": "Supply Chain & Logistics",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "09:49:31 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Karen Wright (Supply Chain & Logistics)",
    "carrierVehicle": "Karen Wright • Internal Logistics Van",
    "manifestHash": "SHA-256: a52d...5c16",
    "tamperSealId": "SL-9007 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "09:49:31 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0006",
    "passId": "GP-2026-0406",
    "assetId": "AST-2024-1006",
    "assetName": "Dell PowerEdge R750xs Server",
    "serialNumber": "DL-9014-8114",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Viktor Chen",
    "requesterBadge": "NET-5510",
    "department": "Network Operations",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "16:42:18 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Viktor Chen (Network Operations)",
    "carrierVehicle": "Viktor Chen • Internal Logistics Van",
    "manifestHash": "SHA-256: 5346...691f",
    "tamperSealId": "SL-9006 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "16:42:18 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0005",
    "passId": "GP-2026-0405",
    "assetId": "AST-2024-1005",
    "assetName": "Eaton 9PX Marine Marine UPS",
    "serialNumber": "ETN-9PX-8095",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Marcus Kane",
    "requesterBadge": "FAC-3109",
    "department": "Facilities Ops",
    "date": "2026-05-24",
    "dateDisplay": "May 24, 2026",
    "timeDisplay": "13:35:05 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Marcus Kane (Facilities Ops)",
    "carrierVehicle": "Marcus Kane • Internal Logistics Van",
    "manifestHash": "SHA-256: d413...1331",
    "tamperSealId": "SL-9005 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "13:35:05 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0004",
    "passId": "GP-2026-0404",
    "assetId": "AST-2024-1004",
    "assetName": "Tektronix Mixed Domain Scope",
    "serialNumber": "TK-MDO-8076",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Liam Davies",
    "requesterBadge": "OPS-2201",
    "department": "Datacenter Ops",
    "date": "2026-05-21",
    "dateDisplay": "May 21, 2026",
    "timeDisplay": "10:28:52 UTC",
    "status": "Cleared",
    "guardName": "M. Vance",
    "guardBadge": "SEC-8812",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Liam Davies (Datacenter Ops)",
    "carrierVehicle": "Liam Davies • Internal Logistics Van",
    "manifestHash": "SHA-256: a7bd...0a8f",
    "tamperSealId": "SL-9004 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "10:28:52 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0003",
    "passId": "GP-2026-0403",
    "assetId": "AST-2024-1003",
    "assetName": "Fluke Networks Versiv DSX",
    "serialNumber": "FLK-789-8057",
    "direction": "Outward",
    "directionLabel": "Outward / Exit",
    "requesterName": "Chloe Lin",
    "requesterBadge": "ENG-7120",
    "department": "AI / R&D Systems",
    "date": "2026-05-23",
    "dateDisplay": "May 23, 2026",
    "timeDisplay": "17:21:39 UTC",
    "status": "Cleared",
    "guardName": "D. Miller",
    "guardBadge": "SEC-8809",
    "checkpoint": "Gate-01A (North)",
    "checkpointFull": "Gate-01A (North Barrier Lane)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Chloe Lin (AI / R&D Systems)",
    "carrierVehicle": "Chloe Lin • Internal Logistics Van",
    "manifestHash": "SHA-256: 94e1...8a89",
    "tamperSealId": "SL-9003 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "17:21:39 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-01A (North) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0002",
    "passId": "GP-2026-0402",
    "assetId": "AST-2024-1002",
    "assetName": "Supermicro 4U Storage SuperServer",
    "serialNumber": "SM-4U-8038",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Sanjay Patel",
    "requesterBadge": "SYS-6640",
    "department": "Compute Architecture",
    "date": "2026-05-20",
    "dateDisplay": "May 20, 2026",
    "timeDisplay": "14:14:26 UTC",
    "status": "Cleared",
    "guardName": "J. Harper",
    "guardBadge": "SEC-8820",
    "checkpoint": "Gate-02B (South)",
    "checkpointFull": "Gate-02B (South Delivery Bay)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Sanjay Patel (Compute Architecture)",
    "carrierVehicle": "Sanjay Patel • Internal Logistics Van",
    "manifestHash": "SHA-256: a385...ee99",
    "tamperSealId": "SL-9002 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "14:14:26 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-02B (South) checkpoint logged event",
        "completed": true
      }
    ]
  },
  {
    "id": "LOG-2026-0001",
    "passId": "GP-2026-0401",
    "assetId": "AST-2024-1001",
    "assetName": "Cisco Nexus 9336C Spine Switch",
    "serialNumber": "NX-9336-8019",
    "direction": "Inward",
    "directionLabel": "Inward / Entry",
    "requesterName": "Amina Latif",
    "requesterBadge": "QA-8812",
    "department": "Quality Assurance",
    "date": "2026-05-22",
    "dateDisplay": "May 22, 2026",
    "timeDisplay": "11:07:13 UTC",
    "status": "Cleared",
    "guardName": "R. Kowalski",
    "guardBadge": "SEC-8815",
    "checkpoint": "Gate-03 (Loading)",
    "checkpointFull": "Gate-03 (East Logistics Dock)",
    "approvingAdmin": "Sarah Jenkins (Host Security Officer)",
    "custodian": "Amina Latif (Quality Assurance)",
    "carrierVehicle": "Amina Latif • Internal Logistics Van",
    "manifestHash": "SHA-256: db50...a51a",
    "tamperSealId": "SL-9001 (Intact)",
    "inspectedQty": 1,
    "expectedQty": 1,
    "hasDiscrepancy": false,
    "discrepancyStatusTitle": "None detected / Clean Pass",
    "discrepancyDetails": "All physical serial numbers and custody manifest credentials matched. Gate pass cleared without variance.",
    "guardRemarks": "Physical hardware verified against digital manifest. Barrier cleared.",
    "checklist": [
      {
        "title": "Digital Manifest Authority Validated",
        "status": "Cleared",
        "verified": true
      },
      {
        "title": "Physical Serial Barcode Matched",
        "status": "Matched",
        "verified": true
      },
      {
        "title": "Tamper-Evident Transit Seal Intact",
        "status": "Verified",
        "verified": true
      },
      {
        "title": "Barrier Release Authorized",
        "status": "Cleared",
        "verified": true
      }
    ],
    "timeline": [
      {
        "time": "11:07:13 UTC",
        "title": "Barrier Cleared",
        "desc": "Gate-03 (Loading) checkpoint logged event",
        "completed": true
      }
    ]
  }
];
