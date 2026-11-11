import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetMaintenancePage } from '../AssetMaintenance';
import * as assetApi from '../../api/assetApi';
import type { AssetStatus } from '../../api/assetApi';

// Mock auth session
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

// Mock assetApi functions
vi.mock('../../api/assetApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/assetApi')>('../../api/assetApi');
  return {
    ...actual,
    getAsset: vi.fn(),
    listMaintenance: vi.fn(),
    createMaintenance: vi.fn(),
  };
});

const mockAssetRecord: Awaited<ReturnType<typeof assetApi.getAsset>> = {
  asset_id: 'AST-NC-2026-0012',
  name: 'Dell Latitude 5430',
  status: 'Active' as AssetStatus,
  category: 'Hardware / Compute',
  specification: 'Intel Core i7-1265U, 16GB RAM, 512GB NVMe SSD',
  serial_number: 'SN-88294-DL5430',
  location: 'HQ - Floor 4, Dev Pod 4B',
  custodian: 'Marcus Vance (EMP-0941)',
  purchase_date: '2026-01-10',
  vendor_name: 'Dell Technologies India Direct',
  total_cost: '₹1,24,500',
  warranty_period: '3 Years ProSupport Plus',
  invoice_reference: 'INV-2026-0091',
  depreciation: 'Straight Line Method (SLM)',
  allocation_date: '2026-01-15',
  documents: { invoiceFileName: 'dell_5430_invoice.pdf' },
  qr_code_value: 'assetmx:AST-NC-2026-0012:a8f9c0e2',
  qr_code_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  movement_history: [],
  maintenance_history: [],
  audit_history: [],
};

const mockMaintenanceRecords: assetApi.MaintenanceApiRecord[] = [
  {
    maintenance_id: 'MNT-2026-0091',
    asset_id: 'AST-NC-2026-0012',
    service_date: '2026-09-19',
    maintenance_type: 'Preventive',
    service_vendor: 'Dell Care Services',
    technician: 'Ramesh Sharma',
    maintenance_cost: 2400,
    status: 'Completed',
    service_notes: 'Quarterly hardware diagnostics and thermal repaste completed.',
    created_at: '2026-09-19T14:30:00Z',
    created_by: 'System Administrator',
  },
  {
    maintenance_id: 'MNT-2026-0052',
    asset_id: 'AST-NC-2026-0012',
    service_date: '2026-05-10',
    maintenance_type: 'Corrective',
    service_vendor: 'SysCom Solutions',
    technician: 'Anand Kumar',
    maintenance_cost: 4500,
    status: 'Completed',
    service_notes: 'Replacement of keyboard assembly following key malfunction.',
    created_at: '2026-05-10T11:00:00Z',
    created_by: 'System Administrator',
  },
];

