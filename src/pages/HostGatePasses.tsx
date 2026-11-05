import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  listGatePasses,
  getGatePass,
  GatePassApiError,
  type GatePassApiRecord,
} from '../api/gatePassApi';
import {
  getHostDashboard,
} from '../services/dashboardApi';
import { type MovementDirection } from '../data/hostData';
import './HostGatePasses.css';

interface HostGatePassesPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

export interface HostGatePassUIItem {
  id: string;
  requesterName: string;
  requesterInitials: string;
  requesterBadge: string;
  requesterRole: string;
  requesterExt: string;
  requesterEmail: string;
  department: string;
  assetName: string;
  assetTag: string;
  assetSpec: string;
  assetCondition: string;
  serialNumber: string;
  isSerialMismatch?: boolean;
  movementType: MovementDirection;
  movementClass: string;
  originPoint: string;
  destination: string;
  scheduledDate: string;
  scheduledWindow: string;
  carrier: string;
  status: string;
  documents: Array<{
    name: string;
    type: string;
    size: string;
    isVerified?: boolean;
  }>;
  auditTrail: Array<{
    time: string;
    event: string;
    isIncident?: boolean;
    isCurrent?: boolean;
  }>;
}

interface HostGatePassesKpisState {
  totalPasses: {
    total: number | string;
    badgeText: string;
    subtext: string;
  };
  pendingVerification: {
    total: number | string;
    badgeText: string;
    subtext: string;
  };
  inProgress: {
    total: number | string;
    badgeText: string;
    subtext: string;
  };
  completed: {
    total: number | string;
    badgeText: string;
    subtext: string;
  };
}

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'GP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return 'Not scheduled';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTimeDisplay(isoStr?: string | null): string {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `${time} · ${date}`;
  } catch {
    return isoStr;
  }
}

export function mapApiRecordToHostPass(apiRecord: GatePassApiRecord): HostGatePassUIItem {
  const isReturnIntake =
    apiRecord.pass_type === 'Returnable' && apiRecord.exit_status === 'Verified';
  const movementType: MovementDirection = isReturnIntake ? 'Inbound Intake' : 'Outbound Dispatch';

  const auditTrail =
    apiRecord.history && apiRecord.history.length > 0
      ? apiRecord.history.map((h, idx) => ({
          time: formatTimeDisplay(h.timestamp),
          event: `${h.action.replace(/_/g, ' ')} by ${h.performed_by || 'System'}${
            h.note ? ` — "${h.note}"` : ''
          }`,
          isIncident:
            h.action.toLowerCase().includes('escalat') ||
            h.action.toLowerCase().includes('reject'),
          isCurrent: idx === (apiRecord.history?.length ?? 1) - 1,
        }))
      : [
          {
            time: formatTimeDisplay(apiRecord.created_at || apiRecord.request_date),
            event: `Gate pass created for ${apiRecord.requester_name}`,
            isCurrent: true,
          },
        ];

  const schedDate = formatDateDisplay(apiRecord.movement_date || apiRecord.request_date);

  return {
    id: apiRecord.pass_id,
    requesterName: apiRecord.requester_name || 'Host User',
    requesterInitials: getInitials(apiRecord.requester_name),
    requesterBadge: 'Not available',
    requesterRole: 'Host Requester',
    requesterExt: 'Not available',
    requesterEmail: 'Not available',
    department: apiRecord.department || 'General',
    assetName: apiRecord.asset_or_item || 'Asset Item',
    assetTag: 'Not available',
    assetSpec: apiRecord.purpose || 'Standard transit clearance manifest',
    assetCondition: apiRecord.quantity > 1 ? `Qty: ${apiRecord.quantity}` : 'Operational',
    serialNumber: 'Not available',
    isSerialMismatch: Boolean(
      apiRecord.escalation_is_escalated &&
        apiRecord.escalation_reason?.toLowerCase().includes('serial')
    ),
    movementType,
    movementClass: apiRecord.pass_type || 'Asset Movement',
    originPoint: apiRecord.current_location || 'Internal Facility',
    destination: apiRecord.destination || 'External Site',
    scheduledDate: schedDate,
    scheduledWindow: `${schedDate} (Business Hours)`,
    carrier: apiRecord.exit_officer
      ? `Officer ${apiRecord.exit_officer}`
      : 'Designated Courier / Bearer',
    status: apiRecord.status,
    documents: [],
    auditTrail,
  };
}

