import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  GATE_PASS_FILTER_OPTIONS,
  type GatePassItemData,
  type GatePassType,
} from '../data/gatePassData';
import {
  createGatePass,
  listGatePasses,
  mapGatePassApiRecord,
  GatePassApiError,
} from '../api/gatePassApi';
import './GatePass.css';

interface GatePassPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const GatePassPage: React.FC<GatePassPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [passes, setPasses] = useState<GatePassItemData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [passTypeFilter, setPassTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const pageSize = 10;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<GatePassType>('Asset Movement');
  const [createAsset, setCreateAsset] = useState('');
  const [createQuantity, setCreateQuantity] = useState(1);
  const [createDestination, setCreateDestination] = useState('');
  const [createMovementDate, setCreateMovementDate] = useState('');
  const [createPurpose, setCreatePurpose] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setApiError(null);

    listGatePasses({
      search: searchQuery,
      pass_type: passTypeFilter,
      status: statusFilter,
      date: dateFilter,
      location: locationFilter,
      page: currentPage,
      page_size: pageSize,
    })
      .then((result) => {
        if (!active) return;
        setPasses(result.items.map((item) => mapGatePassApiRecord(item)));
        setTotal(result.total);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = (error as GatePassApiError).status;
        const message = status === 401
          ? 'Your session has expired. Please sign in again.'
          : status === 403
          ? 'Admin access is required to view gate passes.'
          : status === 404
          ? 'The selected gate pass could not be found.'
          : status === 409
          ? 'This gate pass action is not allowed in the current state.'
          : status === 422
          ? 'The gate pass filters or payload are invalid.'
          : status && status >= 500
          ? 'The gate pass service is temporarily unavailable.'
          : error instanceof Error
          ? error.message
          : 'Unable to load gate passes.';
        setApiError(message);
        setPasses([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [searchQuery, passTypeFilter, statusFilter, dateFilter, locationFilter, currentPage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    showToast('Exporting Organizational Gate Passes Ledger (.CSV)...');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setPassTypeFilter('');
    setStatusFilter('');
    setDateFilter('');
    setLocationFilter('');
    setCurrentPage(1);
    showToast('Gate pass filters reset to default.');
  };

  const summaryMetrics = useMemo(() => {
    let pendingApproval = 0;
    let activePasses = 0;
    let completed = 0;
    let escalated = 0;

    passes.forEach((p) => {
      if (p.status === 'Pending') pendingApproval += 1;
      if (p.status === 'Active' || p.status === 'Approved') activePasses += 1;
      if (p.status === 'Completed') completed += 1;
      if (p.status === 'Escalated') escalated += 1;
    });

    return {
      pendingApproval,
      activePasses,
      completed,
      escalated,
    };
  }, [passes]);

  const filteredPasses = useMemo(() => {
    return passes.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = p.id.toLowerCase().includes(q);
        const matchesRequester = p.requesterName.toLowerCase().includes(q);
        const matchesAsset = p.assetOrItem.toLowerCase().includes(q);
        const matchesDest = p.destination.toLowerCase().includes(q);
        if (!matchesId && !matchesRequester && !matchesAsset && !matchesDest) {
          return false;
        }
      }

      if (passTypeFilter && p.passType !== passTypeFilter) {
        return false;
      }

      if (statusFilter && p.status !== statusFilter) {
        return false;
      }

      if (dateFilter && p.movementDate !== dateFilter && p.requestDate !== dateFilter) {
        return false;
      }

      if (locationFilter && p.currentLocation !== locationFilter) {
        return false;
      }

      return true;
    });
  }, [passes, searchQuery, passTypeFilter, statusFilter, dateFilter, locationFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginatedPasses = filteredPasses;

  const handleRowClick = (passId: string) => {
    onNavigate?.(`gate-pass/${encodeURIComponent(passId)}`);
  };

  const handleNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      onNavigate?.('dashboard');
    } else if (subRoute === 'assets') {
      onNavigate?.('assets');
    } else if (subRoute === 'consumables') {
      onNavigate?.('consumables');
    } else if (subRoute === 'requests') {
      onNavigate?.('requests');
    } else if (subRoute === 'gate-pass' || subRoute === 'gate pass') {
      onNavigate?.('gate-pass');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} module — Scheduled for future backend integration.`);
      onNavigate?.(subRoute);
    }
  };

  const handleCreateGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createAsset.trim() || !createDestination.trim() || !createMovementDate) {
      showToast('Please complete all required fields.');
      return;
    }

    try {
      await createGatePass({
        pass_type: createType,
        asset_or_item: createAsset.trim(),
        quantity: Number(createQuantity) || 1,
        destination: createDestination.trim(),
        movement_date: createMovementDate,
        purpose: createPurpose.trim() || 'Internal organizational equipment movement.',
      });

      setIsCreateModalOpen(false);
      setCreateAsset('');
      setCreateDestination('');
      setCreateMovementDate('');
      setCreatePurpose('');
      setCreateQuantity(1);
      setCurrentPage(1);
      setSearchQuery('');
      setPassTypeFilter('');
      setStatusFilter('');
      setDateFilter('');
      setLocationFilter('');
      showToast('Gate pass created successfully.');
    } catch (error: unknown) {
      const status = (error as GatePassApiError).status;
      showToast(status === 401
        ? 'Your session has expired. Please sign in again.'
        : status === 403
        ? 'Admin access is required to create gate passes.'
        : status === 422
        ? 'The gate pass payload is invalid.'
        : error instanceof Error
        ? error.message
        : 'Unable to create the gate pass.');
    }
  };

  return (
    <DashboardLayout
      currentNav="Gate Pass"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(q) => {
        setSearchQuery(q);
        setCurrentPage(1);
      }}
      searchValue={searchQuery}
      searchPlaceholder="Search gate passes by ID, requester, asset, destination..."
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: 1 Gate pass pending clearance review.')
      }
      onHelpClick={() => showToast('AssetMX Gate Pass Verification Manual.')}
      onProfileClick={() => showToast('Active User: Administrator (Role: Admin, Dept: IT).')}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '80px',
            right: '28px',
            backgroundColor: '#131b2e',
            color: '#acedff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
            fontSize: '13.5px',
            fontWeight: '600',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid rgba(172, 237, 255, 0.35)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#57dffe' }}>
            info
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="amx-gatepass-container">
        {/* Page Header */}
        <div className="amx-gatepass-header">
          <div className="amx-gatepass-title-area">
            <h2 className="amx-gatepass-title">Gate Pass</h2>
            <p className="amx-gatepass-subtitle">
              Monitor and manage organizational gate passes.
            </p>
          </div>
          <div className="amx-gatepass-header-actions">
            <button
              type="button"
              className="amx-btn-secondary"
              onClick={handleExport}
              aria-label="Export gate pass records"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                download
              </span>
              <span>Export</span>
            </button>
            <button
              type="button"
              className="amx-btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              aria-label="Create Gate Pass"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                add
              </span>
              <span>Create Gate Pass</span>
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards Grid */}
        <div className="amx-gatepass-summary-grid">
          {/* Card 1: Pending Approval */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Pending Approval</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#D97706' }} aria-hidden="true">
                pending_actions
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: summaryMetrics.pendingApproval > 0 ? '#D97706' : undefined }}>
              {summaryMetrics.pendingApproval}
            </div>
            <div className="amx-metric-subtext">Passes awaiting clearance review</div>
          </div>

          {/* Card 2: Active Passes */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Active Passes</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#2563eb' }} aria-hidden="true">
                local_shipping
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: summaryMetrics.activePasses > 0 ? '#2563eb' : undefined }}>
              {summaryMetrics.activePasses}
            </div>
            <div className="amx-metric-subtext">Approved and active in transit</div>
          </div>

          {/* Card 3: Completed */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Completed</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#059669' }} aria-hidden="true">
                check_circle
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: '#059669' }}>
              {summaryMetrics.completed}
            </div>
            <div className="amx-metric-subtext">Full movement verified</div>
          </div>

          {/* Card 4: Escalated */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Escalated</span>
              <span className="material-symbols-outlined amx-metric-icon error" aria-hidden="true">
                warning
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: summaryMetrics.escalated > 0 ? '#dc2626' : undefined }}>
              {summaryMetrics.escalated}
            </div>
            <div className="amx-metric-subtext error">Action required at gate</div>
          </div>
        </div>

        {/* Main Card with Filter Bar & Table */}
        <div className="amx-gatepass-main-card">
          {/* Filter Bar */}
          <div className="amx-gatepass-filters-bar">
            {/* Search */}
            <div className="amx-filter-search-wrap">
              <span className="material-symbols-outlined amx-filter-search-icon" aria-hidden="true">
                search
              </span>
              <input
                type="search"
                className="amx-filter-search-input"
                placeholder="Search by ID, requester, asset, destination..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Search gate passes"
              />
            </div>

            {/* Pass Type Filter */}
            <select
              className="amx-gatepass-filter-select"
              value={passTypeFilter}
              onChange={(e) => {
                setPassTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Pass Type"
            >
              {GATE_PASS_FILTER_OPTIONS.passTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="amx-gatepass-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Status"
            >
              {GATE_PASS_FILTER_OPTIONS.statuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Location Filter */}
            <select
              className="amx-gatepass-filter-select"
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Location"
            >
              {GATE_PASS_FILTER_OPTIONS.locations.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Date Filter */}
            <input
              type="date"
              className="amx-gatepass-date-input"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Movement Date"
              title="Filter by Movement Date"
            />

            {/* Reset Button */}
            <button
              type="button"
              className="amx-filter-reset-btn"
              onClick={handleResetFilters}
              aria-label="Reset all filters"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                restart_alt
              </span>
              <span>Reset</span>
            </button>
          </div>

          {/* Table */}
          <div className="amx-table-scroll-wrapper">
            <table className="amx-gatepass-table" aria-label="Gate pass records table">
              <thead>
                <tr>
                  <th scope="col">Pass ID</th>
                  <th scope="col">Requester</th>
                  <th scope="col">Pass Type</th>
                  <th scope="col">Asset / Item</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="amx-empty-table-cell">
                      <div className="amx-empty-state">
                        <span className="material-symbols-outlined amx-empty-icon" aria-hidden="true">
                          sync
                        </span>
                        <p className="amx-empty-title">Loading gate passes...</p>
                        <p className="amx-empty-desc">Fetching the latest administrative gate pass records.</p>
                      </div>
                    </td>
                  </tr>
                ) : apiError ? (
                  <tr>
                    <td colSpan={8} className="amx-empty-table-cell">
                      <div className="amx-empty-state">
                        <span className="material-symbols-outlined amx-empty-icon" aria-hidden="true">
                          error
                        </span>
                        <p className="amx-empty-title">Unable to load gate passes</p>
                        <p className="amx-empty-desc">{apiError}</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedPasses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="amx-empty-table-cell">
                      <div className="amx-empty-state">
                        <span className="material-symbols-outlined amx-empty-icon" aria-hidden="true">
                          confirmation_number
                        </span>
                        <p className="amx-empty-title">No gate passes found</p>
                        <p className="amx-empty-desc">
                          Try adjusting your search criteria or resetting filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPasses.map((item) => {
                    const statusClass = item.status.toLowerCase();

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleRowClick(item.id)}
                        tabIndex={0}
                        role="row"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleRowClick(item.id);
                          }
                        }}
                        aria-label={`View gate pass ${item.id} for ${item.assetOrItem}`}
                      >
                        <td className="amx-mono-cell">{item.id}</td>
                        <td className="amx-name-cell">
                          <div>{item.requesterName}</div>
                          <span style={{ fontSize: '12px', color: 'var(--amx-dash-text-muted)' }}>
                            {item.department}
                          </span>
                        </td>
                        <td>
                          <span className="amx-gp-type-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                              {item.passType === 'Asset Movement'
                                ? 'swap_horiz'
                                : item.passType === 'Maintenance'
                                ? 'build'
                                : item.passType === 'Returnable'
                                ? 'sync'
                                : 'output'}
                            </span>
                            {item.passType}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--amx-dash-text)' }}>
                          {item.assetOrItem}
                          {item.quantity > 1 && (
                            <span style={{ fontSize: '12px', color: 'var(--amx-dash-text-muted)', marginLeft: '6px' }}>
                              ({item.quantity} units)
                            </span>
                          )}
                        </td>
                        <td className="amx-muted-cell">{item.destination}</td>
                        <td className="amx-mono-cell">{item.movementDate}</td>
                        <td>
                          <span className={`amx-gp-status-badge ${statusClass}`}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="amx-action-btn-row"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(item.id);
                            }}
                            aria-label={`Open details for ${item.id}`}
                            title="Open details"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                              chevron_right
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="amx-consumables-pagination">
            <div className="amx-pagination-info">
              Showing {filteredPasses.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredPasses.length)} of{' '}
              {filteredPasses.length} gate passes
            </div>
            <div className="amx-pagination-controls">
              <button
                type="button"
                className="amx-page-btn arrow"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous Page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  chevron_left
                </span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`amx-page-btn ${pageNum === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                  aria-label={`Page ${pageNum}`}
                  aria-current={pageNum === currentPage ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              ))}

              <button
                type="button"
                className="amx-page-btn arrow"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next Page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* CREATE GATE PASS MODAL (Minimal per spec) */}
      {/* ================================================================= */}
      {isCreateModalOpen && (
        <div className="amx-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="amx-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="modal-create-gp-title"
          >
            <div className="amx-modal-header">
              <h3 className="amx-modal-title" id="modal-create-gp-title">
                Create Gate Pass
              </h3>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateGatePass}>
              <div className="amx-modal-body">
                <div className="amx-form-grid-2">
                  <div className="amx-form-group">
                    <label className="amx-form-label">Pass Type *</label>
                    <select
                      className="amx-form-select"
                      value={createType}
                      onChange={(e) => setCreateType(e.target.value as GatePassType)}
                    >
                      <option value="Asset Movement">Asset Movement</option>
                      <option value="Returnable">Returnable</option>
                      <option value="Non-Returnable">Non-Returnable</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div className="amx-form-group">
                    <label className="amx-form-label">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      className="amx-form-input"
                      value={createQuantity}
                      onChange={(e) => setCreateQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      required
                    />
                  </div>
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Asset / Item *</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    placeholder="e.g. Dell UltraSharp 32'' Monitor"
                    value={createAsset}
                    onChange={(e) => setCreateAsset(e.target.value)}
                    required
                  />
                </div>

                <div className="amx-form-grid-2">
                  <div className="amx-form-group">
                    <label className="amx-form-label">Destination *</label>
                    <input
                      type="text"
                      className="amx-form-input"
                      placeholder="e.g. Branch Office - West Campus"
                      value={createDestination}
                      onChange={(e) => setCreateDestination(e.target.value)}
                      required
                    />
                  </div>
                  <div className="amx-form-group">
                    <label className="amx-form-label">Movement Date *</label>
                    <input
                      type="date"
                      className="amx-form-input"
                      value={createMovementDate}
                      onChange={(e) => setCreateMovementDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Purpose / Justification *</label>
                  <textarea
                    className="amx-form-textarea"
                    rows={3}
                    placeholder="Specify the operational purpose or reason for equipment dispatch..."
                    value={createPurpose}
                    onChange={(e) => setCreatePurpose(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="amx-modal-footer">
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="amx-btn-primary">
                  Create Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default GatePassPage;
