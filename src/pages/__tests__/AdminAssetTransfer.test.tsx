import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetTransferPage } from '../AssetTransfer';
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
    initiateTransfer: vi.fn(),
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
  custodian: 'Marcus Vance (EMP-0941) — IT Systems',
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
      movement_id: 'TRF-PREV-001',
      from_location: 'Central IT Warehouse - Bay 4',
      to_location: 'HQ - Floor 4, Dev Pod 4B',
      from_custodian: 'Procurement Logistics',
      to_custodian: 'Marcus Vance (EMP-0941) — IT Systems',
      reason: 'Initial onboarding',
      status: 'Completed' as const,
      initiated_by_user_id: 1,
      initiated_at: '2026-01-15T09:30:00Z',
      completed_at: '2026-01-15T11:00:00Z',
    },
  ],
  maintenance_history: [],
  audit_history: [],
};

const mockTransferResponse: assetApi.AssetTransferResponse = {
  movement: {
    movement_id: 'TRF-NEW-9999',
    from_location: 'HQ - Floor 4, Dev Pod 4B',
    to_location: 'Regional Annex - West Wing Labs',
    from_custodian: 'Marcus Vance (EMP-0941) — IT Systems',
    to_custodian: 'Elena Rostova (EMP-1102) — DevOps',
    reason: 'Inter-branch project deployment',
    status: 'In Transit',
    initiated_by_user_id: 1,
    initiated_at: '2026-03-01T10:00:00Z',
    completed_at: null,
  },
  asset: {
    ...mockAssetRecord,
    status: 'In Transit' as AssetStatus,
    movement_history: [
      ...mockAssetRecord.movement_history,
      {
        movement_id: 'TRF-NEW-9999',
        from_location: 'HQ - Floor 4, Dev Pod 4B',
        to_location: 'Regional Annex - West Wing Labs',
        from_custodian: 'Marcus Vance (EMP-0941) — IT Systems',
        to_custodian: 'Elena Rostova (EMP-1102) — DevOps',
        reason: 'Inter-branch project deployment',
        status: 'In Transit' as const,
        initiated_by_user_id: 1,
        initiated_at: '2026-03-01T10:00:00Z',
        completed_at: null,
      },
    ],
  },
};

