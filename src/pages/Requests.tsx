import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { listRequests, type RequestApiError, type RequestListItemApiRecord } from '../api/requestApi';
import { getUser } from '../auth/session';
import './Requests.css';

const REQUEST_FILTER_OPTIONS = {
  requestTypes: [
    { value: '', label: 'All Request Types' },
    { value: 'Asset Request', label: 'Asset Request' },
    { value: 'Consumable Request', label: 'Consumable Request' },
  ],
  statuses: [
    { value: '', label: 'All Statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'In Review', label: 'In Review' },
    { value: 'Fulfilled', label: 'Fulfilled' },
    { value: 'Rejected', label: 'Rejected' },
  ],
  priorities: [
    { value: '', label: 'All Priorities' },
    { value: 'High', label: 'High Priority' },
    { value: 'Medium', label: 'Medium Priority' },
    { value: 'Low', label: 'Low Priority' },
  ],
  departments: [
    { value: '', label: 'All Departments' },
    { value: 'Software Engineering', label: 'Software Engineering' },
    { value: 'IT Support', label: 'IT Support' },
    { value: 'Finance & Operations', label: 'Finance & Operations' },
    { value: 'Hardware Maintenance', label: 'Hardware Maintenance' },
    { value: 'Research & Lab', label: 'Research & Lab' },
    { value: 'Product Design', label: 'Product Design' },
    { value: 'DevOps & Cloud', label: 'DevOps & Cloud' },
    { value: 'Human Resources', label: 'Human Resources' },
    { value: 'Operations', label: 'Operations' },
    { value: 'General Operations', label: 'General Operations' },
  ],
};

interface RequestRowData {
  id: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  requestType: 'Asset Request' | 'Consumable Request';
  requestedItem: string;
  category: string;
  quantity: number;
  priority: 'High' | 'Medium' | 'Low';
  requestDate: string;
  status: 'Pending' | 'In Review' | 'Fulfilled' | 'Rejected';
  justification: string;
  processingGuidelines?: string;
  history: Array<{
    id: string;
    timestamp: string;
    stage: string;
    action: string;
    performedBy: string;
    note?: string;
  }>;
}

interface RequestsPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const RequestsPage: React.FC<RequestsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [requests, setRequests] = useState<RequestRowData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestTypeFilter, setRequestTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const pageSize = 10;
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const currentUser = getUser();

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      const result = await listRequests({
        search: searchQuery.trim() || undefined,
        requestType: requestTypeFilter || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        department: departmentFilter || undefined,
        requestDate: dateFilter || undefined,
        page: currentPage,
        pageSize,
      });

      const rows: RequestRowData[] = Array.isArray(result.items)
        ? result.items.map((item) => ({
            id: item.request_id,
            requesterName: item.requester_name,
            requesterEmail: item.requester_email,
            department: item.department,
            requestType: item.request_type,
            requestedItem: item.requested_item,
            category: item.category,
            quantity: item.quantity,
            priority: item.priority,
            requestDate: item.request_date,
            status: item.status,
            justification: item.justification,
            processingGuidelines: item.processing_guidelines,
            history: [],
          }))
        : [];

      setRequests(rows);
      setTotal(Number(result.total ?? 0));
    } catch (error: unknown) {
      const status = (error as RequestApiError)?.status;
      setApiError(
        status === 401
          ? 'Your session has expired. Please sign in again.'
          : status === 403
          ? 'Admin access is required to view requests.'
          : status === 404
          ? 'The selected request could not be found.'
          : status === 422
          ? 'The request filters are invalid.'
          : status && status >= 500
          ? 'The request service is temporarily unavailable. Please retry.'
          : error instanceof Error
          ? error.message
          : 'Unable to load requests. Please check your connection and retry.'
      );
      setRequests([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, requestTypeFilter, statusFilter, priorityFilter, departmentFilter, dateFilter, currentPage]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const exportParams = {
        search: searchQuery.trim() || undefined,
        requestType: requestTypeFilter || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        department: departmentFilter || undefined,
        requestDate: dateFilter || undefined,
      };

      const EXPORT_PAGE_SIZE = 100;
      let currentPageNum = 1;
      const firstResponse = await listRequests({
        ...exportParams,
        page: currentPageNum,
        pageSize: EXPORT_PAGE_SIZE,
      });

      const totalMatching = Number(firstResponse.total ?? 0);
      if (totalMatching === 0 || !firstResponse.items || firstResponse.items.length === 0) {
        showToast('No requests available to export.');
        setIsExporting(false);
        return;
      }

      // Deduplicate by stable request_id
      const recordMap = new Map<string, RequestListItemApiRecord>();
      firstResponse.items.forEach((item) => {
        if (item.request_id && !recordMap.has(item.request_id)) {
          recordMap.set(item.request_id, item);
        }
      });

      const actualPageSize = Math.max(1, Number(firstResponse.page_size || EXPORT_PAGE_SIZE));
      const totalPages = Math.ceil(totalMatching / actualPageSize);

      while (currentPageNum < totalPages) {
        currentPageNum += 1;
        const nextResponse = await listRequests({
          ...exportParams,
          page: currentPageNum,
          pageSize: actualPageSize,
        });

        if (!nextResponse.items || nextResponse.items.length === 0) {
          break;
        }

        nextResponse.items.forEach((item) => {
          if (item.request_id && !recordMap.has(item.request_id)) {
            recordMap.set(item.request_id, item);
          }
        });
      }

      const allRecords = Array.from(recordMap.values());
      const exportedCount = allRecords.length;

      const escapeCsv = (val: string | number | null | undefined): string => {
        if (val == null) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const lines: string[] = [];
      lines.push('AssetMX Requests Ledger Export');
      lines.push(`Generated,${new Date().toISOString()}`);
      lines.push(`Total Matching Records,${totalMatching}`);
      lines.push(`Exported Records,${exportedCount}`);
      lines.push('');
      lines.push('Request ID,Requester Name,Requester Email,Department,Request Type,Requested Item,Category,Quantity,Priority,Request Date,Status,Justification');

      allRecords.forEach((item) => {
        lines.push(
          [
            escapeCsv(item.request_id),
            escapeCsv(item.requester_name),
            escapeCsv(item.requester_email),
            escapeCsv(item.department),
            escapeCsv(item.request_type),
            escapeCsv(item.requested_item),
            escapeCsv(item.category),
            item.quantity != null ? String(item.quantity) : '0',
            escapeCsv(item.priority),
            escapeCsv(item.request_date),
            escapeCsv(item.status),
            escapeCsv(item.justification || ''),
          ].join(',')
        );
      });

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `assetmx-requests-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Exported ${exportedCount} request record${exportedCount === 1 ? '' : 's'} to CSV.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to complete CSV export';
      showToast(`Failed to export requests: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setRequestTypeFilter('');
    setStatusFilter('');
    setPriorityFilter('');
    setDepartmentFilter('');
    setDateFilter('');
    setCurrentPage(1);
    showToast('Request filters reset to default.');
  };

  // Compute 4 Summary Cards Metrics from currently displayed ledger page
  const summaryMetrics = useMemo(() => {
    let openRequests = 0;
    let pendingAction = 0;
    let highPriority = 0;
    let backlog = 0;

    requests.forEach((req) => {
      const isOpen = req.status === 'Pending' || req.status === 'In Review';
      if (isOpen) {
        openRequests += 1;
        backlog += 1;
      }
      if (req.status === 'Pending') {
        pendingAction += 1;
      }
      if (req.priority === 'High' && isOpen) {
        highPriority += 1;
      }
    });

    return {
      openRequests,
      pendingAction,
      highPriority,
      backlog,
    };
  }, [requests]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginatedRequests = requests;

  const handleRowClick = (requestId: string) => {
    onNavigate?.(`requests/${encodeURIComponent(requestId)}`);
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
    } else if (subRoute === 'signout' || subRoute === 'login' || subRoute === 'sign-out') {
      onSignOut?.();
    } else {
      onNavigate?.(subRoute);
    }
  };

  return (
    <DashboardLayout
      currentNav="Requests"
      role={currentUser?.role || 'admin'}
      userName={currentUser?.full_name || 'Administrator'}
      userRoleSubtitle={currentUser?.role ? currentUser.role.toUpperCase() : 'ADMIN'}
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(q) => {
        setSearchQuery(q);
        setCurrentPage(1);
      }}
      searchValue={searchQuery}
      searchPlaceholder="Search requests by ID, requester, item..."
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('Administrative alerts: check pending requests in queue.')
      }
      onHelpClick={() => showToast('AssetMX Requests Management & Fulfilment Manual.')}
      onProfileClick={() => showToast(`Active User: ${currentUser?.full_name || 'Administrator'} (Role: ${currentUser?.role || 'Admin'}).`)}
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

      <div className="amx-requests-container">
        {/* Page Header */}
        <div className="amx-requests-header">
          <div className="amx-requests-title-area">
            <h2 className="amx-requests-title">Requests</h2>
            <p className="amx-requests-subtitle">
              Manage and prioritize organizational requests and fulfilment.
            </p>
          </div>
          <div className="amx-requests-header-actions">
            <button
              type="button"
              className="amx-btn-primary"
              onClick={() => onNavigate?.('requests/new-external')}
              id="add-external-request-btn"
              aria-label="Add external request"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                add
              </span>
              <span>Add External Request</span>
            </button>
            <button
              type="button"
              className="amx-btn-secondary"
              onClick={handleExport}
              disabled={isExporting}
              aria-label={isExporting ? 'Exporting request records...' : 'Export request records'}
              id="export-requests-btn"
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '18px',
                  animation: isExporting ? 'spin 1s linear infinite' : undefined,
                }}
                aria-hidden="true"
              >
                {isExporting ? 'sync' : 'download'}
              </span>
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Cards Grid */}
        <div className="amx-requests-summary-grid">
          {/* Card 1: Open Requests */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Open Requests</span>
              <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">
                pending_actions
              </span>
            </div>
            <div className="amx-metric-value">{summaryMetrics.openRequests}</div>
            <div className="amx-metric-subtext">Active items in processing workflow</div>
          </div>

          {/* Card 2: Pending Action */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Pending Action</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#D97706' }} aria-hidden="true">
                hourglass_top
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: summaryMetrics.pendingAction > 0 ? '#D97706' : undefined }}>
              {summaryMetrics.pendingAction}
            </div>
            <div className="amx-metric-subtext">Awaiting initial administrative triage</div>
          </div>

          {/* Card 3: High Priority */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">High Priority</span>
              <span className="material-symbols-outlined amx-metric-icon error" aria-hidden="true">
                priority_high
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: summaryMetrics.highPriority > 0 ? '#ba1a1a' : undefined }}>
              {summaryMetrics.highPriority}
            </div>
            <div className="amx-metric-subtext error">High-urgency active submissions</div>
          </div>

          {/* Card 4: Backlog */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Backlog</span>
              <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">
                inventory_2
              </span>
            </div>
            <div className="amx-metric-value">{summaryMetrics.backlog}</div>
            <div className="amx-metric-subtext">Total queue volume</div>
          </div>
        </div>

        {/* Main Card with Filter Bar & Table */}
        <div className="amx-requests-main-card">
          {/* Filter Bar */}
          <div className="amx-requests-filters-bar">
            {/* Search */}
            <div className="amx-filter-search-wrap">
              <span className="material-symbols-outlined amx-filter-search-icon" aria-hidden="true">
                search
              </span>
              <input
                type="search"
                className="amx-filter-search-input"
                placeholder="Search by ID, requester, item..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Search requests"
              />
            </div>

            {/* Request Type */}
            <select
              className="amx-request-filter-select"
              value={requestTypeFilter}
              onChange={(e) => {
                setRequestTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Request Type"
            >
              {REQUEST_FILTER_OPTIONS.requestTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              className="amx-request-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Status"
            >
              {REQUEST_FILTER_OPTIONS.statuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Priority */}
            <select
              className="amx-request-filter-select"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Priority"
            >
              {REQUEST_FILTER_OPTIONS.priorities.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Department */}
            <select
              className="amx-request-filter-select"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Department"
            >
              {REQUEST_FILTER_OPTIONS.departments.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Date */}
            <input
              type="date"
              className="amx-request-date-input"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Request Date"
              title="Filter by Request Date"
            />

            {/* Reset */}
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
            <table className="amx-requests-table" aria-label="Organizational requests list">
              <thead>
                <tr>
                  <th scope="col">Request ID</th>
                  <th scope="col">Requester</th>
                  <th scope="col">Department</th>
                  <th scope="col">Request Type</th>
                  <th scope="col">Requested Item</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Request Date</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="amx-empty-table-cell">
                      <div className="amx-empty-state">
                        <span className="material-symbols-outlined amx-empty-icon" aria-hidden="true">
                          sync
                        </span>
                        <p className="amx-empty-title">Loading requests...</p>
                      </div>
                    </td>
                  </tr>
                ) : apiError ? (
                  <tr>
                    <td colSpan={9} className="amx-empty-table-cell">
                      <div className="amx-empty-state">
                        <span className="material-symbols-outlined amx-empty-icon" aria-hidden="true">
                          error
                        </span>
                        <p className="amx-empty-title">Unable to load requests</p>
                        <p className="amx-empty-desc">{apiError}</p>
                        <button
                          type="button"
                          className="amx-btn-secondary"
                          style={{ marginTop: '12px' }}
                          onClick={loadRequests}
                          aria-label="Retry loading requests"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="amx-empty-table-cell">
                      <div className="amx-empty-state">
                        <span className="material-symbols-outlined amx-empty-icon" aria-hidden="true">
                          find_in_page
                        </span>
                        <p className="amx-empty-title">No requests found</p>
                        <p className="amx-empty-desc">
                          Try adjusting your search criteria or resetting filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((item) => {
                    const statusClass = item.status.toLowerCase().replace(/\s+/g, '-');
                    const priorityClass = item.priority.toLowerCase();
                    const typeClass = item.requestType === 'Asset Request' ? 'asset' : 'consumable';

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
                        aria-label={`View request ${item.id} from ${item.requesterName}`}
                      >
                        <td className="amx-mono-cell">{item.id}</td>
                        <td className="amx-name-cell">{item.requesterName}</td>
                        <td className="amx-muted-cell">{item.department}</td>
                        <td>
                          <span className={`amx-type-badge ${typeClass}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                              {item.requestType === 'Asset Request' ? 'devices' : 'inventory_2'}
                            </span>
                            {item.requestType}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--amx-dash-text)' }}>
                          {item.requestedItem}
                        </td>
                        <td>
                          <span className={`amx-priority-badge ${priorityClass}`}>
                            {item.priority === 'High' && (
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">
                                emergency
                              </span>
                            )}
                            {item.priority}
                          </span>
                        </td>
                        <td className="amx-mono-cell">{item.requestDate}</td>
                        <td>
                          <span className={`amx-req-status-badge ${statusClass}`}>
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
                            aria-label={`Open request details for ${item.id}`}
                            title="Open request details"
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
              Showing {requests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, total)} of{' '}
              {total} requests
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
    </DashboardLayout>
  );
};

export default RequestsPage;
