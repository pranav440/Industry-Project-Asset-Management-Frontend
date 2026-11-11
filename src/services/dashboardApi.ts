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
  department_consumption: { departments?: any[]; total?: string } | null;
  recent_pos: any[] | null;
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

export interface EmployeeConsumptionCategoryMetric {
  name: string;
  category_key: string;
  categoryKey: string;
  units: number;
  percentage: number;
  color_class: string;
  colorClass: string;
  color: string;
}

export interface EmployeeConsumptionSummary {
  period: string;
  cycle_reference: string;
  cycleReference: string;
  total_issued: number;
  totalIssued: number;
  active_categories_count: number;
  activeCategoriesCount: number;
  distinct_categories_count: number;
  distinctCategoriesCount: number;
  categories: EmployeeConsumptionCategoryMetric[];
}

export interface EmployeeConsumableIssueItem {
  id: string;
  issue_id: string;
  item_name: string;
  itemName: string;
  specification: string;
  category: string;
  category_key: string;
  categoryKey: string;
  quantity_issued: number;
  quantityIssued: number;
  fulfillment_date: string;
  fulfillmentDate: string;
  raw_date: string;
  rawDate: string;
  related_request_id: string;
  relatedRequestId: string;
  status: string;
  reference: string;
  icon: string;
  is_current_month: boolean;
  isCurrentMonth: boolean;
}

export interface EmployeeDashboardSummaryMetrics {
  open_requests: number;
  openRequests: number;
  awaiting_approval: number;
  awaitingApproval: number;
  closed_requests: number;
  closedRequests: number;
  total_requests: number;
  totalRequests: number;
  assigned_assets_count: number;
  assignedAssetsCount: number;
  assets_in_maintenance_count: number;
  assetsInMaintenanceCount: number;
  consumables_received: number;
  consumablesReceived: number;
}

export interface EmployeeDashboardApiResponse {
  summary: EmployeeDashboardSummaryMetrics;
  open_requests: number;
  openRequests: number;
  awaiting_approval: number;
  awaitingApproval: number;
  assigned_assets_count: number;
  assignedAssetsCount: number;
  assets_in_maintenance_count: number;
  assetsInMaintenanceCount: number;
  consumables_received: number;
  consumablesReceived: number;
  recent_requests: any[];
  recentRequests: any[];
  assigned_assets: any[];
  assignedAssets: any[];
  consumption: EmployeeConsumptionSummary;
  consumption_summary: EmployeeConsumptionSummary;
  consumptionSummary: EmployeeConsumptionSummary;
  recent_consumable_issues: EmployeeConsumableIssueItem[];
  recentConsumableIssues: EmployeeConsumableIssueItem[];
}

export function getEmployeeDashboard(): Promise<EmployeeDashboardApiResponse> {
  return request<EmployeeDashboardApiResponse>('/api/dashboard/employee');
}

export interface HostKpiActiveGatePasses {
  total: number;
  outbound: number;
  inboundScheduled: number;
  inbound_scheduled?: number;
  badgeText: string;
  badge_text?: string;
}

export interface HostKpiPendingActions {
  total: number;
  subtext: string;
  badgeText: string;
  badge_text?: string;
}

export interface HostKpiMovement {
  total: number;
  completed: number;
  inTransit: number;
  in_transit?: number;
  trend: string;
}

export interface HostKpiEscalated {
  total: number;
  subtext: string;
  badgeText: string;
  badge_text?: string;
}

export interface HostDashboardKpis {
  activeGatePasses: HostKpiActiveGatePasses;
  active_gate_passes?: HostKpiActiveGatePasses;
  pendingHostActions: HostKpiPendingActions;
  pending_host_actions?: HostKpiPendingActions;
  todaysMovement: HostKpiMovement;
  todays_movement?: HostKpiMovement;
  escalatedGatePasses: HostKpiEscalated;
  escalated_gate_passes?: HostKpiEscalated;
}

export interface HostGatePassActivityItem {
  id: string;
  passId?: string;
  pass_id?: string;
  passType: string;
  pass_type?: string;
  assetName: string;
  asset_name?: string;
  serialNumber: string;
  serial_number?: string;
  requesterName: string;
  requester_name?: string;
  department: string;
  schedule: string;
  status: string;
  destination?: string | null;
  gateLocation?: string | null;
  gate_location?: string | null;
}

export interface HostMovementScanItem {
  id: string;
  movementId?: string;
  movement_id?: string;
  status: string;
  assetTag: string;
  asset_tag?: string;
  assetName: string;
  asset_name?: string;
  route: string;
  station: string;
  timeAgo: string;
  time_ago?: string;
  initiated_at?: string | null;
}

export interface HostPendingActionItem {
  id: string;
  passId: string;
  pass_id?: string;
  title: string;
  requester: string;
  actionText: string;
  action_text?: string;
  actionType: 'verify' | 'inspect' | 'carrier' | string;
  action_type?: string;
  icon: string;
  isPrimary: boolean;
  is_primary?: boolean;
  buttonText: string;
  button_text?: string;
  assetName: string;
  asset_name?: string;
  serialNumber: string;
  serial_number?: string;
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
  time_ago?: string;
  severity: 'critical' | 'info' | 'warning' | string;
  icon: string;
  dotColor: string;
  dot_color?: string;
}

export interface HostDashboardResponse {
  kpis: HostDashboardKpis;
  summary?: HostDashboardKpis;
  activeGatePasses?: HostKpiActiveGatePasses;
  active_gate_passes?: HostKpiActiveGatePasses;
  pendingHostActions?: HostKpiPendingActions;
  pending_host_actions?: HostKpiPendingActions;
  todaysMovement?: HostKpiMovement;
  todays_movement?: HostKpiMovement;
  escalatedGatePasses?: HostKpiEscalated;
  escalated_gate_passes?: HostKpiEscalated;
  gatePassActivity: HostGatePassActivityItem[];
  gate_pass_activity?: HostGatePassActivityItem[];
  movementOverview: HostMovementScanItem[];
  movement_overview?: HostMovementScanItem[];
  pendingActions: HostPendingActionItem[];
  pending_actions?: HostPendingActionItem[];
  operationalAlerts: HostOperationalAlertItem[];
  operational_alerts?: HostOperationalAlertItem[];
}

export interface HostMovementListResponse {
  items: HostMovementScanItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface HostAlertListResponse {
  items: HostOperationalAlertItem[];
  total: number;
}

export function getHostDashboard(): Promise<HostDashboardResponse> {
  return request<HostDashboardResponse>('/api/dashboard/host');
}

export function getHostMovements(params: {
  search?: string;
  status?: string;
  date?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<HostMovementListResponse> {
  const query = new URLSearchParams();
  Object.entries({
    search: params.search,
    status: params.status,
    date: params.date,
    page: params.page,
    page_size: params.pageSize,
  }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const queryString = query.toString();
  return request<HostMovementListResponse>(`/api/dashboard/host/movements${queryString ? `?${queryString}` : ''}`);
}

export function getHostAlerts(): Promise<HostAlertListResponse> {
  return request<HostAlertListResponse>('/api/dashboard/host/alerts');
}

