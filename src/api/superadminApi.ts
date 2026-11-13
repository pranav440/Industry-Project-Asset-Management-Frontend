import { getToken } from '../auth/session';

export type CanonicalRole = 'employee' | 'host' | 'admin' | 'guard' | 'superadmin';

export interface SuperAdminUserRecord {
  id: number;
  full_name: string;
  email: string;
  employee_id: string;
  role: CanonicalRole;
  department: string | null;
  department_id: number | null;
  is_active: boolean;
}

export interface SuperAdminUserListResponse {
  items: SuperAdminUserRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SuperAdminUserListParams {
  role?: string;
  department?: string;
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export interface SuperAdminUserCreatePayload {
  full_name: string;
  email: string;
  employee_id: string;
  role: CanonicalRole;
  department?: string | null;
  password: string;
}

export interface SuperAdminUserUpdatePayload {
  full_name?: string;
  email?: string;
  role?: CanonicalRole;
  department?: string | null;
  is_active?: boolean;
}

export interface SuperAdminAnalyticsResponse {
  total_users: number;
  active_users: number;
  users_by_role: Record<string, number>;
  total_assets: number;
  assets_in_service: number;
  total_consumables: number;
  low_stock_consumables: number;
  total_requests: number;
  open_requests: number;
  fulfilled_requests: number;
  fulfillment_rate_percent: number;
  average_approval_cycle_hours: number;
  total_gate_passes: number;
  active_gate_passes: number;
  overdue_gate_passes: number;
  total_audit_events: number;
  // Backwards compatibility aliases
  low_stock?: number;
  fulfillment_rate?: number;
  total_passes?: number;
  active_passes?: number;
  overdue_passes?: number;
}

export interface SystemConfigItem {
  key: string;
  value: number;
  category: string;
  description: string;
}

export interface SystemConfigResponse {
  configs: SystemConfigItem[];
}

export interface SystemConfigUpdateItem {
  key: string;
  value: number;
  description?: string;
}

export interface SystemConfigUpdatePayload {
  configs: SystemConfigUpdateItem[];
}

export interface AuditLogListItem {
  id: number;
  action: string;
  asset_identifier: string | null;
  consumable_identifier: string | null;
  request_identifier: string | null;
  gate_pass_identifier: string | null;
  actor_user_id: number;
  occurred_at: string;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  movement_id: string | null;
  metadata: Record<string, any> | null;
}

export interface AuditLogListResponse {
  items: AuditLogListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLogListParams {
  action?: string;
  actor_id?: number | string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface AuditLogExportParams {
  action?: string;
  date_from?: string;
  date_to?: string;
}

export class SuperAdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'SuperAdminApiError';
  }
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

  const body = (await response.json().catch(() => ({}))) as {
    detail?: string | { msg: string }[];
    message?: string;
  };

  if (!response.ok) {
    let detail = 'SuperAdmin API request failed';
    if (typeof body.detail === 'string') {
      detail = body.detail;
    } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      detail = body.detail[0].msg;
    } else if (body.message) {
      detail = body.message;
    }
    throw new SuperAdminApiError(response.status, detail);
  }

  return body as T;
}

export async function listUsers(params: SuperAdminUserListParams = {}): Promise<SuperAdminUserListResponse> {
  const query = new URLSearchParams();
  if (params.role && params.role !== 'All') {
    query.set('role', params.role.toLowerCase());
  }
  if (params.department && params.department !== 'All') {
    query.set('department', params.department);
  }
  if (params.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params.is_active !== undefined) {
    query.set('is_active', String(params.is_active));
  }
  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }
  if (params.page_size !== undefined) {
    query.set('page_size', String(params.page_size));
  }

  const qs = query.toString();
  const endpoint = `/api/superadmin/users${qs ? `?${qs}` : ''}`;
  return request<SuperAdminUserListResponse>(endpoint, { method: 'GET' });
}

