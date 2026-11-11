import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetDetailsPage } from '../AssetDetails';
import * as assetApi from '../../api/assetApi';
import type { AssetStatus } from '../../data/assetsData';

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
    updateAsset: vi.fn(),
    getAssetValuations: vi.fn(),
    recordAssetValuation: vi.fn(),
  };
});

const mockAssetRecord: Awaited<ReturnType<typeof assetApi.getAsset>> = {
  asset_id: 'AST-NC-2026-0012',
  name: 'Dell Latitude 5430',
  status: 'Active',
  category: 'Hardware / Compute',
  specification: 'Intel Core i7-1265U, 16GB RAM, 512GB NVMe SSD',
  serial_number: 'SN-88294-DL5430',
  location: 'HQ - Floor 3, IT Lab 302',
  custodian: 'IT Operations (EMP-1088)',
  purchase_date: '2026-01-10',
  vendor_name: 'Dell Technologies India Direct',
  total_cost: '₹1,24,500',
  warranty_period: '3 Years ProSupport Plus Next Business Day',
  invoice_reference: 'INV-2026-0091',
  depreciation: 'Straight Line Method (SLM) - 3 Years',
  allocation_date: '2026-01-15',
  documents: { invoiceFileName: 'dell_5430_invoice.pdf' },
  qr_code_value: 'assetmx:AST-NC-2026-0012:a8f9c0e2',
  qr_code_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  movement_history: [
    {
      movement_id: 'TRF-2026-0041',
      from_location: 'Central IT Warehouse - Bay 4',
      to_location: 'HQ - Floor 3, IT Lab 302',
      from_custodian: 'Procurement Logistics',
      to_custodian: 'IT Operations (EMP-1088)',
      reason: 'Department deployment',
      status: 'Completed',
      initiated_by_user_id: 1,
      initiated_at: '2026-01-15T09:30:00Z',
      completed_at: '2026-01-15T11:00:00Z',
    },
  ],
  maintenance_history: [
    {
      id: 'MNT-2026-0008',
      date: '20 Feb 2026',
      serviceEvent: 'Preventive',
      vendor: 'Dell Official Support',
      cost: '₹0',
      status: 'Completed',
    },
  ],
  audit_history: [
    {
      id: 101,
      action: 'Asset Registered',
      asset_identifier: 'AST-NC-2026-0012',
      actor_user_id: 1,
      occurred_at: '2026-01-10T10:00:00Z',
      before_state: null,
      after_state: { status: 'Active' },
      movement_id: null,
      metadata: null,
    },
    {
      id: 102,
      action: 'Asset Movement Initiated',
      asset_identifier: 'AST-NC-2026-0012',
      actor_user_id: 1,
      occurred_at: '2026-01-15T09:30:00Z',
      before_state: null,
      after_state: null,
      movement_id: 'TRF-2026-0041',
      metadata: null,
    },
  ],
};

const mockValuationsResponse: assetApi.AssetValuationResponseApiRecord = {
  total: 1,
  items: [
    {
      valuation_id: 'VAL-001',
      id: 'VAL-001',
      asset_id: 'AST-NC-2026-0012',
      assetId: 'AST-NC-2026-0012',
      effective_date: '2026-02-01',
      effectiveDate: '2026-02-01',
      previous_value: 124500,
      previousValue: 124500,
      new_recorded_value: 114125,
      newRecordedValue: 114125,
      formula_used: 'Straight Line Method (SLM) - 3 Years',
      formulaUsed: 'Straight Line Method (SLM) - 3 Years',
      notes: 'Scheduled monthly depreciation deduction',
      reference: 'DEP-2026-M01',
      updated_by: 'System Administrator',
      updatedBy: 'System Administrator',
      recorded_at: '2026-02-01T12:00:00Z',
      recordedAt: '2026-02-01T12:00:00Z',
    },
  ],
  valuations: [],
  history: [],
  summary: {
    asset_id: 'AST-NC-2026-0012',
    assetId: 'AST-NC-2026-0012',
    original_acquisition_cost: '₹1,24,500',
    originalAcquisitionCost: '₹1,24,500',
    current_recorded_value: '₹1,14,125',
    currentRecordedValue: '₹1,14,125',
    last_valuation_update: '2026-02-01',
    lastValuationUpdate: '2026-02-01',
    configured_depreciation_formula: 'Straight Line Method (SLM) - 3 Years',
    configuredDepreciationFormula: 'Straight Line Method (SLM) - 3 Years',
  },
};

