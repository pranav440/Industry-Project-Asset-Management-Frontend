import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import {
  getStoredReportAssets,
  REPORT_FILTER_OPTIONS,
  type AssetUtilizationItem,
} from '../data/reportsData';
import './Reports.css';

interface MaintenanceReportPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const MaintenanceReportPage: React.FC<MaintenanceReportPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [assets, setAssets] = useState<AssetUtilizationItem[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setAssets(getStoredReportAssets());
  }, []);

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

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (locationFilter && asset.location !== locationFilter) return false;
      if (categoryFilter && asset.category !== categoryFilter) return false;
      return true;
    });
  }, [assets, locationFilter, categoryFilter]);

  // Summary Metrics:
  // - Maintenance Cost
  // - Asset Value
  // - Assets Maintained
  const summaryMetrics = useMemo(() => {
    const totalMaintCost = filteredAssets.reduce((sum, a) => sum + a.maintenanceCost, 0);
    const totalAssetVal = filteredAssets.reduce((sum, a) => sum + a.assetValue, 0);
    const assetsMaintained = filteredAssets.filter((a) => a.maintenanceCost > 0).length;

    return {
      maintenanceCost: `₹${totalMaintCost.toLocaleString('en-IN')}`,
      assetValue: `₹${totalAssetVal.toLocaleString('en-IN')}`,
      assetsMaintained,
    };
  }, [filteredAssets]);

  // Visualization: Value to Maintenance Breakdown (Category breakdown comparing Asset Value vs Maintenance Cost)
  const categoryBreakdown = useMemo(() => {
    const categories: ('Hardware' | 'Furniture' | 'Lab Equipment' | 'IT Equipment')[] = [
      'Hardware',
      'Furniture',
      'Lab Equipment',
      'IT Equipment',
    ];

    return categories.map((cat) => {
      const items = filteredAssets.filter((a) => a.category === cat);
      const assetVal = items.reduce((sum, a) => sum + a.assetValue, 0);
      const maintCost = items.reduce((sum, a) => sum + a.maintenanceCost, 0);

      return {
        category: cat,
        assetVal,
        maintCost,
      };
    });
  }, [filteredAssets]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, currentPage]);

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
              {REPORT_FILTER_OPTIONS.dateRanges.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Location */}
            <select
              className="amx-reports-filter-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Filter by Location"
            >
              {REPORT_FILTER_OPTIONS.locations.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Category */}
            <select
              className="amx-reports-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by Category"
            >
              {REPORT_FILTER_OPTIONS.categories.map((opt) => (
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
            <div className="amx-metric-subtext">Units with recorded maintenance</div>
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
                  paginatedAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{asset.id}</td>
                      <td style={{ fontWeight: 600 }}>{asset.name}</td>
                      <td>{asset.category}</td>
                      <td className="amx-value-text">₹{asset.assetValue.toLocaleString('en-IN')}</td>
                      <td className="amx-cost-text">₹{asset.maintenanceCost.toLocaleString('en-IN')}</td>
                      <td>{asset.lastServiceDate}</td>
                      <td>
                        <span
                          className={`amx-report-badge ${
                            asset.status === 'In Maintenance'
                              ? 'maintenance'
                              : asset.status === 'In Use'
                              ? 'in-use'
                              : 'available'
                          }`}
                        >
                          {asset.status === 'In Maintenance' ? 'Under Maintenance' : 'Operational'}
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
              Showing {filteredAssets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredAssets.length)} of {filteredAssets.length} assets
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
