import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import {
  getStoredReportMovements,
  REPORT_FILTER_OPTIONS,
  type ReassignmentMovementRecord,
} from '../data/reportsData';
import './Reports.css';

interface ReassignmentReportPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const ReassignmentReportPage: React.FC<ReassignmentReportPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [movements, setMovements] = useState<ReassignmentMovementRecord[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setMovements(getStoredReportMovements());
  }, []);

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

  // Filter movements
  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      if (
        locationFilter &&
        mov.previousLocation !== locationFilter &&
        mov.newLocation !== locationFilter
      ) {
        return false;
      }
      if (categoryFilter && mov.category !== categoryFilter) return false;
      return true;
    });
  }, [movements, locationFilter, categoryFilter]);

  // Summary Metrics:
  // - Total Reassignments
  // - Asset Movements
  // - Locations Involved
  const summaryMetrics = useMemo(() => {
    const totalReassignments = filteredMovements.length;
    const assetMovements = filteredMovements.filter(
      (m) => m.previousLocation !== m.newLocation
    ).length;

    const locSet = new Set<string>();
    filteredMovements.forEach((m) => {
      locSet.add(m.previousLocation);
      locSet.add(m.newLocation);
    });

    return {
      totalReassignments,
      assetMovements,
      locationsInvolved: locSet.size,
    };
  }, [filteredMovements]);

  // Chart: Reassignment & Movement Activity Over Time (Grouped by month or category)
  const activityByCategory = useMemo(() => {
    const categories: ('Hardware' | 'Furniture' | 'Lab Equipment' | 'IT Equipment')[] = [
      'Hardware',
      'Furniture',
      'Lab Equipment',
      'IT Equipment',
    ];

    const total = filteredMovements.length;

    return categories.map((cat) => {
      const count = filteredMovements.filter((m) => m.category === cat).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        category: cat,
        count,
        percentage: pct,
      };
    });
  }, [filteredMovements]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, currentPage]);

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
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="amx-table-empty">
                      No reassignment or movement records match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((mov) => (
                    <tr key={mov.id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{mov.assetId}</td>
                      <td style={{ fontWeight: 600 }}>{mov.assetName}</td>
                      <td>{mov.previousCustodian}</td>
                      <td style={{ color: '#00687a', fontWeight: 600 }}>{mov.newCustodian}</td>
                      <td>{mov.previousLocation}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{mov.newLocation}</td>
                      <td>{mov.movementDate}</td>
                      <td style={{ maxWidth: '280px', color: 'var(--amx-dash-text-muted)' }}>
                        {mov.reason}
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
              Showing {filteredMovements.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredMovements.length)} of {filteredMovements.length} transfers
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
