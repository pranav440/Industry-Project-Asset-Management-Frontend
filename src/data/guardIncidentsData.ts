// =====================================================================
// AssetMX Checkpoint Escalation & Discrepancy Register Data Types
// Grounded directly in backend GatePass and GatePassHistory escalation models
// =====================================================================

export type HoldStatus = 'Active' | 'Cleared';

export interface GuardEscalationTimelineEvent {
  id: string;
  timestamp: string; // Formatted date & time, e.g. "May 24, 2026, 11:24 AM"
  event: string; // e.g. "Escalated", "Override Granted", "Exit Verification"
  actor: string;
  actorRole: string; // "Security Officer" | "Administrator"
  note?: string | null;
}

export interface GuardEscalationRegisterItem {
  id: string; // e.g. "ESC-GP-2026-0001"
  passId: string; // e.g. "GP-2026-0001"
  assetId: string; // e.g. "AST-2024-0042" or item name
  assetName: string;
  requesterName: string;
  department: string;
  destination: string;
  passType: string;
  gatePassStatus: string; // Current status: "Escalated" | "Approved" | "Active" | "Completed"
  holdStatus: HoldStatus; // "Active" (currently on hold) | "Cleared" (cleared by override)
  holdStatusTitle: string; // "Active Escalation Hold" | "Cleared by Administrative Override"
  escalationReason: string;
  actionRequired?: string | null;
  escalatedBy: string;
  escalationTimestamp: string;
  dateDisplay: string;
  timeDisplay: string;
  checkpoint: string;
  overrideBy?: string | null;
  overrideTimestamp?: string | null;
  overrideNote?: string | null;
  timeline: GuardEscalationTimelineEvent[];
}

export interface GuardEscalationKpis {
  totalHolds: number;
  activeHolds: number;
  clearedOverridden: number;
}
