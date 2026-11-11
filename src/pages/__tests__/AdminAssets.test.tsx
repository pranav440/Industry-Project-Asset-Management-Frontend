import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetsPage } from '../Assets';
import { AddNewAssetPage } from '../AddNewAsset';
import * as assetApi from '../../api/assetApi';

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
    listAssets: vi.fn(),
    getAsset: vi.fn(),
    registerNewAsset: vi.fn(),
  };
});

const mockListResponse: assetApi.AssetListResponse = {
  items: [
    {
      asset_id: 'AST-A1B2C3D4E5F6',
      name: 'MacBook Pro 16 M3',
      status: 'Active',
      category: 'Hardware / Compute',
      specification: 'Apple M3 Max, 36GB RAM, 1TB SSD',
      serial_number: 'C02G1234MD6R',
      location: 'Admin Office',
      custodian: 'Elena Rostova (EMP-1102) — DevOps',
      purchase_date: '2026-01-15',
      vendor_name: 'Apple Enterprise Direct',
      total_cost: '₹2,49,900',
      warranty_period: '3 Years AppleCare+',
      invoice_reference: 'INV-2026-0891',
      depreciation: 'Straight-line 3yr',
      allocation_date: '2026-01-20',
      documents: { invoiceFileName: 'apple_inv_0891.pdf' },
      qr_code_value: 'assetmx:AST-A1B2C3D4E5F6:7f8e9d0a',
      qr_code_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      movement_history: [],
      maintenance_history: [],
      audit_history: [],
    },
    {
      asset_id: 'AST-9F8E7D6C5B4A',
      name: 'Dell UltraSharp 32 4K Monitor',
      status: 'In Maintenance',
      category: 'Displays',
      specification: '32-inch IPS Black 4K HDR',
      serial_number: 'CN-098765-4321',
      location: 'Server Room',
      custodian: 'IT Operations',
      purchase_date: '2025-11-20',
      vendor_name: 'Dell Technologies India',
      total_cost: '₹68,500',
      warranty_period: '3 Years ProSupport',
      invoice_reference: 'INV-2025-4412',
      depreciation: 'Straight-line 5yr',
      allocation_date: '2025-11-25',
      documents: null,
      qr_code_value: 'assetmx:AST-9F8E7D6C5B4A:1a2b3c4d',
      qr_code_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      movement_history: [],
      maintenance_history: [],
      audit_history: [],
    },
  ],
  total: 2,
  page: 1,
  page_size: 10,
  total_pages: 1,
};

