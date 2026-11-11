import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchGuardEscalationRegister,
  fetchAllGuardEscalationsForExport,
} from '../guardEscalationsApi';

vi.mock('../session', () => ({
  getToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

describe('guardEscalationsApi - fetchGuardEscalationRegister', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds query parameters, sends Authorization header, and maps response correctly', async () => {
    const mockApiResponse = {
      items: [
        {
          id: 'ESC-GP-2026-0001',
          pass_id: 'GP-2026-0001',
          asset_id: 'AST-1001',
          asset_name: 'Dell Server R750',
          requester_name: 'Elena Rostova',
          department: 'Hardware Eng',
          destination: 'Data Center B',
          pass_type: 'Returnable',
          gate_pass_status: 'Escalated',
          hold_status: 'Active',
          hold_status_title: 'Active Escalation Hold',
          escalation_reason: 'Serial tag mismatch',
          action_required: 'Physical inspection',
          escalated_by: 'Guard Officer Vance',
          escalation_timestamp: '2026-05-24T14:10:00Z',
          date_display: 'May 24, 2026',
          time_display: '14:10:00 UTC',
          checkpoint: 'Gate-01A Main Gate',
          override_by: null,
          override_timestamp: null,
          override_note: null,
          timeline: [
            {
              id: 'EV-1',
              timestamp: '2026-05-24T14:10:00Z',
              event: 'Checkpoint Escalation Hold',
              actor: 'Guard Officer Vance',
              actor_role: 'Guard Officer',
              note: 'Discrepancy tagged',
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
      kpis: {
        total_holds: 1,
        active_holds: 1,
        cleared_overridden: 0,
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as any);

    const result = await fetchGuardEscalationRegister({
      search: 'GP-2026',
      status: 'Active',
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
      page: 1,
      pageSize: 10,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/gate-passes/escalation-register?');
    expect(calledUrl).toContain('search=GP-2026');
    expect(calledUrl).toContain('status=Active');
    expect(calledUrl).toContain('from_date=2026-05-01');
    expect(calledUrl).toContain('to_date=2026-05-31');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('page_size=10');

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].passId).toBe('GP-2026-0001');
    expect(result.items[0].holdStatus).toBe('Active');
    expect(result.items[0].timeline[0].actorRole).toBe('Guard Officer');
    expect(result.kpis.totalHolds).toBe(1);
    expect(result.kpis.activeHolds).toBe(1);
    expect(result.kpis.clearedOverridden).toBe(0);
  });

  it('throws GuardEscalationApiError on non-ok HTTP responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Permission denied' }),
    } as any);

    await expect(fetchGuardEscalationRegister({})).rejects.toThrow('Permission denied');
  });
});

describe('guardEscalationsApi - fetchAllGuardEscalationsForExport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches multi-page escalation records, notifies progress, and deduplicates by passId', async () => {
    const page1Data = {
      items: [
        {
          id: 'ESC-1',
          pass_id: 'GP-001',
          asset_id: 'AST-01',
          asset_name: 'Asset 1',
          hold_status: 'Active',
          gate_pass_status: 'Escalated',
          timeline: [],
        },
        {
          id: 'ESC-2',
          pass_id: 'GP-002',
          asset_id: 'AST-02',
          asset_name: 'Asset 2',
          hold_status: 'Cleared',
          gate_pass_status: 'Approved',
          timeline: [],
        },
      ],
      total: 3,
      page: 1,
      page_size: 2,
      total_pages: 2,
      kpis: { total_holds: 3, active_holds: 2, cleared_overridden: 1 },
    };

    const page2Data = {
      items: [
        // Duplicate pass_id from page 1 due to concurrent record insertion
        {
          id: 'ESC-2-dup',
          pass_id: 'GP-002',
          asset_id: 'AST-02',
          asset_name: 'Asset 2',
          hold_status: 'Cleared',
          gate_pass_status: 'Approved',
          timeline: [],
        },
        {
          id: 'ESC-3',
          pass_id: 'GP-003',
          asset_id: 'AST-03',
          asset_name: 'Asset 3',
          hold_status: 'Active',
          gate_pass_status: 'Escalated',
          timeline: [],
        },
      ],
      total: 3,
      page: 2,
      page_size: 2,
      total_pages: 2,
      kpis: { total_holds: 3, active_holds: 2, cleared_overridden: 1 },
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page1Data,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page2Data,
      } as any);

    const progressCalls: [number, number][] = [];
    const onProgress = (loaded: number, total: number) => {
      progressCalls.push([loaded, total]);
    };

    const exportItems = await fetchAllGuardEscalationsForExport({}, onProgress);

    // Should deduplicate GP-002: resulting in 3 unique items (GP-001, GP-002, GP-003)
    expect(exportItems).toHaveLength(3);
    expect(exportItems.map((i) => i.passId)).toEqual(['GP-001', 'GP-002', 'GP-003']);
    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
  });
});
