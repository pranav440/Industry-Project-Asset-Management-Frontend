import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import { getAdminReports, ReportsApiError, type AdminReportsApiResponse } from '../services/reportsApi';
import './Reports.css';

interface ReassignmentReportPageProps {
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

export const ReassignmentReportPage: React.FC<ReassignmentReportPageProps> = ({
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
          : 'Unable to load the reassignment report. Please retry.');
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
    showToast('Exporting Reassignment & Movement Ledger (.CSV)...');
  };

  const handleResetFilters = () => {
    setDateRangeFilter('');
    setLocationFilter('');
    setCategoryFilter('');
    setCurrentPage(1);
    showToast('Movement filters reset to default.');
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

  const reassignment = report?.reassignment;
  const movements = reassignment?.records ?? [];

  // Summary Metrics:
  // - Total Reassignments
  // - Asset Movements
  // - Locations Involved
  const summaryMetrics = useMemo(() => {
    const totalReassignments = reassignment?.total_movements ?? 0;
    const assetMovements = movements.length;
    const locationsInvolved = Object.keys(reassignment?.by_location ?? {}).length;

    return {
      totalReassignments,
      assetMovements,
      locationsInvolved,
    };
  }, [movements.length, reassignment]);

  // Chart: Reassignment & Movement Activity Over Time (Grouped by month or category)
  const activityByCategory = useMemo(() => {
    const total = reassignment?.total_movements ?? 0;
    return Object.entries(reassignment?.by_location ?? {}).map(([location, count]) => {
      const amount = Number(count);
      return {
        category: location,
        count: amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      };
    });
  }, [reassignment]);

  const totalPages = Math.max(1, Math.ceil(movements.length / pageSize));
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return movements.slice(start, start + pageSize);
  }, [movements, currentPage]);

  return (
    <DashboardLayout
      currentNav="Reports"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Reassignment log records synchronized.')
      }
      onHelpClick={() => showToast('AssetMX Reassignment & Movement Guide.')}
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
            <h2 className="amx-reports-title">Reassignment &amp; Movement</h2>
            <p className="amx-reports-subtitle">
              Review asset reassignment and movement history.
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
          activeTab="reassignment"
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
              {Object.keys(reassignment?.by_location ?? {}).map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
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

        {loading && <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>Loading reassignment report data...</div>}
        {!loading && error && (
          <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--amx-dash-text)', fontWeight: 700, marginBottom: 8 }}>Unable to load the reassignment report</div>
            <div style={{ color: 'var(--amx-dash-text-muted)', marginBottom: 16 }}>{error}</div>
            <button type="button" className="amx-btn-secondary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {/* 3 Summary Cards Grid */}
        <div className="amx-reports-summary-grid cols-3">
          {/* Total Reassignments */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Total Reassignments</span>
              <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">
                swap_horiz
              </span>
            </div>
            <div className="amx-metric-value">{summaryMetrics.totalReassignments}</div>
            <div className="amx-metric-subtext">Custodian &amp; ownership changes</div>
          </div>

          {/* Asset Movements */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Asset Movements</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#00687a' }} aria-hidden="true">
                local_shipping
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#00687a' }}>
              {summaryMetrics.assetMovements}
            </div>
            <div className="amx-metric-subtext">Inter-facility location transfers</div>
          </div>

          {/* Locations Involved */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Locations Involved</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#059669' }} aria-hidden="true">
                location_on
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#059669' }}>
              {summaryMetrics.locationsInvolved}
            </div>
            <div className="amx-metric-subtext">Unique hubs participating in movement</div>
          </div>
        </div>

        {/* Visualization Card */}
        <div className="amx-chart-card">
          <div className="amx-chart-header">
            <div>
              <h3 className="amx-chart-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00687a' }}>
                  timeline
                </span>
                Reassignment &amp; Movement Activity Over Time
              </h3>
              <p className="amx-chart-subtitle">Distribution of custody and location transfers by category</p>
            </div>
          </div>
          <div className="amx-bar-list">
            {activityByCategory.map((item) => (
              <div key={item.category} className="amx-bar-item">
                <div className="amx-bar-meta">
                  <span>{item.category}</span>
                  <span className="amx-bar-count">
                    {item.count} transfers ({item.percentage}%)
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

        {/* Detailed Table */}
        <div className="amx-reports-main-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="amx-reports-table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Asset Name</th>
                  <th>Previous Custodian</th>
                  <th>New Custodian</th>
                  <th>Previous Location</th>
                  <th>New Location</th>
                  <th>Movement Date</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="amx-table-empty">
                      No reassignment or movement records match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((mov) => (
                    <tr key={mov.movement_id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{mov.asset_id}</td>
                      <td style={{ fontWeight: 600 }}>{mov.asset_name}</td>
                      <td>{mov.from_custodian}</td>
                      <td style={{ color: '#00687a', fontWeight: 600 }}>{mov.to_custodian}</td>
                      <td>{mov.from_location}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{mov.to_location}</td>
                      <td>{mov.initiated_at ? new Date(mov.initiated_at).toLocaleString() : '—'}</td>
                      <td style={{ maxWidth: '280px', color: 'var(--amx-dash-text-muted)' }}>
                        {mov.reason || '—'}
                      </td>
                      <td>{mov.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="amx-reports-pagination-bar">
              <span>
                Showing {movements.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, movements.length)} of {movements.length} transfers
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

export default ReassignmentReportPage;
