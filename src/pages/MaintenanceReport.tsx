import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import { getAdminReports, ReportsApiError, type AdminReportsApiResponse } from '../services/reportsApi';
import './Reports.css';

interface MaintenanceReportPageProps {
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

export const MaintenanceReportPage: React.FC<MaintenanceReportPageProps> = ({
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
          : 'Unable to load the maintenance report. Please retry.');
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
    showToast('Exporting Maintenance Cost vs Asset Value Ledger (.CSV)...');
  };

  const handleResetFilters = () => {
    setDateRangeFilter('');
    setLocationFilter('');
    setCategoryFilter('');
    setCurrentPage(1);
    showToast('Maintenance report filters reset to default.');
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

  const maintenance = report?.maintenance_vs_asset_value;
  const maintenanceByAsset = maintenance?.maintenance_by_asset ?? {};

  // Summary Metrics:
  // - Maintenance Cost
  // - Asset Value
  // - Assets Maintained
  const summaryMetrics = useMemo(() => {
    const totalMaintCost = maintenance?.total_maintenance_cost ?? 0;
    const totalAssetVal = maintenance?.total_asset_value ?? 0;
    const assetsMaintained = Object.keys(maintenanceByAsset).length;

    return {
      maintenanceCost: `₹${totalMaintCost.toLocaleString('en-IN')}`,
      assetValue: `₹${totalAssetVal.toLocaleString('en-IN')}`,
      assetsMaintained,
      ratio: maintenance?.maintenance_cost_ratio ?? 0,
    };
  }, [maintenance, maintenanceByAsset]);

  // Visualization: Value to Maintenance Breakdown (Category breakdown comparing Asset Value vs Maintenance Cost)
  const categoryBreakdown = useMemo(() => {
    const assetValues = maintenance?.asset_value_by_category ?? {};
    const maintenanceCosts = maintenance?.maintenance_cost_by_category ?? {};
    return Array.from(new Set([...Object.keys(assetValues), ...Object.keys(maintenanceCosts)])).map((category) => {
      return {
        category,
        assetVal: assetValues[category] ?? 0,
        maintCost: maintenanceCosts[category] ?? 0,
      };
    });
  }, [maintenance]);

  const maintenanceRows = useMemo(() => Object.entries(maintenanceByAsset), [maintenanceByAsset]);
  const totalPages = Math.max(1, Math.ceil(maintenanceRows.length / pageSize));
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return maintenanceRows.slice(start, start + pageSize);
  }, [maintenanceRows, currentPage]);

  return (
    <DashboardLayout
      currentNav="Reports"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Maintenance cost records synchronized.')
      }
      onHelpClick={() => showToast('AssetMX Maintenance Cost Manual.')}
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
            <h2 className="amx-reports-title">Maintenance Cost vs Asset Value</h2>
            <p className="amx-reports-subtitle">
              Compare maintenance expenditure against organizational asset value.
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
          activeTab="maintenance"
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
              <option value="HQ - Floor 4">HQ - Floor 4</option>
              <option value="HQ - Floor 2">HQ - Floor 2</option>
              <option value="Lab - Building A">Lab - Building A</option>
              <option value="Warehouse">Warehouse</option>
              <option value="Server Room">Server Room</option>
            </select>

            {/* Category */}
            <select
              className="amx-reports-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by Category"
            >
              <option value="">All Categories</option>
              {Object.keys(maintenance?.asset_value_by_category ?? {}).map((category) => (
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

        {loading && <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>Loading maintenance report data...</div>}
        {!loading && error && (
          <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--amx-dash-text)', fontWeight: 700, marginBottom: 8 }}>Unable to load the maintenance report</div>
            <div style={{ color: 'var(--amx-dash-text-muted)', marginBottom: 16 }}>{error}</div>
            <button type="button" className="amx-btn-secondary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {/* 3 Summary Cards Grid */}
        <div className="amx-reports-summary-grid cols-3">
          {/* Maintenance Cost */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Maintenance Cost</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#b45309' }} aria-hidden="true">
                payments
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#b45309' }}>
              {summaryMetrics.maintenanceCost}
            </div>
            <div className="amx-metric-subtext">Cumulative service spending</div>
          </div>

          {/* Asset Value */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Asset Value</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#00687a' }} aria-hidden="true">
                account_balance
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#00687a' }}>
              {summaryMetrics.assetValue}
            </div>
            <div className="amx-metric-subtext">Total valuation of catalogued assets</div>
          </div>

          {/* Assets Maintained */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Assets Maintained</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#059669' }} aria-hidden="true">
                build
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#059669' }}>
              {summaryMetrics.assetsMaintained}
            </div>
            <div className="amx-metric-subtext">Cost ratio: {summaryMetrics.ratio}%</div>
          </div>
        </div>

        {/* Visualization: Value to Maintenance Breakdown */}
        <div className="amx-chart-card">
          <div className="amx-chart-header">
            <div>
              <h3 className="amx-chart-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00687a' }}>
                  compare_arrows
                </span>
                Value to Maintenance Breakdown
              </h3>
              <p className="amx-chart-subtitle">Factual comparison of Asset Value vs Maintenance Cost across categories</p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="amx-reports-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Asset Value</th>
                  <th>Maintenance Cost</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((row) => (
                  <tr key={row.category}>
                    <td style={{ fontWeight: 600 }}>{row.category}</td>
                    <td className="amx-value-text">₹{row.assetVal.toLocaleString('en-IN')}</td>
                    <td className="amx-cost-text">₹{row.maintCost.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <th>Category</th>
                  <th>Asset Value</th>
                  <th>Maintenance Cost</th>
                  <th>Last Service</th>
                  <th>Maintenance Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="amx-table-empty">
                      No asset maintenance records match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedAssets.map(([assetId, maintenanceCost]) => (
                    <tr key={assetId}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{assetId}</td>
                      <td style={{ fontWeight: 600 }}>—</td>
                      <td>—</td>
                      <td className="amx-value-text">—</td>
                      <td className="amx-cost-text">₹{maintenanceCost.toLocaleString('en-IN')}</td>
                      <td>—</td>
                      <td>
                        <span className="amx-report-badge maintenance">Recorded maintenance</span>
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
              Showing {maintenanceRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, maintenanceRows.length)} of {maintenanceRows.length} assets
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

export default MaintenanceReportPage;
