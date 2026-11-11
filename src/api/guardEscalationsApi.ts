import { getToken } from '../auth/session';
import type {
  GuardEscalationRegisterItem,
  GuardEscalationKpis,
} from '../data/guardIncidentsData';

export interface GuardEscalationQueryParams {
  search?: string;
  status?: 'All' | 'Active' | 'Cleared';
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface GuardEscalationRegisterResponse {
  items: GuardEscalationRegisterItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: GuardEscalationKpis;
}

export class GuardEscalationApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GuardEscalationApiError';
  }
}

export async function fetchGuardEscalationRegister(
  params: GuardEscalationQueryParams = {}
): Promise<GuardEscalationRegisterResponse> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const query = new URLSearchParams();
  if (params.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params.fromDate && params.fromDate.trim()) {
    query.set('from_date', params.fromDate.trim());
  }
  if (params.toDate && params.toDate.trim()) {
    query.set('to_date', params.toDate.trim());
  }
  if (params.status && params.status !== 'All') {
    query.set('status', params.status);
  }
  if (params.page !== undefined && params.page > 0) {
    query.set('page', String(params.page));
  }
  if (params.pageSize !== undefined && params.pageSize > 0) {
    query.set('page_size', String(params.pageSize));
  }

  const url = `/api/gate-passes/escalation-register${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    let errMsg = `Failed to load escalation register (HTTP ${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.detail) {
        errMsg = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new GuardEscalationApiError(response.status, errMsg);
  }

  const data = await response.json();

  const items: GuardEscalationRegisterItem[] = (data.items || []).map((raw: any) => ({
    id: raw.id || `ESC-${raw.passId || raw.pass_id}`,
    passId: raw.passId || raw.pass_id || '',
    assetId: raw.assetId || raw.asset_id || '',
    assetName: raw.assetName || raw.asset_name || '',
    requesterName: raw.requesterName || raw.requester_name || '',
    department: raw.department || '',
    destination: raw.destination || '',
    passType: raw.passType || raw.pass_type || '',
    gatePassStatus: raw.gatePassStatus || raw.gate_pass_status || 'Escalated',
    holdStatus: (raw.holdStatus || raw.hold_status || 'Active') as 'Active' | 'Cleared',
    holdStatusTitle: raw.holdStatusTitle || raw.hold_status_title || 'Active Escalation Hold',
    escalationReason: raw.escalationReason || raw.escalation_reason || '',
    actionRequired: raw.actionRequired || raw.action_required || null,
    escalatedBy: raw.escalatedBy || raw.escalated_by || '',
    escalationTimestamp: raw.escalationTimestamp || raw.escalation_timestamp || '',
    dateDisplay: raw.dateDisplay || raw.date_display || '',
    timeDisplay: raw.timeDisplay || raw.time_display || '',
    checkpoint: raw.checkpoint || 'Gate-01A Main Gate',
    overrideBy: raw.overrideBy || raw.override_by || null,
    overrideTimestamp: raw.overrideTimestamp || raw.override_timestamp || null,
    overrideNote: raw.overrideNote || raw.override_note || null,
    timeline: (raw.timeline || []).map((ev: any) => ({
      id: ev.id || '',
      timestamp: ev.timestamp || '',
      event: ev.event || '',
      actor: ev.actor || '',
      actorRole: ev.actorRole || ev.actor_role || 'Officer',
      note: ev.note || null,
    })),
  }));

  const kpis: GuardEscalationKpis = {
    totalHolds: data.kpis?.totalHolds ?? data.kpis?.total_holds ?? items.length,
    activeHolds: data.kpis?.activeHolds ?? data.kpis?.active_holds ?? 0,
    clearedOverridden: data.kpis?.clearedOverridden ?? data.kpis?.cleared_overridden ?? 0,
  };

  return {
    items,
    total: data.total ?? items.length,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? data.page_size ?? items.length,
    totalPages: data.totalPages ?? data.total_pages ?? 1,
    kpis,
  };
}

/**
 * Complete multi-page export fetcher for the active filter scope.
 * Fetches every page sequentially, prevents silent truncation, and deduplicates rows by passId.
 */
export async function fetchAllGuardEscalationsForExport(
  params: Omit<GuardEscalationQueryParams, 'page' | 'pageSize'> = {},
  onProgress?: (loaded: number, total: number) => void
): Promise<GuardEscalationRegisterItem[]> {
  const pageSize = 100;
  const firstPage = await fetchGuardEscalationRegister({
    ...params,
    page: 1,
    pageSize,
  });

  const allItems: GuardEscalationRegisterItem[] = [];
  const seenIds = new Set<string>();

  for (const item of firstPage.items) {
    if (!seenIds.has(item.passId)) {
      seenIds.add(item.passId);
      allItems.push(item);
    }
  }

  const total = firstPage.total;
  const totalPages = firstPage.totalPages;
  if (onProgress) onProgress(allItems.length, total);

  for (let page = 2; page <= totalPages; page++) {
    const nextPage = await fetchGuardEscalationRegister({
      ...params,
      page,
      pageSize,
    });
    for (const item of nextPage.items) {
      if (!seenIds.has(item.passId)) {
        seenIds.add(item.passId);
        allItems.push(item);
      }
    }
    if (onProgress) onProgress(allItems.length, total);
  }

  return allItems;
}
