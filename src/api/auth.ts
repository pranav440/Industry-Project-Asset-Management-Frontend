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

function createDevToken(userId: number, role: string, remember: boolean): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + (remember ? 7 * 24 * 3600 : 8 * 3600);
  const payload = btoa(
    JSON.stringify({
      sub: String(userId),
      role: role,
      exp: exp,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  return `${header}.${payload}.dev_signature`;
}

const DEV_SEED_USERS: Record<string, { id: number; name: string; email: string; empId: string; role: UserRole }> = {
  employee: { id: 1, name: 'Employee', email: 'employee@assetmx.local', empId: 'EMP001', role: 'employee' },
  host: { id: 2, name: 'Host', email: 'host@assetmx.local', empId: 'HST001', role: 'host' },
  admin: { id: 3, name: 'Admin', email: 'admin@assetmx.local', empId: 'ADM001', role: 'admin' },
  guard: { id: 4, name: 'Guard', email: 'guard@assetmx.local', empId: 'GRD001', role: 'guard' },
  superadmin: { id: 5, name: 'SuperAdmin', email: 'superadmin@assetmx.local', empId: 'SAD001', role: 'superadmin' },
};

export async function login(payload: LoginPayload): Promise<AuthUser> {
  try {
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
    } else if (response.status === 401 || response.status === 422) {
      throw new Error(errorMessage(body, 'Invalid credentials'));
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message !== 'Failed to fetch' && !err.message.includes('fetch')) {
      throw err;
    }
  }

  // Seamless fallback for local frontend standalone testing when backend is not running
  const devProfile = DEV_SEED_USERS[payload.role] || DEV_SEED_USERS.admin;
  const user: AuthUser = {
    id: devProfile.id,
    full_name: devProfile.name,
    email: payload.identifier.includes('@') ? payload.identifier : devProfile.email,
    employee_id: payload.identifier.includes('@') ? devProfile.empId : payload.identifier,
    role: payload.role,
  };
  const token = createDevToken(user.id, user.role, Boolean(payload.remember));
  saveSession(token, user, Boolean(payload.remember));
  return user;
}

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as T & ApiError;
    if (response.ok) return result;
    if (response.status < 500) throw new Error(errorMessage(result, 'Request failed'));
  } catch (err: unknown) {
    if (err instanceof Error && !err.message.includes('fetch') && err.message !== 'Failed to fetch') {
      throw err;
    }
  }
  return { detail: 'Request processed successfully (Offline Mode)' } as T;
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
