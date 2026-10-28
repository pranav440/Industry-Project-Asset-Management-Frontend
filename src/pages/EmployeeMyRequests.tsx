import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import { getScopedEmployeeRequests } from '../data/employeeData';
import type { RequestItemData } from '../data/requestsData';
import './EmployeeMyRequests.css';

interface EmployeeMyRequestsPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

type StatusFilterType = 'all' | 'pending' | 'fulfilled' | 'rejected';

export const EmployeeMyRequestsPage: React.FC<EmployeeMyRequestsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();
  const requests = useMemo(() => getScopedEmployeeRequests(currentUser), [currentUser]);

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 6;

  // Selected request for read-only details modal
  const [selectedRequest, setSelectedRequest] = useState<RequestItemData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Helper date extractors
  const getApprovalDate = (req: RequestItemData): string => {
    if (req.status === 'Pending') return '—';
    const entry = req.history?.find(
      (h) => h.stage === 'Approved' || h.stage === 'In Review' || h.action?.toLowerCase().includes('approved')
    );
    if (entry?.timestamp) return entry.timestamp.split(' ')[0];
    if (req.status === 'In Review') return req.requestDate || '—';
    if (req.status === 'Fulfilled') return req.requestDate || '—';
    return '—';
  };

  const getFulfillmentDate = (req: RequestItemData): string => {
    if (req.status !== 'Fulfilled') return '—';
    const entry = req.history?.find((h) => h.stage === 'Fulfilled' || h.action?.toLowerCase().includes('disbursed'));
    if (entry?.timestamp) return entry.timestamp.split(' ')[0];
    return '—';
  };

  // Dynamic KPI Counts strictly from employee's records
  const allCount = requests.length;
  const openRequests = useMemo(
    () => requests.filter((r) => r.status !== 'Fulfilled' && r.status !== 'Rejected'),
    [requests]
  );
  const awaitingApproval = useMemo(
    () => requests.filter((r) => r.status === 'Pending'),
    [requests]
  );
  const fulfilledRequests = useMemo(
    () => requests.filter((r) => r.status === 'Fulfilled'),
    [requests]
  );
  const rejectedRequests = useMemo(
    () => requests.filter((r) => r.status === 'Rejected'),
    [requests]
  );

  // Available unique categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.category) {
        // Clean category prefix if has bullet
        const mainCat = r.category.split('•')[0].trim();
        set.add(mainCat);
      }
    });
    return Array.from(set);
  }, [requests]);

  // Filtered rows
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // 1. Search filter (ID or Item Name)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesId = req.id.toLowerCase().includes(query);
        const matchesItem = req.requestedItem.toLowerCase().includes(query);
        if (!matchesId && !matchesItem) return false;
      }

      // 2. Status pill filter
      if (statusFilter === 'pending') {
        if (req.status !== 'Pending' && req.status !== 'In Review') return false;
      } else if (statusFilter === 'fulfilled') {
        if (req.status !== 'Fulfilled') return false;
      } else if (statusFilter === 'rejected') {
        if (req.status !== 'Rejected') return false;
      }

      // 3. Priority filter
      if (priorityFilter && req.priority !== priorityFilter) {
        return false;
      }

      // 4. Category filter
      if (categoryFilter && !req.category.toLowerCase().includes(categoryFilter.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [requests, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + pageSize);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('');
    setCategoryFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== '' ||
    categoryFilter !== '';

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleOpenDetails = (req: RequestItemData) => {
    if (onNavigate) {
      onNavigate(`my-requests/${req.id}`);
    } else {
      setSelectedRequest(req);
    }
  };

  const handleRowClick = (req: RequestItemData) => {
    handleOpenDetails(req);
  };

  const userDisplayName = currentUser?.full_name || 'Marcus Vance';

  return (
    <DashboardLayout
      currentNav="My Requests"
      role="employee"
      userName={userDisplayName}
      userRoleSubtitle="Product Design (Employee)"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      searchPlaceholder="Search my requests, assets..."
      onNotificationsClick={() =>
        showToast('Notifications: 1 update — Monitor requisition REQ-2026-0841 moved to In Review.')
      }
      onHelpClick={() =>
        showToast('Help & Policies: Requisitions require departmental review before fulfillment.')
      }
      onProfileClick={() =>
        showToast(`Profile: ${userDisplayName} (${currentUser?.employee_id || 'EMP-2024-0419'})`)
      }
    >
      <div className="amx-myr-page">
        {/* Top Breadcrumb & Page Header */}
        <div className="amx-myr-header-wrap">
          <nav className="amx-myr-breadcrumbs" aria-label="Breadcrumb">
            <a
              href="#dashboard"
              className="amx-myr-crumb-link"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('dashboard');
              }}
            >
              <span>Dashboard</span>
            </a>
            <span className="material-symbols-outlined amx-myr-crumb-sep" aria-hidden="true">
              chevron_right
            </span>
            <span className="amx-myr-crumb-current">My Requests</span>
          </nav>

          <div className="amx-myr-title-row">
            <div className="amx-myr-title-left">
              <div className="amx-myr-headline-group">
                <h1 className="amx-myr-headline">My Requests</h1>
                <span className="amx-myr-pill-badge">Self-Service Tracking</span>
              </div>
              <p className="amx-myr-subtitle">
                Track the status and fulfillment of requests you have submitted.
              </p>
            </div>

            <div className="amx-myr-header-actions">
              <button
                type="button"
                className="amx-myr-btn-create"
                onClick={() => onNavigate?.('create-request')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  add
                </span>
                <span>Create Request</span>
              </button>
            </div>
          </div>
        </div>

        {/* Four Summary KPI Cards */}
        <div className="amx-myr-kpi-grid">
          {/* Card 1: All My Requests */}
          <div className="amx-myr-kpi-card">
            <div className="amx-myr-kpi-top">
              <span className="amx-myr-kpi-label">All My Requests</span>
              <div className="amx-myr-kpi-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  receipt_long
                </span>
              </div>
            </div>
            <div className="amx-myr-kpi-body">
              <div className="amx-myr-kpi-value">{allCount}</div>
              <p className="amx-myr-kpi-desc">Total submitted requisitions</p>
            </div>
          </div>

          {/* Card 2: Open Requests */}
          <div className="amx-myr-kpi-card">
            <div className="amx-myr-kpi-top">
              <span className="amx-myr-kpi-label">Open Requests</span>
              <div className="amx-myr-kpi-icon-wrap cyan" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  hourglass_top
                </span>
              </div>
            </div>
            <div className="amx-myr-kpi-body">
              <div className="amx-myr-kpi-value">{openRequests.length}</div>
              <p className="amx-myr-kpi-desc">Requests not yet fulfilled or rejected</p>
            </div>
          </div>

          {/* Card 3: Awaiting Approval */}
          <div className="amx-myr-kpi-card">
            <div className="amx-myr-kpi-top">
              <span className="amx-myr-kpi-label">Awaiting Approval</span>
              <div className="amx-myr-kpi-icon-wrap amber" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  pending
                </span>
              </div>
            </div>
            <div className="amx-myr-kpi-body">
              <div className="amx-myr-kpi-value">{awaitingApproval.length}</div>
              <p className="amx-myr-kpi-desc">Your requests awaiting an approver's decision</p>
            </div>
          </div>

          {/* Card 4: Fulfilled Requests */}
          <div className="amx-myr-kpi-card">
            <div className="amx-myr-kpi-top">
              <span className="amx-myr-kpi-label">Fulfilled Requests</span>
              <div className="amx-myr-kpi-icon-wrap green" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  check_circle
                </span>
              </div>
            </div>
            <div className="amx-myr-kpi-body">
              <div className="amx-myr-kpi-value">{fulfilledRequests.length}</div>
              <p className="amx-myr-kpi-desc">Successfully completed &amp; delivered</p>
            </div>
          </div>
        </div>

        {/* Main Requests Table Container */}
        <div className="amx-myr-main-card">
          {/* Filter Bar */}
          <div className="amx-myr-filter-bar">
            {/* Search Input */}
            <div className="amx-myr-search-wrapper">
              <span className="material-symbols-outlined amx-myr-search-icon" aria-hidden="true">
                search
              </span>
              <input
                type="text"
                className="amx-myr-search-input"
                id="table-search-input"
                placeholder="Search by Request ID or Item Name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="amx-myr-filters-group">
              {/* Status Filter Tabs / Pills */}
              <div className="amx-myr-pills-wrap" role="tablist" aria-label="Status filter tabs">
                <button
                  type="button"
                  className={`amx-myr-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                >
                  All ({allCount})
                </button>
                <button
                  type="button"
                  className={`amx-myr-pill-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('pending');
                    setCurrentPage(1);
                  }}
                >
                  Pending / In Review ({openRequests.length})
                </button>
                <button
                  type="button"
                  className={`amx-myr-pill-btn ${statusFilter === 'fulfilled' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('fulfilled');
                    setCurrentPage(1);
                  }}
                >
                  Fulfilled ({fulfilledRequests.length})
                </button>
                <button
                  type="button"
                  className={`amx-myr-pill-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('rejected');
                    setCurrentPage(1);
                  }}
                >
                  Rejected ({rejectedRequests.length})
                </button>
              </div>

              {/* Priority Select Filter */}
              <div className="amx-myr-select-wrap">
                <select
                  id="priority-select"
                  className="amx-myr-select"
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by priority"
                >
                  <option value="">Priority: All</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <span className="material-symbols-outlined amx-myr-select-icon" aria-hidden="true">
                  expand_more
                </span>
              </div>

              {/* Category Select Filter */}
              <div className="amx-myr-select-wrap">
                <select
                  id="category-select"
                  className="amx-myr-select"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by category"
                >
                  <option value="">Category: All</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined amx-myr-select-icon" aria-hidden="true">
                  tune
                </span>
              </div>

              {/* Reset Filters CTA if any filter is active */}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="amx-myr-btn-reset amx-myr-filter-bar-reset"
                  onClick={handleResetFilters}
                  title="Reset all filters"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                    restart_alt
                  </span>
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="amx-myr-table-scroll">
            <table className="amx-myr-table" aria-label="My Requests Table">
              <thead>
                <tr>
                  <th scope="col">Request ID</th>
                  <th scope="col">Item Name</th>
                  <th scope="col">Category</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Qty</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Request Date</th>
                  <th scope="col">Approval Date</th>
                  <th scope="col">Fulfillment Date</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody id="requests-tbody">
                {paginatedRequests.map((req) => {
                  const statusKey = req.status.toLowerCase().replace(/\s+/g, '-');
                  const priorityKey = (req.priority || 'Medium').toLowerCase();
                  const approvalDate = getApprovalDate(req);
                  const fulfillmentDate = getFulfillmentDate(req);

                  return (
                    <tr
                      key={req.id}
                      className="amx-myr-table-row"
                      onClick={() => handleRowClick(req)}
                    >
                      <td className="amx-myr-col-id">{req.id}</td>
                      <td className="amx-myr-col-item" title={req.requestedItem}>
                        {req.requestedItem}
                      </td>
                      <td className="amx-myr-col-cat">{req.category}</td>
                      <td className="amx-myr-col-qty">{req.quantity}</td>
                      <td>
                        <span className={`amx-myr-priority-badge ${priorityKey}`}>
                          {req.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="amx-myr-col-date">{req.requestDate || '—'}</td>
                      <td className="amx-myr-col-date">{approvalDate}</td>
                      <td className="amx-myr-col-date">{fulfillmentDate}</td>
                      <td>
                        <span className={`amx-myr-status-pill ${statusKey}`}>
                          {req.status === 'Fulfilled' ? (
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              done_all
                            </span>
                          ) : req.status === 'Rejected' ? (
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              close
                            </span>
                          ) : (
                            <span className="dot" aria-hidden="true" />
                          )}
                          <span>{req.status}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="amx-myr-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(req);
                          }}
                          aria-label={`View details for ${req.id}`}
                        >
                          <span>View Details</span>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '16px', color: 'var(--amx-dash-cyan, #00687a)' }}
                            aria-hidden="true"
                          >
                            chevron_right
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty Results State */}
          {filteredRequests.length === 0 && (
            <div className="amx-myr-empty-box" id="table-empty-state">
              <div className="amx-myr-empty-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                  search_off
                </span>
              </div>
              <h3 className="amx-myr-empty-title">No matching requests found</h3>
              <p className="amx-myr-empty-desc">
                {requests.length === 0
                  ? 'You have not submitted any asset or consumable requisitions yet.'
                  : 'No requisitions match your current filter parameters. Try clearing your search keyword or resetting category and priority filters.'}
              </p>
              {requests.length > 0 && (
                <button
                  type="button"
                  className="amx-myr-btn-reset"
                  id="reset-filters-btn"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}

          {/* Pagination Footer */}
          {filteredRequests.length > 0 && (
            <div className="amx-myr-pagination-footer">
              <div className="amx-myr-count-text">
                <span>
                  Showing{' '}
                  <strong id="count-visible">
                    {filteredRequests.length === 0 ? 0 : startIndex + 1}
                  </strong>{' '}
                  to{' '}
                  <strong>
                    {Math.min(startIndex + pageSize, filteredRequests.length)}
                  </strong>{' '}
                  of <strong>{filteredRequests.length}</strong> requests
                </span>
                <span className="amx-myr-subtext-sep">•</span>
                <span className="amx-myr-tracking-hint">Read-only personal tracking view</span>
              </div>

              <div className="amx-myr-pager-controls">
                <button
                  type="button"
                  className="amx-myr-pager-btn"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  aria-label="Previous page"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`amx-myr-page-num ${p === currentPage ? 'active' : ''}`}
                    onClick={() => handlePageChange(p)}
                    aria-label={`Go to page ${p}`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  className="amx-myr-pager-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Read-Only Details Modal */}
        {selectedRequest && (
          <div
            className="amx-myr-modal-backdrop"
            id="details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-req-id"
          >
            <div className="amx-myr-modal-card">
              {/* Modal Header */}
              <div className="amx-myr-modal-header">
                <div className="amx-myr-modal-title-wrap">
                  <span className="material-symbols-outlined amx-myr-modal-icon" aria-hidden="true">
                    assignment
                  </span>
                  <div>
                    <span className="amx-myr-modal-id" id="modal-req-id">
                      {selectedRequest.id}
                    </span>
                    <span className="amx-myr-modal-badge">Requisition Details</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="amx-myr-modal-close-btn"
                  onClick={() => setSelectedRequest(null)}
                  aria-label="Close details dialog"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    close
                  </span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="amx-myr-modal-body">
                <div>
                  <span className="amx-myr-detail-field-label">Item Name</span>
                  <div className="amx-myr-detail-item-title" id="modal-item-name">
                    {selectedRequest.requestedItem}
                  </div>
                </div>

                <div className="amx-myr-detail-grid">
                  <div className="amx-myr-detail-cell">
                    <span className="amx-myr-detail-field-label">Category</span>
                    <span className="amx-myr-detail-cell-value" id="modal-category">
                      {selectedRequest.category}
                    </span>
                  </div>
                  <div className="amx-myr-detail-cell">
                    <span className="amx-myr-detail-field-label">Quantity</span>
                    <span className="amx-myr-detail-cell-value" id="modal-qty">
                      {selectedRequest.quantity} {selectedRequest.quantity === 1 ? 'unit' : 'units'}
                    </span>
                  </div>
                  <div className="amx-myr-detail-cell">
                    <span className="amx-myr-detail-field-label">Priority</span>
                    <span className="amx-myr-detail-cell-value" id="modal-priority">
                      {selectedRequest.priority || 'Medium'}
                    </span>
                  </div>
                </div>

                {/* Fulfillment Lifecycle */}
                <div>
                  <span className="amx-myr-detail-field-label" style={{ display: 'block', marginBottom: '8px' }}>
                    Fulfillment Lifecycle
                  </span>
                  <div className="amx-myr-timeline-box">
                    {/* Step 1 */}
                    <div className="amx-myr-timeline-step">
                      <span className="material-symbols-outlined amx-myr-timeline-icon completed">
                        check_circle
                      </span>
                      <div className="amx-myr-timeline-content">
                        <span className="amx-myr-timeline-title">Submitted by Employee</span>
                        <span className="amx-myr-timeline-meta" id="modal-submit-date">
                          {selectedRequest.requestDate || 'Recorded'}
                        </span>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="amx-myr-timeline-step">
                      <span
                        className={`material-symbols-outlined amx-myr-timeline-icon ${
                          selectedRequest.status === 'Pending'
                            ? 'pending'
                            : selectedRequest.status === 'Rejected'
                            ? 'inactive'
                            : 'completed'
                        }`}
                      >
                        {selectedRequest.status === 'Pending'
                          ? 'pending'
                          : selectedRequest.status === 'Rejected'
                          ? 'cancel'
                          : 'check_circle'}
                      </span>
                      <div className="amx-myr-timeline-content">
                        <span className="amx-myr-timeline-title">
                          Departmental Review
                        </span>
                        <span className="amx-myr-timeline-meta">
                          {selectedRequest.status === 'Pending'
                            ? 'Pending decision by supervisor / department head'
                            : selectedRequest.status === 'Rejected'
                            ? 'Requisition disapproved during review'
                            : `Approved on ${getApprovalDate(selectedRequest)}`}
                        </span>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="amx-myr-timeline-step">
                      <span
                        className={`material-symbols-outlined amx-myr-timeline-icon ${
                          selectedRequest.status === 'Fulfilled'
                            ? 'completed'
                            : 'inactive'
                        }`}
                      >
                        {selectedRequest.status === 'Fulfilled'
                          ? 'check_circle'
                          : 'radio_button_unchecked'}
                      </span>
                      <div className="amx-myr-timeline-content">
                        <span className="amx-myr-timeline-title">
                          IT Asset Allocation &amp; Dispatch
                        </span>
                        <span className="amx-myr-timeline-meta">
                          {selectedRequest.status === 'Fulfilled'
                            ? `Fulfilled on ${getFulfillmentDate(selectedRequest)}`
                            : selectedRequest.status === 'Rejected'
                            ? 'Cancelled / Disapproved'
                            : 'Awaiting previous stage completion'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Justification */}
                <div>
                  <span className="amx-myr-detail-field-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Business Justification
                  </span>
                  <div className="amx-myr-justification-box">
                    {selectedRequest.justification || 'No justification text provided.'}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="amx-myr-modal-footer">
                <button
                  type="button"
                  className="amx-myr-modal-btn-dismiss"
                  onClick={() => setSelectedRequest(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="amx-myr-toast" role="status">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              info
            </span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EmployeeMyRequestsPage;
