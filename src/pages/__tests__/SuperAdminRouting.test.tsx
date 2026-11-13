import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import * as session from '../../auth/session';
import * as authApi from '../../api/auth';

vi.mock('../../auth/session', () => ({
  getToken: vi.fn(),
  getUser: vi.fn(),
  getTokenExpiry: vi.fn().mockReturnValue(null),
  replaceUser: vi.fn(),
  clearSession: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('../../api/auth', () => ({
  fetchCurrentUser: vi.fn(),
}));

vi.mock('../../api/superadminApi', () => ({
  listUsers: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    total_pages: 1,
  }),
  getSuperAdminAnalytics: vi.fn().mockResolvedValue({
    total_users: 0,
    active_users: 0,
    users_by_role: {},
  }),
  listAuditLogs: vi.fn().mockResolvedValue({
    items: [
      {
        id: 9842,
        action: 'user.status_changed',
        asset_identifier: null,
        consumable_identifier: null,
        request_identifier: null,
        gate_pass_identifier: null,
        actor_user_id: 1,
        occurred_at: '2026-05-24T11:42:15Z',
        before_state: null,
        after_state: null,
        movement_id: null,
        metadata: null,
      },
    ],
    total: 1,
    page: 1,
    page_size: 25,
    total_pages: 1,
  }),
  getCachedAuditEvent: vi.fn().mockReturnValue({
    id: 9842,
    action: 'user.status_changed',
    asset_identifier: null,
    consumable_identifier: null,
    request_identifier: null,
    gate_pass_identifier: null,
    actor_user_id: 1,
    occurred_at: '2026-05-24T11:42:15Z',
    before_state: null,
    after_state: null,
    movement_id: null,
    metadata: null,
  }),
  fetchAuditEventById: vi.fn().mockResolvedValue({
    id: 9842,
    action: 'user.status_changed',
    asset_identifier: null,
    consumable_identifier: null,
    request_identifier: null,
    gate_pass_identifier: null,
    actor_user_id: 1,
    occurred_at: '2026-05-24T11:42:15Z',
    before_state: null,
    after_state: null,
    movement_id: null,
    metadata: null,
  }),
  setCachedAuditEvent: vi.fn(),
  formatEventId: (id: number | string) => `EVT-2026-${String(id).padStart(5, '0')}`,
  formatUtcTimestamp: (iso: string) => `${iso} UTC`,
  parseAuditId: () => 9842,
  exportAuditLogsCsv: vi.fn().mockResolvedValue(new Blob([])),
  getSystemConfig: vi.fn().mockResolvedValue({
    configs: [],
  }),
  updateSystemConfig: vi.fn().mockResolvedValue({
    configs: [],
  }),
}));

describe('SuperAdmin Route Protection and Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (session.getToken as any).mockReturnValue('valid-token');
  });

  it('1. SuperAdmin user can access /superadmin/users directly', async () => {
    window.history.pushState({}, '', '/superadmin/users');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /User & Role Management/i })).toBeDefined();
    });
  });

  it('2. Regular admin navigating to /superadmin/users is redirected to /dashboard', async () => {
    window.history.pushState({}, '', '/superadmin/users');
    (session.getUser as any).mockReturnValue({
      id: 2,
      full_name: 'Regular Admin',
      role: 'admin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 2,
      full_name: 'Regular Admin',
      role: 'admin',
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('3. Host user navigating to /superadmin/users is redirected to /dashboard', async () => {
    window.history.pushState({}, '', '/superadmin/users');
    (session.getUser as any).mockReturnValue({
      id: 3,
      full_name: 'Host User',
      role: 'host',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 3,
      full_name: 'Host User',
      role: 'host',
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('4. Guard user navigating to /superadmin/users is redirected to /dashboard', async () => {
    window.history.pushState({}, '', '/superadmin/users');
    (session.getUser as any).mockReturnValue({
      id: 4,
      full_name: 'Guard User',
      role: 'guard',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 4,
      full_name: 'Guard User',
      role: 'guard',
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('5. Employee user navigating to /superadmin/users is redirected to /dashboard', async () => {
    window.history.pushState({}, '', '/superadmin/users');
    (session.getUser as any).mockReturnValue({
      id: 5,
      full_name: 'Employee User',
      role: 'employee',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 5,
      full_name: 'Employee User',
      role: 'employee',
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('6. SuperAdmin user can access /superadmin/audit-logs directly', async () => {
    window.history.pushState({}, '', '/superadmin/audit-logs');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Audit & Logs$/i })).toBeDefined();
    });
  });

  it('7. SuperAdmin user can access /superadmin/audit-logs/:id directly', async () => {
    window.history.pushState({}, '', '/superadmin/audit-logs/9842');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Audit Event Details/i })).toBeDefined();
    });
  });

  it('8. Non-superadmin user navigating to /superadmin/audit-logs is redirected to /dashboard', async () => {
    window.history.pushState({}, '', '/superadmin/audit-logs');
    (session.getUser as any).mockReturnValue({
      id: 2,
      full_name: 'Regular Admin',
      role: 'admin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 2,
      full_name: 'Regular Admin',
      role: 'admin',
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('9. Non-superadmin user navigating to /superadmin/audit-logs/:id is redirected to /dashboard', async () => {
    window.history.pushState({}, '', '/superadmin/audit-logs/9842');
    (session.getUser as any).mockReturnValue({
      id: 5,
      full_name: 'Employee User',
      role: 'employee',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 5,
      full_name: 'Employee User',
      role: 'employee',
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('10. SuperAdmin user can access /superadmin/config directly', async () => {
    window.history.pushState({}, '', '/superadmin/config');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^System Configuration$/i })).toBeDefined();
    });
  });

  it('11. SuperAdmin user can access /superadmin/analytics directly', async () => {
    window.history.pushState({}, '', '/superadmin/analytics');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Platform Analytics$/i })).toBeDefined();
    });
  });

  it('12. Non-superadmin user navigating to /superadmin/config is redirected to /dashboard', async () => {
    window.history.pushState({}, '', '/superadmin/config');
    (session.getUser as any).mockReturnValue({
      id: 2,
      full_name: 'Regular Admin',
      role: 'admin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 2,
      full_name: 'Regular Admin',
      role: 'admin',
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('13. Non-superadmin user navigating to /superadmin/analytics is redirected to /dashboard', async () => {
    window.history.pushState({}, '', '/superadmin/analytics');
    (session.getUser as any).mockReturnValue({
      id: 3,
      full_name: 'Host User',
      role: 'host',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 3,
      full_name: 'Host User',
      role: 'host',
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });
});
