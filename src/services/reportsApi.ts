import { getToken } from '../auth/session';

export interface ReportHistoryEntry {
  history_id: string;
  timestamp: string;
  stage: string;
  action: string;
}

export interface ReportRequestHistoryMap {
  [requestId: string]: ReportHistoryEntry[];
}

export interface ReportMovementRecord {
  movement_id: string;
  asset_id: string;
  asset_name: string;
  category: string;
  from_location: string;
  to_location: string;
  from_custodian: string;
  to_custodian: string;
  reason: string | null;
  status: string;
  initiated_at: string | null;
  completed_at: string | null;
}

export interface AdminReportsApiResponse {
  overview: {
    total_assets: number;
    assets_in_use: number;
    open_requests: number;
    maintenance_cost: number;
  };
  asset_utilization: {
    total_assets: number;
    status_counts: Record<string, number>;
    by_category: Record<string, number>;
    by_location: Record<string, number>;
    utilization_rate: number;
  };
  requests: {
    total_requests: number;
    status_counts: Record<string, number>;
    department_counts: Record<string, number>;
    request_type_counts: Record<string, number>;
    priority_counts: Record<string, number>;
    history: ReportRequestHistoryMap;
  };
  reassignment: {
    total_movements: number;
    records: ReportMovementRecord[];
    by_location: Record<string, number>;
  };
  maintenance_vs_asset_value: {
    total_maintenance_cost: number;
    total_asset_value: number;
    maintenance_by_asset: Record<string, number>;
    maintenance_cost_ratio: number;
    asset_value_by_category: Record<string, number>;
    maintenance_cost_by_category: Record<string, number>;
  };
  lifecycle: {
    status_distribution: Record<string, number>;
    disposed_assets: number;
    forecast: null;
    age_summary: {
      average_asset_age_days: number;
    };
  };
  unsupported: {
    monthly_spend: null;
    budget_utilized: null;
    department_consumption: null;
    recent_purchase_orders: null;
    procurement_registry: null;
    wastage: null;
  };
}

export interface ReportsQueryParams {
  date_from?: string;
  date_to?: string;
  location?: string;
  category?: string;
  department?: string;
}

export class ReportsApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ReportsApiError';
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
    throw new ReportsApiError(response.status, detail || `Reports request failed (${response.status})`);
  }

  return body as T;
}

export function getAdminReports(params: ReportsQueryParams = {}): Promise<AdminReportsApiResponse> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return request<AdminReportsApiResponse>(`/api/reports/admin${queryString ? `?${queryString}` : ''}`);
}
