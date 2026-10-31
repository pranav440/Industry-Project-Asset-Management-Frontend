import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import {
  HOST_KPIS_DATA,
  HOST_GATE_PASS_ACTIVITY_DATA,
  HOST_MOVEMENT_OVERVIEW_DATA,
  HOST_PENDING_ACTIONS_DATA,
  HOST_OPERATIONAL_ALERTS_DATA,
  type HostGatePassActivityItem,
  type HostPendingActionItem,
  type HostOperationalAlertItem,
} from '../data/hostData';
import './HostDashboard.css';

interface HostDashboardPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

export const HostDashboardPage: React.FC<HostDashboardPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'In Progress' | 'Approved'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Selected item for Inspection / Verification Drawer
  const [selectedPass, setSelectedPass] = useState<HostGatePassActivityItem | null>(null);
  const [selectedAction, setSelectedAction] = useState<HostPendingActionItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEscalationGuideOpen, setIsEscalationGuideOpen] = useState(false);

  // Host Verification Checklist states (for Read & Verify mode)
  const [serialVerified, setSerialVerified] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [sealInspected, setSealInspected] = useState(false);
  const [hostNotes, setHostNotes] = useState('');

  // Operational Alerts state
  const [alerts, setAlerts] = useState<HostOperationalAlertItem[]>(HOST_OPERATIONAL_ALERTS_DATA);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleNav = (path: string) => {
    if (path === 'dashboard' || path === 'Host Dashboard') {
      onNavigate?.('dashboard');
    } else if (path === 'gate-pass' || path === 'Gate Passes') {
      onNavigate?.('gate-pass');
    } else if (path === 'movement' || path === 'movement-activity' || path === 'Movement Activity') {
      showToast('Movement Activity log — Synchronized with Perimeter Scanners.');
    } else if (path === 'support') {
      showToast('Host Security Support: Contact Central Security Desk (Ext. 4040).');
    } else if (path === 'login' || path === 'signout') {
      onSignOut?.();
    } else {
      onNavigate?.(path);
    }
  };

  // Filter Gate Pass Activity
  const filteredPasses = useMemo(() => {
    let items = HOST_GATE_PASS_ACTIVITY_DATA;

    // Filter by tab
    if (activeTab === 'Pending') {
      items = items.filter((p) => p.status === 'Pending');
    } else if (activeTab === 'In Progress') {
      items = items.filter((p) => p.status === 'In Progress');
    } else if (activeTab === 'Approved') {
      items = items.filter((p) => p.status === 'Approved');
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.assetName.toLowerCase().includes(q) ||
          p.serialNumber.toLowerCase().includes(q) ||
          p.requesterName.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.passType.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q)
      );
    }

    return items;
  }, [activeTab, searchQuery]);

  const totalPages = Math.ceil(filteredPasses.length / pageSize) || 1;
  const paginatedPasses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPasses.slice(start, start + pageSize);
  }, [filteredPasses, currentPage, pageSize]);

  // Open drawer from Table row
  const handleOpenPassDetails = (pass: HostGatePassActivityItem) => {
    setSelectedPass(pass);
    setSelectedAction(null);
    setSerialVerified(false);
    setIdVerified(false);
    setSealInspected(false);
    setHostNotes('');
    setIsDrawerOpen(true);
  };

  // Open drawer from Pending Action Card
  const handleOpenActionDetails = (action: HostPendingActionItem) => {
    setSelectedAction(action);
    const matched = HOST_GATE_PASS_ACTIVITY_DATA.find((p) => p.id === action.passId);
    setSelectedPass(matched || null);
    setSerialVerified(false);
    setIdVerified(false);
    setSealInspected(false);
    setHostNotes('');
    setIsDrawerOpen(true);
  };

  // Record Host Verification
  const handleRecordVerification = () => {
    const id = selectedAction?.passId || selectedPass?.id || 'Gate Pass';
    showToast(`Verification recorded for ${id} by Host Sarah Jenkins.`);
    setIsDrawerOpen(false);
  };

  // Clear or reset alerts
  const handleClearAlerts = () => {
    if (alerts.length > 0) {
      setAlerts([]);
      showToast('Operational alerts dismissed from local view.');
    } else {
      setAlerts(HOST_OPERATIONAL_ALERTS_DATA);
      showToast('Operational alerts restored.');
    }
  };

  return (
    <DashboardLayout
      currentNav="Host Dashboard"
      role="host"
      userName={currentUser?.full_name || 'Sarah Jenkins'}
      userRoleSubtitle="Host Security Officer"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={setSearchQuery}
      searchValue={searchQuery}
      searchPlaceholder="Search gate passes, assets, movement..."
      onNotificationsClick={() => showToast('3 Operational Alerts active. Review right-rail queue.')}
      onHelpClick={() => setIsEscalationGuideOpen(true)}
      onProfileClick={() => showToast('Host Security Officer: Sarah Jenkins • Node: GATE-04A')}
    >
      <div className="amx-host-dash-container" id="hostDashboardContainer">
        {/* Title Bar */}
        <section className="amx-host-title-bar" aria-label="Host Dashboard Header">
          <div className="amx-host-title-left">
            <div className="amx-host-title-row">
              <h1 className="amx-host-headline" id="hostDashboardTitle">Host Dashboard</h1>
              <span className="amx-host-status-badge" id="hostStatusBadge">
                <span className="amx-host-status-dot" aria-hidden="true" />
                Operational Overview • Synchronized
              </span>
            </div>
            <p className="amx-host-subtitle">
              Monitor gate pass verification, asset check-ins, and perimeter movement flow.
            </p>
          </div>

          <div className="amx-host-title-right">
            <div className="amx-host-chip" id="hostNodeChip">
              <span className="material-symbols-outlined" aria-hidden="true">sensors</span>
              <span>Node: GATE-04A</span>
            </div>
            <div className="amx-host-chip" id="hostModeChip">
              <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
              <span>Host Mode: Read &amp; Verify</span>
            </div>
          </div>
        </section>

        {/* KPI Cards Grid */}
        <section className="amx-host-kpi-grid" aria-label="Host Operational Metrics">
          {/* Card 1: Active Gate Passes */}
          <div className="amx-host-kpi-card" id="kpiActiveGatePasses">
            <div>
              <div className="amx-host-kpi-header">
                <p className="amx-host-kpi-title">Active Gate Passes</p>
                <div className="amx-host-kpi-icon-wrap">
                  <span className="material-symbols-outlined" aria-hidden="true">confirmation_number</span>
                </div>
              </div>
              <div className="amx-host-kpi-body">
                <span className="amx-host-kpi-value">{HOST_KPIS_DATA.activeGatePasses.total}</span>
                <span className="amx-host-kpi-pill live">{HOST_KPIS_DATA.activeGatePasses.badgeText}</span>
              </div>
            </div>
            <p className="amx-host-kpi-footer">
              {HOST_KPIS_DATA.activeGatePasses.outbound} outbound • {HOST_KPIS_DATA.activeGatePasses.inboundScheduled} inbound scheduled
            </p>
          </div>

          {/* Card 2: Pending Host Actions */}
          <div className="amx-host-kpi-card" id="kpiPendingHostActions">
            <div>
              <div className="amx-host-kpi-header">
                <p className="amx-host-kpi-title">Pending Host Actions</p>
                <div className="amx-host-kpi-icon-wrap alert-accent">
                  <span className="material-symbols-outlined" aria-hidden="true">fact_check</span>
                  <span className="amx-host-kpi-dot" aria-hidden="true" />
                </div>
              </div>
              <div className="amx-host-kpi-body">
                <span className="amx-host-kpi-value">{HOST_KPIS_DATA.pendingHostActions.total}</span>
                <span className="amx-host-kpi-pill priority">{HOST_KPIS_DATA.pendingHostActions.badgeText}</span>
              </div>
            </div>
            <p className="amx-host-kpi-footer">
              {HOST_KPIS_DATA.pendingHostActions.subtext}
            </p>
          </div>

          {/* Card 3: Today's Movement */}
          <div className="amx-host-kpi-card" id="kpiTodaysMovement">
            <div>
              <div className="amx-host-kpi-header">
                <p className="amx-host-kpi-title">Today's Movement</p>
                <div className="amx-host-kpi-icon-wrap">
                  <span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
                </div>
              </div>
              <div className="amx-host-kpi-body">
                <span className="amx-host-kpi-value">{HOST_KPIS_DATA.todaysMovement.total}</span>
                <span className="amx-host-kpi-pill trend-up">↗ {HOST_KPIS_DATA.todaysMovement.trend}</span>
              </div>
            </div>
            <p className="amx-host-kpi-footer">
              {HOST_KPIS_DATA.todaysMovement.completed} completed • {HOST_KPIS_DATA.todaysMovement.inTransit} in transit
            </p>
          </div>

          {/* Card 4: Escalated Gate Passes */}
          <div className="amx-host-kpi-card" id="kpiEscalatedGatePasses">
            <div>
              <div className="amx-host-kpi-header">
                <p className="amx-host-kpi-title">Escalated Gate Passes</p>
                <div className="amx-host-kpi-icon-wrap warning-accent">
                  <span className="material-symbols-outlined" aria-hidden="true">warning</span>
                </div>
              </div>
              <div className="amx-host-kpi-body">
                <span className="amx-host-kpi-value">{HOST_KPIS_DATA.escalatedGatePasses.total}</span>
                <span className="amx-host-kpi-pill review">{HOST_KPIS_DATA.escalatedGatePasses.badgeText}</span>
              </div>
            </div>
            <p className="amx-host-kpi-footer">
              {HOST_KPIS_DATA.escalatedGatePasses.subtext}
            </p>
          </div>
        </section>

        {/* Upper Section: Gate Pass Activity Table (Left) + Movement Overview (Right) */}
        <div className="amx-host-section-row">
          {/* Gate Pass Activity Panel */}
          <section className="amx-host-panel" id="panelGatePassActivity" aria-label="Gate Pass Activity">
            <div className="amx-host-panel-header">
              <div className="amx-host-panel-header-left">
                <h2 className="amx-host-panel-title">Gate Pass Activity</h2>
                <span className="amx-host-count-badge" id="hostTotalPassesBadge">
                  {HOST_GATE_PASS_ACTIVITY_DATA.length} Total Passes
                </span>
              </div>

              <div className="amx-host-panel-header-right">
                <div className="amx-host-tabs" role="tablist">
                  {(['All', 'Pending', 'In Progress', 'Approved'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={`amx-host-tab-btn ${activeTab === tab ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab(tab);
                        setCurrentPage(1);
                      }}
                      id={`tabFilter-${tab.replace(/\s+/g, '')}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="amx-host-header-link"
                  id="btnViewAllGatePasses"
                  onClick={() => handleNav('gate-pass')}
                >
                  <span>View All →</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="amx-host-table-wrap">
              <table className="amx-host-table" id="hostGatePassTable">
                <thead>
                  <tr>
                    <th>Pass ID</th>
                    <th>Type</th>
                    <th>Asset / Item</th>
                    <th>Requester</th>
                    <th>Schedule</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPasses.map((pass) => {
                    const typeClass =
                      pass.passType === 'Returnable'
                        ? 'returnable'
                        : pass.passType === 'Non-Returnable'
                        ? 'non-returnable'
                        : pass.passType === 'Maint. Dispatch'
                        ? 'maint-dispatch'
                        : 'transfer';

                    const statusClass =
                      pass.status === 'In Progress'
                        ? 'in-progress'
                        : pass.status === 'Approved'
                        ? 'approved'
                        : pass.status === 'Escalated'
                        ? 'escalated'
                        : 'pending';

                    return (
                      <tr
                        key={pass.id}
                        className="amx-host-table-row"
                        onClick={() => handleOpenPassDetails(pass)}
                        title="Click to inspect gate pass details"
                      >
                        <td className="amx-host-pass-id">{pass.id}</td>
                        <td>
                          <span className={`amx-host-type-pill ${typeClass}`}>
                            {pass.passType}
                          </span>
                        </td>
                        <td>
                          <div className="amx-host-asset-info">
                            <span className="amx-host-asset-name">{pass.assetName}</span>
                            <span className="amx-host-asset-sn">{pass.serialNumber}</span>
                          </div>
                        </td>
                        <td>
                          <div className="amx-host-requester-info">
                            <span className="amx-host-requester-name">{pass.requesterName}</span>
                            <span className="amx-host-requester-dept">{pass.department}</span>
                          </div>
                        </td>
                        <td className="amx-host-schedule-text">{pass.schedule}</td>
                        <td>
                          <span className={`amx-host-status-badge-cell ${statusClass}`}>
                            <span className="amx-host-status-dot-cell" aria-hidden="true" />
                            {pass.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="amx-host-table-footer">
              <span className="amx-host-records-count">
                Showing {paginatedPasses.length} of {filteredPasses.length} records
              </span>

              <div className="amx-host-pagination">
                <button
                  type="button"
                  className="amx-host-page-nav-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                </button>
                <span className="amx-host-page-label">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="amx-host-page-nav-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                </button>
              </div>
            </div>
          </section>

          {/* Movement Overview Panel */}
          <section className="amx-host-panel" id="panelMovementOverview" aria-label="Movement Overview">
            <div className="amx-host-panel-header">
              <div>
                <h2 className="amx-host-panel-title">Movement Overview</h2>
                <p className="amx-host-panel-subtitle">Live Perimeter Scans</p>
              </div>

              <div className="amx-host-panel-header-right">
                <span style={{ fontSize: '11px', color: '#64748b' }}>5m ago</span>
                <button
                  type="button"
                  className="amx-host-header-link"
                  id="btnViewMovementLog"
                  onClick={() => showToast('Displaying real-time perimeter scanner telemetry.')}
                >
                  <span>View Log</span>
                </button>
              </div>
            </div>

            {/* Movement list */}
            <div className="amx-host-movement-list">
              {HOST_MOVEMENT_OVERVIEW_DATA.map((item) => {
                const pillClass =
                  item.status === 'Verified In-Transit'
                    ? 'in-transit'
                    : item.status === 'Gate Clearance'
                    ? 'clearance'
                    : 'checkin';

                return (
                  <div key={item.id} className="amx-host-movement-item">
                    <div className="amx-host-movement-top">
                      <span className="amx-host-movement-id">{item.id}</span>
                      <span className={`amx-host-movement-pill ${pillClass}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="amx-host-movement-asset">
                      {item.assetTag} • {item.assetName}
                    </div>

                    <div className="amx-host-movement-route">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#00687a' }} aria-hidden="true">
                        alt_route
                      </span>
                      <span>{item.route}</span>
                    </div>

                    <div className="amx-host-movement-bottom">
                      <span>{item.station}</span>
                      <span>{item.timeAgo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Lower Section: Pending Host Actions (Left) + Operational Alerts (Right) */}
        <div className="amx-host-section-row equal-split">
          {/* Pending Host Actions */}
          <section className="amx-host-panel" id="panelPendingActions" aria-label="Pending Host Actions">
            <div className="amx-host-panel-header">
              <div className="amx-host-panel-header-left">
                <h2 className="amx-host-panel-title">Pending Host Actions</h2>
                <span className="amx-host-count-badge action-badge" id="hostActionCountBadge">
                  {HOST_PENDING_ACTIONS_DATA.length} Action Items
                </span>
              </div>
            </div>
            <p className="amx-host-panel-subtitle" style={{ marginTop: '-8px', marginBottom: '14px' }}>
              Gate-pass records requiring Host check-in, identity verification, or dispatch logging.
            </p>

            <div className="amx-host-actions-list">
              {HOST_PENDING_ACTIONS_DATA.map((act) => (
                <div key={act.id} className="amx-host-action-card">
                  <div className="amx-host-action-card-left">
                    <div className="amx-host-action-icon-box">
                      <span className="material-symbols-outlined" aria-hidden="true">{act.icon}</span>
                    </div>

                    <div className="amx-host-action-content">
                      <div className="amx-host-action-title-row">
                        <span>{act.passId}</span> • <span>{act.title}</span>
                      </div>
                      <div className="amx-host-action-requester">
                        Requester: {act.requester}
                      </div>
                      <div className={`amx-host-action-prompt ${act.isPrimary ? '' : 'subtle-prompt'}`}>
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {act.isPrimary ? 'error' : 'schedule'}
                        </span>
                        <span>{act.actionText}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      className={act.isPrimary ? 'amx-host-action-btn-primary' : 'amx-host-action-btn-secondary'}
                      onClick={() => handleOpenActionDetails(act)}
                      id={`btnAction-${act.id}`}
                    >
                      {act.buttonText}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="amx-host-action-footer-note">
              <span className="material-symbols-outlined" aria-hidden="true">info</span>
              <span>Host actions are limited to physical verification, custody check-in, and clearance logs.</span>
            </div>
          </section>

          {/* Operational Alerts */}
          <section className="amx-host-panel" id="panelOperationalAlerts" aria-label="Operational Alerts">
            <div className="amx-host-panel-header">
              <div className="amx-host-panel-header-left">
                <h2 className="amx-host-panel-title">Operational Alerts</h2>
                <span className="amx-host-count-badge" id="hostAlertsCountBadge">
                  {alerts.length} Active
                </span>
              </div>

              <div className="amx-host-panel-header-right">
                <button
                  type="button"
                  className="amx-host-header-link"
                  id="btnClearAlertLogs"
                  onClick={handleClearAlerts}
                >
                  {alerts.length > 0 ? 'Clear Logs' : 'Restore Logs'}
                </button>
              </div>
            </div>

            <div className="amx-host-alerts-list">
              {alerts.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  No active operational alerts. Perimeter flow is clear.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`amx-host-alert-item ${
                      alert.severity === 'critical'
                        ? 'critical-alert'
                        : alert.severity === 'info'
                        ? 'info-alert'
                        : 'warning-alert'
                    }`}
                  >
                    <div className="amx-host-alert-top">
                      <div className="amx-host-alert-header-row">
                        <span className="material-symbols-outlined" aria-hidden="true">{alert.icon}</span>
                        <span>{alert.title}</span>
                      </div>
                      <span
                        className="amx-host-alert-dot"
                        style={{ backgroundColor: alert.dotColor }}
                        aria-hidden="true"
                      />
                    </div>

                    <p className="amx-host-alert-desc">{alert.description}</p>

                    <div className="amx-host-alert-bottom">
                      <span>{alert.location}</span>
                      <span>{alert.timeAgo}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="amx-host-alerts-footer">
              <span>Alert Escalation Policy: L2 Auto-Notify</span>
              <button
                type="button"
                className="amx-host-escalation-link"
                id="btnEscalationGuide"
                onClick={() => setIsEscalationGuideOpen(true)}
              >
                <span>Escalation Guide</span>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                  open_in_new
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* Right-Rail Inspection & Verification Drawer */}
        {isDrawerOpen && (
          <div
            className="amx-host-drawer-backdrop"
            onClick={() => setIsDrawerOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Host Verification Inspector"
          >
            <div className="amx-host-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="amx-host-drawer-header">
                <div>
                  <h3 className="amx-host-drawer-title">
                    {selectedAction ? 'Host Physical Verification & Clearance' : 'Gate Pass Inspection'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {selectedAction?.passId || selectedPass?.id} • Read &amp; Verify Mode
                  </span>
                </div>
                <button
                  type="button"
                  className="amx-host-drawer-close"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close Inspector"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>

              <div className="amx-host-drawer-body">
                {/* Gate Pass Overview */}
                <div className="amx-host-drawer-section">
                  <p className="amx-host-drawer-section-title">Gate Pass Details</p>
                  <div className="amx-host-drawer-field-grid">
                    <div className="amx-host-drawer-field">
                      <span className="amx-host-drawer-field-label">Pass ID</span>
                      <span className="amx-host-drawer-field-val">
                        {selectedAction?.passId || selectedPass?.id}
                      </span>
                    </div>
                    <div className="amx-host-drawer-field">
                      <span className="amx-host-drawer-field-label">Pass Type</span>
                      <span className="amx-host-drawer-field-val">
                        {selectedPass?.passType || 'Returnable'}
                      </span>
                    </div>
                    <div className="amx-host-drawer-field">
                      <span className="amx-host-drawer-field-label">Requester</span>
                      <span className="amx-host-drawer-field-val">
                        {selectedAction?.requester || selectedPass?.requesterName}
                      </span>
                    </div>
                    <div className="amx-host-drawer-field">
                      <span className="amx-host-drawer-field-label">Department</span>
                      <span className="amx-host-drawer-field-val">
                        {selectedPass?.department || 'Operations'}
                      </span>
                    </div>
                    <div className="amx-host-drawer-field" style={{ gridColumn: 'span 2' }}>
                      <span className="amx-host-drawer-field-label">Hardware Asset</span>
                      <span className="amx-host-drawer-field-val">
                        {selectedAction?.assetName || selectedPass?.assetName}
                      </span>
                    </div>
                    <div className="amx-host-drawer-field">
                      <span className="amx-host-drawer-field-label">Serial Number</span>
                      <span className="amx-host-drawer-field-val" style={{ fontFamily: 'monospace' }}>
                        {selectedAction?.serialNumber || selectedPass?.serialNumber}
                      </span>
                    </div>
                    <div className="amx-host-drawer-field">
                      <span className="amx-host-drawer-field-label">Location / Gate</span>
                      <span className="amx-host-drawer-field-val">
                        {selectedPass?.gateLocation || 'Main Gate Checkpoint'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                {selectedAction && (
                  <div className="amx-host-drawer-section">
                    <p className="amx-host-drawer-section-title">Host Verification Task</p>
                    <div style={{ backgroundColor: '#fff8f6', border: '1px solid #ffdcd4', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#b91c1c', fontSize: '13px', marginBottom: '4px' }}>
                        {selectedAction.actionText}
                      </div>
                      <div style={{ fontSize: '12px', color: '#45464d', lineHeight: 1.4 }}>
                        {selectedAction.instructions}
                      </div>
                    </div>
                  </div>
                )}

                {/* Verification Checklist */}
                <div className="amx-host-drawer-section">
                  <p className="amx-host-drawer-section-title">Perimeter Check-In Checklist</p>
                  <div className="amx-host-checklist">
                    <label className="amx-host-check-item">
                      <input
                        type="checkbox"
                        checked={serialVerified}
                        onChange={(e) => setSerialVerified(e.target.checked)}
                      />
                      <div className="amx-host-check-text">
                        <span className="amx-host-check-title">Physical Serial Number Verified</span>
                        <span className="amx-host-check-sub">
                          Serial on chassis matches {selectedAction?.serialNumber || selectedPass?.serialNumber}
                        </span>
                      </div>
                    </label>

                    <label className="amx-host-check-item">
                      <input
                        type="checkbox"
                        checked={idVerified}
                        onChange={(e) => setIdVerified(e.target.checked)}
                      />
                      <div className="amx-host-check-text">
                        <span className="amx-host-check-title">Bearer Photo ID / Badge Inspected</span>
                        <span className="amx-host-check-sub">
                          Custodian identity matches requester on gate pass record
                        </span>
                      </div>
                    </label>

                    <label className="amx-host-check-item">
                      <input
                        type="checkbox"
                        checked={sealInspected}
                        onChange={(e) => setSealInspected(e.target.checked)}
                      />
                      <div className="amx-host-check-text">
                        <span className="amx-host-check-title">Packaging &amp; Tamper Seals Intact</span>
                        <span className="amx-host-check-sub">
                          Equipment container verified without unauthorized tampering
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Host Log Notes */}
                <div className="amx-host-drawer-section">
                  <p className="amx-host-drawer-section-title">Host Security Notes (Optional)</p>
                  <textarea
                    rows={3}
                    placeholder="Enter observation notes, carrier vehicle number, or gate comments..."
                    value={hostNotes}
                    onChange={(e) => setHostNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontFamily: 'inherit',
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Disclaimer */}
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4, padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                  <strong>Host Security Policy:</strong> Host actions are strictly scoped to physical custody verification and transit check-in. Administrative changes to asset masters or lifecycle statuses require Administrator credentials.
                </div>
              </div>

              <div className="amx-host-drawer-footer">
                <button
                  type="button"
                  className="amx-host-action-btn-secondary"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="amx-host-action-btn-primary"
                  onClick={handleRecordVerification}
                  id="btnRecordHostVerification"
                >
                  Record Verification Check-in
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Escalation Guide Modal */}
        {isEscalationGuideOpen && (
          <div
            className="amx-host-modal-backdrop"
            onClick={() => setIsEscalationGuideOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Escalation Guide Modal"
          >
            <div className="amx-host-modal" onClick={(e) => e.stopPropagation()}>
              <div className="amx-host-modal-header">
                <h3 className="amx-host-modal-title">Perimeter Escalation Policy (L2 Auto-Notify)</h3>
                <button
                  type="button"
                  className="amx-host-drawer-close"
                  onClick={() => setIsEscalationGuideOpen(false)}
                  aria-label="Close Modal"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>

              <div className="amx-host-modal-body">
                <div>
                  <strong>Overview:</strong> When a gate pass encounters a physical mismatch, overdue return, or missing authorization seal, Level 2 Auto-Notify automatically routes the incident to the Security Administrator queue.
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#0f172a' }}>Standard Operating Procedures for Host:</p>
                  <ol style={{ margin: '0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li>Do not permit physical asset exit if serial numbers do not match.</li>
                    <li>Retain asset in Secure Holding Bay 2 pending administrative clearance.</li>
                    <li>Verify carrier manifests against authorized vendor whitelist.</li>
                    <li>Contact Security Dispatch Lead at Ext. 4040 for urgent exceptions.</li>
                  </ol>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Node telemetry is monitored 24/7 by the AssetMX Central Compliance Engine.
                </div>
              </div>

              <div className="amx-host-modal-footer">
                <button
                  type="button"
                  className="amx-host-action-btn-primary"
                  onClick={() => setIsEscalationGuideOpen(false)}
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Toast */}
        {toastMessage && (
          <div className="amx-host-toast" role="status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

