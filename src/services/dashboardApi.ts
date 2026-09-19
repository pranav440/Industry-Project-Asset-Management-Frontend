import { getToken } from '../auth/session';

export interface DashboardSummary {
  open_requests: number;
  pending_approvals: number;
  low_stock_alerts: number;
  monthly_spend: number | null;
  budget_utilized: number | null;
}

export interface DashboardRequestItem {
  request_id: string;
  requested_item: string;
  status: 'Pending' | 'In Review' | 'Fulfilled' | 'Rejected';
  request_date: string;
  approval_date: string | null;
  fulfillment_date: string | null;
}

export interface DashboardExpiryAlert {
  item_id: string;
  name: string;
  expiry_date: string;
  severity: 'urgent' | 'upcoming';
  days_remaining: number;
}

export interface DashboardStockLevel {
  category: string;
  available_stock: number;
  threshold: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface DashboardApiResponse {
  summary: DashboardSummary;
  asset_inventory: {
    total_assets: number;
    by_status: Record<string, number>;
  };
  my_requests: DashboardRequestItem[];
  expiry_alerts: DashboardExpiryAlert[];
  stock_levels: DashboardStockLevel[];
  department_consumption: null;
  recent_pos: null;
}

export class DashboardApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'DashboardApiError';
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

  const body = (await response.json().catch(() => ({}))) as { detail?: string | { msg: string }[] };

  if (!response.ok) {
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
    throw new DashboardApiError(response.status, detail || `Dashboard request failed (${response.status})`);
  }

  return body as T;
}

export function getAdminDashboard(): Promise<DashboardApiResponse> {
  return request<DashboardApiResponse>('/api/dashboard/admin');
}
