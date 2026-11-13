import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import {
  getHostMovements,
  getHostDashboard,
  type HostMovementScanItem,
} from '../services/dashboardApi';
import './HostMovementActivity.css';

export interface HostMovementTimelineEvent {
  title: string;
  time: string;
  desc: string;
  status: 'completed' | 'exception' | 'pending';
  icon: string;
}

export interface HostMovementActivityRecord {
  id: string;
  gatePassId: string;
  assetName: string;
  assetTag: string;
  serialNumber: string;
  classification: string;
  origin: string;
  originZone: string;
  originIcon: string;
  destination: string;
  destinationSegment: string;
  destinationIcon: string;
  corridor: string;
  department: string;
  initiatedBy: string;
  initiatorInitials: string;
  initiatorBadge: string;
  initiatorEmail: string;
  movementDate: string;
  status: string;
  carrierName: string;
  carrierPlate: string;
  carrierDriver: string;
  justification: string;
  ttl: string;
  manifestFiles: Array<{
    name: string;
    size: string;
  }>;
  discrepancyAlert?: string;
  timeline: HostMovementTimelineEvent[];
}

interface HostMovementActivityPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

interface HostMovementKpisState {
  totalMovements: {
    total: number | string;
    badgeText: string;
    subtext: string;
  };
  inTransit: {
    total: number | string;
    badgeText: string;
    subtext: string;
  };
  completedToday: {
    total: number | string;
    badgeText: string;
    subtext: string;
  };
  movementExceptions: {
    total: number | string;
    badgeText: string;
    subtext: string;
  };
}

function formatDateDisplay(isoStr?: string | null): string {
  if (!isoStr) return 'Recent';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return isoStr;
  }
}

