import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuperAdminAuditDetailsPage } from '../SuperAdminAuditDetails';
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
    getCachedAuditEvent: vi.fn(),
    fetchAuditEventById: vi.fn(),
    parseAuditId: (idParam: string) => {
      const direct = Number(idParam);
      if (!isNaN(direct) && direct > 0) return direct;
      const match = idParam.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : null;
    },
    formatEventId: (id: number | string) => `EVT-2026-${String(id).padStart(5, '0')}`,
    formatUtcTimestamp: (iso: string) => `${iso.slice(0, 19).replace('T', ' ')} UTC`,
  };
});

const mockEvent: superadminApi.AuditLogListItem = {
  id: 9842,
  action: 'user.status_changed',
  asset_identifier: null,
  consumable_identifier: null,
  request_identifier: null,
  gate_pass_identifier: null,
  actor_user_id: 101,
  occurred_at: '2026-05-24T11:42:15Z',
  before_state: {
    account_status: 'ACTIVE',
    session_tokens_revoked: false,
    deactivated_at: null,
  },
  after_state: {
    account_status: 'INACTIVE',
    session_tokens_revoked: true,
    deactivated_at: '2026-05-24T11:42:15Z',
    deactivated_by: 'USR-00101',
    deactivation_reason: 'Administrative suspension pending offboarding',
  },
  movement_id: null,
  metadata: {
    client_origin: 'web',
    session_id: 'sess_9941a8',
    environment: 'production',
  },
};

describe('SuperAdminAuditDetailsPage (Page 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      email: 'eleanor.vance@assetmx.internal',
      role: 'superadmin',
    });
  });

  it('1. Renders event details when available in local cache (instant handoff)', async () => {
    (superadminApi.getCachedAuditEvent as any).mockReturnValue(mockEvent);

    render(<SuperAdminAuditDetailsPage eventId="9842" />);

    expect(screen.getByRole('heading', { name: /Audit Event Details/i })).toBeDefined();
    expect(screen.getByText('EVT-2026-09842')).toBeDefined();
    expect(screen.getByText('user.status_changed')).toBeDefined();
    expect(screen.getByText('USR-101')).toBeDefined();

    // Core Metadata section
    expect(screen.getByText('Core Metadata')).toBeDefined();
    expect(screen.getByText('Actor User ID')).toBeDefined();
    expect(screen.getByText('Asset Identifier')).toBeDefined();

    // Section A, B, C
    expect(screen.getByText('Section A: Before State')).toBeDefined();
    expect(screen.getByText('Section B: After State')).toBeDefined();
    expect(screen.getByText('Section C: Event Metadata')).toBeDefined();

    // Verify JSON contents rendered
    expect(screen.getAllByText(/"account_status"/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/"INACTIVE"/i)).toBeDefined();
    expect(screen.getByText(/"sess_9941a8"/i)).toBeDefined();
  });

  it('2. Direct refresh fallback: recovers event by ID when not in cache', async () => {
    (superadminApi.getCachedAuditEvent as any).mockReturnValue(null);
    (superadminApi.fetchAuditEventById as any).mockResolvedValue(mockEvent);

    render(<SuperAdminAuditDetailsPage eventId="9842" />);

    await waitFor(() => {
      expect(superadminApi.fetchAuditEventById).toHaveBeenCalledWith(9842);
      expect(screen.getByRole('heading', { name: /Audit Event Details/i })).toBeDefined();
    });

    expect(screen.getByText('EVT-2026-09842')).toBeDefined();
  });

  it('3. Handles prefixed event ID string like EVT-2026-09842', async () => {
    (superadminApi.getCachedAuditEvent as any).mockReturnValue(mockEvent);

    render(<SuperAdminAuditDetailsPage eventId="EVT-2026-09842" />);

    expect(superadminApi.getCachedAuditEvent).toHaveBeenCalledWith(9842);
    expect(screen.getByText('EVT-2026-09842')).toBeDefined();
  });

  it('4. Renders clean empty state when before_state, after_state or metadata are null', async () => {
    const minimalEvent: superadminApi.AuditLogListItem = {
      id: 9999,
      action: 'gate_pass_auto_escalated',
      asset_identifier: 'AST-001',
      consumable_identifier: null,
      request_identifier: 'REQ-002',
      gate_pass_identifier: 'GP-003',
      actor_user_id: 1,
      occurred_at: '2026-05-24T12:00:00Z',
      before_state: null,
      after_state: null,
      movement_id: null,
      metadata: null,
    };

    (superadminApi.getCachedAuditEvent as any).mockReturnValue(minimalEvent);

    render(<SuperAdminAuditDetailsPage eventId="9999" />);

    expect(
      screen.getByText(/No prior state recorded for this event/i),
    ).toBeDefined();
    expect(
      screen.getByText(/No subsequent state recorded for this event/i),
    ).toBeDefined();
    expect(
      screen.getByText(/No additional metadata payload attached to this record/i),
    ).toBeDefined();
  });

  it('5. Displays "Audit Event Not Found" card when ID cannot be located', async () => {
    (superadminApi.getCachedAuditEvent as any).mockReturnValue(null);
    (superadminApi.fetchAuditEventById as any).mockResolvedValue(null);

    render(<SuperAdminAuditDetailsPage eventId="999999" />);

    await waitFor(() => {
      expect(screen.getByText(/Audit Event Not Found/i)).toBeDefined();
    });
  });

  it('6. Back to Audit Logs button navigates back to list', async () => {
    (superadminApi.getCachedAuditEvent as any).mockReturnValue(mockEvent);
    const onNavigate = vi.fn();

    render(<SuperAdminAuditDetailsPage eventId="9842" onNavigate={onNavigate} />);

    const backBtn = screen.getByRole('button', { name: /Back to Audit Logs/i });
    fireEvent.click(backBtn);

    expect(onNavigate).toHaveBeenCalledWith('superadmin/audit-logs');
  });
});
