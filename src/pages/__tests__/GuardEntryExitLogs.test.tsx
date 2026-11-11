import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuardEntryExitLogsPage } from '../GuardEntryExitLogs';
import * as guardLogsApi from '../../api/guardLogsApi';
import type { GuardMovementLogRecord, GuardLogsKpis } from '../../data/guardLogsData';

vi.mock('../../auth/session', () => ({
  getUser: vi.fn().mockReturnValue({
    id: 1,
    name: 'Guard Officer Vance',
    email: 'guard@assetmx.local',
    role: 'guard',
  }),
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../../api/guardLogsApi', () => ({
  fetchGuardMovementLogs: vi.fn(),
  fetchAllGuardMovementLogsForExport: vi.fn(),
  GuardLogsApiError: class GuardLogsApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const mockRecords: GuardMovementLogRecord[] = [
  {
    id: 'GPH-2026-0001',
    passId: 'GP-2026-0422',
    assetId: 'AST-2024-0042',
    assetName: 'Cisco Catalyst 9300 Switch',
    serialNumber: 'CS-9300-8801',
    category: 'Physical Movement',
    direction: 'Outward',
    directionLabel: 'Outward / Exit',
    requesterName: 'Elena Rostova',
    requesterBadge: 'ENG-9042',
    department: 'Hardware Engineering',
    date: '2026-05-24',
    dateDisplay: 'May 24, 2026',
    timeDisplay: '13:42:15 UTC',
    status: 'Cleared',
    guardName: 'Guard Officer Vance',
    guardBadge: 'SEC-8812',
    checkpoint: 'Gate-01A',
    checkpointFull: 'Gate-01A (Outbound Barrier)',
    approvingAdmin: 'Marcus Kane (Tech Ops Principal)',
    custodian: 'Elena Rostova (ENG-9042)',
    carrierVehicle: 'Viktor Chen • Van #04',
    manifestHash: 'Standard Manifest (No Hash Stored)',
    tamperSealId: 'N/A (Untracked)',
    inspectedQty: 1,
    expectedQty: 1,
    hasDiscrepancy: false,
    discrepancyStatusTitle: 'None detected / Clean Pass',
    discrepancyDetails: 'All physical serial numbers and custody manifest credentials verified at checkpoint.',
    guardRemarks: 'Physical hardware tags verified against outward manifest.',
    checklist: [],
    timeline: [
      {
        time: '13:42:15 UTC',
        title: 'Exit Verification',
        desc: 'Asset cleared at outbound gate',
        completed: true,
      },
    ],
  },
  {
    id: 'GPH-2026-0002',
    passId: 'GP-2026-0425',
    assetId: 'AST-2024-0099',
    assetName: 'Dell PowerEdge R750',
    serialNumber: 'DP-750-9901',
    category: 'Security Escalation',
    direction: 'N/A',
    directionLabel: 'Escalation Hold',
    requesterName: 'Marcus Vance',
    requesterBadge: 'SEC-8812',
    department: 'Security',
    date: '2026-05-24',
    dateDisplay: 'May 24, 2026',
    timeDisplay: '14:10:00 UTC',
    status: 'Flagged',
    guardName: 'Guard Officer Vance',
    guardBadge: 'SEC-8812',
    checkpoint: 'Gate-02',
    checkpointFull: 'Gate-02 (Inbound Intake)',
    approvingAdmin: 'Authorized by System',
    custodian: 'Marcus Vance (Security)',
    carrierVehicle: 'Marcus Vance • Courier Van',
    manifestHash: 'Standard Manifest (No Hash Stored)',
    tamperSealId: 'N/A (Untracked)',
    inspectedQty: 1,
    expectedQty: 1,
    hasDiscrepancy: true,
    discrepancyStatusTitle: 'Flagged Checkpoint Discrepancy',
    discrepancyDetails: 'Serial mismatch detected at lane barrier',
    guardRemarks: 'Escalated at checkpoint due to missing custody credential.',
    checklist: [],
    timeline: [
      {
        time: '14:10:00 UTC',
        title: 'Escalated',
        desc: 'Serial mismatch detected at lane barrier',
        completed: true,
      },
    ],
  },
  {
    id: 'GPH-2026-0003',
    passId: 'GP-2026-0499',
    assetId: 'AST-2024-0100',
    assetName: 'Core Switch Fiber Module',
    serialNumber: 'CF-100-22',
    category: 'Administrative',
    direction: 'N/A',
    directionLabel: 'Administrative',
    requesterName: 'Sarah Connor',
    requesterBadge: 'OPS-1102',
    department: 'Operations',
    date: '2026-05-24',
    dateDisplay: 'May 24, 2026',
    timeDisplay: '15:00:00 UTC',
    status: 'Pending',
    guardName: 'Guard Officer Vance',
    guardBadge: 'SEC-8812',
    checkpoint: 'Gate-01A',
    checkpointFull: 'Gate-01A (Security Console)',
    approvingAdmin: 'Pending Admin Review',
    custodian: 'Sarah Connor',
    carrierVehicle: 'Internal Transfer',
    manifestHash: 'Standard Manifest (No Hash Stored)',
    tamperSealId: 'N/A (Untracked)',
    inspectedQty: 1,
    expectedQty: 1,
    hasDiscrepancy: false,
    discrepancyStatusTitle: 'Pending Approval',
    discrepancyDetails: 'Administrative gate pass entry created',
    guardRemarks: 'Created pass request',
    checklist: [],
    timeline: [
      {
        time: '15:00:00 UTC',
        title: 'Gate Pass Created',
        desc: 'Created pass request',
        completed: true,
      },
    ],
  },
];

const mockKpis: GuardLogsKpis = {
  totalRecords: {
    total: 3,
    subtext: 'All recorded activity',
  },
  totalMovements: {
    total: 1,
    badgeText: 'Filter Scope',
    subtext: 'Across verified perimeter checkpoints',
  },
  inboundEntries: {
    total: 0,
    subtext: 'Dock receiving & internal intake',
  },
  outboundExits: {
    total: 1,
    subtext: 'Field transit & authorized dispatches',
  },
  flaggedMovements: {
    total: 1,
    badgeText: 'Audit Hold',
    subtext: 'Movement records with discrepancies or holds',
  },
};

const mockApiResponse: guardLogsApi.GuardLogsApiResponse = {
  items: mockRecords,
  total: 3,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  kpis: mockKpis,
};

describe('GuardEntryExitLogsPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays ledger records', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    // Renders screen
    expect(screen.getByTestId('guard-logs-screen')).toBeDefined();

    // Shows loading indicator initially
    expect(screen.getByTestId('guard-logs-loading')).toBeDefined();

    // Waits for table data to render
    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    expect(screen.getAllByText('Cisco Catalyst 9300 Switch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dell PowerEdge R750').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Elena Rostova').length).toBeGreaterThan(0);
  });

  it('renders 4 KPI summary cards with backend metric values', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('guard-logs-kpis')).toBeDefined();
    });

    expect(screen.getByText('Total Movements')).toBeDefined();
    expect(screen.getByText('Inbound Entries')).toBeDefined();
    expect(screen.getByText('Outbound Exits')).toBeDefined();
    expect(screen.getByText('Flagged Movements')).toBeDefined();
  });

  it('updates the Movement Audit Details drawer when selecting a row', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    // Drawer is open with GP-2026-0422
    expect(screen.getByTestId('guard-logs-audit-drawer')).toBeDefined();
    expect(screen.getAllByText('GP-2026-0422').length).toBeGreaterThan(0);

    // Click on row for GP-2026-0425
    fireEvent.click(screen.getByTestId('log-row-GP-2026-0425'));

    // Drawer should update to GP-2026-0425
    await waitFor(() => {
      expect(screen.getAllByText('GP-2026-0425').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Serial mismatch detected at lane barrier')).toBeDefined();
  });

  it('applies search filter and sends search query to the API', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    const searchInput = screen.getByTestId('guard-logs-search-input');
    fireEvent.change(searchInput, { target: { value: 'Elena' } });

    const applyBtn = screen.getByTestId('guard-logs-apply-btn');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(guardLogsApi.fetchGuardMovementLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Elena',
          page: 1,
        })
      );
    });
  });

  it('applies direction filter and status filter to the API', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    const dirSelect = screen.getByTestId('filter-direction');
    fireEvent.change(dirSelect, { target: { value: 'Inward' } });

    const statusSelect = screen.getByTestId('filter-status');
    fireEvent.change(statusSelect, { target: { value: 'Flagged' } });

    fireEvent.click(screen.getByTestId('guard-logs-apply-btn'));

    await waitFor(() => {
      expect(guardLogsApi.fetchGuardMovementLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'Inward',
          status: 'Flagged',
          page: 1,
        })
      );
    });
  });

  it('resets filters and restores full ledger view', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    const resetBtn = screen.getByTestId('guard-logs-reset-btn');
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(guardLogsApi.fetchGuardMovementLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '',
          fromDate: '',
          toDate: '',
          direction: 'All',
          status: 'All',
          page: 1,
        })
      );
    });
  });

  it('displays empty state when no movement logs match', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      kpis: {
        totalMovements: { total: 0, badgeText: '', subtext: '' },
        inboundEntries: { total: 0, subtext: '' },
        outboundExits: { total: 0, subtext: '' },
        flaggedMovements: { total: 0, badgeText: '', subtext: '' },
      },
    });

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('guard-logs-empty-state')).toBeDefined();
    });

    expect(screen.getByText('No movement logs match the selected filter criteria.')).toBeDefined();
  });

  it('displays error banner with retry button on API failure and retries successfully', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs)
      .mockRejectedValueOnce(new Error('Network error connecting to ledger'))
      .mockResolvedValueOnce(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('guard-logs-error-banner')).toBeDefined();
    });

    expect(screen.getByText(/Network error connecting to ledger/)).toBeDefined();

    const retryBtn = screen.getByTestId('guard-logs-retry-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });
  });

  it('handles CSV export action with complete multi-page export semantics', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);
    vi.mocked(guardLogsApi.fetchAllGuardMovementLogsForExport).mockResolvedValue(mockRecords);

    // Mock window.URL / link click
    const clickMock = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = clickMock;
      }
      return el;
    });

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    const exportBtn = screen.getByTestId('guard-logs-export-btn');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(guardLogsApi.fetchAllGuardMovementLogsForExport).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
    });
  });

  it('correctly renders event classification pills for physical movements, escalations, and administrative events', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    // Check classification badges
    expect(screen.getAllByText('OUTWARD').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ESCALATION').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ADMIN').length).toBeGreaterThan(0);
  });

  it('displays honest perimeter inspection checklist notice without fabricated checkmarks', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    // Verify honest checklist notice is displayed
    expect(screen.getByTestId('guard-logs-checklist-notice')).toBeDefined();
    expect(
      screen.getByText(/Individual physical inspection checklist tick-boxes are not persisted in backend audit logs/)
    ).toBeDefined();
  });

  it('opens Gate Pass Audit Record Details modal without cryptographic/blockchain claims', async () => {
    vi.mocked(guardLogsApi.fetchGuardMovementLogs).mockResolvedValue(mockApiResponse);

    render(<GuardEntryExitLogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-GP-2026-0422')).toBeDefined();
    });

    const auditBtn = screen.getByTestId('btn-audit-details');
    expect(auditBtn).toBeDefined();
    fireEvent.click(auditBtn);

    await waitFor(() => {
      expect(screen.getByTestId('audit-details-modal')).toBeDefined();
    });

    expect(screen.getByText('Gate Pass Audit Record Details')).toBeDefined();
    expect(screen.getByText(/Relational Table: gate_pass_history \(Database Audited\)/)).toBeDefined();
    expect(screen.getByText(/None \(Standard Database-Audited Gate Pass\)/)).toBeDefined();
  });
});
