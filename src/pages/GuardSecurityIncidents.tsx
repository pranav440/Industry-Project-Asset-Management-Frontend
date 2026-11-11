import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  type GuardEscalationRegisterItem,
  type GuardEscalationKpis,
  type HoldStatus,
} from '../data/guardIncidentsData';
import {
  fetchGuardEscalationRegister,
  fetchAllGuardEscalationsForExport,
} from '../api/guardEscalationsApi';
import { getGatePass, escalateGatePass, type GatePass } from '../api/gatePassApi';
import './GuardSecurityIncidents.css';

interface GuardSecurityIncidentsPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

const HOLD_STATUS_COLORS: Record<HoldStatus, { bg: string; text: string }> = {
  Active: { bg: '#fce8e6', text: '#b3261e' },
  Cleared: { bg: '#e6f4ea', text: '#1e6e38' },
};

export const GuardSecurityIncidentsPage: React.FC<GuardSecurityIncidentsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // ── Register state from API ─────────────────────────────────────────
  const [items, setItems] = useState<GuardEscalationRegisterItem[]>([]);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Filter state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Cleared'>('All');

  // Applied filter state
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedStatus, setAppliedStatus] = useState<'All' | 'Active' | 'Cleared'>('All');

  // ── Pagination ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── UI state ────────────────────────────────────────────────────────
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // ── KPIs ────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<GuardEscalationKpis>({
    totalHolds: 0,
    activeHolds: 0,
    clearedOverridden: 0,
  });

  // ── Escalate Pass Form State ────────────────────────────────────────
  const [lookupPassId, setLookupPassId] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadedPass, setLoadedPass] = useState<GatePass | null>(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [actionRequired, setActionRequired] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Toast helper ────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 3800);
  }, []);

  // ── Load register records from API ──────────────────────────────────
  const loadRegister = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchGuardEscalationRegister({
        search: appliedSearch,
        fromDate: appliedFrom,
        toDate: appliedTo,
        status: appliedStatus,
        page: currentPage,
        pageSize,
      });

      setItems(res.items);
      setTotalEntries(res.total);
      setTotalPages(res.totalPages);
      setKpis(res.kpis);

      if (res.items.length > 0) {
        setSelectedId((prev) => {
          if (prev && res.items.some((i) => i.id === prev || i.passId === prev)) {
            return prev;
          }
          return res.items[0].id;
        });
      } else {
        setSelectedId('');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load checkpoint escalation register.');
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, appliedFrom, appliedTo, appliedStatus, currentPage, pageSize]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  // ── Selected record ─────────────────────────────────────────────────
  const selectedRecord = useMemo(() => {
    if (!items.length) return null;
    return items.find((i) => i.id === selectedId || i.passId === selectedId) || items[0];
  }, [items, selectedId]);

  // ── Filter handlers ─────────────────────────────────────────────────
  const handleApplyFilters = () => {
    setAppliedSearch(searchQuery);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedStatus(statusFilter);
    setCurrentPage(1);
    showToast('Filters applied to escalation register');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setStatusFilter('All');
    setAppliedSearch('');
    setAppliedFrom('');
    setAppliedTo('');
    setAppliedStatus('All');
    setCurrentPage(1);
    showToast('Filters reset to show all escalation records');
  };

  // ── Escalate Pass Form Reset ────────────────────────────────────────
  const resetEscalateForm = () => {
    setLookupPassId('');
    setLoadedPass(null);
    setLookupError(null);
    setEscalationReason('');
    setActionRequired('');
    setFormErrors([]);
    setIsSubmitting(false);
  };

  // ── Lookup Pass for Escalation ──────────────────────────────────────
  const handleLookupPass = async () => {
    const cleanId = lookupPassId.trim();
    if (!cleanId) {
      setLookupError('Please enter a Gate Pass ID to verify.');
      return;
    }
    setIsLookingUp(true);
    setLookupError(null);
    setLoadedPass(null);
    try {
      const pass = await getGatePass(cleanId);
      setLoadedPass(pass);
      if (pass.status !== 'Pending' && pass.status !== 'Approved') {
        setLookupError(
          `Gate Pass is currently in '${pass.status}' status. Only Pending or Approved Gate Passes can be escalated at the checkpoint.`
        );
      }
    } catch (err: any) {
      setLookupError(err?.message || `Gate Pass '${cleanId}' was not found. Please verify the Pass ID.`);
    } finally {
      setIsLookingUp(false);
    }
  };

  // ── Submit Escalation ───────────────────────────────────────────────
  const handleSubmitEscalation = async () => {
    const errors: string[] = [];
    if (!loadedPass) {
      errors.push('A valid, eligible Gate Pass must be loaded before submitting an escalation.');
    } else if (loadedPass.status !== 'Pending' && loadedPass.status !== 'Approved') {
      errors.push(`Pass status '${loadedPass.status}' is not eligible for escalation.`);
    }
    if (!escalationReason.trim()) {
      errors.push('Escalation Reason is required.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors([]);
    try {
      const passId = loadedPass!.pass_id;
      await escalateGatePass(passId, {
        reason: escalationReason.trim(),
        action_required:
          actionRequired.trim() || 'Physical inspection and administrative review required before release',
      });

      showToast(`Gate Pass ${passId} escalated successfully. Checkpoint hold engaged.`);
      setIsDrawerOpen(false);
      resetEscalateForm();
      // Reload register to display newly escalated pass
      await loadRegister();
    } catch (err: any) {
      setFormErrors([err?.message || 'Failed to submit escalation. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Export CSV Handler ──────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setIsExporting(true);
      showToast('Fetching complete escalation register for export...');
      const exportItems = await fetchAllGuardEscalationsForExport(
        {
          search: appliedSearch,
          fromDate: appliedFrom,
          toDate: appliedTo,
          status: appliedStatus,
        },
        (loaded, total) => {
          if (total > 50) {
            showToast(`Exporting records: ${loaded} of ${total} loaded...`);
          }
        }
      );

      if (exportItems.length === 0) {
        showToast('No escalation records match the active filter criteria to export.');
        return;
      }

      const rows = exportItems.map((i) => ({
        'Gate Pass ID': i.passId,
        'Hold Status': i.holdStatus === 'Active' ? 'Active Hold' : 'Cleared by Override',
        'Hold Status Detail': i.holdStatusTitle,
        'Asset ID': i.assetId,
        'Asset Name': i.assetName,
        'Requester Name': i.requesterName,
        'Department': i.department,
        'Destination': i.destination,
        'Pass Type': i.passType,
        'Gate Pass Status': i.gatePassStatus,
        'Escalation Reason': i.escalationReason,
        'Action Required': i.actionRequired || '',
        'Escalated By': i.escalatedBy,
        'Escalation Date': i.dateDisplay,
        'Escalation Time': i.timeDisplay,
        'Checkpoint': i.checkpoint,
        'Override By': i.overrideBy || '',
        'Override Timestamp': i.overrideTimestamp || '',
        'Override Note': i.overrideNote || '',
      }));

      const headers = Object.keys(rows[0] || {});
      const csv = [
        headers.join(','),
        ...rows.map((r) =>
          headers.map((h) => `"${String((r as any)[h] || '').replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checkpoint-escalations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${exportItems.length} checkpoint escalation records.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to export escalation records.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout currentNav="Security Incidents" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="amx-si-container" data-testid="si-screen">
        {/* ── Header Row ── */}
        <div className="amx-si-header-row" data-testid="si-header">
          <div>
            <div className="amx-si-breadcrumb">
              <span>GUARD PORTAL</span>
              <span className="amx-si-crumb-sep material-icons" style={{ fontSize: 14 }}>
                chevron_right
              </span>
              <span className="amx-si-crumb-current">CHECKPOINT ESCALATIONS</span>
            </div>
            <h1 className="amx-si-page-title">Checkpoint Escalation &amp; Discrepancy Register</h1>
            <div className="amx-si-node-row">
              <span className="amx-si-node-chip">
                <span className="amx-si-node-dot" />
                Gate-01A Main Gate
              </span>
              <span className="amx-si-node-chip amx-si-node-chip--shift">
                <span className="material-icons" style={{ fontSize: 13 }}>
                  security
                </span>
                Perimeter Discrepancy Registry
              </span>
            </div>
          </div>
          <div className="amx-si-header-actions">
            <button
              type="button"
              className="amx-si-btn amx-si-btn--report"
              onClick={() => {
                resetEscalateForm();
                setIsDrawerOpen(true);
              }}
              data-testid="si-btn-report"
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                gpp_maybe
              </span>
              Escalate Gate Pass
            </button>
            <button
              type="button"
              className="amx-si-btn amx-si-btn--export"
              onClick={handleExport}
              disabled={isExporting || isLoading}
              data-testid="si-btn-export"
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                download
              </span>
              {isExporting ? 'Exporting...' : 'Export Register (CSV)'}
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="amx-si-kpi-row" data-testid="si-kpis">
          {/* Total Holds */}
          <div className="amx-si-kpi-card">
            <div className="amx-si-kpi-icon amx-si-kpi-icon--total">
              <span className="material-icons">lock</span>
            </div>
            <div className="amx-si-kpi-body">
              <div className="amx-si-kpi-label">Total Checkpoint Holds</div>
              <div className="amx-si-kpi-value">{kpis.totalHolds}</div>
              <div className="amx-si-kpi-sub">All recorded checkpoint holds</div>
            </div>
          </div>

          {/* Active Holds */}
          <div className="amx-si-kpi-card">
            <div className="amx-si-kpi-icon amx-si-kpi-icon--critical">
              <span className="material-icons">warning</span>
            </div>
            <div className="amx-si-kpi-body">
              <div className="amx-si-kpi-label">Active Escalation Holds</div>
              <div className="amx-si-kpi-value amx-si-kpi-value--critical">{kpis.activeHolds}</div>
              <div className="amx-si-kpi-sub">Currently on hold at checkpoint</div>
            </div>
          </div>

          {/* Cleared Overridden */}
          <div className="amx-si-kpi-card">
            <div className="amx-si-kpi-icon amx-si-kpi-icon--resolved">
              <span className="material-icons">verified</span>
            </div>
            <div className="amx-si-kpi-body">
              <div className="amx-si-kpi-label">Cleared by Override</div>
              <div className="amx-si-kpi-value amx-si-kpi-value--resolved">{kpis.clearedOverridden}</div>
              <div className="amx-si-kpi-sub">Administrative clearance granted</div>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="amx-si-filters-card" data-testid="si-filters">
          <div className="amx-si-filters-row">
            <div className="amx-si-filter-group amx-si-filter-group--search">
              <span className="material-icons amx-si-filter-search-icon">search</span>
              <input
                className="amx-si-filter-input"
                placeholder="Search Gate Pass ID, Asset, Requester, Reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                data-testid="si-search"
              />
            </div>
            <div className="amx-si-filter-group">
              <label className="amx-si-filter-label">From</label>
              <input
                type="date"
                className="amx-si-filter-input amx-si-filter-input--date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                data-testid="si-filter-from"
              />
            </div>
            <div className="amx-si-filter-group">
              <label className="amx-si-filter-label">To</label>
              <input
                type="date"
                className="amx-si-filter-input amx-si-filter-input--date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                data-testid="si-filter-to"
              />
            </div>
            <div className="amx-si-filter-group">
              <label className="amx-si-filter-label">Hold Status</label>
              <select
                className="amx-si-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Cleared')}
                data-testid="si-filter-status"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Holds</option>
                <option value="Cleared">Cleared by Override</option>
              </select>
            </div>
          </div>
          <div className="amx-si-filters-actions">
            <button
              type="button"
              className="amx-si-btn amx-si-btn--apply"
              onClick={handleApplyFilters}
              data-testid="si-btn-apply"
            >
              <span className="material-icons" style={{ fontSize: 16 }}>
                filter_list
              </span>
              Apply Filters
            </button>
            <button
              type="button"
              className="amx-si-btn amx-si-btn--reset"
              onClick={handleResetFilters}
              data-testid="si-btn-reset"
            >
              <span className="material-icons" style={{ fontSize: 16 }}>
                restart_alt
              </span>
              Reset Filters
            </button>
            {appliedSearch && (
              <span className="amx-si-active-chip">
                Search: {appliedSearch}
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setAppliedSearch('');
                  }}
                  className="amx-si-chip-remove"
                >
                  ×
                </button>
              </span>
            )}
            {appliedStatus !== 'All' && (
              <span className="amx-si-active-chip">
                Status: {appliedStatus === 'Active' ? 'Active Holds' : 'Cleared by Override'}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('All');
                    setAppliedStatus('All');
                  }}
                  className="amx-si-chip-remove"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        {/* ── Error Banner ── */}
        {loadError && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#fce8e6',
              color: '#b3261e',
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            data-testid="si-error-banner"
          >
            <span>{loadError}</span>
            <button
              type="button"
              className="amx-si-btn amx-si-btn--reset"
              onClick={loadRegister}
              data-testid="si-retry-btn"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Dual Column Layout ── */}
        <div className="amx-si-dual-col">
          {/* ── Escalation Register Table ── */}
          <div className="amx-si-table-panel">
            <div className="amx-si-table-header">
              <span className="amx-si-table-title">
                <span className="material-icons" style={{ fontSize: 18, color: '#00687a' }}>
                  list_alt
                </span>
                Checkpoint Discrepancy Ledger
              </span>
              <span className="amx-si-table-count">{totalEntries} records</span>
            </div>

            {isLoading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#45464d' }} data-testid="si-loading">
                <span className="material-icons amx-si-empty-icon" style={{ animation: 'spin 1.5s infinite linear' }}>
                  sync
                </span>
                <p>Loading checkpoint escalation register...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="amx-si-empty-state" data-testid="si-empty-state">
                <span className="material-icons amx-si-empty-icon">search_off</span>
                <p className="amx-si-empty-text">No checkpoint escalations match the current filters.</p>
                <button type="button" className="amx-si-btn amx-si-btn--reset" onClick={handleResetFilters}>
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="amx-si-table-scroll">
                <table className="amx-si-table" data-testid="si-table">
                  <thead>
                    <tr>
                      <th className="amx-si-th">Gate Pass ID</th>
                      <th className="amx-si-th">Asset / Item</th>
                      <th className="amx-si-th">Hold Status</th>
                      <th className="amx-si-th">Escalation Reason</th>
                      <th className="amx-si-th">Reported Date &amp; Officer</th>
                      <th className="amx-si-th">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const isSelected = selectedRecord?.id === item.id || selectedRecord?.passId === item.passId;
                      const statusCol = HOLD_STATUS_COLORS[item.holdStatus];
                      const isActiveHold = item.holdStatus === 'Active';

                      return (
                        <tr
                          key={item.id}
                          className={`amx-si-row${isSelected ? ' amx-si-row--selected' : ''}`}
                          onClick={() => setSelectedId(item.id)}
                          data-testid={`si-row-${item.passId}`}
                        >
                          <td className="amx-si-td">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isActiveHold && (
                                <span
                                  className="material-icons"
                                  style={{ fontSize: 16, color: '#b3261e' }}
                                  title="Active Checkpoint Hold"
                                >
                                  warning
                                </span>
                              )}
                              <span className="amx-si-incident-id">{item.passId}</span>
                            </div>
                            <div className="amx-si-incident-title">{item.passType}</div>
                          </td>
                          <td className="amx-si-td">
                            <div className="amx-si-type-cell">
                              <span style={{ fontWeight: 600, color: '#191c1e' }}>{item.assetName}</span>
                              <span style={{ fontSize: 11, color: '#76777d' }}>{item.assetId}</span>
                            </div>
                          </td>
                          <td className="amx-si-td">
                            <span
                              className="amx-si-severity-badge"
                              style={{ background: statusCol.bg, color: statusCol.text }}
                            >
                              {item.holdStatus === 'Active' ? 'ACTIVE HOLD' : 'CLEARED (OVERRIDE)'}
                            </span>
                          </td>
                          <td className="amx-si-td">
                            <div style={{ fontSize: 12, color: '#191c1e', fontWeight: 500 }}>
                              {item.escalationReason}
                            </div>
                            {item.actionRequired && (
                              <div style={{ fontSize: 11, color: '#76777d' }}>
                                Action: {item.actionRequired}
                              </div>
                            )}
                          </td>
                          <td className="amx-si-td">
                            <div className="amx-si-reported-time">
                              {item.dateDisplay} {item.timeDisplay}
                            </div>
                            <div className="amx-si-reported-by">{item.escalatedBy}</div>
                          </td>
                          <td className="amx-si-td">
                            <button
                              type="button"
                              className="amx-si-btn amx-si-btn--view"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(item.id);
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {items.length > 0 && (
              <div className="amx-si-pagination">
                <div className="amx-si-page-size">
                  <label>Rows per page:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="amx-si-filter-select amx-si-filter-select--sm"
                  >
                    {[5, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="amx-si-page-nav">
                  <span className="amx-si-page-info">
                    Page {currentPage} of {totalPages} ({totalEntries} total holds)
                  </span>
                  <button
                    type="button"
                    className="amx-si-page-btn"
                    disabled={currentPage === 1 || isLoading}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    aria-label="Previous Page"
                  >
                    <span className="material-icons">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    className="amx-si-page-btn"
                    disabled={currentPage >= totalPages || isLoading}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    aria-label="Next Page"
                  >
                    <span className="material-icons">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Escalation Details Panel (Right Pane) ── */}
          <div className="amx-si-details-panel" data-testid="si-details-panel">
            {selectedRecord ? (
              <>
                <div className="amx-si-details-header">
                  <div>
                    <div className="amx-si-details-title">Checkpoint Hold Details</div>
                    <div className="amx-si-details-id">{selectedRecord.passId}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span
                      className="amx-si-severity-badge"
                      style={{
                        background: HOLD_STATUS_COLORS[selectedRecord.holdStatus].bg,
                        color: HOLD_STATUS_COLORS[selectedRecord.holdStatus].text,
                      }}
                    >
                      {selectedRecord.holdStatus === 'Active' ? 'ACTIVE HOLD' : 'CLEARED BY OVERRIDE'}
                    </span>
                    <span
                      className="amx-si-status-badge"
                      style={{ background: '#f1f3f4', color: '#45464d' }}
                    >
                      {selectedRecord.gatePassStatus.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="amx-si-details-section">
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Asset / Item</span>
                    <span className="amx-si-detail-value" style={{ fontWeight: 600 }}>
                      {selectedRecord.assetName} ({selectedRecord.assetId})
                    </span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Requester &amp; Department</span>
                    <span className="amx-si-detail-value">
                      {selectedRecord.requesterName} · {selectedRecord.department}
                    </span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Destination</span>
                    <span className="amx-si-detail-value">{selectedRecord.destination}</span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Pass Type</span>
                    <span className="amx-si-detail-value">{selectedRecord.passType}</span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Escalated By</span>
                    <span className="amx-si-detail-value">{selectedRecord.escalatedBy}</span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Checkpoint</span>
                    <span className="amx-si-detail-value">{selectedRecord.checkpoint}</span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Escalation Timestamp</span>
                    <span className="amx-si-detail-value">
                      {selectedRecord.dateDisplay} {selectedRecord.timeDisplay}
                    </span>
                  </div>
                </div>

                {/* Escalation Reason */}
                <div className="amx-si-details-section">
                  <div className="amx-si-section-heading">Recorded Discrepancy Reason</div>
                  <p className="amx-si-description-text">{selectedRecord.escalationReason}</p>
                </div>

                {/* Action Required */}
                <div className="amx-si-details-section">
                  <div className="amx-si-section-heading">Action Required for Release</div>
                  <p className="amx-si-description-text">
                    {selectedRecord.actionRequired || 'Administrative review and physical inspection required before gate release.'}
                  </p>
                </div>

                {/* Administrative Override Details Card (if Cleared) */}
                {selectedRecord.holdStatus === 'Cleared' && selectedRecord.overrideBy && (
                  <div
                    className="amx-si-details-section"
                    style={{
                      backgroundColor: '#e6f4ea',
                      borderRadius: 8,
                      padding: 12,
                      border: '1px solid #ceead6',
                    }}
                    data-testid="si-override-section"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#1e6e38', marginBottom: 4 }}>
                      <span className="material-icons" style={{ fontSize: 18 }}>
                        verified
                      </span>
                      <span>Administrative Override Clearance</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#137333', marginBottom: 4 }}>
                      Granted by: <strong>{selectedRecord.overrideBy}</strong>
                    </div>
                    {selectedRecord.overrideNote && (
                      <p style={{ margin: 0, fontSize: 12, color: '#1e6e38', fontStyle: 'italic' }}>
                        &ldquo;{selectedRecord.overrideNote}&rdquo;
                      </p>
                    )}
                  </div>
                )}

                {/* Real GatePassHistory Timeline */}
                <div className="amx-si-details-section" data-testid="si-timeline-section">
                  <div className="amx-si-section-heading">Authoritative Gate Pass History Timeline</div>
                  <div className="amx-si-timeline">
                    {selectedRecord.timeline.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#76777d', fontStyle: 'italic' }}>
                        No history events recorded.
                      </div>
                    ) : (
                      selectedRecord.timeline.map((ev, idx) => (
                        <div
                          key={ev.id || idx}
                          className={`amx-si-timeline-item${idx === 0 ? ' amx-si-timeline-item--first' : ''}`}
                        >
                          <div className="amx-si-timeline-dot" />
                          <div className="amx-si-timeline-body">
                            <div className="amx-si-timeline-event">{ev.event}</div>
                            <div className="amx-si-timeline-meta">
                              {ev.actor} · {ev.actorRole}
                            </div>
                            <div className="amx-si-timeline-ts">{ev.timestamp}</div>
                            {ev.note && <div className="amx-si-timeline-note">{ev.note}</div>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="amx-si-empty-state">
                <span className="material-icons amx-si-empty-icon">info</span>
                <p className="amx-si-empty-text">Select an escalation hold to view details.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Compliance / Protocol Notice Banner ── */}
        <div className="amx-si-compliance-banner" data-testid="si-compliance-banner">
          <span className="material-icons amx-si-banner-icon">policy</span>
          <div className="amx-si-banner-body">
            <div className="amx-si-banner-title">Checkpoint Escalation &amp; Discrepancy Protocol</div>
            <div className="amx-si-banner-text">
              When physical serial discrepancies, tampered seals, or invalid manifest credentials are detected at
              perimeter gates, Guard personnel record an escalation hold on the Gate Pass. In accordance with SecOps
              policy, hold release and administrative override decisions are strictly restricted to authorized
              Administrators.
            </div>
          </div>
        </div>
      </div>

      {/* ── Escalate Gate Pass Drawer ── */}
      {isDrawerOpen && (
        <div
          className="amx-si-drawer-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsDrawerOpen(false);
          }}
        >
          <div className="amx-si-drawer" data-testid="si-drawer">
            <div className="amx-si-drawer-header">
              <div className="amx-si-drawer-title">
                <span className="material-icons" style={{ fontSize: 20, color: '#b3261e' }}>
                  gpp_maybe
                </span>
                Escalate Gate Pass
              </div>
              <button
                type="button"
                className="amx-si-drawer-close"
                onClick={() => setIsDrawerOpen(false)}
                disabled={isSubmitting}
                aria-label="Close drawer"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="amx-si-drawer-guard-notice">
              <span className="material-icons" style={{ fontSize: 16, color: '#00687a' }}>
                security
              </span>
              <span>
                <strong>Guard Notice:</strong> Escalating a Gate Pass engages an immediate checkpoint hold.
                Resolution and hold release require Administrative Override clearance.
              </span>
            </div>

            <div className="amx-si-drawer-body">
              {formErrors.length > 0 && (
                <div className="amx-si-form-errors">
                  <span className="material-icons" style={{ fontSize: 16, color: '#b3261e' }}>
                    error_outline
                  </span>
                  <ul>
                    {formErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pass ID Lookup */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Gate Pass Identifier <span className="amx-si-required">*</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="amx-si-form-input"
                    placeholder="e.g. GP-2026-0001"
                    value={lookupPassId}
                    onChange={(e) => setLookupPassId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookupPass()}
                    disabled={isLookingUp || isSubmitting}
                    data-testid="si-form-pass-id"
                  />
                  <button
                    type="button"
                    className="amx-si-btn amx-si-btn--apply"
                    onClick={handleLookupPass}
                    disabled={isLookingUp || !lookupPassId.trim() || isSubmitting}
                    data-testid="si-btn-lookup-pass"
                  >
                    {isLookingUp ? 'Verifying...' : 'Verify Pass'}
                  </button>
                </div>
                {lookupError && (
                  <div style={{ color: '#b3261e', fontSize: 12, marginTop: 4 }} data-testid="si-lookup-error">
                    {lookupError}
                  </div>
                )}
              </div>

              {/* Live Gate Pass Details Summary */}
              {loadedPass && (
                <div
                  style={{
                    backgroundColor: '#f2f4f6',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    border: '1px solid #c6c6cd',
                    fontSize: 12,
                  }}
                  data-testid="si-loaded-pass-card"
                >
                  <div style={{ fontWeight: 700, color: '#00687a', marginBottom: 4 }}>
                    {loadedPass.pass_id} — {loadedPass.asset_or_item}
                  </div>
                  <div style={{ color: '#45464d' }}>
                    Requester: <strong>{loadedPass.requester_name}</strong> ({loadedPass.department})
                  </div>
                  <div style={{ color: '#45464d' }}>
                    Destination: {loadedPass.destination} · Pass Type: {loadedPass.pass_type}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Status:{' '}
                    <span
                      style={{
                        fontWeight: 700,
                        color: loadedPass.status === 'Approved' ? '#00687a' : '#1e6e38',
                      }}
                    >
                      {loadedPass.status}
                    </span>
                  </div>
                </div>
              )}

              {/* Escalation Reason */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Escalation Discrepancy Reason <span className="amx-si-required">*</span>
                </label>
                <textarea
                  className="amx-si-form-textarea"
                  placeholder="Describe the discrepancy observed (e.g. Serial number tag mismatch, unverified carrier, damaged seal)..."
                  rows={4}
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  disabled={!loadedPass || (loadedPass.status !== 'Pending' && loadedPass.status !== 'Approved') || isSubmitting}
                  data-testid="si-form-reason"
                />
              </div>

              {/* Action Required */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Action Required <span className="amx-si-optional">(optional)</span>
                </label>
                <input
                  type="text"
                  className="amx-si-form-input"
                  placeholder="e.g. Physical serial re-check by SecOps Administrator"
                  value={actionRequired}
                  onChange={(e) => setActionRequired(e.target.value)}
                  disabled={!loadedPass || (loadedPass.status !== 'Pending' && loadedPass.status !== 'Approved') || isSubmitting}
                  data-testid="si-form-action-required"
                />
              </div>
            </div>

            <div className="amx-si-drawer-footer">
              <button
                type="button"
                className="amx-si-btn amx-si-btn--cancel"
                onClick={() => setIsDrawerOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="amx-si-btn amx-si-btn--submit"
                onClick={handleSubmitEscalation}
                disabled={!loadedPass || (loadedPass.status !== 'Pending' && loadedPass.status !== 'Approved') || !escalationReason.trim() || isSubmitting}
                data-testid="si-btn-submit"
              >
                <span className="material-icons" style={{ fontSize: 16 }}>
                  warning
                </span>
                {isSubmitting ? 'Submitting Hold...' : 'Confirm Checkpoint Hold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global Toast ── */}
      {toastMessage && (
        <div className="amx-si-toast" data-testid="si-toast">
          <span className="material-icons" style={{ fontSize: 16 }}>
            check_circle
          </span>
          {toastMessage}
        </div>
      )}
    </DashboardLayout>
  );
};

export default GuardSecurityIncidentsPage;
