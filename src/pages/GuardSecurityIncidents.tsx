import React, { useState, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  INITIAL_GUARD_INCIDENTS_DATA,
  INCIDENT_TYPE_OPTIONS,
  CHECKPOINT_LOCATIONS,
  type SecurityIncidentRecord,
  type IncidentSeverity,
  type IncidentEvidenceAttachment,
} from '../data/guardIncidentsData';
import './GuardSecurityIncidents.css';

interface GuardSecurityIncidentsPageProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

const SEVERITY_COLORS: Record<IncidentSeverity, { bg: string; text: string }> = {
  Critical: { bg: '#fce8e6', text: '#b3261e' },
  High: { bg: '#fddcbb', text: '#7c4a00' },
  Medium: { bg: '#e8eaed', text: '#3c4043' },
  Low: { bg: '#f1f3f4', text: '#5f6368' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Open': { bg: '#fce8e6', text: '#b3261e' },
  'Under Investigation': { bg: '#e8f4f8', text: '#00687a' },
  'Resolved': { bg: '#e6f4ea', text: '#1e6e38' },
  'Closed': { bg: '#f1f3f4', text: '#5f6368' },
};

export const GuardSecurityIncidentsPage: React.FC<GuardSecurityIncidentsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // ── Master records ──────────────────────────────────────────────────
  const [incidents, setIncidents] = useState<SecurityIncidentRecord[]>(INITIAL_GUARD_INCIDENTS_DATA);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_GUARD_INCIDENTS_DATA[0].id);

  // ── Filter state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('2026-05-15');
  const [toDate, setToDate] = useState('2026-05-24');
  const [typeFilter, setTypeFilter] = useState('All Incident Types');
  const [severityFilter, setSeverityFilter] = useState('All Severities');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  // Applied filter state (committed on Apply click)
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('2026-05-15');
  const [appliedTo, setAppliedTo] = useState('2026-05-24');
  const [appliedType, setAppliedType] = useState('All Incident Types');
  const [appliedSeverity, setAppliedSeverity] = useState('All Severities');
  const [appliedStatus, setAppliedStatus] = useState('All Statuses');

  // ── Pagination ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── UI state ────────────────────────────────────────────────────────
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [observationText, setObservationText] = useState('');
  const [sortField, setSortField] = useState<'date' | 'severity' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // ── Report New Incident form state ──────────────────────────────────
  const [formType, setFormType] = useState('');
  const [formSeverity, setFormSeverity] = useState<IncidentSeverity>('High');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState(new Date().toTimeString().slice(0, 5));
  const [formCheckpoint, setFormCheckpoint] = useState(CHECKPOINT_LOCATIONS[0] || 'Gate-01A Main Gate');
  const [formLocation, setFormLocation] = useState('');
  const [formPassId, setFormPassId] = useState('');
  const [formAssetId, setFormAssetId] = useState('');
  const [formDirection, setFormDirection] = useState('Not Applicable');
  const [formDescription, setFormDescription] = useState('');
  const [formAction, setFormAction] = useState('');
  const [formWitness, setFormWitness] = useState('');
  const [formAttachments, setFormAttachments] = useState<IncidentEvidenceAttachment[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // ── Toast helper ────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(prev => (prev === msg ? null : prev)), 3800);
  }, []);

  // ── KPIs (dynamic from master list) ────────────────────────────────
  const kpis = useMemo(() => ({
    total: incidents.length,
    open: incidents.filter(i => i.status === 'Open').length,
    highCritical: incidents.filter(i => i.severity === 'Critical' || i.severity === 'High').length,
    resolved: incidents.filter(i => i.status === 'Resolved' || i.status === 'Closed').length,
  }), [incidents]);

  // ── Filtered + sorted records ───────────────────────────────────────
  const filteredIncidents = useMemo(() => {
    let list = [...incidents];

    // Search
    if (appliedSearch.trim()) {
      const q = appliedSearch.trim().toLowerCase();
      list = list.filter(i =>
        i.id.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q) ||
        (i.relatedPassId ?? '').toLowerCase().includes(q) ||
        (i.relatedAssetId ?? '').toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.reportedBy.toLowerCase().includes(q)
      );
    }

    // Date range
    list = list.filter(i => i.date >= appliedFrom && i.date <= appliedTo);

    // Type filter
    if (appliedType !== 'All Incident Types') {
      list = list.filter(i => i.type === appliedType);
    }

    // Severity filter
    if (appliedSeverity !== 'All Severities') {
      list = list.filter(i => i.severity === appliedSeverity);
    }

    // Status filter
    if (appliedStatus !== 'All Statuses') {
      list = list.filter(i => i.status === appliedStatus);
    }

    // Sort
    const SEVERITY_ORDER: Record<IncidentSeverity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const STATUS_ORDER: Record<string, number> = { 'Open': 0, 'Under Investigation': 1, 'Resolved': 2, 'Closed': 3 };
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = (a.date + a.time).localeCompare(b.date + b.time);
      } else if (sortField === 'severity') {
        cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      } else if (sortField === 'status') {
        cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [incidents, appliedSearch, appliedFrom, appliedTo, appliedType, appliedSeverity, appliedStatus, sortField, sortDir]);

  // ── Pagination ──────────────────────────────────────────────────────
  const totalPages = Math.ceil(filteredIncidents.length / pageSize) || 1;
  const pagedIncidents = filteredIncidents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Selected incident ───────────────────────────────────────────────
  const selectedIncident = useMemo(() =>
    incidents.find(i => i.id === selectedId) ?? incidents[0],
    [incidents, selectedId]
  );

  // ── Filter handlers ─────────────────────────────────────────────────
  const handleApplyFilters = () => {
    setAppliedSearch(searchQuery);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedType(typeFilter);
    setAppliedSeverity(severityFilter);
    setAppliedStatus(statusFilter);
    setCurrentPage(1);
    showToast('Filters applied to incident register');
  };

  const handleResetFilters = () => {
    setSearchQuery(''); setFromDate('2026-05-15'); setToDate('2026-05-24');
    setTypeFilter('All Incident Types'); setSeverityFilter('All Severities'); setStatusFilter('All Statuses');
    setAppliedSearch(''); setAppliedFrom('2026-05-15'); setAppliedTo('2026-05-24');
    setAppliedType('All Incident Types'); setAppliedSeverity('All Severities'); setAppliedStatus('All Statuses');
    setCurrentPage(1);
    showToast('Filters reset to default range');
  };

  // ── Sort toggle ─────────────────────────────────────────────────────
  const handleSort = (field: 'date' | 'severity' | 'status') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // ── Append Observation ──────────────────────────────────────────────
  const handleAppendObservation = () => {
    if (!observationText.trim()) return;
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const newEvent = {
      id: `t-obs-${Date.now()}`,
      timestamp,
      event: 'Supplementary Observation Added',
      actor: 'Marcus Vance',
      actorRole: 'Checkpoint Guard (SEC-8812)',
      note: observationText.trim(),
    };
    setIncidents(prev => prev.map(inc =>
      inc.id === selectedId ? { ...inc, timeline: [...inc.timeline, newEvent] } : inc
    ));
    setObservationText('');
    showToast('Observation appended to incident timeline.');
  };

  // ── Form reset ──────────────────────────────────────────────────────
  const resetForm = () => {
    setFormType(''); setFormSeverity('High');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTime(new Date().toTimeString().slice(0, 5));
    setFormCheckpoint(CHECKPOINT_LOCATIONS[0] || 'Gate-01A Main Gate');
    setFormLocation(''); setFormPassId(''); setFormAssetId('');
    setFormDirection('Not Applicable'); setFormDescription('');
    setFormAction(''); setFormWitness(''); setFormAttachments([]);
    setFormErrors([]);
  };

  // ── Submit New Incident ─────────────────────────────────────────────
  const handleSubmitIncident = () => {
    const errors: string[] = [];
    if (!formType.trim()) errors.push('Incident Type is required.');
    if (!formLocation.trim()) errors.push('Incident Location is required.');
    if (!formDescription.trim()) errors.push('Incident Description is required.');
    if (!formAction.trim()) errors.push('Immediate Action Taken is required.');

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    const newId = `INC-2026-${String(Date.now()).slice(-4)}`;
    const dtStr = `${formDate}T${formTime}`;
    const dtObj = new Date(dtStr);
    const formattedDateTime = dtObj.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const newRecord: SecurityIncidentRecord = {
      id: newId,
      title: formType,
      type: formType,
      severity: formSeverity,
      status: 'Open',
      date: formDate,
      time: formTime,
      formattedDateTime,
      checkpoint: formCheckpoint,
      locationDetail: formLocation,
      relatedPassId: formPassId.trim() || null,
      relatedAssetId: formAssetId.trim() || null,
      direction: formDirection as SecurityIncidentRecord['direction'],
      description: formDescription.trim(),
      immediateAction: formAction.trim(),
      witnessInfo: formWitness.trim() || null,
      evidenceAttachments: formAttachments,
      timeline: [
        {
          id: `t-${Date.now()}-1`,
          timestamp: formattedDateTime,
          event: 'Incident Reported',
          actor: 'Marcus Vance',
          actorRole: 'Checkpoint Guard (SEC-8812)',
          note: formDescription.trim(),
        },
      ],
      reportedBy: 'Marcus Vance',
      reportedByBadge: 'SEC-8812',
      canAppendObservation: true,
    };

    setIncidents(prev => [newRecord, ...prev]);
    setSelectedId(newId);
    // Reset date filters so the newly submitted incident is visible in the table
    const today = new Date().toISOString().slice(0, 10);
    setFromDate(today); setAppliedFrom(today);
    setToDate(today); setAppliedTo(today);
    setAppliedSearch(''); setSearchQuery('');
    setAppliedType('All Incident Types'); setTypeFilter('All Incident Types');
    setAppliedSeverity('All Severities'); setSeverityFilter('All Severities');
    setAppliedStatus('All Statuses'); setStatusFilter('All Statuses');
    setCurrentPage(1);
    setIsDrawerOpen(false);
    resetForm();
    showToast(`Incident ${newId} logged successfully.`);
  };

  // ── File attachment handler ─────────────────────────────────────────
  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAtts: IncidentEvidenceAttachment[] = Array.from(files).map(f => ({
      id: `att-new-${Date.now()}-${Math.random()}`,
      filename: f.name,
      size: f.size > 1024 * 1024
        ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
        : `${Math.round(f.size / 1024)} KB`,
      type: f.type.startsWith('image') ? 'image' : f.name.endsWith('.pdf') ? 'pdf' : 'doc',
      label: f.name,
      previewColor: '#e0f2fe',
    }));
    setFormAttachments(prev => [...prev, ...newAtts]);
    e.target.value = '';
  };

  // ── Export ──────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = filteredIncidents.map(i => ({
      'Incident ID': i.id,
      'Title': i.title,
      'Type': i.type,
      'Severity': i.severity,
      'Status': i.status,
      'Date': i.date,
      'Time': i.time,
      'Checkpoint': i.checkpoint,
      'Location': i.locationDetail,
      'Related Pass ID': i.relatedPassId ?? '',
      'Related Asset ID': i.relatedAssetId ?? '',
      'Direction': i.direction,
      'Reported By': i.reportedBy,
      'Badge': i.reportedByBadge,
    }));
    const csv = [
      Object.keys(rows[0] || {}).join(','),
      ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-incidents-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredIncidents.length} checkpoint records.`);
  };

  // ── Render ──────────────────────────────────────────────────────────
  const sortIcon = (field: 'date' | 'severity' | 'status') => {
    if (sortField !== field) return <span className="material-icons amx-si-sort-icon">unfold_more</span>;
    return <span className="material-icons amx-si-sort-icon">
      {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
    </span>;
  };

  return (
    <DashboardLayout currentNav="Security Incidents" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="amx-si-container">

        {/* ── Header Row ── */}
        <div className="amx-si-header-row" data-testid="si-header">
          <div>
            <div className="amx-si-breadcrumb">
              <span>GUARD PORTAL</span>
              <span className="amx-si-crumb-sep material-icons" style={{ fontSize: 14 }}>chevron_right</span>
              <span className="amx-si-crumb-current">SECURITY INCIDENTS</span>
            </div>
            <h1 className="amx-si-page-title">Security Incidents</h1>
            <div className="amx-si-node-row">
              <span className="amx-si-node-chip">
                <span className="amx-si-node-dot" />
                Gate-01A Main Gate
              </span>
              <span className="amx-si-node-chip amx-si-node-chip--shift">
                <span className="material-icons" style={{ fontSize: 13 }}>schedule</span>
                Morning Shift 06:00–14:00
              </span>
            </div>
          </div>
          <div className="amx-si-header-actions">
            <button
              className="amx-si-btn amx-si-btn--report"
              onClick={() => { resetForm(); setIsDrawerOpen(true); }}
              data-testid="si-btn-report"
            >
              <span className="material-icons" style={{ fontSize: 18 }}>report_problem</span>
              Report New Incident
            </button>
            <button className="amx-si-btn amx-si-btn--export" onClick={handleExport}>
              <span className="material-icons" style={{ fontSize: 18 }}>download</span>
              Export
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="amx-si-kpi-row">
          <div className="amx-si-kpi-card">
            <div className="amx-si-kpi-icon amx-si-kpi-icon--total">
              <span className="material-icons">inventory_2</span>
            </div>
            <div className="amx-si-kpi-body">
              <div className="amx-si-kpi-label">Total Incidents</div>
              <div className="amx-si-kpi-value">{kpis.total}</div>
              <div className="amx-si-kpi-sub">All registered incidents</div>
            </div>
          </div>
          <div className="amx-si-kpi-card">
            <div className="amx-si-kpi-icon amx-si-kpi-icon--open">
              <span className="material-icons">pending_actions</span>
            </div>
            <div className="amx-si-kpi-body">
              <div className="amx-si-kpi-label">Open Incidents</div>
              <div className="amx-si-kpi-value amx-si-kpi-value--open">{kpis.open}</div>
              <div className="amx-si-kpi-sub">Requiring immediate action</div>
            </div>
          </div>
          <div className="amx-si-kpi-card">
            <div className="amx-si-kpi-icon amx-si-kpi-icon--critical">
              <span className="material-icons">warning</span>
            </div>
            <div className="amx-si-kpi-body">
              <div className="amx-si-kpi-label">High &amp; Critical</div>
              <div className="amx-si-kpi-value amx-si-kpi-value--critical">{kpis.highCritical}</div>
              <div className="amx-si-kpi-sub">Priority escalation items</div>
            </div>
          </div>
          <div className="amx-si-kpi-card">
            <div className="amx-si-kpi-icon amx-si-kpi-icon--resolved">
              <span className="material-icons">check_circle</span>
            </div>
            <div className="amx-si-kpi-body">
              <div className="amx-si-kpi-label">Resolved Incidents</div>
              <div className="amx-si-kpi-value amx-si-kpi-value--resolved">{kpis.resolved}</div>
              <div className="amx-si-kpi-sub">Closed and resolved cases</div>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="amx-si-filters-card">
          <div className="amx-si-filters-row">
            <div className="amx-si-filter-group amx-si-filter-group--search">
              <span className="material-icons amx-si-filter-search-icon">search</span>
              <input
                className="amx-si-filter-input"
                placeholder="Search Incident ID, type, asset, description…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                data-testid="si-search"
              />
            </div>
            <div className="amx-si-filter-group">
              <label className="amx-si-filter-label">From</label>
              <input
                type="date"
                className="amx-si-filter-input amx-si-filter-input--date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                data-testid="si-filter-from"
              />
            </div>
            <div className="amx-si-filter-group">
              <label className="amx-si-filter-label">To</label>
              <input
                type="date"
                className="amx-si-filter-input amx-si-filter-input--date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                data-testid="si-filter-to"
              />
            </div>
            <div className="amx-si-filter-group">
              <label className="amx-si-filter-label">Incident Type</label>
              <select
                className="amx-si-filter-select"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                data-testid="si-filter-type"
              >
                <option>All Incident Types</option>
                {INCIDENT_TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="amx-si-filter-group">
              <label className="amx-si-filter-label">Severity</label>
              <select
                className="amx-si-filter-select"
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                data-testid="si-filter-severity"
              >
                <option>All Severities</option>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div className="amx-si-filter-group">
              <label className="amx-si-filter-label">Status</label>
              <select
                className="amx-si-filter-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                data-testid="si-filter-status"
              >
                <option>All Statuses</option>
                <option>Open</option>
                <option>Under Investigation</option>
                <option>Resolved</option>
                <option>Closed</option>
              </select>
            </div>
          </div>
          <div className="amx-si-filters-actions">
            <button className="amx-si-btn amx-si-btn--apply" onClick={handleApplyFilters} data-testid="si-btn-apply">
              <span className="material-icons" style={{ fontSize: 16 }}>filter_list</span>
              Apply Filters
            </button>
            <button className="amx-si-btn amx-si-btn--reset" onClick={handleResetFilters} data-testid="si-btn-reset">
              <span className="material-icons" style={{ fontSize: 16 }}>restart_alt</span>
              Reset Filters
            </button>
            {/* Active filter chips */}
            {appliedSearch && (
              <span className="amx-si-active-chip">
                Search: {appliedSearch}
                <button onClick={() => { setSearchQuery(''); setAppliedSearch(''); }} className="amx-si-chip-remove">×</button>
              </span>
            )}
            {appliedType !== 'All Incident Types' && (
              <span className="amx-si-active-chip">
                Type: {appliedType}
                <button onClick={() => { setTypeFilter('All Incident Types'); setAppliedType('All Incident Types'); }} className="amx-si-chip-remove">×</button>
              </span>
            )}
            {appliedSeverity !== 'All Severities' && (
              <span className="amx-si-active-chip">
                Severity: {appliedSeverity}
                <button onClick={() => { setSeverityFilter('All Severities'); setAppliedSeverity('All Severities'); }} className="amx-si-chip-remove">×</button>
              </span>
            )}
            {appliedStatus !== 'All Statuses' && (
              <span className="amx-si-active-chip">
                Status: {appliedStatus}
                <button onClick={() => { setStatusFilter('All Statuses'); setAppliedStatus('All Statuses'); }} className="amx-si-chip-remove">×</button>
              </span>
            )}
          </div>
        </div>

        {/* ── Dual Column Layout ── */}
        <div className="amx-si-dual-col">

          {/* ── Incident Register Table ── */}
          <div className="amx-si-table-panel">
            <div className="amx-si-table-header">
              <span className="amx-si-table-title">
                <span className="material-icons" style={{ fontSize: 18, color: '#00687a' }}>list_alt</span>
                Incident Register
              </span>
              <span className="amx-si-table-count">{filteredIncidents.length} records</span>
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="amx-si-empty-state">
                <span className="material-icons amx-si-empty-icon">search_off</span>
                <p className="amx-si-empty-text">No incidents match the current filters.</p>
                <button className="amx-si-btn amx-si-btn--reset" onClick={handleResetFilters}>Reset Filters</button>
              </div>
            ) : (
              <div className="amx-si-table-scroll">
                <table className="amx-si-table" data-testid="si-table">
                  <thead>
                    <tr>
                      <th className="amx-si-th">Incident ID</th>
                      <th className="amx-si-th amx-si-th--sortable" onClick={() => handleSort('severity')}>
                        Type &amp; Severity {sortIcon('severity')}
                      </th>
                      <th className="amx-si-th">Related Manifest</th>
                      <th className="amx-si-th amx-si-th--sortable" onClick={() => handleSort('date')}>
                        Reported {sortIcon('date')}
                      </th>
                      <th className="amx-si-th amx-si-th--sortable" onClick={() => handleSort('status')}>
                        Status {sortIcon('status')}
                      </th>
                      <th className="amx-si-th">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedIncidents.map(inc => {
                      const sevColor = SEVERITY_COLORS[inc.severity];
                      const statColor = STATUS_COLORS[inc.status] ?? { bg: '#f1f3f4', text: '#5f6368' };
                      return (
                        <tr
                          key={inc.id}
                          className={`amx-si-row${selectedId === inc.id ? ' amx-si-row--selected' : ''}`}
                          onClick={() => setSelectedId(inc.id)}
                        >
                          <td className="amx-si-td">
                            <span className="amx-si-incident-id">{inc.id}</span>
                            <div className="amx-si-incident-title">{inc.title}</div>
                          </td>
                          <td className="amx-si-td">
                            <div className="amx-si-type-cell">
                              <span
                                className="amx-si-severity-badge"
                                style={{ background: sevColor.bg, color: sevColor.text }}
                              >
                                {inc.severity}
                              </span>
                              <span className="amx-si-type-label">{inc.type}</span>
                            </div>
                          </td>
                          <td className="amx-si-td">
                            {inc.relatedAssetId
                              ? <div className="amx-si-manifest-asset">{inc.relatedAssetId}</div>
                              : <span className="amx-si-manifest-none">—</span>
                            }
                            {inc.relatedPassId
                              ? <div className="amx-si-manifest-pass">{inc.relatedPassId}</div>
                              : null
                            }
                          </td>
                          <td className="amx-si-td">
                            <div className="amx-si-reported-time">{inc.formattedDateTime}</div>
                            <div className="amx-si-reported-by">{inc.reportedBy}</div>
                          </td>
                          <td className="amx-si-td">
                            <span
                              className="amx-si-status-badge"
                              style={{ background: statColor.bg, color: statColor.text }}
                            >
                              {inc.status}
                            </span>
                          </td>
                          <td className="amx-si-td">
                            <button
                              className="amx-si-btn amx-si-btn--view"
                              onClick={e => { e.stopPropagation(); setSelectedId(inc.id); }}
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
            {filteredIncidents.length > 0 && (
              <div className="amx-si-pagination">
                <div className="amx-si-page-size">
                  <label>Rows per page:</label>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="amx-si-filter-select amx-si-filter-select--sm"
                  >
                    {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="amx-si-page-nav">
                  <span className="amx-si-page-info">
                    {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredIncidents.length)} of {filteredIncidents.length}
                  </span>
                  <button
                    className="amx-si-page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <span className="material-icons">chevron_left</span>
                  </button>
                  <button
                    className="amx-si-page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <span className="material-icons">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Incident Details Panel ── */}
          <div className="amx-si-details-panel" data-testid="si-details-panel">
            {selectedIncident ? (
              <>
                <div className="amx-si-details-header">
                  <div>
                    <div className="amx-si-details-title">Incident Details</div>
                    <div className="amx-si-details-id">{selectedIncident.id}</div>
                  </div>
                  <span
                    className="amx-si-status-badge"
                    style={{
                      background: (STATUS_COLORS[selectedIncident.status] ?? { bg: '#f1f3f4' }).bg,
                      color: (STATUS_COLORS[selectedIncident.status] ?? { text: '#5f6368' }).text,
                    }}
                  >
                    {selectedIncident.status}
                  </span>
                </div>

                <div className="amx-si-details-section">
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Type</span>
                    <span className="amx-si-detail-value">{selectedIncident.type}</span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Severity</span>
                    <span
                      className="amx-si-severity-badge"
                      style={{
                        background: SEVERITY_COLORS[selectedIncident.severity].bg,
                        color: SEVERITY_COLORS[selectedIncident.severity].text,
                      }}
                    >
                      {selectedIncident.severity}
                    </span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Date &amp; Time</span>
                    <span className="amx-si-detail-value">{selectedIncident.formattedDateTime}</span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Checkpoint</span>
                    <span className="amx-si-detail-value">{selectedIncident.checkpoint}</span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Location</span>
                    <span className="amx-si-detail-value">{selectedIncident.locationDetail}</span>
                  </div>
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Movement Direction</span>
                    <span className="amx-si-detail-value">{selectedIncident.direction}</span>
                  </div>
                  {selectedIncident.relatedPassId && (
                    <div className="amx-si-detail-row">
                      <span className="amx-si-detail-label">Related Gate Pass</span>
                      <span className="amx-si-detail-value amx-si-detail-value--pass">{selectedIncident.relatedPassId}</span>
                    </div>
                  )}
                  {selectedIncident.relatedAssetId && (
                    <div className="amx-si-detail-row">
                      <span className="amx-si-detail-label">Related Asset</span>
                      <span className="amx-si-detail-value amx-si-detail-value--asset">{selectedIncident.relatedAssetId}</span>
                    </div>
                  )}
                  <div className="amx-si-detail-row">
                    <span className="amx-si-detail-label">Reported By</span>
                    <span className="amx-si-detail-value">{selectedIncident.reportedBy} · {selectedIncident.reportedByBadge}</span>
                  </div>
                </div>

                <div className="amx-si-details-section">
                  <div className="amx-si-section-heading">Description</div>
                  <p className="amx-si-description-text">{selectedIncident.description}</p>
                </div>

                <div className="amx-si-details-section">
                  <div className="amx-si-section-heading">Immediate Action Taken</div>
                  <p className="amx-si-description-text">{selectedIncident.immediateAction}</p>
                </div>

                {selectedIncident.witnessInfo && (
                  <div className="amx-si-details-section">
                    <div className="amx-si-section-heading">Witness Information</div>
                    <p className="amx-si-description-text">{selectedIncident.witnessInfo}</p>
                  </div>
                )}

                {/* Evidence Attachments */}
                {selectedIncident.evidenceAttachments.length > 0 && (
                  <div className="amx-si-details-section" data-testid="si-evidence-section">
                    <div className="amx-si-section-heading">Evidence Attachments</div>
                    <div className="amx-si-attachments-grid">
                      {selectedIncident.evidenceAttachments.map(att => (
                        <div
                          key={att.id}
                          className="amx-si-attachment-card"
                          style={{ background: att.previewColor ?? '#f1f5f9' }}
                        >
                          <span className="material-icons amx-si-att-icon">
                            {att.type === 'image' ? 'image' : att.type === 'pdf' ? 'picture_as_pdf' : 'description'}
                          </span>
                          <div className="amx-si-att-info">
                            <div className="amx-si-att-name">{att.filename}</div>
                            <div className="amx-si-att-meta">{att.label} · {att.size}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Incident Activity Timeline */}
                <div className="amx-si-details-section" data-testid="si-timeline-section">
                  <div className="amx-si-section-heading">Incident Activity Timeline</div>
                  <div className="amx-si-timeline">
                    {selectedIncident.timeline.map((ev, idx) => (
                      <div key={ev.id} className={`amx-si-timeline-item${idx === 0 ? ' amx-si-timeline-item--first' : ''}`}>
                        <div className="amx-si-timeline-dot" />
                        <div className="amx-si-timeline-body">
                          <div className="amx-si-timeline-event">{ev.event}</div>
                          <div className="amx-si-timeline-meta">{ev.actor} · {ev.actorRole}</div>
                          <div className="amx-si-timeline-ts">{ev.timestamp}</div>
                          {ev.note && <div className="amx-si-timeline-note">{ev.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Append Observation */}
                <div className="amx-si-details-section amx-si-append-section">
                  <div className="amx-si-section-heading">Append Supplementary Observation</div>
                  {selectedIncident.canAppendObservation ? (
                    <>
                      <textarea
                        className="amx-si-obs-textarea"
                        placeholder="Enter supplementary observation for this incident…"
                        value={observationText}
                        onChange={e => setObservationText(e.target.value)}
                        rows={3}
                        data-testid="si-append-textarea"
                      />
                      <button
                        className="amx-si-btn amx-si-btn--append"
                        onClick={handleAppendObservation}
                        disabled={!observationText.trim()}
                        data-testid="si-btn-append"
                      >
                        <span className="material-icons" style={{ fontSize: 16 }}>add_comment</span>
                        Append Observation
                      </button>
                    </>
                  ) : (
                    <div className="amx-si-obs-disabled">
                      <span className="material-icons" style={{ fontSize: 16, color: '#76777d' }}>lock</span>
                      Supplementary observations cannot be added to Resolved or Closed incidents.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="amx-si-empty-state">
                <span className="material-icons amx-si-empty-icon">info</span>
                <p className="amx-si-empty-text">Select an incident to view details.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Compliance Banner ── */}
        <div className="amx-si-compliance-banner" data-testid="si-compliance-banner">
          <span className="material-icons amx-si-banner-icon">policy</span>
          <div className="amx-si-banner-body">
            <div className="amx-si-banner-title">Guard Scope &amp; Compliance Notice</div>
            <div className="amx-si-banner-text">
              Guard personnel are authorised to report and document physical security incidents at assigned checkpoints.
              All incident records are immutable once submitted. Resolution, closure, and investigation decisions are
              strictly reserved for authorised Security Supervisors. This register operates under ISO 27001 Physical
              Security controls and all entries are cryptographically timestamped for audit integrity.
              <strong> This is a demonstration environment — all incident records are simulated mock data.</strong>
            </div>
          </div>
        </div>

      </div>

      {/* ── Report New Incident Drawer ── */}
      {isDrawerOpen && (
        <div
          className="amx-si-drawer-overlay"
          onClick={e => { if (e.target === e.currentTarget) setIsDrawerOpen(false); }}
        >
          <div className="amx-si-drawer" data-testid="si-drawer">
            <div className="amx-si-drawer-header">
              <div className="amx-si-drawer-title">
                <span className="material-icons" style={{ fontSize: 20, color: '#b3261e' }}>report_problem</span>
                Report New Incident
              </div>
              <button className="amx-si-drawer-close" onClick={() => setIsDrawerOpen(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="amx-si-drawer-guard-notice">
              <span className="material-icons" style={{ fontSize: 16, color: '#00687a' }}>security</span>
              <span>
                <strong>Guard role notice:</strong> You can submit and document incidents.
                Approval, resolution, and case closure are strictly restricted to Security Supervisors.
              </span>
            </div>

            <div className="amx-si-drawer-body">
              {formErrors.length > 0 && (
                <div className="amx-si-form-errors">
                  <span className="material-icons" style={{ fontSize: 16, color: '#b3261e' }}>error_outline</span>
                  <ul>
                    {formErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {/* Incident Type (required) */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Incident Type <span className="amx-si-required">*</span>
                </label>
                <select
                  className="amx-si-form-select"
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  data-testid="si-form-type"
                >
                  <option value="">— Select incident type —</option>
                  {INCIDENT_TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Severity */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Severity <span className="amx-si-required">*</span>
                </label>
                <select
                  className="amx-si-form-select"
                  value={formSeverity}
                  onChange={e => setFormSeverity(e.target.value as IncidentSeverity)}
                  data-testid="si-form-severity"
                >
                  <option>Critical</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>

              {/* Date & Time */}
              <div className="amx-si-form-row">
                <div className="amx-si-form-group">
                  <label className="amx-si-form-label">
                    Incident Date <span className="amx-si-required">*</span>
                  </label>
                  <input
                    type="date"
                    className="amx-si-form-input"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    data-testid="si-form-date"
                  />
                </div>
                <div className="amx-si-form-group">
                  <label className="amx-si-form-label">
                    Incident Time <span className="amx-si-required">*</span>
                  </label>
                  <input
                    type="time"
                    className="amx-si-form-input"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    data-testid="si-form-time"
                  />
                </div>
              </div>

              {/* Checkpoint */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Checkpoint <span className="amx-si-required">*</span>
                </label>
                <select
                  className="amx-si-form-select"
                  value={formCheckpoint}
                  onChange={e => setFormCheckpoint(e.target.value)}
                  data-testid="si-form-checkpoint"
                >
                  {CHECKPOINT_LOCATIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Incident Location (required) */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Incident Location <span className="amx-si-required">*</span>
                </label>
                <input
                  type="text"
                  className="amx-si-form-input"
                  placeholder="e.g. Inspection Bay 02 / Lane 02"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  data-testid="si-form-location"
                />
              </div>

              {/* Related Gate Pass ID (optional) */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">Related Gate Pass ID <span className="amx-si-optional">(optional)</span></label>
                <input
                  type="text"
                  className="amx-si-form-input"
                  placeholder="e.g. GP-2026-0418"
                  value={formPassId}
                  onChange={e => setFormPassId(e.target.value)}
                  data-testid="si-form-pass-id"
                />
              </div>

              {/* Related Asset ID (optional) */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">Related Asset ID <span className="amx-si-optional">(optional)</span></label>
                <input
                  type="text"
                  className="amx-si-form-input"
                  placeholder="e.g. AST-2024-8841"
                  value={formAssetId}
                  onChange={e => setFormAssetId(e.target.value)}
                  data-testid="si-form-asset-id"
                />
              </div>

              {/* Movement Direction */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">Movement Direction</label>
                <select
                  className="amx-si-form-select"
                  value={formDirection}
                  onChange={e => setFormDirection(e.target.value)}
                  data-testid="si-form-direction"
                >
                  <option>Not Applicable</option>
                  <option>Inward</option>
                  <option>Outward</option>
                </select>
              </div>

              {/* Incident Description (required) */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Incident Description <span className="amx-si-required">*</span>
                </label>
                <textarea
                  className="amx-si-form-textarea"
                  placeholder="Describe the incident in detail…"
                  rows={4}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  data-testid="si-form-description"
                />
              </div>

              {/* Immediate Action (required) */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">
                  Immediate Action Taken <span className="amx-si-required">*</span>
                </label>
                <textarea
                  className="amx-si-form-textarea"
                  placeholder="Describe the immediate response action taken…"
                  rows={3}
                  value={formAction}
                  onChange={e => setFormAction(e.target.value)}
                  data-testid="si-form-action"
                />
              </div>

              {/* Witness Information (optional) */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">Witness Information <span className="amx-si-optional">(optional)</span></label>
                <input
                  type="text"
                  className="amx-si-form-input"
                  placeholder="Name and ID of witness if applicable"
                  value={formWitness}
                  onChange={e => setFormWitness(e.target.value)}
                  data-testid="si-form-witness"
                />
              </div>

              {/* Evidence Attachments */}
              <div className="amx-si-form-group">
                <label className="amx-si-form-label">Evidence Attachments <span className="amx-si-optional">(optional)</span></label>
                <label className="amx-si-attach-btn">
                  <span className="material-icons" style={{ fontSize: 16 }}>attach_file</span>
                  Add Files
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleAddAttachment}
                    style={{ display: 'none' }}
                    data-testid="si-form-attach"
                  />
                </label>
                {formAttachments.length > 0 && (
                  <div className="amx-si-attach-list">
                    {formAttachments.map((att, idx) => (
                      <div key={att.id} className="amx-si-attach-item">
                        <span className="material-icons" style={{ fontSize: 15, color: '#00687a' }}>
                          {att.type === 'image' ? 'image' : att.type === 'pdf' ? 'picture_as_pdf' : 'description'}
                        </span>
                        <span className="amx-si-attach-name">{att.filename}</span>
                        <span className="amx-si-attach-size">{att.size}</span>
                        <button
                          className="amx-si-attach-remove"
                          onClick={() => setFormAttachments(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <span className="material-icons" style={{ fontSize: 15 }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="amx-si-drawer-footer">
              <button className="amx-si-btn amx-si-btn--cancel" onClick={() => setIsDrawerOpen(false)}>
                Cancel
              </button>
              <button
                className="amx-si-btn amx-si-btn--submit"
                onClick={handleSubmitIncident}
                data-testid="si-btn-submit"
              >
                <span className="material-icons" style={{ fontSize: 16 }}>send</span>
                Submit Incident Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toastMessage && (
        <div className="amx-si-toast" data-testid="si-toast">
          <span className="material-icons" style={{ fontSize: 16 }}>check_circle</span>
          {toastMessage}
        </div>
      )}
    </DashboardLayout>
  );
};

export default GuardSecurityIncidentsPage;
