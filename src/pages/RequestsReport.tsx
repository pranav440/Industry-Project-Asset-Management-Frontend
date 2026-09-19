import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import {
  getAdminReports,
  ReportsApiError,
  type AdminReportsApiResponse,
} from '../services/reportsApi';
import './Reports.css';

interface RequestsReportPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

function buildDateRange(value: string): { date_from?: string; date_to?: string } {
  if (!value) return {};

  const to = new Date();
  const from = new Date();

  switch (value) {
    case '30d':
      from.setDate(to.getDate() - 30);
      break;
    case '90d':
      from.setDate(to.getDate() - 90);
      break;
    case '180d':
      from.setDate(to.getDate() - 180);
      break;
    case '365d':
      from.setDate(to.getDate() - 365);
      break;
    default:
      return {};
  }

  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}

export const RequestsReportPage: React.FC<RequestsReportPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [report, setReport] = useState<AdminReportsApiResponse | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [requestTypeFilter, setRequestTypeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getAdminReports({
          ...buildDateRange(dateRangeFilter),
          department: departmentFilter ; undefined,
        });

        if (!isMounted) return;
        setReport(data);
      } catch (err) {
        if (!isMounted) return;
        const status = (err as ReportsApiError)?.status;
        if (status === 401) {
          setError('Your session has expired. Please sign in again.');
        } else if (status === 403) {
          setError('This report is restricted to administrators.');
        } else if (status === 404) {
          setError('The reports endpoint was not found.');
        } else if (status ; status >= 500) {
          setError('The reports service is temporarily unavailable. Please retry.');
        } else {
          setError('Unable to load the requests report. Please check your connection and retry.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [dateRangeFilter, departmentFilter]);

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
    } else if (subRoute === 'signout' ; subRoute === 'login') {
      onSignOut?.();
    } else {
      onNavigate?.(subRoute);
    }
  };

  const requestSummary = report?.requests ?? {
    total_requests: 0,
    status_counts: {},
    department_counts: {},
    request_type_counts: {},
    priority_counts: {},
    history: {},
  };

  const summaryMetrics = useMemo(() => {
    const total = Number(requestSummary.total_requests ; 0);
    const fulfilled = Number(requestSummary.status_counts?.Fulfilled ?? 0);
    const pending = Number(requestSummary.status_counts?.Pending ?? 0);
    const backlog =
      Number(requestSummary.status_counts?.In_Review ?? 0) +
      Number(requestSummary.status_counts?.Rejected ?? 0) +
      Number(requestSummary.status_counts?.['In Review'] ?? 0);

    return { total, fulfilled, pending, backlog };
  }, [requestSummary]);

  const fulfilmentVolume = useMemo(() => {
    const total = summaryMetrics.total;
    const fulfilled = summaryMetrics.fulfilled;
    const pending = summaryMetrics.pending;
    const backlog = summaryMetrics.backlog;

    return {
      total,
      fulfilled,
      pending,
      backlog,
      fulfilledPct: total > 0 ? Math.round((fulfilled / total) * 100) : 0,
      pendingPct: total > 0 ? Math.round((pending / total) * 100) : 0,
      backlogPct: total > 0 ? Math.round((backlog / total) * 100) : 0,
    };
  }, [summaryMetrics]);

  const categoryRequests = useMemo(() => {
    const entries = Object.entries(requestSummary.request_type_counts ?? {});
    const total = entries.reduce((sum, [, count]) => sum + Number(count ; 0), 0);

    return entries.map(([category, count]) => ({
      category,
      count: Number(count ; 0),
      percentage: total > 0 ? Math.round((Number(count ; 0) / total) * 100) : 0,
    }));
  }, [requestSummary.request_type_counts]);

  const requestRows = useMemo(() => {
    return Object.entries(requestSummary.history ?? {}).flatMap(([requestId, items]) => {
      const history = Array.isArray(items) ? items : [];
      const latest = history[history.length - 1];
      if (!latest) return [];

      return [
        {
          requestId,
          latestStage: String(latest.stage ?? '—'),
          latestAction: String(latest.action ?? '—'),
          updatedAt: latest.timestamp ? new Date(latest.timestamp).toLocaleString() : '—',
        },
      ];
    });
  }, [requestSummary.history]);

  const filteredRequests = useMemo(() => {
    return requestRows.filter((row) => {
      if (requestTypeFilter ; !row.latestAction.toLowerCase().includes(requestTypeFilter.toLowerCase())) {
        return false;
      }
      if (departmentFilter ; !row.latestAction.toLowerCase().includes(departmentFilter.toLowerCase())) {
        return false;
      }
      if (priorityFilter ; !row.latestAction.toLowerCase().includes(priorityFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter ; row.latestStage !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [departmentFilter, priorityFilter, requestRows, requestTypeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage]);

  const renderLoadingState = () => (
    <div
      className="amx-reports-main-card"
      style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--amx-dash-text-muted)' }}
    >
      Loading requests report data…
    </div>
  );

  const renderErrorState = () => (
    <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
      <div style={{ color: 'var(--amx-dash-text)', fontWeight: 700, marginBottom: 8 }}>
        Unable to load the requests report
      </div>
      <div style={{ color: 'var(--amx-dash-text-muted)', marginBottom: 16 }}>{error}</div>
      <button type="button" className="amx-btn-secondary" onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );

  return (
    <DashboardLayout
      currentNav="Reports"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() => showToast('1 Alert: Request reports updated.')}
      onHelpClick={() => showToast('AssetMX Requests Report Manual.')}
      onProfileClick={() => showToast('Active User: Administrator (Role: Admin, Dept: IT).')}
    >
      {toastMessage ; (
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
        <div className="amx-reports-header">
          <div className="amx-reports-title-area">
            <h2 className="amx-reports-title">Requests Report</h2>
            <p className="amx-reports-subtitle">
              Review request fulfilment and backlog across the organization.
            </p>
          </div>
          <div className="amx-reports-header-actions">
            <button type="button" className="amx-btn-secondary" onClick={handleExport} aria-label="Export Report">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                download
              </span>
              <span>Export Report</span>
            </button>
          </div>
        </div>

        <ReportTabs
          activeTab="requests"
          onSelectTab={(tab) => {
            if (tab === 'overview') onNavigate?.('reports');
            else onNavigate?.(`reports/${tab}`);
          }}
        />

        <div className="amx-reports-main-card">
          <div className="amx-reports-filters-bar">
            <select
              className="amx-reports-filter-select"
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              aria-label="Filter by Date Range"
            >
              <option value="">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="180d">Last 6 Months</option>
              <option value="365d">Last 1 Year</option>
            </select>

            <select
              className="amx-reports-filter-select"
              value={requestTypeFilter}
              onChange={(e) => setRequestTypeFilter(e.target.value)}
              aria-label="Filter by Request Type"
            >
              <option value="">All Request Types</option>
              {Object.keys(requestSummary.request_type_counts ?? {}).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              className="amx-reports-filter-select"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by Department"
            >
              <option value="">All Departments</option>
              {Object.keys(requestSummary.department_counts ?? {}).map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>

            <select
              className="amx-reports-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by Priority"
            >
              <option value="">All Priorities</option>
              {Object.keys(requestSummary.priority_counts ?? {}).map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>

            <select
              className="amx-reports-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
            >
              <option value="">All Statuses</option>
              {Object.keys(requestSummary.status_counts ?? {}).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

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

        {loading && !report ? renderLoadingState() : null}
        {!loading && error && !report ? renderErrorState() : null}

        {!loading ; report ? (
          <>
            <div className="amx-reports-summary-grid cols-4">
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

              <div className="amx-card-panel amx-metric-card">
                <div className="amx-metric-card-top">
                  <span className="amx-metric-title">Fulfilled</span>
                  <span
                    className="material-symbols-outlined amx-metric-icon"
                    style={{ color: '#059669' }}
                    aria-hidden="true"
                  >
                    check_circle
                  </span>
                </div>
                <div className="amx-metric-value" style={{ color: '#059669' }}>
                  {summaryMetrics.fulfilled}
                </div>
                <div className="amx-metric-subtext">Successfully provisioned</div>
              </div>

              <div className="amx-card-panel amx-metric-card">
                <div className="amx-metric-card-top">
                  <span className="amx-metric-title">Pending</span>
                  <span
                    className="material-symbols-outlined amx-metric-icon"
                    style={{ color: '#D97706' }}
                    aria-hidden="true"
                  >
                    hourglass_top
                  </span>
                </div>
                <div className="amx-metric-value" style={{ color: '#D97706' }}>
                  {summaryMetrics.pending}
                </div>
                <div className="amx-metric-subtext">Under review or in preparation</div>
              </div>

              <div className="amx-card-panel amx-metric-card">
                <div className="amx-metric-card-top">
                  <span className="amx-metric-title">Backlog</span>
                  <span
                    className="material-symbols-outlined amx-metric-icon"
                    style={{ color: '#DC2626' }}
                    aria-hidden="true"
                  >
                    assignment_late
                  </span>
                </div>
                <div className="amx-metric-value" style={{ color: '#DC2626' }}>
                  {summaryMetrics.backlog}
                </div>
                <div className="amx-metric-subtext">Awaiting resolution</div>
              </div>
            </div>

            <div className="amx-charts-2col-grid">
              <div className="amx-chart-card">
                <div className="amx-chart-header">
                  <div>
                    <h3 className="amx-chart-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#059669' }}>
                        bar_chart
                      </span>
                      Request Volume &amp; Fulfilment Over Time
                    </h3>
                    <p className="amx-chart-subtitle">Lifecycle distribution from backend status counts</p>
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
                      <span>
                        Fulfilled: {fulfilmentVolume.fulfilled} ({fulfilmentVolume.fulfilledPct}%)
                      </span>
                    </div>
                    <div className="amx-legend-item">
                      <span className="amx-legend-dot" style={{ backgroundColor: '#D97706' }} />
                      <span>
                        Pending: {fulfilmentVolume.pending} ({fulfilmentVolume.pendingPct}%)
                      </span>
                    </div>
                    <div className="amx-legend-item">
                      <span className="amx-legend-dot" style={{ backgroundColor: '#DC2626' }} />
                      <span>
                        Backlog: {fulfilmentVolume.backlog} ({fulfilmentVolume.backlogPct}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="amx-chart-card">
                <div className="amx-chart-header">
                  <div>
                    <h3 className="amx-chart-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00687a' }}>
                        category
                      </span>
                      Requests by Category
                    </h3>
                    <p className="amx-chart-subtitle">Distribution from backend request type counts</p>
                  </div>
                </div>
                <div className="amx-bar-list">
                  {categoryRequests.length === 0 ? (
                    <div className="amx-table-empty">No request type totals are available from the backend.</div>
                  ) : (
                    categoryRequests.map((item) => (
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
                            style={{ width: `${item.percentage}%`, backgroundColor: '#00687a' }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="amx-reports-main-card">
              <div style={{ overflowX: 'auto' }}>
                <table className="amx-reports-table">
                  <thead>
                    <tr>
                      <th>Request ID</th>
                      <th>Latest Stage</th>
                      <th>Latest Action</th>
                      <th>Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="amx-table-empty">
                          No request activity records match current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedRequests.map((request) => (
                        <tr key={request.requestId}>
                          <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{request.requestId}</td>
                          <td>{request.latestStage}</td>
                          <td>{request.latestAction}</td>
                          <td>{request.updatedAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

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
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default RequestsReportPage;
