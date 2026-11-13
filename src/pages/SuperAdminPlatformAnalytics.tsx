import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getSuperAdminAnalytics,
  type SuperAdminAnalyticsResponse,
} from '../api/superadminApi';
import './SuperAdminPlatformAnalytics.css';

interface SuperAdminPlatformAnalyticsProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

interface RoleDefinition {
  key: string;
  label: string;
  domain: string;
  color: string;
}

const CANONICAL_ROLES: RoleDefinition[] = [
  { key: 'employee', label: 'Employee', domain: 'Workforce Portal', color: '#3b82f6' },
  { key: 'host', label: 'Host', domain: 'Visitor & Perimeter Movement', color: '#06b6d4' },
  { key: 'admin', label: 'Admin', domain: 'Asset & Requisition Control', color: '#8b5cf6' },
  { key: 'guard', label: 'Guard', domain: 'Physical Checkpoint Security', color: '#f59e0b' },
  { key: 'superadmin', label: 'SuperAdmin', domain: 'Governance & System Administration', color: '#6366f1' },
];

export const SuperAdminPlatformAnalyticsPage: React.FC<SuperAdminPlatformAnalyticsProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [data, setData] = useState<SuperAdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSuperAdminAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve platform analytics telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Safe field extractions with fallbacks to avoid NaN, null or undefined
  const totalUsers = data?.total_users ?? 0;
  const activeUsers = data?.active_users ?? 0;
  const usersByRole = data?.users_by_role ?? {};

  const totalAssets = data?.total_assets ?? 0;
  const assetsInService = data?.assets_in_service ?? 0;
  const assetAllocationPercent =
    totalAssets > 0 ? ((assetsInService / totalAssets) * 100).toFixed(1) : '0.0';

  const totalConsumables = data?.total_consumables ?? 0;
  const lowStockConsumables = data?.low_stock_consumables ?? data?.low_stock ?? 0;

  const totalRequests = data?.total_requests ?? 0;
  const openRequests = data?.open_requests ?? 0;
  const fulfilledRequests = data?.fulfilled_requests ?? 0;
  const fulfillmentRate =
    data?.fulfillment_rate_percent !== undefined
      ? Number(data.fulfillment_rate_percent).toFixed(1)
      : data?.fulfillment_rate !== undefined
      ? Number(data.fulfillment_rate).toFixed(1)
      : totalRequests > 0
      ? ((fulfilledRequests / totalRequests) * 100).toFixed(1)
      : '0.0';
  const avgApprovalCycle =
    data?.average_approval_cycle_hours !== undefined
      ? Number(data.average_approval_cycle_hours).toFixed(1)
      : '0.0';

  const totalGatePasses = data?.total_gate_passes ?? data?.total_passes ?? 0;
  const activeGatePasses = data?.active_gate_passes ?? data?.active_passes ?? 0;
  const overdueGatePasses = data?.overdue_gate_passes ?? data?.overdue_passes ?? 0;

  const totalAuditEvents = data?.total_audit_events ?? 0;

  // SVG Circular progress math (circumference = 2 * PI * 42 ~= 263.89)
  const circleRadius = 42;
  const circumference = 2 * Math.PI * circleRadius;
  const pctFloat = Math.min(100, Math.max(0, parseFloat(fulfillmentRate) || 0));
  const strokeDashoffset = circumference - (pctFloat / 100) * circumference;

  return (
    <DashboardLayout
      currentNav="Platform Analytics"
      role="superadmin"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="amx-an-container">
        {/* Header Bar */}
        <section className="amx-an-header-section" aria-label="Page Header">
          <div className="amx-an-breadcrumb-row">
            <nav className="amx-an-breadcrumb" aria-label="Breadcrumb">
              <span>Administration</span>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#94a3b8' }}>
                chevron_right
              </span>
              <span className="amx-an-breadcrumb-current">Platform Analytics</span>
            </nav>
            <span className="amx-an-breadcrumb-badge">
              Executive Governance
            </span>
          </div>

          <div className="amx-an-title-bar">
            <div className="amx-an-title-text">
              <h1>Platform Analytics</h1>
              <p>
                High-level operational metrics and platform governance telemetry across AssetMX.
              </p>
            </div>

            <div>
              <button
                type="button"
                className="amx-an-btn-refresh"
                onClick={fetchAnalytics}
                disabled={loading}
                title="Refresh platform telemetry"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  refresh
                </span>
                <span>{loading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="amx-an-state-card">
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--amx-an-secondary)' }}>
              hourglass_empty
            </span>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Loading platform telemetry...</div>
          </div>
        ) : error ? (
          <div className="amx-an-state-card">
            <span className="material-symbols-outlined amx-an-error-icon">error</span>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Failed to load analytics</div>
            <div style={{ color: 'var(--amx-an-text-muted)', fontSize: 14 }}>{error}</div>
            <button
              type="button"
              className="amx-an-btn-refresh"
              onClick={fetchAnalytics}
              style={{ marginTop: 12 }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Top 5 KPI Summary Row */}
            <section className="amx-an-kpi-grid" aria-label="Key Aggregate Metrics">
              {/* KPI 1: Total Users */}
              <div className="amx-an-kpi-card">
                <div className="amx-an-kpi-top">
                  <span className="amx-an-kpi-label">Total Users</span>
                  <div className="amx-an-kpi-icon">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                </div>
                <div>
                  <div className="amx-an-kpi-val">{totalUsers.toLocaleString()}</div>
                  <div className="amx-an-kpi-sub">Platform-wide registered accounts</div>
                </div>
                <div className="amx-an-kpi-footer">
                  <span className="amx-an-kpi-dot" style={{ backgroundColor: '#06b6d4' }} />
                  <span>{activeUsers.toLocaleString()} active credentials</span>
                </div>
              </div>

              {/* KPI 2: Total Assets */}
              <div className="amx-an-kpi-card">
                <div className="amx-an-kpi-top">
                  <span className="amx-an-kpi-label">Total Assets</span>
                  <div className="amx-an-kpi-icon">
                    <span className="material-symbols-outlined">devices_other</span>
                  </div>
                </div>
                <div>
                  <div className="amx-an-kpi-val">{totalAssets.toLocaleString()}</div>
                  <div className="amx-an-kpi-sub">Managed organizational inventory</div>
                </div>
                <div className="amx-an-kpi-footer">
                  <span className="amx-an-kpi-dot" style={{ backgroundColor: '#10b981' }} />
                  <span>{assetAllocationPercent}% operational allocation</span>
                </div>
              </div>

              {/* KPI 3: Total Requests */}
              <div className="amx-an-kpi-card">
                <div className="amx-an-kpi-top">
                  <span className="amx-an-kpi-label">Total Requests</span>
                  <div className="amx-an-kpi-icon">
                    <span className="material-symbols-outlined">assignment_turned_in</span>
                  </div>
                </div>
                <div>
                  <div className="amx-an-kpi-val">{totalRequests.toLocaleString()}</div>
                  <div className="amx-an-kpi-sub">Allocation &amp; service requests</div>
                </div>
                <div className="amx-an-kpi-footer">
                  <span className="amx-an-kpi-dot" style={{ backgroundColor: 'var(--amx-an-secondary)' }} />
                  <span>
                    {fulfilledRequests.toLocaleString()} fulfilled ({fulfillmentRate}%)
                  </span>
                </div>
              </div>

              {/* KPI 4: Total Gate Passes */}
              <div className="amx-an-kpi-card">
                <div className="amx-an-kpi-top">
                  <span className="amx-an-kpi-label">Total Gate Passes</span>
                  <div className="amx-an-kpi-icon">
                    <span className="material-symbols-outlined">badge</span>
                  </div>
                </div>
                <div>
                  <div className="amx-an-kpi-val">{totalGatePasses.toLocaleString()}</div>
                  <div className="amx-an-kpi-sub">Recorded gate passes</div>
                </div>
                <div className="amx-an-kpi-footer">
                  <span
                    className="amx-an-kpi-dot"
                    style={{ backgroundColor: overdueGatePasses > 0 ? '#ba1a1a' : '#10b981' }}
                  />
                  <span>
                    {activeGatePasses.toLocaleString()} active &bull; {overdueGatePasses} overdue
                  </span>
                </div>
              </div>

              {/* KPI 5: Total Audit Events */}
              <div className="amx-an-kpi-card">
                <div className="amx-an-kpi-top">
                  <span className="amx-an-kpi-label">Audit Events</span>
                  <div className="amx-an-kpi-icon">
                    <span className="material-symbols-outlined">verified_user</span>
                  </div>
                </div>
                <div>
                  <div className="amx-an-kpi-val">{totalAuditEvents.toLocaleString()}</div>
                  <div className="amx-an-kpi-sub">Platform audit records</div>
                </div>
                <div className="amx-an-kpi-footer">
                  <span className="amx-an-kpi-dot" style={{ backgroundColor: '#6366f1' }} />
                  <span>Total platform logs</span>
                </div>
              </div>
            </section>

            {/* Middle Section: Workforce Overview & Asset/Inventory Overview */}
            <section className="amx-an-row-middle" aria-label="Workforce and Inventory">
              {/* Left Card (58%): User Overview & Role Distribution */}
              <div className="amx-an-card">
                <div className="amx-an-card-header">
                  <div>
                    <span className="amx-an-card-tag">Identity &amp; Access</span>
                    <h3 className="amx-an-card-title">User Overview &amp; Role Distribution</h3>
                  </div>
                  <span className="amx-an-pill">
                    {totalUsers.toLocaleString()} Registered Credentials
                  </span>
                </div>

                {/* Horizontal Stacked Multi-segment Distribution Bar */}
                <div>
                  <div className="amx-an-stack-bar" role="progressbar" aria-label="Role Distribution Bar">
                    {CANONICAL_ROLES.map((role) => {
                      const count = usersByRole[role.key] ?? 0;
                      const sharePct = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
                      if (sharePct <= 0) return null;
                      return (
                        <div
                          key={role.key}
                          className="amx-an-stack-seg"
                          style={{
                            width: `${sharePct}%`,
                            backgroundColor: role.color,
                          }}
                          title={`${role.label}: ${count} (${sharePct.toFixed(1)}%)`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Structured Role Legend & Metrics Table */}
                <table className="amx-an-table" aria-label="Role Distribution Table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Access Domain</th>
                      <th style={{ textAlign: 'right' }}>User Count</th>
                      <th style={{ textAlign: 'right' }}>Platform Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CANONICAL_ROLES.map((role) => {
                      const count = usersByRole[role.key] ?? 0;
                      const sharePct = totalUsers > 0 ? ((count / totalUsers) * 100).toFixed(1) : '0.0';

                      return (
                        <tr key={role.key}>
                          <td>
                            <div className="amx-an-role-cell">
                              <span
                                className="amx-an-role-dot"
                                style={{ backgroundColor: role.color }}
                              />
                              <span>{role.label}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--amx-an-text-muted)' }}>{role.domain}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--amx-an-font-mono)' }}>
                            {count.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--amx-an-font-mono)', fontWeight: 700 }}>
                            {sharePct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Right Card (42%): Asset & Inventory Overview */}
              <div className="amx-an-card">
                <div className="amx-an-card-header">
                  <div>
                    <span className="amx-an-card-tag">Resource Management</span>
                    <h3 className="amx-an-card-title">Asset &amp; Inventory Overview</h3>
                  </div>
                </div>

                {/* Panel 1: Asset In-Service Distribution */}
                <div className="amx-an-panel">
                  <span className="amx-an-panel-label">Asset Deployment Status</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span className="amx-an-panel-val">{assetsInService.toLocaleString()}</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--amx-an-font-mono)', color: 'var(--amx-an-text-muted)' }}>
                      of {totalAssets.toLocaleString()} total
                    </span>
                  </div>
                  <div className="amx-an-panel-sub">{assetAllocationPercent}% operational allocation</div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 4,
                      backgroundColor: 'var(--amx-an-surface-mid)',
                      overflow: 'hidden',
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${assetAllocationPercent}%`,
                        backgroundColor: '#10b981',
                      }}
                    />
                  </div>
                </div>

                {/* Panel 2: Inventory & Consumables SKU Warning Status */}
                <div
                  className={`amx-an-panel ${
                    lowStockConsumables > 0 ? 'amx-an-panel-alert' : ''
                  }`}
                >
                  <span className="amx-an-panel-label">Consumable SKU Status</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span className="amx-an-panel-val">
                      {lowStockConsumables.toLocaleString()} Low Stock
                    </span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--amx-an-font-mono)', color: 'var(--amx-an-text-muted)' }}>
                      of {totalConsumables.toLocaleString()} SKUs
                    </span>
                  </div>
                  <div className="amx-an-panel-sub">
                    {lowStockConsumables > 0
                      ? 'Requires replenishment attention'
                      : 'All inventory stock levels nominal'}
                  </div>
                </div>
              </div>
            </section>

            {/* Lower Section: Request Processing & Gate Pass Operations */}
            <section className="amx-an-row-lower" aria-label="Operations and Security">
              {/* Left Card: Request Processing & Fulfillment */}
              <div className="amx-an-card">
                <div className="amx-an-card-header">
                  <div>
                    <span className="amx-an-card-tag">Requisitions &amp; Approvals</span>
                    <h3 className="amx-an-card-title">Request Processing &amp; Fulfillment</h3>
                  </div>
                </div>

                <div className="amx-an-circular-wrap">
                  {/* Inline Circular Progress Meter */}
                  <div className="amx-an-circle-container">
                    <svg className="amx-an-circle-svg" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r={circleRadius}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="9"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={circleRadius}
                        fill="none"
                        stroke="var(--amx-an-secondary)"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="amx-an-circle-center">
                      <span className="amx-an-circle-pct">{fulfillmentRate}%</span>
                      <span className="amx-an-circle-lbl">Fulfillment</span>
                    </div>
                  </div>

                  {/* Cycle details & Counts */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <div className="amx-an-panel-label">Average Approval Cycle</div>
                      <div
                        style={{
                          fontSize: 26,
                          fontWeight: 800,
                          fontFamily: 'var(--amx-an-font-mono)',
                          color: 'var(--amx-an-text)',
                          marginTop: 2,
                        }}
                      >
                        {avgApprovalCycle} hrs
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--amx-an-text-muted)' }}>
                        Average turnaround from submission to decision
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: 'var(--amx-an-font-mono)' }}>
                      <div>
                        <strong>Fulfilled:</strong> {fulfilledRequests.toLocaleString()}
                      </div>
                      <div>
                        <strong>Open:</strong> {openRequests.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Card: Gate Pass Operations */}
              <div className="amx-an-card">
                <div className="amx-an-card-header">
                  <div>
                    <span className="amx-an-card-tag">Perimeter Security</span>
                    <h3 className="amx-an-card-title">Gate Pass Operations</h3>
                  </div>
                  <span className="amx-an-pill">
                    {totalGatePasses.toLocaleString()} Authorizations
                  </span>
                </div>

                <div className="amx-an-panel-grid">
                  <div className="amx-an-panel">
                    <span className="amx-an-panel-label">Total Passes</span>
                    <div className="amx-an-panel-val">{totalGatePasses.toLocaleString()}</div>
                    <span className="amx-an-panel-sub">Perimeter logged</span>
                  </div>

                  <div className="amx-an-panel">
                    <span className="amx-an-panel-label" style={{ color: 'var(--amx-an-secondary)' }}>
                      Active Passes
                    </span>
                    <div className="amx-an-panel-val" style={{ color: 'var(--amx-an-secondary)' }}>
                      {activeGatePasses.toLocaleString()}
                    </div>
                    <span className="amx-an-panel-sub">Currently outside</span>
                  </div>

                  <div className={`amx-an-panel ${overdueGatePasses > 0 ? 'amx-an-panel-alert' : ''}`}>
                    <span
                      className="amx-an-panel-label"
                      style={{ color: overdueGatePasses > 0 ? '#ba1a1a' : undefined }}
                    >
                      Overdue Flag
                    </span>
                    <div
                      className="amx-an-panel-val"
                      style={{ color: overdueGatePasses > 0 ? '#ba1a1a' : undefined }}
                    >
                      {overdueGatePasses.toLocaleString()}
                    </div>
                    <span className="amx-an-panel-sub">
                      {overdueGatePasses > 0 ? 'Action required' : 'Nominal'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Final Section: Platform Governance & Audit Ledger (Full-width Card) */}
            <section className="amx-an-gov-card" aria-label="Platform Governance and Audit Ledger">
              <div className="amx-an-gov-top">
                <div className="amx-an-gov-title-wrap">
                  <div className="amx-an-gov-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                      verified
                    </span>
                  </div>
                  <div>
                    <h3 className="amx-an-gov-title">Platform Governance &amp; Audit Events</h3>
                  </div>
                </div>

                <div className="amx-an-gov-counter">
                  <span className="amx-an-gov-counter-lbl">Total Recorded Events</span>
                  <span className="amx-an-gov-counter-val">
                    {totalAuditEvents.toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="amx-an-gov-desc">
                Centralized governance ledger recording administrative operations, asset allocations,
                credential updates, and perimeter gate movements across AssetMX.
              </p>

              <div className="amx-an-gov-badges">
                <div className="amx-an-gov-badge">
                  <span className="amx-an-gov-dot" />
                  <span>Audit Events Recorded</span>
                </div>
                <div className="amx-an-gov-badge">
                  <span className="amx-an-gov-dot" />
                  <span>5 Role Access Boundaries Enforced</span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

