import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import {
  getRequest,
  RequestApiError,
  downloadRequestAttachment,
  previewRequestAttachment,
  type RequestApiRecord,
} from '../api/requestApi';
import './EmployeeRequestDetails.css';

interface EmployeeRequestDetailsPageProps {
  requestId: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const EmployeeRequestDetailsPage: React.FC<EmployeeRequestDetailsPageProps> = ({
  requestId,
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();
  const [request, setRequest] = useState<RequestApiRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const fetchRequestDetails = () => {
    if (!requestId) {
      setLoading(false);
      setErrorStatus(404);
      setErrorMessage('No requisition reference provided.');
      return;
    }

    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);

    getRequest(requestId)
      .then((data) => {
        setRequest(data);
      })
      .catch((err) => {
        if (err instanceof RequestApiError) {
          setErrorStatus(err.status);
          setErrorMessage(err.message);
        } else {
          setErrorStatus(500);
          setErrorMessage(err instanceof Error ? err.message : 'Failed to retrieve request details');
        }
        setRequest(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const userDisplayName = currentUser?.full_name || request?.requester_name || 'Marcus Vance';
  const userInitials = userDisplayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Helper date and history extractors from real backend response
  const approvalEntry = useMemo(() => {
    if (!request?.history) return undefined;
    return request.history.find(
      (h) =>
        h.stage.toLowerCase() === 'approved' ||
        h.action.toLowerCase().includes('approved') ||
        h.stage.toLowerCase() === 'in review'
    );
  }, [request]);


  const approverName = useMemo(() => {
    if (!request) return 'Not assigned';
    if (approvalEntry?.performed_by) return approvalEntry.performed_by;
    if (request.status === 'Rejected') {
      const rejectEntry = request.history?.find((h) => h.stage.toLowerCase() === 'rejected');
      if (rejectEntry?.performed_by) return rejectEntry.performed_by;
    }
    return 'Not assigned';
  }, [request, approvalEntry]);

  const approvalDate = useMemo(() => {
    if (!request) return 'Not recorded';
    if (approvalEntry?.timestamp) {
      return approvalEntry.timestamp.split('T')[0] || approvalEntry.timestamp.split(' ')[0];
    }
    return 'Not recorded';
  }, [request, approvalEntry]);

  const fulfillmentEntry = useMemo(() => {
    if (!request?.history) return undefined;
    return request.history.find(
      (h) => h.stage.toLowerCase() === 'fulfilled' || h.action.toLowerCase().includes('fulfilled') || h.action.toLowerCase().includes('disbursed')
    );
  }, [request]);

  const fulfillmentDate = useMemo(() => {
    if (!request || request.status !== 'Fulfilled') return 'Not recorded';
    if (fulfillmentEntry?.timestamp) {
      return fulfillmentEntry.timestamp.split('T')[0] || fulfillmentEntry.timestamp.split(' ')[0];
    }
    return request.request_date || 'Recorded';
  }, [request, fulfillmentEntry]);

  // Derived category breakdown
  const primaryCategory = request?.category?.includes('•')
    ? request.category.split('•')[0].trim()
    : request?.category || 'Standard Equipment';

  const subCategory = request?.category?.includes('•')
    ? request.category.split('•')[1].trim()
    : 'Standard Allocation';

  const attachments = request?.attachments || [];

  const handleViewAttachment = async (doc: any) => {
    if (!request) return;
    try {
      const attId = doc.attachment_id || doc.id;
      const res = await previewRequestAttachment(request.request_id, attId);
      window.open(res.objectUrl, '_blank');
    } catch (err) {
      showToast(`Unable to preview: ${err instanceof Error ? err.message : 'Preview error'}`);
    }
  };

  const handleDownloadAttachment = async (doc: any) => {
    if (!request) return;
    try {
      const attId = doc.attachment_id || doc.id;
      const filename = doc.original_filename || doc.name || 'attachment';
      await downloadRequestAttachment(request.request_id, attId, filename);
      showToast(`Downloaded ${filename}`);
    } catch (err) {
      showToast(`Unable to download: ${err instanceof Error ? err.message : 'Download error'}`);
    }
  };

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
        showToast('Notifications: Requisition details view is read-only.')
      }
      onHelpClick={() =>
        showToast('Help & Policies: Requisitions require departmental review before fulfillment.')
      }
      onProfileClick={() =>
        showToast(`Profile: ${userDisplayName} (${currentUser?.employee_id || 'EMP-2024-0419'})`)
      }
    >
      <div className="amx-erd-page">
        {/* Navigation & Header Breadcrumbs Row */}
        <div className="amx-erd-header-wrap">
          <div className="amx-erd-header-left">
            <nav className="amx-erd-breadcrumbs" aria-label="Breadcrumb">
              <a
                href="#dashboard"
                className="amx-erd-crumb-link"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate?.('dashboard');
                }}
              >
                Dashboard
              </a>
              <span className="amx-erd-crumb-sep">/</span>
              <a
                href="#my-requests"
                className="amx-erd-crumb-link"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate?.('my-requests');
                }}
              >
                My Requests
              </a>
              <span className="amx-erd-crumb-sep">/</span>
              <span className="amx-erd-crumb-current">Request Details</span>
            </nav>

