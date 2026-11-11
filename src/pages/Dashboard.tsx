import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { MetricCard } from '../components/MetricCard';
import { RequestsTable } from '../components/RequestsTable';
import { AssetInventoryCard } from '../components/AssetInventoryCard';
import { ExpiryAlerts } from '../components/ExpiryAlerts';
import { RecentPOs } from '../components/RecentPOs';
import { ReportsAnalyticsCard } from '../components/ReportsAnalyticsCard';
import { StockLevels } from '../components/StockLevels';
import { ConsumptionChart } from '../components/ConsumptionChart';
import type { MetricCardData, RequestItem, AssetInventoryData, ExpiryAlertItem, StockLevelItem } from '../data/dashboardData';
import { DashboardApiError, getAdminDashboard, type DashboardApiResponse } from '../services/dashboardApi';
import { getUser } from '../auth/session';
import './Dashboard.css';

interface DashboardPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

const neutralValue = '—';

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return neutralValue;
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return neutralValue;
  return dateValue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function displayStatus(status: string): 'Approved' | 'Pending' | 'Cancelled' {
  if (status === 'Fulfilled') return 'Approved';
  if (status === 'Rejected') return 'Cancelled';
  return 'Pending';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAdminDashboard();
      setDashboard(data);
    } catch (err) {
      const status = (err as DashboardApiError)?.status;
      if (status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (status === 403) {
        setError('This dashboard is restricted to administrators.');
      } else if (status && status >= 500) {
        setError('The dashboard service is temporarily unavailable. Please retry.');
      } else {
        setError('Unable to load dashboard data. Please check your connection and retry.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    if (!dashboard) {
      showToast('No dashboard data available to export.');
      return;
    }

    const lines: string[] = [];
    lines.push('AssetMX Admin Dashboard Report');
    lines.push(`Generated,${new Date().toISOString()}`);
    lines.push('');
    lines.push('SUMMARY KEY PERFORMANCE INDICATORS');
    lines.push('Metric,Value,Status');
    lines.push(`Open Requests,${dashboard.summary.open_requests},Live`);
    lines.push(`Pending Approvals,${dashboard.summary.pending_approvals},Live`);
    lines.push(`Low Stock Alerts,${dashboard.summary.low_stock_alerts},Live`);
    lines.push(`Monthly Spend,${dashboard.summary.monthly_spend ?? 'Not Configured'},Unconfigured`);
    lines.push(`Budget Utilized,${dashboard.summary.budget_utilized ?? 'Not Configured'},Unconfigured`);
    lines.push('');
    lines.push('ASSET INVENTORY');
    lines.push('Status,Count');
    lines.push(`Total Registered Units,${dashboard.asset_inventory.total_assets}`);
    Object.entries(dashboard.asset_inventory.by_status || {}).forEach(([st, cnt]) => {
      lines.push(`"${st}",${cnt}`);
    });
    lines.push('');
    lines.push('STOCK LEVELS BY CATEGORY');
    lines.push('Category,Available Stock,Threshold,Status');
    (dashboard.stock_levels || []).forEach((stock) => {
      lines.push(`"${stock.category}",${stock.available_stock},${stock.threshold},"${stock.status}"`);
    });
    lines.push('');
    lines.push('EXPIRY ALERTS');
    lines.push('Consumable ID,Name,Expiry Date,Severity,Days Remaining');
    (dashboard.expiry_alerts || []).forEach((alert) => {
      lines.push(`"${alert.item_id}","${alert.name}","${alert.expiry_date}","${alert.severity}",${alert.days_remaining}`);
    });
    lines.push('');
    lines.push('MY RECENT REQUESTS');
    lines.push('Request ID,Requested Item,Status,Request Date,Approval Date,Fulfillment Date');
    (dashboard.my_requests || []).forEach((req) => {
      lines.push(`"${req.request_id}","${req.requested_item}","${req.status}","${req.request_date}","${req.approval_date || ''}","${req.fulfillment_date || ''}"`);
    });

    try {
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `assetmx-admin-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Admin dashboard report exported to CSV.');
    } catch {
      showToast('Failed to export dashboard report.');
    }
  };

  const handleNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      onNavigate?.('dashboard');
    } else if (subRoute === 'signout' || subRoute === 'login' || subRoute === 'sign-out') {
      onSignOut?.();
    } else {
      onNavigate?.(subRoute);
    }
  };

  const requestsForTable = useMemo<RequestItem[]>(() => {
    const source = dashboard?.my_requests ?? [];
    return source.map((request) => ({
      id: request.request_id,
      itemName: request.requested_item,
      status: displayStatus(request.status),
      approvalDate: formatDisplayDate(request.approval_date),
      fulfilmentDate: formatDisplayDate(request.fulfillment_date),
      filterType: request.status === 'Fulfilled' || request.status === 'Rejected' ? 'closed' : 'open',
    }));
  }, [dashboard]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requestsForTable;
    const query = searchQuery.toLowerCase();
    return requestsForTable.filter(
      (request) =>
        request.id.toLowerCase().includes(query) ||
        request.itemName.toLowerCase().includes(query) ||
        request.status.toLowerCase().includes(query),
    );
  }, [requestsForTable, searchQuery]);

  const assetInventoryData: AssetInventoryData = useMemo(() => ({
    location: 'All Locations',
    custodian: 'All Custodians',
    category: 'All Categories',
    totalAssets: dashboard?.asset_inventory?.total_assets,
    byStatus: dashboard?.asset_inventory?.by_status,
  }), [dashboard]);

  const metricCards: MetricCardData[] = useMemo(() => {
    const summary = dashboard?.summary;
    return [
      {
        id: 'open-requests',
        title: 'Open Requests',
        value: summary ? String(summary.open_requests) : '—',
        icon: 'pending_actions',
        trend: { direction: 'down', text: 'Live data' },
        statusType: 'default',
      },
      {
        id: 'pending-approvals',
        title: 'Pending Approvals',
        value: summary ? String(summary.pending_approvals) : '—',
        icon: 'gavel',
        subtext: summary && summary.pending_approvals > 0 ? 'Requires action' : 'No pending reviews',
        statusType: summary && summary.pending_approvals > 0 ? 'error' : 'default',
      },
      {
        id: 'low-stock-alerts',
        title: 'Low Stock Alerts',
        value: summary ? String(summary.low_stock_alerts) : '—',
        icon: 'warning',
        subtext: summary && summary.low_stock_alerts > 0 ? 'Items critical' : 'Stock adequate',
        statusType: summary && summary.low_stock_alerts > 0 ? 'warning' : 'default',
      },
      {
        id: 'monthly-spend',
        title: 'Monthly Spend',
        value: summary?.monthly_spend != null ? `₹${summary.monthly_spend}` : 'Not Configured',
        icon: 'payments',
        subtext: summary?.monthly_spend != null ? 'Invoices recorded' : 'Procurement spend unconfigured',
        statusType: 'default',
      },
      {
        id: 'budget-utilized',
        title: 'Budget Utilized',
        value: summary?.budget_utilized != null ? `${summary.budget_utilized}%` : 'Not Configured',
        icon: 'pie_chart',
        subtext: summary?.budget_utilized != null ? 'Budget allocation' : 'Budget tracking unconfigured',
        progress: summary?.budget_utilized != null ? Math.min(100, Math.max(0, summary.budget_utilized)) : undefined,
        statusType: summary?.budget_utilized != null ? 'progress' : 'default',
      },
    ];
  }, [dashboard]);

  const expiryAlerts: ExpiryAlertItem[] = useMemo(() => {
    return (dashboard?.expiry_alerts ?? []).map((alert) => ({
      id: Number(alert.item_id.replace(/\D/g, '') || 0),
      title: alert.name,
      expiryText: `Exp: ${alert.expiry_date}`,
      isUrgent: alert.severity === 'urgent',
    }));
  }, [dashboard]);

  const stockLevels: StockLevelItem[] = useMemo(() => {
    return (dashboard?.stock_levels ?? []).map((stock, index) => {
      const total = stock.threshold > 0 ? stock.threshold : Math.max(1, stock.available_stock);
      const percentage = total > 0 ? (stock.available_stock / total) * 100 : 0;
      return {
        id: `${stock.category}-${index}`,
        category: stock.category,
        current: stock.available_stock,
        total,
        percentage: Math.min(100, Math.max(0, percentage)),
        isCritical: stock.status !== 'In Stock',
        colorHex: ['#acedff', '#4cd7f6', '#0075a6', '#004e5c', '#ba1a1a'][index % 5],
      };
    });
  }, [dashboard]);

  const recentPOs = useMemo(() => dashboard?.recent_pos ?? null, [dashboard]);
  const consumptionDepartments = useMemo(() => {
    const raw = dashboard?.department_consumption as { departments?: any[] } | null;
    return raw?.departments ?? null;
  }, [dashboard]);

  const currentUser = getUser();
  const totalAlertCount = (dashboard?.expiry_alerts?.length ?? 0) + (dashboard?.summary?.low_stock_alerts ?? 0);

  if (loading && !dashboard) {
    return (
      <DashboardLayout
        currentNav="Dashboard"
        onNavigate={handleNav}
        onSignOut={onSignOut}
        onSearch={(value) => setSearchQuery(value)}
        onAddAsset={() => onNavigate?.('assets/new')}
        onNotificationsClick={() => showToast('Dashboard data is loading.')}
        onHelpClick={() => showToast('AssetMX Enterprise Help Center & User Manual.')}
        onProfileClick={() => showToast('Loading user dashboard...')}
      >
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            color: 'var(--amx-dash-text-muted)',
            fontStyle: 'italic',
          }}
        >
          Loading dashboard data...
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        currentNav="Dashboard"
        onNavigate={handleNav}
        onSignOut={onSignOut}
        onSearch={(value) => setSearchQuery(value)}
        onAddAsset={() => onNavigate?.('assets/new')}
        onNotificationsClick={() => showToast('Dashboard unavailable.')}
        onHelpClick={() => showToast('AssetMX Enterprise Help Center & User Manual.')}
        onProfileClick={() => showToast('Dashboard access check failed.')}
      >
        <div
          style={{
            padding: '28px 20px',
            color: 'var(--amx-dash-text-primary)',
          }}
        >
          <div
            className="amx-card-panel"
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: '22px 20px',
              border: '1px solid rgba(186, 26, 26, 0.4)',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Dashboard unavailable</div>
            <div style={{ marginBottom: 16, color: 'var(--amx-dash-text-muted)' }}>{error}</div>
            <button
              type="button"
              className="amx-export-btn"
              onClick={loadDashboard}
              aria-label="Retry loading dashboard"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      currentNav="Dashboard"
      userName={currentUser?.full_name || 'Administrator'}
      userRoleSubtitle={currentUser?.role ? currentUser.role.toUpperCase() : 'ADMIN'}
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(value) => setSearchQuery(value)}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() => {
        if (totalAlertCount > 0) {
          showToast(`${totalAlertCount} active alert${totalAlertCount === 1 ? '' : 's'}: ${dashboard?.expiry_alerts?.length ?? 0} expiry, ${dashboard?.summary?.low_stock_alerts ?? 0} low stock.`);
        } else {
          showToast('No active system alerts at this time.');
        }
      }}
      onHelpClick={() => showToast('AssetMX Enterprise Help Center & User Manual.')}
      onProfileClick={() => {
        showToast(`Active User: ${currentUser?.full_name || 'Administrator'} (Role: ${currentUser?.role || 'Admin'}).`);
      }}
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

      <div className="amx-overview-header">
        <div>
          <h2 className="amx-overview-title">Dashboard Overview</h2>
          <p className="amx-overview-subtitle">Real-time metrics and system alerts.</p>
        </div>
        <div>
          <button
            type="button"
            className="amx-export-btn"
            onClick={handleExport}
            aria-label="Export metrics report"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px' }}
              aria-hidden="true"
            >
              download
            </span>
            <span>Export</span>
          </button>
        </div>
      </div>

      <section className="amx-kpi-grid" aria-label="Key Performance Indicators">
        {metricCards.map((metric) => (
          <MetricCard key={metric.id} data={metric} />
        ))}
      </section>

      <div className="amx-row-2-1">
        <RequestsTable
          requests={filteredRequests}
          onSelectRequest={(id) => onNavigate?.(`requests/${id}`)}
          onViewAll={() => onNavigate?.('requests')}
        />
        <AssetInventoryCard
          data={assetInventoryData}
          onFilterChange={(_dim, _val) => {
            onNavigate?.('assets');
          }}
          onViewAssets={() => onNavigate?.('assets')}
        />
      </div>

      <div className="amx-row-3">
        <ExpiryAlerts
          alerts={expiryAlerts}
          onViewConsumables={() => onNavigate?.('consumables')}
        />
        <RecentPOs pos={recentPOs} />
        <ReportsAnalyticsCard
          onViewAll={() => onNavigate?.('reports')}
        />
      </div>

      <div className="amx-row-2">
        <StockLevels
          stocks={stockLevels}
          onViewConsumables={() => onNavigate?.('consumables')}
        />
        <ConsumptionChart
          total="N/A"
          departments={consumptionDepartments}
        />
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
