import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardPage } from '../Dashboard';
import * as dashboardApi from '../../services/dashboardApi';

vi.mock('../../auth/session', () => ({
  getUser: vi.fn().mockReturnValue({
    id: 1,
    full_name: 'System Administrator',
    email: 'admin@assetmx.local',
    employee_id: 'ADM001',
    role: 'admin',
  }),
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../../services/dashboardApi', () => ({
  getAdminDashboard: vi.fn(),
  DashboardApiError: class DashboardApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'DashboardApiError';
    }
  },
}));

const mockDashboardData: dashboardApi.DashboardApiResponse = {
  summary: {
    open_requests: 12,
    pending_approvals: 4,
    low_stock_alerts: 6,
    monthly_spend: null,
    budget_utilized: null,
  },
  asset_inventory: {
    total_assets: 42,
    by_status: {
      Active: 30,
      'In Maintenance': 8,
      'In Transit': 4,
      Disposed: 0,
    },
  },
  my_requests: [
    {
      request_id: 'REQ-2026-0001',
      requested_item: 'MacBook Pro 16',
      status: 'In Review',
      request_date: '2026-10-01',
      approval_date: '2026-10-02T10:00:00',
      fulfillment_date: null,
    },
    {
      request_id: 'REQ-2026-0002',
      requested_item: 'Wireless Mouse',
      status: 'Fulfilled',
      request_date: '2026-09-15',
      approval_date: '2026-09-16T11:00:00',
      fulfillment_date: '2026-09-18T14:30:00',
    },
    {
      request_id: 'REQ-2026-0003',
      requested_item: 'Ergonomic Chair',
      status: 'Rejected',
      request_date: '2026-09-20',
      approval_date: null,
      fulfillment_date: null,
    },
  ],
  expiry_alerts: [
    {
      item_id: 'CON-001',
      name: 'Printer Cartridge Cyan',
      expiry_date: '2026-11-15',
      severity: 'urgent',
      days_remaining: 4,
    },
    {
      item_id: 'CON-002',
      name: 'First Aid Antiseptic',
      expiry_date: '2026-12-20',
      severity: 'upcoming',
      days_remaining: 39,
    },
  ],
  stock_levels: [
    {
      category: 'IT Peripherals',
      available_stock: 45,
      threshold: 50,
      status: 'Low Stock',
    },
    {
      category: 'Office Supplies',
      available_stock: 120,
      threshold: 30,
      status: 'In Stock',
    },
  ],
  department_consumption: null,
  recent_pos: null,
};