            <button
              type="button"
              className="amx-erd-back-link"
              id="backToMyRequestsBtn"
              onClick={() => onNavigate?.('my-requests')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                arrow_back
              </span>
              <span>Back to My Requests</span>
            </button>
          </div>

          <div className="amx-erd-readonly-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
              visibility
            </span>
            <span>Read-Only Employee View</span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="amx-erd-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '32px', color: 'var(--amx-dash-cyan, #00687a)', animation: 'spin 1s linear infinite' }}
              aria-hidden="true"
            >
              sync
            </span>
            <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--amx-dash-text-muted, #45464d)' }}>
              Loading request details...
            </p>
          </div>
        )}

        {/* Not Found / Unauthorized Safe State */}
        {!loading && (!request || errorStatus) && (
          <div className="amx-erd-error-container" id="erdNotFoundBox">
            <div className="amx-erd-error-icon-wrap" aria-hidden="true">
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                lock_outline
              </span>
            </div>
            <h2 className="amx-erd-error-title">
              {errorStatus === 403
                ? 'Access Restricted: Unauthorized'
                : 'Request Not Found or Access Restricted'}
            </h2>
            <p className="amx-erd-error-desc">
              {errorMessage ||
                `Requisition reference "${requestId || 'Unknown'}" could not be found in your active employee requisitions register, or you do not have authorization to view this record. Requisition records are strictly scoped to the originating employee.`}
            </p>
            <button
              type="button"
              className="amx-erd-btn-back"
              id="errReturnBtn"
              onClick={() => onNavigate?.('my-requests')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                arrow_back
              </span>
              <span>Return to My Requests</span>
            </button>
          </div>
        )}

        {/* Live Loaded Request Details View */}
        {!loading && request && (
          <>
            {/* Headline Banner Card */}
            <div className="amx-erd-headline-banner">
              <div className="amx-erd-headline-left">
                <div className="amx-erd-headline-icon-wrap" aria-hidden="true">
                  <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                    {request.request_type === 'Consumable Request' ? 'shopping_bag' : 'desktop_windows'}
                  </span>
                </div>
                <div className="amx-erd-headline-info">
                  <div className="amx-erd-title-row">
                    <h1 className="amx-erd-title">Request Details</h1>
                    <span className="amx-erd-id-badge" id="erdReqId">
                      {request.request_id}
                    </span>
                  </div>
                  <p className="amx-erd-item-summary">
                    {request.requested_item} &bull; {request.quantity}{' '}
                    {request.quantity === 1 ? 'Unit' : 'Units'}
                  </p>
                </div>
              </div>

              {/* Status & Priority Badge Group */}
              <div className="amx-erd-status-group">
                <div
                  className={`amx-erd-status-pill ${request.status.toLowerCase().replace(/\s+/g, '-')}`}
                  id="erdStatusPill"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    {request.status === 'Fulfilled'
                      ? 'check_circle'
                      : request.status === 'Rejected'
                      ? 'cancel'
                      : request.status === 'In Review'
                      ? 'hourglass_top'
                      : 'pending'}
                  </span>
                  <span>
                    {request.status === 'In Review' ? 'In Review / Queue' : request.status}
                  </span>
                </div>

                <div
                  className={`amx-erd-priority-pill ${(request.priority || 'Medium').toLowerCase()}`}
                  id="erdPriorityPill"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                    priority_high
                  </span>
                  <span>{request.priority || 'Medium'} Priority</span>
                </div>
              </div>
            </div>

            {/* Contextual Notice Banner */}
            <div className="amx-erd-notice-banner" id="erdNoticeBanner">
              <div className="amx-erd-notice-icon-box" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {request.status === 'Fulfilled'
                    ? 'check_circle'
                    : request.status === 'Rejected'
                    ? 'cancel'
                    : 'info'}
                </span>
              </div>
              <div className="amx-erd-notice-content">
                <p className="amx-erd-notice-title">
                  {request.status === 'In Review'
                    ? 'Request Under Review'
                    : request.status === 'Pending'
                    ? 'Request Pending Review'
                    : request.status === 'Fulfilled'
                    ? 'Requisition Fulfilled & Delivered'
                    : 'Requisition Disapproved'}
                </p>
                <p className="amx-erd-notice-desc">
                  {request.status === 'In Review'
                    ? 'This request is currently under review by administrators. As an employee requester, this record is read-only.'
                    : request.status === 'Pending'
                    ? 'This request is awaiting supervisor/departmental review. As an employee requester, this record is read-only.'
                    : request.status === 'Fulfilled'
                    ? 'This item has been formally fulfilled and disbursed to your custody. Physical asset tags apply.'
                    : 'This requisition was disapproved during review. Please refer to reviewer remarks for details.'}
                </p>
              </div>
            </div>

            {/* Main 2-Column Content Grid */}
            <div className="amx-erd-grid">
              {/* Left Column (8 Cols): Overview, Review/Fulfillment, History */}
              <div className="amx-erd-col-main">
                {/* Card 1: Request Overview */}
                <section className="amx-erd-card" aria-labelledby="erd-overview-heading">
                  <div className="amx-erd-card-header">
                    <div className="amx-erd-card-title-group">
                      <span className="material-symbols-outlined amx-erd-card-icon" aria-hidden="true">
                        assignment
                      </span>
                      <h2 className="amx-erd-card-title" id="erd-overview-heading">
                        Request Overview
                      </h2>
                    </div>
                  </div>

                  {/* Structured Key Metrics Bento */}
                  <div className="amx-erd-bento-grid">
                    <div className="amx-erd-bento-cell">
                      <span className="amx-erd-field-label">Request ID</span>
                      <span className="amx-erd-bento-val mono" id="overview-id">
                        {request.request_id}
                      </span>
                    </div>

                    <div className="amx-erd-bento-cell">
                      <span className="amx-erd-field-label">Request Type</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '18px', color: 'var(--amx-dash-cyan, #00687a)' }}
                          aria-hidden="true"
                        >
                          inventory
                        </span>
                        <span className="amx-erd-bento-val" id="overview-type">
                          {request.request_type}
                        </span>
                      </div>
                    </div>

                    <div className="amx-erd-bento-cell">
                      <span className="amx-erd-field-label">Quantity</span>
                      <span className="amx-erd-bento-val" id="overview-qty">
                        {request.quantity} {request.quantity === 1 ? 'Unit' : 'Units'}
                      </span>
                    </div>

                    <div className="amx-erd-bento-cell">
                      <span className="amx-erd-field-label">Primary Category</span>
                      <span className="amx-erd-bento-val" id="overview-category">
                        {primaryCategory}
                      </span>
                    </div>

                    <div className="amx-erd-bento-cell">
                      <span className="amx-erd-field-label">Sub-Category</span>
                      <span className="amx-erd-bento-val" id="overview-subcategory">
                        {subCategory}
                      </span>
                    </div>

                    <div className="amx-erd-bento-cell">
                      <span className="amx-erd-field-label">Requested Priority</span>
                      <span
                        className="amx-erd-bento-val"
                        style={{ color: 'var(--amx-dash-cyan, #00687a)' }}
                        id="overview-priority"
                      >
                        {request.priority || 'Medium'} Impact
                      </span>
                    </div>
                  </div>

                  {/* Item Specifications Highlight Block */}
                  <div className="amx-erd-item-spec-box">
                    <div className="amx-erd-item-spec-top">
                      <span className="amx-erd-field-label">Requested Item</span>
                      <span className="amx-erd-item-spec-oem" id="overview-oem">
                        Reference: {request.request_id}
                      </span>
                    </div>

                    <div className="amx-erd-item-main-row">
                      <div className="amx-erd-item-spec-icon-wrap" aria-hidden="true">
                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                          display_settings
                        </span>
                      </div>
                      <div className="amx-erd-item-text-wrap">
                        <span className="amx-erd-item-name-bold" id="overview-item-name">
                          {request.requested_item}
                        </span>
                        <span className="amx-erd-item-desc-muted">
                          {request.category} &bull; Standard Requisition Specification
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Milestones */}
                  <div className="amx-erd-milestones-grid">
                    <div className="amx-erd-milestone-cell">
                      <span className="amx-erd-field-label">Estimated Cost</span>
                      <div className="amx-erd-milestone-value-row">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '20px', color: 'var(--amx-dash-cyan, #00687a)' }}
                          aria-hidden="true"
                        >
                          payments
                        </span>
                        <span id="overview-pref-date">
                          {request.estimated_cost ? `$${request.estimated_cost}` : 'Standard SLA Allocation'}
                        </span>
                      </div>
                      <span className="amx-erd-milestone-subtext">
                        {request.estimated_cost
                          ? 'Estimated requisition budget'
                          : 'Standard departmental fulfillment cycle'}
                      </span>
                    </div>

                    <div className="amx-erd-milestone-cell">
                      <span className="amx-erd-field-label">Date of Initial Submission</span>
                      <div className="amx-erd-milestone-value-row">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '20px', color: 'var(--amx-dash-text-muted, #76777d)' }}
                          aria-hidden="true"
                        >
                          schedule
                        </span>
                        <span id="overview-sub-date">{request.request_date}</span>
                      </div>
                      <span className="amx-erd-milestone-subtext">
                        Recorded System Timestamp
                      </span>
                    </div>
                  </div>

                  {/* Business Justification */}
                  <div className="amx-erd-justification-wrap">
                    <span className="amx-erd-field-label">Business Justification</span>
                    <div className="amx-erd-justification-box">
                      <span className="material-symbols-outlined amx-erd-quote-icon" aria-hidden="true">
                        format_quote
                      </span>
                      <p className="amx-erd-justification-text" id="overview-justification">
                        {request.justification || 'No justification details recorded.'}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Card 2: Review & Fulfillment Information */}
                <section className="amx-erd-card" aria-labelledby="erd-review-heading">
                  <div className="amx-erd-card-header">
                    <div className="amx-erd-card-title-group">
                      <span className="material-symbols-outlined amx-erd-card-icon" aria-hidden="true">
                        rule
                      </span>
                      <h2 className="amx-erd-card-title" id="erd-review-heading">
                        Review &amp; Fulfillment Information
                      </h2>
                    </div>
                    <span className="amx-erd-card-header-badge">Status Details</span>
                  </div>

                  <div className="amx-erd-two-col-grid">
                    {/* Approver */}
                    <div className="amx-erd-reviewer-cell">
                      <span className="amx-erd-field-label">Approver</span>
                      <div className="amx-erd-reviewer-row">
                        <div className="amx-erd-reviewer-avatar">
                          {approverName === 'Not assigned' ? '--' : approverName.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="amx-erd-reviewer-name" id="review-approver">
                            {approverName}
                          </span>
                          <span className="amx-erd-milestone-subtext">
                            {approverName === 'Not assigned'
                              ? 'Pending reviewer assignment'
                              : 'Departmental Reviewer'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Approval Date */}
                    <div className="amx-erd-reviewer-cell">
                      <span className="amx-erd-field-label">Approval Date</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px' }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '18px', color: 'var(--amx-dash-text-muted, #76777d)' }}
                          aria-hidden="true"
                        >
                          {approvalDate === 'Not recorded' ? 'event_busy' : 'event_available'}
                        </span>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '13px',
                            fontWeight: 600,
                            color:
                              approvalDate === 'Not recorded'
                                ? 'var(--amx-dash-text-muted, #76777d)'
                                : 'var(--amx-dash-text, #191c1e)',
                          }}
                          id="review-approval-date"
                        >
                          {approvalDate}
                        </span>
                      </div>
                      <span className="amx-erd-milestone-subtext">
                        {approvalDate === 'Not recorded'
                          ? 'Awaiting formal review'
                          : 'Recorded decision milestone'}
                      </span>
                    </div>
                  </div>

                  {/* Operational Remarks */}
                  <div className="amx-erd-remarks-box">
                    <span className="amx-erd-field-label">Operational Notes / Guidelines</span>
                    <p className="amx-erd-remarks-text" id="review-remarks">
                      {request.processing_guidelines || 'None recorded'}
                    </p>
                  </div>

                  <div className="amx-erd-two-col-grid">
                    {/* Fulfilled Quantity */}
                    <div className="amx-erd-reviewer-cell">
                      <span className="amx-erd-field-label">Fulfilled Quantity</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px' }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '18px', color: 'var(--amx-dash-text-muted, #76777d)' }}
                          aria-hidden="true"
                        >
                          {request.status === 'Fulfilled' ? 'inventory_2' : 'hourglass_empty'}
                        </span>
                        <span
                          style={{ fontSize: '14px', fontWeight: 600, color: 'var(--amx-dash-text, #191c1e)' }}
                          id="review-fulfilled-qty"
                        >
                          {request.status === 'Fulfilled'
                            ? `${request.quantity} ${request.quantity === 1 ? 'Unit' : 'Units'}`
                            : 'Awaiting fulfillment'}
                        </span>
                      </div>
                      <span className="amx-erd-milestone-subtext">
                        {request.status === 'Fulfilled' ? 'Fully disbursed' : 'Pending allocation'}
                      </span>
                    </div>

                    {/* Fulfillment Date */}
                    <div className="amx-erd-reviewer-cell">
                      <span className="amx-erd-field-label">Fulfillment Date</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px' }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '18px', color: 'var(--amx-dash-text-muted, #76777d)' }}
                          aria-hidden="true"
                        >
                          {fulfillmentDate === 'Not recorded' ? 'event_busy' : 'check_circle'}
                        </span>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '13px',
                            fontWeight: 600,
                            color:
                              fulfillmentDate === 'Not recorded'
                                ? 'var(--amx-dash-text-muted, #76777d)'
                                : 'var(--amx-dash-text, #191c1e)',
                          }}
                          id="review-fulfillment-date"
                        >
                          {fulfillmentDate}
                        </span>
                      </div>
                      <span className="amx-erd-milestone-subtext">
                        {fulfillmentDate === 'Not recorded'
                          ? 'To be confirmed upon dispatch'
                          : 'Confirmed disbursement milestone'}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Card 3: Request History */}
                <section className="amx-erd-card" aria-labelledby="erd-history-heading">
                  <div className="amx-erd-card-header">
                    <div className="amx-erd-card-title-group">
                      <span className="material-symbols-outlined amx-erd-card-icon" aria-hidden="true">
                        history
                      </span>
                      <h2 className="amx-erd-card-title" id="erd-history-heading">
                        Request History
                      </h2>
                    </div>
                    <span className="amx-erd-card-header-badge">Chronological Audit Trail</span>
                  </div>

                  {request.history && request.history.length > 0 ? (
                    <div className="amx-erd-timeline-wrap" id="erdTimeline">
                      <div className="amx-erd-timeline-line" aria-hidden="true" />
                      {request.history.map((event, index) => {
                        const isLatest = index === request.history.length - 1;
                        return (
                          <div key={event.history_id || index} className="amx-erd-timeline-item">
                            <div className={`amx-erd-timeline-node ${isLatest ? 'active' : ''}`} aria-hidden="true">
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                {event.stage.toLowerCase() === 'fulfilled'
                                  ? 'check_circle'
                                  : event.stage.toLowerCase() === 'in review'
                                  ? 'hourglass_top'
                                  : event.stage.toLowerCase() === 'rejected'
                                  ? 'cancel'
                                  : 'send'}
                              </span>
                            </div>

                            <div className="amx-erd-timeline-card">
                              <div className="amx-erd-timeline-top">
                                <span className="amx-erd-timeline-title">
                                  {event.action || event.stage}
                                </span>
                                <span className="amx-erd-timeline-time">{event.timestamp}</span>
                              </div>
                              <p className="amx-erd-timeline-action">
                                {event.note
                                  ? event.note
                                  : `Recorded by ${event.performed_by || 'System'}.`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="amx-erd-empty-docs">
                      <p className="amx-erd-empty-docs-desc">
                        No historical audit entries recorded yet for this requisition.
                      </p>
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column (4 Cols): Requester, Supporting Documents, Support Help */}
              <div className="amx-erd-col-side">
                {/* Card 1: Requester */}
                <section className="amx-erd-card" aria-labelledby="erd-requester-heading">
                  <div className="amx-erd-card-header">
                    <div className="amx-erd-card-title-group">
                      <span className="material-symbols-outlined amx-erd-card-icon" aria-hidden="true">
                        person
                      </span>
                      <h2 className="amx-erd-card-title" id="erd-requester-heading">
                        Requester Profile
                      </h2>
                    </div>
                    <span className="amx-erd-card-header-badge">Originator</span>
                  </div>

                  <div className="amx-erd-profile-row">
                    <div className="amx-erd-profile-avatar" id="erdUserAvatar">
                      {userInitials}
                    </div>
                    <div className="amx-erd-profile-info">
                      <span className="amx-erd-profile-name" id="erdUserName">
                        {request.requester_name || userDisplayName}
                      </span>
                      <span className="amx-erd-profile-sub" id="erdUserEmail">
                        {request.requester_email || currentUser?.email}
                      </span>
                    </div>
                  </div>

                  <div className="amx-erd-spec-list">
                    <div className="amx-erd-spec-item">
                      <span className="amx-erd-spec-lbl">Department</span>
                      <span className="amx-erd-spec-val" id="erdUserDept">
                        {request.department || 'Product Design'}
                      </span>
                    </div>
                    <div className="amx-erd-spec-item">
                      <span className="amx-erd-spec-lbl">Employee ID</span>
                      <span
                        className="amx-erd-spec-val"
                        style={{ color: 'var(--amx-dash-cyan, #00687a)' }}
                        id="erdUserEmpId"
                      >
                        {currentUser?.employee_id || 'EMP-2024-0419'}
                      </span>
                    </div>
                    <div className="amx-erd-spec-item">
                      <span className="amx-erd-spec-lbl">System Role</span>
                      <span className="amx-erd-spec-val">Employee (Self-Service)</span>
                    </div>
                  </div>
                </section>

                {/* Card 2: Supporting Documents */}
                <section className="amx-erd-card" aria-labelledby="erd-docs-heading">
                  <div className="amx-erd-card-header">
                    <div className="amx-erd-card-title-group">
                      <span className="material-symbols-outlined amx-erd-card-icon" aria-hidden="true">
                        attach_file
                      </span>
                      <h2 className="amx-erd-card-title" id="erd-docs-heading">
                        Supporting Documents
                      </h2>
                    </div>
                    <span className="amx-erd-card-header-badge" id="erdDocsCount">
                      {attachments.length} {attachments.length === 1 ? 'File' : 'Files'}
                    </span>
                  </div>

                  {attachments.length > 0 ? (
                    <div className="amx-erd-docs-list" id="erdDocsList">
                      {attachments.map((doc) => (
                        <div key={doc.attachment_id || doc.id} className="amx-erd-doc-card">
                          <div className="amx-erd-doc-top">
                            <div className="amx-erd-doc-icon-box" aria-hidden="true">
                              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                picture_as_pdf
                              </span>
                            </div>
                            <div className="amx-erd-doc-meta">
                              <span className="amx-erd-doc-name" title={doc.original_filename || doc.name}>
                                {doc.original_filename || doc.name}
                              </span>
                              <span className="amx-erd-doc-sub">
                                {doc.size || 'Attached'} &bull; Uploaded{' '}
                                {doc.uploadDate || doc.uploaded_at || request.request_date}
                              </span>
                            </div>
                          </div>

                          <div className="amx-erd-doc-actions">
                            <button
                              type="button"
                              className="amx-erd-doc-btn secondary"
                              onClick={() => handleViewAttachment(doc)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">
                                visibility
                              </span>
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              className="amx-erd-doc-btn primary"
                              onClick={() => handleDownloadAttachment(doc)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">
                                download
                              </span>
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="amx-erd-empty-docs" id="erdNoDocsBox">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '24px', color: 'var(--amx-dash-text-muted, #76777d)' }}
                        aria-hidden="true"
                      >
                        attach_file
                      </span>
                      <p className="amx-erd-empty-docs-desc">
                        No supporting documents attached to this requisition.
                      </p>
                    </div>
                  )}

                  <div style={{ textAlign: 'center', paddingTop: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--amx-dash-text-muted, #76777d)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        info
                      </span>
                      <span>Attached to requisition in registry</span>
                    </span>
                  </div>
                </section>

                {/* Card 3: Support Assistance */}
                <section className="amx-erd-card support" aria-labelledby="erd-support-heading">
                  <div className="amx-erd-support-header">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '20px', color: 'var(--amx-dash-cyan, #00687a)' }}
                      aria-hidden="true"
                    >
                      contact_support
                    </span>
                    <span id="erd-support-heading">Need Help with this Request?</span>
                  </div>
                  <p className="amx-erd-support-desc">
                    If you need to revise specifications or update delivery preferences, contact
                    the IT Hardware Desk quoting{' '}
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{request.request_id}</strong>.
                  </p>
                  <div className="amx-erd-support-link-row">
                    <button
                      type="button"
                      className="amx-erd-support-link"
                      onClick={() =>
                        showToast(`IT Support Desk: Contact extension 4402 or helpdesk@assetmx.local quoting ${request.request_id}`)
                      }
                    >
                      <span>IT Support Desk</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        open_in_new
                      </span>
                    </button>
                    <span style={{ color: 'var(--amx-dash-border, #c6c6cd)' }}>&bull;</span>
                    <span style={{ color: 'var(--amx-dash-text-muted, #76777d)' }}>Extension 4402</span>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}

        {/* Client Feedback Toast */}
        {toastMessage && (
          <div className="amx-erd-toast" role="status">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              task_alt
            </span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EmployeeRequestDetailsPage;
