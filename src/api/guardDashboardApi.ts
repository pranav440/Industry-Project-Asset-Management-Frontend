import { getToken } from '../auth/session';
import type {
  GuardKpis,
  GuardVerificationQueueItem,
  GuardRecentActivityItem,
  GuardUpcomingMovementItem,
  GuardCheckpointAlertItem,
} from '../data/guardData';

export interface GuardDashboardApiResponse {
  kpis: GuardKpis;
  verificationQueue: GuardVerificationQueueItem[];
  recentActivity: GuardRecentActivityItem[];
  upcomingMovements: GuardUpcomingMovementItem[];
  checkpointAlerts: GuardCheckpointAlertItem[];
}

export class GuardDashboardApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GuardDashboardApiError';
  }
}

export async function fetchGuardDashboard(): Promise<GuardDashboardApiResponse> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch('/api/dashboard/guard', {
    method: 'GET',
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as {
    detail?: string | { msg: string }[];
    kpis?: any;
    verificationQueue?: any[];
    verification_queue?: any[];
    recentActivity?: any[];
    recent_activity?: any[];
    upcomingMovements?: any[];
    upcoming_movements?: any[];
    checkpointAlerts?: any[];
    checkpoint_alerts?: any[];
  };

  if (!response.ok) {
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
    throw new GuardDashboardApiError(
      response.status,
      detail || `Failed to fetch guard dashboard data (${response.status})`
    );
  }

  const rawKpis = body.kpis || {};
  const kpis: GuardKpis = {
    expectedInbound: {
      total: rawKpis.expectedInbound?.total ?? rawKpis.expected_inbound?.total ?? 0,
      badgeText: rawKpis.expectedInbound?.badgeText ?? rawKpis.expected_inbound?.badge_text ?? '0 awaiting return',
      subtext: rawKpis.expectedInbound?.subtext ?? rawKpis.expected_inbound?.subtext ?? 'Active returnable passes',
    },
    expectedOutbound: {
      total: rawKpis.expectedOutbound?.total ?? rawKpis.expected_outbound?.total ?? 0,
      badgeText: rawKpis.expectedOutbound?.badgeText ?? rawKpis.expected_outbound?.badge_text ?? '0 pending clearance',
      subtext: rawKpis.expectedOutbound?.subtext ?? rawKpis.expected_outbound?.subtext ?? 'Authorized dispatches',
    },
    pendingVerification: {
      total: rawKpis.pendingVerification?.total ?? rawKpis.pending_verification?.total ?? 0,
      badgeText: rawKpis.pendingVerification?.badgeText ?? rawKpis.pending_verification?.badge_text ?? 'Queue Clear',
      subtext: rawKpis.pendingVerification?.subtext ?? rawKpis.pending_verification?.subtext ?? 'Physical barrier queue',
    },
    todaysCompletedEntries: {
      total: rawKpis.todaysCompletedEntries?.total ?? rawKpis.todays_completed_entries?.total ?? 0,
      badgeText: rawKpis.todaysCompletedEntries?.badgeText ?? rawKpis.todays_completed_entries?.badge_text ?? 'Verified Today',
      subtext: rawKpis.todaysCompletedEntries?.subtext ?? rawKpis.todays_completed_entries?.subtext ?? 'Cleared checkpoint logs',
    },
  };

  const verificationQueue: GuardVerificationQueueItem[] = (
    body.verificationQueue || body.verification_queue || []
  ).map((item: any) => ({
    id: item.id || item.pass_id,
    requesterName: item.requesterName || item.requester_name || 'Staff',
    requesterBadge: item.requesterBadge || item.requester_badge || item.department || 'Staff',
    department: item.department || 'Administration',
    assetName: item.assetName || item.asset_name || 'Equipment',
    serialNumber: item.serialNumber || item.serial_number || '—',
    type: item.type || 'Outbound',
    status: item.status || 'Awaiting Exit',
    action: item.action || 'verify',
    carrier: item.carrier,
    destination: item.destination,
    origin: item.origin,
    flagReason: item.flagReason || item.flag_reason,
  }));

  const recentActivity: GuardRecentActivityItem[] = (
    body.recentActivity || body.recent_activity || []
  ).map((item: any) => ({
    id: item.id || item.history_id,
    title: item.title,
    time: item.time,
    passId: item.passId || item.pass_id,
    plateOrBadge: item.plateOrBadge || item.plate_or_badge || '',
    assetName: item.assetName || item.asset_name || '',
    notes: item.notes || '',
    badgeText: item.badgeText || item.badge_text || '',
    isFlagged: Boolean(item.isFlagged || item.is_flagged),
    type: item.type || 'entry',
  }));

  const upcomingMovements: GuardUpcomingMovementItem[] = (
    body.upcomingMovements || body.upcoming_movements || []
  ).map((item: any) => ({
    id: item.id,
    time: item.time,
    title: item.title,
    type: item.type || 'Outbound',
    personLabel: item.personLabel || item.person_label || 'Requester',
    personName: item.personName || item.person_name || '',
    details: item.details || '',
    statusBadge: item.statusBadge || item.status_badge || '',
  }));

  const checkpointAlerts: GuardCheckpointAlertItem[] = (
    body.checkpointAlerts || body.checkpoint_alerts || []
  ).map((item: any) => ({
    id: item.id,
    title: item.title,
    severity: item.severity || 'warning',
    badgeText: item.badgeText || item.badge_text || 'Flag',
    icon: item.icon || 'gpp_maybe',
    description: item.description,
    passId: item.passId || item.pass_id,
    serialNumber: item.serialNumber || item.serial_number,
    acknowledged: Boolean(item.acknowledged),
  }));

  return {
    kpis,
    verificationQueue,
    recentActivity,
    upcomingMovements,
    checkpointAlerts,
  };
}

