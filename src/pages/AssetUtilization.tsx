import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import { getAdminReports, ReportsApiError, type AdminReportsApiResponse } from '../services/reportsApi';
import './Reports.css';

interface AssetUtilizationPageProps {
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

export const AssetUtilizationPage: React.FC<AssetUtilizationPageProps> = ({
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
          : 'Unable to load the asset utilization report. Please retry.');
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
    showToast('Exporting Asset Utilization Ledger (.CSV)...');
  };

  const handleResetFilters = () => {
    setDateRangeFilter('');
    setLocationFilter('');
    setCategoryFilter('');
    setCurrentPage(1);
    showToast('Utilization filters reset to default.');
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

  const utilization = report?.asset_utilization;
  const statusCounts = utilization?.status_counts ?? {};

  // Summary Metrics:
  // - Total Assets
  // - Assets in Use
  // - Available Assets
  // - Assets in Maintenance
  const summaryMetrics = useMemo(() => {
    const total = utilization?.total_assets ?? 0;
    const inUse = statusCounts['In Use'] ?? 0;
    const available = statusCounts.Available ?? 0;
    const inMaintenance = statusCounts['In Maintenance'] ?? 0;

    return {
      total,
      inUse,
      available,
      inMaintenance,
    };
  }, [statusCounts, utilization?.total_assets]);

  // Chart 1: Asset Utilization by Category
  const categoryChartData = useMemo(() => {
    const total = utilization?.total_assets ?? 0;
    return Object.entries(utilization?.by_category ?? {}).map(([category, count]) => {
      const amount = Number(count);
      return {
        category,
        total: amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      };
    });
  }, [utilization]);

  // Chart 2: Asset Utilization by Location
  const locationChartData = useMemo(() => {
    const total = utilization?.total_assets ?? 0;
    return Object.entries(utilization?.by_location ?? {}).map(([location, count]) => {
      const amount = Number(count);
      return {
        location,
        total: amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      };
    });
  }, [utilization]);

  // Breakdown Table (Category x Location Aggregation)
  const breakdownRows = useMemo(() => {
    return Object.entries(utilization?.by_category ?? {}).map(([category, count]) => ({
      category,
      location: 'All locations',
      total: Number(count),
    }));
  }, [utilization]);

  const totalPages = Math.max(1, Math.ceil(breakdownRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return breakdownRows.slice(start, start + pageSize);
  }, [breakdownRows, currentPage]);

  return (
    <DashboardLayout
      currentNav="Reports"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Asset utilization data verified.')
      }
      onHelpClick={() => showToast('AssetMX Asset Utilization Documentation.')}
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
            <h2 className="amx-reports-title">Asset Utilization</h2>
            <p className="amx-reports-subtitle">
              Review organizational asset usage across categories and locations.
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
          activeTab="utilization"
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
              {Object.keys(utilization?.by_location ?? {}).map((location) => (
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
              {Object.keys(utilization?.by_category ?? {}).map((category) => (
                <option key={category} value={category}>{category}</option>
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

        {loading && <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>Loading asset utilization report data...</div>}
        {!loading && error && (
          <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--amx-dash-text)', fontWeight: 700, marginBottom: 8 }}>Unable to load the asset utilization report</div>
            <div style={{ color: 'var(--amx-dash-text-muted)', marginBottom: 16 }}>{error}</div>
            <button type="button" className="amx-btn-secondary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {/* 4 Summary Cards Grid */}
        <div className="amx-reports-summary-grid cols-4">
          {/* Total Assets */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Total Assets</span>
              <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">
                inventory_2
              </span>
            </div>
            <div className="amx-metric-value">{summaryMetrics.total}</div>
            <div className="amx-metric-subtext">Total catalogued units</div>
          </div>

          {/* Assets in Use */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Assets in Use</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#059669' }} aria-hidden="true">
                check_circle
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#059669' }}>
              {summaryMetrics.inUse}
            </div>
            <div className="amx-metric-subtext">Actively deployed to custodians</div>
          </div>

          {/* Available Assets */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Available Assets</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#1D4ED8' }} aria-hidden="true">
                storefront
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#1D4ED8' }}>
              {summaryMetrics.available}
            </div>
            <div className="amx-metric-subtext">Ready for allocation</div>
          </div>

          {/* Assets in Maintenance */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Assets in Maintenance</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#D97706' }} aria-hidden="true">
                build
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#D97706' }}>
              {summaryMetrics.inMaintenance}
            </div>
            <div className="amx-metric-subtext">Under repair or servicing</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="amx-charts-2col-grid">
          {/* Chart 1: Asset Utilization by Category */}
          <div className="amx-chart-card">
            <div className="amx-chart-header">
              <div>
                <h3 className="amx-chart-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00687a' }}>
                    category
                  </span>
                  Asset Utilization by Category
                </h3>
                <p className="amx-chart-subtitle">Factual usage distribution by equipment class</p>
              </div>
            </div>
            <div className="amx-bar-list">
              {categoryChartData.map((item) => (
                <div key={item.category} className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span>{item.category}</span>
                    <span className="amx-bar-count">
                      {item.total} assets ({item.percentage}% of total)
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

          {/* Chart 2: Asset Utilization by Location */}
          <div className="amx-chart-card">
            <div className="amx-chart-header">
              <div>
                <h3 className="amx-chart-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#131b2e' }}>
                    location_on
                  </span>
                  Asset Utilization by Location
                </h3>
                <p className="amx-chart-subtitle">Factual usage distribution across facility areas</p>
              </div>
            </div>
            <div className="amx-bar-list">
              {locationChartData.map((item) => (
                <div key={item.location} className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span>{item.location}</span>
                    <span className="amx-bar-count">
                      {item.total} assets ({item.percentage}% of total)
                    </span>
                  </div>
                  <div className="amx-bar-bg">
                    <div
                      className="amx-bar-fill"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: '#131b2e',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="amx-reports-main-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="amx-reports-table">
              <thead>
                <tr>
                  <th>Asset Category</th>
                  <th>Location</th>
                  <th>Total Assets</th>
                  <th>Assets in Use</th>
                  <th>Available</th>
                  <th>In Maintenance</th>
                  <th>Utilization</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="amx-table-empty">
                      No asset utilization records match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <tr key={`${row.category}-${row.location}-${idx}`}>
                      <td style={{ fontWeight: 600 }}>{row.category}</td>
                      <td>{row.location}</td>
                      <td>{row.total}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>—</td>
                      <td style={{ color: '#1D4ED8' }}>—</td>
                      <td style={{ color: '#D97706' }}>—</td>
                      <td style={{ fontWeight: 600 }}>{utilization?.utilization_rate ?? 0}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="amx-reports-pagination-bar">
            <span>
              Showing {breakdownRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, breakdownRows.length)} of {breakdownRows.length} breakdowns
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

export default AssetUtilizationPage;
