import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  listAuditLogs,
  exportAuditLogsCsv,
  setCachedAuditEvent,
  formatEventId,
  formatUtcTimestamp,
  type AuditLogListItem,
} from '../api/superadminApi';
import './SuperAdminAuditLogs.css';

interface SuperAdminAuditLogsProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

const COMMON_ACTIONS = [
  'user.status_changed',
  'asset_transferred',
  'gate_pass_auto_escalated',
  'request.approved',
  'user.created',
  'maintenance.record_created',
  'user.updated',
];

export const SuperAdminAuditLogsPage: React.FC<SuperAdminAuditLogsProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Audit log records & pagination state
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // CSV export state
  const [isExporting, setIsExporting] = useState(false);

  // Load audit logs from backend
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const actorIdNum = actorFilter.trim() ? parseInt(actorFilter.trim(), 10) : undefined;
      const res = await listAuditLogs({
        search: searchTerm.trim() || undefined,
        action: actionFilter.trim() || undefined,
        actor_id: !isNaN(actorIdNum as number) ? actorIdNum : undefined,
        date_from: dateFrom.trim() || undefined,
        date_to: dateTo.trim() || undefined,
        page,
        page_size: pageSize,
      });

      setLogs(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.total_pages || (res.total ? Math.ceil(res.total / pageSize) : 1));
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, actionFilter, actorFilter, dateFrom, dateTo, page, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Derived KPI calculations based on authoritative total + currently loaded records
  const kpiData = useMemo(() => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    let eventsToday = 0;
    let adminActions = 0;
    let securityEvents = 0;

    for (const item of logs) {
      if (item.occurred_at && item.occurred_at.slice(0, 10) === todayUtc) {
        eventsToday++;
      }
      const act = item.action.toLowerCase();
      if (act.startsWith('user.') || act.includes('admin') || act.includes('config') || act.includes('password')) {
        adminActions++;
      }
      if (act.includes('gate_pass') || act.includes('security') || act.includes('incident') || act.includes('movement')) {
        securityEvents++;
      }
    }

    return {
      total: totalCount,
      today: eventsToday,
      admin: adminActions,
      security: securityEvents,
    };
  }, [logs, totalCount]);

  // Reset all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setActionFilter('');
    setActorFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // CSV Export handler
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const blob = await exportAuditLogsCsv({
        action: actionFilter.trim() || undefined,
        date_from: dateFrom.trim() || undefined,
        date_to: dateTo.trim() || undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `assetmx_audit_export_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  // Navigation to individual audit event details page
  const handleViewDetails = (item: AuditLogListItem) => {
    setCachedAuditEvent(item);
    if (onNavigate) {
      onNavigate(`superadmin/audit-logs/${item.id}`);
    } else {
      window.history.pushState({}, '', `/superadmin/audit-logs/${item.id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Action badge category styling helper
  const getActionBadgeClass = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('status')) return 'amx-audit-badge amx-audit-badge-amber';
    if (act.includes('transferred') || act.includes('movement')) return 'amx-audit-badge amx-audit-badge-cyan';
    if (act.includes('escalated') || act.includes('incident') || act.includes('failed') || act.includes('denied'))
      return 'amx-audit-badge amx-audit-badge-red';
    if (act.includes('approved') || act.includes('active') || act.includes('cleared'))
      return 'amx-audit-badge amx-audit-badge-emerald';
    if (act.includes('created')) return 'amx-audit-badge amx-audit-badge-blue';
    if (act.includes('maintenance')) return 'amx-audit-badge amx-audit-badge-purple';
    if (act.includes('updated') || act.includes('password')) return 'amx-audit-badge amx-audit-badge-indigo';
    return 'amx-audit-badge amx-audit-badge-gray';
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() || actionFilter || actorFilter.trim() || dateFrom || dateTo,
  );

  return (
    <DashboardLayout
      currentNav="Audit & Logs"
      role="superadmin"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="amx-audit-page-container">
        {/* Header Bar */}
        <section className="amx-audit-header-section" aria-label="Page Header">
          <div className="amx-audit-breadcrumb-row">
            <nav className="amx-audit-breadcrumb" aria-label="Breadcrumb">
              <span>Administration</span>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#94a3b8' }}>
                chevron_right
              </span>
              <span className="amx-audit-breadcrumb-current">Audit &amp; Logs</span>
            </nav>
            <span className="amx-audit-breadcrumb-badge">
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--amx-audit-secondary)' }}>
                shield
              </span>
              Governance Audit Trail
            </span>
          </div>

          <div className="amx-audit-title-bar">
            <div className="amx-audit-title-text">
              <h1>Audit &amp; Logs</h1>
              <p>
                Monitor platform activities, administrative changes and security-related events across AssetMX.
              </p>
            </div>
            <div>
              <button
                className="amx-audit-btn-export"
                onClick={handleExportCsv}
                disabled={isExporting}
                title="Export with current filters"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  receipt_long
                </span>
                <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 4 KPI Summary Cards */}
        <section className="amx-audit-kpi-grid" aria-label="Audit KPI Summary">
          {/* Card 1: Total Audit Events */}
          <div className="amx-audit-kpi-card">
            <div className="amx-audit-kpi-top">
              <span className="amx-audit-kpi-label">Total Audit Events</span>
              <div className="amx-audit-kpi-icon">
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
            </div>
            <div>
              <div className="amx-audit-kpi-value">{kpiData.total.toLocaleString()}</div>
              <div className="amx-audit-kpi-subtext">System aggregate log</div>
            </div>
          </div>

          {/* Card 2: Events Today */}
          <div className="amx-audit-kpi-card">
            <div className="amx-audit-kpi-top">
              <span className="amx-audit-kpi-label">Events Today</span>
              <div className="amx-audit-kpi-icon">
                <span className="material-symbols-outlined">schedule</span>
              </div>
            </div>
            <div>
              <div className="amx-audit-kpi-value">{kpiData.today.toLocaleString()}</div>
              <div className="amx-audit-kpi-subtext">Derived from loaded records</div>
            </div>
          </div>

          {/* Card 3: Administrative Actions */}
          <div className="amx-audit-kpi-card">
            <div className="amx-audit-kpi-top">
              <span className="amx-audit-kpi-label">Administrative Actions</span>
              <div className="amx-audit-kpi-icon">
                <span className="material-symbols-outlined">admin_panel_settings</span>
              </div>
            </div>
            <div>
              <div className="amx-audit-kpi-value">{kpiData.admin.toLocaleString()}</div>
              <div className="amx-audit-kpi-subtext">Derived from loaded records</div>
            </div>
          </div>

          {/* Card 4: Security & Gate Pass Events */}
          <div className="amx-audit-kpi-card">
            <div className="amx-audit-kpi-top">
              <span className="amx-audit-kpi-label">Security &amp; Gate Pass Events</span>
              <div className="amx-audit-kpi-icon">
                <span className="material-symbols-outlined">shield</span>
              </div>
            </div>
            <div>
              <div className="amx-audit-kpi-value">{kpiData.security.toLocaleString()}</div>
              <div className="amx-audit-kpi-subtext">Derived from loaded records</div>
            </div>
          </div>
        </section>

        {/* Filter & Search Toolbar */}
        <section className="amx-audit-toolbar-card" aria-label="Audit Filters and Search">
          <div className="amx-audit-toolbar-grid">
            {/* Search */}
            <div className="amx-audit-search-wrapper">
              <span className="material-symbols-outlined amx-audit-search-icon">search</span>
              <input
                type="text"
                className="amx-audit-search-input"
                placeholder="Search by action, asset ID, request ID, gate pass ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Action Filter */}
            <div className="amx-audit-select-wrapper">
              <select
                className="amx-audit-select"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Actions</option>
                {COMMON_ACTIONS.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined amx-audit-select-icon">expand_more</span>
            </div>

            {/* Actor User ID Filter */}
            <div className="amx-audit-search-wrapper">
              <span className="material-symbols-outlined amx-audit-search-icon" style={{ fontSize: 16 }}>
                person
              </span>
              <input
                type="text"
                className="amx-audit-search-input"
                placeholder="Actor User ID"
                value={actorFilter}
                onChange={(e) => {
                  setActorFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Date From */}
            <div>
              <input
                type="date"
                className="amx-audit-date-input"
                title="Date From"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Date To */}
            <div>
              <input
                type="date"
                className="amx-audit-date-input"
                title="Date To"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Clear Button */}
            <div>
              <button
                type="button"
                className="amx-audit-btn-clear"
                onClick={handleClearFilters}
                title="Clear all filters"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  filter_alt_off
                </span>
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Active Chips & Record Counter */}
          <div className="amx-audit-chips-row">
            <div className="amx-audit-chips-list">
              <span className="amx-audit-chips-label">Active:</span>
              {searchTerm && (
                <span className="amx-audit-chip">
                  <span>Search: &ldquo;{searchTerm}&rdquo;</span>
                  <button
                    className="amx-audit-chip-close"
                    onClick={() => setSearchTerm('')}
                    title="Remove search filter"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      close
                    </span>
                  </button>
                </span>
              )}
              {actionFilter && (
                <span className="amx-audit-chip">
                  <span>Action: {actionFilter}</span>
                  <button
                    className="amx-audit-chip-close"
                    onClick={() => setActionFilter('')}
                    title="Remove action filter"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      close
                    </span>
                  </button>
                </span>
              )}
              {actorFilter && (
                <span className="amx-audit-chip">
                  <span>Actor: {actorFilter}</span>
                  <button
                    className="amx-audit-chip-close"
                    onClick={() => setActorFilter('')}
                    title="Remove actor filter"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      close
                    </span>
                  </button>
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="amx-audit-chip">
                  <span>
                    Date: {dateFrom || 'Any'} &rarr; {dateTo || 'Any'}
                  </span>
                  <button
                    className="amx-audit-chip-close"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    title="Remove date filter"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      close
                    </span>
                  </button>
                </span>
              )}
              {!hasActiveFilters && (
                <span style={{ fontSize: 12, color: 'var(--amx-audit-text-muted)' }}>
                  All Audited Events
                </span>
              )}
            </div>
            <div className="amx-audit-results-count">
              Showing filtered results &bull; <strong>{logs.length}</strong> of{' '}
              {totalCount.toLocaleString()} records
            </div>
          </div>
        </section>

        {/* Audit Records Table */}
        <section className="amx-audit-table-card" aria-label="Audit Records Table">
          {error ? (
            <div className="amx-audit-empty-state">
              <span className="material-symbols-outlined amx-audit-empty-icon" style={{ color: '#ba1a1a' }}>
                error
              </span>
              <div className="amx-audit-empty-title">Failed to load audit logs</div>
              <div className="amx-audit-empty-desc">{error}</div>
              <button
                className="amx-audit-btn-clear"
                onClick={loadLogs}
                style={{ marginTop: 8 }}
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="amx-audit-empty-state">
              <span className="material-symbols-outlined amx-audit-empty-icon">hourglass_empty</span>
              <div className="amx-audit-empty-title">Loading governance ledger...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="amx-audit-empty-state">
              <span className="material-symbols-outlined amx-audit-empty-icon">search_off</span>
              <div className="amx-audit-empty-title">No audit records found</div>
              <div className="amx-audit-empty-desc">
                No ledger events matched your active search query or filter criteria.
              </div>
              {hasActiveFilters && (
                <button
                  className="amx-audit-btn-clear"
                  onClick={handleClearFilters}
                  style={{ marginTop: 8 }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="amx-audit-table-wrapper">
              <table className="amx-audit-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>Event ID</th>
                    <th style={{ width: '190px' }}>Timestamp (UTC)</th>
                    <th style={{ width: '210px' }}>Action</th>
                    <th style={{ width: '130px' }}>Actor User ID</th>
                    <th style={{ width: '200px' }}>Asset / Target Identifier</th>
                    <th style={{ width: '200px' }}>Request / Gate Pass Reference</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>View Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((item) => {
                    const formattedEvtId = formatEventId(item.id, item.occurred_at);
                    const formattedTime = formatUtcTimestamp(item.occurred_at);
                    const targetId = item.asset_identifier || item.consumable_identifier;
                    const refId = item.request_identifier || item.gate_pass_identifier;

                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="amx-audit-evt-id">{formattedEvtId}</span>
                        </td>
                        <td>
                          <span className="amx-audit-timestamp">{formattedTime}</span>
                        </td>
                        <td>
                          <span className={getActionBadgeClass(item.action)}>
                            {item.action}
                          </span>
                        </td>
                        <td>
                          <span className="amx-audit-actor">USR-{item.actor_user_id}</span>
                        </td>
                        <td>
                          {targetId ? (
                            <span className="amx-audit-identifier-badge">{targetId}</span>
                          ) : (
                            <span className="amx-audit-dash">&mdash;</span>
                          )}
                        </td>
                        <td>
                          {refId ? (
                            <span className="amx-audit-identifier-badge">{refId}</span>
                          ) : (
                            <span className="amx-audit-dash">&mdash;</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="amx-audit-btn-details"
                            onClick={() => handleViewDetails(item)}
                            title={`View details for ${formattedEvtId}`}
                          >
                            <span>View Details</span>
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                              arrow_forward
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && !error && logs.length > 0 && (
            <div className="amx-audit-pagination">
              <div className="amx-audit-pagination-size">
                <span>Rows per page:</span>
                <select
                  className="amx-audit-pagination-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="amx-audit-pagination-info">
                Page {page} of {totalPages} ({totalCount.toLocaleString()} total events)
              </div>

              <div className="amx-audit-pagination-btns">
                <button
                  type="button"
                  className="amx-audit-pg-btn"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  title="First Page"
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  className="amx-audit-pg-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  title="Previous Page"
                >
                  &lsaquo;
                </button>
                <button
                  type="button"
                  className="amx-audit-pg-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  title="Next Page"
                >
                  &rsaquo;
                </button>
                <button
                  type="button"
                  className="amx-audit-pg-btn"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  title="Last Page"
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Immutability Policy Card */}
        <footer className="amx-audit-policy-card" aria-label="Audit Integrity Information">
          <div className="amx-audit-policy-left">
            <div className="amx-audit-policy-icon">
              <span className="material-symbols-outlined">lock</span>
            </div>
            <div>
              <span className="amx-audit-policy-title">
                Audit Ledger Immutability Policy
              </span>
              <p className="amx-audit-policy-desc">
                Audit records are immutable and cannot be modified or deleted through the platform. All platform operations remain strictly recorded for governance compliance.
              </p>
            </div>
          </div>
          <div className="amx-audit-policy-status">
            <span className="amx-audit-policy-dot" />
            <span>Immutable Record Ledger Active</span>
          </div>
        </footer>
      </div>
    </DashboardLayout>
  );
};

