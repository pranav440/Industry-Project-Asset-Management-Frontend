import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ReportTabs } from '../components/ReportTabs';
import {
  getAdminReports,
  ReportsApiError,
  type AdminReportsApiResponse,
} from '../services/reportsApi';
import './Reports.css';

interface ReportsOverviewPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

const neutralValue = '—';

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return neutralValue;
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatInteger(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return neutralValue;
  return value.toLocaleString('en-IN');
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

  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { date_from: format(from), date_to: format(to) };
}

export const ReportsOverviewPage: React.FC<ReportsOverviewPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [report, setReport] = useState<AdminReportsApiResponse | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAdminReports({
        ...buildDateRange(dateRangeFilter),
        location: locationFilter || undefined,
        category: categoryFilter || undefined,
      });
      setReport(data);
    } catch (err) {
      const status = (err as ReportsApiError)?.status;
      if (status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (status === 403) {
        setError('This report is restricted to administrators.');
      } else if (status === 404) {
        setError('The reports endpoint was not found.');
      } else if (status && status >= 500) {
        setError('The reports service is temporarily unavailable. Please retry.');
      } else {
        setError('Unable to load the reports overview. Please check your connection and retry.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getAdminReports({
          ...buildDateRange(dateRangeFilter),
          location: locationFilter || undefined,
          category: categoryFilter || undefined,
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
        } else if (status && status >= 500) {
          setError('The reports service is temporarily unavailable. Please retry.');
        } else {
          setError('Unable to load the reports overview. Please check your connection and retry.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [dateRangeFilter, locationFilter, categoryFilter]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    showToast('Report export is not available yet.');
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

  const overview = report?.overview ?? {
    total_assets: 0,
    assets_in_use: 0,
    open_requests: 0,
    maintenance_cost: 0,
  };

  const utilization = report?.asset_utilization ?? {
    total_assets: 0,
    status_counts: {},
    by_category: {},
    by_location: {},
    utilization_rate: 0,
  };

  const requests = report?.requests ?? {
    total_requests: 0,
    status_counts: {},
    department_counts: {},
    request_type_counts: {},
    priority_counts: {},
    history: {},
  };

  const maintenance = report?.maintenance_vs_asset_value ?? {
    total_maintenance_cost: 0,
    total_asset_value: 0,
    maintenance_by_asset: {},
    maintenance_cost_ratio: 0,
    asset_value_by_category: {},
    maintenance_cost_by_category: {},
  };

  const lifecycle = report?.lifecycle ?? {
    status_distribution: {},
    disposed_assets: 0,
    forecast: null,
    age_summary: { average_asset_age_days: 0 },
  };

  const kpiMetrics = useMemo(() => ({
    totalAssets: overview.total_assets,
    assetsInUse: overview.assets_in_use,
    openRequests: overview.open_requests,
    totalMaintenanceCost: formatCurrency(overview.maintenance_cost),
  }), [overview]);

  const categoryUtilization = useMemo(() => {
    const entries = Object.entries(utilization.by_category ?? {});
    const totalAssets = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);

    return entries.map(([category, count]) => {
      const total = Number(count || 0);
      return {
        category,
        total,
        inUse: total,
        percentage: totalAssets > 0 ? Math.round((total / totalAssets) * 100) : 0,
      };
    });
  }, [utilization]);

  const requestFulfilment = useMemo(() => {
    const total = requests.total_requests;
    const fulfilled = requests.status_counts.Fulfilled ?? 0;
    const pending = requests.status_counts.Pending ?? 0;
    const backlog = requests.status_counts['In Review'] ?? 0;

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
  }, [requests]);

  const maintenanceVsValue = useMemo(() => {
    const categories = Object.entries(maintenance.asset_value_by_category ?? {});
    const totalAssetVal = categories.reduce((sum, [, value]) => sum + Number(value || 0), 0);

    return categories.map(([category, assetValue]) => {
      const assetVal = Number(assetValue || 0);
      const maintCost = Number(maintenance.maintenance_cost_by_category?.[category] || 0);
      const valPct = totalAssetVal > 0 ? Math.round((assetVal / totalAssetVal) * 100) : 0;

      return { category, assetVal, maintCost, valPct };
    });
  }, [maintenance]);

  const lifecycleForecast = useMemo(() => {
    const approachingDisposal = lifecycle.disposed_assets ?? 0;
    const total = approachingDisposal;
    const disposalPct = total > 0 ? 100 : 0;

    return {
      total,
      approachingDisposal,
      approachingReplacement: 0,
      disposalPct,
      replacementPct: 0,
    };
  }, [lifecycle]);

  const renderLoadingState = () => (
    <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--amx-dash-text-muted)' }}>
      Loading reports data…
    </div>
  );

  const renderErrorState = () => (
    <div className="amx-reports-main-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
      <div style={{ color: 'var(--amx-dash-text)', fontWeight: 700, marginBottom: 8 }}>Unable to load reports</div>
      <div style={{ color: 'var(--amx-dash-text-muted)', marginBottom: 16 }}>{error}</div>
      <button type="button" className="amx-btn-secondary" onClick={loadReport}>
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
      onNotificationsClick={() => showToast('1 Alert: System reports synchronized.')}
      onHelpClick={() => showToast('AssetMX Reports & Analytics User Manual.')}
      onProfileClick={() => showToast('Active User: Administrator (Role: Admin, Dept: IT).')}
    >
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
        <div className="amx-reports-header">
          <div className="amx-reports-title-area">
            <h2 className="amx-reports-title">Reports &amp; Analytics</h2>
            <p className="amx-reports-subtitle">
              Analyze asset utilization, requests, maintenance costs, and lifecycle trends.
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
          activeTab="overview"
          onSelectTab={(tab) => {
            if (tab === 'overview') onNavigate?.('reports');
            else onNavigate?.(`reports/${tab}`);
          }}
        />

        <div className="amx-reports-main-card">
          <div className="amx-reports-filters-bar">
            <select className="amx-reports-filter-select" value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value)} aria-label="Filter by Date Range">
              <option value="">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="180d">Last 6 Months</option>
              <option value="365d">Last 1 Year</option>
            </select>

            <select className="amx-reports-filter-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} aria-label="Filter by Location">
              <option value="">All Locations</option>
              <option value="HQ - Floor 4">HQ - Floor 4</option>
              <option value="HQ - Floor 2">HQ - Floor 2</option>
              <option value="Lab - Building A">Lab - Building A</option>
              <option value="Warehouse">Warehouse</option>
              <option value="Server Room">Server Room</option>
            </select>

            <select className="amx-reports-filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by Category">
              <option value="">All Categories</option>
              <option value="Hardware">Hardware</option>
              <option value="Furniture">Furniture</option>
              <option value="Lab Equipment">Lab Equipment</option>
              <option value="IT Equipment">IT Equipment</option>
            </select>

            <button type="button" className="amx-filter-reset-btn" onClick={handleResetFilters} aria-label="Reset all filters">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">restart_alt</span>
              <span>Reset</span>
            </button>
          </div>
        </div>

        {loading && !report ? renderLoadingState() : null}
        {!loading && error && !report ? renderErrorState() : null}

        {!loading && report ? (
          <>
            <div className="amx-reports-summary-grid cols-4">
              <div className="amx-card-panel amx-metric-card">
                <div className="amx-metric-card-top">
                  <span className="amx-metric-title">Total Assets</span>
                  <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">inventory_2</span>
                </div>
                <div className="amx-metric-value">{formatInteger(kpiMetrics.totalAssets)}</div>
                <div className="amx-metric-subtext">Catalogued physical assets</div>
              </div>

              <div className="amx-card-panel amx-metric-card">
                <div className="amx-metric-card-top">
                  <span className="amx-metric-title">Assets in Use</span>
                  <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#059669' }} aria-hidden="true">check_circle</span>
                </div>
                <div className="amx-metric-value" style={{ color: '#059669' }}>{formatInteger(kpiMetrics.assetsInUse)}</div>
                <div className="amx-metric-subtext">Currently active assets</div>
              </div>

              <div className="amx-card-panel amx-metric-card">
                <div className="amx-metric-card-top">
                  <span className="amx-metric-title">Open Requests</span>
                  <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#D97706' }} aria-hidden="true">pending_actions</span>
                </div>
                <div className="amx-metric-value" style={{ color: '#D97706' }}>{formatInteger(kpiMetrics.openRequests)}</div>
                <div className="amx-metric-subtext">Pending and under review</div>
              </div>

              <div className="amx-card-panel amx-metric-card">
                <div className="amx-metric-card-top">
                  <span className="amx-metric-title">Maintenance Cost</span>
                  <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#00687a' }} aria-hidden="true">payments</span>
                </div>
                <div className="amx-metric-value" style={{ color: '#00687a' }}>{kpiMetrics.totalMaintenanceCost}</div>
                <div className="amx-metric-subtext">Tracked maintenance expenditure</div>
              </div>
            </div>

            <div className="amx-charts-2col-grid">
              <div className="amx-chart-card">
                <div className="amx-chart-header">
                  <div>
                    <h3 className="amx-chart-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00687a' }}>pie_chart</span>
                      Asset Utilization
                    </h3>
                    <p className="amx-chart-subtitle">Distribution by category</p>
                  </div>
                </div>
                <div className="amx-bar-list">
                  {categoryUtilization.length === 0 ? (
                    <div className="amx-table-empty">No category utilization data is available from the backend.</div>
                  ) : (
                    categoryUtilization.map((item) => (
                      <div key={item.category} className="amx-bar-item">
                        <div className="amx-bar-meta">
                          <span>{item.category}</span>
                          <span className="amx-bar-count">{item.total} assets ({item.percentage}%)</span>
                        </div>
                        <div className="amx-bar-bg">
                          <div className="amx-bar-fill" style={{ width: `${item.percentage}%`, backgroundColor: '#00687a' }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="amx-chart-card">
                <div className="amx-chart-header">
                  <div>
                    <h3 className="amx-chart-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#D97706' }}>task_alt</span>
                      Request Fulfilment &amp; Backlog
                    </h3>
                    <p className="amx-chart-subtitle">Lifecycle distribution from backend request states</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="amx-stacked-bar-bg">
                    <div className="amx-stacked-segment" style={{ width: `${requestFulfilment.fulfilledPct}%`, backgroundColor: '#059669' }} title={`Fulfilled: ${requestFulfilment.fulfilled} (${requestFulfilment.fulfilledPct}%)`} />
                    <div className="amx-stacked-segment" style={{ width: `${requestFulfilment.pendingPct}%`, backgroundColor: '#D97706' }} title={`Pending: ${requestFulfilment.pending} (${requestFulfilment.pendingPct}%)`} />
                    <div className="amx-stacked-segment" style={{ width: `${requestFulfilment.backlogPct}%`, backgroundColor: '#DC2626' }} title={`In Review: ${requestFulfilment.backlog} (${requestFulfilment.backlogPct}%)`} />
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
                      <span>In Review: {requestFulfilment.backlog} ({requestFulfilment.backlogPct}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="amx-charts-2col-grid">
              <div className="amx-chart-card">
                <div className="amx-chart-header">
                  <div>
                    <h3 className="amx-chart-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#131b2e' }}>compare_arrows</span>
                      Maintenance Cost vs Asset Value
                    </h3>
                    <p className="amx-chart-subtitle">Category comparison from backend totals</p>
                  </div>
                </div>
                <div className="amx-bar-list">
                  {maintenanceVsValue.length === 0 ? (
                    <div className="amx-table-empty">No maintenance/category totals are available from the backend.</div>
                  ) : (
                    maintenanceVsValue.map((item) => (
                      <div key={item.category} className="amx-bar-item">
                        <div className="amx-bar-meta">
                          <span>{item.category}</span>
                          <span className="amx-bar-count">Val: {formatCurrency(item.assetVal)} | Maint: {formatCurrency(item.maintCost)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div className="amx-bar-bg" style={{ height: '7px' }}>
                            <div className="amx-bar-fill" style={{ width: `${item.valPct}%`, backgroundColor: '#131b2e' }} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
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

              <div className="amx-chart-card">
                <div className="amx-chart-header">
                  <div>
                    <h3 className="amx-chart-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#7E22CE' }}>event_repeat</span>
                      Lifecycle Forecast
                    </h3>
                    <p className="amx-chart-subtitle">Forecast data is unavailable in the backend</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="amx-bar-list">
                    <div className="amx-bar-item">
                      <div className="amx-bar-meta">
                        <span>Disposal status</span>
                        <span className="amx-bar-count">{lifecycleForecast.approachingDisposal} asset(s)</span>
                      </div>
                      <div className="amx-bar-bg">
                        <div className="amx-bar-fill" style={{ width: `${lifecycleForecast.disposalPct}%`, backgroundColor: '#DC2626' }} />
                      </div>
                    </div>
                    <div className="amx-bar-item">
                      <div className="amx-bar-meta">
                        <span>Replacement forecast</span>
                        <span className="amx-bar-count">N/A</span>
                      </div>
                      <div className="amx-bar-bg">
                        <div className="amx-bar-fill" style={{ width: '0%', backgroundColor: '#7E22CE' }} />
                      </div>
                    </div>
                  </div>
                  <div className="amx-chart-legends">
                    <div className="amx-legend-item">
                      <span className="amx-legend-dot" style={{ backgroundColor: '#DC2626' }} />
                      <span>Disposal status available</span>
                    </div>
                    <div className="amx-legend-item">
                      <span className="amx-legend-dot" style={{ backgroundColor: '#7E22CE' }} />
                      <span>Forecast unavailable</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default ReportsOverviewPage;
