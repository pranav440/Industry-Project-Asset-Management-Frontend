import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { fetchGuardDashboard } from '../api/guardDashboardApi';
import type {
  GuardKpis,
  GuardVerificationQueueItem,
  GuardRecentActivityItem,
  GuardUpcomingMovementItem,
  GuardCheckpointAlertItem,
} from '../data/guardData';
import './GuardDashboard.css';

interface GuardDashboardPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

export const GuardDashboardPage: React.FC<GuardDashboardPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Loading & Error State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Dashboard Data State
  const [kpis, setKpis] = useState<GuardKpis>({
    expectedInbound: { total: 0, badgeText: '0 awaiting return', subtext: 'Active returnable passes' },
    expectedOutbound: { total: 0, badgeText: '0 pending clearance', subtext: 'Authorized dispatches' },
    pendingVerification: { total: 0, badgeText: 'Queue Clear', subtext: 'Physical barrier queue' },
    todaysCompletedEntries: { total: 0, badgeText: 'Verified Today', subtext: 'Cleared checkpoint logs' },
  });

  const [queueItems, setQueueItems] = useState<GuardVerificationQueueItem[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [activityFeed, setActivityFeed] = useState<GuardRecentActivityItem[]>([]);
  const [upcomingMovements, setUpcomingMovements] = useState<GuardUpcomingMovementItem[]>([]);
  const [alerts, setAlerts] = useState<GuardCheckpointAlertItem[]>([]);

  // Modal States
  const [verifyingItem, setVerifyingItem] = useState<GuardVerificationQueueItem | null>(null);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [reviewingAlert, setReviewingAlert] = useState<GuardCheckpointAlertItem | null>(null);

  // Verification Checklist State inside Modal
  const [tagVerified, setTagVerified] = useState(false);
  const [sealIntact, setSealIntact] = useState(false);
  const [driverIdVerified, setDriverIdVerified] = useState(false);
  const [checkpointNotes, setCheckpointNotes] = useState('');

  // Incident Modal State
  const [incidentType, setIncidentType] = useState('Tag / Serial Discrepancy');
  const [incidentSeverity, setIncidentSeverity] = useState<'critical' | 'warning' | 'notice'>('warning');
  const [incidentGate, setIncidentGate] = useState('Gate-01A Main Gate');
  const [incidentVehicle, setIncidentVehicle] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3600);
  };

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGuardDashboard();
      setKpis(data.kpis);
      setQueueItems(data.verificationQueue);
      setActivityFeed(data.recentActivity);
      setUpcomingMovements(data.upcomingMovements);
      setAlerts(data.checkpointAlerts);
    } catch (err: any) {
      setError(err.message || 'Failed to load guard dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Filtered Queue
  const filteredQueue = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return queueItems;
    return queueItems.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.requesterName.toLowerCase().includes(q) ||
        item.requesterBadge.toLowerCase().includes(q) ||
        item.assetName.toLowerCase().includes(q) ||
        item.serialNumber.toLowerCase().includes(q) ||
        (item.carrier && item.carrier.toLowerCase().includes(q))
    );
  }, [queueItems, filterQuery]);

  // Active items count (actionable passes requiring Guard verification vs on-hold)
  const pendingActionableCount = useMemo(() => {
    return queueItems.filter((i) => i.action === 'verify').length;
  }, [queueItems]);

  const onHoldCount = useMemo(() => {
    return queueItems.filter((i) => i.action === 'flagged').length;
  }, [queueItems]);

  const activeAlertsCount = useMemo(() => {
    return alerts.filter((a) => !a.acknowledged).length;
  }, [alerts]);

  // Handlers for Gate Pass Verification
  const openVerifyModal = (item?: GuardVerificationQueueItem) => {
    const target = item || queueItems.find((i) => i.action === 'verify') || queueItems[0];
    if (!target) {
      showToast('No gate pass selected for verification.');
      return;
    }
    setVerifyingItem(target);
    setTagVerified(false);
    setSealIntact(false);
    setDriverIdVerified(false);
    setCheckpointNotes('');
  };

  const closeVerifyModal = () => {
    setVerifyingItem(null);
  };

  const handleAuthorizeAndClear = () => {
    if (!verifyingItem) return;

    // Update queue item
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === verifyingItem.id
          ? { ...item, status: 'Cleared', action: 'cleared' }
          : item
      )
    );

    // Update Completed count in KPIs
    setKpis((prev) => ({
      ...prev,
      todaysCompletedEntries: {
        ...prev.todaysCompletedEntries,
        total: prev.todaysCompletedEntries.total + 1,
      },
    }));

    // Prepend to Activity Feed
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    const newActivity: GuardRecentActivityItem = {
      id: `ACT-${Date.now()}`,
      title: verifyingItem.type.includes('Inbound') ? 'Record Entry / Cleared' : 'Record Exit / Cleared',
      time: timeStr,
      passId: verifyingItem.id,
      plateOrBadge: verifyingItem.carrier || verifyingItem.requesterBadge,
      assetName: verifyingItem.assetName,
      notes: checkpointNotes || 'Physical checkpoint inspection completed by Guard',
      badgeText: 'Barrier Cleared',
      type: verifyingItem.type.includes('Inbound') ? 'entry' : 'exit',
    };
    setActivityFeed((prev) => [newActivity, ...prev.slice(0, 9)]);

    showToast(`Gate Pass ${verifyingItem.id} authorized. Physical clearance logged.`);
    closeVerifyModal();
  };

  const handleRaiseDiscrepancy = () => {
    if (!verifyingItem) return;

    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === verifyingItem.id
          ? {
              ...item,
              status: 'Flagged',
              action: 'flagged',
              flagReason: checkpointNotes || 'Discrepancy flagged during checkpoint physical verification.',
            }
          : item
      )
    );

    // Add alert
    const newAlert: GuardCheckpointAlertItem = {
      id: `ALT-G${Date.now()}`,
      title: 'Gate Pass Discrepancy Flagged',
      severity: 'critical',
      badgeText: 'Critical',
      icon: 'gpp_maybe',
      passId: verifyingItem.id,
      serialNumber: verifyingItem.serialNumber,
      description: `${verifyingItem.id}: Physical verification flagged for ${verifyingItem.assetName}. ${
        checkpointNotes || 'Secondary inspection required prior to clearance.'
      }`,
      acknowledged: false,
    };
    setAlerts((prev) => [newAlert, ...prev]);

    showToast(`Pass ${verifyingItem.id} flagged. Secondary inspection required.`);
    closeVerifyModal();
  };

  // Handlers for Alerts
  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
    showToast('Discrepancy alert acknowledged.');
  };

  // Incident Modal Handler
  const handleSubmitIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDesc.trim()) {
      showToast('Please provide an incident description.');
      return;
    }

    const newAlert: GuardCheckpointAlertItem = {
      id: `ALT-G${Date.now()}`,
      title: incidentType,
      severity: incidentSeverity,
      badgeText: incidentSeverity.charAt(0).toUpperCase() + incidentSeverity.slice(1),
      icon: incidentSeverity === 'critical' ? 'gpp_maybe' : incidentSeverity === 'warning' ? 'schedule' : 'no_crash',
      description: `[${incidentGate}] ${incidentDesc} ${incidentVehicle ? `(Vehicle/Badge: ${incidentVehicle})` : ''}`,
      acknowledged: false,
    };

    setAlerts((prev) => [newAlert, ...prev]);
    setIsIncidentModalOpen(false);
    setIncidentDesc('');
    setIncidentVehicle('');
    showToast(`Security incident logged at ${incidentGate}.`);
  };

  return (
    <DashboardLayout
      currentNav="Guard Dashboard"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="amx-guard-container">
        {/* ==============================================================
            PAGE HEADER & BREADCRUMBS
            ============================================================== */}
        <div className="amx-guard-header-row">
          <div className="amx-guard-header-left">
            <div className="amx-guard-breadcrumbs">
              <span className="amx-guard-crumb-parent">Checkpoint</span>
              <span className="amx-guard-crumb-sep">/</span>
              <span className="amx-guard-crumb-current">Guard Dashboard</span>
              <span className="amx-guard-node-chip">
                <span className="amx-guard-node-dot"></span>
                Active Perimeter Node • Main Checkpoint
              </span>
            </div>
            <h1 className="amx-guard-title">Guard Dashboard</h1>
            <p className="amx-guard-subtitle">
              Monitor checkpoint activity and verify scheduled asset movements in real time.
            </p>
          </div>

          <div className="amx-guard-header-actions">
            <button
              type="button"
              className="amx-guard-btn-secondary"
              title="Checkpoint incident logging only (no override permissions)"
              onClick={() => setIsIncidentModalOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">
                report_problem
              </span>
              Log Incident Report
            </button>

            <button
              type="button"
              className="amx-guard-btn-primary"
              title="Inspect and verify physical asset movement"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('gate-verification');
                } else {
                  openVerifyModal();
                }
              }}
            >
              <span className="material-symbols-outlined text-[18px]">
                qr_code_scanner
              </span>
              Verify Gate Pass
            </button>
          </div>
        </div>

        {/* Error Banner with Retry */}
        {error && (
          <div className="amx-guard-error-banner" role="alert">
            <span className="material-symbols-outlined text-[20px] text-[#ba1a1a]">error</span>
            <div className="amx-guard-error-message">
              <strong>Failed to load dashboard data:</strong> {error}
            </div>
            <button
              type="button"
              className="amx-guard-btn-retry"
              onClick={loadDashboardData}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Spinner / Indicator */}
        {loading && (
          <div className="amx-guard-loading-state" role="status" aria-live="polite">
            <span className="material-symbols-outlined animate-spin text-[20px] text-[#00687a]">
              progress_activity
            </span>
            <span>Loading checkpoint operational data...</span>
          </div>
        )}

        {/* ==============================================================
            KPI SUMMARY CARDS
            ============================================================== */}
        <div className="amx-guard-kpi-grid">
          {/* KPI 1: Expected Inbound */}
          <div className="amx-guard-kpi-card">
            <div className="amx-guard-kpi-top">
              <div>
                <span className="amx-guard-kpi-label">Expected Inbound</span>
                <div className="amx-guard-kpi-value">
                  {kpis.expectedInbound.total}
                </div>
              </div>
              <div className="amx-guard-kpi-icon-box amx-guard-kpi-icon-default">
                <span className="material-symbols-outlined text-[22px]">south_west</span>
              </div>
            </div>
            <div className="amx-guard-kpi-bottom">
              <span className="amx-guard-kpi-subtext">
                {kpis.expectedInbound.subtext}
              </span>
              <span className="amx-guard-kpi-pill amx-guard-kpi-pill-neutral">
                {kpis.expectedInbound.badgeText}
              </span>
            </div>
          </div>

          {/* KPI 2: Expected Outbound */}
          <div className="amx-guard-kpi-card">
            <div className="amx-guard-kpi-top">
              <div>
                <span className="amx-guard-kpi-label">Expected Outbound</span>
                <div className="amx-guard-kpi-value">
                  {kpis.expectedOutbound.total}
                </div>
              </div>
              <div className="amx-guard-kpi-icon-box amx-guard-kpi-icon-cyan">
                <span className="material-symbols-outlined text-[22px]">north_east</span>
              </div>
            </div>
            <div className="amx-guard-kpi-bottom">
              <span className="amx-guard-kpi-subtext">
                {kpis.expectedOutbound.subtext}
              </span>
              <span className="amx-guard-kpi-pill amx-guard-kpi-pill-cyan">
                {kpis.expectedOutbound.badgeText}
              </span>
            </div>
          </div>

          {/* KPI 3: Pending Gate Verification */}
          <div className="amx-guard-kpi-card">
            <div className="amx-guard-kpi-top">
              <div>
                <span className="amx-guard-kpi-label">Pending Gate Verification</span>
                <div className="amx-guard-kpi-value">
                  {loading ? '...' : kpis.pendingVerification.total}
                </div>
              </div>
              <div className="amx-guard-kpi-icon-box amx-guard-kpi-icon-danger">
                <span className="material-symbols-outlined text-[22px]">pending_actions</span>
              </div>
            </div>
            <div className="amx-guard-kpi-bottom">
              <span className="amx-guard-kpi-subtext">
                {kpis.pendingVerification.subtext}
              </span>
              <span className="amx-guard-kpi-pill amx-guard-kpi-pill-danger">
                <span className="amx-guard-pulse-dot"></span>
                {kpis.pendingVerification.badgeText}
              </span>
            </div>
          </div>

          {/* KPI 4: Today's Completed Entries */}
          <div className="amx-guard-kpi-card">
            <div className="amx-guard-kpi-top">
              <div>
                <span className="amx-guard-kpi-label">Today's Completed Entries</span>
                <div className="amx-guard-kpi-value">
                  {loading ? '...' : kpis.todaysCompletedEntries.total}
                </div>
              </div>
              <div className="amx-guard-kpi-icon-box amx-guard-kpi-icon-neutral">
                <span className="material-symbols-outlined text-[22px]">verified</span>
              </div>
            </div>
            <div className="amx-guard-kpi-bottom">
              <span className="amx-guard-kpi-subtext">
                {kpis.todaysCompletedEntries.subtext}
              </span>
              <span className="amx-guard-kpi-pill amx-guard-kpi-pill-neutral">
                <span className="material-symbols-outlined text-[14px]">check</span>
                {kpis.todaysCompletedEntries.badgeText}
              </span>
            </div>
          </div>
        </div>

        {/* ==============================================================
            MAIN OPERATIONAL SECTION (62% Queue / 38% Live Feed)
            ============================================================== */}
        <div className="amx-guard-main-grid">
          {/* LEFT: Verification Queue */}
          <div className="amx-guard-queue-card">
            <div className="amx-guard-card-header">
              <div className="amx-guard-card-title-group">
                <h2 className="amx-guard-card-title">Gate Verification Queue</h2>
                <span className="amx-guard-count-badge">
                  {pendingActionableCount} Pending Verification{onHoldCount > 0 ? ` • ${onHoldCount} On Hold` : ''}
                </span>
              </div>
              <div className="amx-guard-search-wrap">
                <span className="material-symbols-outlined amx-guard-search-icon">
                  filter_list
                </span>
                <input
                  type="text"
                  className="amx-guard-search-input"
                  placeholder="Filter pass, asset, badge..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="amx-guard-table-wrap">
              <table className="amx-guard-table">
                <thead>
                  <tr>
                    <th>Pass ID</th>
                    <th>Requester</th>
                    <th>Asset / Equipment</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#76777d' }}>
                        {loading
                          ? 'Loading gate passes in queue...'
                          : queueItems.length === 0
                          ? 'No gate passes currently in verification queue.'
                          : `No gate passes matching "${filterQuery}".`}
                      </td>
                    </tr>
                  ) : (
                    filteredQueue.map((item) => {
                      const isInbound = item.type === 'Inbound';
                      const isReturn = item.type === 'Inbound Return';

                      let typeClass = 'amx-guard-type-outbound';
                      if (isInbound) typeClass = 'amx-guard-type-inbound';
                      if (isReturn) typeClass = 'amx-guard-type-return';

                      let statusClass = 'amx-guard-status-awaiting-exit';
                      let statusIcon = 'north_east';
                      if (item.status === 'Awaiting Entry') {
                        statusClass = 'amx-guard-status-awaiting-entry';
                        statusIcon = 'south_west';
                      } else if (item.status === 'Flagged') {
                        statusClass = 'amx-guard-status-flagged';
                        statusIcon = 'flag';
                      } else if (item.status === 'In Transit') {
                        statusClass = 'amx-guard-status-in-transit';
                        statusIcon = 'local_shipping';
                      } else if (item.status === 'Cleared') {
                        statusClass = 'amx-guard-status-cleared';
                        statusIcon = 'verified';
                      }

                      return (
                        <tr key={item.id}>
                          <td>
                            <span className="amx-guard-pass-id">{item.id}</span>
                          </td>
                          <td>
                            <div className="amx-guard-table-person">
                              <span className="amx-guard-person-name">{item.requesterName}</span>
                              <span className="amx-guard-person-badge">{item.requesterBadge}</span>
                            </div>
                          </td>
                          <td>
                            <div className="amx-guard-table-asset">
                              <span className="amx-guard-asset-name">{item.assetName}</span>
                              <span className="amx-guard-asset-sn">SN: {item.serialNumber}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`amx-guard-type-badge ${typeClass}`}>
                              {item.type}
                            </span>
                          </td>
                          <td>
                            <span className={`amx-guard-status-pill ${statusClass}`}>
                              <span className="material-symbols-outlined text-[14px]">
                                {statusIcon}
                              </span>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.action === 'verify' && (
                              <button
                                type="button"
                                className="amx-guard-btn-verify-action"
                                onClick={() => {
                                  if (onNavigate) {
                                    onNavigate(`gate-pass/${item.id}/verification`);
                                  } else {
                                    openVerifyModal(item);
                                  }
                                }}
                              >
                                Verify
                              </button>
                            )}
                            {item.action === 'flagged' && (
                              <span className="amx-guard-action-onhold">
                                <span className="material-symbols-outlined text-[13px] text-[#ba1a1a]">
                                  lock
                                </span>
                                On Hold
                              </span>
                            )}
                            {item.action === 'cleared' && (
                              <span className="amx-guard-action-completed">
                                <span className="material-symbols-outlined text-[14px] text-[#00687a]">
                                  check_circle
                                </span>
                                Completed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="amx-guard-card-footer">
              <span>Showing {filteredQueue.length} of {queueItems.length} active passes in queue</span>
              <button
                type="button"
                className="amx-guard-link"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('gate-pass');
                  } else {
                    setFilterQuery('');
                    showToast('Viewing all checkpoint queue records.');
                  }
                }}
              >
                View All Gate Passes
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* RIGHT: Recent Gate Activity */}
          <div className="amx-guard-activity-card">
            <div className="amx-guard-activity-header">
              <h2 className="amx-guard-card-title">Recent Gate Activity</h2>
              <span className="amx-guard-node-tag">Perimeter Node</span>
            </div>

            <div className="amx-guard-activity-list">
              {activityFeed.length === 0 ? (
                <div className="amx-guard-empty-state">
                  {loading ? 'Loading recent activity...' : 'No recent checkpoint activity recorded.'}
                </div>
              ) : (
                activityFeed.map((act) => {
                  const isFlag = act.type === 'flagged' || act.isFlagged;
                  return (
                    <div
                      key={act.id}
                      className={`amx-guard-activity-item ${
                        isFlag ? 'amx-guard-activity-item-flagged' : ''
                      }`}
                    >
                      <div className="amx-guard-activity-top">
                        <span
                          className={`amx-guard-activity-title ${
                            isFlag ? 'amx-guard-activity-title-flagged' : ''
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isFlag
                              ? 'warning'
                              : act.type === 'entry'
                              ? 'login'
                              : act.plateOrBadge.startsWith('Badge')
                              ? 'badge'
                              : 'logout'}
                          </span>
                          {act.title}
                        </span>
                        <span className="amx-guard-activity-time">{act.time}</span>
                      </div>

                      <div className="amx-guard-activity-details">
                        <div className="amx-guard-activity-pass-row">
                          <span>
                            Pass:{' '}
                            <strong className="font-mono text-[#191c1e]">
                              {act.passId}
                            </strong>
                          </span>
                          <span className="font-mono">{act.plateOrBadge}</span>
                        </div>
                        <div>
                          Asset: <span>{act.assetName}</span>
                        </div>
                      </div>

                      <div className="amx-guard-activity-footer">
                        <span
                          className={`amx-guard-activity-note ${
                            isFlag ? 'amx-guard-activity-note-danger' : ''
                          }`}
                        >
                          {act.notes}
                        </span>
                        {act.badgeText === 'Barrier Cleared' && (
                          <span className="amx-guard-badge-cleared">
                            <span className="material-symbols-outlined text-[12px]">done_all</span>
                            Barrier Cleared
                          </span>
                        )}
                        {act.badgeText === 'Logged Entry' && (
                          <span className="amx-guard-badge-logged">Logged Entry</span>
                        )}
                        {act.badgeText === 'Discrepancy' && (
                          <span className="amx-guard-badge-discrepancy">Discrepancy</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="amx-guard-feed-footer">
              <span className="amx-guard-feed-status">
                <span className="amx-guard-node-dot"></span>
                Activity Feed Active
              </span>
              <span>(Live Checkpoint Records)</span>
            </div>
          </div>
        </div>

        {/* ==============================================================
            LOWER OPERATIONAL SECTION (Upcoming Movements / Alerts 50/50)
            ============================================================== */}
        <div className="amx-guard-lower-grid">
          {/* UPCOMING MOVEMENTS (Scheduled for Today) */}
          <div className="amx-guard-panel-card">
            <div>
              <div className="amx-guard-card-header" style={{ padding: 0, marginBottom: 16 }}>
                <div className="amx-guard-card-title-group">
                  <h2 className="amx-guard-card-title">Upcoming Movements</h2>
                  <span className="text-xs text-[#45464d]">(Scheduled for Today • Date-Level Precision)</span>
                </div>
                <span className="amx-guard-kpi-pill amx-guard-kpi-pill-neutral">
                  Checkpoint Attention
                </span>
              </div>

              <div className="amx-guard-movement-list">
                {upcomingMovements.length === 0 ? (
                  <div className="amx-guard-empty-state">
                    {loading ? 'Checking scheduled movements...' : 'No upcoming movements scheduled for today.'}
                  </div>
                ) : (
                  upcomingMovements.map((mov) => {
                    const isOutbound = mov.type === 'Outbound';
                    return (
                      <div key={mov.id} className="amx-guard-movement-item">
                        <div className="amx-guard-movement-left">
                          <div className="amx-guard-movement-time">{mov.time}</div>
                          <div className="amx-guard-movement-body">
                            <div className="amx-guard-movement-title-row">
                              <span className="amx-guard-movement-asset">{mov.title}</span>
                              <span
                                className={`amx-guard-type-badge ${
                                  isOutbound ? 'amx-guard-type-outbound' : 'amx-guard-type-inbound'
                                }`}
                                style={{ fontSize: 10, padding: '1px 6px' }}
                              >
                                {mov.type}
                              </span>
                            </div>
                            <div className="amx-guard-movement-meta">
                              {mov.personLabel}:{' '}
                              <strong className="text-[#191c1e]">{mov.personName}</strong>
                            </div>
                            <div className="amx-guard-movement-meta">{mov.details}</div>
                          </div>
                        </div>

                        <span className="amx-guard-movement-status">{mov.statusBadge}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="amx-guard-card-footer" style={{ padding: '14px 0 0 0', marginTop: 16 }}>
              <button
                type="button"
                className="amx-guard-alert-btn-muted"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => showToast('Printing movement manifest dispatch sheet...')}
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Movement Manifest
              </button>

              <button
                type="button"
                className="amx-guard-link"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('gate-pass');
                  } else {
                    showToast('Checkpoint schedule view synchronized.');
                  }
                }}
              >
                View Master Schedule
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* SECURITY & CHECKPOINT ALERTS */}
          <div className="amx-guard-panel-card">
            <div>
              <div className="amx-guard-card-header" style={{ padding: 0, marginBottom: 16 }}>
                <div className="amx-guard-card-title-group">
                  <h2 className="amx-guard-card-title">Security & Discrepancy Alerts</h2>
                </div>
                <span className="amx-guard-kpi-pill amx-guard-kpi-pill-danger">
                  <span className="amx-guard-pulse-dot"></span>
                  {activeAlertsCount} Unresolved Flags
                </span>
              </div>

              <div className="amx-guard-alerts-list">
                {alerts.length === 0 ? (
                  <div className="amx-guard-empty-state">
                    {loading ? 'Checking security flags...' : 'No active security flags or discrepancies.'}
                  </div>
                ) : (
                  alerts.map((alt) => {
                    const isCrit = alt.severity === 'critical';
                    const isWarn = alt.severity === 'warning';
                    return (
                      <div
                        key={alt.id}
                        className={`amx-guard-alert-item ${
                          isCrit ? 'amx-guard-alert-critical' : ''
                        }`}
                        style={{ opacity: alt.acknowledged ? 0.6 : 1 }}
                      >
                        <div className="amx-guard-alert-top">
                          <div className="amx-guard-alert-title-wrap">
                            <span
                              className="material-symbols-outlined text-[18px]"
                              style={{
                                color: isCrit ? '#ba1a1a' : isWarn ? '#00687a' : '#45464d',
                              }}
                            >
                              {alt.icon}
                            </span>
                            <span className="amx-guard-alert-title">{alt.title}</span>
                          </div>
                          <span
                            className={`amx-guard-alert-severity ${
                              isCrit
                                ? 'amx-guard-alert-sev-critical'
                                : isWarn
                                ? 'amx-guard-alert-sev-warning'
                                : 'amx-guard-alert-sev-notice'
                            }`}
                          >
                            {alt.badgeText}
                          </span>
                        </div>

                        <p className="amx-guard-alert-text">{alt.description}</p>

                        <div className="amx-guard-alert-actions">
                          {isCrit && (
                            <>
                              <button
                                type="button"
                                className="amx-guard-alert-btn-danger"
                                onClick={() => setReviewingAlert(alt)}
                              >
                                Review Flag
                              </button>
                              {alt.passId && (
                                <>
                                  <span style={{ color: '#c6c6cd' }}>•</span>
                                  <button
                                    type="button"
                                    className="amx-guard-alert-btn-muted"
                                    onClick={() => {
                                      if (onNavigate && alt.passId) {
                                        onNavigate(`gate-pass/${alt.passId}`);
                                      } else {
                                        showToast(`Pass ${alt.passId} recorded in Escalated status.`);
                                      }
                                    }}
                                  >
                                    View in Ledger
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          {isWarn && (
                            <button
                              type="button"
                              className="amx-guard-alert-btn-link"
                              onClick={() => handleAcknowledgeAlert(alt.id)}
                            >
                              {alt.acknowledged ? 'Acknowledged ✓' : 'Acknowledge'}
                            </button>
                          )}
                          {alt.severity === 'notice' && (
                            <button
                              type="button"
                              className="amx-guard-alert-btn-link"
                              onClick={() => setIsIncidentModalOpen(true)}
                            >
                              Log Incident
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="amx-guard-card-footer" style={{ padding: '14px 0 0 0', marginTop: 16 }}>
              <span className="font-mono text-xs">Protocol: SecOps-Standard-Rev4</span>
              <button
                type="button"
                className="amx-guard-link"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('security-incidents');
                  } else {
                    showToast('Security incident archive opened in read-only mode.');
                  }
                }}
              >
                Incident Archive →
              </button>
            </div>
          </div>
        </div>

        {/* ==============================================================
            ROLE RESTRICTION FOOTER NOTICE
            ============================================================== */}
        <div className="amx-guard-role-banner">
          <span className="material-symbols-outlined text-[18px] text-[#76777d]">
            verified_user
          </span>
          <p className="amx-guard-role-text">
            <strong className="text-[#191c1e]">Guard role active.</strong> Authorized for physical
            checkpoint inspection, barrier verification, entry/exit logging, and incident reporting
            only. Master inventory editing, pass approval, security overrides, and custody assignment
            restricted.
          </p>
          <span className="amx-guard-session-id">SESSION ID: SEC-8841-A</span>
        </div>
      </div>

      {/* ==============================================================
          MODAL: Gate Pass Verification (Fallback / Inspection)
          ============================================================== */}
      {verifyingItem && (
        <div className="amx-guard-modal-backdrop" onClick={closeVerifyModal}>
          <div
            className="amx-guard-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="amx-guard-modal-header">
              <h3 className="amx-guard-modal-title">
                <span className="material-symbols-outlined text-[#00687a]">
                  qr_code_scanner
                </span>
                Verify Gate Pass — {verifyingItem.id}
              </h3>
              <button
                type="button"
                className="amx-guard-modal-close"
                onClick={closeVerifyModal}
              >
                ×
              </button>
            </div>

            <div className="amx-guard-modal-body">
              {/* Pass Summary Details */}
              <div
                style={{
                  backgroundColor: '#f2f4f6',
                  borderRadius: 6,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>
                    Asset:{' '}
                    <strong className="text-[#191c1e]">{verifyingItem.assetName}</strong>
                  </span>
                  <span className="font-mono text-[#00687a] font-semibold">
                    SN: {verifyingItem.serialNumber}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#45464d' }}>
                  <span>
                    Requester: {verifyingItem.requesterName} ({verifyingItem.requesterBadge})
                  </span>
                  <span>Type: {verifyingItem.type}</span>
                </div>
                {verifyingItem.carrier && (
                  <div style={{ fontSize: 12, color: '#45464d' }}>
                    Carrier / Route: <strong>{verifyingItem.carrier}</strong>
                  </div>
                )}
                {verifyingItem.destination && (
                  <div style={{ fontSize: 12, color: '#45464d' }}>
                    Destination: {verifyingItem.destination}
                  </div>
                )}
              </div>

              {/* Physical Checkpoint Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="amx-guard-input-label">Physical Inspection Checklist</span>

                <label className="amx-guard-checklist-item">
                  <input
                    type="checkbox"
                    checked={tagVerified}
                    onChange={(e) => setTagVerified(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <strong>Asset Tag & Serial Mismatch Check:</strong> Physical barcode and SN{' '}
                    <code>{verifyingItem.serialNumber}</code> inspected and matches equipment.
                  </span>
                </label>

                <label className="amx-guard-checklist-item">
                  <input
                    type="checkbox"
                    checked={sealIntact}
                    onChange={(e) => setSealIntact(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <strong>Security Seal & Packaging:</strong> Tamper-evident container seal intact
                    with no signs of breach.
                  </span>
                </label>

                <label className="amx-guard-checklist-item">
                  <input
                    type="checkbox"
                    checked={driverIdVerified}
                    onChange={(e) => setDriverIdVerified(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <strong>Bearer Identity Verified:</strong> Driver badge or requester ID card
                    matches authorized carrier record.
                  </span>
                </label>
              </div>

              {/* Guard Notes */}
              <div>
                <label className="amx-guard-input-label">Guard Checkpoint Notes</label>
                <textarea
                  className="amx-guard-input-field"
                  rows={3}
                  placeholder="Record checkpoint observation, physical condition, or discrepancy notes..."
                  value={checkpointNotes}
                  onChange={(e) => setCheckpointNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="amx-guard-modal-footer">
              <button
                type="button"
                className="amx-guard-alert-btn-danger"
                style={{ marginRight: 'auto', padding: '6px 10px' }}
                onClick={handleRaiseDiscrepancy}
              >
                Raise Discrepancy Flag
              </button>

              <button
                type="button"
                className="amx-guard-btn-secondary"
                onClick={closeVerifyModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="amx-guard-btn-primary"
                onClick={handleAuthorizeAndClear}
              >
                Authorize & Clear Barrier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: Log Incident Report
          ============================================================== */}
      {isIncidentModalOpen && (
        <div className="amx-guard-modal-backdrop" onClick={() => setIsIncidentModalOpen(false)}>
          <div
            className="amx-guard-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="amx-guard-modal-header">
              <h3 className="amx-guard-modal-title">
                <span className="material-symbols-outlined text-[#ba1a1a]">
                  report_problem
                </span>
                Log Checkpoint Security Incident
              </h3>
              <button
                type="button"
                className="amx-guard-modal-close"
                onClick={() => setIsIncidentModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitIncident}>
              <div className="amx-guard-modal-body">
                <div>
                  <label className="amx-guard-input-label">Incident Category</label>
                  <select
                    className="amx-guard-input-field"
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                  >
                    <option value="Tag / Serial Discrepancy">Tag / Serial Discrepancy</option>
                    <option value="Unscheduled Delivery Vehicle">Unscheduled Delivery Vehicle</option>
                    <option value="Tamper-Evident Seal Broken">Tamper-Evident Seal Broken</option>
                    <option value="Unauthorized Asset Removal">Unauthorized Asset Removal Attempt</option>
                    <option value="Driver / Bearer Identity Refusal">Driver / Bearer Identity Refusal</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="amx-guard-input-label">Severity Level</label>
                    <select
                      className="amx-guard-input-field"
                      value={incidentSeverity}
                      onChange={(e) =>
                        setIncidentSeverity(e.target.value as 'critical' | 'warning' | 'notice')
                      }
                    >
                      <option value="critical">Critical (Immediate Escalation)</option>
                      <option value="warning">Warning (Delayed Clearance)</option>
                      <option value="notice">Notice (Informational)</option>
                    </select>
                  </div>

                  <div>
                    <label className="amx-guard-input-label">Barrier / Checkpoint Node</label>
                    <select
                      className="amx-guard-input-field"
                      value={incidentGate}
                      onChange={(e) => setIncidentGate(e.target.value)}
                    >
                      <option value="Gate-01A Main Gate">Gate-01A Main Gate</option>
                      <option value="Gate-02 East Barrier">Gate-02 East Barrier</option>
                      <option value="Gate-03 North Loading Bay">Gate-03 North Loading Bay</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="amx-guard-input-label">Vehicle License Plate or Badge #</label>
                  <input
                    type="text"
                    className="amx-guard-input-field"
                    placeholder="e.g. CA-894-MX or Badge #SEC-014"
                    value={incidentVehicle}
                    onChange={(e) => setIncidentVehicle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="amx-guard-input-label">Incident Description & Observation</label>
                  <textarea
                    className="amx-guard-input-field"
                    rows={4}
                    required
                    placeholder="Provide detailed description of the physical checkpoint observation, gate pass reference, or vehicle details..."
                    value={incidentDesc}
                    onChange={(e) => setIncidentDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="amx-guard-modal-footer">
                <button
                  type="button"
                  className="amx-guard-btn-secondary"
                  onClick={() => setIsIncidentModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="amx-guard-btn-primary">
                  Submit Incident Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: Review Critical Discrepancy Alert
          ============================================================== */}
      {reviewingAlert && (
        <div className="amx-guard-modal-backdrop" onClick={() => setReviewingAlert(null)}>
          <div
            className="amx-guard-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="amx-guard-modal-header">
              <h3 className="amx-guard-modal-title">
                <span className="material-symbols-outlined text-[#ba1a1a]">
                  gpp_maybe
                </span>
                {reviewingAlert.title}
              </h3>
              <button
                type="button"
                className="amx-guard-modal-close"
                onClick={() => setReviewingAlert(null)}
              >
                ×
              </button>
            </div>

            <div className="amx-guard-modal-body">
              <div
                style={{
                  backgroundColor: 'rgba(255, 218, 214, 0.4)',
                  border: '1px solid #ffdad6',
                  borderRadius: 6,
                  padding: 14,
                  fontSize: 13,
                  color: '#93000a',
                  lineHeight: 1.5,
                }}
              >
                <strong>Recorded Checkpoint Discrepancy:</strong>
                <p style={{ margin: '6px 0 0 0' }}>{reviewingAlert.description}</p>
              </div>

              <div style={{ fontSize: 13, color: '#45464d', lineHeight: 1.5 }}>
                <p>
                  <strong>System Status:</strong> Gate pass status is recorded as Escalated. Checkpoint
                  clearance remains locked until an authorized administrator records an approval decision
                  in the Gate Pass Ledger.
                </p>
              </div>
            </div>

            <div className="amx-guard-modal-footer">
              <button
                type="button"
                className="amx-guard-btn-secondary"
                onClick={() => setReviewingAlert(null)}
              >
                Close
              </button>
              {reviewingAlert.passId && (
                <button
                  type="button"
                  className="amx-guard-btn-primary"
                  onClick={() => {
                    const passId = reviewingAlert.passId;
                    setReviewingAlert(null);
                    if (onNavigate && passId) {
                      onNavigate(`gate-pass/${passId}`);
                    } else {
                      showToast(`Pass ${passId} remains locked in Escalated status.`);
                    }
                  }}
                >
                  View Pass in Ledger
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="amx-guard-toast" role="alert">
          <span className="material-symbols-outlined text-[18px] text-[#57dffe]">
            info
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </DashboardLayout>
  );
};