function formatTimeDisplay(isoStr?: string | null): string {
  if (!isoStr) return 'Active';
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

function mapScanItemToActivityRecord(item: HostMovementScanItem): HostMovementActivityRecord {
  const movId = item.movement_id || item.movementId || item.id;
  const rawStatus = item.status || 'Initiated';

  let origin = 'Facility Origin';
  let destination = 'Facility Destination';
  if (item.route) {
    const parts = item.route.split(/\u2192|->|—/).map((s) => s.trim());
    if (parts.length >= 2) {
      origin = parts[0] || origin;
      destination = parts[1] || destination;
    } else if (parts.length === 1 && parts[0]) {
      origin = parts[0];
    }
  } else if (item.station) {
    origin = item.station.replace(/^Station:\s*/i, '');
  }

  // Preserve the original backend status directly in the UI
  const status = rawStatus;
  const movDate = formatDateDisplay(item.initiated_at) || item.timeAgo || item.time_ago || 'Recent';

  const isCompleted =
    rawStatus.toLowerCase().includes('completed') ||
    rawStatus.toLowerCase().includes('return') ||
    rawStatus.toLowerCase().includes('check-in');

  // Timeline representation:
  // 1. Genuine initiation event using initiated_at (actual recorded event)
  // 2. Current status telemetry (clearly distinguished as current-state telemetry)
  const timeline: HostMovementTimelineEvent[] = [];
  if (item.initiated_at) {
    timeline.push({
      time: formatTimeDisplay(item.initiated_at),
      title: 'Movement Initiated (Recorded Event)',
      desc: `Transfer initiated from ${origin} to ${destination}`,
      icon: 'outbox',
      status: 'completed',
    });
  }
  timeline.push({
    time: item.timeAgo || item.time_ago ? `Current Telemetry (${item.timeAgo || item.time_ago})` : 'Current Telemetry',
    title: 'Current Status Telemetry',
    desc: `Current recorded telemetry: ${rawStatus}`,
    icon: isCompleted ? 'check_circle' : 'sensors',
    status: isCompleted ? 'completed' : 'pending',
  });

  return {
    id: movId,
    gatePassId: 'Not linked',
    assetName: item.assetName || item.asset_name || 'Hardware Asset',
    assetTag: item.assetTag || item.asset_tag || 'Not available',
    serialNumber: 'Not available',
    // Classification is not available in backend AssetMovement model; marked Not available
    classification: 'Not available',
    origin,
    originZone: `${origin} Zone`,
    originIcon: 'warehouse',
    destination,
    destinationSegment: `${destination} Sector`,
    destinationIcon: 'domain',
    corridor: `${origin} to ${destination} Corridor`,
    department: 'Operations',
    initiatedBy: 'Authorized Custodian',
    initiatorInitials: 'AC',
    initiatorBadge: 'Not available',
    initiatorEmail: 'Not available',
    movementDate: movDate,
    status,
    carrierName: 'Not assigned',
    carrierPlate: 'Not available',
    carrierDriver: 'Not available',
    justification: item.station
      ? `Transferred via ${item.station}`
      : 'Perimeter movement transfer recorded in registry',
    ttl: 'Not specified',
    manifestFiles: [],
    discrepancyAlert: undefined,
    timeline,
  };
}

export const HostMovementActivityPage: React.FC<HostMovementActivityPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [corridorFilter, setCorridorFilter] = useState<string>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Selected Record State
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Real Movement Records
  const [records, setRecords] = useState<HostMovementActivityRecord[]>([]);

  // KPI Metrics State
  const [kpis, setKpis] = useState<HostMovementKpisState | null>(null);

  // Modal States (Host Audit Previews)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);

  // Verification Checklist State (Preview only for Host)
  const [verifySerialCheck, setVerifySerialCheck] = useState(false);
  const [verifySealCheck, setVerifySealCheck] = useState(false);
  const [verifyBearerCheck, setVerifyBearerCheck] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');

  // Checkpoint Issue State (Preview only for Host)
  const [issueCategory, setIssueCategory] = useState('Missing secondary perimeter seal scan');
  const [issueNotes, setIssueNotes] = useState('');

  // Escalation State (Preview only for Host)
  const [escalateReason, setEscalateReason] = useState('Corridor Routing Discrepancy');
  const [escalateNotes, setEscalateNotes] = useState('');

  // Feedback Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
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

  // Fetch KPI cards data from real backend endpoints
  const fetchKpis = useCallback(async () => {
    try {
      const [dashRes, totalRes] = await Promise.allSettled([
        getHostDashboard(),
        getHostMovements({ pageSize: 1 }),
      ]);

      const dashKpis =
        dashRes.status === 'fulfilled' ? dashRes.value.kpis || dashRes.value.summary : null;
      const allTotal = totalRes.status === 'fulfilled' ? totalRes.value.total : null;

      setKpis({
        totalMovements: {
          total: allTotal !== null ? allTotal : '—',
          badgeText: 'Active Registry',
          subtext: 'All movement records in system',
        },
        inTransit: {
          total: dashKpis?.todaysMovement?.inTransit ?? '—',
          badgeText: 'Live Telemetry',
          subtext: 'Active perimeter transfers today',
        },
        completedToday: {
          total: dashKpis?.todaysMovement?.completed ?? '—',
          badgeText: dashKpis?.todaysMovement?.trend ?? 'Completed',
          subtext: 'Transfers completed today',
        },
        movementExceptions: {
          total: '—',
          badgeText: 'Unavailable',
          subtext: 'Exception telemetry not tracked on movements',
        },
      });
    } catch {
      setKpis({
        totalMovements: { total: '—', badgeText: 'Unavailable', subtext: 'Data unavailable' },
        inTransit: { total: '—', badgeText: 'Unavailable', subtext: 'Data unavailable' },
        completedToday: { total: '—', badgeText: 'Unavailable', subtext: 'Data unavailable' },
        movementExceptions: { total: '—', badgeText: 'Unavailable', subtext: 'Data unavailable' },
      });
    }
  }, []);

  // Fetch real movement records from backend
  const fetchMovements = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      // Align status filter directly with backend AssetMovementStatus values
      let apiStatus: string | undefined = undefined;
      if (statusFilter === 'In Transit') {
        apiStatus = 'in-transit';
      } else if (statusFilter === 'Completed') {
        apiStatus = 'completed';
      } else if (statusFilter === 'Initiated') {
        apiStatus = 'initiated';
      } else if (statusFilter === 'Cancelled') {
        apiStatus = 'cancelled';
      }

      const res = await getHostMovements({
        search: debouncedSearch.trim() || undefined,
        status: apiStatus,
        date: dateFilter.trim() || undefined,
        page: currentPage,
        pageSize: rowsPerPage,
      });

      const mapped = (res.items || []).map(mapScanItemToActivityRecord);
      setRecords(mapped);
      setTotalRecords(res.total || 0);

      if (mapped.length > 0) {
        setSelectedMovementId((prevId) => {
          if (prevId && mapped.some((r) => r.id === prevId)) return prevId;
          return mapped[0].id;
        });
      } else {
        setSelectedMovementId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load movement records';
      setApiError(msg);
      setRecords([]);
      setTotalRecords(0);
      setSelectedMovementId(null);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, dateFilter, currentPage, rowsPerPage]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  // Client-side refinements for filters
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      if (statusFilter !== 'All') {
        const s = item.status.toLowerCase();
        if (statusFilter === 'In Transit' && !s.includes('transit')) return false;
        if (
          statusFilter === 'Completed' &&
          !s.includes('return') &&
          !s.includes('completed') &&
          !s.includes('check-in')
        ) {
          return false;
        }
        if (statusFilter === 'Initiated' && !s.includes('initiated')) return false;
        if (statusFilter === 'Cancelled' && !s.includes('cancel')) return false;
      }
      if (
        corridorFilter !== 'All' &&
        !item.corridor.toLowerCase().includes(corridorFilter.toLowerCase())
      ) {
        return false;
      }
      if (deptFilter !== 'All' && item.department.toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [records, statusFilter, corridorFilter, deptFilter]);

  // Selected Record
  const selectedMovement: HostMovementActivityRecord | null = useMemo(() => {
    if (selectedMovementId) {
      const found = records.find((r) => r.id === selectedMovementId);
      if (found) return found;
    }
    return filteredRecords[0] || null;
  }, [selectedMovementId, records, filteredRecords]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const paginatedRecords = filteredRecords;

  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('All');
    setCorridorFilter('All');
    setDeptFilter('All');
    setDateFilter('');
    setCurrentPage(1);
    showToast('Movement filters reset to default view.');
  };

  const handleSelectMovement = (record: HostMovementActivityRecord) => {
    setSelectedMovementId(record.id);
    setIsDetailPanelOpen(true);
  };

  const handleExportLog = () => {
    if (filteredRecords.length === 0) {
      showToast('No movement records available to export.');
      return;
    }
    const headers = [
      'Movement ID',
      'Asset Name',
      'Asset Tag',
      'Origin',
      'Destination',
      'Corridor',
      'Movement Date',
      'Status',
    ];
    const rows = filteredRecords.map((r) => [
      `"${r.id.replace(/"/g, '""')}"`,
      `"${r.assetName.replace(/"/g, '""')}"`,
      `"${r.assetTag.replace(/"/g, '""')}"`,
      `"${r.origin.replace(/"/g, '""')}"`,
      `"${r.destination.replace(/"/g, '""')}"`,
      `"${r.corridor.replace(/"/g, '""')}"`,
      `"${r.movementDate.replace(/"/g, '""')}"`,
      `"${r.status.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `host-movements-page-${currentPage}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredRecords.length} currently loaded movement records to CSV.`);
  };

  // Host Permission Notice Handlers (Enforce Guard/Admin restriction)
  const handleRestrictedAction = (actionName: string) => {
    showToast(
      `Permission restricted: ${actionName} requires Security Guard or Admin authorization.`
    );
  };

  const getStatusClass = (status: string): string => {
    const s = status.toLowerCase();
    if (s.includes('in-transit') || s.includes('in transit') || s.includes('transit')) {
      return 'transit';
    }
    if (s.includes('check-in') || s.includes('completed') || s.includes('return') || s.includes('received')) {
      return 'received';
    }
    if (s.includes('initiated') || s.includes('scheduled')) {
      return 'scheduled';
    }
    if (s.includes('cancel') || s.includes('exception')) {
      return 'exception';
    }
    if (s.includes('verified')) {
      return 'verified';
    }
    return 'transit';
  };

  const getStatusIcon = (status: string): string => {
    const s = status.toLowerCase();
    if (s.includes('in-transit') || s.includes('in transit') || s.includes('transit')) {
      return 'near_me';
    }
    if (s.includes('check-in') || s.includes('completed') || s.includes('return') || s.includes('received')) {
      return 'check_circle';
    }
    if (s.includes('initiated') || s.includes('scheduled')) {
      return 'schedule';
    }
    if (s.includes('cancel') || s.includes('exception')) {
      return 'cancel';
    }
    if (s.includes('verified')) {
      return 'verified';
    }
    return 'info';
  };

  const currentRole = getUser()?.role ?? 'host';
  const isHost = currentRole === 'host';

  return (
    <DashboardLayout
      currentNav="movement"
      role={currentRole}
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
              {isHost ? 'Host Dashboard' : 'Dashboard'}
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
                  Active Perimeter Logs · Checkpoint Registry
                </span>
              </div>
              <p className="amx-hma-subtitle">
                Track asset movements, checkpoint telemetry, and perimeter custody transitions.
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
                disabled
                style={{ opacity: 0.55, cursor: 'not-allowed' }}
                title="Restricted: Checkpoint scan verification requires Security Guard authorization"
                onClick={() => handleRestrictedAction('Checkpoint scan verification')}
                aria-label="Verify Checkpoint Scan"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  qr_code_scanner
                </span>
                <span>Verify Checkpoint Scan (Guard Only)</span>
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
                  {kpis?.totalMovements.total ?? '—'}
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
                {kpis?.totalMovements.subtext ?? 'All movement records in system'}
              </span>
              <span className="amx-hma-kpi-badge">
                {kpis?.totalMovements.badgeText ?? 'Active Registry'}
              </span>
            </div>
          </div>

          {/* Card 2: In Transit */}
          <div className="amx-hma-kpi-card">
            <div className="amx-hma-kpi-top">
              <div>
                <span className="amx-hma-kpi-title">In Transit</span>
                <div className="amx-hma-kpi-number">
                  {kpis?.inTransit.total ?? '—'}
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
                {kpis?.inTransit.subtext ?? 'Active perimeter transfers today'}
              </span>
              <span className="amx-hma-kpi-badge cyan">
                {kpis?.inTransit.badgeText ?? 'Live Telemetry'}
              </span>
            </div>
          </div>

          {/* Card 3: Completed Today */}
          <div className="amx-hma-kpi-card">
            <div className="amx-hma-kpi-top">
              <div>
                <span className="amx-hma-kpi-title">Completed Today</span>
                <div className="amx-hma-kpi-number">
                  {kpis?.completedToday.total ?? '—'}
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
                {kpis?.completedToday.subtext ?? 'Transfers completed today'}
              </span>
              <span className="amx-hma-kpi-badge">
                {kpis?.completedToday.badgeText ?? 'Completed'}
              </span>
            </div>
          </div>

          {/* Card 4: Movement Exceptions */}
          <div className="amx-hma-kpi-card">
            <div className="amx-hma-kpi-top">
              <div>
                <span className="amx-hma-kpi-title">Movement Exceptions</span>
                <div className="amx-hma-kpi-number error">
                  {kpis?.movementExceptions.total ?? '—'}
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
                {kpis?.movementExceptions.subtext ?? 'Exception telemetry not tracked on movements'}
              </span>
              <span className="amx-hma-kpi-badge error">
                {kpis?.movementExceptions.badgeText ?? 'Unavailable'}
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
                placeholder="Search by Movement ID, Asset Name, Tag or Location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search Movements"
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--amx-hma-text-muted)',
                    cursor: 'pointer',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    close
                  </span>
                </button>
              )}
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
                <option value="In Transit">In Transit</option>
                <option value="Completed">Completed (Return Check-In)</option>
                <option value="Initiated">Initiated</option>
                <option value="Cancelled">Cancelled</option>
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
                <option value="Server Room 2">Server Room 2</option>
                <option value="Lab 4">Lab 4 Corridor</option>
                <option value="Loading Bay">Loading Bay</option>
                <option value="Design Lab">Design Lab</option>
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
                <option value="Operations">Operations</option>
                <option value="Engineering">Engineering</option>
                <option value="IT Operations">IT Operations</option>
                <option value="Facilities">Facilities</option>
                <option value="QA Labs">QA Labs</option>
              </select>
              <span className="material-symbols-outlined amx-hma-filter-select-icon">
                expand_more
              </span>
            </div>

            {/* Server-Side Date Filter Input */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <input
                type="date"
                className="amx-hma-date-btn"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                title="Filter movements by date (YYYY-MM-DD)"
                aria-label="Filter by Date"
                style={{ colorScheme: 'dark', outline: 'none' }}
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('');
                    setCurrentPage(1);
                  }}
                  title="Clear date filter"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--amx-hma-text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label="Clear date filter"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    close
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              className="amx-hma-reset-btn"
              onClick={handleResetFilters}
              title="Reset Filters"
              aria-label="Reset Filters"
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
                Showing {filteredRecords.length} of {totalRecords} Movement Records · Host Checkpoint Scope
              </span>
            </div>
            <span>Checkpoints Active: Node Gate-04A · Perimeter Telemetry</span>
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
                {isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--amx-hma-text-muted)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                        <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>
                          progress_activity
                        </span>
                        <span>Loading movement activity from perimeter telemetry...</span>
                      </div>
                    </td>
                  </tr>
                ) : apiError ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--amx-hma-error)' }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{apiError}</p>
                      <button
                        type="button"
                        className="amx-hma-btn-view"
                        style={{ marginTop: '12px' }}
                        onClick={() => {
                          fetchMovements();
                          fetchKpis();
                        }}
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px' }}>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--amx-hma-text)' }}>
                        No movement records match the selected filters.
                      </p>
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
                ) : (
                  paginatedRecords.map((record) => {
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
                              {record.assetTag}
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
                  })
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
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span style={{ marginLeft: '6px' }}>
                Showing {totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}-
                {Math.min(currentPage * rowsPerPage, totalRecords)} of {totalRecords} records
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
                            Badge #{selectedMovement.initiatorBadge} · {selectedMovement.department}
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
                    {selectedMovement.manifestFiles && selectedMovement.manifestFiles.length > 0 ? (
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
                    ) : (
                      <p style={{ fontSize: '12px', color: 'var(--amx-hma-text-muted)', margin: '4px 0 0 0' }}>
                        No manifest files attached to this movement record.
                      </p>
                    )}
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
                  <strong>Host Audit Scope:</strong> Checkpoint scan verification, issue logging, and incident escalation require Security Guard or Admin authorization.
                </span>
              </div>

              <div className="amx-hma-actions-buttons">
                <button
                  type="button"
                  className="amx-hma-btn-escalate"
                  disabled
                  style={{ opacity: 0.55, cursor: 'not-allowed' }}
                  title="Restricted: Movement exception escalation requires Security Guard authorization"
                  onClick={() => handleRestrictedAction('Movement exception escalation')}
                >
                  Escalate to Security Supervisor (Guard Only)
                </button>
                <button
                  type="button"
                  className="amx-hma-btn-issue"
                  disabled
                  style={{ opacity: 0.55, cursor: 'not-allowed' }}
                  title="Restricted: Checkpoint issue logging requires Security Guard authorization"
                  onClick={() => handleRestrictedAction('Checkpoint issue logging')}
                >
                  Log Checkpoint Issue (Guard Only)
                </button>
                <button
                  type="button"
                  className="amx-hma-btn-verify-primary"
                  disabled
                  style={{ opacity: 0.55, cursor: 'not-allowed' }}
                  title="Restricted: Checkpoint scan verification requires Security Guard authorization"
                  onClick={() => handleRestrictedAction('Checkpoint scan verification')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    qr_code_scanner
                  </span>
                  <span>Verify Checkpoint Scan (Guard Only)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VERIFY CHECKPOINT SCAN MODAL (Host Audit Preview) */}
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
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--amx-hma-surface-high)',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: 'var(--amx-hma-text-muted)',
                }}
              >
                <strong>Host Audit Preview:</strong> Checkpoint clearance checklist can be reviewed for audit tracking, but confirmation is restricted to Security Guard personnel.
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--amx-hma-surface-low)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>
                  {selectedMovement.id} — {selectedMovement.assetName}
                </div>
                <div style={{ fontFamily: 'var(--amx-hma-font-mono)', fontSize: '11.5px', color: 'var(--amx-hma-text-muted)', marginTop: '2px' }}>
                  Origin: {selectedMovement.origin} | Destination: {selectedMovement.destination}
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
                Close
              </button>
              <button
                type="button"
                className="amx-hma-btn-verify-primary"
                disabled
                style={{ opacity: 0.55, cursor: 'not-allowed' }}
                title="Checkpoint clearance is restricted to Security Guard personnel"
                onClick={() => handleRestrictedAction('Checkpoint clearance verification')}
              >
                Confirm Checkpoint Clearance (Guard Only)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG CHECKPOINT ISSUE MODAL (Host Audit Preview) */}
      {isIssueModalOpen && selectedMovement && (
        <div className="amx-hma-modal-backdrop" onClick={() => setIsIssueModalOpen(false)}>
          <div className="amx-hma-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="amx-hma-modal-header">
              <h3 className="amx-hma-modal-title" style={{ color: 'var(--amx-hma-error)' }}>
                <span className="material-symbols-outlined">
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRestrictedAction('Checkpoint issue logging');
              }}
            >
              <div className="amx-hma-modal-body">
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--amx-hma-surface-high)',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    color: 'var(--amx-hma-text-muted)',
                  }}
                >
                  <strong>Host Notice:</strong> Checkpoint issue logging requires Security Guard or Admin authorization.
                </div>

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
                    <option value="Packaging Tampered In-Transit">Packaging Tampered In-Transit</option>
                    <option value="Bearer Route Diversion Detected">Bearer Route Diversion Detected</option>
                    <option value="Corridor Transit Delay / TTL Exceeded">Corridor Transit Delay / TTL Exceeded</option>
                    <option value="Hardware Serial Mismatch">Hardware Serial Mismatch</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Checkpoint Exception Details:
                  </label>
                  <textarea
                    style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--amx-hma-border)', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder="Describe the discrepancy observed during corridor check-in..."
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="amx-hma-modal-footer">
                <button
                  type="button"
                  className="amx-hma-btn-export"
                  onClick={() => setIsIssueModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="amx-hma-btn-verify-primary"
                  disabled
                  style={{ opacity: 0.55, cursor: 'not-allowed' }}
                  title="Checkpoint issue logging is restricted to Security Guard personnel"
                >
                  Log Issue to Registry (Guard Only)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESCALATE TO SECURITY SUPERVISOR MODAL (Host Audit Preview) */}
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRestrictedAction('Movement exception escalation');
              }}
            >
              <div className="amx-hma-modal-body">
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--amx-hma-surface-high)',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    color: 'var(--amx-hma-text-muted)',
                  }}
                >
                  <strong>Host Notice:</strong> Movement exception escalation requires Security Guard or Admin authorization.
                </div>

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
                  />
                </div>
              </div>
              <div className="amx-hma-modal-footer">
                <button
                  type="button"
                  className="amx-hma-btn-export"
                  onClick={() => setIsEscalateModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="amx-hma-btn-escalate"
                  disabled
                  style={{ backgroundColor: 'var(--amx-hma-error)', color: '#ffffff', border: 'none', opacity: 0.55, cursor: 'not-allowed' }}
                  title="Movement exception escalation is restricted to Security Guard personnel"
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
