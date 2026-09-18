import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import {
  getStoredReportAssets,
  REPORT_FILTER_OPTIONS,
  type AssetUtilizationItem,
} from '../data/reportsData';
import './Reports.css';

interface DisposalReportPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const DisposalReportPage: React.FC<DisposalReportPageProps> = ({
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

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (locationFilter && asset.location !== locationFilter) return false;
      if (categoryFilter && asset.category !== categoryFilter) return false;
      return true;
    });
  }, [assets, locationFilter, categoryFilter]);

  // Summary Metrics:
  // - Assets Approaching Disposal
  // - Assets Approaching Replacement
  // - Estimated Lifecycle End
  const summaryMetrics = useMemo(() => {
    const approachingDisposal = filteredAssets.filter((a) => a.lifecycleAction === 'Disposal').length;
    const approachingReplacement = filteredAssets.filter((a) => a.lifecycleAction === 'Replacement').length;
    const total = approachingDisposal + approachingReplacement;

    return {
      approachingDisposal,
      approachingReplacement,
      totalLifecycleEnd: total,
    };
  }, [filteredAssets]);

  // Visualization: Lifecycle Milestone Schedule by Quarter
  const quartersSchedule = useMemo(() => {
    const quarters: ('Q3 2026' | 'Q4 2026' | 'Q1 2027' | 'Q2 2027' | 'Q3 2027' | 'Q4 2027')[] = [
      'Q3 2026',
      'Q4 2026',
      'Q1 2027',
      'Q2 2027',
      'Q3 2027',
      'Q4 2027',
    ];

    return quarters.map((q) => {
      const qAssets = filteredAssets.filter((a) => a.quarterApproaching === q);
      const disposal = qAssets.filter((a) => a.lifecycleAction === 'Disposal').length;
      const replacement = qAssets.filter((a) => a.lifecycleAction === 'Replacement').length;

      return {
        quarter: q,
        disposal,
        replacement,
        total: disposal + replacement,
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
          {/* Assets Approaching Disposal */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Approaching Disposal</span>
              <span className="material-symbols-outlined amx-metric-icon error" aria-hidden="true">
                delete_forever
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#DC2626' }}>
              {summaryMetrics.approachingDisposal}
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
              {summaryMetrics.approachingReplacement}
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
              {summaryMetrics.totalLifecycleEnd}
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
                Lifecycle Milestone Schedule by Quarter
              </h3>
              <p className="amx-chart-subtitle">Quarterly schedule of disposal vs replacement requirements</p>
            </div>
          </div>

          <div className="amx-bar-list">
            {quartersSchedule.map((q) => {
              const maxUnits = 6;
              const repPct = Math.round((q.replacement / maxUnits) * 100);
              const dispPct = Math.round((q.disposal / maxUnits) * 100);

              return (
                <div key={q.quarter} className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span style={{ fontWeight: 600 }}>{q.quarter}</span>
                    <span className="amx-bar-count">
                      Replacement: {q.replacement} | Disposal: {q.disposal} (Total: {q.total})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                    <div className="amx-bar-bg" style={{ flex: 1 }}>
                      <div
                        className="amx-bar-fill"
                        style={{
                          width: `${repPct}%`,
                          backgroundColor: '#7E22CE',
                        }}
                        title={`Replacement: ${q.replacement}`}
                      />
                    </div>
                    <div className="amx-bar-bg" style={{ flex: 1 }}>
                      <div
                        className="amx-bar-fill"
                        style={{
                          width: `${dispPct}%`,
                          backgroundColor: '#DC2626',
                        }}
                        title={`Disposal: ${q.disposal}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="amx-chart-legends">
            <div className="amx-legend-item">
              <span className="amx-legend-dot" style={{ backgroundColor: '#7E22CE' }} />
              <span>Replacement Action</span>
            </div>
            <div className="amx-legend-item">
              <span className="amx-legend-dot" style={{ backgroundColor: '#DC2626' }} />
              <span>Disposal Action</span>
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
                  paginatedAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{asset.id}</td>
                      <td style={{ fontWeight: 600 }}>{asset.name}</td>
                      <td>{asset.category}</td>
                      <td>{asset.location}</td>
                      <td>
                        <span
                          className={`amx-report-badge ${
                            asset.status === 'In Use'
                              ? 'in-use'
                              : asset.status === 'Available'
                              ? 'available'
                              : 'maintenance'
                          }`}
                        >
                          {asset.status}
                        </span>
                      </td>
                      <td>{asset.acquisitionDate}</td>
                      <td style={{ fontFamily: 'JetBrains Mono' }}>{asset.estimatedEndOfLife}</td>
                      <td>
                        <span
                          className={`amx-report-badge ${
                            asset.lifecycleAction === 'Replacement' ? 'replacement' : 'disposal'
                          }`}
                        >
                          {asset.lifecycleAction}
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

export default DisposalReportPage;
