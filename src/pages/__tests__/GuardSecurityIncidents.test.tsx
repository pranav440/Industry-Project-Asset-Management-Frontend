import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuardSecurityIncidentsPage } from '../GuardSecurityIncidents';
import * as guardEscalationsApi from '../../api/guardEscalationsApi';
import * as gatePassApi from '../../api/gatePassApi';
import type { GuardEscalationRegisterItem, GuardEscalationKpis } from '../../data/guardIncidentsData';

vi.mock('../../auth/session', () => ({
  getUser: vi.fn().mockReturnValue({
    id: 1,
    name: 'Guard Officer Vance',
    email: 'guard@assetmx.local',
    role: 'guard',
  }),
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../../api/guardEscalationsApi', () => ({
  fetchGuardEscalationRegister: vi.fn(),
  fetchAllGuardEscalationsForExport: vi.fn(),
  GuardEscalationApiError: class GuardEscalationApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../../api/gatePassApi', () => ({
  getGatePass: vi.fn(),
  escalateGatePass: vi.fn(),
}));

const mockItems: GuardEscalationRegisterItem[] = [
  {
    id: 'ESC-GP-2026-0001',
    passId: 'GP-2026-0001',
    assetId: 'AST-2024-0042',
    assetName: 'Cisco Catalyst 9300 Switch',
    requesterName: 'Elena Rostova',
    department: 'Hardware Engineering',
    destination: 'Data Center Alpha',
    passType: 'Returnable',
    gatePassStatus: 'Escalated',
    holdStatus: 'Active',
    holdStatusTitle: 'Active Escalation Hold',
    escalationReason: 'Physical serial barcode failed scan match at outbound barrier.',
    actionRequired: 'Physical serial re-verification by Admin',
    escalatedBy: 'Guard Officer Vance',
    escalationTimestamp: '2026-05-24T14:10:00Z',
    dateDisplay: 'May 24, 2026',
    timeDisplay: '14:10:00 UTC',
    checkpoint: 'Gate-01A Main Gate',
    overrideBy: null,
    overrideTimestamp: null,
    overrideNote: null,
    timeline: [
      {
        id: 'EV-1',
        timestamp: '2026-05-24T14:10:00Z',
        event: 'Checkpoint Escalation Hold Engaged',
        actor: 'Guard Officer Vance',
        actorRole: 'Guard Officer',
        note: 'Hold engaged due to serial barcode mismatch.',
      },
    ],
  },
  {
    id: 'ESC-GP-2026-0002',
    passId: 'GP-2026-0002',
    assetId: 'AST-2024-0099',
    assetName: 'Dell PowerEdge R750',
    requesterName: 'Viktor Chen',
    department: 'Infrastructure Ops',
    destination: 'Branch 02 Office',
    passType: 'Outward Only',
    gatePassStatus: 'Approved',
    holdStatus: 'Cleared',
    holdStatusTitle: 'Cleared by Administrative Override',
    escalationReason: 'Carrier credential unverified at intake.',
    actionRequired: 'Admin override granted after phone authorization.',
    escalatedBy: 'Guard Officer Jenkins',
    escalationTimestamp: '2026-05-24T11:20:00Z',
    dateDisplay: 'May 24, 2026',
    timeDisplay: '11:20:00 UTC',
    checkpoint: 'Gate-01A Main Gate',
    overrideBy: 'Admin Kane',
    overrideTimestamp: '2026-05-24T11:35:00Z',
    overrideNote: 'Verified carrier driver license and cleared dispatch.',
    timeline: [
      {
        id: 'EV-2',
        timestamp: '2026-05-24T11:35:00Z',
        event: 'Administrative Override Clearance',
        actor: 'Admin Kane',
        actorRole: 'Security Administrator',
        note: 'Override approved.',
      },
      {
        id: 'EV-1',
        timestamp: '2026-05-24T11:20:00Z',
        event: 'Checkpoint Escalation Hold Engaged',
        actor: 'Guard Officer Jenkins',
        actorRole: 'Guard Officer',
        note: 'Hold engaged.',
      },
    ],
  },
];

