import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import { getAdminReports, ReportsApiError, type AdminReportsApiResponse } from '../services/reportsApi';
import './Reports.css';

interface DisposalReportPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

function buildDateRange(value: string): { date_from?: string; date_to?: string } {
  if (!value) return {};
  const to = new Date();
  const from = new Date(to);
  const days = value === '30d' ? 30 : value === '90d' ? 90 : value === '180d' ? 180 : value === '365d' ? 365 : 0;
  if (!days) return {};
  from.setDate(to.getDate() - days);
  return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
}

export const DisposalReportPage: React.FC<DisposalReportPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [report, setReport] = useState<AdminReportsApiResponse | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdminReports({
          ...buildDateRange(dateRangeFilter),
          location: locationFilter,
          category: categoryFilter,
        });
        if (isMounted) setReport(data);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ReportsApiError && err.status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'Unable to load the disposal report. Please retry.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadReport();
    return () => {
      isMounted = false;
    };
  }, [categoryFilter, dateRangeFilter, locationFilter]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    showToast('Exporting Disposal & Replacement Forecast Ledger (.CSV)...');
  };

  const handleResetFilters = () => {
    setDateRangeFilter('');
    setLocationFilter('');
    setCategoryFilter('');
    setCurrentPage(1);
    showToast('Disposal & replacement filters reset to default.');
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

  const lifecycle = report?.lifecycle;
  const statusDistribution = lifecycle?.status_distribution ?? {};

  // Summary Metrics:
  // - Assets Approaching Disposal
  // - Assets Approaching Replacement
  // - Estimated Lifecycle End
  const summaryMetrics = useMemo(() => {
    return {
      disposedAssets: lifecycle?.disposed_assets ?? 0,
      replacementForecast: lifecycle?.forecast === null ? 'N/A' : '—',
      averageAgeDays: lifecycle?.age_summary.average_asset_age_days ?? 0,
    };
  }, [lifecycle]);

  // Visualization: Lifecycle Milestone Schedule by Quarter
  const quartersSchedule = useMemo(() => {
    const maxUnits = Math.max(1, ...Object.values(statusDistribution));
    return Object.entries(statusDistribution).map(([status, count]) => {
      return {
        quarter: status,
        disposal: Number(count),
        replacement: 0,
        total: Number(count),
        percentage: Math.round((Number(count) / maxUnits) * 100),
      };
    });
  }, [statusDistribution]);

  const lifecycleRows = useMemo(() => Object.entries(statusDistribution), [statusDistribution]);
  const totalPages = Math.max(1, Math.ceil(lifecycleRows.length / pageSize));
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return lifecycleRows.slice(start, start + pageSize);
  }, [lifecycleRows, currentPage]);

  return (
    <DashboardLayout
      currentNav="Reports"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Lifecycle forecast timeline verified.')
      }
      onHelpClick={() => showToast('AssetMX Disposal & Replacement Manual.')}
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
            <h2 className="amx-reports-title">Disposal &amp; Replacement Forecast</h2>
            <p className="amx-reports-subtitle">
              Review assets approaching disposal or replacement based on lifecycle information.
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
          activeTab="disposal"
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
              <option value="">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="180d">Last 6 Months</option>
              <option value="365d">Last 1 Year</option>
            </select>

            {/* Location */}
            <select
              className="amx-reports-filter-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Filter by Location"
            >
              <option value="">All Locations</option>
            </select>

            {/* Category */}
            <select
              className="amx-reports-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by Category"
            >
              <option value="">All Categories</option>
              <option value="Hardware">Hardware</option>
              <option value="Furniture">Furniture</option>
              <option value="Lab Equipment">Lab Equipment</option>
              <option value="IT Equipment">IT Equipment</option>
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

        {loading && <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>Loading lifecycle report data...</div>}
        {!loading && error && (
          <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--amx-dash-text)', fontWeight: 700, marginBottom: 8 }}>Unable to load the disposal report</div>
            <div style={{ color: 'var(--amx-dash-text-muted)', marginBottom: 16 }}>{error}</div>
            <button type="button" className="amx-btn-secondary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {/* 3 Summary Cards Grid */}
        <div className="amx-reports-summary-grid cols-3">
          {/* Assets Approaching Disposal */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Approaching Disposal</span>
              <span className="material-symbols-outlined amx-metric-icon error" aria-hidden="true">
                delete_forever
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#DC2626' }}>
              {summaryMetrics.disposedAssets}
            </div>
            <div className="amx-metric-subtext">Due for retirement or e-waste</div>
          </div>

          {/* Assets Approaching Replacement */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Approaching Replacement</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#7E22CE' }} aria-hidden="true">
                autorenew
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#7E22CE' }}>
              {summaryMetrics.replacementForecast}
            </div>
            <div className="amx-metric-subtext">Due for hardware refresh</div>
          </div>

          {/* Estimated Lifecycle End */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Estimated Lifecycle End</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#00687a' }} aria-hidden="true">
                event_available
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#00687a' }}>
              {summaryMetrics.averageAgeDays} days
            </div>
            <div className="amx-metric-subtext">Total tracked lifecycle actions</div>
          </div>
        </div>

        {/* Visualization: Lifecycle Milestone Schedule by Quarter */}
        <div className="amx-chart-card">
          <div className="amx-chart-header">
            <div>
              <h3 className="amx-chart-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#7E22CE' }}>
                  calendar_month
                </span>
                Lifecycle Status Distribution
              </h3>
              <p className="amx-chart-subtitle">Current lifecycle status counts from the backend</p>
            </div>
          </div>

          <div className="amx-bar-list">
            {quartersSchedule.map((q) => {
              return (
                <div key={q.quarter} className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span style={{ fontWeight: 600 }}>{q.quarter}</span>
                    <span className="amx-bar-count">
                      {q.total} assets
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                    <div className="amx-bar-bg" style={{ flex: 1 }}>
                      <div
                        className="amx-bar-fill"
                        style={{
                          width: `${q.percentage}%`,
                          backgroundColor: '#00687a',
                        }}
                        title={`${q.quarter}: ${q.total}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="amx-chart-legends">
            <div className="amx-legend-item">
              <span className="amx-legend-dot" style={{ backgroundColor: '#00687a' }} />
              <span>Lifecycle status count</span>
            </div>
            <div className="amx-legend-item">
              <span className="amx-legend-dot" style={{ backgroundColor: '#7E22CE' }} />
              <span>Replacement forecast: N/A</span>
            </div>
          </div>
        </div>

        {/* Detailed Registry Table */}
        <div className="amx-reports-main-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="amx-reports-table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Asset Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Current Status</th>
                  <th>Acquisition Date</th>
                  <th>Estimated End of Life</th>
                  <th>Lifecycle Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="amx-table-empty">
                      No lifecycle forecast records match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedAssets.map(([status, count]) => (
                    <tr key={status}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>—</td>
                      <td style={{ fontWeight: 600 }}>{count} assets</td>
                      <td>—</td>
                      <td>—</td>
                      <td>
                        <span className="amx-report-badge available">{status}</span>
                      </td>
                      <td>—</td>
                      <td style={{ fontFamily: 'JetBrains Mono' }}>—</td>
                      <td><span className="amx-report-badge replacement">N/A</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="amx-reports-pagination-bar">
            <span>
              Showing {lifecycleRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, lifecycleRows.length)} of {lifecycleRows.length} lifecycle statuses
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

export default DisposalReportPage;
