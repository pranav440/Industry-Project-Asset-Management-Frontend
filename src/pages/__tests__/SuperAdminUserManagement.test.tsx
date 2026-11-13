import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuperAdminUserManagementPage } from '../SuperAdminUserManagement';
import * as superadminApi from '../../api/superadminApi';
import * as session from '../../auth/session';

describe('SuperAdminUserManagementPage', () => {
  const mockCurrentUser: session.AuthUser = {
    id: 1,
    full_name: 'Eleanor Vance',
    email: 'eleanor.vance@assetmx.internal',
    employee_id: 'EMP-0001',
    role: 'superadmin',
  };

  const mockUsers: superadminApi.SuperAdminUserRecord[] = [
    {
      id: 1,
      full_name: 'Eleanor Vance',
      email: 'eleanor.vance@assetmx.internal',
      employee_id: 'EMP-0001',
      role: 'superadmin',
      department: 'IT & Security Governance',
      department_id: 5,
      is_active: true,
    },
    {
      id: 2,
      full_name: 'Marcus Vance',
      email: 'marcus.vance@assetmx.internal',
      employee_id: 'EMP-8812',
      role: 'guard',
      department: 'Physical Security',
      department_id: 3,
      is_active: true,
    },
    {
      id: 3,
      full_name: 'Elena Rostova',
      email: 'elena.rostova@assetmx.internal',
      employee_id: 'EMP-9042',
      role: 'admin',
      department: 'Operations & Asset Control',
      department_id: 2,
      is_active: true,
    },
    {
      id: 4,
      full_name: 'David Santos',
      email: 'david.santos@assetmx.internal',
      employee_id: 'EMP-7703',
      role: 'host',
      department: 'Facilities & Logistics',
      department_id: 4,
      is_active: true,
    },
    {
      id: 5,
      full_name: 'Sarah Jenkins',
      email: 'sarah.jenkins@assetmx.internal',
      employee_id: 'EMP-4419',
      role: 'employee',
      department: 'Product Engineering',
      department_id: 1,
      is_active: false,
    },
  ];

  const mockAnalytics: superadminApi.SuperAdminAnalyticsResponse = {
    total_users: 5,
    active_users: 4,
    users_by_role: {
      superadmin: 1,
      guard: 1,
      admin: 1,
      host: 1,
      employee: 1,
    },
    total_assets: 10,
    assets_in_service: 8,
    total_consumables: 15,
    low_stock_consumables: 2,
    total_requests: 20,
    open_requests: 5,
    fulfilled_requests: 15,
    fulfillment_rate_percent: 75.0,
    average_approval_cycle_hours: 12.0,
    total_gate_passes: 8,
    active_gate_passes: 2,
    overdue_gate_passes: 0,
    total_audit_events: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(session, 'getUser').mockReturnValue(mockCurrentUser);
    vi.spyOn(superadminApi, 'listUsers').mockResolvedValue({
      items: mockUsers,
      total: 5,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
    vi.spyOn(superadminApi, 'getSuperAdminAnalytics').mockResolvedValue(mockAnalytics);
  });

  it('renders page header, KPI cards, filter controls and user directory table', async () => {
    render(<SuperAdminUserManagementPage />);

    // Header
    const heading = await screen.findByRole('heading', { name: /User & Role Management/i });
    expect(heading).toBeDefined();
    expect(screen.getAllByText(/Platform Administration/i).length).toBeGreaterThanOrEqual(1);

    // 4 Dynamic KPI Cards
    expect(screen.getByText('Total Users')).toBeDefined();
    expect(screen.getByText('Active Users')).toBeDefined();
    expect(screen.getByText('Inactive Users')).toBeDefined();
    expect(screen.getByText('SuperAdmin Accounts')).toBeDefined();

    // KPI values
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1); // Total users
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1); // Active users
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // Inactive users (5-4)

    // Table rows
    expect(screen.getAllByText('Eleanor Vance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Current User (You)')).toBeDefined();
    expect(screen.getByText('Marcus Vance')).toBeDefined();
    expect(screen.getByText('Elena Rostova')).toBeDefined();
    expect(screen.getByText('David Santos')).toBeDefined();
    expect(screen.getByText('Sarah Jenkins')).toBeDefined();
  });

  it('filters users by search term and role dropdown', async () => {
    render(<SuperAdminUserManagementPage />);
    await screen.findByRole('heading', { name: /User & Role Management/i });

    const searchInput = screen.getByPlaceholderText(/Search by name, email or employee ID/i);
    fireEvent.change(searchInput, { target: { value: 'Marcus' } });

    await waitFor(() => {
      expect(superadminApi.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Marcus',
        }),
      );
    });

    const roleSelect = screen.getByDisplayValue('All Roles');
    fireEvent.change(roleSelect, { target: { value: 'Guard' } });

    await waitFor(() => {
      expect(superadminApi.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'Guard',
        }),
      );
    });
  });

  it('clears all filters when Clear Filters button is clicked', async () => {
    render(<SuperAdminUserManagementPage />);
    await screen.findByRole('heading', { name: /User & Role Management/i });

    const searchInput = screen.getByPlaceholderText(/Search by name, email or employee ID/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput.value).toBe('test');

    const clearBtn = screen.getByRole('button', { name: /Clear Filters/i });
    fireEvent.click(clearBtn);

    expect(searchInput.value).toBe('');
    await waitFor(() => {
      expect(superadminApi.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: undefined,
          role: undefined,
        }),
      );
    });
  });

  it('opens Add New User modal and successfully creates a new user', async () => {
    const createUserSpy = vi.spyOn(superadminApi, 'createUser').mockResolvedValue({
      id: 6,
      full_name: 'Jonathan Reynolds',
      email: 'j.reynolds@assetmx.internal',
      employee_id: 'EMP-5012',
      role: 'employee',
      department: 'Product Engineering',
      department_id: 1,
      is_active: true,
    });

    render(<SuperAdminUserManagementPage />);
    await screen.findByRole('heading', { name: /User & Role Management/i });

    const addBtn = screen.getByRole('button', { name: /Add New User/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: 'Add New User' })).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText(/Jonathan Reynolds/i), {
      target: { value: 'Jonathan Reynolds' },
    });
    fireEvent.change(screen.getByPlaceholderText(/j\.reynolds@assetmx\.internal/i), {
      target: { value: 'j.reynolds@assetmx.internal' },
    });
    fireEvent.change(screen.getByPlaceholderText(/EMP-5012/i), {
      target: { value: 'EMP-5012' },
    });

    const submitBtn = screen.getByRole('button', { name: /Create User/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createUserSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Jonathan Reynolds',
          email: 'j.reynolds@assetmx.internal',
          employee_id: 'EMP-5012',
          role: 'employee',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Add New User' })).toBeNull();
    });
  });

  it('opens Edit User modal and updates existing user data', async () => {
    const updateUserSpy = vi.spyOn(superadminApi, 'updateUser').mockResolvedValue({
      ...mockUsers[2],
      full_name: 'Elena Rostova Updated',
    });

    render(<SuperAdminUserManagementPage />);
    await screen.findByRole('heading', { name: /User & Role Management/i });

    // Click kebab menu for Elena Rostova
    const kebabButtons = screen.getAllByTitle('Actions menu');
    fireEvent.click(kebabButtons[2]); // 3rd user (index 2)

    const editBtn = screen.getByRole('menuitem', { name: /Edit User/i });
    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Edit User' })).toBeDefined();

    const nameInput = screen.getByDisplayValue('Elena Rostova');
    fireEvent.change(nameInput, { target: { value: 'Elena Rostova Updated' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateUserSpy).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          full_name: 'Elena Rostova Updated',
        }),
      );
    });
  });

  it('prevents self-deactivation of current logged-in SuperAdmin', async () => {
    render(<SuperAdminUserManagementPage />);
    await screen.findByRole('heading', { name: /User & Role Management/i });

    // First user is logged-in SuperAdmin (Eleanor Vance)
    const kebabButtons = screen.getAllByTitle('Actions menu');
    fireEvent.click(kebabButtons[0]);

    // Deactivate item should be disabled and locked
    const selfLockedItem = screen.getByText(/Deactivate \(Self-Locked\)/i);
    expect(selfLockedItem).toBeDefined();
    expect(selfLockedItem.closest('.disabled')).toBeTruthy();
  });

  it('opens Reset Password modal and submits temporary password reset', async () => {
    const resetPwdSpy = vi.spyOn(superadminApi, 'resetUserPassword').mockResolvedValue({
      message: 'Password reset successfully for user marcus.vance@assetmx.internal',
    });

    render(<SuperAdminUserManagementPage />);
    await screen.findByRole('heading', { name: /User & Role Management/i });

    // Marcus Vance
    const kebabButtons = screen.getAllByTitle('Actions menu');
    fireEvent.click(kebabButtons[1]);

    const resetBtn = screen.getByRole('menuitem', { name: /Reset Password/i });
    fireEvent.click(resetBtn);

    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeDefined();
    expect(screen.getByText(/Forced Password Reset/i)).toBeDefined();

    const confirmResetBtn = screen.getByRole('button', { name: /Confirm Password Reset/i });
    fireEvent.click(confirmResetBtn);

    await waitFor(() => {
      expect(resetPwdSpy).toHaveBeenCalledWith(2, expect.any(String));
    });
  });

  it('opens confirmation modal and deactivates a user', async () => {
    const statusSpy = vi.spyOn(superadminApi, 'updateUserStatus').mockResolvedValue({
      ...mockUsers[1],
      is_active: false,
    });

    render(<SuperAdminUserManagementPage />);
    await screen.findByRole('heading', { name: /User & Role Management/i });

    // Click kebab for Marcus Vance
    const kebabButtons = screen.getAllByTitle('Actions menu');
    fireEvent.click(kebabButtons[1]);

    const deactivateBtn = screen.getByRole('menuitem', { name: /Deactivate Account/i });
    fireEvent.click(deactivateBtn);

    // Confirmation dialog appears
    expect(screen.getByRole('heading', { name: 'Deactivate User Account' })).toBeDefined();
    expect(screen.getByText(/Are you sure you want to deactivate/i)).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Deactivation' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(statusSpy).toHaveBeenCalledWith(2, false);
    });
  });

  it('displays error state and retries on failure', async () => {
    vi.spyOn(superadminApi, 'listUsers').mockRejectedValueOnce(new Error('Network error'));

    render(<SuperAdminUserManagementPage />);

    expect(await screen.findByText('Failed to Load Users')).toBeDefined();
    expect(screen.getByText('Network error')).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(superadminApi.listUsers).toHaveBeenCalledTimes(2);
    });
  });
});