export async function createUser(payload: SuperAdminUserCreatePayload): Promise<SuperAdminUserRecord> {
  return request<SuperAdminUserRecord>('/api/superadmin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getUser(userId: number): Promise<SuperAdminUserRecord> {
  return request<SuperAdminUserRecord>(`/api/superadmin/users/${userId}`, { method: 'GET' });
}

export async function updateUser(
  userId: number,
  payload: SuperAdminUserUpdatePayload,
): Promise<SuperAdminUserRecord> {
  return request<SuperAdminUserRecord>(`/api/superadmin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateUserStatus(
  userId: number,
  isActive: boolean,
): Promise<SuperAdminUserRecord> {
  return request<SuperAdminUserRecord>(`/api/superadmin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function resetUserPassword(
  userId: number,
  newPassword: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/superadmin/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export async function getSuperAdminAnalytics(): Promise<SuperAdminAnalyticsResponse> {
  return request<SuperAdminAnalyticsResponse>('/api/superadmin/analytics', { method: 'GET' });
}

export async function getSystemConfig(): Promise<SystemConfigResponse> {
  return request<SystemConfigResponse>('/api/superadmin/config', { method: 'GET' });
}

export async function updateSystemConfig(
  payload: SystemConfigUpdatePayload,
): Promise<SystemConfigResponse> {
  return request<SystemConfigResponse>('/api/superadmin/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ── In-Memory Cache Store for Audit Events (Data Handoff & Direct Refresh) ──

const auditEventCache = new Map<number, AuditLogListItem>();

export function setCachedAuditEvent(event: AuditLogListItem): void {
  if (event && typeof event.id === 'number') {
    auditEventCache.set(event.id, event);
  }
}

export function getCachedAuditEvent(id: number): AuditLogListItem | null {
  return auditEventCache.get(id) || null;
}

export function clearAuditEventCache(): void {
  auditEventCache.clear();
}

export async function listAuditLogs(
  params: AuditLogListParams = {},
): Promise<AuditLogListResponse> {
  const query = new URLSearchParams();
  if (params.action && params.action.trim()) {
    query.set('action', params.action.trim());
  }
  if (params.actor_id !== undefined && params.actor_id !== '') {
    query.set('actor_id', String(params.actor_id).trim());
  }
  if (params.date_from && params.date_from.trim()) {
    query.set('date_from', params.date_from.trim());
  }
  if (params.date_to && params.date_to.trim()) {
    query.set('date_to', params.date_to.trim());
  }
  if (params.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }
  if (params.page_size !== undefined) {
    query.set('page_size', String(params.page_size));
  }

  const qs = query.toString();
  const endpoint = `/api/superadmin/audit-logs${qs ? `?${qs}` : ''}`;
  const response = await request<AuditLogListResponse>(endpoint, { method: 'GET' });

  // Pre-seed cache with fetched items for fast subsequent details view
  if (response && Array.isArray(response.items)) {
    for (const item of response.items) {
      setCachedAuditEvent(item);
    }
  }

  return response;
}

export async function fetchAuditEventById(id: number): Promise<AuditLogListItem | null> {
  const cached = getCachedAuditEvent(id);
  if (cached) return cached;

  try {
    // Attempt to locate via search query or large initial page
    const listRes = await listAuditLogs({ search: String(id), page: 1, page_size: 100 });
    const directMatch = listRes.items.find((item) => item.id === id);
    if (directMatch) {
      setCachedAuditEvent(directMatch);
      return directMatch;
    }

    // If not matched via search, fetch standard first page (covers recent events)
    const fallbackRes = await listAuditLogs({ page: 1, page_size: 100 });
    const fallbackMatch = fallbackRes.items.find((item) => item.id === id);
    if (fallbackMatch) {
      setCachedAuditEvent(fallbackMatch);
      return fallbackMatch;
    }
  } catch (err) {
    console.error('Error recovering audit event by ID:', err);
  }

  return null;
}

export async function exportAuditLogsCsv(
  params: AuditLogExportParams = {},
): Promise<Blob> {
  const token = getToken();
  const query = new URLSearchParams();
  if (params.action && params.action.trim()) {
    query.set('action', params.action.trim());
  }
  if (params.date_from && params.date_from.trim()) {
    query.set('date_from', params.date_from.trim());
  }
  if (params.date_to && params.date_to.trim()) {
    query.set('date_to', params.date_to.trim());
  }

  const qs = query.toString();
  const endpoint = `/api/superadmin/audit-logs/export${qs ? `?${qs}` : ''}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new SuperAdminApiError(response.status, 'Failed to export audit logs CSV');
  }

  return response.blob();
}

// ── Shared Audit Log Formatters ──

export function formatEventId(id: number | string, occurredAt?: string): string {
  const num = typeof id === 'number' ? id : parseInt(id, 10);
  if (isNaN(num)) return String(id);
  let year = '2026';
  if (occurredAt) {
    try {
      const d = new Date(occurredAt);
      if (!isNaN(d.getTime())) {
        year = String(d.getUTCFullYear());
      }
    } catch {
      // keep fallback
    }
  }
  return `EVT-${year}-${String(num).padStart(5, '0')}`;
}

export function formatUtcTimestamp(isoStr: string | null | undefined): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
  } catch {
    return isoStr;
  }
}

export function parseAuditId(idParam: string): number | null {
  if (!idParam) return null;
  const directNum = Number(idParam);
  if (!isNaN(directNum) && directNum > 0) return directNum;
  const match = idParam.match(/(\d+)$/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return null;
}


