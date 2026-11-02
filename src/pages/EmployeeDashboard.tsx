import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import { getEmployeeDashboard, type EmployeeDashboardApiResponse } from '../services/dashboardApi';
import './EmployeeDashboard.css';

interface EmployeeDashboardPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

type RequestFilterTab = 'all' | 'open' | 'closed';

function getAssetIcon(category?: string, name?: string): string {
  const text = `${category || ''} ${name || ''}`.toLowerCase();
  if (text.includes('laptop') || text.includes('macbook') || text.includes('thinkpad') || text.includes('compute')) {
    return 'laptop_mac';
  }
  if (text.includes('monitor') || text.includes('display') || text.includes('ultrasharp')) {
    return 'desktop_windows';
  }
  if (text.includes('mouse') || text.includes('keyboard') || text.includes('peripheral') || text.includes('adapter')) {
    return 'mouse';
  }
  if (text.includes('phone') || text.includes('mobile') || text.includes('tablet')) {
    return 'smartphone';
  }
  return 'devices';
}

export const EmployeeDashboardPage: React.FC<EmployeeDashboardPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<RequestFilterTab>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<EmployeeDashboardApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const currentUser = getUser();

  const fetchDashboard = () => {
    setLoading(true);
    setError(null);
    getEmployeeDashboard()
      .then((data) => {
        setDashboardData(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load employee dashboard data');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      onNavigate?.('dashboard');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else if (subRoute === 'create-request') {
      onNavigate?.('create-request');
    } else if (subRoute === 'my-requests') {
      onNavigate?.('my-requests');
    } else if (subRoute === 'my-assigned-assets') {
      onNavigate?.('my-assigned-assets');
    } else if (subRoute === 'my-consumption') {
      onNavigate?.('my-consumption');
    } else if (subRoute.startsWith('my-requests/')) {
      onNavigate?.(subRoute);
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} — Employee self-service.`);
    }
  };

  const handleViewDetails = (reqId: string) => {
    handleNav(`my-requests/${reqId}`);
  };

  // KPI Calculations from backend response
  const openRequestsCount =
    dashboardData?.summary?.openRequests ??
    dashboardData?.summary?.open_requests ??
    dashboardData?.openRequests ??
    dashboardData?.open_requests ??
    0;

  const awaitingApprovalCount =
    dashboardData?.summary?.awaitingApproval ??
    dashboardData?.summary?.awaiting_approval ??
    dashboardData?.awaitingApproval ??
    dashboardData?.awaiting_approval ??
    0;

  const assignedAssetsCount =
    dashboardData?.summary?.assignedAssetsCount ??
    dashboardData?.summary?.assigned_assets_count ??
    dashboardData?.assignedAssetsCount ??
    dashboardData?.assigned_assets_count ??
    0;

  const consumablesReceivedCount =
    dashboardData?.summary?.consumablesReceived ??
    dashboardData?.summary?.consumables_received ??
    dashboardData?.consumablesReceived ??
    dashboardData?.consumables_received ??
    0;

  const rawRequests = useMemo(() => {
    return dashboardData?.recentRequests ?? dashboardData?.recent_requests ?? [];
  }, [dashboardData]);

  const openRequests = useMemo(() => {
    return rawRequests.filter((r: any) => r.status === 'Pending' || r.status === 'In Review');
  }, [rawRequests]);

  const closedRequests = useMemo(() => {
    return rawRequests.filter((r: any) => r.status === 'Fulfilled' || r.status === 'Rejected');
  }, [rawRequests]);

  const filteredRequests = useMemo(() => {
    if (activeTab === 'open') return openRequests;
    if (activeTab === 'closed') return closedRequests;
    return rawRequests;
  }, [activeTab, rawRequests, openRequests, closedRequests]);

  const assignedAssets = useMemo(() => {
    return dashboardData?.assignedAssets ?? dashboardData?.assigned_assets ?? [];
  }, [dashboardData]);

  const consumption = useMemo(() => {
    return (
      dashboardData?.consumptionSummary ??
      dashboardData?.consumption_summary ??
      dashboardData?.consumption
    );
  }, [dashboardData]);

  return (
    <DashboardLayout
      currentNav="Dashboard"
      role="employee"
      userName={currentUser?.full_name || 'Marcus Vance'}
      userRoleSubtitle="Product Design (Employee)"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      searchPlaceholder="Search my requests, assets..."
      onNotificationsClick={() =>
        showToast('Notifications: No pending system alerts.')
      }
      onHelpClick={() =>
        showToast('AssetMX Employee Self-Service Help & Documentation.')
      }
      onProfileClick={() =>
        showToast(`Signed in as: ${currentUser?.full_name || 'Marcus Vance'} (${currentUser?.email || 'employee@assetmx.local'}) — Role: Employee`)
      }
    >
      <div className="amx-emp-dashboard">
        {/* Top Title & Action Bar */}
        <div className="amx-emp-top-bar">
          <div className="amx-emp-title-wrap">
            <div className="amx-emp-title-row">
              <h1 className="amx-emp-headline">Employee Dashboard</h1>
              <span className="amx-emp-pill-selfservice">Self-Service</span>
            </div>
            <p className="amx-emp-subtitle">
              Track your requests, assigned assets, and material usage.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="amx-emp-create-btn"
              onClick={() => handleNav('create-request')}
              aria-label="Create Request"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                add
              </span>
              <span>Create Request</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="amx-emp-panel-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '32px', color: 'var(--amx-dash-secondary, #00687a)', animation: 'spin 1s linear infinite' }}
              aria-hidden="true"
            >
              sync
            </span>
            <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--amx-dash-text-muted, #45464d)' }}>
              Loading employee dashboard data...
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div
            className="amx-emp-panel-card"
            style={{
              padding: '24px',
              border: '1px solid #ffdad6',
              backgroundColor: '#fff8f7',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '28px' }} aria-hidden="true">
                error
              </span>
              <div>
                <h3 style={{ margin: 0, color: '#410002', fontSize: '16px' }}>Dashboard Data Error</h3>
                <p style={{ margin: '4px 0 0', color: '#93000a', fontSize: '14px' }}>{error}</p>
              </div>
            </div>
            <button
              type="button"
              className="amx-emp-create-btn"
              style={{ marginTop: '16px' }}
              onClick={fetchDashboard}
            >
              Retry
            </button>
          </div>
        )}

        {/* Live Content */}
        {!loading && !error && (
          <>
            {/* Section 1: Personal Summary KPI Cards */}
            <div className="amx-emp-kpi-grid">
              {/* Card 1: My Open Requests */}
              <div className="amx-emp-kpi-card">
                <div className="amx-emp-kpi-header">
                  <div className="amx-emp-kpi-meta">
                    <span className="amx-emp-kpi-label">My Open Requests</span>
                    <span className="amx-emp-kpi-value">{openRequestsCount}</span>
                  </div>
                  <div className="amx-emp-kpi-icon-wrap" aria-hidden="true">
                    <span className="material-symbols-outlined">pending_actions</span>
                  </div>
                </div>
                <div className="amx-emp-kpi-footer">
                  <span className="amx-emp-kpi-footer-subtext">Active in pipeline</span>
                  <span className="amx-emp-kpi-footer-pill">
                    {openRequestsCount} In Progress
                  </span>
                </div>
              </div>

              {/* Card 2: Awaiting Approval */}
              <div className="amx-emp-kpi-card">
                <div className="amx-emp-kpi-header">
                  <div className="amx-emp-kpi-meta">
                    <span className="amx-emp-kpi-label">Awaiting Approval</span>
                    <span className="amx-emp-kpi-value">{awaitingApprovalCount}</span>
                  </div>
                  <div className="amx-emp-kpi-icon-wrap" aria-hidden="true">
                    <span className="material-symbols-outlined">hourglass_top</span>
                  </div>
                </div>
                <div className="amx-emp-kpi-footer">
                  <span className="amx-emp-kpi-footer-subtext">Pending approver decision</span>
                  <span className="amx-emp-kpi-footer-pill">
                    Pending Review
                  </span>
                </div>
              </div>

              {/* Card 3: My Assigned Assets */}
              <div className="amx-emp-kpi-card">
                <div className="amx-emp-kpi-header">
                  <div className="amx-emp-kpi-meta">
                    <span className="amx-emp-kpi-label">My Assigned Assets</span>
                    <span className="amx-emp-kpi-value">{assignedAssetsCount}</span>
                  </div>
                  <div className="amx-emp-kpi-icon-wrap cyan" aria-hidden="true">
                    <span className="material-symbols-outlined">devices</span>
                  </div>
                </div>
                <div className="amx-emp-kpi-footer">
                  <span className="amx-emp-kpi-footer-subtext">Formally allocated units</span>
                  <span className="amx-emp-kpi-footer-pill cyan">
                    Verified Custody
                  </span>
                </div>
              </div>

              {/* Card 4: Consumables Received */}
              <div className="amx-emp-kpi-card">
                <div className="amx-emp-kpi-header">
                  <div className="amx-emp-kpi-meta">
                    <span className="amx-emp-kpi-label">Consumables Received</span>
                    <span className="amx-emp-kpi-value">
                      {consumablesReceivedCount}
                    </span>
                  </div>
                  <div className="amx-emp-kpi-icon-wrap teal" aria-hidden="true">
                    <span className="material-symbols-outlined">inventory_2</span>
                  </div>
                </div>
                <div className="amx-emp-kpi-footer">
                  <span className="amx-emp-kpi-footer-subtext">Issued to your custody this cycle</span>
                  <span className="amx-emp-kpi-footer-pill cyan">
                    {consumption?.period || 'This Month'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Main Operational & Accountability Panels */}
            <div className="amx-emp-main-grid">
              {/* Left Column: My Requests Overview */}
              <div className="amx-emp-panel-card">
                {/* Header & View All */}
                <div className="amx-emp-card-header">
                  <div className="amx-emp-card-title-group">
                    <div className="amx-emp-card-title-row">
                      <h2 className="amx-emp-card-title">My Requests</h2>
                      <span className="amx-emp-card-badge">Tracking</span>
                    </div>
                    <p className="amx-emp-card-desc">
                      Real-time status of your requisitions and fulfillment schedule
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="amx-emp-view-all-link"
                      onClick={() => handleNav('my-requests')}
                    >
                      <span>View All Requests</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                        arrow_forward
                      </span>
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="amx-emp-filter-tabs" role="tablist" aria-label="Request status filter tabs">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'all'}
                    className={`amx-emp-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    All ({rawRequests.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'open'}
                    className={`amx-emp-tab-btn ${activeTab === 'open' ? 'active' : ''}`}
                    onClick={() => setActiveTab('open')}
                  >
                    Open ({openRequests.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'closed'}
                    className={`amx-emp-tab-btn ${activeTab === 'closed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('closed')}
                  >
                    Closed ({closedRequests.length})
                  </button>
                </div>

                {/* Table */}
                <div className="amx-emp-table-container">
                  <table className="amx-emp-table" aria-label="Employee Requests List">
                    <thead>
                      <tr>
                        <th scope="col">Request ID</th>
                        <th scope="col">Item &amp; Category</th>
                        <th scope="col" style={{ textAlign: 'center' }}>Qty</th>
                        <th scope="col">Status</th>
                        <th scope="col">Submitted</th>
                        <th scope="col">Priority</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="amx-emp-empty-state">
                            No requests found for the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredRequests.map((req: any) => {
                          const reqId = req.request_id || req.id;
                          const itemName = req.requested_item || req.requestedItem || 'Requested Item';
                          const status = req.status || 'Pending';
                          const statusLower = status.toLowerCase().replace(/\s+/g, '-');
                          const dateStr = req.request_date || req.requestDate || '—';
                          const priority = req.priority || 'Medium';

                          return (
                            <tr key={reqId}>
                              <td className="amx-emp-table-id">{reqId}</td>
                              <td>
                                <div className="amx-emp-item-cell">
                                  <span className="amx-emp-item-name">{itemName}</span>
                                  <span className="amx-emp-item-cat">{req.category}</span>
                                </div>
                              </td>
                              <td className="amx-emp-qty-cell">{req.quantity}</td>
                              <td>
                                <span className={`amx-emp-status-pill ${statusLower}`}>
                                  <span className="dot" aria-hidden="true" />
                                  <span>{status}</span>
                                </span>
                              </td>
                              <td className="amx-emp-date-cell">{dateStr}</td>
                              <td className="amx-emp-date-cell">{priority}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="amx-emp-action-btn"
                                  onClick={() => handleViewDetails(reqId)}
                                  aria-label={`View details for ${reqId}`}
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="amx-emp-table-footer">
                  <span>
                    Showing {filteredRequests.length} of {rawRequests.length} entries • Live employee self-service view
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    Authenticated as: {currentUser?.email}
                  </span>
                </div>
              </div>

              {/* Right Column: Assigned Assets & Consumption */}
              <div className="amx-emp-side-col">
                {/* Card 1: My Assigned Assets */}
                <div className="amx-emp-panel-card">
                  <div className="amx-emp-card-header">
                    <div className="amx-emp-card-title-group">
                      <div className="amx-emp-card-title-row">
                        <h3 className="amx-emp-card-title">My Assigned Assets</h3>
                        <span className="amx-emp-card-badge cyan">
                          {assignedAssetsCount} Units
                        </span>
                      </div>
                      <p className="amx-emp-card-desc">
                        Formally allocated hardware and equipment in your custody.
                      </p>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="amx-emp-view-all-link"
                        id="empViewAllAssignedAssetsBtn"
                        onClick={() => handleNav('my-assigned-assets')}
                      >
                        <span>View All →</span>
                      </button>
                    </div>
                  </div>

                  {/* Asset List */}
                  <div className="amx-emp-asset-list">
                    {assignedAssets.length === 0 ? (
                      <div className="amx-emp-empty-state" style={{ padding: '24px 12px' }}>
                        No assets currently assigned to your custody.
                      </div>
                    ) : (
                      assignedAssets.slice(0, 5).map((asset: any) => {
                        const assetId = asset.asset_id || asset.id;
                        const assetName = asset.name;
                        const assetStatus = asset.status;
                        const assetLoc = asset.location || 'Assigned Location';
                        const icon = getAssetIcon(asset.category, asset.name);

                        return (
                          <div key={assetId} className="amx-emp-asset-item">
                            <div className="amx-emp-asset-item-top">
                              <div className="amx-emp-asset-title-group">
                                <span className="material-symbols-outlined amx-emp-asset-icon" aria-hidden="true">
                                  {icon}
                                </span>
                                <span className="amx-emp-asset-name" title={assetName}>
                                  {assetName}
                                </span>
                              </div>
                              <span className="amx-emp-asset-status-pill">
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">
                                  verified
                                </span>
                                <span>{assetStatus}</span>
                              </span>
                            </div>
                            <div className="amx-emp-asset-item-bottom">
                              <span className="amx-emp-asset-id">
                                {assetId}
                              </span>
                              <span className="amx-emp-asset-loc" title={assetLoc}>
                                {assetLoc}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom Notice */}
                  <div className="amx-emp-card-disclaimer">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      info
                    </span>
                    <span>
                      Assets remain assigned to your custody. Contact IT support for reassignment or handback.
                    </span>
                  </div>
                </div>

                {/* Card 2: My Consumption Summary */}
                <div className="amx-emp-panel-card">
                  <div className="amx-emp-card-header">
                    <div className="amx-emp-card-title-group">
                      <div className="amx-emp-card-title-row">
                        <h3 className="amx-emp-card-title">My Consumption</h3>
                        <span className="amx-emp-card-badge">
                          {consumption?.period || 'This Month'}
                        </span>
                      </div>
                      <p className="amx-emp-card-desc">
                        Summary of consumables received and fulfilled this cycle.
                      </p>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="amx-emp-view-all-link"
                        id="empViewConsumptionSummaryBtn"
                        onClick={() => handleNav('my-consumption')}
                      >
                        <span>View Summary →</span>
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="amx-emp-consumption-body">
                    {!consumption || !consumption.categories || consumption.categories.length === 0 ? (
                      <div className="amx-emp-empty-state" style={{ padding: '24px 12px' }}>
                        No consumables issued for this reporting cycle.
                      </div>
                    ) : (
                      <>
                        {/* Counter Box */}
                        <div className="amx-emp-consumption-counter-box">
                          <div className="amx-emp-counter-row">
                            <div>
                              <div className="amx-emp-counter-label">Total Issued</div>
                              <div className="amx-emp-counter-val">
                                {consumption.totalIssued ?? consumption.total_issued ?? 0} Units
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="amx-emp-counter-label">Active Categories</div>
                              <div className="amx-emp-counter-cat-val">
                                {consumption.activeCategoriesCount ?? consumption.active_categories_count ?? 0} Categories
                              </div>
                            </div>
                          </div>
                          <div className="amx-emp-counter-footnote">
                            Issued to {currentUser?.full_name || 'you'} this month: {consumption.totalIssued ?? consumption.total_issued ?? 0} units across {consumption.activeCategoriesCount ?? consumption.active_categories_count ?? 0} categories
                          </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="amx-emp-progress-list">
                          {consumption.categories.map((cat: any) => (
                            <div key={cat.name} className="amx-emp-progress-item">
                              <div className="amx-emp-progress-header">
                                <span className="amx-emp-progress-name">{cat.name}</span>
                                <span className="amx-emp-progress-qty">{cat.units} units</span>
                              </div>
                              <div className="amx-emp-progress-track">
                                <div
                                  className="amx-emp-progress-fill"
                                  style={{
                                    width: `${cat.percentage}%`,
                                    backgroundColor: cat.color || '#00687a',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Bottom Notice */}
                        <div className="amx-emp-consumption-footer">
                          <span>Cycle restarts next month</span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                            Log Ref: {consumption.cycleReference || consumption.cycle_reference || 'REC-CURRENT'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="amx-emp-toast" role="alert">
          <span className="material-symbols-outlined" style={{ color: 'var(--amx-dash-cyan-bright, #57dffe)', fontSize: '20px' }}>
            info
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </DashboardLayout>
  );
};

export default EmployeeDashboardPage;
