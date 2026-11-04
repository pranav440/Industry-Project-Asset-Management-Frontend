import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  HOST_MOVEMENT_KPIS_DATA,
  HOST_DETAILED_MOVEMENT_RECORDS,
  type HostMovementActivityRecord,
  type HostMovementStatus,
} from '../data/hostData';
import './HostMovementActivity.css';

interface HostMovementActivityPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

export const HostMovementActivityPage: React.FC<HostMovementActivityPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [corridorFilter, setCorridorFilter] = useState<string>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [dateFilter] = useState<string>('18 Feb 2026');

  // Selected Record State (defaults to MOV-2026-0182 from Stitch screen)
  const [selectedMovementId, setSelectedMovementId] = useState<string>('MOV-2026-0182');
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal States
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);

  // Verification Checklist State
  const [verifySerialCheck, setVerifySerialCheck] = useState(false);
  const [verifySealCheck, setVerifySealCheck] = useState(false);
  const [verifyBearerCheck, setVerifyBearerCheck] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');

  // Checkpoint Issue State
  const [issueCategory, setIssueCategory] = useState('Missing secondary perimeter seal scan');
  const [issueNotes, setIssueNotes] = useState('');

  // Escalation State
  const [escalateReason, setEscalateReason] = useState('Corridor Routing Discrepancy');
  const [escalateNotes, setEscalateNotes] = useState('');

  // Feedback Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleNav = (path: string) => {
    if (path === 'dashboard' || path === 'Host Dashboard') {
      onNavigate?.('dashboard');
    } else if (path === 'gate-pass' || path === 'Gate Passes') {
      onNavigate?.('gate-pass');
    } else if (path === 'movement' || path === 'movement-activity' || path === 'Movement Activity') {
      onNavigate?.('movement');
    } else if (path === 'support') {
      showToast('Host Security Support: Contact Central Security Desk (Ext. 4040).');
    } else if (path === 'login' || path === 'signout' || path === 'sign-out') {
      onSignOut?.();
    } else {
      onNavigate?.(path);
    }
  };

  // Filtered Movement Records
  const filteredRecords = useMemo(() => {
    return HOST_DETAILED_MOVEMENT_RECORDS.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.id.toLowerCase().includes(q) ||
          item.assetName.toLowerCase().includes(q) ||
          item.assetTag.toLowerCase().includes(q) ||
          item.serialNumber.toLowerCase().includes(q) ||
          item.initiatedBy.toLowerCase().includes(q) ||
          item.origin.toLowerCase().includes(q) ||
          item.destination.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Status
      if (statusFilter !== 'All' && item.status !== statusFilter) {
        return false;
      }

      // Corridor
      if (corridorFilter !== 'All' && item.corridor !== corridorFilter) {
        return false;
      }

      // Department
      if (deptFilter !== 'All' && item.department !== deptFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, statusFilter, corridorFilter, deptFilter]);

  // Selected Record
  const selectedMovement: HostMovementActivityRecord | undefined = useMemo(() => {
    return (
      HOST_DETAILED_MOVEMENT_RECORDS.find((r) => r.id === selectedMovementId) ||
      filteredRecords[0] ||
      HOST_DETAILED_MOVEMENT_RECORDS[0]
    );
  }, [selectedMovementId, filteredRecords]);

  // Pagination Calculations
  const totalRecords = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + rowsPerPage);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setCorridorFilter('All');
    setDeptFilter('All');
    setCurrentPage(1);
    showToast('Movement filters reset to default view.');
  };

  const handleSelectMovement = (record: HostMovementActivityRecord) => {
    setSelectedMovementId(record.id);
    setIsDetailPanelOpen(true);
  };

  const handleExportLog = () => {
    showToast('Exporting Host Movement Activity log (CSV/PDF) — Download initiated.');
  };

  const handleCompleteVerification = () => {
    if (!verifySerialCheck) {
      showToast('Attention: Physical serial number check must be confirmed.');
      return;
    }
    setIsVerifyModalOpen(false);
    setVerifySerialCheck(false);
    setVerifySealCheck(false);
    setVerifyBearerCheck(false);
    setVerifyNotes('');
    showToast(`Checkpoint scan verified for ${selectedMovement?.id} at Checkpoint Gate-04A.`);
  };

  const handleLogIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsIssueModalOpen(false);
    setIssueNotes('');
    showToast(`Checkpoint issue logged for ${selectedMovement?.id} (${issueCategory}).`);
  };

  const handleEscalationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEscalateModalOpen(false);
    setEscalateNotes('');
    showToast(`Movement ${selectedMovement?.id} escalated to Security Supervisor (${escalateReason}).`);
  };

  const getStatusClass = (status: HostMovementStatus): string => {
    switch (status) {
      case 'Exception':
        return 'exception';
      case 'Checkpoint Verified':
        return 'verified';
      case 'In Transit':
        return 'transit';
      case 'Received':
        return 'received';
      case 'Scheduled':
        return 'scheduled';
      case 'Dispatched':
        return 'dispatched';
      default:
        return 'received';
    }
  };

  const getStatusIcon = (status: HostMovementStatus): string => {
    switch (status) {
      case 'Exception':
        return 'error_outline';
      case 'Checkpoint Verified':
        return 'verified';
      case 'In Transit':
        return 'near_me';
      case 'Received':
        return 'check';
      case 'Scheduled':
        return 'schedule';
      case 'Dispatched':
        return 'outbox';
      default:
        return 'info';
    }
  };

  return (
    <DashboardLayout
      currentNav="movement"
      role="host"
      onNavigate={handleNav}
      onSignOut={onSignOut}
    >
      <div className="amx-hma-container">
        {/* Toast Feedback */}
        {toastMessage && (
          <div className="amx-hma-toast" role="status">
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#57dffe' }}>
              info
            </span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Breadcrumb & Page Header */}
        <div className="amx-hma-header-section">
          <nav aria-label="Breadcrumb" className="amx-hma-breadcrumb">
            <span
              className="amx-hma-breadcrumb-link"
              onClick={() => handleNav('dashboard')}
            >
              Host Dashboard
            </span>
            <span className="material-symbols-outlined amx-hma-breadcrumb-sep">
              chevron_right
            </span>
            <span className="amx-hma-breadcrumb-current">Movement Activity</span>
          </nav>

          <div className="amx-hma-title-bar">
            <div className="amx-hma-title-left">
              <div className="amx-hma-title-row">
                <h1 className="amx-hma-headline">Movement Activity</h1>
                <span className="amx-hma-active-perimeter-badge">
                  <span className="amx-hma-active-dot" />
                  Active Perimeter Logs • Checkpoint Node Gate-04A
                </span>
              </div>
              <p className="amx-hma-subtitle">
                Track asset movements, checkpoint verification and custody transitions.
              </p>
            </div>

            <div className="amx-hma-header-actions">
              <button
                type="button"
                className="amx-hma-btn-export"
                onClick={handleExportLog}
                aria-label="Export Movement Log"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  download
                </span>
                <span>Export Movement Log</span>
              </button>
              <button
                type="button"
                className="amx-hma-btn-scan-primary"
                onClick={() => setIsVerifyModalOpen(true)}
                aria-label="Verify Checkpoint Scan"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  qr_code_scanner
                </span>
                <span>Verify Checkpoint Scan</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Compact KPI Cards Row */}
        <div className="amx-hma-kpi-grid">
          {/* Card 1: Total Movements */}
          <div className="amx-hma-kpi-card">
            <div className="amx-hma-kpi-top">
              <div>
                <span className="amx-hma-kpi-title">Total Movements</span>
                <div className="amx-hma-kpi-number">
                  {HOST_MOVEMENT_KPIS_DATA.totalMovements.total}
                </div>
              </div>
              <div className="amx-hma-kpi-icon-box">
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  swap_horiz
                </span>
              </div>
            </div>
            <div className="amx-hma-kpi-bottom">
              <span className="amx-hma-kpi-subtext">
                {HOST_MOVEMENT_KPIS_DATA.totalMovements.subtext}
              </span>
              <span className="amx-hma-kpi-badge">
                {HOST_MOVEMENT_KPIS_DATA.totalMovements.badgeText}
              </span>
            </div>
          </div>

          {/* Card 2: In Transit */}
          <div className="amx-hma-kpi-card">
            <div className="amx-hma-kpi-top">
              <div>
                <span className="amx-hma-kpi-title">In Transit</span>
                <div className="amx-hma-kpi-number">
                  {HOST_MOVEMENT_KPIS_DATA.inTransit.total}
                </div>
              </div>
              <div className="amx-hma-kpi-icon-box cyan">
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  local_shipping
                </span>
              </div>
            </div>
            <div className="amx-hma-kpi-bottom">
              <span className="amx-hma-kpi-subtext">
                {HOST_MOVEMENT_KPIS_DATA.inTransit.subtext}
              </span>
              <span className="amx-hma-kpi-badge cyan">
                {HOST_MOVEMENT_KPIS_DATA.inTransit.badgeText}
              </span>
            </div>
          </div>

          {/* Card 3: Completed Today */}
          <div className="amx-hma-kpi-card">
            <div className="amx-hma-kpi-top">
              <div>
                <span className="amx-hma-kpi-title">Completed Today</span>
                <div className="amx-hma-kpi-number">
                  {HOST_MOVEMENT_KPIS_DATA.completedToday.total}
                </div>
              </div>
              <div className="amx-hma-kpi-icon-box">
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  check_circle
                </span>
              </div>
            </div>
            <div className="amx-hma-kpi-bottom">
              <span className="amx-hma-kpi-subtext">
                {HOST_MOVEMENT_KPIS_DATA.completedToday.subtext}
              </span>
              <span className="amx-hma-kpi-badge">
                {HOST_MOVEMENT_KPIS_DATA.completedToday.badgeText}
              </span>
            </div>
          </div>

          {/* Card 4: Movement Exceptions */}
          <div className="amx-hma-kpi-card">
            <div className="amx-hma-kpi-top">
              <div>
                <span className="amx-hma-kpi-title">Movement Exceptions</span>
                <div className="amx-hma-kpi-number error">
                  {HOST_MOVEMENT_KPIS_DATA.movementExceptions.total}
                </div>
              </div>
              <div className="amx-hma-kpi-icon-box error">
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  warning
                </span>
              </div>
            </div>
            <div className="amx-hma-kpi-bottom">
              <span className="amx-hma-kpi-subtext">
                {HOST_MOVEMENT_KPIS_DATA.movementExceptions.subtext}
              </span>
              <span className="amx-hma-kpi-badge error">
                {HOST_MOVEMENT_KPIS_DATA.movementExceptions.badgeText}
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="amx-hma-toolbar">
          <div className="amx-hma-toolbar-row">
            {/* Search Input */}
            <div className="amx-hma-search-wrap">
              <span className="material-symbols-outlined amx-hma-search-icon">
                search
              </span>
              <input
                type="text"
                className="amx-hma-search-input"
                placeholder="Search by Movement ID, Asset ID, serial or custodian..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Status Filter */}
            <div className="amx-hma-filter-select-wrap">
              <select
                className="amx-hma-filter-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by Status"
              >
                <option value="All">Status: All Statuses</option>
                <option value="Exception">Exception</option>
                <option value="Checkpoint Verified">Checkpoint Verified</option>
                <option value="In Transit">In Transit</option>
                <option value="Received">Received</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Dispatched">Dispatched</option>
              </select>
              <span className="material-symbols-outlined amx-hma-filter-select-icon">
                expand_more
              </span>
            </div>

            {/* Corridor Filter */}
            <div className="amx-hma-filter-select-wrap">
              <select
                className="amx-hma-filter-select"
                value={corridorFilter}
                onChange={(e) => {
                  setCorridorFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by Corridor"
              >
                <option value="All">Corridor: All Checkpoints</option>
                <option value="Gate-04A Main Corridor">Gate-04A Main Corridor</option>
                <option value="Server Room 2 Express">Server Room 2 Express</option>
                <option value="Tech Hub Building B Bay">Tech Hub Building B Bay</option>
                <option value="East Checkpoint Transit">East Checkpoint Transit</option>
              </select>
              <span className="material-symbols-outlined amx-hma-filter-select-icon">
                expand_more
              </span>
            </div>

            {/* Department Filter */}
            <div className="amx-hma-filter-select-wrap">
              <select
                className="amx-hma-filter-select"
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by Department"
              >
                <option value="All">Dept: All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="IT Operations">IT Operations</option>
                <option value="Facilities">Facilities</option>
                <option value="QA Labs">QA Labs</option>
              </select>
              <span className="material-symbols-outlined amx-hma-filter-select-icon">
                expand_more
              </span>
            </div>

            {/* Date Range & Reset */}
            <button
              type="button"
              className="amx-hma-date-btn"
              onClick={() => showToast('Date filter: Showing movement entries for 18 Feb 2026.')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                calendar_today
              </span>
              <span>{dateFilter}</span>
            </button>

            <button
              type="button"
              className="amx-hma-reset-btn"
              onClick={handleResetFilters}
              title="Reset Filters"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                refresh
              </span>
            </button>
          </div>

          {/* Active Indicator Bar */}
          <div className="amx-hma-indicator-bar">
            <div className="amx-hma-indicator-left">
              <span className="amx-hma-indicator-dot" />
              <span>
                Showing {filteredRecords.length} of {HOST_MOVEMENT_KPIS_DATA.totalMovements.total} Movement Records • Illustrative Operational Dataset
              </span>
            </div>
            <span>Checkpoints Active: Gate-04A, Hub-B1, Bay-East</span>
          </div>
        </div>

        {/* Movement Activity Table */}
        <div className="amx-hma-table-container">
          <div className="amx-hma-table-wrapper">
            <table className="amx-hma-table">
              <thead>
                <tr>
                  <th>Movement ID</th>
                  <th>Asset / Item</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Initiated By</th>
                  <th>Movement Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => {
                  const isSelected = selectedMovement?.id === record.id;
                  const statusClass = getStatusClass(record.status);
                  const statusIcon = getStatusIcon(record.status);

                  return (
                    <tr
                      key={record.id}
                      className={`amx-hma-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectMovement(record)}
                    >
                      <td>
                        <div className="amx-hma-cell-id">
                          <span className={`amx-hma-id-dot ${statusClass}`} />
                          <span>{record.id}</span>
                        </div>
                      </td>
                      <td>
                        <div className="amx-hma-asset-info">
                          <span className="amx-hma-asset-title">{record.assetName}</span>
                          <span className="amx-hma-asset-sub">
                            {record.assetTag} • SN: {record.serialNumber}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="amx-hma-location-cell">
                          <span className="material-symbols-outlined amx-hma-location-icon">
                            {record.originIcon}
                          </span>
                          <span>{record.origin}</span>
                        </div>
                      </td>
                      <td>
                        <div className="amx-hma-location-cell">
                          <span className="material-symbols-outlined amx-hma-location-icon">
                            {record.destinationIcon}
                          </span>
                          <span>{record.destination}</span>
                        </div>
                      </td>
                      <td>
                        <div className="amx-hma-initiator-cell">
                          <div className={`amx-hma-avatar ${isSelected ? 'dark' : ''}`}>
                            {record.initiatorInitials}
                          </div>
                          <div className="amx-hma-initiator-meta">
                            <span className="amx-hma-initiator-name">{record.initiatedBy}</span>
                            <span className="amx-hma-initiator-dept">{record.department}</span>
                          </div>
                        </div>
                      </td>
                      <td className="amx-hma-date-cell">{record.movementDate}</td>
                      <td>
                        <span className={`amx-hma-status-pill ${statusClass}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                            {statusIcon}
                          </span>
                          <span>{record.status}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isSelected ? (
                          <button
                            type="button"
                            className="amx-hma-btn-selected"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsDetailPanelOpen(true);
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              visibility
                            </span>
                            <span>Selected</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="amx-hma-btn-view"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectMovement(record);
                            }}
                          >
                            View Details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {paginatedRecords.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px' }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>No movement records match the selected filters.</p>
                      <button
                        type="button"
                        className="amx-hma-btn-view"
                        style={{ marginTop: '12px' }}
                        onClick={handleResetFilters}
                      >
                        Reset Filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="amx-hma-pagination">
            <div className="amx-hma-pag-left">
              <span>Rows per page:</span>
              <select
                className="amx-hma-rows-select"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span style={{ marginLeft: '6px' }}>
                Showing {totalRecords === 0 ? 0 : startIndex + 1}-
                {Math.min(startIndex + rowsPerPage, totalRecords)} of {totalRecords} records
              </span>
            </div>

            <div className="amx-hma-pag-right">
              <span style={{ fontFamily: 'var(--amx-hma-font-mono)', fontSize: '12px', marginRight: '6px' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="amx-hma-pag-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                className="amx-hma-pag-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Selected Record Detail Panel & Movement Timeline */}
        {isDetailPanelOpen && selectedMovement && (
          <div className="amx-hma-detail-panel" aria-label="Movement Audit Details">
            {/* Panel Header */}
            <div className="amx-hma-detail-header">
              <div>
                <div className="amx-hma-detail-meta">
                  <span className="amx-hma-detail-id">{selectedMovement.id}</span>
                  <span className={`amx-hma-status-pill ${getStatusClass(selectedMovement.status)}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                      {getStatusIcon(selectedMovement.status)}
                    </span>
                    <span>{selectedMovement.status.toUpperCase()}</span>
                  </span>
                  <span className="amx-hma-gatepass-chip">
                    GATE-PASS: {selectedMovement.gatePassId}
                  </span>
                </div>
                <p className="amx-hma-detail-sub">
                  Movement Audit & Checkpoint Chain of Custody
                </p>
              </div>

              <button
                type="button"
                className="amx-hma-detail-close-btn"
                onClick={() => setIsDetailPanelOpen(false)}
                aria-label="Close detail panel"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  close
                </span>
              </button>
            </div>

            {/* Checkpoint Discrepancy Alert Banner */}
            {selectedMovement.discrepancyAlert && (
              <div className="amx-hma-discrepancy-banner">
                <span className="material-symbols-outlined amx-hma-discrepancy-icon">
                  warning
                </span>
                <div>
                  <span className="amx-hma-discrepancy-title">
                    Checkpoint Discrepancy Detected
                  </span>
                  <p className="amx-hma-discrepancy-desc">
                    {selectedMovement.discrepancyAlert}
                  </p>
                </div>
              </div>
            )}

            {/* Panel Content Grid (Parameters vs Timeline) */}
            <div className="amx-hma-detail-grid">
              {/* Left Column (Asset & Parameters) */}
              <div className="amx-hma-detail-left">
                {/* 1. Asset Specifications */}
                <div>
                  <span className="amx-hma-section-label">Asset Specifications</span>
                  <div className="amx-hma-card-block">
                    <div className="amx-hma-specs-grid">
                      <div className="amx-hma-spec-item">
                        <span className="amx-hma-spec-label">Hardware Item</span>
                        <span className="amx-hma-spec-val">{selectedMovement.assetName}</span>
                      </div>
                      <div className="amx-hma-spec-item">
                        <span className="amx-hma-spec-label">Asset Tag</span>
                        <span className="amx-hma-spec-val mono">{selectedMovement.assetTag}</span>
                      </div>
                      <div className="amx-hma-spec-item">
                        <span className="amx-hma-spec-label">Serial Number</span>
                        <span className="amx-hma-spec-val mono">{selectedMovement.serialNumber}</span>
                      </div>
                      <div className="amx-hma-spec-item">
                        <span className="amx-hma-spec-label">Classification / Category</span>
                        <span className="amx-hma-spec-val">{selectedMovement.classification}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Routing & Corridor Segment */}
                <div>
                  <span className="amx-hma-section-label">Corridor Routing & Checkpoints</span>
                  <div className="amx-hma-route-block">
                    <div className="amx-hma-route-node">
                      <div className="amx-hma-route-icon-box">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {selectedMovement.originIcon}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="amx-hma-spec-label">ORIGIN CHECKPOINT</span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedMovement.origin}</span>
                        <span style={{ fontSize: '11px', color: 'var(--amx-hma-text-muted)' }}>
                          {selectedMovement.originZone}
                        </span>
                      </div>
                    </div>

                    <div className="amx-hma-route-arrow">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        arrow_forward
                      </span>
                    </div>

                    <div className="amx-hma-route-node">
                      <div className="amx-hma-route-icon-box">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {selectedMovement.destinationIcon}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="amx-hma-spec-label">DESTINATION FACILITY</span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedMovement.destination}</span>
                        <span style={{ fontSize: '11px', color: 'var(--amx-hma-text-muted)' }}>
                          {selectedMovement.destinationSegment}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Custodian & Transport Escort */}
                <div>
                  <span className="amx-hma-section-label">Custodian & Transport Escort</span>
                  <div className="amx-hma-custody-grid">
                    <div className="amx-hma-card-block">
                      <span className="amx-hma-spec-label">Initiator / Responsible Custodian</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <div className="amx-hma-avatar dark">
                          {selectedMovement.initiatorInitials}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedMovement.initiatedBy}</span>
                          <span style={{ fontSize: '11px', color: 'var(--amx-hma-text-subtle)' }}>
                            Badge #{selectedMovement.initiatorBadge} • {selectedMovement.department}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--amx-hma-text-muted)', marginTop: '4px' }}>
                        {selectedMovement.initiatorEmail}
                      </span>
                    </div>

                    <div className="amx-hma-card-block">
                      <span className="amx-hma-spec-label">Authorized Carrier & Vehicle</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <div className="amx-hma-route-icon-box">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            local_shipping
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedMovement.carrierName}</span>
                          <span style={{ fontSize: '11px', color: 'var(--amx-hma-text-subtle)' }}>
                            Plate: {selectedMovement.carrierPlate}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--amx-hma-text-muted)', marginTop: '4px' }}>
                        Driver: {selectedMovement.carrierDriver}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Movement Purpose & Attached Documentation */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  <div className="amx-hma-card-block" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <span className="amx-hma-spec-label">Movement Justification</span>
                      <p style={{ fontSize: '13px', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                        {selectedMovement.justification}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--amx-hma-text-subtle)', marginTop: '12px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        lock_clock
                      </span>
                      <span>{selectedMovement.ttl}</span>
                    </div>
                  </div>

                  <div className="amx-hma-card-block">
                    <span className="amx-hma-spec-label">Attached Manifest Files</span>
                    <div className="amx-hma-manifest-list">
                      {selectedMovement.manifestFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="amx-hma-manifest-item"
                          onClick={() => showToast(`Downloaded: ${file.name}`)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Download ${file.name}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--amx-hma-text-subtle)' }}>
                              picture_as_pdf
                            </span>
                            <span style={{ fontFamily: 'var(--amx-hma-font-mono)', fontSize: '12px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {file.name}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--amx-hma-font-mono)', fontSize: '11px', color: 'var(--amx-hma-text-subtle)', flexShrink: 0 }}>
                            {file.size}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (Chain of Custody Timeline) */}
              <div>
                <span className="amx-hma-section-label">Chain of Custody Timeline</span>
                <div className="amx-hma-timeline-track">
                  {selectedMovement.timeline.map((step, idx) => (
                    <div key={idx} className="amx-hma-timeline-step">
                      <div className={`amx-hma-timeline-icon ${step.status}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                          {step.icon}
                        </span>
                      </div>
                      <div className={`amx-hma-timeline-content ${step.status === 'exception' ? 'exception' : ''}`}>
                        <div className="amx-hma-timeline-top">
                          <span className={`amx-hma-timeline-title ${step.status === 'exception' ? 'exception' : ''}`}>
                            {step.title}
                          </span>
                          <span className={`amx-hma-timeline-time ${step.status === 'exception' ? 'exception' : ''}`}>
                            {step.time}
                          </span>
                        </div>
                        <p className="amx-hma-timeline-desc">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Host Role Permitted Actions Bar */}
            <div className="amx-hma-actions-bar">
              <div className="amx-hma-actions-disclaimer">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--amx-hma-secondary)' }}>
                  admin_panel_settings
                </span>
                <span>
                  Host role active. Master inventory edits, asset modifications, and admin approvals restricted. All events logged to local perimeter registry.
                </span>
              </div>

              <div className="amx-hma-actions-buttons">
                <button
                  type="button"
                  className="amx-hma-btn-escalate"
                  onClick={() => setIsEscalateModalOpen(true)}
                >
                  Escalate to Security Supervisor
                </button>
                <button
                  type="button"
                  className="amx-hma-btn-issue"
                  onClick={() => setIsIssueModalOpen(true)}
                >
                  Log Checkpoint Issue
                </button>
                <button
                  type="button"
                  className="amx-hma-btn-verify-primary"
                  onClick={() => setIsVerifyModalOpen(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    qr_code_scanner
                  </span>
                  <span>Verify Checkpoint Scan</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VERIFY CHECKPOINT SCAN MODAL */}
      {isVerifyModalOpen && selectedMovement && (
        <div className="amx-hma-modal-backdrop" onClick={() => setIsVerifyModalOpen(false)}>
          <div className="amx-hma-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="amx-hma-modal-header">
              <h3 className="amx-hma-modal-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--amx-hma-secondary)' }}>
                  qr_code_scanner
                </span>
                Verify Checkpoint Scan & Custody Handover
              </h3>
              <button
                type="button"
                className="amx-hma-detail-close-btn"
                onClick={() => setIsVerifyModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="amx-hma-modal-body">
              <div style={{ padding: '10px 12px', background: 'var(--amx-hma-surface-low)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>
                  {selectedMovement.id} — {selectedMovement.assetName}
                </div>
                <div style={{ fontFamily: 'var(--amx-hma-font-mono)', fontSize: '11.5px', color: 'var(--amx-hma-text-muted)', marginTop: '2px' }}>
                  Tag: {selectedMovement.assetTag} | Serial: {selectedMovement.serialNumber} | Gate Pass: {selectedMovement.gatePassId}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={verifySerialCheck}
                    onChange={(e) => setVerifySerialCheck(e.target.checked)}
                  />
                  <span>Chassis physical serial number matches movement manifest</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={verifySealCheck}
                    onChange={(e) => setVerifySealCheck(e.target.checked)}
                  />
                  <span>Tamper-evident transit seals inspected and verified intact</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={verifyBearerCheck}
                    onChange={(e) => setVerifyBearerCheck(e.target.checked)}
                  />
                  <span>Carrier identity and authorization documents verified</span>
                </label>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Checkpoint Inspector Notes:
                </label>
                <textarea
                  style={{ width: '100%', minHeight: '75px', padding: '8px', borderRadius: '6px', border: '1px solid var(--amx-hma-border)', fontSize: '13px', boxSizing: 'border-box' }}
                  placeholder="Record checkpoint scanner notes, seal numbers, or bay comments..."
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="amx-hma-modal-footer">
              <button
                type="button"
                className="amx-hma-btn-export"
                onClick={() => setIsVerifyModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="amx-hma-btn-verify-primary"
                onClick={handleCompleteVerification}
              >
                Confirm Checkpoint Clearance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG CHECKPOINT ISSUE MODAL */}
      {isIssueModalOpen && selectedMovement && (
        <div className="amx-hma-modal-backdrop" onClick={() => setIsIssueModalOpen(false)}>
          <div className="amx-hma-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="amx-hma-modal-header">
              <h3 className="amx-hma-modal-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--amx-hma-error)' }}>
                  report_problem
                </span>
                Log Checkpoint Discrepancy / Exception
              </h3>
              <button
                type="button"
                className="amx-hma-detail-close-btn"
                onClick={() => setIsIssueModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleLogIssueSubmit}>
              <div className="amx-hma-modal-body">
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Issue Type:
                  </label>
                  <select
                    className="amx-hma-filter-select"
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value)}
                  >
                    <option value="Missing secondary perimeter seal scan">Missing secondary perimeter seal scan</option>
                    <option value="Packaging Tampered or Breached">Packaging Tampered or Breached</option>
                    <option value="Corrupted / Unreadable Barcode">Corrupted / Unreadable Barcode</option>
                    <option value="Routing Deviation From Manifest">Routing Deviation From Manifest</option>
                    <option value="Unscheduled Checkpoint Arrival">Unscheduled Checkpoint Arrival</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Observations & Description:
                  </label>
                  <textarea
                    style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--amx-hma-border)', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder="Describe the discrepancy observed during corridor check-in..."
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="amx-hma-modal-footer">
                <button
                  type="button"
                  className="amx-hma-btn-export"
                  onClick={() => setIsIssueModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amx-hma-btn-verify-primary"
                >
                  Log Issue to Registry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESCALATE TO SECURITY SUPERVISOR MODAL */}
      {isEscalateModalOpen && selectedMovement && (
        <div className="amx-hma-modal-backdrop" onClick={() => setIsEscalateModalOpen(false)}>
          <div className="amx-hma-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="amx-hma-modal-header">
              <h3 className="amx-hma-modal-title" style={{ color: 'var(--amx-hma-error)' }}>
                <span className="material-symbols-outlined">
                  emergency_home
                </span>
                Escalate Movement Exception to Security Supervisor
              </h3>
              <button
                type="button"
                className="amx-hma-detail-close-btn"
                onClick={() => setIsEscalateModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleEscalationSubmit}>
              <div className="amx-hma-modal-body">
                <p style={{ fontSize: '13px', color: 'var(--amx-hma-text-muted)', margin: 0 }}>
                  Host role records perimeter security escalations. Escalation does not grant approval or override permissions. Master asset modifications remain restricted.
                </p>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Escalation Category:
                  </label>
                  <select
                    className="amx-hma-filter-select"
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                  >
                    <option value="Corridor Routing Discrepancy">Corridor Routing Discrepancy</option>
                    <option value="Missing Secondary Perimeter Seal">Missing Secondary Perimeter Seal</option>
                    <option value="Damaged Hardware During In-Transit">Damaged Hardware During In-Transit</option>
                    <option value="Unauthorized Carrier Transfer">Unauthorized Carrier Transfer</option>
                    <option value="Expired Authorization Window">Expired Authorization Window</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Incident Narrative:
                  </label>
                  <textarea
                    style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--amx-hma-border)', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder="Provide details for Security Administration review..."
                    value={escalateNotes}
                    onChange={(e) => setEscalateNotes(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="amx-hma-modal-footer">
                <button
                  type="button"
                  className="amx-hma-btn-export"
                  onClick={() => setIsEscalateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amx-hma-btn-escalate"
                  style={{ backgroundColor: 'var(--amx-hma-error)', color: '#ffffff', border: 'none' }}
                >
                  Submit Escalation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

