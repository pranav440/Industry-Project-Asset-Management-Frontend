import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuperAdminAuditLogsPage } from '../SuperAdminAuditLogs';
import * as superadminApi from '../../api/superadminApi';
import * as session from '../../auth/session';

vi.mock('../../auth/session', () => ({
  getUser: vi.fn(),
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../../api/superadminApi', () => {
  const actual = vi.importActual('../../api/superadminApi');
  return {
    ...actual,
    listAuditLogs: vi.fn(),
    exportAuditLogsCsv: vi.fn(),
    setCachedAuditEvent: vi.fn(),
    formatEventId: (id: number | string) => `EVT-2026-${String(id).padStart(5, '0')}`,
    formatUtcTimestamp: (iso: string) => `${iso.slice(0, 19).replace('T', ' ')} UTC`,
  };
});

const mockLogs: superadminApi.AuditLogListItem[] = [
  {
    id: 9842,
    action: 'user.status_changed',
    asset_identifier: null,
    consumable_identifier: null,
    request_identifier: null,
    gate_pass_identifier: null,
    actor_user_id: 101,
    occurred_at: '2026-05-24T11:42:15Z',
    before_state: { is_active: true },
    after_state: { is_active: false },
    movement_id: null,
    metadata: { reason: 'suspension' },
  },
  {
    id: 9843,
    action: 'asset_transferred',
    asset_identifier: 'AST-2026-0044',
    consumable_identifier: null,
    request_identifier: 'REQ-2026-0120',
    gate_pass_identifier: 'GP-2026-0091',
    actor_user_id: 102,
    occurred_at: '2026-05-24T12:00:00Z',
    before_state: { location: 'Bldg A' },
    after_state: { location: 'Bldg B' },
    movement_id: 'MOV-0012',
    metadata: { transferred_by: 'Admin' },
  },
];

describe('SuperAdminAuditLogsPage (Page 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      email: 'eleanor.vance@assetmx.internal',
      role: 'superadmin',
    });

    (superadminApi.listAuditLogs as any).mockResolvedValue({
      items: mockLogs,
      total: 48291,
      page: 1,
      page_size: 25,
      total_pages: 1932,
    });

    (superadminApi.exportAuditLogsCsv as any).mockResolvedValue(
      new Blob(['ID,Action\n9842,user.status_changed'], { type: 'text/csv' }),
    );
  });

  it('1. Renders Page 1 header, breadcrumb and 4 KPI summary cards', async () => {
    render(<SuperAdminAuditLogsPage />);

    expect(screen.getByRole('heading', { name: /^Audit & Logs$/i })).toBeDefined();
    expect(screen.getByText('Governance Audit Trail')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Total Audit Events/i)).toBeDefined();
    });

    expect(screen.getByText(/Events Today/i)).toBeDefined();
    expect(screen.getByText(/Administrative Actions/i)).toBeDefined();
    expect(screen.getByText(/Security & Gate Pass Events/i)).toBeDefined();
  });

  it('2. Loads and displays audit records in table with formatted Event IDs and dashes for nulls', async () => {
    render(<SuperAdminAuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('EVT-2026-09842')).toBeDefined();
      expect(screen.getByText('EVT-2026-09843')).toBeDefined();
    });

    expect(screen.getAllByText('user.status_changed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('asset_transferred').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('USR-101')).toBeDefined();
    expect(screen.getByText('USR-102')).toBeDefined();
    expect(screen.getByText('AST-2026-0044')).toBeDefined();

    // Verify nulls are rendered as dashes
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('3. Supports search and action filtering', async () => {
    render(<SuperAdminAuditLogsPage />);

    const searchInput = screen.getByPlaceholderText(/Search by action, asset ID/i);
    fireEvent.change(searchInput, { target: { value: 'AST-2026' } });

    await waitFor(() => {
      expect(superadminApi.listAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'AST-2026',
        }),
      );
    });

    const actionSelect = screen.getByDisplayValue('All Actions');
    fireEvent.change(actionSelect, { target: { value: 'asset_transferred' } });

    await waitFor(() => {
      expect(superadminApi.listAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'asset_transferred',
        }),
      );
    });
  });

  it('4. Clears filters when Clear button is clicked', async () => {
    render(<SuperAdminAuditLogsPage />);

    const searchInput = screen.getByPlaceholderText(/Search by action, asset ID/i);
    fireEvent.change(searchInput, { target: { value: 'test-query' } });

    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearBtn);

    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('5. Clicks "View Details" to cache event and navigate to /superadmin/audit-logs/:id', async () => {
    const onNavigate = vi.fn();
    render(<SuperAdminAuditLogsPage onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('EVT-2026-09842')).toBeDefined();
    });

    const viewDetailsBtns = screen.getAllByRole('button', { name: /View Details/i });
    fireEvent.click(viewDetailsBtns[0]);

    expect(superadminApi.setCachedAuditEvent).toHaveBeenCalledWith(mockLogs[0]);
    expect(onNavigate).toHaveBeenCalledWith('superadmin/audit-logs/9842');
  });

  it('6. Triggers CSV export when Export CSV button is clicked', async () => {
    // Mock URL object methods
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(<SuperAdminAuditLogsPage />);

    const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(superadminApi.exportAuditLogsCsv).toHaveBeenCalled();
      expect(createObjectURLMock).toHaveBeenCalled();
    });
  });

  it('7. Displays empty state when no records match', async () => {
    (superadminApi.listAuditLogs as any).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 25,
      total_pages: 1,
    });

    render(<SuperAdminAuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No audit records found/i)).toBeDefined();
    });
  });

  it('8. Displays error state with retry button on failure', async () => {
    (superadminApi.listAuditLogs as any).mockRejectedValue(new Error('Network timeout'));

    render(<SuperAdminAuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load audit logs/i)).toBeDefined();
      expect(screen.getByText('Network timeout')).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeDefined();
  });
});