export const HostGatePassesPage: React.FC<HostGatePassesPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [movementFilter, setMovementFilter] = useState<string>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Selected Pass for Docked Inspector
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<HostGatePassUIItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Loading and Error States
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Loaded passes
  const [passes, setPasses] = useState<HostGatePassUIItem[]>([]);

  // KPI Metrics State
  const [kpis, setKpis] = useState<HostGatePassesKpisState | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  // Modals
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);

  // Manual Scan Input
  const [barcodeInput, setBarcodeInput] = useState('');

  // Physical Verification Checklist State (Preview only for Host)
  const [checkSerialMatch, setCheckSerialMatch] = useState(false);
  const [checkSealIntact, setCheckSealIntact] = useState(false);
  const [checkBearerId, setCheckBearerId] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');

  // Escalation State (Preview only for Host)
  const [escalateReason, setEscalateReason] = useState('Serial Mismatch');
  const [escalateNotes, setEscalateNotes] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const handleNav = (path: string) => {
    if (path === 'dashboard' || path === 'Host Dashboard') {
      onNavigate?.('dashboard');
    } else if (path === 'gate-pass' || path === 'Gate Passes') {
      onNavigate?.('gate-pass');
    } else if (path === 'movement' || path === 'movement-activity' || path === 'Movement Activity') {
      onNavigate?.('movement');
    } else if (path === 'support') {
      showToast('Host Security Support: Contact Central Security Desk (Ext. 4040).');
    } else if (path === 'login' || path === 'signout') {
      onSignOut?.();
    } else {
      onNavigate?.(path);
    }
  };

  // Fetch KPI cards data using real backend endpoints
  const fetchKpis = useCallback(async () => {
    setKpiLoading(true);
    try {
      const [dashResult, completedResult, allResult] = await Promise.allSettled([
        getHostDashboard(),
        listGatePasses({ status: 'Completed', page_size: 1 }),
        listGatePasses({ page_size: 1 }),
      ]);

      const dashKpis =
        dashResult.status === 'fulfilled'
          ? dashResult.value.kpis || dashResult.value.summary
          : null;
      const completedTotal =
        completedResult.status === 'fulfilled' ? completedResult.value.total : null;
      const allTotal = allResult.status === 'fulfilled' ? allResult.value.total : null;

      setKpis({
        totalPasses: {
          total: allTotal !== null ? allTotal : '—',
          badgeText: 'Host Scope',
          subtext: 'Registered to authenticated host',
        },
        pendingVerification: {
          total: dashKpis?.pendingHostActions?.total ?? '—',
          badgeText: dashKpis?.pendingHostActions?.badgeText ?? 'Pending Action',
          subtext: dashKpis?.pendingHostActions?.subtext ?? 'Awaiting clearance review or return intake',
        },
        inProgress: {
          total: dashKpis?.activeGatePasses?.total ?? '—',
          badgeText: dashKpis?.activeGatePasses?.badgeText ?? 'Active',
          subtext: 'Active in-transit perimeter passes',
        },
        completed: {
          total: completedTotal !== null ? completedTotal : '—',
          badgeText: 'Archived',
          subtext: 'Completed & returned clearances',
        },
      });
    } catch {
      // Do not fabricate values if derivation fails
      setKpis({
        totalPasses: { total: '—', badgeText: 'Unavailable', subtext: 'Data unavailable' },
        pendingVerification: { total: '—', badgeText: 'Unavailable', subtext: 'Data unavailable' },
        inProgress: { total: '—', badgeText: 'Unavailable', subtext: 'Data unavailable' },
        completed: { total: '—', badgeText: 'Unavailable', subtext: 'Data unavailable' },
      });
    } finally {
      setKpiLoading(false);
    }
  }, []);

  // Fetch gate passes from backend
  const fetchPasses = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      let apiStatus: string | undefined = undefined;
      if (statusFilter !== 'All') {
        apiStatus = statusFilter === 'In Progress' ? 'Active' : statusFilter;
      }

      const res = await listGatePasses({
        search: debouncedSearch.trim() || undefined,
        status: apiStatus,
        page: currentPage,
        page_size: rowsPerPage,
      });

      const mapped = (res.items || []).map(mapApiRecordToHostPass);
      setPasses(mapped);
      setTotalRecords(res.total || 0);

      if (mapped.length > 0) {
        setSelectedPassId((prevId) => {
          if (prevId && mapped.some((p) => p.id === prevId)) {
            return prevId;
          }
          return mapped[0].id;
        });
      } else {
        setSelectedPassId(null);
        setSelectedDetail(null);
      }
    } catch (err: unknown) {
      const message =
        err instanceof GatePassApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to load gate passes from server';
      setApiError(message);
      setPasses([]);
      setTotalRecords(0);
      setSelectedPassId(null);
      setSelectedDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, currentPage, rowsPerPage]);

  // Initial load and filter change trigger
  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  // Fetch complete details with history when a pass is selected
  useEffect(() => {
    if (!selectedPassId) {
      setSelectedDetail(null);
      return;
    }
    let active = true;
    getGatePass(selectedPassId)
      .then((record) => {
        if (!active) return;
        setSelectedDetail(mapApiRecordToHostPass(record));
      })
      .catch(() => {
        if (!active) return;
        const fallback = passes.find((p) => p.id === selectedPassId) || null;
        setSelectedDetail(fallback);
      });
    return () => {
      active = false;
    };
  }, [selectedPassId, passes]);

  // Client-side refinements for filters unsupported by backend parameters (movement & department)
  const filteredPasses = useMemo(() => {
    return passes.filter((item) => {
      if (movementFilter !== 'All' && item.movementType !== movementFilter) {
        return false;
      }
      if (deptFilter !== 'All' && item.department.toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [passes, movementFilter, deptFilter]);

  // Selected pass for inspector drawer
  const selectedPass: HostGatePassUIItem | null = useMemo(() => {
    if (selectedDetail) return selectedDetail;
    if (selectedPassId) {
      const inPasses = passes.find((p) => p.id === selectedPassId);
      if (inPasses) return inPasses;
    }
    return filteredPasses[0] || null;
  }, [selectedDetail, selectedPassId, passes, filteredPasses]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const paginatedPasses = filteredPasses;

  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('All');
    setMovementFilter('All');
    setDeptFilter('All');
    setCurrentPage(1);
    showToast('Filters reset to default view.');
  };

  const handleSelectPass = (pass: HostGatePassUIItem) => {
    setSelectedPassId(pass.id);
    setIsInspectorOpen(true);
  };

  const handleExportLog = () => {
    if (filteredPasses.length === 0) {
      showToast('No gate pass records available to export.');
      return;
    }
    const headers = [
      'Pass ID',
      'Requester Name',
      'Department',
      'Asset Name',
      'Status',
      'Movement Type',
      'Scheduled Date',
      'Origin Point',
      'Destination',
    ];
    const rows = filteredPasses.map((p) => [
      `"${p.id.replace(/"/g, '""')}"`,
      `"${p.requesterName.replace(/"/g, '""')}"`,
      `"${p.department.replace(/"/g, '""')}"`,
      `"${p.assetName.replace(/"/g, '""')}"`,
      `"${p.status.replace(/"/g, '""')}"`,
      `"${p.movementType.replace(/"/g, '""')}"`,
      `"${p.scheduledDate.replace(/"/g, '""')}"`,
      `"${p.originPoint.replace(/"/g, '""')}"`,
      `"${p.destination.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `host-gate-passes-page-${currentPage}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredPasses.length} currently loaded Host gate pass records to CSV.`);
  };

  const handleQuickScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBarcodeInput(trimmed);

    // Look in currently loaded passes first
    const foundInList = passes.find(
      (p) =>
        p.id.toLowerCase() === trimmed.toLowerCase() ||
        p.assetName.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (foundInList) {
      setSelectedPassId(foundInList.id);
      setIsInspectorOpen(true);
      setIsScanModalOpen(false);
      showToast(`Gate Pass identified: ${foundInList.id} (${foundInList.assetName}).`);
      return;
    }

    // Attempt fetching from API by Pass ID
    try {
      const record = await getGatePass(trimmed);
      const mapped = mapApiRecordToHostPass(record);
      setSelectedPassId(mapped.id);
      setSelectedDetail(mapped);
      setIsInspectorOpen(true);
      setIsScanModalOpen(false);
      showToast(`Gate Pass identified: ${mapped.id} (${mapped.assetName}).`);
    } catch {
      showToast(`Scan code "${trimmed}" not found or not accessible under Host permissions.`);
    }
  };

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleQuickScan(barcodeInput.trim());
  };

  // Host Permission Notice Handlers (Enforce Guard/Admin restriction)
  const handleRestrictedAction = (actionName: string) => {
    showToast(
      `Permission restricted: ${actionName} requires Security Guard or Admin authorization.`
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
                  Host Scope · Checkpoint Registry
                </span>
              </div>
              <p className="amx-hgp-subtitle">
                Monitor and inspect enterprise asset gate passes initiated by or assigned to your Host account.
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
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  qr_code_scanner
                </span>
                <span>Locate Pass</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI METRIC CARDS ROW */}
        <div className="amx-hgp-kpi-grid">
          {/* 1. Total Gate Passes */}
          <div className="amx-hgp-kpi-card">
            <div className="amx-hgp-kpi-header">
              <span className="amx-hgp-kpi-title">Total Gate Passes</span>
              <span className="amx-hgp-kpi-badge">
                {kpis?.totalPasses.badgeText ?? 'Host Scope'}
              </span>
            </div>
            <div className="amx-hgp-kpi-content">
              <div className="amx-hgp-kpi-number">
                {kpiLoading ? '...' : kpis?.totalPasses.total ?? '—'}
              </div>
              <span className="material-symbols-outlined amx-hgp-kpi-icon">
                receipt_long
              </span>
            </div>
            <p className="amx-hgp-kpi-subtext">
              {kpis?.totalPasses.subtext ?? 'Registered to authenticated host'}
            </p>
          </div>

          {/* 2. Pending Verification */}
          <div className="amx-hgp-kpi-card">
            <div className="amx-hgp-kpi-header">
              <span className="amx-hgp-kpi-title">Pending Verification</span>
              <span className="amx-hgp-kpi-badge priority">
                {kpis?.pendingVerification.badgeText ?? 'Priority Action'}
              </span>
            </div>
            <div className="amx-hgp-kpi-content">
              <div className="amx-hgp-kpi-number">
                {kpiLoading ? '...' : kpis?.pendingVerification.total ?? '—'}
              </div>
              <span className="material-symbols-outlined amx-hgp-kpi-icon error">
                pending_actions
              </span>
            </div>
            <p className="amx-hgp-kpi-subtext">
              {kpis?.pendingVerification.subtext ?? 'Awaiting clearance review or return intake'}
            </p>
          </div>

          {/* 3. In Progress */}
          <div className="amx-hgp-kpi-card">
            <div className="amx-hgp-kpi-header">
              <span className="amx-hgp-kpi-title">In Progress</span>
              <span className="amx-hgp-kpi-badge cyan">
                {kpis?.inProgress.badgeText ?? 'Active'}
              </span>
            </div>
            <div className="amx-hgp-kpi-content">
              <div className="amx-hgp-kpi-number">
                {kpiLoading ? '...' : kpis?.inProgress.total ?? '—'}
              </div>
              <span className="material-symbols-outlined amx-hgp-kpi-icon secondary">
                local_shipping
              </span>
            </div>
            <p className="amx-hgp-kpi-subtext">
              {kpis?.inProgress.subtext ?? 'Active in-transit perimeter passes'}
            </p>
          </div>

          {/* 4. Completed */}
          <div className="amx-hgp-kpi-card">
            <div className="amx-hgp-kpi-header">
              <span className="amx-hgp-kpi-title">Completed</span>
              <span className="amx-hgp-kpi-badge">
                {kpis?.completed.badgeText ?? 'Archived'}
              </span>
            </div>
            <div className="amx-hgp-kpi-content">
              <div className="amx-hgp-kpi-number">
                {kpiLoading ? '...' : kpis?.completed.total ?? '—'}
              </div>
              <span className="material-symbols-outlined amx-hgp-kpi-icon">
                verified
              </span>
            </div>
            <p className="amx-hgp-kpi-subtext">
              {kpis?.completed.subtext ?? 'Archived & verified returned passes'}
            </p>
          </div>
        </div>

        {/* CONTROLS BAR: SEARCH & FILTERS */}
        <div className="amx-hgp-filter-bar">
          <div className="amx-hgp-filter-left">
            {/* Search Input */}
            <div className="amx-hgp-search-wrap">
              <span className="material-symbols-outlined amx-hgp-search-icon">
                search
              </span>
              <input
                type="text"
                className="amx-hgp-search-input"
                placeholder="Search Gate Pass ID, Asset Name, Destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search Gate Passes"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="amx-hgp-clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    close
                  </span>
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="amx-hgp-filter-dropdowns">
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
                  <option value="In Progress">In Progress (Active)</option>
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
                  <option value="All">Dept: All</option>
                  <option value="Operations">Operations</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Facilities">Facilities</option>
                  <option value="QA Labs">QA Labs</option>
                  <option value="IT Operations">IT Operations</option>
                  <option value="Finance">Finance</option>
                  <option value="Executive">Executive</option>
                </select>
                <span className="material-symbols-outlined amx-hgp-filter-select-icon">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          <div className="amx-hgp-filter-right">
            <button
              type="button"
              className="amx-hgp-btn-reset"
              onClick={handleResetFilters}
              title="Reset all search filters"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                restart_alt
              </span>
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA: TABLE & DOCKED INSPECTION PANEL */}
        <div className="amx-hgp-content-layout">
          {/* LEFT TABLE SECTION */}
          <div className="amx-hgp-table-panel">
            <div className="amx-hgp-table-header-meta">
              <div className="amx-hgp-table-header-left">
                <span className="amx-hgp-count-badge">
                  <strong>{totalRecords}</strong> Gate Passes
                </span>
                <span className="amx-hgp-live-sync">
                  <span className="amx-hgp-pulse-dot" /> Live Registry
                </span>
              </div>
              <div className="amx-hgp-table-header-right">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--amx-hgp-text-muted)' }}>
                  event
                </span>
                <span className="amx-hgp-date-text">Today, {todayFormatted}</span>
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--amx-hgp-text-muted)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                          <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>
                            progress_activity
                          </span>
                          <span>Loading Host Gate Passes from registry...</span>
                        </div>
                      </td>
                    </tr>
                  ) : apiError ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--amx-hgp-error)' }}>
                        <p style={{ margin: 0, fontWeight: 600 }}>{apiError}</p>
                        <button
                          type="button"
                          className="amx-hgp-btn-action-view"
                          style={{ marginTop: '12px' }}
                          onClick={() => {
                            fetchPasses();
                            fetchKpis();
                          }}
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : paginatedPasses.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px' }}>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--amx-hgp-text)' }}>
                          No gate passes match the selected filters or host scope.
                        </p>
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
                  ) : (
                    paginatedPasses.map((pass) => {
                      const isSelected = selectedPass?.id === pass.id;
                      const statusClass = pass.status.toLowerCase().replace(/\s+/g, '-');
                      const effectiveStatusClass =
                        statusClass === 'active' ? 'in-progress active' : statusClass;
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
                            <span className={`amx-hgp-status-pill ${effectiveStatusClass}`}>
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
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="amx-hgp-pagination">
              <div className="amx-hgp-pagination-left">
                <span className="amx-hgp-pagination-label">Rows per page:</span>
                <select
                  className="amx-hgp-pagination-select"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Rows per page"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="amx-hgp-pagination-info">
                  Showing {totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} -{' '}
                  {Math.min(currentPage * rowsPerPage, totalRecords)} of {totalRecords} records
                </span>
              </div>

              <div className="amx-hgp-pagination-right">
                <span className="amx-hgp-pagination-page">
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
                      Badge: <strong>{selectedPass.requesterBadge}</strong>
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
                  {selectedPass.documents && selectedPass.documents.length > 0 ? (
                    <div className="amx-hgp-doc-list">
                      {selectedPass.documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="amx-hgp-doc-item"
                          onClick={() => showToast(`Document manifest: ${doc.name}`)}
                          role="button"
                          tabIndex={0}
                          aria-label={`View ${doc.name}`}
                        >
                          <div className="amx-hgp-doc-info">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: '20px', color: 'var(--amx-hgp-secondary)' }}
                            >
                              description
                            </span>
                            <div className="amx-hgp-doc-text">
                              <span className="amx-hgp-doc-name">{doc.name}</span>
                              <span className="amx-hgp-doc-sub">
                                {doc.type} · {doc.size}
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
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--amx-hgp-text-muted)', margin: '4px 0 0 0' }}>
                      No supporting documents uploaded for this gate pass.
                    </p>
                  )}
                </div>

                {/* 5. Checkpoint Audit Trail */}
                <div className="amx-hgp-drawer-card">
                  <span className="amx-hgp-drawer-section-title">
                    Checkpoint Audit Trail
                  </span>
                  {selectedPass.auditTrail && selectedPass.auditTrail.length > 0 ? (
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
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--amx-hgp-text-muted)', margin: '4px 0 0 0' }}>
                      No audit history recorded for this pass yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Host Permissions Actions Footer */}
              <div className="amx-hgp-inspector-footer">
                {/* Permission Notice Banner */}
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--amx-hgp-surface-high, #1e293b)',
                    borderRadius: '8px',
                    border: '1px solid var(--amx-hgp-outline-variant, #334155)',
                    marginBottom: '10px',
                    fontSize: '11.5px',
                    lineHeight: '1.4',
                    color: 'var(--amx-hgp-text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '16px', color: 'var(--amx-hgp-secondary, #38bdf8)', marginTop: '1px' }}
                  >
                    shield
                  </span>
                  <div>
                    <strong style={{ color: 'var(--amx-hgp-text, #f1f5f9)' }}>Host Audit Scope:</strong> Physical gate clearance, custody check-in, and incident escalation require Security Guard or Admin authorization.
                  </div>
                </div>

                <button
                  type="button"
                  className="amx-hgp-btn-verify-primary"
                  disabled
                  style={{ opacity: 0.55, cursor: 'not-allowed' }}
                  title="Restricted: Physical serial & clearance verification requires Security Guard authorization"
                  onClick={() => handleRestrictedAction('Physical serial & clearance verification')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>
                    verified_user
                  </span>
                  <span>Verify Physical Serial & Clearance (Guard Only)</span>
                </button>

                <div className="amx-hgp-footer-actions-grid">
                  <button
                    type="button"
                    className="amx-hgp-btn-checkin"
                    disabled
                    style={{ opacity: 0.55, cursor: 'not-allowed' }}
                    title="Restricted: Custody check-in verification requires Security Guard authorization"
                    onClick={() => handleRestrictedAction('Custody check-in verification')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                      inventory
                    </span>
                    <span>Log Check-in (Guard Only)</span>
                  </button>

                  <button
                    type="button"
                    className="amx-hgp-btn-escalate"
                    disabled
                    style={{ opacity: 0.55, cursor: 'not-allowed' }}
                    title="Restricted: Gate incident escalation requires Security Guard authorization"
                    onClick={() => handleRestrictedAction('Gate incident escalation')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                      emergency_home
                    </span>
                    <span>Escalate to Supervisor (Guard Only)</span>
                  </button>
                </div>

                <p className="amx-hgp-role-disclaimer">
                  Host role active. Master inventory edits, gate clearances, and manual escalations restricted.
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
                Locate Gate Pass by ID or Barcode
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
                  placeholder="Enter Gate Pass ID (e.g. GP-2026-0012)..."
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

              {paginatedPasses.length > 0 && (
                <div>
                  <span className="amx-hgp-drawer-section-title" style={{ display: 'block', marginBottom: '8px' }}>
                    Quick Select from Current Queue:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {paginatedPasses.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="amx-hgp-btn-action-view"
                        onClick={() => handleQuickScan(p.id)}
                      >
                        {p.id} ({p.assetName})
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

      {/* VERIFY PHYSICAL SERIAL & CLEARANCE MODAL (Host Audit Preview) */}
      {isVerifyModalOpen && selectedPass && (
        <div className="amx-hgp-modal-backdrop" onClick={() => setIsVerifyModalOpen(false)}>
          <div className="amx-hgp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="amx-hgp-modal-header">
              <h3 className="amx-hgp-modal-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--amx-hgp-secondary)' }}>
                  verified_user
                </span>
                Physical Serial & Custody Clearance Checklist
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
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--amx-hgp-surface-high)',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: 'var(--amx-hgp-text-muted)',
                }}
              >
                <strong>Host Audit Preview:</strong> Physical clearance checklist criteria can be reviewed for audit tracking, but confirmation is restricted to Security Guard personnel.
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--amx-hgp-surface-low)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedPass.id} — {selectedPass.assetName}</div>
                <div style={{ fontFamily: 'var(--amx-hgp-font-mono)', fontSize: '11.5px', color: 'var(--amx-hgp-text-muted)', marginTop: '2px' }}>
                  Destination: {selectedPass.destination} | Movement: {selectedPass.movementType}
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
                Close
              </button>
              <button
                type="button"
                className="amx-hgp-btn-scan"
                disabled
                style={{ opacity: 0.55, cursor: 'not-allowed' }}
                title="Physical clearance confirmation is restricted to Security Guard personnel"
                onClick={() => handleRestrictedAction('Physical clearance confirmation')}
              >
                Confirm Physical Clearance (Guard Only)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESCALATE TO SUPERVISOR MODAL (Host Audit Preview) */}
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRestrictedAction('Gate incident escalation');
              }}
            >
              <div className="amx-hgp-modal-body">
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--amx-hgp-surface-high)',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    color: 'var(--amx-hgp-text-muted)',
                  }}
                >
                  <strong>Host Notice:</strong> Manual gate-pass escalation endpoint requires Security Guard or Admin authorization.
                </div>

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
                  />
                </div>
              </div>
              <div className="amx-hgp-modal-footer">
                <button
                  type="button"
                  className="amx-hgp-btn-export"
                  onClick={() => setIsEscalateModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="amx-hgp-btn-escalate"
                  disabled
                  style={{ opacity: 0.55, cursor: 'not-allowed' }}
                  title="Gate incident escalation is restricted to Security Guard personnel"
                >
                  Submit Escalation (Guard Only)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
