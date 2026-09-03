export type UserRole = 'employee' | 'host' | 'admin' | 'guard' | 'superadmin';

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  employee_id: string;
  role: UserRole;
};

const TOKEN_KEY = 'assetmx_token';
const USER_KEY = 'assetmx_user';
const REMEMBER_KEY = 'assetmx_remember';

export function saveSession(token: string, user: AuthUser, remember: boolean) {
  clearSession();
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, '1');
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function hasSession(): boolean {
  return Boolean(getToken());
}
