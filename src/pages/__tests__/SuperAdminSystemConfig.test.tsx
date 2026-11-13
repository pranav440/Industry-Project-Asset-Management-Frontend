import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuperAdminSystemConfigPage } from '../SuperAdminSystemConfig';
import * as superadminApi from '../../api/superadminApi';
import * as session from '../../auth/session';

vi.mock('../../auth/session', () => ({
  getUser: vi.fn(),
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../../api/superadminApi', () => ({
  getSystemConfig: vi.fn(),
  updateSystemConfig: vi.fn(),
}));

const mockConfigs: superadminApi.SystemConfigItem[] = [
  {
    key: 'app.security.password_min_length',
    value: 8,
    category: 'Security Governance',
    description: 'Minimum required characters for user passwords',
  },
  {
    key: 'app.gatepass.default_return_days',
    value: 7,
    category: 'Perimeter Security',
    description: 'Standard return duration for returnable gate passes before escalation',
  },
  {
    key: 'app.consumables.low_stock_warning_percent',
    value: 20,
    category: 'Supply Chain & Logistics',
    description: 'Threshold percentage trigger for low stock warning badges',
  },
  {
    key: 'app.requests.approval_sla_hours',
    value: 48,
    category: 'Workflow Automation',
    description: 'Standard SLA window for manager request approval',
  },
  {
    key: 'app.maintenance.reminder_advance_days',
    value: 14,
    category: 'Asset Lifecycle & Operations',
    description: 'Advance notice days before scheduled preventive maintenance',
  },
];

describe('SuperAdminSystemConfigPage (Module A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Eleanor Vance',
      role: 'superadmin',
    });

    (superadminApi.getSystemConfig as any).mockResolvedValue({
      configs: mockConfigs,
    });
  });

  it('1. Fetches and renders all 5 configuration cards with authoritative backend values', async () => {
    render(<SuperAdminSystemConfigPage />);

    expect(screen.getByRole('heading', { name: /^System Configuration$/i })).toBeDefined();
    expect(screen.getByText('Global Parameter Ledger')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Minimum Password Length')).toBeDefined();
      expect(screen.getByText('Default Return Days')).toBeDefined();
      expect(screen.getByText('Low Stock Warning Percentage')).toBeDefined();
      expect(screen.getByText('Approval SLA Hours')).toBeDefined();
      expect(screen.getByText('Reminder Advance Days')).toBeDefined();
    });

    // Check parameter keys are displayed
    expect(screen.getByText('app.security.password_min_length')).toBeDefined();
    expect(screen.getByText('app.gatepass.default_return_days')).toBeDefined();
    expect(screen.getByText('app.consumables.low_stock_warning_percent')).toBeDefined();
    expect(screen.getByText('app.requests.approval_sla_hours')).toBeDefined();
    expect(screen.getByText('app.maintenance.reminder_advance_days')).toBeDefined();
  });

  it('2. Editing a parameter updates value and displays pending modification badge', async () => {
    render(<SuperAdminSystemConfigPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Increase Minimum Password Length/i)).toBeDefined();
    });

    // Click increment for Minimum Password Length
    const incBtn = screen.getByLabelText(/Increase Minimum Password Length/i);
    fireEvent.click(incBtn);

    // Should detect 1 pending modification
    await waitFor(() => {
      expect(screen.getByText(/1 Pending Local Modification/i)).toBeDefined();
      expect(screen.getByText('Uncommitted')).toBeDefined();
    });
  });

  it('3. "Reset to Original Values" discards local edits and restores fetched values', async () => {
    render(<SuperAdminSystemConfigPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Increase Minimum Password Length/i)).toBeDefined();
    });

    const incBtn = screen.getByLabelText(/Increase Minimum Password Length/i);
    fireEvent.click(incBtn);

    await waitFor(() => {
      expect(screen.getByText(/1 Pending Local Modification/i)).toBeDefined();
    });

    const resetBtn = screen.getByRole('button', { name: /Reset to Original Values/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText(/All Parameters Synchronized/i)).toBeDefined();
  });

  it('4. Successfully saves modified parameters via batch PUT endpoint', async () => {
    (superadminApi.updateSystemConfig as any).mockResolvedValue({
      configs: [
        { key: 'app.security.password_min_length', value: 10 },
        { key: 'app.gatepass.default_return_days', value: 7 },
        { key: 'app.consumables.low_stock_warning_percent', value: 20 },
        { key: 'app.requests.approval_sla_hours', value: 48 },
        { key: 'app.maintenance.reminder_advance_days', value: 14 },
      ],
    });

    render(<SuperAdminSystemConfigPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Increase Minimum Password Length/i)).toBeDefined();
    });

    // Increase password min length twice: 8 -> 10
    const incBtn = screen.getByLabelText(/Increase Minimum Password Length/i);
    fireEvent.click(incBtn);
    fireEvent.click(incBtn);

    // Save Changes button in docked bar
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    // Confirmation modal should open
    expect(screen.getByRole('heading', { name: /Confirm Parameter Update/i })).toBeDefined();

    // Confirm & Apply
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Apply Changes/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(superadminApi.updateSystemConfig).toHaveBeenCalledWith({
        configs: [
          { key: 'app.security.password_min_length', value: 10 },
        ],
      });
      expect(screen.getByText(/successfully updated and active/i)).toBeDefined();
    });
  });

  it('5. API save failure preserves local edits and displays error alert', async () => {
    (superadminApi.updateSystemConfig as any).mockRejectedValue(
      new Error('Database lock error during batch update'),
    );

    render(<SuperAdminSystemConfigPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Increase Minimum Password Length/i)).toBeDefined();
    });

    const incBtn = screen.getByLabelText(/Increase Minimum Password Length/i);
    fireEvent.click(incBtn);

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Apply Changes/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Database lock error during batch update')).toBeDefined();
      // Local modification is preserved
      expect(screen.getByText(/1 Pending Local Modification/i)).toBeDefined();
    });
  });

  it('6. Bounds validation blocks invalid values', async () => {
    render(<SuperAdminSystemConfigPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Minimum Password Length')).toBeDefined();
    });

    const passInput = screen.getByLabelText('Minimum Password Length');
    // Set to 4 (below minimum 8)
    fireEvent.change(passInput, { target: { value: '4' } });

    expect(screen.getByText(/Must be at least 8 chars/i)).toBeDefined();

    // Save Changes should be disabled
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('7. Decrement button is disabled when at lower bound', async () => {
    render(<SuperAdminSystemConfigPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Decrease Minimum Password Length/i)).toBeDefined();
    });

    // Default password length is 8, which is min 8
    const decBtn = screen.getByLabelText(/Decrease Minimum Password Length/i);
    expect((decBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('8. Displays error banner when initial fetch fails', async () => {
    (superadminApi.getSystemConfig as any).mockRejectedValue(
      new Error('Failed to reach configuration service'),
    );

    render(<SuperAdminSystemConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to reach configuration service')).toBeDefined();
    });
  });
});

