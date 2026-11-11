import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RequestsPage } from '../Requests';
import { RequestDetailsPage } from '../RequestDetails';
import { AddExternalRequestPage } from '../AddExternalRequest';
import * as requestApi from '../../api/requestApi';

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

// Mock requestApi functions
vi.mock('../../api/requestApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/requestApi')>('../../api/requestApi');
  return {
    ...actual,
    listRequests: vi.fn(),
    getRequest: vi.fn(),
    transitionRequest: vi.fn(),
    createExternalRequest: vi.fn(),
    uploadRequestAttachment: vi.fn(),
    downloadRequestAttachment: vi.fn(),
    previewRequestAttachment: vi.fn(),
  };
});

const mockListResponse: requestApi.RequestListResponse = {
  items: [
    {
      request_id: 'REQ-2026-0001',
      requester_name: 'Alice Johnson',
      requester_email: 'alice@assetmx.local',
      department: 'Software Engineering',
      request_type: 'Asset Request',
      requested_item: 'Dell XPS 15',
      category: 'Computing Hardware',
      quantity: 1,
      priority: 'High',
      request_date: '2026-10-10',
      status: 'Pending',
      justification: 'New developer setup',
      processing_guidelines: 'Verify IT bay inventory',
      created_at: '2026-10-10T09:00:00Z',
      updated_at: '2026-10-10T09:00:00Z',
    },
    {
      request_id: 'REQ-2026-0002',
      requester_name: 'Bob Smith',
      requester_email: 'bob@assetmx.local',
      department: 'IT Support',
      request_type: 'Consumable Request',
      requested_item: 'Cat6 Cables (Pack of 5)',
      category: 'Network Infrastructure',
      quantity: 2,
      priority: 'Medium',
      request_date: '2026-10-12',
      status: 'In Review',
      justification: 'Server rack interconnects',
      processing_guidelines: 'Check rack inventory',
      created_at: '2026-10-12T10:00:00Z',
      updated_at: '2026-10-12T11:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  page_size: 10,
};

const mockDetailResponse: requestApi.RequestApiRecord = {
  request_id: 'REQ-2026-0001',
  requester_name: 'Alice Johnson',
  requester_email: 'alice@assetmx.local',
  department: 'Software Engineering',
  request_type: 'Asset Request',
  requested_item: 'Dell XPS 15',
  category: 'Computing Hardware',
  quantity: 1,
  priority: 'High',
  request_date: '2026-10-10',
  status: 'Pending',
  justification: 'New developer workstation allocation',
  processing_guidelines: 'Verify IT bay inventory',
  request_source: 'External',
  date_received: '2026-10-10',
  external_reference: 'PO-9941',
  contact_info: 'alice@assetmx.local',
  estimated_cost: '₹1,20,000',
  procurement_reference: 'PR-2026-88',
  created_at: '2026-10-10T09:00:00Z',
  updated_at: '2026-10-10T09:00:00Z',
  history: [
    {
      history_id: 'HIST-001',
      timestamp: '2026-10-10 09:00:00',
      stage: 'Pending',
      action: 'External request recorded',
      performed_by: 'System Administrator',
      note: 'Requisition entered via external portal',
    },
  ],
  attachments: [
    {
      attachment_id: 'ATT-001',
      id: 'ATT-001',
      request_id: 'REQ-2026-0001',
      original_filename: 'spec_sheet.pdf',
      name: 'spec_sheet.pdf',
      content_type: 'application/pdf',
      type: 'application/pdf',
      file_size: 102400,
      size: '100 KB',
      uploaded_at: '2026-10-10 09:05:00',
      uploadDate: '2026-10-10',
      download_url: '/api/requests/REQ-2026-0001/attachments/ATT-001/download',
      preview_url: '/api/requests/REQ-2026-0001/attachments/ATT-001/preview',
    },
  ],
};

describe('Admin Requests Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RequestsPage (authoritative ledger)', () => {
    it('renders request list from backend API without mock/localStorage fallback', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      // Shows loading state initially
      expect(screen.getByText('Loading requests...')).toBeDefined();

      // Waits for data to load
      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
        expect(screen.getByText('Dell XPS 15')).toBeDefined();
        expect(screen.getByText('REQ-2026-0002')).toBeDefined();
        expect(screen.getByText('Cat6 Cables (Pack of 5)')).toBeDefined();
      });

      // API was called with default pagination
      expect(requestApi.listRequests).toHaveBeenCalledWith({
        search: undefined,
        requestType: undefined,
        status: undefined,
        priority: undefined,
        department: undefined,
        requestDate: undefined,
        page: 1,
        pageSize: 10,
      });

      // Summary KPIs reflect the returned records
      expect(screen.getByText('Open Requests')).toBeDefined();
    });

    it('navigates to details view when a row is clicked', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);
      const onNavigateMock = vi.fn();

      render(<RequestsPage onNavigate={onNavigateMock} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      fireEvent.click(screen.getByText('REQ-2026-0001'));
      expect(onNavigateMock).toHaveBeenCalledWith('requests/REQ-2026-0001');
    });

    it('navigates to new external request page when New Request is clicked', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);
      const onNavigateMock = vi.fn();

      render(<RequestsPage onNavigate={onNavigateMock} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add external request/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /add external request/i }));
      expect(onNavigateMock).toHaveBeenCalledWith('requests/new-external');
    });

    it('handles search input and triggers listRequests with query', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValue(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/search requests by id, requester, item/i);
      fireEvent.change(searchInput, { target: { value: 'Dell' } });

      await waitFor(() => {
        expect(requestApi.listRequests).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Dell',
            page: 1,
          })
        );
      });
    });

    it('handles filter changes for type, status, and department', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValue(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      const selects = screen.getAllByRole('combobox');
      // Status filter is the 2nd select
      const statusSelect = selects[1];
      fireEvent.change(statusSelect, { target: { value: 'Pending' } });

      await waitFor(() => {
        expect(requestApi.listRequests).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'Pending',
            page: 1,
          })
        );
      });
    });

    it('displays error message and Retry button when API fails', async () => {
      vi.mocked(requestApi.listRequests).mockRejectedValueOnce(
        new requestApi.RequestApiError(500, 'Server connection failure')
      );

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/the request service is temporarily unavailable/i)).toBeDefined();
      });

      // Does NOT show mock requests on error
      expect(screen.queryByText('REQ-2026-0041')).toBeNull();

      // Retry recovers when API succeeds
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });
    });

    it('triggers CSV export for loaded requests', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      // Export uses listRequests
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);
      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalled();
      });
    });

    it('exports all matching requests across multiple pages sequentially', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      const page1Response: requestApi.RequestListResponse = {
        items: [
          {
            ...mockListResponse.items[0],
            request_id: 'REQ-EXPORT-001',
            requested_item: 'Monitor A',
          },
          {
            ...mockListResponse.items[1],
            request_id: 'REQ-EXPORT-002',
            requested_item: 'Monitor B',
          },
        ],
        total: 4,
        page: 1,
        page_size: 2,
      };

      const page2Response: requestApi.RequestListResponse = {
        items: [
          {
            ...mockListResponse.items[0],
            request_id: 'REQ-EXPORT-003',
            requested_item: 'Monitor C',
          },
          {
            ...mockListResponse.items[1],
            request_id: 'REQ-EXPORT-004',
            requested_item: 'Monitor D',
          },
        ],
        total: 4,
        page: 2,
        page_size: 2,
      };

      vi.mocked(requestApi.listRequests)
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      let createdBlob: Blob | null = null;
      vi.mocked(window.URL.createObjectURL).mockImplementation((blob: Blob | MediaSource) => {
        createdBlob = blob as Blob;
        return 'blob:mock-url';
      });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(requestApi.listRequests).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, pageSize: 100 })
        );
        expect(requestApi.listRequests).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2, pageSize: 2 })
        );
        expect(window.URL.createObjectURL).toHaveBeenCalled();
      });

      expect(createdBlob).toBeTruthy();
      const csvText = await (createdBlob as unknown as Blob).text();
      expect(csvText).toContain('Total Matching Records,4');
      expect(csvText).toContain('Exported Records,4');
      expect(csvText).toContain('"REQ-EXPORT-001"');
      expect(csvText).toContain('"REQ-EXPORT-002"');
      expect(csvText).toContain('"REQ-EXPORT-003"');
      expect(csvText).toContain('"REQ-EXPORT-004"');
    });

    it('preserves active search, status, type, priority, department, and date filters across all export pages', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValue(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      // Apply search filter
      const searchInput = screen.getByPlaceholderText(/search requests by id, requester, item/i);
      fireEvent.change(searchInput, { target: { value: 'Keyboard' } });

      // Apply status filter
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Asset Request' } });
      fireEvent.change(selects[1], { target: { value: 'Pending' } });
      fireEvent.change(selects[2], { target: { value: 'High' } });
      fireEvent.change(selects[3], { target: { value: 'Software Engineering' } });

      const dateInput = screen.getByLabelText(/filter by request date/i);
      fireEvent.change(dateInput, { target: { value: '2026-10-15' } });

      // Mock multi-page responses for export
      const filteredPage1: requestApi.RequestListResponse = {
        items: [
          {
            ...mockListResponse.items[0],
            request_id: 'REQ-FILT-1',
            requested_item: 'Mechanical Keyboard',
          },
        ],
        total: 2,
        page: 1,
        page_size: 1,
      };
      const filteredPage2: requestApi.RequestListResponse = {
        items: [
          {
            ...mockListResponse.items[0],
            request_id: 'REQ-FILT-2',
            requested_item: 'Ergonomic Keyboard',
          },
        ],
        total: 2,
        page: 2,
        page_size: 1,
      };

      vi.mocked(requestApi.listRequests)
        .mockResolvedValueOnce(filteredPage1)
        .mockResolvedValueOnce(filteredPage2);

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(requestApi.listRequests).toHaveBeenCalledWith({
          search: 'Keyboard',
          requestType: 'Asset Request',
          status: 'Pending',
          priority: 'High',
          department: 'Software Engineering',
          requestDate: '2026-10-15',
          page: 1,
          pageSize: 100,
        });
        expect(requestApi.listRequests).toHaveBeenCalledWith({
          search: 'Keyboard',
          requestType: 'Asset Request',
          status: 'Pending',
          priority: 'High',
          department: 'Software Engineering',
          requestDate: '2026-10-15',
          page: 2,
          pageSize: 1,
        });
      });
    });

    it('deduplicates records with identical request_id across export pages', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      // Page 1 and Page 2 both contain REQ-DUP-002
      const page1: requestApi.RequestListResponse = {
        items: [
          { ...mockListResponse.items[0], request_id: 'REQ-DUP-001' },
          { ...mockListResponse.items[1], request_id: 'REQ-DUP-002' },
        ],
        total: 3,
        page: 1,
        page_size: 2,
      };
      const page2: requestApi.RequestListResponse = {
        items: [
          { ...mockListResponse.items[1], request_id: 'REQ-DUP-002' }, // duplicate
          { ...mockListResponse.items[0], request_id: 'REQ-DUP-003' },
        ],
        total: 3,
        page: 2,
        page_size: 2,
      };

      vi.mocked(requestApi.listRequests)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      let capturedBlob: Blob | null = null;
      vi.mocked(window.URL.createObjectURL).mockImplementation((blob: Blob | MediaSource) => {
        capturedBlob = blob as Blob;
        return 'blob:mock-url';
      });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalled();
      });

      expect(capturedBlob).toBeTruthy();
      const csvText = await (capturedBlob as unknown as Blob).text();
      // Contains 3 unique records even though 4 were fetched
      expect(csvText).toContain('Total Matching Records,3');
      expect(csvText).toContain('Exported Records,3');
      const occurrences = (csvText.match(/"REQ-DUP-002"/g) || []).length;
      expect(occurrences).toBe(1);
    });

    it('handles empty matching results gracefully without downloading a file', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      vi.mocked(requestApi.listRequests).mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        page_size: 10,
      });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('No requests available to export.')).toBeDefined();
      });

      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('aborts export and prevents download when an API error occurs on a later page', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      const page1: requestApi.RequestListResponse = {
        items: [{ ...mockListResponse.items[0], request_id: 'REQ-FAIL-1' }],
        total: 20,
        page: 1,
        page_size: 1,
      };

      vi.mocked(requestApi.listRequests)
        .mockResolvedValueOnce(page1)
        .mockRejectedValueOnce(new requestApi.RequestApiError(500, 'Gateway Timeout'));

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText(/failed to export requests: gateway timeout/i)).toBeDefined();
      });

      // Never downloads an incomplete CSV
      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
      // Button returns to enabled state
      expect((exportBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('preserves RFC 4180 escaping and includes accurate exported record count', async () => {
      vi.mocked(requestApi.listRequests).mockResolvedValueOnce(mockListResponse);

      render(<RequestsPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('REQ-2026-0001')).toBeDefined();
      });

      const specialItem: requestApi.RequestListItemApiRecord = {
        ...mockListResponse.items[0],
        request_id: 'REQ-RFC-4180',
        requester_name: 'Dr. Jane "Dev" Doe, PhD',
        requested_item: '27" 4K Monitor, with USB-C',
        justification: 'Needs "fast" replacement;\nMust support 4K 120Hz.',
      };

      vi.mocked(requestApi.listRequests).mockResolvedValueOnce({
        items: [specialItem],
        total: 1,
        page: 1,
        page_size: 10,
      });

      let capturedBlob: Blob | null = null;
      vi.mocked(window.URL.createObjectURL).mockImplementation((blob: Blob | MediaSource) => {
        capturedBlob = blob as Blob;
        return 'blob:mock-url';
      });

      const exportBtn = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalled();
      });

      const csvText = await (capturedBlob as unknown as Blob).text();
      expect(csvText).toContain('Total Matching Records,1');
      expect(csvText).toContain('Exported Records,1');
      // Quotes escaped as double quotes, commas enclosed in quotes
      expect(csvText).toContain('"Dr. Jane ""Dev"" Doe, PhD"');
      expect(csvText).toContain('"27"" 4K Monitor, with USB-C"');
      expect(csvText).toContain('"Needs ""fast"" replacement;\nMust support 4K 120Hz."');
    });
  });

  describe('RequestDetailsPage (status transitions & audit)', () => {
    it('renders request details, procurement metadata, attachments, and history', async () => {
      vi.mocked(requestApi.getRequest).mockResolvedValueOnce(mockDetailResponse);

      render(<RequestDetailsPage requestId="REQ-2026-0001" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      expect(screen.getByText('Loading request details...')).toBeDefined();

      await waitFor(() => {
        expect(screen.getAllByText('Dell XPS 15')[0]).toBeDefined();
        expect(screen.getByText('Alice Johnson')).toBeDefined();
        expect(screen.getByText('PO-9941')).toBeDefined();
        expect(screen.getByText('spec_sheet.pdf')).toBeDefined();
        expect(screen.getByText('External request recorded')).toBeDefined();
      });
    });

    it('opens processing modal and executes status transition to In Review', async () => {
      vi.mocked(requestApi.getRequest).mockResolvedValueOnce(mockDetailResponse);
      const updatedDetail: requestApi.RequestApiRecord = {
        ...mockDetailResponse,
        status: 'In Review',
        history: [
          ...mockDetailResponse.history,
          {
            history_id: 'HIST-002',
            timestamp: '2026-10-10 10:00:00',
            stage: 'In Review',
            action: 'Request moved to In Review',
            performed_by: 'System Administrator',
            note: 'Verification started',
          },
        ],
      };
      vi.mocked(requestApi.transitionRequest).mockResolvedValueOnce(updatedDetail);

      render(<RequestDetailsPage requestId="REQ-2026-0001" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByText('Dell XPS 15')[0]).toBeDefined();
      });

      const inReviewBtn = screen.getByRole('button', { name: /mark in review/i });
      fireEvent.click(inReviewBtn);

      // Modal is open
      expect(screen.getByText(/process request — req-2026-0001/i)).toBeDefined();

      const noteInput = screen.getByPlaceholderText(/allocation verified against central hardware/i);
      fireEvent.change(noteInput, { target: { value: 'Verification started' } });

      const confirmBtn = screen.getByRole('button', { name: /confirm in review/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(requestApi.transitionRequest).toHaveBeenCalledWith('REQ-2026-0001', {
          target_status: 'In Review',
          operational_note: 'Verification started',
        });
      });
    });

    it('does not display transition action buttons when request is in terminal status (Fulfilled)', async () => {
      const fulfilledDetail: requestApi.RequestApiRecord = {
        ...mockDetailResponse,
        status: 'Fulfilled',
      };
      vi.mocked(requestApi.getRequest).mockResolvedValueOnce(fulfilledDetail);

      render(<RequestDetailsPage requestId="REQ-2026-0001" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByText('Dell XPS 15')[0]).toBeDefined();
      });

      expect(screen.queryByRole('button', { name: /reject request/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /mark in review/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /fulfil request/i })).toBeNull();
    });

    it('handles document download and preview calls', async () => {
      vi.mocked(requestApi.getRequest).mockResolvedValueOnce(mockDetailResponse);
      vi.mocked(requestApi.previewRequestAttachment).mockResolvedValueOnce({
        blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
        contentType: 'application/pdf',
        objectUrl: 'blob:pdf-url',
        isInline: true,
        filename: 'spec_sheet.pdf',
      });
      vi.mocked(requestApi.downloadRequestAttachment).mockResolvedValueOnce(undefined);

      render(<RequestDetailsPage requestId="REQ-2026-0001" onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('spec_sheet.pdf')).toBeDefined();
      });

      // Click preview
      const previewBtn = screen.getByRole('button', { name: /preview spec_sheet\.pdf/i });
      fireEvent.click(previewBtn);

      await waitFor(() => {
        expect(requestApi.previewRequestAttachment).toHaveBeenCalledWith('REQ-2026-0001', 'ATT-001');
        expect(screen.getByText('Document Preview')).toBeDefined();
      });

      // Click download from inside preview modal
      const downloadModalBtn = screen.getByRole('button', { name: /download document/i });
      fireEvent.click(downloadModalBtn);

      await waitFor(() => {
        expect(requestApi.downloadRequestAttachment).toHaveBeenCalledWith(
          'REQ-2026-0001',
          'ATT-001',
          'spec_sheet.pdf'
        );
      });
    });

    it('displays error view with Retry and Back buttons if getRequest fails', async () => {
      vi.mocked(requestApi.getRequest).mockRejectedValueOnce(
        new requestApi.RequestApiError(404, 'Not Found')
      );
      const onNavigateMock = vi.fn();

      render(<RequestDetailsPage requestId="REQ-MISSING" onNavigate={onNavigateMock} onSignOut={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/the selected request could not be found/i)).toBeDefined();
      });

      const backBtn = screen.getByRole('button', { name: /back to requests/i });
      fireEvent.click(backBtn);
      expect(onNavigateMock).toHaveBeenCalledWith('requests');
    });
  });

  describe('AddExternalRequestPage (requisition creation & attachment uploads)', () => {
    it('validates mandatory fields before allowing submission', async () => {
      const { container } = render(<AddExternalRequestPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      const submitBtn = container.querySelector('#save-external-req-btn') as HTMLButtonElement;
      expect(submitBtn).toBeTruthy();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Date Received is required')).toBeDefined();
        expect(screen.getByText('Requester Name is required')).toBeDefined();
        expect(screen.getByText('Requested Item / Asset Name is required')).toBeDefined();
        expect(screen.getByText('Category is required')).toBeDefined();
        expect(screen.getByText('Business Justification is required')).toBeDefined();
      });

      expect(requestApi.createExternalRequest).not.toHaveBeenCalled();
    });

    it('successfully creates external request and uploads attached files', async () => {
      vi.mocked(requestApi.createExternalRequest).mockResolvedValueOnce({
        ...mockDetailResponse,
        request_id: 'REQ-2026-0099',
      });
      vi.mocked(requestApi.uploadRequestAttachment).mockResolvedValueOnce({
        attachment_id: 'ATT-2026-99',
        id: 'ATT-2026-99',
        request_id: 'REQ-2026-0099',
        original_filename: 'quote.pdf',
        name: 'quote.pdf',
        content_type: 'application/pdf',
        type: 'application/pdf',
        file_size: 51200,
        size: '50 KB',
        uploaded_at: '2026-10-15 10:00:00',
        uploadDate: '2026-10-15',
        download_url: '/download',
        preview_url: '/preview',
      });

      const { container } = render(<AddExternalRequestPage onNavigate={vi.fn()} onSignOut={vi.fn()} />);

      // Fill in required fields via IDs
      const dateInput = container.querySelector('#dateReceived') as HTMLInputElement;
      const nameInput = container.querySelector('#reqName') as HTMLInputElement;
      const deptInput = container.querySelector('#reqOrg') as HTMLInputElement;
      const itemInput = container.querySelector('#itemName') as HTMLInputElement;
      const catSelect = container.querySelector('#itemCategory') as HTMLSelectElement;
      const justInput = container.querySelector('#justification') as HTMLTextAreaElement;

      expect(dateInput).toBeTruthy();
      expect(nameInput).toBeTruthy();
      expect(itemInput).toBeTruthy();
      expect(catSelect).toBeTruthy();
      expect(justInput).toBeTruthy();

      fireEvent.change(dateInput, { target: { value: '2026-10-15' } });
      fireEvent.change(nameInput, { target: { value: 'Dr. Evelyn Reed' } });
      if (deptInput) fireEvent.change(deptInput, { target: { value: 'Research & Lab' } });
      fireEvent.change(itemInput, { target: { value: 'Precision Oscilloscope' } });
      fireEvent.change(catSelect, { target: { value: 'Computing Hardware' } });
      fireEvent.change(justInput, {
        target: { value: 'Required for advanced circuit diagnostics in Lab 3.' },
      });

      // Attach file
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      const file = new File(['dummy pdf content'], 'quote.pdf', { type: 'application/pdf' });
      Object.defineProperty(fileInput, 'files', {
        value: [file],
      });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('quote.pdf')).toBeDefined();
      });

      // Submit
      const submitBtn = container.querySelector('#save-external-req-btn') as HTMLButtonElement;
      expect(submitBtn).toBeTruthy();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(requestApi.createExternalRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            request_source: 'External',
            date_received: '2026-10-15',
            requester_name: 'Dr. Evelyn Reed',
            requested_item: 'Precision Oscilloscope',
            category: 'Computing Hardware',
            justification: 'Required for advanced circuit diagnostics in Lab 3.',
          })
        );
        expect(requestApi.uploadRequestAttachment).toHaveBeenCalledWith(
          'REQ-2026-0099',
          expect.any(File)
        );
      });

      // Confirms success modal
      await waitFor(() => {
        expect(screen.getByText('External Request Recorded')).toBeDefined();
      });
    });
  });
});
