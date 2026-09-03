import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { MetricCard } from '../components/MetricCard';
import { RequestsTable } from '../components/RequestsTable';
import { AssetInventoryCard } from '../components/AssetInventoryCard';
import { ExpiryAlerts } from '../components/ExpiryAlerts';
import { RecentPOs } from '../components/RecentPOs';
import { ReportsAnalyticsCard } from '../components/ReportsAnalyticsCard';
import { StockLevels } from '../components/StockLevels';
import { ConsumptionChart } from '../components/ConsumptionChart';
import {
  KPI_METRICS,
  MY_REQUESTS,
  ASSET_INVENTORY,
  EXPIRY_ALERTS,
  RECENT_POS,
  STOCK_LEVELS,
  CONSUMPTION_DATA,
} from '../data/dashboardData';
import './Dashboard.css';

interface DashboardPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    showToast('Exporting Real-Time Metrics & System Alerts Report (.CSV)...');
  };

  const handleNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      onNavigate?.('dashboard');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} module — Scheduled for future backend integration.`);
      onNavigate?.(subRoute);
    }
  };

  // Filter requests based on search query
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return MY_REQUESTS;
    const q = searchQuery.toLowerCase();
    return MY_REQUESTS.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Filter POs based on search query
  const filteredPOs = useMemo(() => {
    if (!searchQuery.trim()) return RECENT_POS;
    const q = searchQuery.toLowerCase();
    return RECENT_POS.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.vendor.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <DashboardLayout
      currentNav="Dashboard"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(q) => setSearchQuery(q)}
      onAddAsset={() => showToast('New Asset Registration workflow — Future module dependency.')}
      onNotificationsClick={() =>
        showToast('1 Alert: Printer Ink (Cyan) expires today; Stationery low stock.')
      }
      onHelpClick={() => showToast('AssetMX Enterprise Help Center & User Manual.')}
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

      {/* Row 1: Dashboard Overview Header */}
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

      {/* Row 2: 5 KPI Metric Cards */}
      <section className="amx-kpi-grid" aria-label="Key Performance Indicators">
        {KPI_METRICS.map((metric) => (
          <MetricCard key={metric.id} data={metric} />
        ))}
      </section>

      {/* Row 3: My Requests & Asset Inventory */}
      <div className="amx-row-2-1">
        <RequestsTable requests={filteredRequests} />
        <AssetInventoryCard
          data={ASSET_INVENTORY}
          onFilterChange={(dim, val) =>
            showToast(`Asset Inventory filtered by ${dim}: ${val}`)
          }
        />
      </div>

      {/* Row 4: Expiry Alerts, Recent POs & Analytics Highlight */}
      <div className="amx-row-3">
        <ExpiryAlerts alerts={EXPIRY_ALERTS} />
        <RecentPOs pos={filteredPOs} />
        <ReportsAnalyticsCard
          onViewAll={() =>
            showToast('Navigating to Reports & Compliance Analytics...')
          }
        />
      </div>

      {/* Row 5: Stock Levels & Consumption by Dept */}
      <div className="amx-row-2">
        <StockLevels stocks={STOCK_LEVELS} />
        <ConsumptionChart
          total={CONSUMPTION_DATA.total}
          departments={CONSUMPTION_DATA.departments}
        />
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
