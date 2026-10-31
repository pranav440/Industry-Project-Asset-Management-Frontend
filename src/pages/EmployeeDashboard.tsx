import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import {
  getScopedEmployeeRequests,
  getScopedEmployeeAssets,
  getScopedEmployeeConsumption,
} from '../data/employeeData';
import type { RequestItemData } from '../data/requestsData';
import './EmployeeDashboard.css';

interface EmployeeDashboardPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

type RequestFilterTab = 'all' | 'open' | 'closed';

export const EmployeeDashboardPage: React.FC<EmployeeDashboardPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<RequestFilterTab>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentUser = getUser();
  const requests = useMemo(() => getScopedEmployeeRequests(currentUser), [currentUser]);
  const assignedAssets = useMemo(() => getScopedEmployeeAssets(currentUser), [currentUser]);
  const consumption = useMemo(() => getScopedEmployeeConsumption(currentUser), [currentUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // KPI Calculations strictly scoped to employee's own records
  const openRequests = useMemo(() => {
    return requests.filter((r) => r.status === 'Pending' || r.status === 'In Review');
  }, [requests]);

  const awaitingApproval = useMemo(() => {
    return requests.filter((r) => r.status === 'Pending');
  }, [requests]);

  const closedRequests = useMemo(() => {
    return requests.filter((r) => r.status === 'Fulfilled' || r.status === 'Rejected');
  }, [requests]);

  // Tab Filtering for My Requests table
  const filteredRequests = useMemo(() => {
    if (activeTab === 'open') return openRequests;
    if (activeTab === 'closed') return closedRequests;
    return requests;
  }, [activeTab, requests, openRequests, closedRequests]);

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
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} — Employee self-service.`);
    }
  };

  const handleViewDetails = (req: RequestItemData) => {
    showToast(`Viewing details for ${req.id} (${req.requestedItem}) — Read-only details view scheduled for next phase.`);
  };

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
        showToast('Notifications: 1 update — Monitor requisition REQ-2026-0841 moved to In Review.')
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

        {/* Section 1: Personal Summary KPI Cards */}
        <div className="amx-emp-kpi-grid">
          {/* Card 1: My Open Requests */}
          <div className="amx-emp-kpi-card">
            <div className="amx-emp-kpi-header">
              <div className="amx-emp-kpi-meta">
                <span className="amx-emp-kpi-label">My Open Requests</span>
                <span className="amx-emp-kpi-value">{openRequests.length}</span>
              </div>
              <div className="amx-emp-kpi-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined">pending_actions</span>
              </div>
            </div>
            <div className="amx-emp-kpi-footer">
              <span className="amx-emp-kpi-footer-subtext">Active in pipeline</span>
              <span className="amx-emp-kpi-footer-pill">
                {openRequests.length} In Progress
              </span>
            </div>
          </div>

          {/* Card 2: Awaiting Approval */}
          <div className="amx-emp-kpi-card">
            <div className="amx-emp-kpi-header">
              <div className="amx-emp-kpi-meta">
                <span className="amx-emp-kpi-label">Awaiting Approval</span>
                <span className="amx-emp-kpi-value">{awaitingApproval.length}</span>
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
                <span className="amx-emp-kpi-value">{assignedAssets.length}</span>
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
                  {consumption ? consumption.totalIssued : '—'}
                </span>
              </div>
              <div className="amx-emp-kpi-icon-wrap teal" aria-hidden="true">
                <span className="material-symbols-outlined">inventory_2</span>
              </div>
            </div>
            <div className="amx-emp-kpi-footer">
              <span className="amx-emp-kpi-footer-subtext">Issued to your custody this cycle</span>
              <span className="amx-emp-kpi-footer-pill cyan">
                This Month
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
                All ({requests.length})
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
                    <th scope="col">Submitted / Approval</th>
                    <th scope="col">Fulfillment</th>
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
                    filteredRequests.map((req) => {
                      const statusLower = req.status.toLowerCase().replace(/\s+/g, '-');
                      return (
                        <tr key={req.id}>
                          <td className="amx-emp-table-id">{req.id}</td>
                          <td>
                            <div className="amx-emp-item-cell">
                              <span className="amx-emp-item-name">{req.requestedItem}</span>
                              <span className="amx-emp-item-cat">{req.category}</span>
                            </div>
                          </td>
                          <td className="amx-emp-qty-cell">{req.quantity}</td>
                          <td>
                            <span className={`amx-emp-status-pill ${statusLower}`}>
                              <span className="dot" aria-hidden="true" />
                              <span>{req.status}</span>
                            </span>
                          </td>
                          <td className="amx-emp-date-cell">{req.requestDate || '—'}</td>
                          <td className="amx-emp-date-cell">
                            {req.status === 'Fulfilled' ? (req.history.find(h => h.stage === 'Fulfilled')?.timestamp?.split(' ')[0] || '18 Feb 2026') : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="amx-emp-action-btn"
                              onClick={() => handleViewDetails(req)}
                              aria-label={`View details for ${req.id}`}
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
                Showing {filteredRequests.length} of {requests.length} entries • Read-only employee self-service view
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                System Time: 26 Oct 2026 12:00
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
                      {assignedAssets.length} Units
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
                  assignedAssets.map((asset) => (
                    <div key={asset.id} className="amx-emp-asset-item">
                      <div className="amx-emp-asset-item-top">
                        <div className="amx-emp-asset-title-group">
                          <span className="material-symbols-outlined amx-emp-asset-icon" aria-hidden="true">
                            {asset.icon}
                          </span>
                          <span className="amx-emp-asset-name" title={asset.name}>
                            {asset.name}
                            {asset.altName && <span style={{ display: 'none' }}> • {asset.altName}</span>}
                          </span>
                        </div>
                        <span className="amx-emp-asset-status-pill">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">
                            verified
                          </span>
                          <span>{asset.status}</span>
                        </span>
                      </div>
                      <div className="amx-emp-asset-item-bottom">
                        <span className="amx-emp-asset-id">
                          {asset.id}
                          {asset.legacyId && <span style={{ display: 'none' }}> • {asset.legacyId}</span>}
                        </span>
                        <span className="amx-emp-asset-loc" title={asset.location}>
                          {asset.location}
                        </span>
                      </div>
                    </div>
                  ))
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
                      {consumption ? consumption.period : 'This Month'}
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
                {!consumption || consumption.categories.length === 0 ? (
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
                            {consumption.totalIssued} Units
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="amx-emp-counter-label">Active Categories</div>
                          <div className="amx-emp-counter-cat-val">
                            {consumption.activeCategoriesCount} Categories
                          </div>
                        </div>
                      </div>
                      <div className="amx-emp-counter-footnote">
                        Issued to {currentUser?.full_name || 'Marcus Vance'} this month: {consumption.totalIssued} units across {consumption.activeCategoriesCount} categories
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="amx-emp-progress-list">
                      {consumption.categories.map((cat) => (
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
                                backgroundColor: cat.color,
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
                        Log Ref: {consumption.cycleReference}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
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
