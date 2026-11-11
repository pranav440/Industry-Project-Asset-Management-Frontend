import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import type {
  GuardMovementLogRecord,
  GuardLogsKpis,
} from '../data/guardLogsData';
import {
  fetchGuardMovementLogs,
  fetchAllGuardMovementLogsForExport,
} from '../api/guardLogsApi';
import './GuardEntryExitLogs.css';

interface GuardEntryExitLogsPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

export const GuardEntryExitLogsPage: React.FC<GuardEntryExitLogsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Master record state backed by live API
  const [logs, setLogs] = useState<GuardMovementLogRecord[]>([]);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [kpis, setKpis] = useState<GuardLogsKpis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Selected record for Movement Audit Details drawer
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);

  // Filter criteria inputs
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<'All' | 'Movements' | 'Inward' | 'Outward'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Cleared' | 'Pending' | 'Flagged'>('All');

  // Applied filter state (applied when user clicks Apply or resets)
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [appliedFromDate, setAppliedFromDate] = useState<string>('');
  const [appliedToDate, setAppliedToDate] = useState<string>('');
  const [appliedDirection, setAppliedDirection] = useState<'All' | 'Movements' | 'Inward' | 'Outward'>('All');
  const [appliedStatus, setAppliedStatus] = useState<'All' | 'Cleared' | 'Pending' | 'Flagged'>('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal / Toast states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [showPrintSlipModal, setShowPrintSlipModal] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // Fetch live movement logs from backend API
  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchGuardMovementLogs({
        search: appliedSearch,
        fromDate: appliedFromDate,
        toDate: appliedToDate,
        direction: appliedDirection,
        status: appliedStatus,
        page: currentPage,
        pageSize: pageSize,
      });
      setLogs(res.items);
      setTotalEntries(res.total);
      setTotalPages(res.totalPages);
      setKpis(res.kpis);
      if (res.items.length > 0) {
        setSelectedRecordId((prev) => {
          if (prev && res.items.some((r) => r.id === prev || r.passId === prev)) {
            return prev;
          }
          return res.items[0].id;
        });
      } else {
        setSelectedRecordId('');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load physical movement logs.');
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, appliedFromDate, appliedToDate, appliedDirection, appliedStatus, currentPage, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Synchronize applied filters
  const handleApplyFilters = () => {
    setAppliedSearch(searchQuery);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setAppliedDirection(directionFilter);
    setAppliedStatus(statusFilter);
    setCurrentPage(1);
    showToast('Filters applied to movement ledger');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setDirectionFilter('All');
    setStatusFilter('All');

    setAppliedSearch('');
    setAppliedFromDate('');
    setAppliedToDate('');
    setAppliedDirection('All');
    setAppliedStatus('All');
    setCurrentPage(1);
    showToast('Filters reset to show all records');
  };

  // Keyboard shortcut Ctrl+E for Export
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportCsv();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appliedSearch, appliedFromDate, appliedToDate, appliedDirection, appliedStatus, logs]);

  // Selected record object
  const selectedRecord = useMemo(() => {
    if (!logs.length) return null;
    return (
      logs.find((r) => r.id === selectedRecordId || r.passId === selectedRecordId) ||
      logs[0]
    );
  }, [logs, selectedRecordId]);

  // Summary KPI counts from backend or derived
  const kpiCounts = useMemo(() => {
    if (kpis) {
      return {
        totalMovements: kpis.totalMovements.total,
        inboundEntries: kpis.inboundEntries.total,
        outboundExits: kpis.outboundExits.total,
        flaggedMovements: kpis.flaggedMovements.total,
      };
    }
    return {
      totalMovements: totalEntries,
      inboundEntries: logs.filter((l) => l.direction === 'Inward' && l.status !== 'Flagged').length,
      outboundExits: logs.filter((l) => l.direction === 'Outward' && l.status !== 'Flagged').length,
      flaggedMovements: logs.filter((l) => l.status === 'Flagged').length,
    };
  }, [kpis, totalEntries, logs]);

  // Handle Export CSV (explicit semantics: complete multi-page export of all matching records under active filters)
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      showToast('Fetching all matching ledger records for export...');
      const exportItems = await fetchAllGuardMovementLogsForExport({
        search: appliedSearch,
        fromDate: appliedFromDate,
        toDate: appliedToDate,
        direction: appliedDirection,
        status: appliedStatus,
      }, (loaded, total) => {
        if (total > 100) {
          showToast(`Exporting records: ${loaded} of ${total} loaded...`);
        }
      });

      if (exportItems.length === 0) {
        showToast('No records match the active filter criteria to export');
        return;
      }

      const headers = [
        'Log ID',
        'Gate Pass ID',
        'Asset ID',
        'Asset Name',
        'Serial Number',
        'Event Category',
        'Movement Direction',
        'Action Label',
        'Requester Name',
        'Requester Badge',
        'Department',
        'Date',
        'Time UTC',
        'Verification Status',
        'Verifying Guard',
        'Guard Badge',
        'Checkpoint Node',
        'Approving Admin',
        'Custodian',
        'Carrier / Vehicle',
        'Manifest Reference',
        'Tamper Seal ID',
        'Inspected Qty',
        'Expected Qty',
        'Has Discrepancy',
        'Discrepancy Details',
        'Guard Remarks',
      ];

      const rows = exportItems.map((item) => [
        item.id,
        item.passId,
        item.assetId,
        `"${item.assetName.replace(/"/g, '""')}"`,
        item.serialNumber,
        item.category || (item.direction === 'Inward' || item.direction === 'Outward' ? 'Physical Movement' : 'Administrative'),
        item.direction,
        `"${item.directionLabel.replace(/"/g, '""')}"`,
        `"${item.requesterName.replace(/"/g, '""')}"`,
        item.requesterBadge,
        `"${item.department.replace(/"/g, '""')}"`,
        item.date,
        item.timeDisplay,
        item.status,
        `"${item.guardName.replace(/"/g, '""')}"`,
        item.guardBadge,
        `"${item.checkpoint.replace(/"/g, '""')}"`,
        `"${item.approvingAdmin.replace(/"/g, '""')}"`,
        `"${item.custodian.replace(/"/g, '""')}"`,
        `"${item.carrierVehicle.replace(/"/g, '""')}"`,
        item.manifestHash,
        item.tamperSealId,
        item.inspectedQty,
        item.expectedQty,
        item.hasDiscrepancy ? 'YES' : 'NO',
        `"${item.discrepancyDetails.replace(/"/g, '""')}"`,
        `"${item.guardRemarks.replace(/"/g, '""')}"`,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const dateStamp = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `AssetMX_Guard_Movement_Logs_Filtered_${dateStamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Exported all ${exportItems.length} matching audit records to CSV`);
    } catch (err: any) {
      showToast('Export failed: ' + (err?.message || 'Server error'));
    } finally {
      setIsExporting(false);
    }
  };

  // Row selection handler
  const handleSelectRecord = (record: GuardMovementLogRecord) => {
    setSelectedRecordId(record.id);
    setIsDrawerOpen(true);
  };

  return (
    <DashboardLayout
      currentNav="Entry / Exit Logs"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="amx-logs-container" data-testid="guard-logs-screen">
        {/* Page Header & Metadata Ribbon */}
        <header className="amx-logs-header-section">
          <div className="amx-logs-header-left">
            <nav className="amx-logs-breadcrumbs" aria-label="Breadcrumb">
              <span
                className="amx-logs-crumb-link"
                onClick={() => onNavigate?.('dashboard')}
              >
                CHECKPOINT
              </span>
              <span className="amx-logs-crumb-sep">/</span>
              <span className="amx-logs-crumb-current">ENTRY / EXIT LOGS</span>
            </nav>
            <h1 className="amx-logs-headline">Physical Movement Ledger</h1>
            <p className="amx-logs-subtitle">
              Immutable physical checkpoint audit trail recording asset ingress, egress,
              and tamper seal verifications across all active perimeter nodes.
            </p>
          </div>

          <div className="amx-logs-header-actions">
            {/* Station Checkpoint Pill */}
            <div className="amx-logs-node-pill" title="Station Console">
              <span className="amx-logs-live-ping">
                <span className="amx-logs-ping-anim"></span>
                <span className="amx-logs-ping-dot"></span>
              </span>
              <div>
                <span className="amx-logs-pill-label">Checkpoint</span>
                <div className="amx-logs-pill-val">Gate Verification Console</div>
              </div>
            </div>

            {/* Station Role Pill */}
            <div className="amx-logs-shift-pill" title="Duty Station">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: '#00687a' }}
              >
                verified_user
              </span>
              <div>
                <span className="amx-logs-pill-label">Duty Station</span>
                <div className="amx-logs-pill-val">Guard Audit Ledger</div>
              </div>
            </div>

            {/* Export CSV Action */}
            <div className="amx-logs-export-group">
              <button
                type="button"
                className="amx-logs-btn-export"
                onClick={handleExportCsv}
                disabled={isExporting}
                aria-label="Export Filtered Ledger to CSV"
                data-testid="guard-logs-export-btn"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16 }}
                >
                  download
                </span>
                <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
              </button>
              <span className="amx-logs-export-hint">[Ctrl + E] Filtered Ledger</span>
            </div>
          </div>
        </header>

        {/* Error Banner with Retry */}
        {loadError && (
          <div className="amx-logs-error-banner" role="alert" data-testid="guard-logs-error-banner">
            <div className="amx-logs-error-content">
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#ba1a1a' }}>
                error
              </span>
              <div>
                <strong>Unable to retrieve movement logs:</strong> {loadError}
              </div>
            </div>
            <button
              type="button"
              className="amx-logs-btn-retry"
              onClick={loadLogs}
              data-testid="guard-logs-retry-btn"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                refresh
              </span>
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 4 KPI Summary Cards */}
        <section
          className="amx-logs-kpi-grid"
          aria-label="Movement KPI Summaries"
          data-testid="guard-logs-kpis"
        >
          {/* Total Movements */}
          <div className="amx-logs-kpi-card">
            <div className="amx-logs-kpi-top">
              <span className="amx-logs-kpi-title">Total Movements</span>
              <span className="amx-logs-kpi-badge">
                {appliedFromDate && appliedToDate
                  ? `${appliedFromDate} – ${appliedToDate}`
                  : 'All Records'}
              </span>
            </div>
            <div className="amx-logs-kpi-val-row">
              <span className="amx-logs-kpi-number">{kpiCounts.totalMovements}</span>
              <span className="amx-logs-kpi-unit">transits</span>
            </div>
            <p className="amx-logs-kpi-subtext">
              <span className="amx-logs-kpi-dot"></span>
              Across verified perimeter checkpoints
            </p>
          </div>

          {/* Inbound Entries */}
          <div className="amx-logs-kpi-card">
            <div className="amx-logs-kpi-top">
              <span className="amx-logs-kpi-title">Inbound Entries</span>
              <div className="amx-logs-kpi-icon-box">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  south_west
                </span>
              </div>
            </div>
            <div className="amx-logs-kpi-val-row">
              <span className="amx-logs-kpi-number">{kpiCounts.inboundEntries}</span>
              <span className="amx-logs-kpi-unit">verified</span>
            </div>
            <p className="amx-logs-kpi-subtext">
              <span className="amx-logs-kpi-dot"></span>
              Dock receiving &amp; internal intake
            </p>
          </div>

          {/* Outbound Exits */}
          <div className="amx-logs-kpi-card">
            <div className="amx-logs-kpi-top">
              <span className="amx-logs-kpi-title">Outbound Exits</span>
              <div className="amx-logs-kpi-icon-box">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  north_east
                </span>
              </div>
            </div>
            <div className="amx-logs-kpi-val-row">
              <span className="amx-logs-kpi-number">{kpiCounts.outboundExits}</span>
              <span className="amx-logs-kpi-unit">dispatched</span>
            </div>
            <p className="amx-logs-kpi-subtext">
              <span className="amx-logs-kpi-dot gray"></span>
              Field transit &amp; authorized dispatches
            </p>
          </div>

          {/* Flagged Movements */}
          <div className="amx-logs-kpi-card flagged">
            <div className="amx-logs-kpi-top">
              <span className="amx-logs-kpi-title error">Flagged Movements</span>
              <span className="amx-logs-kpi-badge error">Audit Hold</span>
            </div>
            <div className="amx-logs-kpi-val-row">
              <span className="amx-logs-kpi-number error">
                {String(kpiCounts.flaggedMovements).padStart(2, '0')}
              </span>
              <span className="amx-logs-kpi-unit">flagged records</span>
            </div>
            <p className="amx-logs-kpi-subtext error">
              <span className="amx-logs-kpi-dot error"></span>
              Movement records with discrepancies or holds
            </p>
          </div>
        </section>

        {/* Filter Toolbar Card */}
        <section
          className="amx-logs-filter-card"
          aria-label="Movement Filter Toolbar"
          data-testid="guard-logs-filter-toolbar"
        >
          <div className="amx-logs-filter-grid">
            {/* Search Input */}
            <div className="amx-logs-filter-col-search">
              <span className="material-symbols-outlined amx-logs-search-icon">
                search
              </span>
              <input
                type="text"
                className="amx-logs-search-input"
                placeholder="Search Gate Pass ID, Asset ID, Requester, Carrier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyFilters();
                }}
                aria-label="Search Gate Pass ID, Asset ID, Requester, Carrier"
                data-testid="guard-logs-search-input"
              />
            </div>

            {/* From - To Date Range */}
            <div className="amx-logs-filter-col-date">
              <div className="amx-logs-date-box">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16, color: '#76777d' }}
                >
                  date_range
                </span>
                <input
                  type="date"
                  className="amx-logs-date-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  aria-label="From Date"
                  title="From Date"
                  data-testid="guard-logs-from-date"
                />
                <span style={{ color: '#76777d' }}>–</span>
                <input
                  type="date"
                  className="amx-logs-date-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  aria-label="To Date"
                  title="To Date"
                  data-testid="guard-logs-to-date"
                />
              </div>
            </div>

            {/* Movement Direction Select */}
            <div className="amx-logs-filter-col-select">
              <select
                data-testid="filter-direction"
                className="amx-logs-select"
                value={directionFilter}
                onChange={(e) =>
                  setDirectionFilter(e.target.value as 'All' | 'Movements' | 'Inward' | 'Outward')
                }
                aria-label="Filter by Movement Direction"
              >
                <option value="All">All Categories</option>
                <option value="Movements">Physical Movements Only</option>
                <option value="Inward">Inward / Entry</option>
                <option value="Outward">Outward / Exit</option>
              </select>
            </div>

            {/* Status Select */}
            <div className="amx-logs-filter-col-select">
              <select
                data-testid="filter-status"
                className="amx-logs-select"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'All' | 'Cleared' | 'Pending' | 'Flagged'
                  )
                }
                aria-label="Filter by Verification Status"
              >
                <option value="All">Status: All Statuses</option>
                <option value="Cleared">Cleared</option>
                <option value="Pending">Pending</option>
                <option value="Flagged">Flagged</option>
              </select>
            </div>

            {/* Apply & Reset Buttons */}
            <div className="amx-logs-filter-col-actions">
              <button
                type="button"
                className="amx-logs-btn-apply"
                onClick={handleApplyFilters}
                data-testid="guard-logs-apply-btn"
              >
                Apply Filter
              </button>
              <button
                type="button"
                className="amx-logs-btn-reset"
                onClick={handleResetFilters}
                data-testid="guard-logs-reset-btn"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Active Filter Scope Indicators */}
          <div className="amx-logs-active-scope-row">
            <div className="amx-logs-active-pills">
              <span className="amx-logs-active-label">Active Filters:</span>
              {appliedFromDate && appliedToDate && (
                <div className="amx-logs-scope-pill highlight">
                  <span>Date: {appliedFromDate} to {appliedToDate}</span>
                  <span
                    className="amx-logs-pill-remove"
                    onClick={() => {
                      setFromDate('');
                      setToDate('');
                      setAppliedFromDate('');
                      setAppliedToDate('');
                    }}
                    title="Reset date filter"
                  >
                    ×
                  </span>
                </div>
              )}

              {appliedDirection !== 'All' && (
                <div className="amx-logs-scope-pill">
                  <span>Direction: {appliedDirection}</span>
                  <span
                    className="amx-logs-pill-remove"
                    onClick={() => {
                      setDirectionFilter('All');
                      setAppliedDirection('All');
                    }}
                    title="Remove direction filter"
                  >
                    ×
                  </span>
                </div>
              )}

              {appliedStatus !== 'All' && (
                <div className="amx-logs-scope-pill">
                  <span>Status: {appliedStatus}</span>
                  <span
                    className="amx-logs-pill-remove"
                    onClick={() => {
                      setStatusFilter('All');
                      setAppliedStatus('All');
                    }}
                    title="Remove status filter"
                  >
                    ×
                  </span>
                </div>
              )}

              {appliedSearch && (
                <div className="amx-logs-scope-pill">
                  <span>Search: &ldquo;{appliedSearch}&rdquo;</span>
                  <span
                    className="amx-logs-pill-remove"
                    onClick={() => {
                      setSearchQuery('');
                      setAppliedSearch('');
                    }}
                    title="Remove search query"
                  >
                    ×
                  </span>
                </div>
              )}

              {!appliedFromDate && !appliedToDate && appliedDirection === 'All' && appliedStatus === 'All' && !appliedSearch && (
                <span style={{ fontSize: 12, color: '#76777d' }}>None (showing full ledger)</span>
              )}
            </div>

            <div className="amx-logs-synced-status">
              SERVER-AUTHENTICATED AUDIT LEDGER
            </div>
          </div>
        </section>

        {/* Main Workspace (12-Column Split: 7fr Table + 5fr Drawer) */}
        <main
          className="amx-logs-workspace"
          data-testid="guard-logs-workspace"
        >
          {/* Left Side: Real-Time Movement Log Ledger */}
          <section className="amx-logs-ledger-card">
            <div className="amx-logs-ledger-header">
              <div className="amx-logs-ledger-title-group">
                <h2 className="amx-logs-ledger-title">
                  Real-Time Movement Log Ledger
                </h2>
                <span
                  className="amx-logs-status-badge cleared"
                  style={{ fontSize: 11 }}
                >
                  {totalEntries} Records
                </span>
              </div>
              <div className="amx-logs-auto-refresh">
                <span className="amx-logs-refresh-dot"></span>
                <span>Authoritative Checkpoint Log</span>
              </div>
            </div>

            <div className="amx-logs-table-wrapper">
              <table
                className="amx-logs-table"
                aria-label="Physical Movement Log Records"
              >
                <thead>
                  <tr>
                    <th>Gate Pass ID</th>
                    <th>Asset ID / Name</th>
                    <th>Movement</th>
                    <th>Requester</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Guard / Station</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px' }}>
                        <div className="amx-logs-loading-state" data-testid="guard-logs-loading">
                          <div className="amx-logs-spinner"></div>
                          <span>Loading physical checkpoint movement logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px' }}>
                        <div style={{ color: '#45464d', marginBottom: 8 }} data-testid="guard-logs-empty-state">
                          No movement logs match the selected filter criteria.
                        </div>
                        <button
                          type="button"
                          className="amx-logs-btn-apply"
                          style={{ maxWidth: 160, margin: '0 auto' }}
                          onClick={handleResetFilters}
                        >
                          Clear Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    logs.map((record) => {
                      const isSelected = selectedRecord?.id === record.id;
                      const isFlagged = record.status === 'Flagged';

                      return (
                        <tr
                          key={record.id}
                          className={`${isSelected ? 'selected' : ''} ${
                            isFlagged ? 'flagged-row' : ''
                          }`}
                          onClick={() => handleSelectRecord(record)}
                          data-testid={`log-row-${record.passId}`}
                        >
                          {/* Gate Pass ID */}
                          <td>
                            <div className="amx-logs-pass-cell">
                              {isFlagged && (
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 16, color: '#ba1a1a' }}
                                  title="Flagged Checkpoint Discrepancy"
                                >
                                  warning
                                </span>
                              )}
                              <span
                                className={`amx-logs-pass-id ${
                                  isSelected ? 'selected' : ''
                                } ${isFlagged ? 'flagged' : ''}`}
                              >
                                {record.passId}
                              </span>
                            </div>
                          </td>

                          {/* Asset ID & Name */}
                          <td>
                            <div className="amx-logs-asset-box">
                              <span
                                className="amx-logs-asset-name"
                                title={record.assetName}
                              >
                                {record.assetName}
                              </span>
                              <span
                                className={`amx-logs-asset-sub ${
                                  isFlagged ? 'error' : ''
                                }`}
                              >
                                {record.assetId} • {record.serialNumber}
                              </span>
                            </div>
                          </td>

                          {/* Movement Direction */}
                          <td>
                            {record.category === 'Security Escalation' ? (
                              <span
                                className="amx-logs-dir-pill"
                                style={{
                                  background: 'rgba(186, 26, 26, 0.12)',
                                  color: '#ba1a1a',
                                  borderColor: 'rgba(186, 26, 26, 0.3)',
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 13 }}
                                >
                                  warning
                                </span>
                                <span>ESCALATION</span>
                              </span>
                            ) : record.category === 'Administrative' ? (
                              <span
                                className="amx-logs-dir-pill"
                                style={{
                                  background: '#edf0f8',
                                  color: '#45464d',
                                  borderColor: '#c6c6cd',
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 13 }}
                                >
                                  manage_accounts
                                </span>
                                <span>ADMIN</span>
                              </span>
                            ) : (
                              <span
                                className={`amx-logs-dir-pill ${
                                  record.direction === 'Inward' ? 'inbound' : ''
                                }`}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 13 }}
                                >
                                  {record.direction === 'Outward'
                                    ? 'arrow_outward'
                                    : 'arrow_downward'}
                                </span>
                                <span>{record.direction.toUpperCase()}</span>
                              </span>
                            )}
                          </td>

                          {/* Requester */}
                          <td>
                            <div className="amx-logs-person-box">
                              <span className="amx-logs-person-name">
                                {record.requesterName}
                              </span>
                              <span className="amx-logs-person-sub">
                                {record.requesterBadge}
                              </span>
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td>
                            <div className="amx-logs-date-box-col">
                              <span>{record.dateDisplay}</span>
                              <span style={{ color: '#76777d' }}>
                                {record.timeDisplay}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td>
                            <span
                              className={`amx-logs-status-badge ${record.status.toLowerCase()}`}
                            >
                              {record.status === 'Cleared' && (
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 13 }}
                                >
                                  check_circle
                                </span>
                              )}
                              {record.status === 'Flagged' && (
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 13 }}
                                >
                                  report_problem
                                </span>
                              )}
                              {record.status === 'Pending' && (
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 13 }}
                                >
                                  hourglass_top
                                </span>
                              )}
                              <span>{record.status.toUpperCase()}</span>
                            </span>
                          </td>

                          {/* Guard & Station */}
                          <td>
                            <div className="amx-logs-guard-box">
                              <span>{record.guardName}</span>
                              <span style={{ color: '#76777d', fontSize: 11 }}>
                                {record.checkpoint}
                              </span>
                            </div>
                          </td>

                          {/* Action Button */}
                          <td>
                            <button
                              type="button"
                              className={`amx-logs-btn-details ${
                                isSelected
                                  ? 'active'
                                  : isFlagged
                                  ? 'flagged'
                                  : 'inactive'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRecord(record);
                              }}
                              aria-label={`View audit details for ${record.passId}`}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <footer className="amx-logs-pagination-footer">
              <div className="amx-logs-pagination-left">
                <span>
                  Showing{' '}
                  {totalEntries > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                  {Math.min(currentPage * pageSize, totalEntries)} of{' '}
                  {totalEntries} entries
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Show</span>
                  <select
                    className="amx-logs-select-per-page"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    aria-label="Rows per page"
                    data-testid="guard-logs-page-size"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>per page</span>
                </label>
              </div>

              <div className="amx-logs-pagination-controls">
                <button
                  type="button"
                  className="amx-logs-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isLoading}
                  aria-label="Previous Page"
                  data-testid="guard-logs-prev-btn"
                >
                  Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`amx-logs-page-btn ${
                      currentPage === page ? 'active' : ''
                    }`}
                    onClick={() => setCurrentPage(page)}
                    disabled={isLoading}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  className="amx-logs-page-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isLoading}
                  aria-label="Next Page"
                  data-testid="guard-logs-next-btn"
                >
                  Next
                </button>
              </div>
            </footer>
          </section>

          {/* Right Side: Movement Audit Details Side Panel */}
          {isDrawerOpen && selectedRecord && (
            <aside
              className="amx-logs-drawer-card"
              aria-label="Movement Audit Details Panel"
              data-testid="guard-logs-audit-drawer"
            >
              <div className="amx-logs-drawer-header">
                <div className="amx-logs-drawer-title-group">
                  <div className="amx-logs-drawer-title-row">
                    <h3 className="amx-logs-drawer-title">
                      {selectedRecord.passId}
                    </h3>
                  </div>
                  <div className="amx-logs-drawer-pills">
                    <span
                      className={`amx-logs-status-badge ${selectedRecord.status.toLowerCase()}`}
                    >
                      {selectedRecord.status.toUpperCase()}
                    </span>
                    {selectedRecord.direction !== 'N/A' ? (
                      <span
                        className={`amx-logs-dir-pill ${
                          selectedRecord.direction === 'Inward' ? 'inbound' : ''
                        }`}
                      >
                        {selectedRecord.direction.toUpperCase()}
                      </span>
                    ) : (
                      <span
                        className="amx-logs-dir-pill"
                        style={{
                          background:
                            selectedRecord.category === 'Security Escalation'
                              ? 'rgba(186, 26, 26, 0.12)'
                              : '#edf0f8',
                          color:
                            selectedRecord.category === 'Security Escalation'
                              ? '#ba1a1a'
                              : '#45464d',
                        }}
                      >
                        {(selectedRecord.category || 'Administrative').toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="amx-logs-drawer-close"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close Audit Details Drawer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    close
                  </span>
                </button>
              </div>

              <div className="amx-logs-drawer-body">
                {/* Header Info & Manifest Specifications Box */}
                <div className="amx-logs-identity-box">
                  <div className="amx-logs-hash-row">
                    <span style={{ color: '#45464d' }}>EVENT CLASSIFICATION</span>
                    <span className="amx-logs-hash-val">
                      {selectedRecord.category || 'Physical Movement'} ({selectedRecord.directionLabel})
                    </span>
                  </div>
                  <div className="amx-logs-hash-row" style={{ marginTop: 4 }}>
                    <span style={{ color: '#45464d' }}>MANIFEST REFERENCE</span>
                    <span className="amx-logs-hash-val" style={{ fontSize: 11 }}>
                      Standard Manifest (No Hash Stored)
                    </span>
                  </div>

                  <div className="amx-logs-meta-fields-grid">
                    <div>
                      <span className="amx-logs-meta-label">
                        {selectedRecord.direction === 'Outward'
                          ? 'Actual Exit Time'
                          : selectedRecord.direction === 'Inward'
                          ? 'Actual Entry Time'
                          : 'Recorded Event Time'}
                      </span>
                      <span className="amx-logs-meta-val">
                        {selectedRecord.dateDisplay}
                      </span>
                      <span className="amx-logs-meta-sub">
                        {selectedRecord.timeDisplay}
                      </span>
                    </div>

                    <div>
                      <span className="amx-logs-meta-label">Checkpoint Node</span>
                      <span className="amx-logs-meta-val">
                        {selectedRecord.checkpointFull}
                      </span>
                    </div>

                    <div>
                      <span className="amx-logs-meta-label">Verifying Officer</span>
                      <span className="amx-logs-meta-val">
                        {selectedRecord.guardName}
                      </span>
                      <span className="amx-logs-meta-sub">
                        Badge #{selectedRecord.guardBadge}
                      </span>
                    </div>

                    <div>
                      <span className="amx-logs-meta-label">Approving Admin</span>
                      <span className="amx-logs-meta-val">
                        {selectedRecord.approvingAdmin}
                      </span>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <span className="amx-logs-meta-label">Designated Custodian</span>
                      <span className="amx-logs-meta-val">
                        {selectedRecord.custodian}
                      </span>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <span className="amx-logs-meta-label">Carrier &amp; Destination</span>
                      <span className="amx-logs-meta-val">
                        {selectedRecord.carrierVehicle}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Discrepancy Status Banner */}
                {selectedRecord.hasDiscrepancy ? (
                  <div className="amx-logs-discrepancy-banner flagged">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 20, color: '#ba1a1a', flexShrink: 0 }}
                    >
                      error
                    </span>
                    <div>
                      <div className="amx-logs-discrepancy-title">
                        <span>DISCREPANCY ALERT:</span>
                        <span className="amx-logs-discrepancy-status flagged">
                          {selectedRecord.discrepancyStatusTitle}
                        </span>
                      </div>
                      <p className="amx-logs-discrepancy-desc">
                        {selectedRecord.discrepancyDetails}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="amx-logs-discrepancy-banner">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 20, color: '#00687a', flexShrink: 0 }}
                    >
                      verified
                    </span>
                    <div>
                      <div className="amx-logs-discrepancy-title">
                        <span>CHECKPOINT CLEARANCE:</span>
                        <span className="amx-logs-discrepancy-status">
                          CLEARED &amp; PASSING
                        </span>
                      </div>
                      <p className="amx-logs-discrepancy-desc">
                        Physical verification completed and logged at perimeter checkpoint.
                      </p>
                    </div>
                  </div>
                )}

                {/* Physical Asset Verification Box */}
                <div>
                  <div className="amx-logs-section-title-row">
                    <h4 className="amx-logs-section-title">
                      Physical Asset Verification
                    </h4>
                    <span
                      className="amx-logs-barcode-pill"
                      title={
                        selectedRecord.serialNumber !== 'Unavailable'
                          ? 'Authoritative Serial Recorded'
                          : 'Serial Not Available'
                      }
                      style={{
                        opacity: selectedRecord.serialNumber !== 'Unavailable' ? 1 : 0.65,
                      }}
                    >
                      {selectedRecord.serialNumber !== 'Unavailable'
                        ? 'SERIAL RECORDED'
                        : 'SERIAL PENDING'}
                    </span>
                  </div>

                  <div className="amx-logs-asset-spec-card" style={{ marginTop: 8 }}>
                    <div className="amx-logs-asset-top-row">
                      <div className="amx-logs-asset-id-info">
                        <div className="amx-logs-asset-icon-box">
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 24 }}
                          >
                            inventory_2
                          </span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#191c1e' }}>
                            {selectedRecord.assetName}
                          </div>
                          <div
                            style={{
                              fontFamily: 'JetBrains Mono',
                              fontSize: 12,
                              color: '#45464d',
                            }}
                          >
                            {selectedRecord.assetId}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="amx-logs-asset-fields-grid">
                      <div>
                        <span className="amx-logs-meta-label">Serial Number</span>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono',
                            fontSize: 12,
                            fontWeight: 600,
                            color: selectedRecord.hasDiscrepancy ? '#ba1a1a' : '#191c1e',
                          }}
                        >
                          {selectedRecord.serialNumber}
                        </span>
                      </div>

                      <div>
                        <span className="amx-logs-meta-label">Tamper Seal ID</span>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#191c1e',
                          }}
                        >
                          {selectedRecord.tamperSealId}
                        </span>
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <span className="amx-logs-meta-label">Quantity Verification</span>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#00687a',
                          }}
                        >
                          {selectedRecord.inspectedQty} / {selectedRecord.expectedQty} Units (
                          {selectedRecord.inspectedQty === selectedRecord.expectedQty
                            ? '100% Match'
                            : 'Quantity Discrepancy'}
                          )
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gate Clearance Checklist */}
                <div>
                  <h4 className="amx-logs-section-title">
                    Perimeter Inspection Checklist
                  </h4>
                  {selectedRecord.checklist.length > 0 ? (
                    <div className="amx-logs-checklist-box" style={{ marginTop: 8 }}>
                      {selectedRecord.checklist.map((item, idx) => (
                        <div key={idx} className="amx-logs-checklist-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: 16,
                                color: item.verified ? '#00687a' : '#ba1a1a',
                              }}
                            >
                              {item.verified ? 'check_box' : 'indeterminate_check_box'}
                            </span>
                            <span>{item.title}</span>
                          </div>
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono',
                              fontSize: 11,
                              fontWeight: 700,
                              color: item.verified ? '#00687a' : '#ba1a1a',
                            }}
                          >
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="amx-logs-checklist-box"
                      style={{
                        marginTop: 8,
                        padding: 12,
                        backgroundColor: '#f2f4f6',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#45464d',
                        border: '1px solid #c6c6cd',
                      }}
                      data-testid="guard-logs-checklist-notice"
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 600,
                          color: '#191c1e',
                          marginBottom: 4,
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 16, color: '#00687a' }}
                        >
                          info
                        </span>
                        <span>Inspection Checklist Status</span>
                      </div>
                      <p style={{ margin: 0 }}>
                        Individual physical inspection checklist tick-boxes are not persisted in backend audit logs. Clearance validity is established via authoritative gate verification sign-off.
                      </p>
                    </div>
                  )}
                </div>

                {/* Guard Remarks */}
                <div>
                  <h4 className="amx-logs-section-title">Guard Remarks &amp; Notes</h4>
                  <div className="amx-logs-remarks-card" style={{ marginTop: 8 }}>
                    <div>&ldquo;{selectedRecord.guardRemarks}&rdquo;</div>
                    <div className="amx-logs-remarks-author">
                      Recorded by: {selectedRecord.guardName} ({selectedRecord.guardBadge})
                    </div>
                  </div>
                </div>

                {/* Station Timeline */}
                <div>
                  <h4 className="amx-logs-section-title">Station Timeline</h4>
                  <div className="amx-logs-timeline-list" style={{ marginTop: 12 }}>
                    {selectedRecord.timeline.length === 0 ? (
                      <div style={{ color: '#76777d', fontSize: 12, fontStyle: 'italic' }}>
                        No preceding station events recorded.
                      </div>
                    ) : (
                      selectedRecord.timeline.map((evt, idx) => (
                        <div key={idx} className="amx-logs-timeline-node">
                          <span
                            className={`amx-logs-timeline-dot ${
                              evt.completed ? '' : 'gray'
                            }`}
                          ></span>
                          <div style={{ fontWeight: 600, color: '#191c1e' }}>
                            {evt.title}
                          </div>
                          <div style={{ color: '#45464d', fontSize: 11 }}>
                            {evt.time} — {evt.desc}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="amx-logs-drawer-footer">
                <button
                  type="button"
                  className="amx-logs-btn-print"
                  onClick={() => setShowPrintSlipModal(true)}
                  aria-label="Print Manifest Slip"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    print
                  </span>
                  <span>Print Manifest Slip</span>
                </button>

                <button
                  type="button"
                  className="amx-logs-btn-verify-hash"
                  onClick={() => setShowVerifyModal(true)}
                  aria-label="View Audit Record Details"
                  data-testid="btn-audit-details"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    receipt_long
                  </span>
                  <span>Audit Record Details</span>
                </button>
              </div>
            </aside>
          )}
        </main>

        {/* Bottom Immutable Ledger Protocol Banner */}
        <section
          className="amx-logs-protocol-banner"
          aria-label="Immutable Physical Checkpoint Ledger Protocol"
        >
          <span
            className="material-symbols-outlined amx-logs-protocol-icon"
            aria-hidden="true"
          >
            verified_user
          </span>
          <div>
            <div className="amx-logs-protocol-title">
              Authoritative Physical Checkpoint Ledger
            </div>
            <p className="amx-logs-protocol-desc">
              All checkpoint movement events logged herein represent authoritative records
              stored in the AssetMX audit system upon gate verification. Under SecOps policy,
              all gate movements and officer sign-offs are preserved for perimeter compliance.
            </p>
          </div>
        </section>

        {/* Audit Record Reference Modal Dialog */}
        {showVerifyModal && selectedRecord && (
          <div
            className="amx-logs-modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(11, 28, 48, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              backdropFilter: 'blur(3px)',
            }}
            onClick={() => setShowVerifyModal(false)}
            data-testid="audit-details-modal"
          >
            <div
              className="amx-logs-modal-card"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                width: '100%',
                maxWidth: 540,
                padding: 24,
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                border: '1px solid #c6c6cd',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ color: '#00687a', fontSize: 24 }}
                  >
                    verified_user
                  </span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    Gate Pass Audit Record Details
                  </h3>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#76777d',
                  }}
                  onClick={() => setShowVerifyModal(false)}
                  aria-label="Close dialog"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <p style={{ fontSize: 13, color: '#45464d', margin: '0 0 16px 0' }}>
                Authoritative database audit trail for gate pass{' '}
                <strong>{selectedRecord.passId}</strong>.
              </p>

              <div
                style={{
                  backgroundColor: '#f2f4f6',
                  padding: 16,
                  borderRadius: 8,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div>
                  <span style={{ color: '#76777d' }}>Ledger Record ID:</span>
                  <div style={{ fontWeight: 700, color: '#00687a', wordBreak: 'break-all' }}>
                    {selectedRecord.id}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Event Category &amp; Direction:</span>
                  <div style={{ color: '#191c1e', fontWeight: 600 }}>
                    {selectedRecord.category || 'Physical Movement'} — {selectedRecord.directionLabel}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Ledger Status:</span>
                  <div style={{ color: selectedRecord.status === 'Flagged' ? '#ba1a1a' : '#00687a', fontWeight: 700 }}>
                    {selectedRecord.status.toUpperCase()} ({selectedRecord.discrepancyStatusTitle})
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Recorded Timestamp:</span>
                  <div style={{ color: '#191c1e' }}>
                    {selectedRecord.dateDisplay} — {selectedRecord.timeDisplay}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Verifying Officer:</span>
                  <div style={{ color: '#191c1e' }}>
                    {selectedRecord.guardName} ({selectedRecord.guardBadge})
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Storage Source:</span>
                  <div style={{ color: '#45464d' }}>
                    Relational Table: gate_pass_history (Database Audited)
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Cryptographic Telemetry:</span>
                  <div style={{ color: '#76777d', fontStyle: 'italic' }}>
                    None (Standard Database-Audited Gate Pass)
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  className="amx-logs-btn-apply"
                  style={{ padding: '8px 20px' }}
                  onClick={() => {
                    setShowVerifyModal(false);
                    showToast('Audit record details reviewed');
                  }}
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Print Manifest Slip Modal / Preview */}
        {showPrintSlipModal && selectedRecord && (
          <div
            className="amx-logs-modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(11, 28, 48, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              backdropFilter: 'blur(3px)',
            }}
            onClick={() => setShowPrintSlipModal(false)}
          >
            <div
              className="amx-logs-modal-card"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                width: '100%',
                maxWidth: 580,
                padding: 24,
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                border: '1px solid #c6c6cd',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '2px solid #191c1e',
                  paddingBottom: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'JetBrains Mono',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      color: '#00687a',
                    }}
                  >
                    ASSETMX PHYSICAL SECURITY ARCHITECTURE
                  </div>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: 18, fontWeight: 800 }}>
                    GATE CLEARANCE MANIFEST SLIP
                  </h3>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#76777d',
                  }}
                  onClick={() => setShowPrintSlipModal(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 16,
                }}
              >
                <div>
                  <span style={{ fontSize: 10, color: '#76777d', display: 'block' }}>
                    PASS IDENTIFIER
                  </span>
                  <strong>{selectedRecord.passId}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: '#76777d', display: 'block' }}>
                    MOVEMENT TYPE
                  </span>
                  <strong>{selectedRecord.directionLabel}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: '#76777d', display: 'block' }}>
                    CHECKPOINT
                  </span>
                  <span>{selectedRecord.checkpointFull}</span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: '#76777d', display: 'block' }}>
                    DATE / TIME
                  </span>
                  <span>{selectedRecord.dateDisplay} {selectedRecord.timeDisplay}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: 10, color: '#76777d', display: 'block' }}>
                    ASSET / SERIAL
                  </span>
                  <strong>{selectedRecord.assetName}</strong> ({selectedRecord.assetId})
                  <div>SN: {selectedRecord.serialNumber}</div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: 10, color: '#76777d', display: 'block' }}>
                    CARRIER / CUSTODIAN
                  </span>
                  <span>{selectedRecord.carrierVehicle}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: 10, color: '#76777d', display: 'block' }}>
                    CLEARANCE STATUS
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: selectedRecord.status === 'Flagged' ? '#ba1a1a' : '#00687a',
                    }}
                  >
                    {selectedRecord.status.toUpperCase()} — {selectedRecord.discrepancyStatusTitle}
                  </span>
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px dashed #c6c6cd',
                  paddingTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: 11, color: '#76777d' }}>
                  Verified by Officer: {selectedRecord.guardName} ({selectedRecord.guardBadge})
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="amx-logs-btn-apply"
                    style={{ padding: '6px 14px' }}
                    onClick={() => {
                      window.print();
                    }}
                  >
                    Print Slip
                  </button>
                  <button
                    type="button"
                    className="amx-logs-btn-reset"
                    onClick={() => setShowPrintSlipModal(false)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Toast Notification */}
        {toastMessage && (
          <aside className="amx-logs-toast" role="status" aria-live="polite">
            <span
              className="material-symbols-outlined"
              style={{ color: '#57dffe', fontSize: 20 }}
            >
              info
            </span>
            <span>{toastMessage}</span>
          </aside>
        )}
      </div>
    </DashboardLayout>
  );
};
