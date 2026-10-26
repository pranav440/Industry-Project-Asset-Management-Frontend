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

export interface RequestAttachmentApiRecord {
  attachment_id: string;
  id: string;
  request_id: string;
  original_filename: string;
  name: string;
  content_type: string;
  type: string;
  file_size: number;
  size: string;
  uploaded_at: string;
  uploadDate: string;
  download_url: string;
  preview_url: string;
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
  request_source?: string;
  date_received?: string | null;
  external_reference?: string | null;
  contact_info?: string | null;
  estimated_cost?: string | null;
  procurement_reference?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestApiRecord extends RequestListItemApiRecord {
  history: RequestHistoryApiRecord[];
  attachments: RequestAttachmentApiRecord[];
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

export interface ExternalRequestCreatePayload {
  request_source?: 'External';
  date_received: string;
  external_reference?: string;
  requester_name: string;
  department?: string;
  contact_info?: string;
  requester_email?: string;
  request_type: RequestType;
  requested_item: string;
  category: string;
  quantity: number;
  estimated_cost?: string;
  procurement_reference?: string;
  priority: RequestPriority;
  justification: string;
  processing_guidelines?: string;
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

export function createExternalRequest(
  payload: ExternalRequestCreatePayload,
): Promise<RequestApiRecord> {
  return request<RequestApiRecord>('/api/requests/external', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadRequestAttachment(
  requestId: string,
  file: File,
): Promise<RequestAttachmentApiRecord> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/requests/${encodeURIComponent(requestId)}/attachments`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const body = (await response.json().catch(() => ({}))) as { detail?: string | { msg: string }[] };

  if (!response.ok) {
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
    throw new RequestApiError(response.status, detail || `Attachment upload failed (${response.status})`);
  }

  return body as RequestAttachmentApiRecord;
}

export function listRequestAttachments(requestId: string): Promise<RequestAttachmentApiRecord[]> {
  return request<RequestAttachmentApiRecord[]>(`/api/requests/${encodeURIComponent(requestId)}/attachments`);
}

export async function downloadRequestAttachment(
  requestId: string,
  attachmentId: string,
  fallbackFilename?: string,
): Promise<void> {
  const token = getToken();
  const response = await fetch(
    `/api/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new RequestApiError(response.status, body.detail || `Download failed (${response.status})`);
  }

  const blob = await response.blob();
  let filename = fallbackFilename || 'attachment';
  const disposition = response.headers.get('Content-Disposition');
  if (disposition) {
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch && utfMatch[1]) {
      try {
        filename = decodeURIComponent(utfMatch[1]);
      } catch {}
    } else {
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        filename = match[1];
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function previewRequestAttachment(
  requestId: string,
  attachmentId: string,
): Promise<{ blob: Blob; contentType: string; objectUrl: string; isInline: boolean; filename: string }> {
  const token = getToken();
  const response = await fetch(
    `/api/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}/preview`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new RequestApiError(response.status, body.detail || `Preview failed (${response.status})`);
  }

  const blob = await response.blob();
  const contentType = response.headers.get('Content-Type') || blob.type;
  const disposition = response.headers.get('Content-Disposition') || '';
  const isInline = disposition.startsWith('inline');

  let filename = 'attachment';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch && utfMatch[1]) {
    try {
      filename = decodeURIComponent(utfMatch[1]);
    } catch {}
  } else {
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  return { blob, contentType, objectUrl, isInline, filename };
}
