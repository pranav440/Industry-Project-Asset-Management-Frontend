import { getToken } from '../auth/session';

export type RequestType = 'Asset Request' | 'Consumable Request';
export type RequestStatus = 'Pending' | 'In Review' | 'Fulfilled' | 'Rejected';
export type RequestPriority = 'High' | 'Medium' | 'Low';

export interface RequestHistoryApiRecord {
  history_id: string;
  timestamp: string;
  stage: RequestStatus;
  action: string;
  performed_by: string;
  note: string | null;
}

export interface RequestListItemApiRecord {
  request_id: string;
  requester_name: string;
  requester_email: string;
  department: string;
  request_type: RequestType;
  requested_item: string;
  category: string;
  quantity: number;
  priority: RequestPriority;
  request_date: string;
  status: RequestStatus;
  justification: string;
  processing_guidelines: string;
  created_at: string;
  updated_at: string;
}

export interface RequestApiRecord extends RequestListItemApiRecord {
  history: RequestHistoryApiRecord[];
}

export interface RequestListResponse {
  items: RequestListItemApiRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface RequestTransitionPayload {
  target_status: RequestStatus;
  operational_note?: string;
}

export class RequestApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'RequestApiError';
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
    throw new RequestApiError(response.status, detail || `Request failed (${response.status})`);
  }

  return body as T;
}

export function listRequests(params: {
  search?: string;
  requestType?: string;
  status?: string;
  priority?: string;
  department?: string;
  requestDate?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<RequestListResponse> {
  const query = new URLSearchParams();

  Object.entries({
    search: params.search,
    request_type: params.requestType,
    status: params.status,
    priority: params.priority,
    department: params.department,
    request_date: params.requestDate,
    page: params.page,
    page_size: params.pageSize,
  }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  return request<RequestListResponse>(`/api/requests?${query.toString()}`);
}

export function getRequest(requestId: string): Promise<RequestApiRecord> {
  return request<RequestApiRecord>(`/api/requests/${encodeURIComponent(requestId)}`);
}

export function transitionRequest(
  requestId: string,
  payload: RequestTransitionPayload,
): Promise<RequestApiRecord> {
  return request<RequestApiRecord>(`/api/requests/${encodeURIComponent(requestId)}/transition`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
