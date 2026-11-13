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

vi.mock('../HostMovementActivity', () => ({
  HostMovementActivityPage: () => (
    <div data-testid="movement-activity-page">
      Movement Activity Console
    </div>
  ),
}));

vi.mock('../AssetMaintenance', () => ({
  default: (props: any) => (
    <div data-testid="asset-maintenance-page" data-asset-id={props.assetId}>
      Asset Maintenance Console ({props.assetId})
    </div>
  ),
}));

vi.mock('../HostDashboard', () => ({
  HostDashboardPage: () => (
    <div data-testid="host-dashboard-page">Host Dashboard</div>
  ),
}));

vi.mock('../HostGatePasses', () => ({
  HostGatePassesPage: () => (
    <div data-testid="host-gate-passes-page">Host Gate Passes</div>
  ),
}));

vi.mock('../Assets', () => ({
  default: () => <div data-testid="admin-assets-page">Admin Assets</div>,
}));

vi.mock('../Consumables', () => ({
  default: () => <div data-testid="admin-consumables-page">Admin Consumables</div>,
}));

vi.mock('../ReportsOverview', () => ({
  default: () => <div data-testid="admin-reports-page">Admin Reports</div>,
}));

describe('Admin & Host Routing Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (session.getToken as any).mockReturnValue('valid-admin-token');
    (session.getTokenExpiry as any).mockReturnValue(null);
  });

  it('1. Admin user on /movement renders Movement Activity page without falling back to login', async () => {
    window.history.pushState({}, '', '/movement');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Admin Vance',
      role: 'admin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Admin Vance',
      role: 'admin',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('movement-activity-page')).toBeDefined();
    });
  });

  it('2. Admin user on /maintenance renders working Asset Maintenance page', async () => {
    window.history.pushState({}, '', '/maintenance');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Admin Vance',
      role: 'admin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Admin Vance',
      role: 'admin',
    });

    render(<App />);

    await waitFor(() => {
      const el = screen.getByTestId('asset-maintenance-page');
      expect(el).toBeDefined();
      expect(el.getAttribute('data-asset-id')).toBe('AST-NC-2026-0012');
    });
  });

  it('3. Host user can access authorized screens: Dashboard, Gate Passes, and Movement Activity', async () => {
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

    // 3a. Host Dashboard
    window.history.pushState({}, '', '/dashboard');
    const { unmount } = render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('host-dashboard-page')).toBeDefined();
    });
    unmount();

    // 3b. Host Gate Passes
    window.history.pushState({}, '', '/gate-pass');
    const { unmount: unmount2 } = render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('host-gate-passes-page')).toBeDefined();
    });
    unmount2();

    // 3c. Host Movement Activity
    window.history.pushState({}, '', '/movement');
    const { unmount: unmount3 } = render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('movement-activity-page')).toBeDefined();
    });
    unmount3();
  });

  it('4. Host user entering unauthorized Admin routes is redirected to /dashboard', async () => {
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

    // Attempt direct URL to /assets
    window.history.pushState({}, '', '/assets');
    const { unmount } = render(<App />);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
      expect(screen.getByTestId('host-dashboard-page')).toBeDefined();
      expect(screen.queryByTestId('admin-assets-page')).toBeNull();
    });
    unmount();

    // Attempt direct URL to /consumables
    window.history.pushState({}, '', '/consumables');
    const { unmount: unmount2 } = render(<App />);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
      expect(screen.getByTestId('host-dashboard-page')).toBeDefined();
      expect(screen.queryByTestId('admin-consumables-page')).toBeNull();
    });
    unmount2();

    // Attempt direct URL to /reports
    window.history.pushState({}, '', '/reports');
    const { unmount: unmount3 } = render(<App />);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
      expect(screen.getByTestId('host-dashboard-page')).toBeDefined();
      expect(screen.queryByTestId('admin-reports-page')).toBeNull();
    });
    unmount3();
  });
});
