import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllGuardMovementLogsForExport } from '../guardLogsApi';

vi.mock('../session', () => ({
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

describe('guardLogsApi - fetchAllGuardMovementLogsForExport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches all pages sequentially, notifies progress, and deduplicates records', async () => {
    const page1Response = {
      items: [
        {
          id: 'LOG-001',
          pass_id: 'GP-001',
          action: 'Exit Verification',
          category: 'Physical Movement',
          direction: 'Outward',
          direction_label: 'Outward / Exit',
          timestamp: '2026-05-24T10:00:00Z',
          date_display: 'May 24, 2026',
          time_display: '10:00:00 UTC',
          status: 'Cleared',
          performed_by: 'Officer A',
          guard_badge: 'SEC-1',
          checkpoint: 'Gate-01',
          requester_name: 'Elena',
          department: 'Eng',
          asset_or_item: 'Server',
          serial_number: 'SN-01',
          total_qty: 1,
          manifest_hash: 'Standard Manifest (No Hash Stored)',
          tamper_seal_id: 'N/A',
          discrepancy_details: null,
          note: 'Cleared',
          timeline: [],
        },
        {
          id: 'LOG-002',
          pass_id: 'GP-002',
          action: 'Entry Verification',
          category: 'Physical Movement',
          direction: 'Inward',
          direction_label: 'Inward / Entry',
          timestamp: '2026-05-24T11:00:00Z',
          date_display: 'May 24, 2026',
          time_display: '11:00:00 UTC',
          status: 'Cleared',
          performed_by: 'Officer B',
          guard_badge: 'SEC-2',
          checkpoint: 'Gate-02',
          requester_name: 'Viktor',
          department: 'Ops',
          asset_or_item: 'Switch',
          serial_number: 'SN-02',
          total_qty: 1,
          manifest_hash: 'Standard Manifest (No Hash Stored)',
          tamper_seal_id: 'N/A',
          discrepancy_details: null,
          note: 'Cleared',
          timeline: [],
        },
      ],
      total: 3,
      page: 1,
      page_size: 2,
      total_pages: 2,
      kpis: {
        total_records: 3,
        total_movements: 3,
        inbound_entries: 1,
        outbound_exits: 2,
        flagged_movements: 0,
      },
    };

    const page2Response = {
      items: [
        // Includes LOG-002 again (simulating duplicate item shifted across page boundaries due to concurrent insertion)
        {
          id: 'LOG-002',
          pass_id: 'GP-002',
          action: 'Entry Verification',
          category: 'Physical Movement',
          direction: 'Inward',
          direction_label: 'Inward / Entry',
          timestamp: '2026-05-24T11:00:00Z',
          date_display: 'May 24, 2026',
          time_display: '11:00:00 UTC',
          status: 'Cleared',
          performed_by: 'Officer B',
          guard_badge: 'SEC-2',
          checkpoint: 'Gate-02',
          requester_name: 'Viktor',
          department: 'Ops',
          asset_or_item: 'Switch',
          serial_number: 'SN-02',
          total_qty: 1,
          manifest_hash: 'Standard Manifest (No Hash Stored)',
          tamper_seal_id: 'N/A',
          discrepancy_details: null,
          note: 'Cleared',
          timeline: [],
        },
        {
          id: 'LOG-003',
          pass_id: 'GP-003',
          action: 'Exit Verification',
          category: 'Physical Movement',
          direction: 'Outward',
          direction_label: 'Outward / Exit',
          timestamp: '2026-05-24T12:00:00Z',
          date_display: 'May 24, 2026',
          time_display: '12:00:00 UTC',
          status: 'Cleared',
          performed_by: 'Officer A',
          guard_badge: 'SEC-1',
          checkpoint: 'Gate-01',
          requester_name: 'Sarah',
          department: 'Security',
          asset_or_item: 'Router',
          serial_number: 'SN-03',
          total_qty: 1,
          manifest_hash: 'Standard Manifest (No Hash Stored)',
          tamper_seal_id: 'N/A',
          discrepancy_details: null,
          note: 'Cleared',
          timeline: [],
        },
      ],
      total: 3,
      page: 2,
      page_size: 2,
      total_pages: 2,
      kpis: {
        total_records: 3,
        total_movements: 3,
        inbound_entries: 1,
        outbound_exits: 2,
        flagged_movements: 0,
      },
    };

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      const urlObj = new URL(url, 'http://localhost');
      const page = urlObj.searchParams.get('page');
      const body = page === '2' ? page2Response : page1Response;
      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as Response;
    });

    const progressCalls: Array<{ loaded: number; total: number }> = [];
    const results = await fetchAllGuardMovementLogsForExport(
      { direction: 'Movements' },
      (loaded, total) => {
        progressCalls.push({ loaded, total });
      }
    );

    // Verify both pages were requested
    expect(callCount).toBe(2);

    // Verify deduplication: 3 unique items returned (LOG-001, LOG-002, LOG-003) despite LOG-002 being returned on page 2
    expect(results.length).toBe(3);
    expect(results.map((r) => r.id)).toEqual(['LOG-001', 'LOG-002', 'LOG-003']);

    // Verify progress callbacks fired
    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    expect(progressCalls[progressCalls.length - 1]).toEqual({ loaded: 3, total: 3 });
  });
});
