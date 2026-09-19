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
  movement_history: unknown[];
  maintenance_history: unknown[];
  audit_history: unknown[];
}

export interface AssetListResponse {
  items: AssetRecord[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
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
  return request<AssetRecord>(`/api/assets/${encodeURIComponent(assetId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