describe('Admin Asset Transfer — Phase 3', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assetApi.getAsset).mockResolvedValue(mockAssetRecord);
    vi.mocked(assetApi.initiateTransfer).mockResolvedValue(mockTransferResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authoritative Data Loading & Field Inspection', () => {
    it('loads and displays authoritative asset details and auto-populates QR tag', async () => {
      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /initiate asset transfer/i })).toBeDefined();
      });

      expect(vi.mocked(assetApi.getAsset)).toHaveBeenCalledWith('AST-NC-2026-0012');
      expect(screen.getAllByText('AST-NC-2026-0012').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Dell Latitude 5430').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Hardware / Compute').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('HQ - Floor 4, Dev Pod 4B').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Marcus Vance (EMP-0941) — IT Systems').length).toBeGreaterThanOrEqual(1);

      // QR Code input should be auto-populated
      const qrInput = screen.getByLabelText(/asset qr code \/ tag/i) as HTMLInputElement;
      expect(qrInput.value).toBe('assetmx:AST-NC-2026-0012:a8f9c0e2');
    });

    it('displays the actual persisted movement history records in the table', async () => {
      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /movement & transfer history/i })).toBeDefined();
      });

      expect(screen.getByText('TRF-PREV-001')).toBeDefined();
      expect(screen.getByText('Central IT Warehouse - Bay 4')).toBeDefined();
      expect(screen.getAllByText('HQ - Floor 4, Dev Pod 4B').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    });

    it('shows empty message when asset has no previous movement history', async () => {
      const assetWithoutMovements = {
        ...mockAssetRecord,
        movement_history: [],
      };
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(assetWithoutMovements);

      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/no physical movement or relocation records logged yet for this asset\./i)).toBeDefined();
      });
    });
  });

  describe('Validation & Eligibility Rules', () => {
    it('validates required fields before opening the confirmation dialog', async () => {
      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /initiate transfer/i }).length).toBeGreaterThanOrEqual(1);
      });

      // Clear QR code to test validation
      fireEvent.change(screen.getByLabelText(/asset qr code \/ tag/i), { target: { value: '' } });

      const initiateBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      fireEvent.click(initiateBtns[0]);

      await waitFor(() => {
        expect(screen.getByText(/destination location is required\./i)).toBeDefined();
        expect(screen.getByText(/new custodian is required\./i)).toBeDefined();
        expect(screen.getByText(/asset qr code is required for movement transfer under srs qr-03\./i)).toBeDefined();
      });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('warns when both destination location and custodian are identical to origin', async () => {
      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/destination location/i)).toBeDefined();
      });

      // Select identical location and custodian from available options
      fireEvent.change(screen.getByLabelText(/destination location/i), {
        target: { value: 'HQ - Floor 4, Dev Pod 4B' },
      });
      fireEvent.change(screen.getByLabelText(/new custodian/i), {
        target: { value: 'Marcus Vance (EMP-0941) — IT Systems' },
      });

      const initiateBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      fireEvent.click(initiateBtns[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/destination location or new custodian must be different from current assignment\./i)
        ).toBeDefined();
      });
    });

    it('blocks transfer and disables initiation when asset is Disposed', async () => {
      const disposedAsset = {
        ...mockAssetRecord,
        status: 'Disposed' as AssetStatus,
      };
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(disposedAsset);

      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/this asset has been disposed and cannot be transferred\./i)).toBeDefined();
      });

      const initiateBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      initiateBtns.forEach((btn) => {
        expect(btn).toHaveProperty('disabled', true);
      });
    });

    it('blocks transfer and disables initiation when asset is currently In Transit', async () => {
      const inTransitAsset = {
        ...mockAssetRecord,
        status: 'In Transit' as AssetStatus,
      };
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(inTransitAsset);

      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            /this asset is currently in transit\. physical checkpoint verification must be completed before another transfer can be initiated\./i
          )
        ).toBeDefined();
      });

      const initiateBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      initiateBtns.forEach((btn) => {
        expect(btn).toHaveProperty('disabled', true);
      });
    });
  });

  describe('Transfer Confirmation & Submission Flow', () => {
    it('opens confirmation modal, submits payload to backend, and updates UI with new movement record', async () => {
      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/destination location/i)).toBeDefined();
      });

      // Fill in valid transfer details
      fireEvent.change(screen.getByLabelText(/destination location/i), {
        target: { value: 'Regional Annex - West Wing Labs' },
      });
      fireEvent.change(screen.getByLabelText(/new custodian/i), {
        target: { value: 'Elena Rostova (EMP-1102) — DevOps' },
      });
      fireEvent.change(screen.getByLabelText(/transfer reason/i), {
        target: { value: 'Inter-branch project deployment' },
      });

      // Click Initiate Transfer
      const initiateBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      fireEvent.click(initiateBtns[0]);

      // Review Modal opens
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
        expect(screen.getByRole('heading', { name: /review & confirm transfer/i })).toBeDefined();
      });

      expect(screen.getAllByText('Regional Annex - West Wing Labs').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Elena Rostova (EMP-1102) — DevOps').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Inter-branch project deployment').length).toBeGreaterThanOrEqual(1);

      // Confirm Transfer
      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        expect(vi.mocked(assetApi.initiateTransfer)).toHaveBeenCalledWith('AST-NC-2026-0012', {
          destination_location: 'Regional Annex - West Wing Labs',
          new_custodian: 'Elena Rostova (EMP-1102) — DevOps',
          qr_code: 'assetmx:AST-NC-2026-0012:a8f9c0e2',
          transfer_reason: 'Inter-branch project deployment',
        });
      });

      // Success Banner is rendered
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /transfer initiated \(status: in transit\)/i })).toBeDefined();
      });

      expect(screen.getAllByText(/TRF-NEW-9999/).length).toBeGreaterThanOrEqual(1);

      // Newly initiated movement record appears in Movement History table
      expect(screen.getAllByText('TRF-NEW-9999').length).toBeGreaterThanOrEqual(1);
    });

    it('handles QR code mismatch (400) from backend and displays actionable error', async () => {
      vi.mocked(assetApi.initiateTransfer).mockRejectedValueOnce(
        new assetApi.AssetApiError(400, "QR validation failed: Scanned QR code does not match asset 'AST-NC-2026-0012'")
      );

      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/destination location/i)).toBeDefined();
      });

      fireEvent.change(screen.getByLabelText(/destination location/i), {
        target: { value: 'Regional Annex - West Wing Labs' },
      });
      fireEvent.change(screen.getByLabelText(/new custodian/i), {
        target: { value: 'Elena Rostova (EMP-1102) — DevOps' },
      });

      const initiateBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      fireEvent.click(initiateBtns[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm transfer/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        expect(
          screen.getAllByText(/qr validation failed: scanned qr code does not match asset 'ast-nc-2026-0012'/i).length
        ).toBeGreaterThanOrEqual(1);
      });
    });

    it('handles active transfer conflict (409) from backend', async () => {
      vi.mocked(assetApi.initiateTransfer).mockRejectedValueOnce(
        new assetApi.AssetApiError(409, 'Asset already has an active transfer')
      );

      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/destination location/i)).toBeDefined();
      });

      fireEvent.change(screen.getByLabelText(/destination location/i), {
        target: { value: 'Regional Annex - West Wing Labs' },
      });
      fireEvent.change(screen.getByLabelText(/new custodian/i), {
        target: { value: 'Elena Rostova (EMP-1102) — DevOps' },
      });

      const initiateBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      fireEvent.click(initiateBtns[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm transfer/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        expect(screen.getAllByText(/asset already has an active transfer/i).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Error States & Navigation', () => {
    it('displays error view with retry button when asset fails to load (404)', async () => {
      vi.mocked(assetApi.getAsset).mockRejectedValueOnce(
        new assetApi.AssetApiError(404, 'Asset not found')
      );

      render(<AssetTransferPage assetId="AST-MISSING" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });

      expect(screen.getByText(/asset "ast-missing" was not found in the inventory ledger\./i)).toBeDefined();

      const retryBtn = screen.getByRole('button', { name: /retry/i });
      vi.mocked(assetApi.getAsset).mockResolvedValueOnce(mockAssetRecord);
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /initiate asset transfer/i })).toBeDefined();
      });
    });

    it('navigates back to asset details on breadcrumb or cancel click', async () => {
      const onNavigate = vi.fn();
      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={onNavigate} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to asset details \(ast-nc-2026-0012\)/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /back to asset details \(ast-nc-2026-0012\)/i }));
      expect(onNavigate).toHaveBeenCalledWith('assets/AST-NC-2026-0012');

      const cancelBtns = screen.getAllByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtns[0]);
      expect(onNavigate).toHaveBeenCalledWith('assets/AST-NC-2026-0012');
    });

    it('navigates to asset details from success banner action button', async () => {
      const onNavigate = vi.fn();
      render(<AssetTransferPage assetId="AST-NC-2026-0012" onNavigate={onNavigate} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/destination location/i)).toBeDefined();
      });

      fireEvent.change(screen.getByLabelText(/destination location/i), {
        target: { value: 'Regional Annex - West Wing Labs' },
      });
      fireEvent.change(screen.getByLabelText(/new custodian/i), {
        target: { value: 'Elena Rostova (EMP-1102) — DevOps' },
      });

      const initiateBtns = screen.getAllByRole('button', { name: /initiate transfer/i });
      fireEvent.click(initiateBtns[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm transfer/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view asset details/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /view asset details/i }));
      expect(onNavigate).toHaveBeenCalledWith('assets/AST-NC-2026-0012');
    });
  });
});
