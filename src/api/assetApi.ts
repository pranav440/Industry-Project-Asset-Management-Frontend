import { getToken } from '../auth/session';

export interface NewAssetPayload {
  name: string;
  category: string;
  specification?: string;
  location: string;
  custodian: string;
  purchaseDate: string;
  vendorName: string;
  totalCost: string;
  warrantyPeriod: string;
  invoiceReference?: string;
  documents?: {
    invoiceFileName?: string;
    warrantyFileName?: string;
    photoFileName?: string;
    otherFiles?: string[];
  };
}

export type AssetStatus = 'Active' | 'In Maintenance' | 'Disposed' | 'In Transit';

export interface MaintenanceHistoryApiRecord {
  id: string;
  date: string;
  serviceEvent: string;
  vendor: string;
  cost: string;
  status: 'Completed' | 'Scheduled' | 'In Progress';
}

export interface AuditLogApiRecord {
  id: number;
  action: string;
  asset_identifier: string;
  actor_user_id: number;
  occurred_at: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  movement_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AssetRecord {
  asset_id: string;
  name: string;
  status: AssetStatus;
  category: string;
  specification: string | null;
  serial_number: string | null;
  location: string;
  custodian: string;
  purchase_date: string;
  vendor_name: string;
  total_cost: string;
  warranty_period: string;
  invoice_reference: string | null;
  depreciation: string | null;
  allocation_date: string | null;
  documents: Record<string, unknown> | null;
  qr_code_value: string;
  qr_code_data_url: string;
  movement_history: AssetMovementRecord[];
  maintenance_history: MaintenanceHistoryApiRecord[];
  audit_history: AuditLogApiRecord[];
}

export interface AssetListResponse {
  items: AssetRecord[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface AssetMovementRecord {
  movement_id: string;
  from_location: string;
  to_location: string;
  from_custodian: string;
  to_custodian: string;
  reason: string | null;
  status: 'Initiated' | 'In Transit' | 'Completed' | 'Cancelled';
  initiated_by_user_id: number;
  initiated_at: string;
  completed_at: string | null;
}

export interface AssetTransferResponse {
  movement: AssetMovementRecord;
  asset: AssetRecord;
}

export interface MaintenanceApiRecord {
  maintenance_id: string;
  asset_id: string;
  service_date: string;
  maintenance_type: 'Preventive' | 'Corrective';
  service_vendor: string;
  technician: string | null;
  maintenance_cost: number;
  status: 'Completed';
  service_notes: string | null;
  created_at: string;
  created_by: string;
}

export type ConsumableStockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type ConsumableOperationType =
  | 'Initial Inward / Batch Receipt'
  | 'Stock Adjustment / Correction'
  | 'Disbursement / Issue';

export interface ConsumableMovementApiRecord {
  movement_id: string;
  timestamp: string;
  operation_type: ConsumableOperationType;
  delta_quantity: number;
  post_balance: number;
  reference: string;
  created_by: string;
}

export interface ConsumableIssueApiRecord {
  issue_id: string;
  issue_date: string;
  quantity: number;
  request_reference: string | null;
  issued_by: string;
  remaining_stock: number;
}

export interface ConsumableApiRecord {
  consumable_id: string;
  name: string;
  category: string;
  batch_id: string;
  location: string;
  available_stock: number;
  threshold: number;
  batch_quantity: number;
  expiry_date: string | null;
  stock_status: ConsumableStockStatus;
  issue_history: ConsumableIssueApiRecord[];
  movement_ledger: ConsumableMovementApiRecord[];
}

export interface ConsumableListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: ConsumableApiRecord[];
}

export class AssetApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AssetApiError';
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
    throw new AssetApiError(response.status, detail || `Asset request failed (${response.status})`);
  }
  return body as T;
}

