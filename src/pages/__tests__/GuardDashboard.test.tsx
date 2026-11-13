import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuardDashboardPage } from '../GuardDashboard';
import * as guardDashboardApi from '../../api/guardDashboardApi';

vi.mock('../../auth/session', () => ({
  getUser: vi.fn().mockReturnValue({
    id: 1,
    name: 'Guard Officer',
    email: 'guard@assetmx.local',
    role: 'guard',
  }),
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../../api/guardDashboardApi', () => ({
  fetchGuardDashboard: vi.fn(),
  GuardDashboardApiError: class GuardDashboardApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const mockDashboardData: guardDashboardApi.GuardDashboardApiResponse = {
  kpis: {
    expectedInbound: {
      total: 3,
      badgeText: '3 awaiting return',
      subtext: 'Active returnable passes',
    },
    expectedOutbound: {
      total: 7,
      badgeText: '7 pending clearance',
      subtext: 'Authorized dispatches',
    },
    pendingVerification: {
      total: 10,
      badgeText: 'Priority Action',
      subtext: 'Physical barrier queue',
    },
    todaysCompletedEntries: {
      total: 14,
      badgeText: '14 Cleared',
      subtext: 'Cleared checkpoint logs',
    },
  },
  verificationQueue: [
    {
      id: 'GP-2026-0101',
      requesterName: 'Elena Rostova',
      requesterBadge: 'Engineering',
      department: 'Engineering',
      assetName: 'Cisco Catalyst 9300 Switch',
      serialNumber: 'CS-9300-8801',
      type: 'Outbound',
      status: 'Awaiting Exit',
      action: 'verify',
      carrier: 'Courier A',
      destination: 'Remote Colocation Datacenter',
    },
    {
      id: 'GP-2026-0102',
      requesterName: 'Marcus Kane',
      requesterBadge: 'Facilities',
      department: 'Facilities',
      assetName: 'Fluke Versiv DSX',
      serialNumber: 'FLK-789-PRO',
      type: 'Inbound Return',
      status: 'Awaiting Entry',
      action: 'verify',
      carrier: 'Internal Van',
      destination: 'Equipment Depot',
    },
    {
      id: 'GP-2026-0103',
      requesterName: 'Travis Henderson',
      requesterBadge: 'IT Infrastructure',
      department: 'IT Infrastructure',
      assetName: 'Dell PowerEdge R750xs',
      serialNumber: 'DL-9014',
      type: 'Outbound',
      status: 'Flagged',
      action: 'flagged',
      flagReason: 'Serial mismatch at checkpoint',
    },
    {
      id: 'GP-2026-0104',
      requesterName: 'Sarah Jenkins',
      requesterBadge: 'Operations',
      department: 'Operations',
      assetName: 'Zebra TC21 Scanner',
      serialNumber: 'ZBR-5541',
      type: 'Outbound',
      status: 'Cleared',
      action: 'cleared',
      carrier: 'DHL Express',
      destination: 'Regional Logistics Center',
    },
  ],
  recentActivity: [
    {
      id: 'GPH-001',
      title: 'Record Exit / Cleared',
      time: '10m ago',
      passId: 'GP-2026-0101',
      plateOrBadge: 'Guard Officer',
      assetName: 'Cisco Catalyst 9300 Switch',
      notes: 'Exit clearance verified',
      badgeText: 'Barrier Cleared',
      isFlagged: false,
      type: 'exit',
    },
    {
      id: 'GPH-002',
      title: 'Discrepancy Flagged',
      time: '25m ago',
      passId: 'GP-2026-0103',
      plateOrBadge: 'Guard Officer',
      assetName: 'Dell PowerEdge R750xs',
      notes: 'Tag mismatch flagged',
      badgeText: 'Discrepancy',
      isFlagged: true,
      type: 'flagged',
    },
  ],
  upcomingMovements: [
    {
      id: 'GP-2026-0101',
      time: 'Scheduled',
      title: 'Cisco Catalyst 9300 Switch',
      type: 'Outbound',
      personLabel: 'Requester',
      personName: 'Elena Rostova',
      details: 'Asset Movement • Dest: Remote Colocation Datacenter',
      statusBadge: 'Approved',
    },
  ],
  checkpointAlerts: [
    {
      id: 'ALT-ESC-GP-2026-0103',
      title: 'Gate Pass Discrepancy Flagged: GP-2026-0103',
      severity: 'critical',
      badgeText: 'Critical',
      icon: 'gpp_maybe',
      description: 'Serial mismatch at checkpoint',
      passId: 'GP-2026-0103',
      serialNumber: 'DL-9014',
      acknowledged: false,
    },
  ],
};

describe('GuardDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading indicator initially and loads data successfully', async () => {
    vi.mocked(guardDashboardApi.fetchGuardDashboard).mockResolvedValue(mockDashboardData);

    render(<GuardDashboardPage />);

    expect(screen.getByText('Loading checkpoint operational data...')).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByText('Loading checkpoint operational data...')).toBeNull();
    });

    // Check KPIs
    expect(screen.getByText('Expected Inbound')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('Expected Outbound')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('Pending Gate Verification')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText("Today's Completed Entries")).toBeDefined();
    expect(screen.getByText('14')).toBeDefined();

    // Check Queue Items (using getAllByText because IDs appear in queue & activity)
    expect(screen.getAllByText('GP-2026-0101').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cisco Catalyst 9300 Switch').length).toBeGreaterThan(0);
    expect(screen.getByText('GP-2026-0102')).toBeDefined();
    expect(screen.getByText('Fluke Versiv DSX')).toBeDefined();
    expect(screen.getAllByText('GP-2026-0103').length).toBeGreaterThan(0);
  });

  it('filters queue items using the search input', async () => {
    vi.mocked(guardDashboardApi.fetchGuardDashboard).mockResolvedValue(mockDashboardData);

    render(<GuardDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Fluke Versiv DSX')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Filter pass, asset, badge...');
    fireEvent.change(searchInput, { target: { value: 'Fluke' } });

    expect(screen.getByText('GP-2026-0102')).toBeDefined();
    expect(screen.getByText('Fluke Versiv DSX')).toBeDefined();
    // Non-matching queue items are excluded from table
    expect(screen.queryByText('Marcus Kane')).toBeDefined();
    expect(screen.queryByText('Travis Henderson')).toBeNull();

    // When filter does not match anything
    fireEvent.change(searchInput, { target: { value: 'NonexistentEquipment' } });
    expect(
      screen.getByText('No gate passes matching "NonexistentEquipment".')
    ).toBeDefined();
  });

  it('routes header "Verify Gate Pass" button to /gate-verification', async () => {
    vi.mocked(guardDashboardApi.fetchGuardDashboard).mockResolvedValue(mockDashboardData);
    const onNavigateMock = vi.fn();

    render(<GuardDashboardPage onNavigate={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getAllByText('GP-2026-0101').length).toBeGreaterThan(0);
    });

    const headerVerifyBtn = screen.getByRole('button', { name: /Verify Gate Pass/i });
    fireEvent.click(headerVerifyBtn);

    expect(onNavigateMock).toHaveBeenCalledWith('gate-verification');
  });

  it('routes table row "Verify" button to specific gate-pass verification URL', async () => {
    vi.mocked(guardDashboardApi.fetchGuardDashboard).mockResolvedValue(mockDashboardData);
    const onNavigateMock = vi.fn();

    render(<GuardDashboardPage onNavigate={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getAllByText('GP-2026-0101').length).toBeGreaterThan(0);
    });

    // Find the Verify buttons in the table
    const verifyButtons = screen.getAllByRole('button', { name: 'Verify' });
    fireEvent.click(verifyButtons[0]);

    expect(onNavigateMock).toHaveBeenCalledWith('gate-pass/GP-2026-0101/verification');
  });

  it('routes "View All Gate Passes" link to /gate-pass', async () => {
    vi.mocked(guardDashboardApi.fetchGuardDashboard).mockResolvedValue(mockDashboardData);
    const onNavigateMock = vi.fn();

    render(<GuardDashboardPage onNavigate={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getAllByText('GP-2026-0101').length).toBeGreaterThan(0);
    });

    const viewAllBtn = screen.getByRole('button', { name: /View All Gate Passes/i });
    fireEvent.click(viewAllBtn);

    expect(onNavigateMock).toHaveBeenCalledWith('gate-pass');
  });

  it('renders honest empty states when API returns empty arrays', async () => {
    const emptyData: guardDashboardApi.GuardDashboardApiResponse = {
      kpis: {
        expectedInbound: { total: 0, badgeText: '0 awaiting return', subtext: 'Active returnable passes' },
        expectedOutbound: { total: 0, badgeText: '0 pending clearance', subtext: 'Authorized dispatches' },
        pendingVerification: { total: 0, badgeText: 'Queue Clear', subtext: 'Physical barrier queue' },
        todaysCompletedEntries: { total: 0, badgeText: 'Verified Today', subtext: 'Cleared checkpoint logs' },
      },
      verificationQueue: [],
      recentActivity: [],
      upcomingMovements: [],
      checkpointAlerts: [],
    };
    vi.mocked(guardDashboardApi.fetchGuardDashboard).mockResolvedValue(emptyData);

    render(<GuardDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No gate passes currently in verification queue.')).toBeDefined();
    });

    expect(screen.getByText('No recent checkpoint activity recorded.')).toBeDefined();
    expect(screen.getByText('No upcoming movements scheduled for today.')).toBeDefined();
    expect(screen.getByText('No active security flags or discrepancies.')).toBeDefined();
  });

  it('displays error banner with retry button on API failure and retries successfully', async () => {
    vi.mocked(guardDashboardApi.fetchGuardDashboard)
      .mockRejectedValueOnce(new Error('Network connection timeout'))
      .mockResolvedValueOnce(mockDashboardData);

    render(<GuardDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load dashboard data:/i)).toBeDefined();
      expect(screen.getByText(/Network connection timeout/i)).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Failed to load dashboard data:/i)).toBeNull();
      expect(screen.getAllByText('GP-2026-0101').length).toBeGreaterThan(0);
    });

    expect(guardDashboardApi.fetchGuardDashboard).toHaveBeenCalledTimes(2);
  });

  it('displays correct action labels: Verify for pending, Flagged for flagged, and Cleared for completed passes', async () => {
    vi.mocked(guardDashboardApi.fetchGuardDashboard).mockResolvedValue(mockDashboardData);

    render(<GuardDashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText('GP-2026-0101').length).toBeGreaterThan(0);
    });

    // 1. Eligible pending passes display "Verify" button
    const verifyButtons = screen.getAllByRole('button', { name: 'Verify' });
    expect(verifyButtons.length).toBe(2);

    // 2. Flagged pass displays "Flagged" label with alert styling
    const flaggedLabels = screen.getAllByText('Flagged');
    const flaggedActionPill = flaggedLabels.find((el) => el.closest('.amx-guard-action-onhold'));
    expect(flaggedActionPill).toBeDefined();

    // 3. Completed pass displays "Cleared" label with success styling
    const clearedLabels = screen.getAllByText('Cleared');
    const clearedActionPill = clearedLabels.find((el) => el.closest('.amx-guard-action-completed'));
    expect(clearedActionPill).toBeDefined();

    // 4. Old labels "On Hold" and "Completed" are NOT displayed in action cells
    expect(screen.queryByText('On Hold')).toBeNull();
    const actionCells = document.querySelectorAll('.amx-guard-table td:last-child');
    expect(actionCells.length).toBe(4);
    actionCells.forEach((cell) => {
      expect(cell.textContent).not.toContain('On Hold');
      expect(cell.textContent).not.toContain('Completed');
    });
  });
});