describe('Admin Asset Details — Phase 2', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assetApi.getAsset).mockResolvedValue(mockAssetRecord);
    vi.mocked(assetApi.getAssetValuations).mockResolvedValue(mockValuationsResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authoritative Data Grounding & Inspection', () => {
    it('loads and displays authoritative asset details from getAsset API', async () => {
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dell latitude 5430/i, level: 2 })).toBeDefined();
      });

      expect(vi.mocked(assetApi.getAsset)).toHaveBeenCalledWith('AST-NC-2026-0012');
      expect(screen.getAllByText('AST-NC-2026-0012').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Intel Core i7-1265U, 16GB RAM, 512GB NVMe SSD')).toBeDefined();
      expect(screen.getByText('SN-88294-DL5430')).toBeDefined();
      expect(screen.getAllByText('HQ - Floor 3, IT Lab 302').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('IT Operations (EMP-1088)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Dell Technologies India Direct')).toBeDefined();
      expect(screen.getAllByText('₹1,24,500').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('3 Years ProSupport Plus Next Business Day').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the asset QR code and verification information', async () => {
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByAltText(/qr code for ast-nc-2026-0012/i)).toBeDefined();
      });

      expect(screen.getByText(/asset tag value: assetmx:ast-nc-2026-0012:a8f9c0e2/i)).toBeDefined();
      expect(screen.getByText('Verified & Active')).toBeDefined();
    });
  });

  describe('Accurate Lifecycle Stages', () => {
    it('computes grounded lifecycle stages when movement and maintenance history exist', async () => {
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('1. Allocation & Onboarding')).toBeDefined();
      });

      // Stage 1: Completed
      expect(screen.getByText('1. Allocation & Onboarding')).toBeDefined();
      expect(screen.getAllByText('15 Jan 2026').length).toBeGreaterThanOrEqual(1);

      // Stage 2: Physical Movement & Deployment
      expect(screen.getByText('2. Physical Movement & Deployment')).toBeDefined();
      expect(screen.getByText('Deployed')).toBeDefined();

      // Stage 3: Maintenance & Servicing
      expect(screen.getByText('3. Maintenance & Servicing')).toBeDefined();
      expect(screen.getByText('Serviced')).toBeDefined();
      expect(screen.getByText('Last: 20 Feb 2026')).toBeDefined();

      // Stage 4: Disposal & Decommission
      expect(screen.getByText('4. Disposal & Decommission')).toBeDefined();
      expect(screen.getByText('Active Lifecycle')).toBeDefined();
    });

    it('displays "No Service History" and does NOT fabricate routine maintenance when history is empty', async () => {
      const assetWithoutHistory = {
        ...mockAssetRecord,
        status: 'Active' as AssetStatus,
        movement_history: [],
        maintenance_history: [],
      };
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(assetWithoutHistory);

      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('3. Maintenance & Servicing')).toBeDefined();
      });

      expect(screen.getByText('No Service History')).toBeDefined();
      expect(screen.getByText('No maintenance records logged for this asset')).toBeDefined();
      expect(screen.getByText('Not recorded')).toBeDefined();

      // Check empty table message
      expect(
        screen.getByText(/no maintenance records found\. click "log service event" to record service or repairs\./i)
      ).toBeDefined();
    });

    it('displays "In Transit" status when asset is physically moving', async () => {
      const assetInTransit = {
        ...mockAssetRecord,
        status: 'In Transit' as AssetStatus,
        movement_history: [
          {
            movement_id: 'TRF-2026-9999',
            from_location: 'HQ - Floor 3',
            to_location: 'Branch Warehouse - Pod 2',
            from_custodian: 'IT Operations',
            to_custodian: 'Logistics Courier',
            reason: 'Inter-branch transfer',
            status: 'In Transit' as const,
            initiated_by_user_id: 1,
            initiated_at: '2026-03-01T14:00:00Z',
            completed_at: null,
          },
        ],
      };
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(assetInTransit);

      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Stage 2: In Transit')).toBeDefined();
      });

      expect(screen.getByText('In transit: HQ - Floor 3 → Branch Warehouse - Pod 2')).toBeDefined();
    });

    it('displays "Disposed" status when asset has been decommissioned', async () => {
      const assetDisposed = {
        ...mockAssetRecord,
        status: 'Disposed' as AssetStatus,
        audit_history: [
          {
            id: 105,
            action: 'Asset Disposed & Archived',
            asset_identifier: 'AST-NC-2026-0012',
            actor_user_id: 1,
            occurred_at: '2026-03-05T16:00:00Z',
            before_state: { status: 'Active' },
            after_state: { status: 'Disposed' },
            movement_id: null,
            metadata: null,
          },
        ],
      };
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(assetDisposed);

      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Stage 4: Disposed')).toBeDefined();
      });

      expect(screen.getByText('Asset decommissioned and archived from service')).toBeDefined();
      expect(screen.getByText('05 Mar 2026')).toBeDefined();
    });
  });

  describe('Movement & Maintenance History Tables', () => {
    it('renders physical movement records in the Movement History table', async () => {
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Movement History')).toBeDefined();
      });

      expect(screen.getByText('Central IT Warehouse - Bay 4')).toBeDefined();
      expect(screen.getAllByText('HQ - Floor 3, IT Lab 302').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    });

    it('renders service events in the Maintenance History table', async () => {
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Maintenance History')).toBeDefined();
      });

      expect(screen.getByText('Preventive')).toBeDefined();
      expect(screen.getByText('Dell Official Support')).toBeDefined();
      expect(screen.getByText('₹0')).toBeDefined();
    });
  });

  describe('Valuation & Depreciation Ledger', () => {
    it('renders persisted valuation summary and ledger entries', async () => {
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Valuation History Ledger')).toBeDefined();
      });

      expect(screen.getAllByText('₹1,14,125').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('DEP-2026-M01')).toBeDefined();
      expect(screen.getByText('Scheduled monthly depreciation deduction')).toBeDefined();
    });

    it('allows recording a new valuation update through the two-step modal flow', async () => {
      vi.mocked(assetApi.recordAssetValuation).mockResolvedValueOnce({
        valuation_id: 'VAL-002',
        id: 'VAL-002',
        asset_id: 'AST-NC-2026-0012',
        assetId: 'AST-NC-2026-0012',
        effective_date: '2026-03-01',
        effectiveDate: '2026-03-01',
        previous_value: 114125,
        previousValue: 114125,
        new_recorded_value: 103750,
        newRecordedValue: 103750,
        formula_used: 'Straight Line Method (SLM) - 3 Years',
        formulaUsed: 'Straight Line Method (SLM) - 3 Years',
        notes: 'March 2026 depreciation adjustment',
        reference: 'DEP-2026-M02',
        updated_by: 'System Administrator',
        updatedBy: 'System Administrator',
        recorded_at: '2026-03-01T10:00:00Z',
        recordedAt: '2026-03-01T10:00:00Z',
      });

      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /record valuation update/i })).toBeDefined();
      });

      // Open Modal
      fireEvent.click(screen.getByRole('button', { name: /record valuation update/i }));
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Step 1 of 2: Entry')).toBeDefined();

      // Fill in Form
      fireEvent.change(screen.getByLabelText(/new recorded value/i), {
        target: { value: '103750' },
      });
      fireEvent.change(screen.getByLabelText(/calculation notes/i), {
        target: { value: 'March 2026 depreciation adjustment' },
      });
      fireEvent.change(screen.getByLabelText(/supporting reference/i), {
        target: { value: 'DEP-2026-M02' },
      });

      // Proceed to review
      fireEvent.click(screen.getByRole('button', { name: /proceed to review/i }));

      // Review step
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 2: Review & Confirmation')).toBeDefined();
      });
      expect(screen.getByText('March 2026 depreciation adjustment')).toBeDefined();

      // Confirm & Record
      fireEvent.click(screen.getByRole('button', { name: /confirm & record entry/i }));

      await waitFor(() => {
        expect(vi.mocked(assetApi.recordAssetValuation)).toHaveBeenCalledWith(
          'AST-NC-2026-0012',
          expect.objectContaining({
            newRecordedValue: 103750,
            notes: 'March 2026 depreciation adjustment',
            reference: 'DEP-2026-M02',
          })
        );
      });
    });
  });

  describe('Edit Asset Details', () => {
    it('opens edit form, submits changes to updateAsset API and updates displayed details', async () => {
      const updatedAssetRecord = {
        ...mockAssetRecord,
        name: 'Dell Latitude 5430 (Updated Core)',
        specification: 'Intel Core i7-1265U, 32GB RAM, 1TB NVMe SSD',
        location: 'HQ - Floor 4, Exec Room 405',
      };
      vi.mocked(assetApi.updateAsset).mockResolvedValueOnce(updatedAssetRecord);

      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit asset/i })).toBeDefined();
      });

      // Click Edit Asset
      fireEvent.click(screen.getByRole('button', { name: /edit asset/i }));
      expect(screen.getByRole('heading', { name: /edit asset details/i })).toBeDefined();

      // Change fields
      fireEvent.change(screen.getByLabelText(/^asset name$/i), {
        target: { value: 'Dell Latitude 5430 (Updated Core)' },
      });
      fireEvent.change(screen.getByLabelText(/^specification$/i), {
        target: { value: 'Intel Core i7-1265U, 32GB RAM, 1TB NVMe SSD' },
      });
      fireEvent.change(screen.getByLabelText(/^location$/i), {
        target: { value: 'HQ - Floor 4, Exec Room 405' },
      });

      // Submit Save
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(vi.mocked(assetApi.updateAsset)).toHaveBeenCalledWith(
          'AST-NC-2026-0012',
          expect.objectContaining({
            name: 'Dell Latitude 5430 (Updated Core)',
            specification: 'Intel Core i7-1265U, 32GB RAM, 1TB NVMe SSD',
            location: 'HQ - Floor 4, Exec Room 405',
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dell latitude 5430 \(updated core\)/i, level: 2 })).toBeDefined();
      });
    });
  });

  describe('Error Handling and Navigation', () => {
    it('displays accessible error view with retry button when asset is not found (404)', async () => {
      vi.mocked(assetApi.getAsset).mockRejectedValueOnce({
        status: 404,
        message: 'Asset not found',
      });

      render(<AssetDetailsPage assetId="AST-NOT-FOUND" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });

      expect(screen.getByText(/asset "ast-not-found" was not found in the inventory ledger\./i)).toBeDefined();

      const retryBtn = screen.getByRole('button', { name: /retry/i });
      expect(retryBtn).toBeDefined();

      // Clicking retry calls getAsset again
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(mockAssetRecord);
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dell latitude 5430/i, level: 2 })).toBeDefined();
      });
    });

    it('navigates back to assets inventory when Back to Assets button is clicked', async () => {
      const onNavigate = vi.fn();
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={onNavigate} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to assets inventory/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /back to assets inventory/i }));
      expect(onNavigate).toHaveBeenCalledWith('assets');
    });

    it('navigates to transfer workflow with assetId when Initiate Transfer is clicked', async () => {
      const onNavigate = vi.fn();
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={onNavigate} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /initiate transfer/i }).length).toBeGreaterThanOrEqual(1);
      });

      const transferBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      fireEvent.click(transferBtns[0]);
      expect(onNavigate).toHaveBeenCalledWith('assets/AST-NC-2026-0012/transfer');
    });

    it('navigates to maintenance workflow when Log Service Event is clicked', async () => {
      const onNavigate = vi.fn();
      render(<AssetDetailsPage assetId="AST-NC-2026-0012" onNavigate={onNavigate} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log service event/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /log service event/i }));
      expect(onNavigate).toHaveBeenCalledWith('assets/AST-NC-2026-0012/maintenance');
    });
  });
});
