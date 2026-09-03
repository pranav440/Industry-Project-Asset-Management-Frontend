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

  if (!response.ok) {
    throw new Error(errorMessage(body, 'Sign in failed'));
  }

  saveSession(body.access_token, body.user, Boolean(payload.remember));
  return body.user;
}