describe('Admin DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays live KPI cards and data', async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    expect(screen.getByText('Loading dashboard data...')).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByText('Loading dashboard data...')).toBeNull();
    });

    // Check Live KPIs
    expect(screen.getByText('Open Requests')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();

    expect(screen.getByText('Pending Approvals')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();

    expect(screen.getByText('Low Stock Alerts')).toBeDefined();
    expect(screen.getByText('6')).toBeDefined();

    // Check Unsupported Financial Metrics: explicitly represented as Not Configured
    expect(screen.getByText('Monthly Spend')).toBeDefined();
    expect(screen.getByText('Procurement spend unconfigured')).toBeDefined();

    expect(screen.getByText('Budget Utilized')).toBeDefined();
    expect(screen.getByText('Budget tracking unconfigured')).toBeDefined();

    const notConfiguredElements = screen.getAllByText('Not Configured');
    expect(notConfiguredElements.length).toBeGreaterThanOrEqual(2);
  });

  it('displays asset inventory, expiry alerts, and stock levels accurately', async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Asset Inventory')).toBeDefined();
    });

    // Asset Inventory
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('Active: 30')).toBeDefined();
    expect(screen.getByText('Maintenance: 8')).toBeDefined();
    expect(screen.getByText('In Transit: 4')).toBeDefined();

    // Expiry Alerts
    expect(screen.getByText('Printer Cartridge Cyan')).toBeDefined();
    expect(screen.getByText('Exp: 2026-11-15')).toBeDefined();
    expect(screen.getByText('First Aid Antiseptic')).toBeDefined();

    // Stock Levels
    expect(screen.getByText('IT Peripherals')).toBeDefined();
    expect(screen.getByText('45/50')).toBeDefined();
    expect(screen.getByText('Office Supplies')).toBeDefined();
    expect(screen.getByText('120/30')).toBeDefined();
  });

  it('explicitly represents unconfigured Recent POs and Department Consumption widgets', async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent POs')).toBeDefined();
    });

    // Honest PO unconfigured message
    expect(screen.getByText('Purchase order procurement is not configured in AssetMX.')).toBeDefined();

    // Honest Department consumption telemetry unconfigured message
    expect(screen.getByText('Department consumption telemetry is not configured in AssetMX.')).toBeDefined();
  });

  it('renders requests table and filters by tab correctly', async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16')).toBeDefined();
    });

    // Default tab is "Open"
    expect(screen.getByText('REQ-2026-0001')).toBeDefined();
    // Fulfilled / Rejected are closed, so they should not appear on Open tab
    expect(screen.queryByText('REQ-2026-0002')).toBeNull();
    expect(screen.queryByText('REQ-2026-0003')).toBeNull();

    // Switch to Closed tab
    const closedTab = screen.getByRole('tab', { name: /Closed/i });
    fireEvent.click(closedTab);

    expect(screen.queryByText('REQ-2026-0001')).toBeNull();
    expect(screen.getByText('REQ-2026-0002')).toBeDefined();
    expect(screen.getByText('REQ-2026-0003')).toBeDefined();

    // Switch to All tab
    const allTab = screen.getByRole('tab', { name: /All/i });
    fireEvent.click(allTab);

    expect(screen.getByText('REQ-2026-0001')).toBeDefined();
    expect(screen.getByText('REQ-2026-0002')).toBeDefined();
    expect(screen.getByText('REQ-2026-0003')).toBeDefined();
  });

  it('triggers quick navigation routes when clicking action links', async () => {
    const handleNavigate = vi.fn();
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue(mockDashboardData);

    render(<DashboardPage onNavigate={handleNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16')).toBeDefined();
    });

    // Click request row to open request details
    fireEvent.click(screen.getByText('REQ-2026-0001'));
    expect(handleNavigate).toHaveBeenCalledWith('requests/REQ-2026-0001');

    // Click View All on Requests
    const viewAllRequestsBtn = screen.getByRole('button', { name: /View all requests/i });
    fireEvent.click(viewAllRequestsBtn);
    expect(handleNavigate).toHaveBeenCalledWith('requests');

    // Click Reports card
    const reportsBtn = screen.getByRole('button', { name: /View All Analytics/i });
    fireEvent.click(reportsBtn);
    expect(handleNavigate).toHaveBeenCalledWith('reports');

    // Click Manage Stock on Stock Levels
    const manageStockBtn = screen.getByRole('button', { name: /Manage consumable stock levels/i });
    fireEvent.click(manageStockBtn);
    expect(handleNavigate).toHaveBeenCalledWith('consumables');
  });

  it('performs real CSV report export on clicking Export button', async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue(mockDashboardData);

    // Mock URL methods and link click
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeDefined();
    });

    const exportBtn = screen.getByRole('button', { name: /Export/i });
    fireEvent.click(exportBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(screen.getByText('Admin dashboard report exported to CSV.')).toBeDefined();
  });

  it('handles 403 Forbidden error with appropriate messaging and allows retry', async () => {
    const forbiddenError = new dashboardApi.DashboardApiError(403, 'Admin role required');
    vi.mocked(dashboardApi.getAdminDashboard).mockRejectedValueOnce(forbiddenError);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('This dashboard is restricted to administrators.')).toBeDefined();
    });

    // Mock successful recovery on retry
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValueOnce(mockDashboardData);

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Overview')).toBeDefined();
      expect(screen.getByText('Open Requests')).toBeDefined();
    });
  });

  it('handles empty database response cleanly', async () => {
    const emptyDashboard: dashboardApi.DashboardApiResponse = {
      summary: {
        open_requests: 0,
        pending_approvals: 0,
        low_stock_alerts: 0,
        monthly_spend: null,
        budget_utilized: null,
      },
      asset_inventory: {
        total_assets: 0,
        by_status: { Active: 0, 'In Maintenance': 0, 'In Transit': 0, Disposed: 0 },
      },
      my_requests: [],
      expiry_alerts: [],
      stock_levels: [],
      department_consumption: null,
      recent_pos: null,
    };
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue(emptyDashboard);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Overview')).toBeDefined();
    });

    // Empty alerts and stocks messages
    expect(screen.getByText('No critical expiry alerts at this time.')).toBeDefined();
    expect(screen.getByText('No inventory stock data available.')).toBeDefined();
    expect(screen.getByText('No requests found for the selected filter.')).toBeDefined();
  });
});
