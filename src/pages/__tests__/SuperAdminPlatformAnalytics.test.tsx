import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuperAdminPlatformAnalyticsPage } from '../SuperAdminPlatformAnalytics';
import * as superadminApi from '../../api/superadminApi';
import * as session from '../../auth/session';

vi.mock('../../auth/session', () => ({
  getUser: vi.fn(),
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../../api/superadminApi', () => ({
  getSuperAdminAnalytics: vi.fn(),
}));

const mockAnalytics: superadminApi.SuperAdminAnalyticsResponse = {
  total_users: 1280,
  active_users: 1194,
  users_by_role: {
    employee: 1100,
    host: 60,
    admin: 45,
    guard: 70,
    superadmin: 5,
  },
  total_assets: 4620,
  assets_in_service: 3978,
  total_consumables: 480,
  low_stock_consumables: 18,
  total_requests: 1450,
  open_requests: 124,
  fulfilled_requests: 1326,
  fulfillment_rate_percent: 91.4,
  average_approval_cycle_hours: 18.4,
  total_gate_passes: 840,
  active_gate_passes: 92,
  overdue_gate_passes: 6,
  total_audit_events: 48291,
};

describe('SuperAdminPlatformAnalyticsPage (Module B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });

    (superadminApi.getSuperAdminAnalytics as any).mockResolvedValue(mockAnalytics);
  });

  it('1. Fetches and renders all 5 top KPI aggregate metric cards', async () => {
    render(<SuperAdminPlatformAnalyticsPage />);

    expect(screen.getByRole('heading', { name: /^Platform Analytics$/i })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('1,280')).toBeDefined(); // Total users
      expect(screen.getByText('4,620')).toBeDefined(); // Total assets
      expect(screen.getByText('1,450')).toBeDefined(); // Total requests
      expect(screen.getAllByText('840').length).toBeGreaterThanOrEqual(1); // Total gate passes
      expect(screen.getAllByText('48,291').length).toBeGreaterThanOrEqual(1); // Audit events
    });
  });

  it('2. Correctly renders exactly 5 canonical roles and workforce distribution table', async () => {
    render(<SuperAdminPlatformAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Employee')).toBeDefined();
      expect(screen.getByText('Host')).toBeDefined();
      expect(screen.getByText('Admin')).toBeDefined();
      expect(screen.getByText('Guard')).toBeDefined();
      expect(screen.getByText('SuperAdmin')).toBeDefined();
    });

    // Check access domains
    expect(screen.getByText('Workforce Portal')).toBeDefined();
    expect(screen.getByText('Visitor & Perimeter Movement')).toBeDefined();
    expect(screen.getByText('Asset & Requisition Control')).toBeDefined();
    expect(screen.getByText('Physical Checkpoint Security')).toBeDefined();
    expect(screen.getByText('Governance & System Administration')).toBeDefined();

    // Check counts
    expect(screen.getByText('1,100')).toBeDefined();
    expect(screen.getByText('60')).toBeDefined();
  });

  it('3. Renders Request Processing & Fulfillment metrics', async () => {
    render(<SuperAdminPlatformAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('91.4%')).toBeDefined();
      expect(screen.getByText('18.4 hrs')).toBeDefined();
      expect(screen.getByText('1,326')).toBeDefined();
      expect(screen.getByText('124')).toBeDefined();
    });
  });

  it('4. Renders Gate Pass analytics including active and overdue counts', async () => {
    render(<SuperAdminPlatformAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('92')).toBeDefined(); // Active passes
      expect(screen.getByText('6')).toBeDefined(); // Overdue flag
    });
  });

  it('5. Handles zero and missing values safely without NaN or broken UI', async () => {
    (superadminApi.getSuperAdminAnalytics as any).mockResolvedValue({
      total_users: 0,
      active_users: 0,
      users_by_role: {},
      total_assets: 0,
      assets_in_service: 0,
      total_consumables: 0,
      low_stock_consumables: 0,
      total_requests: 0,
      open_requests: 0,
      fulfilled_requests: 0,
      fulfillment_rate_percent: 0,
      average_approval_cycle_hours: 0,
      total_gate_passes: 0,
      active_gate_passes: 0,
      overdue_gate_passes: 0,
      total_audit_events: 0,
    });

    render(<SuperAdminPlatformAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/0\.0%/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('0.0 hrs')).toBeDefined();
    });
  });

  it('6. Refresh Telemetry button re-fetches analytics data', async () => {
    render(<SuperAdminPlatformAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('1,280')).toBeDefined();
    });

    const refreshBtn = screen.getByRole('button', { name: /Refresh Telemetry/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(superadminApi.getSuperAdminAnalytics).toHaveBeenCalledTimes(2);
    });
  });

  it('7. Displays error state with retry button on API failure', async () => {
    (superadminApi.getSuperAdminAnalytics as any).mockRejectedValue(
      new Error('Failed to fetch platform metrics'),
    );

    render(<SuperAdminPlatformAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load analytics/i)).toBeDefined();
      expect(screen.getByText('Failed to fetch platform metrics')).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeDefined();
  });
});
