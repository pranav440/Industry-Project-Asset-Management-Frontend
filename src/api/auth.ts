import { saveSession, type AuthUser, type UserRole } from '../auth/session';

export type LoginPayload = {
  role: UserRole;
  identifier: string;
  password: string;
  remember?: boolean;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
};

type ApiError = {
  detail?: string | { msg: string }[];
};

function errorMessage(body: ApiError, fallback: string): string {
  if (typeof body.detail === 'string') {
    return body.detail;
  }
  if (Array.isArray(body.detail) && body.detail[0]?.msg) {
    return body.detail[0].msg;
  }
  return fallback;
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: payload.role,
      identifier: payload.identifier,
      password: payload.password,
      remember: Boolean(payload.remember),
    }),
  });

  const body = (await response.json().catch(() => ({}))) as LoginResponse & ApiError;

  if (response.ok) {
    saveSession(body.access_token, body.user, Boolean(payload.remember));
    return body.user;
  }

  throw new Error(errorMessage(body, response.status === 401 || response.status === 422 ? 'Invalid credentials' : 'Unable to log in.'));
}

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as T & ApiError;

  if (response.ok) return result;
  throw new Error(errorMessage(result, 'Authentication request failed.'));
}

export function requestPasswordReset(identifier: string) {
  return postAuth<{ detail: string }>('password-reset/request', { identifier });
}

export function confirmPasswordReset(token: string, password: string) {
  return postAuth<{ detail: string }>('password-reset/confirm', { token, password });
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  try {
    const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    const body = (await response.json().catch(() => ({}))) as AuthUser & ApiError;
    if (response.ok) return body;
  } catch {
    // Backend offline fallback: return existing session user
  }
  const { getUser } = await import('../auth/session');
  const user = getUser();
  if (user) return user;
  throw new Error('No active session');
}