describe('Admin Assets Management — Phase 1', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock URL methods for CSV download
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-csv-blob');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AssetsPage (Inventory Listing & Filters)', () => {
    it('renders assets from backend listAssets API', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      expect(screen.getByText('Loading assets...')).toBeDefined();

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
        expect(screen.getByText('MacBook Pro 16 M3')).toBeDefined();
        expect(screen.getByText('AST-9F8E7D6C5B4A')).toBeDefined();
        expect(screen.getByText('Dell UltraSharp 32 4K Monitor')).toBeDefined();
        expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('In Maintenance').length).toBeGreaterThanOrEqual(1);
      });

      expect(assetApi.listAssets).toHaveBeenCalledWith({
        search: undefined,
        location: undefined,
        custodian: undefined,
        category: undefined,
        status: undefined,
        page: 1,
        pageSize: 10,
      });
    });

    it('propagates search query and resets to page 1', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValue(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('MacBook Pro 16 M3')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/search assets by id, name/i);
      fireEvent.change(searchInput, { target: { value: 'MacBook' } });

      await waitFor(() => {
        expect(assetApi.listAssets).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'MacBook',
            page: 1,
          })
        );
      });
    });

    it('propagates location, custodian, category, and status filters', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValue(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(4);

      // Location filter
      fireEvent.change(selects[0], { target: { value: 'Admin Office' } });
      // Custodian filter
      fireEvent.change(selects[1], { target: { value: 'IT Department' } });
      // Category filter
      fireEvent.change(selects[2], { target: { value: 'Hardware' } });
      // Status filter
      fireEvent.change(selects[3], { target: { value: 'Active' } });

      await waitFor(() => {
        expect(assetApi.listAssets).toHaveBeenCalledWith(
          expect.objectContaining({
            location: 'Admin Office',
            custodian: 'IT Department',
            category: 'Hardware',
            status: 'Active',
            page: 1,
          })
        );
      });
    });

    it('resets all filters when Reset button is clicked', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValue(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Admin Office' } });

      const resetBtn = screen.getByRole('button', { name: /reset all filters/i });
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(assetApi.listAssets).toHaveBeenCalledWith(
          expect.objectContaining({
            search: undefined,
            location: undefined,
            custodian: undefined,
            category: undefined,
            status: undefined,
            page: 1,
          })
        );
      });
    });

    it('displays error banner and recovers on retry', async () => {
      vi.mocked(assetApi.listAssets).mockRejectedValueOnce(
        new assetApi.AssetApiError(500, 'Internal Server Error')
      );

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/temporarily unavailable/i)).toBeDefined();
      });

      // Click retry
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });
    });

    it('navigates to asset details when a row is clicked', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);
      const onNavigate = vi.fn();

      render(<AssetsPage onNavigate={onNavigate} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      fireEvent.click(screen.getByText('MacBook Pro 16 M3'));
      expect(onNavigate).toHaveBeenCalledWith('assets/AST-A1B2C3D4E5F6');
    });

    it('navigates to add asset page when clicking Add Asset', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);
      const onNavigate = vi.fn();

      render(<AssetsPage onNavigate={onNavigate} onSignOut={vi.fn()} />);

      const addBtn = screen.getByRole('button', { name: /add new asset/i });
      fireEvent.click(addBtn);

      expect(onNavigate).toHaveBeenCalledWith('assets/new');
    });
  });

  describe('AssetsPage (Sequential Filtered CSV Export)', () => {
    it('exports all matching records across multiple pages sequentially', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      // Setup multi-page export responses
      const page1Item: assetApi.AssetRecord = {
        ...mockListResponse.items[0],
        asset_id: 'AST-EXP-001',
        name: 'Item 1',
      };
      const page2Item: assetApi.AssetRecord = {
        ...mockListResponse.items[1],
        asset_id: 'AST-EXP-002',
        name: 'Item 2',
      };

      vi.mocked(assetApi.listAssets)
        .mockResolvedValueOnce({
          items: [page1Item],
          total: 2,
          page: 1,
          page_size: 1,
          total_pages: 2,
        })
        .mockResolvedValueOnce({
          items: [page2Item],
          total: 2,
          page: 2,
          page_size: 1,
          total_pages: 2,
        });

      let capturedBlob: Blob | null = null;
      window.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob | MediaSource) => {
        capturedBlob = blob as Blob;
        return 'blob:http://localhost/mock-export-blob';
      });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalled();
      });

      expect(capturedBlob).not.toBeNull();
      const csvText = await (capturedBlob as unknown as Blob).text();
      expect(csvText).toContain('AssetMX Asset Inventory Ledger Export');
      expect(csvText).toContain('Total Matching Records,2');
      expect(csvText).toContain('Exported Records,2');
      expect(csvText).toContain('"AST-EXP-001"');
      expect(csvText).toContain('"AST-EXP-002"');
    });

    it('preserves active search and status filters in export requests', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValue(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      // Apply search and status filter
      const searchInput = screen.getByPlaceholderText(/search assets by id, name/i);
      fireEvent.change(searchInput, { target: { value: 'Dell' } });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[3], { target: { value: 'In Maintenance' } });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(assetApi.listAssets).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Dell',
            status: 'In Maintenance',
            page: 1,
            pageSize: 100,
          })
        );
      });
    });

    it('deduplicates records with stable asset_id across pagination boundaries', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      const duplicateItem = { ...mockListResponse.items[0], asset_id: 'AST-DUP-001' };
      const uniqueItem = { ...mockListResponse.items[1], asset_id: 'AST-UNIQ-002' };

      vi.mocked(assetApi.listAssets)
        .mockResolvedValueOnce({
          items: [duplicateItem, uniqueItem],
          total: 3,
          page: 1,
          page_size: 2,
          total_pages: 2,
        })
        .mockResolvedValueOnce({
          items: [duplicateItem], // Duplicate of item 1 from page 1
          total: 3,
          page: 2,
          page_size: 2,
          total_pages: 2,
        });

      let capturedBlob: Blob | null = null;
      window.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob | MediaSource) => {
        capturedBlob = blob as Blob;
        return 'blob:http://localhost/mock-export-blob';
      });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalled();
      });

      const csvText = await (capturedBlob as unknown as Blob).text();
      expect(csvText).toContain('Total Matching Records,3');
      expect(csvText).toContain('Exported Records,2');
      // Verify duplicate appears only once
      const matches = csvText.match(/"AST-DUP-001"/g);
      expect(matches?.length).toBe(1);
    });

    it('escapes special characters with RFC 4180 rules', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      const specialItem: assetApi.AssetRecord = {
        ...mockListResponse.items[0],
        asset_id: 'AST-SPECIAL-01',
        name: 'Special "Precision" 5570, High-End',
        specification: 'Intel i9, 64GB; 2TB "PCIe" SSD\nDual fans',
      };

      vi.mocked(assetApi.listAssets).mockResolvedValueOnce({
        items: [specialItem],
        total: 1,
        page: 1,
        page_size: 100,
        total_pages: 1,
      });

      let capturedBlob: Blob | null = null;
      window.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob | MediaSource) => {
        capturedBlob = blob as Blob;
        return 'blob:http://localhost/mock-export-blob';
      });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalled();
      });

      const csvText = await (capturedBlob as unknown as Blob).text();
      expect(csvText).toContain('"Special ""Precision"" 5570, High-End"');
      expect(csvText).toContain('"Intel i9, 64GB; 2TB ""PCIe"" SSD\nDual fans"');
    });

    it('handles export API errors without partial download', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      vi.mocked(assetApi.listAssets).mockRejectedValueOnce(new Error('Export fetch error'));

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText(/Failed to export assets: Export fetch error/i)).toBeDefined();
      });

      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
      expect((exportBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows toast and avoids download when 0 assets match export', async () => {
      vi.mocked(assetApi.listAssets).mockResolvedValueOnce(mockListResponse);

      render(<AssetsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('AST-A1B2C3D4E5F6')).toBeDefined();
      });

      vi.mocked(assetApi.listAssets).mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        page_size: 100,
        total_pages: 0,
      });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText(/No assets available to export/i)).toBeDefined();
      });

      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('AddNewAssetPage (Asset Registration Workflow)', () => {
    it('renders new asset form with all required inputs and sections', () => {
      render(<AddNewAssetPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      expect(screen.getByRole('heading', { name: 'Add New Asset', level: 1 })).toBeDefined();
      expect(screen.getByLabelText(/asset name/i)).toBeDefined();
      expect(screen.getByLabelText(/asset category/i)).toBeDefined();
      expect(screen.getByLabelText(/assigned location/i)).toBeDefined();
      expect(screen.getByLabelText(/custodian/i)).toBeDefined();
      expect(screen.getByLabelText(/purchase date/i)).toBeDefined();
      expect(screen.getByLabelText(/vendor \/ supplier name/i)).toBeDefined();
      expect(screen.getByLabelText(/total cost/i)).toBeDefined();
      expect(screen.getByLabelText(/warranty period/i)).toBeDefined();
    });

    it('validates required fields before submitting to backend', async () => {
      render(<AddNewAssetPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      const submitBtns = screen.getAllByRole('button', { name: /register asset/i });
      fireEvent.click(submitBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Asset Name is required')).toBeDefined();
        expect(screen.getByText('Asset Category is required')).toBeDefined();
        expect(screen.getByText('Assigned Location is required')).toBeDefined();
        expect(screen.getByText('Custodian is required')).toBeDefined();
        expect(screen.getByText('Purchase Date is required')).toBeDefined();
        expect(screen.getByText('Vendor / Supplier Name is required')).toBeDefined();
        expect(screen.getByText('Total Cost is required')).toBeDefined();
        expect(screen.getByText('Warranty Period is required')).toBeDefined();
      });

      expect(assetApi.registerNewAsset).not.toHaveBeenCalled();
    });

    it('submits valid payload to registerNewAsset and renders success confirmation with QR code', async () => {
      const mockCreatedAsset: assetApi.AssetRecord = {
        asset_id: 'AST-NEW-REG-01',
        name: 'Workstation ThinkStation P620',
        status: 'Active',
        category: 'Hardware / Compute',
        specification: 'Threadripper Pro 5955WX, 64GB',
        serial_number: 'SN-THINK-991',
        location: 'HQ - Floor 4, Dev Pod 4B',
        custodian: 'Elena Rostova (EMP-1102) — DevOps',
        purchase_date: '2026-11-01',
        vendor_name: 'Lenovo Enterprise',
        total_cost: '₹3,50,000',
        warranty_period: '3 Years Premier Support',
        invoice_reference: 'INV-LN-9912',
        depreciation: null,
        allocation_date: null,
        documents: null,
        qr_code_value: 'assetmx:AST-NEW-REG-01:aabbccdd',
        qr_code_data_url: 'data:image/png;base64,mockQrImageData',
        movement_history: [],
        maintenance_history: [],
        audit_history: [],
      };

      vi.mocked(assetApi.registerNewAsset).mockResolvedValueOnce(mockCreatedAsset);

      render(<AddNewAssetPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      // Fill in all required fields
      fireEvent.change(screen.getByLabelText(/asset name/i), {
        target: { value: 'Workstation ThinkStation P620' },
      });
      fireEvent.change(screen.getByLabelText(/asset category/i), {
        target: { value: 'Hardware / Compute' },
      });
      fireEvent.change(screen.getByLabelText(/specification/i), {
        target: { value: 'Threadripper Pro 5955WX, 64GB' },
      });
      fireEvent.change(screen.getByLabelText(/assigned location/i), {
        target: { value: 'HQ - Floor 4, Dev Pod 4B' },
      });
      fireEvent.change(screen.getByLabelText(/custodian/i), {
        target: { value: 'Elena Rostova (EMP-1102) — DevOps' },
      });
      fireEvent.change(screen.getByLabelText(/purchase date/i), {
        target: { value: '2026-11-01' },
      });
      fireEvent.change(screen.getByLabelText(/vendor \/ supplier name/i), {
        target: { value: 'Lenovo Enterprise' },
      });
      fireEvent.change(screen.getByLabelText(/total cost/i), {
        target: { value: '₹3,50,000' },
      });
      fireEvent.change(screen.getByLabelText(/warranty period/i), {
        target: { value: '3 Years Premier Support' },
      });
      fireEvent.change(screen.getByLabelText(/invoice \/ reference/i), {
        target: { value: 'INV-LN-9912' },
      });

      const submitBtns = screen.getAllByRole('button', { name: /register asset/i });
      fireEvent.click(submitBtns[0]);

      await waitFor(() => {
        expect(assetApi.registerNewAsset).toHaveBeenCalledWith({
          name: 'Workstation ThinkStation P620',
          category: 'Hardware / Compute',
          specification: 'Threadripper Pro 5955WX, 64GB',
          location: 'HQ - Floor 4, Dev Pod 4B',
          custodian: 'Elena Rostova (EMP-1102) — DevOps',
          purchaseDate: '2026-11-01',
          vendorName: 'Lenovo Enterprise',
          totalCost: '₹3,50,000',
          warrantyPeriod: '3 Years Premier Support',
          invoiceReference: 'INV-LN-9912',
          documents: expect.any(Object),
        });
      });

      // Confirm success banner and QR code display
      await waitFor(() => {
        expect(screen.getByText(/Asset Registered: AST-NEW-REG-01/i)).toBeDefined();
        expect(screen.getByText('ACTIVE QR')).toBeDefined();
        expect(screen.getByText('BOUND: assetmx:AST-NEW-REG-01:aabbccdd')).toBeDefined();
      });
    });

    it('displays error banner when registerNewAsset rejects', async () => {
      vi.mocked(assetApi.registerNewAsset).mockRejectedValueOnce(
        new assetApi.AssetApiError(403, 'Admin access is required to register assets.')
      );

      render(<AddNewAssetPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/asset name/i), {
        target: { value: 'Workstation ThinkStation P620' },
      });
      fireEvent.change(screen.getByLabelText(/asset category/i), {
        target: { value: 'Hardware / Compute' },
      });
      fireEvent.change(screen.getByLabelText(/assigned location/i), {
        target: { value: 'HQ - Floor 4, Dev Pod 4B' },
      });
      fireEvent.change(screen.getByLabelText(/custodian/i), {
        target: { value: 'Elena Rostova (EMP-1102) — DevOps' },
      });
      fireEvent.change(screen.getByLabelText(/purchase date/i), {
        target: { value: '2026-11-01' },
      });
      fireEvent.change(screen.getByLabelText(/vendor \/ supplier name/i), {
        target: { value: 'Lenovo Enterprise' },
      });
      fireEvent.change(screen.getByLabelText(/total cost/i), {
        target: { value: '₹3,50,000' },
      });
      fireEvent.change(screen.getByLabelText(/warranty period/i), {
        target: { value: '3 Years Premier Support' },
      });

      const submitBtns = screen.getAllByRole('button', { name: /register asset/i });
      fireEvent.click(submitBtns[0]);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getAllByText(/Admin access is required to register assets/i).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('navigates to assets page on cancel or back click', () => {
      const onNavigate = vi.fn();
      render(<AddNewAssetPage onNavigate={onNavigate} onSignOut={vi.fn()} />);

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);
      expect(onNavigate).toHaveBeenCalledWith('assets');

      const backBtn = screen.getByRole('button', { name: /back to assets inventory/i });
      fireEvent.click(backBtn);
      expect(onNavigate).toHaveBeenCalledWith('assets');
    });
  });
});
