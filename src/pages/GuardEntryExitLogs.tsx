import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  INITIAL_GUARD_LOGS_DATA,
  type GuardMovementLogRecord,
} from '../data/guardLogsData';
import './GuardEntryExitLogs.css';

interface GuardEntryExitLogsPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

export const GuardEntryExitLogsPage: React.FC<GuardEntryExitLogsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Master record state (mock data initialized)
  const [logs] = useState<GuardMovementLogRecord[]>(INITIAL_GUARD_LOGS_DATA);

  // Selected record for Movement Audit Details drawer
  const [selectedRecordId, setSelectedRecordId] = useState<string>('LOG-2026-0048');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);

  // Filter criteria
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('2026-05-20');
  const [toDate, setToDate] = useState<string>('2026-05-24');
  const [directionFilter, setDirectionFilter] = useState<'All' | 'Inward' | 'Outward'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Cleared' | 'Pending' | 'Flagged'>('All');

  // Applied filter state (filters take effect on change or Apply button click)
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [appliedFromDate, setAppliedFromDate] = useState<string>('2026-05-20');
  const [appliedToDate, setAppliedToDate] = useState<string>('2026-05-24');
  const [appliedDirection, setAppliedDirection] = useState<'All' | 'Inward' | 'Outward'>('All');
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

  // Synchronize applied filters
  const handleApplyFilters = () => {
    setAppliedSearch(searchQuery);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setAppliedDirection(directionFilter);
    setAppliedStatus(statusFilter);
    setCurrentPage(1);
    showToast('Filters applied to ledger');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFromDate('2026-05-20');
    setToDate('2026-05-24');
    setDirectionFilter('All');
    setStatusFilter('All');

    setAppliedSearch('');
    setAppliedFromDate('2026-05-20');
    setAppliedToDate('2026-05-24');
    setAppliedDirection('All');
    setAppliedStatus('All');
    setCurrentPage(1);
    showToast('Filters reset to default range');
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
  }, [logs, appliedSearch, appliedFromDate, appliedToDate, appliedDirection, appliedStatus]);

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    return logs.filter((record) => {
      // Search matching (Pass ID, Asset ID, Asset Name, Requester, Custodian, Carrier, Serial)
      if (appliedSearch.trim()) {
        const query = appliedSearch.toLowerCase().trim();
        const matchesQuery =
          record.passId.toLowerCase().includes(query) ||
          record.assetId.toLowerCase().includes(query) ||
          record.assetName.toLowerCase().includes(query) ||
          record.serialNumber.toLowerCase().includes(query) ||
          record.requesterName.toLowerCase().includes(query) ||
          record.requesterBadge.toLowerCase().includes(query) ||
          record.custodian.toLowerCase().includes(query) ||
          record.carrierVehicle.toLowerCase().includes(query) ||
          record.guardName.toLowerCase().includes(query) ||
          record.guardBadge.toLowerCase().includes(query);

        if (!matchesQuery) return false;
      }

      // Date range matching
      if (appliedFromDate && record.date < appliedFromDate) {
        return false;
      }
      if (appliedToDate && record.date > appliedToDate) {
        return false;
      }

      // Direction matching
      if (appliedDirection !== 'All' && record.direction !== appliedDirection) {
        return false;
      }

      // Status matching
      if (appliedStatus !== 'All' && record.status !== appliedStatus) {
        return false;
      }

      return true;
    });
  }, [logs, appliedSearch, appliedFromDate, appliedToDate, appliedDirection, appliedStatus]);

  // Paginated dataset
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Selected record object
  const selectedRecord = useMemo(() => {
    return (
      logs.find((r) => r.id === selectedRecordId || r.passId === selectedRecordId) ||
      filteredLogs[0] ||
      logs[0]
    );
  }, [logs, selectedRecordId, filteredLogs]);

  // Dynamic KPI counts based on full mock dataset
  const kpiCounts = useMemo(() => {
    const total = logs.length;
    const inbound = logs.filter((l) => l.direction === 'Inward' && l.status !== 'Flagged').length;
    const outbound = logs.filter((l) => l.direction === 'Outward' && l.status !== 'Flagged').length;
    const flagged = logs.filter((l) => l.status === 'Flagged').length;
    return {
      totalMovements: total,
      inboundEntries: inbound,
      outboundExits: outbound,
      flaggedMovements: flagged,
    };
  }, [logs]);

  // Handle Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Log ID',
      'Gate Pass ID',
      'Asset ID',
      'Asset Name',
      'Serial Number',
      'Direction',
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
      'Manifest Hash',
      'Tamper Seal ID',
      'Inspected Qty',
      'Expected Qty',
      'Has Discrepancy',
      'Discrepancy Details',
      'Guard Remarks',
    ];

    const rows = filteredLogs.map((item) => [
      item.id,
      item.passId,
      item.assetId,
      `"${item.assetName.replace(/"/g, '""')}"`,
      item.serialNumber,
      item.direction,
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
    link.setAttribute('download', `AssetMX_Guard_Movement_Logs_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filteredLogs.length} audit records to CSV`);
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
            {/* Live Checkpoint Node Pill */}
            <div className="amx-logs-node-pill" title="Active Checkpoint Station">
              <span className="amx-logs-live-ping">
                <span className="amx-logs-ping-anim"></span>
                <span className="amx-logs-ping-dot"></span>
              </span>
              <div>
                <span className="amx-logs-pill-label">Active Node</span>
                <div className="amx-logs-pill-val">Gate-01A (North Barrier)</div>
              </div>
            </div>

            {/* Active Shift Pill */}
            <div className="amx-logs-shift-pill" title="Current Duty Shift">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: '#00687a' }}
              >
                schedule
              </span>
              <div>
                <span className="amx-logs-pill-label">Guard Shift</span>
                <div className="amx-logs-pill-val">Shift Bravo (14:00 - 22:00)</div>
              </div>
            </div>

            {/* Export CSV Action */}
            <div className="amx-logs-export-group">
              <button
                type="button"
                className="amx-logs-btn-export"
                onClick={handleExportCsv}
                aria-label="Export Logs to CSV"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16 }}
                >
                  download
                </span>
                <span>Export CSV</span>
              </button>
              <span className="amx-logs-export-hint">[Ctrl + E] ISO-27001</span>
            </div>
          </div>
        </header>

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
              <span className="amx-logs-kpi-badge">May 20–24</span>
            </div>
            <div className="amx-logs-kpi-val-row">
              <span className="amx-logs-kpi-number">{kpiCounts.totalMovements}</span>
              <span className="amx-logs-kpi-unit">transits</span>
            </div>
            <p className="amx-logs-kpi-subtext">
              <span className="amx-logs-kpi-dot"></span>
              Across Gate-01A lane barriers
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
                />
                <span style={{ color: '#76777d' }}>–</span>
                <input
                  type="date"
                  className="amx-logs-date-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  aria-label="To Date"
                  title="To Date"
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
                  setDirectionFilter(e.target.value as 'All' | 'Inward' | 'Outward')
                }
                aria-label="Filter by Movement Direction"
              >
                <option value="All">All Movements</option>
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
              >
                Apply Filter
              </button>
              <button
                type="button"
                className="amx-logs-btn-reset"
                onClick={handleResetFilters}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Active Filter Scope Indicators */}
          <div className="amx-logs-active-scope-row">
            <div className="amx-logs-active-pills">
              <span className="amx-logs-active-label">Active Filters:</span>
              <div className="amx-logs-scope-pill highlight">
                <span>Date: {appliedFromDate} to {appliedToDate}</span>
                <span
                  className="amx-logs-pill-remove"
                  onClick={() => {
                    setFromDate('2026-05-20');
                    setToDate('2026-05-24');
                    setAppliedFromDate('2026-05-20');
                    setAppliedToDate('2026-05-24');
                  }}
                  title="Reset date filter"
                >
                  ×
                </span>
              </div>

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
            </div>

            <div className="amx-logs-synced-status">
              LEDGER SYNCED: 100% IMMUTABLE
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
                  {filteredLogs.length} Records
                </span>
              </div>
              <div className="amx-logs-auto-refresh">
                <span className="amx-logs-refresh-dot"></span>
                <span>Checkpoint Log Snapshot</span>
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
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px' }}>
                        <div style={{ color: '#45464d', marginBottom: 8 }}>
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
                    paginatedLogs.map((record) => {
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
                  {filteredLogs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                  {Math.min(currentPage * pageSize, filteredLogs.length)} of{' '}
                  {filteredLogs.length} entries
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
                  disabled={currentPage <= 1}
                  aria-label="Previous Page"
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
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  className="amx-logs-page-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next Page"
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
                    <span
                      className={`amx-logs-dir-pill ${
                        selectedRecord.direction === 'Inward' ? 'inbound' : ''
                      }`}
                    >
                      {selectedRecord.direction.toUpperCase()}
                    </span>
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
                {/* Header Info & Cryptographic Identity Box */}
                <div className="amx-logs-identity-box">
                  <div className="amx-logs-hash-row">
                    <span style={{ color: '#45464d' }}>IMMUTABLE MANIFEST HASH</span>
                    <span className="amx-logs-hash-val">
                      {selectedRecord.manifestHash}
                    </span>
                  </div>

                  <div className="amx-logs-meta-fields-grid">
                    <div>
                      <span className="amx-logs-meta-label">
                        {selectedRecord.direction === 'Outward'
                          ? 'Actual Exit Time'
                          : 'Actual Entry Time'}
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
                      <span className="amx-logs-meta-label">Carrier & Vehicle</span>
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
                          CLEARED & PASSING
                        </span>
                      </div>
                      <p className="amx-logs-discrepancy-desc">
                        All physical serial numbers, tamper seals, and carrier manifests
                        matched cryptographic authorizations without variance.
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
                      title="Optical Serial Scanner Validated"
                    >
                      BARCODE SCANNED
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
                </div>

                {/* Guard Remarks */}
                <div>
                  <h4 className="amx-logs-section-title">Guard Remarks & Notes</h4>
                  <div className="amx-logs-remarks-card" style={{ marginTop: 8 }}>
                    <div>&ldquo;{selectedRecord.guardRemarks}&rdquo;</div>
                    <div className="amx-logs-remarks-author">
                      Signed off by: {selectedRecord.guardName} ({selectedRecord.guardBadge})
                    </div>
                  </div>
                </div>

                {/* Station Timeline */}
                <div>
                  <h4 className="amx-logs-section-title">Station Timeline</h4>
                  <div className="amx-logs-timeline-list" style={{ marginTop: 12 }}>
                    {selectedRecord.timeline.map((evt, idx) => (
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
                    ))}
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
                  aria-label="Verify Ledger Cryptohash"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    lock_clock
                  </span>
                  <span>Verify Cryptohash</span>
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
              Immutable Physical Checkpoint Ledger Protocol
            </div>
            <p className="amx-logs-protocol-desc">
              All checkpoint movement events logged herein are cryptographically anchored
              upon barrier actuation. Under AssetMX SecOps Rule 9.4, records cannot be
              altered, deleted, or backdated. Guards hold read-only audit permissions;
              modifications require dual-administrator cryptographic key authorization.
            </p>
          </div>
        </section>

        {/* Cryptohash Verification Modal Dialog */}
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
                    verified
                  </span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    Cryptographic Integrity Reference <span style={{ fontSize: 13, fontWeight: 400, color: '#76777d' }}>(Demo)</span>
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
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <p style={{ fontSize: 13, color: '#45464d', margin: '0 0 16px 0' }}>
                Simulated representation of the cryptographic anchor for gate pass{' '}
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
                  <span style={{ color: '#76777d' }}>SHA-256 Digest:</span>
                  <div style={{ fontWeight: 700, color: '#00687a', wordBreak: 'break-all' }}>
                    {selectedRecord.manifestHash}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Merkle Root <span style={{ fontSize: 11 }}>[Simulated]</span>:</span>
                  <div style={{ wordBreak: 'break-all', color: '#191c1e' }}>
                    0x7a89b02efc188941019fa76b91c778401392dfb
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Ledger Block Status <span style={{ fontSize: 11 }}>[Simulated]</span>:</span>
                  <div style={{ color: '#00687a', fontWeight: 700 }}>
                    CONFIRMED (1,482 Confirmations)
                  </div>
                </div>
                <div>
                  <span style={{ color: '#76777d' }}>Station Timestamp:</span>
                  <div style={{ color: '#191c1e' }}>
                    {selectedRecord.dateDisplay} — {selectedRecord.timeDisplay}
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
                    showToast('Demonstration hash reference reviewed');
                  }}
                >
                  Close Proof
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
