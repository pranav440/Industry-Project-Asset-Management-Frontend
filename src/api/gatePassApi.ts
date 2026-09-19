import { getToken } from '../auth/session';
import type { GatePassItemData, GatePassStatus, GatePassType } from '../data/gatePassData';

export type GatePassApiType = 'Asset Movement' | 'Returnable' | 'Non-Returnable' | 'Maintenance';
export type GatePassApiStatus = 'Pending' | 'Approved' | 'Rejected' | 'Active' | 'Completed' | 'Escalated';

export interface GatePassHistoryApiRecord {
  history_id: string;
  timestamp: string;
  action: string;
  performed_by: string;
  note: string | null;
  status_snapshot: string;
}

export interface GatePassApiRecord {
  pass_id: string;
  pass_type: GatePassApiType;
  request_date: string;
  status: GatePassApiStatus;
  requester_name: string;
  department: string;
  asset_or_item: string;
  quantity: number;
  current_location: string | null;
  destination: string;
  movement_date: string | null;
  purpose: string;
  authorization_state: string;
  decision_status: string;
  decision_date: string | null;
  decision_by: string | null;
  exit_status: string | null;
  exit_timestamp: string | null;
  exit_gate: string | null;
  exit_officer: string | null;
  exit_notes: string | null;
  entry_status: string | null;
  entry_timestamp: string | null;
  entry_gate: string | null;
  entry_officer: string | null;
  entry_notes: string | null;
  escalation_is_escalated: boolean;
  escalation_reason: string | null;
  escalation_timestamp: string | null;
  escalation_action_required: string | null;
  escalation_escalated_by: string | null;
  created_at: string;
  updated_at: string;
  history: GatePassHistoryApiRecord[];
}

export interface GatePassListResponse {
  items: GatePassApiRecord[];
  total: number;
  page: number;
  page_size: number;
}

export class GatePassApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GatePassApiError';
  }
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function mapGatePassApiRecord(apiRecord: GatePassApiRecord): GatePassItemData {
  const exitStatus = apiRecord.exit_status === 'Verified' ? 'Verified' : apiRecord.exit_status === 'N/A' ? 'N/A' : 'Pending';
  const entryStatus = apiRecord.entry_status === 'Verified' ? 'Verified' : apiRecord.entry_status === 'N/A' ? 'N/A' : 'Pending';

  return {
    id: apiRecord.pass_id,
    passType: apiRecord.pass_type as GatePassType,
    requestDate: formatDateOnly(apiRecord.request_date),
    status: apiRecord.status as GatePassStatus,
    requesterName: apiRecord.requester_name,
    department: apiRecord.department,
    assetOrItem: apiRecord.asset_or_item,
    quantity: apiRecord.quantity,
    currentLocation: apiRecord.current_location ?? 'Not specified',
    destination: apiRecord.destination,
    movementDate: formatDateOnly(apiRecord.movement_date ?? apiRecord.request_date),
    purpose: apiRecord.purpose,
    authorizationState: apiRecord.authorization_state,
    decisionStatus: apiRecord.decision_status,
    decisionDate: apiRecord.decision_date ? formatDateTime(apiRecord.decision_date) : undefined,
    decisionBy: apiRecord.decision_by ?? undefined,
    gateActivity: {
      exitStatus,
      exitTimestamp: apiRecord.exit_timestamp ? formatDateTime(apiRecord.exit_timestamp) : undefined,
      exitGate: apiRecord.exit_gate ?? undefined,
      exitOfficer: apiRecord.exit_officer ?? undefined,
      exitNotes: apiRecord.exit_notes ?? undefined,
      entryStatus,
      entryTimestamp: apiRecord.entry_timestamp ? formatDateTime(apiRecord.entry_timestamp) : undefined,
      entryGate: apiRecord.entry_gate ?? undefined,
      entryOfficer: apiRecord.entry_officer ?? undefined,
      entryNotes: apiRecord.entry_notes ?? undefined,
    },
    escalation: {
      isEscalated: Boolean(apiRecord.escalation_is_escalated),
      reason: apiRecord.escalation_reason ?? undefined,
      timestamp: apiRecord.escalation_timestamp ? formatDateTime(apiRecord.escalation_timestamp) : undefined,
      actionRequired: apiRecord.escalation_action_required ?? undefined,
      escalatedBy: apiRecord.escalation_escalated_by ?? undefined,
    },
    history: (apiRecord.history || []).map((entry) => ({
      id: entry.history_id,
      timestamp: formatDateTime(entry.timestamp),
      action: entry.action,
      performedBy: entry.performed_by,
      note: entry.note ?? undefined,
      statusSnapshot: entry.status_snapshot as GatePassStatus,
    })),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as { detail?: string | { msg: string }[] };
  if (!response.ok) {
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
    throw new GatePassApiError(response.status, detail || `Gate Pass request failed (${response.status})`);
  }

  return body as T;
}

export function listGatePasses(params: {
  search?: string;
  pass_type?: string;
  status?: string;
  date?: string;
  location?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<GatePassListResponse> {
  const query = new URLSearchParams();
  Object.entries({
    search: params.search,
    pass_type: params.pass_type,
    status: params.status,
    date: params.date,
    location: params.location,
    page: params.page,
    page_size: params.page_size,
  }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  return request<GatePassListResponse>(`/api/gate-passes${query.toString() ? `?${query.toString()}` : ''}`);
}

export function getGatePass(passId: string): Promise<GatePassApiRecord> {
  return request<GatePassApiRecord>(`/api/gate-passes/${encodeURIComponent(passId)}`);
}

export function createGatePass(payload: {
  pass_type: GatePassApiType;
  asset_or_item: string;
  quantity: number;
  destination: string;
  movement_date: string;
  purpose: string;
}): Promise<GatePassApiRecord> {
  return request<GatePassApiRecord>('/api/gate-passes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function decideGatePass(
  passId: string,
  payload: { target_status: 'Approved' | 'Rejected'; note?: string },
): Promise<GatePassApiRecord> {
  return request<GatePassApiRecord>(`/api/gate-passes/${encodeURIComponent(passId)}/decision`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyExitGatePass(
  passId: string,
  payload: { exit_gate: string; exit_notes?: string },
): Promise<GatePassApiRecord> {
  return request<GatePassApiRecord>(`/api/gate-passes/${encodeURIComponent(passId)}/exit-verification`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyEntryGatePass(
  passId: string,
  payload: { entry_gate: string; entry_notes?: string },
): Promise<GatePassApiRecord> {
  return request<GatePassApiRecord>(`/api/gate-passes/${encodeURIComponent(passId)}/entry-verification`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function escalateGatePass(
  passId: string,
  payload: { reason: string; action_required: string },
): Promise<GatePassApiRecord> {
  return request<GatePassApiRecord>(`/api/gate-passes/${encodeURIComponent(passId)}/escalate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function overrideGatePass(
  passId: string,
  payload: { note?: string },
): Promise<GatePassApiRecord> {
  return request<GatePassApiRecord>(`/api/gate-passes/${encodeURIComponent(passId)}/override`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