const mockKpis: GuardEscalationKpis = {
  totalHolds: 2,
  activeHolds: 1,
  clearedOverridden: 1,
};

const defaultApiResponse = {
  items: mockItems,
  total: 2,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  kpis: mockKpis,
};

describe('GuardSecurityIncidentsPage (Checkpoint Escalation & Discrepancy Register)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardEscalationsApi.fetchGuardEscalationRegister).mockResolvedValue(defaultApiResponse);
  });

  it('renders loading state initially and then displays register table and KPIs', async () => {
    render(<GuardSecurityIncidentsPage />);

    expect(screen.getByTestId('si-loading')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('si-screen')).toBeDefined();
    });

    // Check Header and breadcrumb
    expect(screen.getByText('Checkpoint Escalation & Discrepancy Register')).toBeDefined();
    expect(screen.getByText('CHECKPOINT ESCALATIONS')).toBeDefined();

    // Check KPIs
    expect(screen.getByText('Total Checkpoint Holds')).toBeDefined();
    expect(screen.getByText('Active Escalation Holds')).toBeDefined();
    expect(screen.getAllByText('Cleared by Override').length).toBeGreaterThan(0);

    // Check Table rows
    expect(screen.getByTestId('si-row-GP-2026-0001')).toBeDefined();
    expect(screen.getByTestId('si-row-GP-2026-0002')).toBeDefined();
    expect(screen.getAllByText('Cisco Catalyst 9300 Switch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dell PowerEdge R750').length).toBeGreaterThan(0);
  });

  it('selects first row by default and updates details panel when clicking another row', async () => {
    render(<GuardSecurityIncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('si-details-panel')).toBeDefined();
    });

    // Initial selected record is GP-2026-0001
    const detailsPanel = screen.getByTestId('si-details-panel');
    expect(detailsPanel.textContent).toContain('GP-2026-0001');
    expect(detailsPanel.textContent).toContain('Cisco Catalyst 9300 Switch');
    expect(detailsPanel.textContent).toContain('ACTIVE HOLD');
    expect(detailsPanel.textContent).toContain('Physical serial barcode failed scan match at outbound barrier.');

    // Timeline event is shown
    expect(screen.getByTestId('si-timeline-section').textContent).toContain('Checkpoint Escalation Hold Engaged');
    expect(screen.getByTestId('si-timeline-section').textContent).toContain('Guard Officer Vance');

    // Click second row (GP-2026-0002) which has cleared override
    const row2 = screen.getByTestId('si-row-GP-2026-0002');
    fireEvent.click(row2);

    expect(detailsPanel.textContent).toContain('GP-2026-0002');
    expect(detailsPanel.textContent).toContain('Dell PowerEdge R750');
    expect(detailsPanel.textContent).toContain('CLEARED BY OVERRIDE');

    // Verify Administrative Override Clearance banner is rendered
    expect(screen.getByTestId('si-override-section')).toBeDefined();
    expect(screen.getByTestId('si-override-section').textContent).toContain('Granted by: Admin Kane');
    expect(screen.getByTestId('si-override-section').textContent).toContain('Verified carrier driver license');
  });

  it('handles search, status filter, apply, and reset filters', async () => {
    render(<GuardSecurityIncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('si-search')).toBeDefined();
    });

    // Type search
    const searchInput = screen.getByTestId('si-search');
    fireEvent.change(searchInput, { target: { value: 'Switch' } });

    // Select status filter Active
    const statusSelect = screen.getByTestId('si-filter-status');
    fireEvent.change(statusSelect, { target: { value: 'Active' } });

    // Click Apply Filters
    const applyBtn = screen.getByTestId('si-btn-apply');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(guardEscalationsApi.fetchGuardEscalationRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Switch',
          status: 'Active',
          page: 1,
        })
      );
    });

    // Check active chip displayed
    expect(screen.getByText(/Search: Switch/)).toBeDefined();

    // Click Reset Filters
    const resetBtn = screen.getByTestId('si-btn-reset');
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(guardEscalationsApi.fetchGuardEscalationRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '',
          status: 'All',
          page: 1,
        })
      );
    });
  });

  it('renders error banner on API failure and retries successfully', async () => {
    vi.mocked(guardEscalationsApi.fetchGuardEscalationRegister)
      .mockRejectedValueOnce(new Error('Network connection timeout'))
      .mockResolvedValueOnce(defaultApiResponse);

    render(<GuardSecurityIncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('si-error-banner')).toBeDefined();
    });

    expect(screen.getByText('Network connection timeout')).toBeDefined();

    // Click Retry
    const retryBtn = screen.getByTestId('si-retry-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('si-table')).toBeDefined();
    });
  });

  it('renders empty state when no escalation records match filters', async () => {
    vi.mocked(guardEscalationsApi.fetchGuardEscalationRegister).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      kpis: { totalHolds: 0, activeHolds: 0, clearedOverridden: 0 },
    });

    render(<GuardSecurityIncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('si-empty-state')).toBeDefined();
    });

    expect(screen.getByText('No checkpoint escalations match the current filters.')).toBeDefined();
  });

  it('completes the Escalate Gate Pass workflow with lookup and validation', async () => {
    const mockPass: gatePassApi.GatePass = {
      pass_id: 'GP-2026-9999',
      pass_type: 'Returnable',
      request_date: '2026-05-24',
      status: 'Approved',
      requester_name: 'David Kim',
      department: 'Robotics Lab',
      asset_or_item: 'Workstation ThinkStation P620',
      quantity: 1,
      current_location: 'Lab 1',
      destination: 'Lab 4 Testing Facility',
      movement_date: '2026-05-24',
      purpose: 'Field Testing',
      authorization_state: 'Authorized',
      decision_status: 'Approved',
      decision_date: '2026-05-24T10:00:00Z',
      decision_by: 'Admin Kane',
      exit_status: null,
      exit_timestamp: null,
      exit_gate: null,
      exit_officer: null,
      exit_notes: null,
      entry_status: null,
      entry_timestamp: null,
      entry_gate: null,
      entry_officer: null,
      entry_notes: null,
      escalation_is_escalated: false,
      escalation_reason: null,
      escalation_timestamp: null,
      escalation_action_required: null,
      escalation_escalated_by: null,
      created_at: '2026-05-24T09:00:00Z',
      updated_at: '2026-05-24T10:00:00Z',
      history: [],
    };

    vi.mocked(gatePassApi.getGatePass).mockResolvedValueOnce(mockPass);
    vi.mocked(gatePassApi.escalateGatePass).mockResolvedValueOnce({
      ...mockPass,
      status: 'Escalated',
    });

    render(<GuardSecurityIncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('si-btn-report')).toBeDefined();
    });

    // Open Escalate Gate Pass drawer
    fireEvent.click(screen.getByTestId('si-btn-report'));

    expect(screen.getByTestId('si-drawer')).toBeDefined();
    expect(screen.getAllByText('Escalate Gate Pass').length).toBeGreaterThan(0);

    // Enter pass ID to verify
    const passInput = screen.getByTestId('si-form-pass-id');
    fireEvent.change(passInput, { target: { value: 'gp-2026-9999' } });

    const lookupBtn = screen.getByTestId('si-btn-lookup-pass');
    fireEvent.click(lookupBtn);

    await waitFor(() => {
      expect(gatePassApi.getGatePass).toHaveBeenCalledWith('GP-2026-9999');
    });

    // Pass details card is rendered
    expect(screen.getByTestId('si-loaded-pass-card')).toBeDefined();
    expect(screen.getByText(/Workstation ThinkStation P620/)).toBeDefined();
    expect(screen.getByText(/David Kim/)).toBeDefined();

    // Fill escalation reason
    const reasonTextarea = screen.getByTestId('si-form-reason');
    fireEvent.change(reasonTextarea, {
      target: { value: 'Chassis seal was broken upon visual inspection at gate' },
    });

    // Fill optional action required
    const actionInput = screen.getByTestId('si-form-action-required');
    fireEvent.change(actionInput, { target: { value: 'Physical inspection by SecOps supervisor' } });

    // Submit escalation
    const submitBtn = screen.getByTestId('si-btn-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(gatePassApi.escalateGatePass).toHaveBeenCalledWith('GP-2026-9999', {
        reason: 'Chassis seal was broken upon visual inspection at gate',
        action_required: 'Physical inspection by SecOps supervisor',
      });
    });

    // Verify toast is shown
    await waitFor(() => {
      expect(screen.getByTestId('si-toast').textContent).toContain('GP-2026-9999 escalated successfully');
    });
  });

  it('rejects escalation when Gate Pass is in an ineligible status (e.g. Completed)', async () => {
    const completedPass: gatePassApi.GatePass = {
      pass_id: 'GP-2026-7777',
      pass_type: 'Non-Returnable',
      request_date: '2026-05-20',
      status: 'Completed',
      requester_name: 'Alice',
      department: 'HR',
      asset_or_item: 'Old Monitor',
      quantity: 1,
      current_location: 'Storage',
      destination: 'Disposal',
      movement_date: '2026-05-20',
      purpose: 'Disposal',
      authorization_state: 'Completed',
      decision_status: 'Approved',
      decision_date: '2026-05-20T10:00:00Z',
      decision_by: 'Admin Kane',
      exit_status: 'Verified',
      exit_timestamp: '2026-05-20T11:00:00Z',
      exit_gate: 'Gate-01',
      exit_officer: 'Guard Officer Vance',
      exit_notes: null,
      entry_status: null,
      entry_timestamp: null,
      entry_gate: null,
      entry_officer: null,
      entry_notes: null,
      escalation_is_escalated: false,
      escalation_reason: null,
      escalation_timestamp: null,
      escalation_action_required: null,
      escalation_escalated_by: null,
      created_at: '2026-05-20T09:00:00Z',
      updated_at: '2026-05-20T11:00:00Z',
      history: [],
    };

    vi.mocked(gatePassApi.getGatePass).mockResolvedValueOnce(completedPass);

    render(<GuardSecurityIncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('si-btn-report')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('si-btn-report'));

    const passInput = screen.getByTestId('si-form-pass-id');
    fireEvent.change(passInput, { target: { value: 'GP-2026-7777' } });
    fireEvent.click(screen.getByTestId('si-btn-lookup-pass'));

    await waitFor(() => {
      expect(screen.getByTestId('si-lookup-error')).toBeDefined();
    });

    expect(screen.getByTestId('si-lookup-error').textContent).toContain(
      "Gate Pass is currently in 'Completed' status. Only Pending or Approved Gate Passes can be escalated"
    );

    // Submit button should remain disabled
    const submitBtn = screen.getByTestId('si-btn-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('triggers full multi-page CSV export and displays toast', async () => {
    vi.mocked(guardEscalationsApi.fetchAllGuardEscalationsForExport).mockResolvedValueOnce(mockItems);

    // Mock createObjectURL & revokeObjectURL
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

    render(<GuardSecurityIncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('si-btn-export')).toBeDefined();
    });

    const exportBtn = screen.getByTestId('si-btn-export');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(guardEscalationsApi.fetchAllGuardEscalationsForExport).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    await waitFor(() => {
      expect(screen.getByTestId('si-toast').textContent).toContain('Exported 2 checkpoint escalation records.');
    });
  });
});
