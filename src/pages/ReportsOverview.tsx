import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import {
  getStoredReportAssets,
  getStoredReportRequests,
  REPORT_FILTER_OPTIONS,
  type AssetUtilizationItem,
  type ReportRequestRecord,
} from '../data/reportsData';
import './Reports.css';

interface ReportsOverviewPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const ReportsOverviewPage: React.FC<ReportsOverviewPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [assets, setAssets] = useState<AssetUtilizationItem[]>([]);
  const [requests, setRequests] = useState<ReportRequestRecord[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setAssets(getStoredReportAssets());
    setRequests(getStoredReportRequests());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    showToast('Exporting Reports & Analytics Overview (.CSV)...');
  };

  const handleResetFilters = () => {
    setDateRangeFilter('');
    setLocationFilter('');
    setCategoryFilter('');
    showToast('Filters reset to default.');
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

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (categoryFilter && req.category !== categoryFilter) return false;
      return true;
    });
  }, [requests, categoryFilter]);

  // 4 KPI Summary Cards Metrics:
  // 1. Total Assets
  // 2. Assets in Use
  // 3. Open Requests (Pending + Backlog)
  // 4. Maintenance Cost
  const kpiMetrics = useMemo(() => {
    const totalAssets = filteredAssets.length;
    const assetsInUse = filteredAssets.filter((a) => a.status === 'In Use').length;
    const openRequests = filteredRequests.filter((r) => r.status === 'Pending' || r.status === 'Backlog').length;
    const totalMaintenanceCost = filteredAssets.reduce((sum, a) => sum + a.maintenanceCost, 0);

    return {
      totalAssets,
      assetsInUse,
      openRequests,
      totalMaintenanceCost: `₹${totalMaintenanceCost.toLocaleString('en-IN')}`,
    };
  }, [filteredAssets, filteredRequests]);

  // Chart 1: Asset Utilization by Category
  const categoryUtilization = useMemo(() => {
    const categories: ('Hardware' | 'Furniture' | 'Lab Equipment' | 'IT Equipment')[] = [
      'Hardware',
      'Furniture',
      'Lab Equipment',
      'IT Equipment',
    ];

    return categories.map((cat) => {
      const items = filteredAssets.filter((a) => a.category === cat);
      const total = items.length;
      const inUse = items.filter((a) => a.status === 'In Use').length;
      const pct = total > 0 ? Math.round((inUse / total) * 100) : 0;
      return {
        category: cat,
        total,
        inUse,
        percentage: pct,
      };
    });
  }, [filteredAssets]);

  // Chart 2: Request Fulfilment & Backlog
  const requestFulfilment = useMemo(() => {
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

  // Chart 3: Maintenance Cost vs Asset Value by Category
  const maintenanceVsValue = useMemo(() => {
    const categories: ('Hardware' | 'Furniture' | 'Lab Equipment' | 'IT Equipment')[] = [
      'Hardware',
      'Furniture',
      'Lab Equipment',
      'IT Equipment',
    ];

    const totalAssetVal = filteredAssets.reduce((sum, a) => sum + a.assetValue, 0);

    return categories.map((cat) => {
      const items = filteredAssets.filter((a) => a.category === cat);
      const assetVal = items.reduce((sum, a) => sum + a.assetValue, 0);
      const maintCost = items.reduce((sum, a) => sum + a.maintenanceCost, 0);
      const valPct = totalAssetVal > 0 ? Math.round((assetVal / totalAssetVal) * 100) : 0;

      return {
        category: cat,
        assetVal,
        maintCost,
        valPct,
      };
    });
  }, [filteredAssets]);

  // Chart 4: Lifecycle Forecast
  const lifecycleForecast = useMemo(() => {
    const approachingDisposal = filteredAssets.filter((a) => a.lifecycleAction === 'Disposal').length;
    const approachingReplacement = filteredAssets.filter((a) => a.lifecycleAction === 'Replacement').length;
    const total = approachingDisposal + approachingReplacement;

    const disposalPct = total > 0 ? Math.round((approachingDisposal / total) * 100) : 0;
    const replacementPct = total > 0 ? Math.round((approachingReplacement / total) * 100) : 0;

    return {
      total,
      approachingDisposal,
      approachingReplacement,
      disposalPct,
      replacementPct,
    };
  }, [filteredAssets]);

  return (
    <DashboardLayout
      currentNav="Reports"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: System reports synchronized.')
      }
      onHelpClick={() => showToast('AssetMX Reports & Analytics User Manual.')}
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
            <h2 className="amx-reports-title">Reports &amp; Analytics</h2>
            <p className="amx-reports-subtitle">
              Analyze asset utilization, requests, maintenance costs, and lifecycle trends.
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
          activeTab="overview"
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

        {/* 4 KPI Summary Cards Grid */}
        <div className="amx-reports-summary-grid cols-4">
          {/* Total Assets */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Total Assets</span>
              <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">
                inventory_2
              </span>
            </div>
            <div className="amx-metric-value">{kpiMetrics.totalAssets}</div>
            <div className="amx-metric-subtext">Catalogued physical &amp; digital assets</div>
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
              {kpiMetrics.assetsInUse}
            </div>
            <div className="amx-metric-subtext">Actively deployed to custodians</div>
          </div>

          {/* Open Requests */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Open Requests</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#D97706' }} aria-hidden="true">
                pending_actions
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#D97706' }}>
              {kpiMetrics.openRequests}
            </div>
            <div className="amx-metric-subtext">Pending fulfilment and backlog</div>
          </div>

          {/* Maintenance Cost */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Maintenance Cost</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#00687a' }} aria-hidden="true">
                payments
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#00687a' }}>
              {kpiMetrics.totalMaintenanceCost}
            </div>
            <div className="amx-metric-subtext">Cumulative service expenditure</div>
          </div>
        </div>

        {/* Charts Grid: Row 1 */}
        <div className="amx-charts-2col-grid">
          {/* Chart 1: Asset Utilization */}
          <div className="amx-chart-card">
            <div className="amx-chart-header">
              <div>
                <h3 className="amx-chart-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00687a' }}>
                    pie_chart
                  </span>
                  Asset Utilization
                </h3>
                <p className="amx-chart-subtitle">Factual utilization percentage by category</p>
              </div>
            </div>
            <div className="amx-bar-list">
              {categoryUtilization.map((item) => (
                <div key={item.category} className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span>{item.category}</span>
                    <span className="amx-bar-count">
                      {item.inUse} of {item.total} in use ({item.percentage}%)
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

          {/* Chart 2: Request Fulfilment & Backlog */}
          <div className="amx-chart-card">
            <div className="amx-chart-header">
              <div>
                <h3 className="amx-chart-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#D97706' }}>
                    task_alt
                  </span>
                  Request Fulfilment &amp; Backlog
                </h3>
                <p className="amx-chart-subtitle">Volume breakdown across request lifecycle states</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="amx-stacked-bar-bg">
                <div
                  className="amx-stacked-segment"
                  style={{ width: `${requestFulfilment.fulfilledPct}%`, backgroundColor: '#059669' }}
                  title={`Fulfilled: ${requestFulfilment.fulfilled} (${requestFulfilment.fulfilledPct}%)`}
                />
                <div
                  className="amx-stacked-segment"
                  style={{ width: `${requestFulfilment.pendingPct}%`, backgroundColor: '#D97706' }}
                  title={`Pending: ${requestFulfilment.pending} (${requestFulfilment.pendingPct}%)`}
                />
                <div
                  className="amx-stacked-segment"
                  style={{ width: `${requestFulfilment.backlogPct}%`, backgroundColor: '#DC2626' }}
                  title={`Backlog: ${requestFulfilment.backlog} (${requestFulfilment.backlogPct}%)`}
                />
              </div>

              <div className="amx-chart-legends">
                <div className="amx-legend-item">
                  <span className="amx-legend-dot" style={{ backgroundColor: '#059669' }} />
                  <span>Fulfilled: {requestFulfilment.fulfilled} ({requestFulfilment.fulfilledPct}%)</span>
                </div>
                <div className="amx-legend-item">
                  <span className="amx-legend-dot" style={{ backgroundColor: '#D97706' }} />
                  <span>Pending: {requestFulfilment.pending} ({requestFulfilment.pendingPct}%)</span>
                </div>
                <div className="amx-legend-item">
                  <span className="amx-legend-dot" style={{ backgroundColor: '#DC2626' }} />
                  <span>Backlog: {requestFulfilment.backlog} ({requestFulfilment.backlogPct}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid: Row 2 */}
        <div className="amx-charts-2col-grid">
          {/* Chart 3: Maintenance Cost vs Asset Value */}
          <div className="amx-chart-card">
            <div className="amx-chart-header">
              <div>
                <h3 className="amx-chart-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#131b2e' }}>
                    compare_arrows
                  </span>
                  Maintenance Cost vs Asset Value
                </h3>
                <p className="amx-chart-subtitle">Factual valuation and expenditure by category</p>
              </div>
            </div>
            <div className="amx-bar-list">
              {maintenanceVsValue.map((item) => (
                <div key={item.category} className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span>{item.category}</span>
                    <span className="amx-bar-count">
                      Val: ₹{item.assetVal.toLocaleString('en-IN')} | Maint: ₹{item.maintCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div className="amx-bar-bg" style={{ height: '7px' }}>
                      <div
                        className="amx-bar-fill"
                        style={{
                          width: `${item.valPct}%`,
                          backgroundColor: '#131b2e',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="amx-chart-legends">
              <div className="amx-legend-item">
                <span className="amx-legend-dot" style={{ backgroundColor: '#131b2e' }} />
                <span>Asset Value Share</span>
              </div>
              <div className="amx-legend-item">
                <span className="amx-legend-dot" style={{ backgroundColor: '#b45309' }} />
                <span>Maintenance Cost Tracked</span>
              </div>
            </div>
          </div>

          {/* Chart 4: Lifecycle Forecast */}
          <div className="amx-chart-card">
            <div className="amx-chart-header">
              <div>
                <h3 className="amx-chart-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#7E22CE' }}>
                    event_repeat
                  </span>
                  Lifecycle Forecast
                </h3>
                <p className="amx-chart-subtitle">Assets approaching end of lifecycle milestones</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="amx-bar-list">
                <div className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span>Approaching Replacement</span>
                    <span className="amx-bar-count">
                      {lifecycleForecast.approachingReplacement} assets ({lifecycleForecast.replacementPct}%)
                    </span>
                  </div>
                  <div className="amx-bar-bg">
                    <div
                      className="amx-bar-fill"
                      style={{
                        width: `${lifecycleForecast.replacementPct}%`,
                        backgroundColor: '#7E22CE',
                      }}
                    />
                  </div>
                </div>

                <div className="amx-bar-item">
                  <div className="amx-bar-meta">
                    <span>Approaching Disposal</span>
                    <span className="amx-bar-count">
                      {lifecycleForecast.approachingDisposal} assets ({lifecycleForecast.disposalPct}%)
                    </span>
                  </div>
                  <div className="amx-bar-bg">
                    <div
                      className="amx-bar-fill"
                      style={{
                        width: `${lifecycleForecast.disposalPct}%`,
                        backgroundColor: '#DC2626',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="amx-chart-legends">
                <div className="amx-legend-item">
                  <span className="amx-legend-dot" style={{ backgroundColor: '#7E22CE' }} />
                  <span>Replacement Schedule</span>
                </div>
                <div className="amx-legend-item">
                  <span className="amx-legend-dot" style={{ backgroundColor: '#DC2626' }} />
                  <span>Disposal Schedule</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsOverviewPage;
