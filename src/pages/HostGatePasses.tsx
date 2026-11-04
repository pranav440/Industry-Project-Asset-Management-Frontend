import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  HOST_GATE_PASSES_KPIS_DATA,
  HOST_DETAILED_GATE_PASSES,
  type HostDetailedGatePass,
} from '../data/hostData';
import './HostGatePasses.css';

interface HostGatePassesPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

export const HostGatePassesPage: React.FC<HostGatePassesPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [movementFilter, setMovementFilter] = useState<string>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [selectedDate] = useState<string>('Today, 18 Feb 2026');

  // Selected Pass for Docked Inspector (defaults to first item, GP-2026-0418)
  const [selectedPassId, setSelectedPassId] = useState<string>('GP-2026-0418');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modals
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);

  // Manual Scan Input
  const [barcodeInput, setBarcodeInput] = useState('');

  // Physical Verification Checklist State
  const [checkSerialMatch, setCheckSerialMatch] = useState(false);
  const [checkSealIntact, setCheckSealIntact] = useState(false);
  const [checkBearerId, setCheckBearerId] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');

  // Escalation State
  const [escalateReason, setEscalateReason] = useState('Serial Mismatch');
  const [escalateNotes, setEscalateNotes] = useState('');

  // Toast
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
      showToast('Movement Activity log — Synchronized with Perimeter Scanners.');
    } else if (path === 'support') {
      showToast('Host Security Support: Contact Central Security Desk (Ext. 4040).');
    } else if (path === 'login' || path === 'signout') {
      onSignOut?.();
    } else {
      onNavigate?.(path);
    }
  };

  // Filtered dataset
  const filteredPasses = useMemo(() => {
    return HOST_DETAILED_GATE_PASSES.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          item.id.toLowerCase().includes(q) ||
          item.requesterName.toLowerCase().includes(q) ||
          item.requesterBadge.toLowerCase().includes(q) ||
          item.assetName.toLowerCase().includes(q) ||
          item.assetTag.toLowerCase().includes(q) ||
          item.serialNumber.toLowerCase().includes(q) ||
          item.department.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // Status filter
      if (statusFilter !== 'All' && item.status !== statusFilter) {
        return false;
      }

      // Movement filter
      if (movementFilter !== 'All' && item.movementType !== movementFilter) {
        return false;
      }

      // Dept filter
      if (deptFilter !== 'All' && item.department !== deptFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, statusFilter, movementFilter, deptFilter]);

  // Selected pass record
  const selectedPass: HostDetailedGatePass | undefined = useMemo(() => {
    return (
      HOST_DETAILED_GATE_PASSES.find((p) => p.id === selectedPassId) ||
      filteredPasses[0] ||
      HOST_DETAILED_GATE_PASSES[0]
    );
  }, [selectedPassId, filteredPasses]);

  // Pagination calculation
  const totalRecords = filteredPasses.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedPasses = filteredPasses.slice(startIndex, startIndex + rowsPerPage);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setMovementFilter('All');
    setDeptFilter('All');
    setCurrentPage(1);
    showToast('Filters reset to default view.');
  };

  const handleSelectPass = (pass: HostDetailedGatePass) => {
    setSelectedPassId(pass.id);
    setIsInspectorOpen(true);
  };

  const handleExportLog = () => {
    showToast('Exporting Host Gate Pass log (CSV/PDF) — Download initiated.');
  };

  const handleQuickScan = (code: string) => {
    setBarcodeInput(code);
    const found = HOST_DETAILED_GATE_PASSES.find(
      (p) => p.id === code || p.assetTag === code || p.serialNumber.includes(code)
    );
    if (found) {
      setSelectedPassId(found.id);
      setIsInspectorOpen(true);
      setIsScanModalOpen(false);
      showToast(`Gate Pass identified: ${found.id} (${found.assetName}).`);
    } else {
      showToast(`Scan code "${code}" not found in current checkpoint registry.`);
    }
  };

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleQuickScan(barcodeInput.trim());
  };

  const handleCompleteVerification = () => {
    if (!checkSerialMatch) {
      showToast('Attention: Physical serial number check must be completed.');
      return;
    }
    setIsVerifyModalOpen(false);
    setCheckSerialMatch(false);
    setCheckSealIntact(false);
    setCheckBearerId(false);
    setVerifyNotes('');
    showToast(`Physical verification logged for ${selectedPass?.id}. Checkpoint clearance recorded.`);
  };

  const handleCheckinLog = () => {
    showToast(`Custody check-in logged for ${selectedPass?.id} at Checkpoint Gate-04A.`);
  };

  const handleEscalationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEscalateModalOpen(false);
    setEscalateNotes('');
    showToast(
      `Discrepancy on ${selectedPass?.id} escalated to Security Supervisor queue (${escalateReason}).`
    );
  };

  return (
    <DashboardLayout
      currentNav="gate-pass"
      role="host"
      onNavigate={handleNav}
      onSignOut={onSignOut}
    >
      <div className="amx-hgp-container">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="amx-hgp-toast" role="status">
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#57dffe' }}>
              info
            </span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* PAGE BREADCRUMB & HEADER */}
        <div className="amx-hgp-header-section">
          <div className="amx-hgp-breadcrumb">
            <span
              className="amx-hgp-breadcrumb-link"
              onClick={() => handleNav('dashboard')}
            >
              Host Dashboard
            </span>
            <span className="amx-hgp-breadcrumb-sep">/</span>
            <span className="amx-hgp-breadcrumb-current">Gate Passes</span>
          </div>

          <div className="amx-hgp-title-bar">
            <div className="amx-hgp-title-left">
              <div className="amx-hgp-title-row">
                <h1 className="amx-hgp-headline">Gate Passes</h1>
                <span className="amx-hgp-active-registry-badge">
                  <span className="amx-hgp-active-dot" />
                  Active Registry • Checkpoint Gate-04A
                </span>
              </div>
              <p className="amx-hgp-subtitle">
                Monitor, physically inspect, and audit inbound and outbound enterprise asset movements.
              </p>
            </div>

            <div className="amx-hgp-header-actions">
              <button
                type="button"
                className="amx-hgp-btn-export"
                onClick={handleExportLog}
                aria-label="Export Gate Pass Log"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  download
                </span>
                <span>Export Log</span>
              </button>
              <button
                type="button"
                className="amx-hgp-btn-scan"
                onClick={() => setIsScanModalOpen(true)}
                aria-label="Scan QR or Barcode"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>
                  qr_code_scanner
                </span>
                <span>Scan QR / Barcode</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI CARDS */}
        <div className="amx-hgp-kpi-grid">
          {/* 1. Total Gate Passes */}
          <div className="amx-hgp-kpi-card">
            <div className="amx-hgp-kpi-header">
              <span className="amx-hgp-kpi-title">Total Gate Passes</span>
              <span className="amx-hgp-kpi-badge">
                {HOST_GATE_PASSES_KPIS_DATA.totalPasses.badgeText}
              </span>
            </div>
            <div className="amx-hgp-kpi-content">
              <div className="amx-hgp-kpi-number">
                {HOST_GATE_PASSES_KPIS_DATA.totalPasses.total}
              </div>
              <span className="material-symbols-outlined amx-hgp-kpi-icon">
                receipt_long
              </span>
            </div>
            <p className="amx-hgp-kpi-footer">
              {HOST_GATE_PASSES_KPIS_DATA.totalPasses.subtext}
            </p>
          </div>

          {/* 2. Pending Verification */}
          <div className="amx-hgp-kpi-card">
            <div className="amx-hgp-kpi-header">
              <span className="amx-hgp-kpi-title">Pending Verification</span>
              <span className="amx-hgp-kpi-badge priority">
                {HOST_GATE_PASSES_KPIS_DATA.pendingVerification.badgeText}
              </span>
            </div>
            <div className="amx-hgp-kpi-content">
              <div className="amx-hgp-kpi-number">
                {HOST_GATE_PASSES_KPIS_DATA.pendingVerification.total}
              </div>
              <span className="material-symbols-outlined amx-hgp-kpi-icon error">
                pending_actions
              </span>
            </div>
            <p className="amx-hgp-kpi-footer">
              {HOST_GATE_PASSES_KPIS_DATA.pendingVerification.subtext}
            </p>
          </div>

          {/* 3. In Progress */}
          <div className="amx-hgp-kpi-card">
            <div className="amx-hgp-kpi-header">
              <span className="amx-hgp-kpi-title">In Progress</span>
              <span className="amx-hgp-kpi-badge cyan">
                {HOST_GATE_PASSES_KPIS_DATA.inProgress.badgeText}
              </span>
            </div>
            <div className="amx-hgp-kpi-content">
              <div className="amx-hgp-kpi-number">
                {HOST_GATE_PASSES_KPIS_DATA.inProgress.total}
              </div>
              <span className="material-symbols-outlined amx-hgp-kpi-icon secondary">
                local_shipping
              </span>
            </div>
            <p className="amx-hgp-kpi-footer">
              {HOST_GATE_PASSES_KPIS_DATA.inProgress.subtext}
            </p>
          </div>

          {/* 4. Completed */}
          <div className="amx-hgp-kpi-card">
            <div className="amx-hgp-kpi-header">
              <span className="amx-hgp-kpi-title">Completed</span>
              <span className="amx-hgp-kpi-badge">
                {HOST_GATE_PASSES_KPIS_DATA.completed.badgeText}
              </span>
            </div>
            <div className="amx-hgp-kpi-content">
              <div className="amx-hgp-kpi-number">
                {HOST_GATE_PASSES_KPIS_DATA.completed.total}
              </div>
              <span className="material-symbols-outlined amx-hgp-kpi-icon">
                verified
              </span>
            </div>
            <p className="amx-hgp-kpi-footer">
              {HOST_GATE_PASSES_KPIS_DATA.completed.subtext}
            </p>
          </div>
        </div>

        {/* MAIN TWO-COLUMN WORKSPACE: TABLE + DOCKED SIDE INSPECTOR */}
        <div className="amx-hgp-workspace">
          {/* DATA TABLE CONTAINER */}
          <div className="amx-hgp-table-container">
            {/* Filter Toolbar */}
            <div className="amx-hgp-filter-toolbar">
              <div className="amx-hgp-filter-row">
                <div className="amx-hgp-search-wrap">
                  <span className="material-symbols-outlined amx-hgp-search-icon">
                    search
                  </span>
                  <input
                    type="text"
                    className="amx-hgp-search-input"
                    placeholder="Search by Gate Pass ID, requester, or asset tag..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div className="amx-hgp-filter-select-wrap">
                  <select
                    className="amx-hgp-filter-select"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter by Status"
                  >
                    <option value="All">Status: All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Escalated">Escalated</option>
                    <option value="Completed">Completed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  <span className="material-symbols-outlined amx-hgp-filter-select-icon">
                    expand_more
                  </span>
                </div>

                <div className="amx-hgp-filter-select-wrap">
                  <select
                    className="amx-hgp-filter-select"
                    value={movementFilter}
                    onChange={(e) => {
                      setMovementFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter by Movement"
                  >
                    <option value="All">Movement: All</option>
                    <option value="Outbound Dispatch">Outbound Dispatch</option>
                    <option value="Inbound Intake">Inbound Intake</option>
                  </select>
                  <span className="material-symbols-outlined amx-hgp-filter-select-icon">
                    expand_more
                  </span>
                </div>

                <div className="amx-hgp-filter-select-wrap">
                  <select
                    className="amx-hgp-filter-select"
                    value={deptFilter}
                    onChange={(e) => {
                      setDeptFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter by Department"
                  >
                    <option value="All">Dept: All Departments</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Facilities">Facilities</option>
                    <option value="QA Labs">QA Labs</option>
                    <option value="IT Operations">IT Operations</option>
                  </select>
                  <span className="material-symbols-outlined amx-hgp-filter-select-icon">
                    expand_more
                  </span>
                </div>

                <button
                  type="button"
                  className="amx-hgp-btn-date"
                  onClick={() => showToast('Date filter: Showing entries for 18 Feb 2026.')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                    calendar_today
                  </span>
                  <span>{selectedDate}</span>
                </button>

                <button
                  type="button"
                  className="amx-hgp-btn-reset"
                  onClick={handleResetFilters}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    restart_alt
                  </span>
                  <span>Reset</span>
                </button>
              </div>

              <div className="amx-hgp-filter-meta">
                <span>
                  Showing <strong>{filteredPasses.length}</strong> of{' '}
                  <strong>{HOST_GATE_PASSES_KPIS_DATA.totalPasses.total}</strong> Gate Passes
                </span>
                <span className="amx-hgp-live-sync">
                  <span className="amx-hgp-live-sync-dot" />
                  Live Sync Active
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="amx-hgp-table-wrapper">
              <table className="amx-hgp-table">
                <thead>
                  <tr>
                    <th>Gate Pass ID</th>
                    <th>Requester</th>
                    <th>Department</th>
                    <th>Asset / Item</th>
                    <th>Movement Type</th>
                    <th>Scheduled Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPasses.map((pass) => {
                    const isSelected = selectedPass?.id === pass.id;
                    const statusClass = pass.status.toLowerCase().replace(/\s+/g, '-');
                    const moveClass =
                      pass.movementType === 'Outbound Dispatch' ? 'outbound' : 'inbound';
                    const moveIcon =
                      pass.movementType === 'Outbound Dispatch'
                        ? 'arrow_outward'
                        : 'arrow_downward';

                    return (
                      <tr
                        key={pass.id}
                        className={`amx-hgp-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectPass(pass)}
                      >
                        <td className="amx-hgp-cell-id">{pass.id}</td>
                        <td>
                          <div className="amx-hgp-requester-cell">
                            <div
                              className={`amx-hgp-avatar ${
                                isSelected ? '' : 'subtle'
                              }`}
                            >
                              {pass.requesterInitials}
                            </div>
                            <div className="amx-hgp-requester-info">
                              <span className="amx-hgp-requester-name">
                                {pass.requesterName}
                              </span>
                              <span className="amx-hgp-requester-badge">
                                {pass.requesterBadge}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--amx-hgp-text-muted)' }}>
                          {pass.department}
                        </td>
                        <td>
                          <div className="amx-hgp-asset-info">
                            <span className="amx-hgp-asset-name">
                              {pass.assetName}
                            </span>
                            <span className="amx-hgp-asset-tag">
                              TAG: {pass.assetTag}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`amx-hgp-move-pill ${moveClass}`}>
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: '14px' }}
                            >
                              {moveIcon}
                            </span>
                            {pass.movementType}
                          </span>
                        </td>
                        <td
                          style={{
                            fontFamily: 'var(--amx-hgp-font-mono)',
                            color: 'var(--amx-hgp-text-muted)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {pass.scheduledDate}
                        </td>
                        <td>
                          <span className={`amx-hgp-status-pill ${statusClass}`}>
                            <span className="dot" />
                            {pass.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isSelected ? (
                            <button
                              type="button"
                              className="amx-hgp-btn-action-selected"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsInspectorOpen(true);
                              }}
                            >
                              Selected
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="amx-hgp-btn-action-view"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPass(pass);
                              }}
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedPasses.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px' }}>
                        <p style={{ margin: 0, fontWeight: 600 }}>No gate passes match the selected filters.</p>
                        <button
                          type="button"
                          className="amx-hgp-btn-action-view"
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

            {/* Pagination */}
            <div className="amx-hgp-pagination">
              <div className="amx-hgp-pag-left">
                <span>
                  Showing {totalRecords === 0 ? 0 : startIndex + 1}-
                  {Math.min(startIndex + rowsPerPage, totalRecords)} of {totalRecords} records
                </span>
                <span style={{ opacity: 0.4 }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Rows per page:</span>
                  <select
                    className="amx-hgp-rows-select"
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
                </div>
              </div>

              <div className="amx-hgp-pag-right">
                <span style={{ marginRight: '6px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="amx-hgp-pag-btn"
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
                  className="amx-hgp-pag-btn"
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

          {/* RIGHT INSPECTION PANEL (DOCKED SIDE DRAWER 440px) */}
          {isInspectorOpen && selectedPass && (
            <aside className="amx-hgp-inspector-panel" aria-label="Perimeter Inspection Details">
              {/* Drawer Header */}
              <div className="amx-hgp-inspector-header">
                <div className="amx-hgp-inspector-header-left">
                  <div className="amx-hgp-inspector-meta-row">
                    <span className="amx-hgp-inspector-id">{selectedPass.id}</span>
                    <span
                      className={`amx-hgp-status-pill ${selectedPass.status
                        .toLowerCase()
                        .replace(/\s+/g, '-')}`}
                    >
                      <span className="dot" />
                      {selectedPass.status}
                    </span>
                  </div>
                  <h2 className="amx-hgp-inspector-title">Perimeter Inspection</h2>
                </div>
                <button
                  type="button"
                  className="amx-hgp-inspector-close-btn"
                  onClick={() => setIsInspectorOpen(false)}
                  aria-label="Close Inspector"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    close
                  </span>
                </button>
              </div>

              {/* Drawer Body */}
              <div className="amx-hgp-inspector-body">
                {/* 1. Requester Information Card */}
                <div className="amx-hgp-drawer-card">
                  <span className="amx-hgp-drawer-section-title">
                    Requester Information
                  </span>
                  <div className="amx-hgp-drawer-profile-row">
                    <div className="amx-hgp-drawer-avatar">
                      {selectedPass.requesterInitials}
                    </div>
                    <div className="amx-hgp-drawer-profile-meta">
                      <span className="amx-hgp-drawer-profile-name">
                        {selectedPass.requesterName}
                      </span>
                      <span className="amx-hgp-drawer-profile-role">
                        {selectedPass.requesterRole}
                      </span>
                    </div>
                  </div>
                  <div className="amx-hgp-drawer-contact-grid">
                    <div>
                      Badge: <strong>{selectedPass.requesterBadge.replace('#', '')}</strong>
                    </div>
                    <div>
                      Ext: <strong>{selectedPass.requesterExt}</strong>
                    </div>
                    <div className="full-col">
                      Contact: <strong>{selectedPass.requesterEmail}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Inspected Asset */}
                <div className="amx-hgp-asset-card">
                  <div className="amx-hgp-asset-header">
                    <div>
                      <h3 className="amx-hgp-asset-title">{selectedPass.assetName}</h3>
                      <p className="amx-hgp-asset-spec">{selectedPass.assetSpec}</p>
                    </div>
                    <span className="amx-hgp-asset-badge">
                      {selectedPass.assetCondition}
                    </span>
                  </div>

                  <div className="amx-hgp-asset-tags-grid">
                    <div className="amx-hgp-tag-box">
                      <span className="amx-hgp-tag-label">Asset Tag</span>
                      <span className="amx-hgp-tag-val">{selectedPass.assetTag}</span>
                    </div>
                    <div
                      className={`amx-hgp-tag-box ${
                        selectedPass.isSerialMismatch ? 'mismatch' : ''
                      }`}
                    >
                      <span className="amx-hgp-tag-label">
                        {selectedPass.isSerialMismatch
                          ? 'Serial (Reported)'
                          : 'Chassis Serial'}
                      </span>
                      <span className="amx-hgp-tag-val">
                        {selectedPass.serialNumber}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Perimeter Movement Parameters */}
                <div className="amx-hgp-drawer-card">
                  <span className="amx-hgp-drawer-section-title">
                    Perimeter Movement Parameters
                  </span>
                  <div className="amx-hgp-param-row">
                    <span className="label">Movement Class:</span>
                    <span className="val cyan">{selectedPass.movementClass}</span>
                  </div>
                  <div className="amx-hgp-param-row">
                    <span className="label">Origin Point:</span>
                    <span className="val">{selectedPass.originPoint}</span>
                  </div>
                  <div className="amx-hgp-param-row">
                    <span className="label">Destination:</span>
                    <span className="val">{selectedPass.destination}</span>
                  </div>
                  <div className="amx-hgp-param-row">
                    <span className="label">Scheduled Window:</span>
                    <span className="val">{selectedPass.scheduledWindow}</span>
                  </div>
                  <div className="amx-hgp-param-row">
                    <span className="label">Designated Carrier:</span>
                    <span className="val">{selectedPass.carrier}</span>
                  </div>
                </div>

                {/* 4. Supporting Documentation */}
                <div className="amx-hgp-drawer-card">
                  <span className="amx-hgp-drawer-section-title">
                    Supporting Documentation
                  </span>
                  <div className="amx-hgp-doc-list">
                    {selectedPass.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="amx-hgp-doc-item"
                        onClick={() => showToast(`Downloaded document: ${doc.name}`)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Download ${doc.name}`}
                      >
                        <div className="amx-hgp-doc-info">
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '20px', color: 'var(--amx-hgp-secondary)' }}
                          >
                            {doc.isVerified ? 'description' : 'assignment_turned_in'}
                          </span>
                          <div className="amx-hgp-doc-text">
                            <span className="amx-hgp-doc-name">{doc.name}</span>
                            <span className="amx-hgp-doc-sub">
                              {doc.type} • {doc.size}
                            </span>
                          </div>
                        </div>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '18px', color: 'var(--amx-hgp-text-muted)' }}
                        >
                          download
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Checkpoint Audit Trail */}
                <div className="amx-hgp-drawer-card">
                  <span className="amx-hgp-drawer-section-title">
                    Checkpoint Audit Trail
                  </span>
                  <div className="amx-hgp-timeline">
                    {selectedPass.auditTrail.map((item, idx) => (
                      <div key={idx} className="amx-hgp-timeline-node">
                        <span
                          className={`amx-hgp-timeline-dot ${
                            item.isIncident
                              ? 'incident'
                              : item.isCurrent
                              ? 'current'
                              : ''
                          }`}
                        />
                        <div
                          className={`amx-hgp-timeline-time ${
                            item.isIncident ? 'incident' : ''
                          }`}
                        >
                          {item.time}
                        </div>
                        <p className="amx-hgp-timeline-desc">{item.event}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Host Permissions Actions Footer */}
              <div className="amx-hgp-inspector-footer">
                <button
                  type="button"
                  className="amx-hgp-btn-verify-primary"
                  onClick={() => setIsVerifyModalOpen(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>
                    verified_user
                  </span>
                  <span>Verify Physical Serial & Clearance</span>
                </button>

                <div className="amx-hgp-footer-actions-grid">
                  <button
                    type="button"
                    className="amx-hgp-btn-checkin"
                    onClick={handleCheckinLog}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                      inventory
                    </span>
                    <span>Log Check-in</span>
                  </button>

                  <button
                    type="button"
                    className="amx-hgp-btn-escalate"
                    onClick={() => setIsEscalateModalOpen(true)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                      emergency_home
                    </span>
                    <span>Escalate to Supervisor</span>
                  </button>
                </div>

                <p className="amx-hgp-role-disclaimer">
                  Host role active. Master inventory edits and admin approvals restricted.
                </p>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* SCAN QR / BARCODE MODAL */}
      {isScanModalOpen && (
        <div className="amx-hgp-modal-backdrop" onClick={() => setIsScanModalOpen(false)}>
          <div className="amx-hgp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="amx-hgp-modal-header">
              <h3 className="amx-hgp-modal-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--amx-hgp-secondary)' }}>
                  qr_code_scanner
                </span>
                Scan Gate Pass or Asset Barcode
              </h3>
              <button
                type="button"
                className="amx-hgp-inspector-close-btn"
                onClick={() => setIsScanModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="amx-hgp-modal-body">
              <div className="amx-hgp-viewfinder">
                <div className="amx-hgp-scan-laser" />
                <div className="amx-hgp-crosshair" />
              </div>

              <form onSubmit={handleManualScanSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="amx-hgp-search-input"
                  placeholder="Enter Pass ID or Asset Tag manually..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="amx-hgp-btn-scan"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Locate
                </button>
              </form>

              <div>
                <span className="amx-hgp-drawer-section-title" style={{ display: 'block', marginBottom: '8px' }}>
                  Quick Scan Simulators:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    type="button"
                    className="amx-hgp-btn-action-view"
                    onClick={() => handleQuickScan('GP-2026-0418')}
                  >
                    GP-2026-0418 (Cisco Switch)
                  </button>
                  <button
                    type="button"
                    className="amx-hgp-btn-action-view"
                    onClick={() => handleQuickScan('GP-2026-0415')}
                  >
                    GP-2026-0415 (Fluke Tester)
                  </button>
                  <button
                    type="button"
                    className="amx-hgp-btn-action-view"
                    onClick={() => handleQuickScan('AST-2024-0042')}
                  >
                    AST-2024-0042 (Asset Tag)
                  </button>
                </div>
              </div>
            </div>
            <div className="amx-hgp-modal-footer">
              <button
                type="button"
                className="amx-hgp-btn-export"
                onClick={() => setIsScanModalOpen(false)}
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFY PHYSICAL SERIAL & CLEARANCE MODAL */}
      {isVerifyModalOpen && selectedPass && (
        <div className="amx-hgp-modal-backdrop" onClick={() => setIsVerifyModalOpen(false)}>
          <div className="amx-hgp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="amx-hgp-modal-header">
              <h3 className="amx-hgp-modal-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--amx-hgp-secondary)' }}>
                  verified_user
                </span>
                Physical Serial & Custody Clearance
              </h3>
              <button
                type="button"
                className="amx-hgp-inspector-close-btn"
                onClick={() => setIsVerifyModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="amx-hgp-modal-body">
              <div style={{ padding: '10px 12px', background: 'var(--amx-hgp-surface-low)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedPass.id} — {selectedPass.assetName}</div>
                <div style={{ fontFamily: 'var(--amx-hgp-font-mono)', fontSize: '11.5px', color: 'var(--amx-hgp-text-muted)', marginTop: '2px' }}>
                  Tag: {selectedPass.assetTag} | Expected Serial: {selectedPass.serialNumber}
                </div>
              </div>

              <div className="amx-hgp-checklist">
                <label className="amx-hgp-check-item">
                  <input
                    type="checkbox"
                    checked={checkSerialMatch}
                    onChange={(e) => setCheckSerialMatch(e.target.checked)}
                  />
                  <span>Chassis serial stamp physically inspected against manifest</span>
                </label>

                <label className="amx-hgp-check-item">
                  <input
                    type="checkbox"
                    checked={checkSealIntact}
                    onChange={(e) => setCheckSealIntact(e.target.checked)}
                  />
                  <span>Physical anti-tamper security seals intact & undamaged</span>
                </label>

                <label className="amx-hgp-check-item">
                  <input
                    type="checkbox"
                    checked={checkBearerId}
                    onChange={(e) => setCheckBearerId(e.target.checked)}
                  />
                  <span>Bearer photo identity confirmed ({selectedPass.requesterName})</span>
                </label>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Inspection & Clearance Notes:
                </label>
                <textarea
                  className="amx-hgp-textarea"
                  placeholder="Record serial inspection observations, gate notes, or discrepancy flags..."
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="amx-hgp-modal-footer">
              <button
                type="button"
                className="amx-hgp-btn-export"
                onClick={() => setIsVerifyModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="amx-hgp-btn-scan"
                onClick={handleCompleteVerification}
              >
                Confirm Physical Clearance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESCALATE TO SUPERVISOR MODAL */}
      {isEscalateModalOpen && selectedPass && (
        <div className="amx-hgp-modal-backdrop" onClick={() => setIsEscalateModalOpen(false)}>
          <div className="amx-hgp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="amx-hgp-modal-header">
              <h3 className="amx-hgp-modal-title" style={{ color: 'var(--amx-hgp-error)' }}>
                <span className="material-symbols-outlined">
                  emergency_home
                </span>
                Escalate Gate Pass to Security Supervisor
              </h3>
              <button
                type="button"
                className="amx-hgp-inspector-close-btn"
                onClick={() => setIsEscalateModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleEscalationSubmit}>
              <div className="amx-hgp-modal-body">
                <p style={{ fontSize: '13px', color: 'var(--amx-hgp-text-muted)', margin: 0 }}>
                  Host role permits escalating gate incidents to Security Administration. Host cannot modify asset inventory or perform admin approval overrides.
                </p>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Escalation Category:
                  </label>
                  <select
                    className="amx-hgp-filter-select"
                    style={{ width: '100%' }}
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                  >
                    <option value="Serial Mismatch">Serial Number Mismatch (Manifest vs Hardware)</option>
                    <option value="Unscheduled Movement">Unscheduled Gate Arrival Window</option>
                    <option value="Missing Custody Authorization">Missing Signed Chain of Custody Form</option>
                    <option value="Damaged Asset / Broken Seal">Damaged Asset / Broken Transit Seal</option>
                    <option value="Other Security Exception">Other Perimeter Security Exception</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Incident Narrative & Description:
                  </label>
                  <textarea
                    className="amx-hgp-textarea"
                    placeholder="Describe the discrepancy observed during perimeter inspection..."
                    value={escalateNotes}
                    onChange={(e) => setEscalateNotes(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="amx-hgp-modal-footer">
                <button
                  type="button"
                  className="amx-hgp-btn-export"
                  onClick={() => setIsEscalateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amx-hgp-btn-escalate"
                  style={{ color: '#ffffff', backgroundColor: 'var(--amx-hgp-error)', border: 'none' }}
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