describe('Admin Asset Maintenance — Phase 4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assetApi.getAsset).mockResolvedValue(mockAssetRecord);
    vi.mocked(assetApi.listMaintenance).mockResolvedValue(mockMaintenanceRecords);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authoritative Data Loading & KPI Inspection', () => {
    it('loads and displays authoritative asset details and maintenance records', async () => {
      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      // Initially shows accessible loading state
      expect(screen.getByRole('status')).toBeDefined();

      // Waits for authoritative asset context
      await waitFor(() => {
        expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getAllByText('AST-NC-2026-0012').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('HQ - Floor 4, Dev Pod 4B').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Marcus Vance (EMP-0941)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Hardware / Compute').length).toBeGreaterThanOrEqual(1);

      // Verifies API was called with the exact assetId
      expect(assetApi.getAsset).toHaveBeenCalledWith('AST-NC-2026-0012');
      expect(assetApi.listMaintenance).toHaveBeenCalledWith('AST-NC-2026-0012');
    });

    it('computes and renders dynamic KPI metrics without fabricated values', async () => {
      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      });

      // Last Service is derived from records[0] (19 Sep 2026, Dell Care Services)
      expect(screen.getAllByText('19 Sep 2026').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Preventive \(Dell Care Services\)/)).toBeDefined();

      // Next Due is honestly labeled as Not Scheduled (no synthetic date)
      expect(screen.getAllByText('Not Scheduled').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Schedule tracking not configured')).toBeDefined();

      // Total Cost dynamically sums ₹2,400 + ₹4,500 = ₹6,900
      expect(screen.getByText('₹6,900')).toBeDefined();
      expect(screen.getByText('2 Recorded Services')).toBeDefined();
    });

    it('shows empty KPI states when no maintenance records exist', async () => {
      vi.mocked(assetApi.listMaintenance).mockResolvedValueOnce([]);

      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getByText('No Service Logged')).toBeDefined();
      expect(screen.getByText('No maintenance history recorded')).toBeDefined();
      expect(screen.getByText('₹0')).toBeDefined();
      expect(screen.getByText('0 Recorded Services')).toBeDefined();
    });

    it('displays Active Servicing when asset is currently In Maintenance', async () => {
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce({
        ...mockAssetRecord,
        status: 'In Maintenance',
      });

      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getByText('Active Servicing')).toBeDefined();
      });

      expect(screen.getByText('Status: Active Maintenance')).toBeDefined();
      expect(screen.getByText(/currently flagged as In Maintenance/i)).toBeDefined();
    });
  });

  describe('Maintenance History Table & Search / Filter', () => {
    it('renders history table rows with persisted data and status badge', async () => {
      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getByText('Dell Care Services')).toBeDefined();
      });

      expect(screen.getByText('Ramesh Sharma')).toBeDefined();
      expect(screen.getByText('₹2,400')).toBeDefined();
      expect(screen.getByText('SysCom Solutions')).toBeDefined();
      expect(screen.getByText('Anand Kumar')).toBeDefined();
      expect(screen.getByText('₹4,500')).toBeDefined();
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(2);
    });

    it('filters records by search keywords', async () => {
      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getByText('Dell Care Services')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Filter records...');
      fireEvent.change(searchInput, { target: { value: 'SysCom' } });

      expect(screen.queryByText('Dell Care Services')).toBeNull();
      expect(screen.getByText('SysCom Solutions')).toBeDefined();
    });

    it('filters records by maintenance type dropdown', async () => {
      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getByText('Dell Care Services')).toBeDefined();
      });

      const typeSelect = screen.getByLabelText(/filter by maintenance type/i);
      fireEvent.change(typeSelect, { target: { value: 'Corrective' } });

      expect(screen.queryByText('Dell Care Services')).toBeNull();
      expect(screen.getByText('SysCom Solutions')).toBeDefined();
    });

    it('displays dedicated empty table state when no records exist', async () => {
      vi.mocked(assetApi.listMaintenance).mockResolvedValueOnce([]);

      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getByText('No maintenance records yet')).toBeDefined();
      });

      expect(screen.getByText(/Maintenance and service activity for this asset will appear here/i)).toBeDefined();
    });

    it('opens read-only details modal when clicking View Details', async () => {
      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getByText('Dell Care Services')).toBeDefined();
      });

      const viewButtons = screen.getAllByRole('button', { name: /view details/i });
      fireEvent.click(viewButtons[0]);

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Maintenance Record Details')).toBeDefined();
      expect(screen.getByText('MNT-2026-0091')).toBeDefined();
      expect(screen.getByText('Quarterly hardware diagnostics and thermal repaste completed.')).toBeDefined();
      expect(screen.getByText(/Logged by: System Administrator/)).toBeDefined();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      fireEvent.click(closeBtn);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('Add Maintenance Record Workflow', () => {
    it('validates required fields before submitting to createMaintenance', async () => {
      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      });

      // Click Add Maintenance Record
      const addBtn = screen.getAllByRole('button', { name: /add maintenance record/i })[0];
      fireEvent.click(addBtn);

      expect(screen.getByRole('dialog')).toBeDefined();

      // Submit without required fields
      const submitBtn = screen.getByRole('button', { name: /save record/i });
      fireEvent.click(submitBtn);

      // Verify validation errors appear
      expect(screen.getByText('Maintenance Type is required.')).toBeDefined();
      expect(screen.getByText('Service Vendor is required.')).toBeDefined();
      expect(screen.getByText(/Valid Maintenance Cost is required/)).toBeDefined();

      expect(assetApi.createMaintenance).not.toHaveBeenCalled();
    });

    it('submits valid payload to createMaintenance and updates history table', async () => {
      const createdRecord: assetApi.MaintenanceApiRecord = {
        maintenance_id: 'MNT-NEW-8888',
        asset_id: 'AST-NC-2026-0012',
        service_date: '2026-10-15',
        maintenance_type: 'Preventive',
        service_vendor: 'Dell Care Services',
        technician: 'Vikram Mehta',
        maintenance_cost: 3200,
        status: 'Completed',
        service_notes: 'Replaced thermal fan assembly and validated BIOS.',
        created_at: '2026-10-15T10:00:00Z',
        created_by: 'System Administrator',
      };

      vi.mocked(assetApi.createMaintenance).mockResolvedValueOnce(createdRecord);

      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      });

      fireEvent.click(screen.getAllByRole('button', { name: /add maintenance record/i })[0]);

      // Fill in valid form
      fireEvent.change(screen.getByLabelText(/service date/i), { target: { value: '2026-10-15' } });
      fireEvent.change(screen.getByLabelText(/^maintenance type/i), { target: { value: 'Preventive' } });
      fireEvent.change(screen.getByLabelText(/service vendor/i), { target: { value: 'Dell Care Services' } });
      fireEvent.change(screen.getByLabelText(/technician/i), { target: { value: 'Vikram Mehta' } });
      fireEvent.change(screen.getByLabelText(/maintenance cost/i), { target: { value: '3200' } });
      fireEvent.change(screen.getByLabelText(/service notes/i), {
        target: { value: 'Replaced thermal fan assembly and validated BIOS.' },
      });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /save record/i }));

      await waitFor(() => {
        expect(assetApi.createMaintenance).toHaveBeenCalledWith('AST-NC-2026-0012', {
          service_date: '2026-10-15',
          maintenance_type: 'Preventive',
          service_vendor: 'Dell Care Services',
          technician: 'Vikram Mehta',
          maintenance_cost: 3200,
          service_notes: 'Replaced thermal fan assembly and validated BIOS.',
        });
      });

      // Modal closes
      expect(screen.queryByRole('dialog')).toBeNull();

      // Success notification appears
      expect(screen.getByText('Maintenance Record Added')).toBeDefined();
      expect(screen.getByText(/Record saved for Dell Latitude 5430/)).toBeDefined();

      // New record is present in table
      expect(screen.getByText('Vikram Mehta')).toBeDefined();
      expect(screen.getByText('₹3,200')).toBeDefined();
    });

    it('allows returning asset to Active status when logging maintenance on In Maintenance asset', async () => {
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce({
        ...mockAssetRecord,
        status: 'In Maintenance',
      });

      const createdRecord: assetApi.MaintenanceApiRecord = {
        maintenance_id: 'MNT-NEW-9999',
        asset_id: 'AST-NC-2026-0012',
        service_date: '2026-10-15',
        maintenance_type: 'Corrective',
        service_vendor: 'In-house IT Ops',
        technician: 'Lead Engineer',
        maintenance_cost: 1500,
        status: 'Completed',
        service_notes: 'Fixed power fault and returned asset to service.',
        created_at: '2026-10-15T12:00:00Z',
        created_by: 'System Administrator',
        asset_status: 'Active',
      };

      vi.mocked(assetApi.createMaintenance).mockResolvedValueOnce(createdRecord);

      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getByText('Active Servicing')).toBeDefined();
      });

      fireEvent.click(screen.getAllByRole('button', { name: /add maintenance record/i })[0]);

      // Status reset checkbox is present for In Maintenance asset
      const checkbox = screen.getByLabelText(/return asset status to Active/i) as HTMLInputElement;
      expect(checkbox).toBeDefined();
      expect(checkbox.checked).toBe(true);

      fireEvent.change(screen.getByLabelText(/^maintenance type/i), { target: { value: 'Corrective' } });
      fireEvent.change(screen.getByLabelText(/service vendor/i), { target: { value: 'In-house IT Ops' } });
      fireEvent.change(screen.getByLabelText(/technician/i), { target: { value: 'Lead Engineer' } });
      fireEvent.change(screen.getByLabelText(/maintenance cost/i), { target: { value: '1500' } });

      fireEvent.click(screen.getByRole('button', { name: /save record/i }));

      await waitFor(() => {
        expect(assetApi.createMaintenance).toHaveBeenCalledWith(
          'AST-NC-2026-0012',
          expect.objectContaining({
            asset_status: 'Active',
          })
        );
      });
    });

    it('displays error message inside modal when createMaintenance rejects without clearing input', async () => {
      vi.mocked(assetApi.createMaintenance).mockRejectedValueOnce({
        status: 422,
        message: 'Service vendor is required',
      });

      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      });

      fireEvent.click(screen.getAllByRole('button', { name: /add maintenance record/i })[0]);

      fireEvent.change(screen.getByLabelText(/^maintenance type/i), { target: { value: 'Preventive' } });
      fireEvent.change(screen.getByLabelText(/service vendor/i), { target: { value: 'Dell Care Services' } });
      fireEvent.change(screen.getByLabelText(/maintenance cost/i), { target: { value: '2500' } });

      fireEvent.click(screen.getByRole('button', { name: /save record/i }));

      await waitFor(() => {
        expect(screen.getByText('Service vendor is required')).toBeDefined();
      });

      // Dialog is still open
      expect(screen.getByRole('dialog')).toBeDefined();
      // Values preserved
      expect((screen.getByLabelText(/maintenance cost/i) as HTMLInputElement).value).toBe('2500');
    });
  });

  describe('Error States & Navigation', () => {
    it('displays error card and allows retrying when API fails', async () => {
      vi.mocked(assetApi.getAsset).mockRejectedValueOnce({
        status: 404,
        message: 'Asset not found',
      });

      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Asset Maintenance')).toBeDefined();
      });

      expect(screen.getByText('Asset not found.')).toBeDefined();

      // Retry
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(mockAssetRecord);
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('navigates to Asset Details when Back to Asset Details button is clicked', async () => {
      const onNavigate = vi.fn();
      render(<AssetMaintenancePage assetId="AST-NC-2026-0012" onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      });

      const backButtons = screen.getAllByRole('button', { name: /back to asset details/i });
      fireEvent.click(backButtons[0]);

      expect(onNavigate).toHaveBeenCalledWith('assets/AST-NC-2026-0012');
    });
  });
});

