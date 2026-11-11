import { getToken } from '../auth/session';
import type {
  GuardMovementLogRecord,
  GuardLogsKpis,
} from '../data/guardLogsData';

export interface GuardLogsQueryParams {
  search?: string;
  fromDate?: string;
  toDate?: string;
  direction?: 'All' | 'Inward' | 'Outward' | 'Movements';
  status?: 'All' | 'Cleared' | 'Pending' | 'Flagged';
  page?: number;
  pageSize?: number;
}

export interface GuardLogsApiResponse {
  items: GuardMovementLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: GuardLogsKpis;
}

export class GuardLogsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GuardLogsApiError';
  }
}

export async function fetchGuardMovementLogs(
  params: GuardLogsQueryParams = {}
): Promise<GuardLogsApiResponse> {
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
  if (params.direction && params.direction !== 'All') {
    query.set('direction', params.direction);
  }
  if (params.status && params.status !== 'All') {
    query.set('status', params.status);
  }
  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    query.set('page_size', String(params.pageSize));
  }

  const queryString = query.toString();
  const url = `/api/gate-passes/movement-logs${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as {
    detail?: string | { msg: string }[];
    items?: any[];
    total?: number;
    page?: number;
    pageSize?: number;
    page_size?: number;
    totalPages?: number;
    total_pages?: number;
    kpis?: any;
  };

  if (!response.ok) {
    let detailMsg = 'Failed to load movement logs';
    if (typeof body?.detail === 'string') {
      detailMsg = body.detail;
    } else if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
      detailMsg = body.detail[0].msg;
    }
    throw new GuardLogsApiError(response.status, detailMsg);
  }

  const items: GuardMovementLogRecord[] = Array.isArray(body.items)
    ? body.items.map((row: any) => ({
      id: row.id || row.history_id || '',
      passId: row.passId || row.pass_id || '',
      assetId: row.assetId || row.asset_id || '',
      assetName: row.assetName || row.asset_name || '',
      serialNumber: row.serialNumber || row.serial_number || 'Unavailable',
      category: (row.category || (row.direction === 'Inward' || row.direction === 'Outward' ? 'Physical Movement' : 'Administrative')) as 'Physical Movement' | 'Administrative' | 'Security Escalation',
      direction: (row.direction === 'Inward' ? 'Inward' : row.direction === 'Outward' ? 'Outward' : 'N/A') as 'Outward' | 'Inward' | 'N/A',
      directionLabel: row.directionLabel || row.direction_label || (row.direction === 'Inward' ? 'Inward / Entry' : row.direction === 'Outward' ? 'Outward / Exit' : 'Administrative'),
      requesterName: row.requesterName || row.requester_name || '',
      requesterBadge: row.requesterBadge || row.requester_badge || 'Staff',
      department: row.department || 'Administration',
      date: row.date || '',
      dateDisplay: row.dateDisplay || row.date_display || row.date || '',
      timeDisplay: row.timeDisplay || row.time_display || '',
      status: (row.status === 'Flagged' ? 'Flagged' : row.status === 'Pending' ? 'Pending' : 'Cleared') as 'Cleared' | 'Pending' | 'Flagged',
      guardName: row.guardName || row.guard_name || 'Guard Officer',
      guardBadge: row.guardBadge || row.guard_badge || 'SEC-GUARD',
      checkpoint: row.checkpoint || 'Guard Console',
      checkpointFull: row.checkpointFull || row.checkpoint_full || 'Guard Console (Checkpoint)',
      approvingAdmin: row.approvingAdmin || row.approving_admin || 'Authorized by System',
      custodian: row.custodian || '',
      carrierVehicle: row.carrierVehicle || row.carrier_vehicle || '',
      manifestHash: row.manifestHash || row.manifest_hash || 'Standard Manifest (No Hash Stored)',
      tamperSealId: row.tamperSealId || row.tamper_seal_id || 'N/A (Untracked)',
      inspectedQty: Number(row.inspectedQty ?? row.inspected_qty ?? 1),
      expectedQty: Number(row.expectedQty ?? row.expected_qty ?? 1),
      hasDiscrepancy: Boolean(row.hasDiscrepancy ?? row.has_discrepancy ?? false),
      discrepancyStatusTitle: row.discrepancyStatusTitle || row.discrepancy_status_title || 'None detected / Clean Pass',
      discrepancyDetails: row.discrepancyDetails || row.discrepancy_details || '',
      guardRemarks: row.guardRemarks || row.guard_remarks || '',
      checklist: Array.isArray(row.checklist) ? row.checklist : [],
      timeline: Array.isArray(row.timeline) ? row.timeline : [],
    }))
    : [];

  const rawKpis = body.kpis || {};
  const totalCount = Number(body.total ?? items.length);
  const kpis: GuardLogsKpis = {
    totalMovements: {
      total: Number(rawKpis.totalMovements ?? rawKpis.total_movements ?? 0),
      badgeText: 'Movement Scope',
      subtext: 'Completed checkpoint entry & exit events',
    },
    inboundEntries: {
      total: Number(rawKpis.inboundEntries ?? rawKpis.inbound_entries ?? 0),
      subtext: 'Dock receiving & internal intake',
    },
    outboundExits: {
      total: Number(rawKpis.outboundExits ?? rawKpis.outbound_exits ?? 0),
      subtext: 'Field transit & authorized dispatches',
    },
    flaggedMovements: {
      total: Number(rawKpis.flaggedMovements ?? rawKpis.flagged_movements ?? 0),
      badgeText: 'Audit Hold',
      subtext: 'Movement records with discrepancies or holds',
    },
    totalRecords: {
      total: Number(rawKpis.totalRecords ?? rawKpis.total_records ?? totalCount),
      subtext: 'Total audit trail records in active filter',
    },
  };

  return {
    items,
    total: totalCount,
    page: Number(body.page ?? params.page ?? 1),
    pageSize: Number(body.pageSize ?? body.page_size ?? params.pageSize ?? 10),
    totalPages: Number(body.totalPages ?? body.total_pages ?? 1),
    kpis,
  };
}

/**
 * Fetches all pages sequentially for the applied filters to guarantee
 * 100% complete and deduplicated CSV export without dropping records.
 */
export async function fetchAllGuardMovementLogsForExport(
  params: Omit<GuardLogsQueryParams, 'page' | 'pageSize'> = {},
  onProgress?: (loaded: number, total: number) => void
): Promise<GuardMovementLogRecord[]> {
  const pageSize = 100;
  const firstPage = await fetchGuardMovementLogs({
    ...params,
    page: 1,
    pageSize,
  });

  const allItems: GuardMovementLogRecord[] = [];
  const seenIds = new Set<string>();

  for (const item of firstPage.items) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      allItems.push(item);
    }
  }

  const total = firstPage.total;
  const totalPages = firstPage.totalPages;
  if (onProgress) onProgress(allItems.length, total);

  for (let page = 2; page <= totalPages; page++) {
    const nextPage = await fetchGuardMovementLogs({
      ...params,
      page,
      pageSize,
    });
    for (const item of nextPage.items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allItems.push(item);
      }
    }
    if (onProgress) onProgress(allItems.length, total);
  }

  return allItems;
}

