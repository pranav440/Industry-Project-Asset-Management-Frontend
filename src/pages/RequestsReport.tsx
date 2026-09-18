import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import {
  getStoredReportRequests,
  REPORT_FILTER_OPTIONS,
  type ReportRequestRecord,
} from '../data/reportsData';
import './Reports.css';

interface RequestsReportPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const RequestsReportPage: React.FC<RequestsReportPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [requests, setRequests] = useState<ReportRequestRecord[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [requestTypeFilter, setRequestTypeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setRequests(getStoredReportRequests());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    showToast('Exporting Requests Report Ledger (.CSV)...');
  };

  const handleResetFilters = () => {
    setDateRangeFilter('');
    setRequestTypeFilter('');
    setDepartmentFilter('');
    setPriorityFilter('');
    setStatusFilter('');
    setCurrentPage(1);
    showToast('Request report filters reset to default.');
  };

  const handleNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      onNavigate?.('dashboard');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      onNavigate?.(subRoute);
    }
  };

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (requestTypeFilter && req.requestType !== requestTypeFilter) return false;
      if (departmentFilter && req.department !== departmentFilter) return false;
      if (priorityFilter && req.priority !== priorityFilter) return false;
      if (statusFilter && req.status !== statusFilter) return false;
      return true;
    });
  }, [requests, requestTypeFilter, departmentFilter, priorityFilter, statusFilter]);

  // Summary Metrics:
  // - Total Requests
  // - Fulfilled
  // - Pending
  // - Backlog
  const summaryMetrics = useMemo(() => {
    const total = filteredRequests.length;
    const fulfilled = filteredRequests.filter((r) => r.status === 'Fulfilled').length;
    const pending = filteredRequests.filter((r) => r.status === 'Pending').length;
    const backlog = filteredRequests.filter((r) => r.status === 'Backlog').length;

    return {
      total,
      fulfilled,
      pending,
      backlog,
    };
  }, [filteredRequests]);

  // Chart 1: Request Volume & Fulfilment Over Time (by month representation)
  const fulfilmentVolume = useMemo(() => {
    const total = filteredRequests.length;
    const fulfilled = filteredRequests.filter((r) => r.status === 'Fulfilled').length;
    const pending = filteredRequests.filter((r) => r.status === 'Pending').length;
    const backlog = filteredRequests.filter((r) => r.status === 'Backlog').length;

    const fulfilledPct = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
    const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
    const backlogPct = total > 0 ? Math.round((backlog / total) * 100) : 0;

    return {
      total,
      fulfilled,
      pending,
      backlog,
      fulfilledPct,
      pendingPct,
      backlogPct,
    };
  }, [filteredRequests]);

  // Chart 2: Requests by Category
  const categoryRequests = useMemo(() => {
    const categories: ('Hardware' | 'Furniture' | 'Lab Equipment' | 'IT Equipment' | 'Office Supplies')[] = [
      'Hardware',
      'Furniture',
      'Lab Equipment',
      'IT Equipment',
      'Office Supplies',
    ];

    const total = filteredRequests.length;

    return categories.map((cat) => {
      const count = filteredRequests.filter((r) => r.category === cat).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        category: cat,
        count,
        percentage: pct,
      };
    });
  }, [filteredRequests]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage]);

  return (
    <DashboardLayout
      currentNav="Reports"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Request reports updated.')
      }
      onHelpClick={() => showToast('AssetMX Requests Report Manual.')}
      onProfileClick={() => showToast('Active User: Administrator (Role: Admin, Dept: IT).')}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '80px',
            right: '28px',
            backgroundColor: '#131b2e',
            color: '#acedff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
            fontSize: '13.5px',
            fontWeight: '600',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid rgba(172, 237, 255, 0.35)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#57dffe' }}>
            info
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="amx-reports-container">
        {/* Page Header */}
        <div className="amx-reports-header">
          <div className="amx-reports-title-area">
            <h2 className="amx-reports-title">Requests Report</h2>
            <p className="amx-reports-subtitle">
              Review request fulfilment and backlog across the organization.
            </p>
          </div>
          <div className="amx-reports-header-actions">
            <button
              type="button"
              className="amx-btn-secondary"
              onClick={handleExport}
              aria-label="Export Report"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                download
              </span>
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* Report Navigation Tabs */}
        <ReportTabs
          activeTab="requests"
          onSelectTab={(tab) => {
            if (tab === 'overview') onNavigate?.('reports');
            else onNavigate?.(`reports/${tab}`);
          }}
        />

        {/* Filter Bar */}
        <div className="amx-reports-main-card">
          <div className="amx-reports-filters-bar">
            {/* Date Range */}
            <select
              className="amx-reports-filter-select"
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              aria-label="Filter by Date Range"
            >
              {REPORT_FILTER_OPTIONS.dateRanges.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Request Type */}
            <select
              className="amx-reports-filter-select"
              value={requestTypeFilter}
              onChange={(e) => setRequestTypeFilter(e.target.value)}
              aria-label="Filter by Request Type"
            >
              {REPORT_FILTER_OPTIONS.requestTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Department */}
            <select
              className="amx-reports-filter-select"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by Department"
            >
              {REPORT_FILTER_OPTIONS.departments.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Priority */}
            <select
              className="amx-reports-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by Priority"
            >
              {REPORT_FILTER_OPTIONS.priorities.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              className="amx-reports-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
            >
              {REPORT_FILTER_OPTIONS.requestStatuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Reset */}
            <button
              type="button"
              className="amx-filter-reset-btn"
              onClick={handleResetFilters}
              aria-label="Reset all filters"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                restart_alt
              </span>
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Cards Grid */}
        <div className="amx-reports-summary-grid cols-4">
          {/* Total Requests */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Total Requests</span>
              <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">
                pending_actions
              </span>
            </div>
            <div className="amx-metric-value">{summaryMetrics.total}</div>
            <div className="amx-metric-subtext">Total submissions recorded</div>
          </div>

          {/* Fulfilled */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Fulfilled</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#059669' }} aria-hidden="true">
                check_circle
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#059669' }}>
              {summaryMetrics.fulfilled}
            </div>
            <div className="amx-metric-subtext">Successfully provisioned</div>
          </div>

          {/* Pending */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Pending</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#D97706' }} aria-hidden="true">
                hourglass_top
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#D97706' }}>
              {summaryMetrics.pending}
            </div>
            <div className="amx-metric-subtext">Under review or in preparation</div>
          </div>

          {/* Backlog */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Backlog</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#DC2626' }} aria-hidden="true">
                assignment_late
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#DC2626' }}>
              {summaryMetrics.backlog}
            </div>
            <div className="amx-metric-subtext">Awaiting stock replenishment</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="amx-charts-2col-grid">
          {/* Chart 1: Request Volume & Fulfilment Over Time */}
          <div className="amx-chart-card">
            <div className="amx-chart-header">
              <div>
                <h3 className="amx-chart-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#059669' }}>
                    bar_chart
                  </span>
                  Request Volume &amp; Fulfilment Over Time
                </h3>
                <p className="amx-chart-subtitle">Lifecycle distribution across organization</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="amx-stacked-bar-bg">
                <div
                  className="amx-stacked-segment"
                  style={{ width: `${fulfilmentVolume.fulfilledPct}%`, backgroundColor: '#059669' }}
                  title={`Fulfilled: ${fulfilmentVolume.fulfilled} (${fulfilmentVolume.fulfilledPct}%)`}
                />
                <div
                  className="amx-stacked-segment"
                  style={{ width: `${fulfilmentVolume.pendingPct}%`, backgroundColor: '#D97706' }}
                  title={`Pending: ${fulfilmentVolume.pending} (${fulfilmentVolume.pendingPct}%)`}
                />
                <div
                  className="amx-stacked-segment"
                  style={{ width: `${fulfilmentVolume.backlogPct}%`, backgroundColor: '#DC2626' }}
                  title={`Backlog: ${fulfilmentVolume.backlog} (${fulfilmentVolume.backlogPct}%)`}
                />
              </div>

              <div className="amx-chart-legends">
                <div className="amx-legend-item">
                  <span className="amx-legend-dot" style={{ backgroundColor: '#059669' }} />
                  <span>Fulfilled: {fulfilmentVolume.fulfilled} ({fulfilmentVolume.fulfilledPct}%)</span>
                </div>
                <div className="amx-legend-item">
                  <span className="amx-legend-dot" style={{ backgroundColor: '#D97706' }} />
                  <span>Pending: {fulfilmentVolume.pending} ({fulfilmentVolume.pendingPct}%)</span>
                </div>
                <div className="amx-legend-item">
                  <span className="amx-legend-dot" style={{ backgroundColor: '#DC2626' }} />
                  <span>Backlog: {fulfilmentVolume.backlog} ({fulfilmentVolume.backlogPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Requests by Category */}
          <div className="amx-chart-card">
            <div className="amx-chart-header">
              <div>
                <h3 className="amx-chart-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00687a' }}>
                    category
                  </span>
                  Requests by Category
                </h3>
                <p className="amx-chart-subtitle">Factual demand distribution across categories</p>
              </div>
            </div>
            <div className="amx-bar-list">
              {categoryRequests.map((item) => (
                <div key={item.category} className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span>{item.category}</span>
                    <span className="amx-bar-count">
                      {item.count} requests ({item.percentage}%)
                    </span>
                  </div>
                  <div className="amx-bar-bg">
                    <div
                      className="amx-bar-fill"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: '#00687a',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="amx-reports-main-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="amx-reports-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Requester</th>
                  <th>Department</th>
                  <th>Request Type</th>
                  <th>Requested Item</th>
                  <th>Priority</th>
                  <th>Request Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="amx-table-empty">
                      No request records match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((req) => (
                    <tr key={req.id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{req.id}</td>
                      <td>{req.requester}</td>
                      <td>{req.department}</td>
                      <td>
                        <span
                          className={`amx-type-badge ${
                            req.requestType === 'Asset Request' ? 'asset' : 'consumable'
                          }`}
                        >
                          {req.requestType}
                        </span>
                      </td>
                      <td>{req.requestedItem}</td>
                      <td>
                        <span className={`amx-priority-badge ${req.priority.toLowerCase()}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td>{req.requestDate}</td>
                      <td>
                        <span
                          className={`amx-report-badge ${
                            req.status === 'Fulfilled'
                              ? 'fulfilled'
                              : req.status === 'Pending'
                              ? 'pending'
                              : 'backlog'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="amx-reports-pagination-bar">
            <span>
              Showing {filteredRequests.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredRequests.length)} of {filteredRequests.length} requests
            </span>
            <div className="amx-pagination-controls">
              <button
                type="button"
                className="amx-pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous Page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  chevron_left
                </span>
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="amx-pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next Page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RequestsReportPage;