export function listAssets(params: {
  location?: string;
  custodian?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<AssetListResponse> {
  const query = new URLSearchParams();
  Object.entries({ ...params, page_size: params.pageSize }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return request<AssetListResponse>(`/api/assets?${query.toString()}`);
}

export function getAsset(assetId: string): Promise<AssetRecord> {
  return request<AssetRecord>(`/api/assets/${encodeURIComponent(assetId)}`);
}

export function listConsumables(params: {
  search?: string;
  category?: string;
  status?: string;
  expiry?: string;
  location?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ConsumableListResponse> {
  const query = new URLSearchParams();
  Object.entries({ ...params, page_size: params.pageSize }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return request<ConsumableListResponse>(`/api/consumables?${query.toString()}`);
}

export function getConsumable(consumableId: string): Promise<ConsumableApiRecord> {
  return request<ConsumableApiRecord>(`/api/consumables/${encodeURIComponent(consumableId)}`);
}

export function createConsumable(payload: {
  name: string;
  category: string;
  batch_id: string;
  location: string;
  initial_stock: number;
  threshold: number;
  expiry_date?: string;
}): Promise<ConsumableApiRecord> {
  return request<ConsumableApiRecord>('/api/consumables', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateConsumable(consumableId: string, payload: {
  name?: string;
  category?: string;
  location?: string;
  threshold?: number;
  batch_id?: string;
  expiry_date?: string | null;
}): Promise<ConsumableApiRecord> {
  return request<ConsumableApiRecord>(`/api/consumables/${encodeURIComponent(consumableId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function updateConsumableStock(consumableId: string, payload: {
  operation_type: Exclude<ConsumableOperationType, 'Disbursement / Issue'>;
  delta_quantity: number;
  reference?: string;
}): Promise<ConsumableApiRecord> {
  return request<ConsumableApiRecord>(`/api/consumables/${encodeURIComponent(consumableId)}/stock`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function issueConsumable(consumableId: string, payload: {
  quantity: number;
  request_reference?: string;
}): Promise<ConsumableApiRecord> {
  return request<ConsumableApiRecord>(`/api/consumables/${encodeURIComponent(consumableId)}/issue`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function initiateTransfer(
  assetId: string,
  payload: {
    destination_location: string;
    new_custodian: string;
    transfer_reason?: string | null;
  },
): Promise<AssetTransferResponse> {
  return request<AssetTransferResponse>(`/api/assets/${encodeURIComponent(assetId)}/transfer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMaintenance(assetId: string): Promise<MaintenanceApiRecord[]> {
  return request<MaintenanceApiRecord[]>(`/api/assets/${encodeURIComponent(assetId)}/maintenance`);
}

export function createMaintenance(
  assetId: string,
  payload: {
    service_date: string;
    maintenance_type: 'Preventive' | 'Corrective';
    service_vendor: string;
    technician?: string;
    maintenance_cost: number;
    service_notes?: string;
  },
): Promise<MaintenanceApiRecord> {
  return request<MaintenanceApiRecord>(`/api/assets/${encodeURIComponent(assetId)}/maintenance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function registerNewAsset(payload: NewAssetPayload): Promise<AssetRecord> {
  return request<AssetRecord>('/api/assets', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      category: payload.category,
      specification: payload.specification,
      location: payload.location,
      custodian: payload.custodian,
      purchase_date: payload.purchaseDate,
      vendor_name: payload.vendorName,
      total_cost: payload.totalCost,
      warranty_period: payload.warrantyPeriod,
      invoice_reference: payload.invoiceReference,
      documents: payload.documents,
    }),
  });
}

export function updateAsset(assetId: string, payload: Partial<NewAssetPayload> & { status?: AssetStatus }): Promise<AssetRecord> {
  const normalizedPayload: Record<string, unknown> = {};

  if (payload.name !== undefined) normalizedPayload.name = payload.name;
  if (payload.status !== undefined) normalizedPayload.status = payload.status;
  if (payload.category !== undefined) normalizedPayload.category = payload.category;
  if (payload.specification !== undefined) normalizedPayload.specification = payload.specification;
  if (payload.location !== undefined) normalizedPayload.location = payload.location;
  if (payload.custodian !== undefined) normalizedPayload.custodian = payload.custodian;
  if (payload.purchaseDate !== undefined) normalizedPayload.purchase_date = payload.purchaseDate;
  if (payload.vendorName !== undefined) normalizedPayload.vendor_name = payload.vendorName;
  if (payload.totalCost !== undefined) normalizedPayload.total_cost = payload.totalCost;
  if (payload.warrantyPeriod !== undefined) normalizedPayload.warranty_period = payload.warrantyPeriod;
  if (payload.invoiceReference !== undefined) normalizedPayload.invoice_reference = payload.invoiceReference;
  if (payload.documents !== undefined) normalizedPayload.documents = payload.documents;

  return request<AssetRecord>(`/api/assets/${encodeURIComponent(assetId)}`, {
    method: 'PUT',
    body: JSON.stringify(normalizedPayload),
  });
}
