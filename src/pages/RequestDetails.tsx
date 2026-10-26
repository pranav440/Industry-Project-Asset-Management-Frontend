import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getRequest,
  transitionRequest,
  downloadRequestAttachment,
  previewRequestAttachment,
  RequestApiError,
  type RequestStatus,
  type RequestAttachmentApiRecord,
} from '../api/requestApi';
import {
  type RequestItemData,
  type RequestAttachment,
} from '../data/requestsData';
import './RequestDetails.css';

interface RequestDetailsPageProps {
  requestId: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

interface PreviewState {
  doc: RequestAttachment | RequestAttachmentApiRecord;
  objectUrl?: string;
  contentType?: string;
  isInline?: boolean;
  isLoading: boolean;
  error?: string;
}

export const RequestDetailsPage: React.FC<RequestDetailsPageProps> = ({
  requestId,
  onNavigate,
  onSignOut,
}) => {
  const [request, setRequest] = useState<RequestItemData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Processing Modal State
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [targetState, setTargetState] = useState<RequestStatus>('In Review');
  const [operationalNote, setOperationalNote] = useState('');
  const [isSubmittingTransition, setIsSubmittingTransition] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setApiError(null);

    getRequest(requestId)
      .then((response) => {
        if (!active) return;
        setRequest({
          id: response.request_id,
          requesterName: response.requester_name,
          requesterEmail: response.requester_email,
          department: response.department,
          requestType: response.request_type,
          requestedItem: response.requested_item,
          category: response.category,
          quantity: response.quantity,
          priority: response.priority,
          requestDate: response.request_date,
          status: response.status,
          justification: response.justification,
          processingGuidelines: response.processing_guidelines,
          requestSource: response.request_source,
          estimatedCost: response.estimated_cost || undefined,
          procurementReference: response.procurement_reference || undefined,
          attachments: (response.attachments || []) as any,
          dateReceived: response.date_received || undefined,
          externalReference: response.external_reference || undefined,
          contactInfo: response.contact_info || undefined,
          history: response.history.map((entry) => ({
            id: entry.history_id,
            timestamp: entry.timestamp,
            stage: entry.stage,
            action: entry.action,
            performedBy: entry.performed_by,
            note: entry.note ?? undefined,
          })),
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = (error as RequestApiError).status;
        setApiError(
          status === 401
            ? 'Your session has expired. Please sign in again.'
            : status === 403
            ? 'Admin access is required to view this request.'
            : status === 404
            ? 'The selected request could not be found.'
            : status === 409
            ? 'This request status change is not allowed.'
            : status === 422
            ? 'The request data is invalid.'
            : status && status >= 500
            ? 'The request service is temporarily unavailable.'
            : error instanceof Error
            ? error.message
            : 'Unable to load request details.'
        );
        setRequest(null);
      })
      .finally(() => active && setIsLoading(false));

    return () => {
      active = false;
    };
  }, [requestId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
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
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} module — Scheduled for future backend integration.`);
      onNavigate?.(subRoute);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout currentNav="Requests" onNavigate={handleNav} onSignOut={onSignOut}>
        <div style={{ padding: '32px', textAlign: 'center' }}>Loading request details...</div>
      </DashboardLayout>
    );
  }

  if (!request) {
    return (
      <DashboardLayout currentNav="Requests" onNavigate={handleNav} onSignOut={onSignOut}>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          {apiError || 'Request not found.'}
        </div>
      </DashboardLayout>
    );
  }

  const statusClass = request.status.toLowerCase().replace(/\s+/g, '-');
  const priorityClass = request.priority.toLowerCase();
  const typeClass = request.requestType === 'Asset Request' ? 'asset' : 'consumable';

  // Open Modal Helpers
  const handleOpenProcessModal = (target: RequestStatus) => {
    setTargetState(target);
    setOperationalNote('');
    setIsProcessModalOpen(true);
  };

  const handlePreviewDocument = async (doc: RequestAttachment | RequestAttachmentApiRecord) => {
    const attId = (doc as any).attachment_id || doc.id;
    if (previewState?.objectUrl) {
      URL.revokeObjectURL(previewState.objectUrl);
    }
    setPreviewState({ doc, isLoading: true });

    try {
      const res = await previewRequestAttachment(request.id, attId);
      if (!res.isInline) {
        const a = document.createElement('a');
        a.href = res.objectUrl;
        a.download = res.filename || doc.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(res.objectUrl);
        setPreviewState(null);
        showToast(`Document "${doc.name}" downloaded.`);
        return;
      }

      setPreviewState({
        doc,
        objectUrl: res.objectUrl,
        contentType: res.contentType,
        isInline: true,
        isLoading: false,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof RequestApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to preview document';
      setPreviewState({
        doc,
        isLoading: false,
        error: msg,
      });
      showToast(`Preview failed: ${msg}`);
    }
  };

  const handleDownloadDocument = async (doc: RequestAttachment | RequestAttachmentApiRecord) => {
    const attId = (doc as any).attachment_id || doc.id;
    try {
      showToast(`Downloading "${doc.name}"...`);
      await downloadRequestAttachment(request.id, attId, doc.name);
      showToast(`Document "${doc.name}" downloaded.`);
    } catch (err: unknown) {
      const msg =
        err instanceof RequestApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Download failed';
      showToast(`Download failed: ${msg}`);
    }
  };

  const handleClosePreview = () => {
    if (previewState?.objectUrl) {
      URL.revokeObjectURL(previewState.objectUrl);
    }
    setPreviewState(null);
  };

  // Execute Status Transition
  const handleConfirmProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTransition(true);

    try {
      const updated = await transitionRequest(request.id, {
        target_status: targetState,
        operational_note: operationalNote.trim() || undefined,
      });

      setRequest((prev) => ({
        ...(prev || {}),
        id: updated.request_id,
        requesterName: updated.requester_name,
        requesterEmail: updated.requester_email,
        department: updated.department,
        requestType: updated.request_type,
        requestedItem: updated.requested_item,
        category: updated.category,
        quantity: updated.quantity,
        priority: updated.priority,
        requestDate: updated.request_date,
        status: updated.status,
        justification: updated.justification,
        processingGuidelines: updated.processing_guidelines,
        requestSource: updated.request_source || prev?.requestSource,
        dateReceived: updated.date_received || prev?.dateReceived || undefined,
        externalReference: updated.external_reference || prev?.externalReference || undefined,
        contactInfo: updated.contact_info || prev?.contactInfo || undefined,
        estimatedCost: updated.estimated_cost || prev?.estimatedCost || undefined,
        procurementReference: updated.procurement_reference || prev?.procurementReference || undefined,
        attachments: (updated.attachments || prev?.attachments || []) as any,
        history: updated.history.map((entry) => ({
          id: entry.history_id,
          timestamp: entry.timestamp,
          stage: entry.stage,
          action: entry.action,
          performedBy: entry.performed_by,
          note: entry.note ?? undefined,
        })),
      } as RequestItemData));
      setIsProcessModalOpen(false);
      setOperationalNote('');
      showToast(`Request ${request.id} successfully updated to "${targetState}".`);
    } catch (error: unknown) {
      console.error('Failed to update request status', error);
      const status = (error as RequestApiError).status;
      const message = status === 401 ? 'Your session has expired. Please sign in again.' : status === 403 ? 'Admin access is required to update this request.' : status === 404 ? 'The selected request could not be found.' : status === 409 ? 'This request status change is not allowed.' : status === 422 ? 'The transition is invalid. Please review the input and try again.' : status && status >= 500 ? 'The request service is temporarily unavailable.' : error instanceof Error ? error.message : 'Unable to update the request status.';
      showToast(message);
    } finally {
      setIsSubmittingTransition(false);
    }
  };

  return (
    <DashboardLayout
      currentNav="Requests"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: High priority hardware request pending review.')
      }
      onHelpClick={() => showToast('AssetMX Requests Management Manual.')}
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

      <div className="amx-req-details-container">
        {/* Breadcrumb Navigation */}
        <nav className="amx-breadcrumb-nav" aria-label="Breadcrumb">
          <button
            type="button"
            className="amx-back-btn"
            onClick={() => onNavigate?.('requests')}
            aria-label="Back to Requests"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
              arrow_back
            </span>
            <span>Back to Requests</span>
          </button>
          <span className="amx-breadcrumb-sep">/</span>
          <span className="amx-breadcrumb-curr">{request.id}</span>
        </nav>

        {/* Top Header Row */}
        <div className="amx-req-details-header-row">
          <div className="amx-details-title-group">
            <div className="amx-req-details-title-wrap">
              <h2 className="amx-details-title">{request.requestedItem}</h2>
              <span className="amx-details-id-badge">{request.id}</span>
              <span className={`amx-req-status-badge ${statusClass}`}>
                {request.status}
              </span>
            </div>
            <p className="amx-consumables-subtitle">
              Submitted on {request.requestDate} by {request.requesterName} ({request.department})
            </p>
          </div>

          {/* Action buttons based on current state */}
          <div className="amx-details-header-actions">
            {request.status !== 'Rejected' && request.status !== 'Fulfilled' && (
              <button
                type="button"
                className="amx-btn-reject"
                onClick={() => handleOpenProcessModal('Rejected')}
                aria-label="Reject Request"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  cancel
                </span>
                <span>Reject Request</span>
              </button>
            )}

            {request.status === 'Pending' && (
              <button
                type="button"
                className="amx-btn-in-review"
                onClick={() => handleOpenProcessModal('In Review')}
                aria-label="Mark In Review"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  rate_review
                </span>
                <span>Mark In Review</span>
              </button>
            )}

            {request.status !== 'Fulfilled' && request.status !== 'Rejected' && (
              <button
                type="button"
                className="amx-btn-fulfil"
                onClick={() => handleOpenProcessModal('Fulfilled')}
                aria-label="Fulfil Request"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  check_circle
                </span>
                <span>Fulfil Request</span>
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="amx-req-details-grid">
          {/* Panel 1: Request Information & Overview */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  info
                </span>
                Request Information & Overview
              </h3>
            </div>
            <div className="amx-panel-body">
              <div className="amx-kv-grid">
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Request ID</span>
                  <span className="amx-kv-value amx-kv-mono">{request.id}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Request Date</span>
                  <span className="amx-kv-value amx-kv-mono">{request.requestDate}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Request Type</span>
                  <span className="amx-kv-value">
                    <span className={`amx-type-badge ${typeClass}`}>
                      {request.requestType}
                    </span>
                  </span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Priority Level</span>
                  <span className="amx-kv-value">
                    <span className={`amx-priority-badge ${priorityClass}`}>
                      {request.priority} Priority
                    </span>
                  </span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Requester</span>
                  <span className="amx-kv-value">{request.requesterName}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Department</span>
                  <span className="amx-kv-value">{request.department}</span>
                </div>
                <div className="amx-kv-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="amx-kv-label">Current Stage</span>
                  <span className="amx-kv-value">
                    <span className={`amx-req-status-badge ${statusClass}`}>
                      {request.status}
                    </span>
                  </span>
                </div>
              </div>

              {request.processingGuidelines && (
                <div style={{ marginTop: '10px', padding: '12px 14px', backgroundColor: 'var(--amx-dash-bg)', borderRadius: '6px', border: '1px solid var(--amx-dash-border-light)' }}>
                  <span className="amx-kv-label" style={{ display: 'block', marginBottom: '4px' }}>
                    Processing Guidelines
                  </span>
                  <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--amx-dash-text)', lineHeight: 1.4 }}>
                    {request.processingGuidelines}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Panel 2: Requested Item & Justification */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  inventory_2
                </span>
                Requested Item & Justification
              </h3>
            </div>
            <div className="amx-panel-body">
              <div className="amx-kv-grid">
                <div className="amx-kv-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="amx-kv-label">Item / Asset Name</span>
                  <span className="amx-kv-value" style={{ fontSize: '16px' }}>{request.requestedItem}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Category</span>
                  <span className="amx-kv-value">{request.category}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Requested Quantity</span>
                  <span className="amx-kv-value" style={{ fontWeight: 700 }}>{request.quantity} Units</span>
                </div>
              </div>

              <div style={{ marginTop: '6px' }}>
                <span className="amx-kv-label" style={{ display: 'block', marginBottom: '6px' }}>
                  Business Justification
                </span>
                <div style={{ padding: '12px 14px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--amx-dash-border-light)', fontSize: '14px', lineHeight: 1.5, color: 'var(--amx-dash-text)' }}>
                  {request.justification}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Procurement & Approval Details */}
        <div className="amx-panel-card" id="amx-procurement-metadata-panel">
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                receipt_long
              </span>
              Procurement &amp; Approval Details
            </h3>
          </div>
          <div className="amx-panel-body">
            <div className="amx-kv-grid amx-procurement-kv-grid">
              <div className="amx-kv-item">
                <span className="amx-kv-label">Request Source</span>
                <span className="amx-kv-value" id="req-meta-source">
                  {request.requestSource ? (
                    <span className={`amx-source-pill ${request.requestSource.toLowerCase()}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                        {request.requestSource.toLowerCase() === 'external' ? 'open_in_new' : 'domain'}
                      </span>
                      {request.requestSource}
                    </span>
                  ) : (
                    <span className="amx-text-muted">Not provided</span>
                  )}
                </span>
              </div>

              <div className="amx-kv-item">
                <span className="amx-kv-label">Estimated Cost</span>
                <span className="amx-kv-value amx-kv-mono" id="req-meta-cost">
                  {request.estimatedCost && request.estimatedCost.trim() ? (
                    request.estimatedCost.startsWith('₹') || request.estimatedCost.startsWith('$')
                      ? request.estimatedCost
                      : !isNaN(Number(request.estimatedCost.replace(/,/g, '')))
                      ? `₹${Number(request.estimatedCost.replace(/,/g, '')).toLocaleString('en-IN')}`
                      : request.estimatedCost
                  ) : (
                    <span className="amx-text-muted">Not provided</span>
                  )}
                </span>
              </div>

              <div className="amx-kv-item">
                <span className="amx-kv-label">Procurement Reference</span>
                <span className="amx-kv-value amx-kv-mono" id="req-meta-proc-ref">
                  {request.procurementReference && request.procurementReference.trim() ? (
                    request.procurementReference
                  ) : (
                    <span className="amx-text-muted">Not provided</span>
                  )}
                </span>
              </div>

              {request.externalReference && (
                <div className="amx-kv-item">
                  <span className="amx-kv-label">External Reference</span>
                  <span className="amx-kv-value amx-kv-mono" id="req-meta-ext-ref">
                    {request.externalReference}
                  </span>
                </div>
              )}

              {request.dateReceived && (
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Date Received</span>
                  <span className="amx-kv-value amx-kv-mono" id="req-meta-date-received">
                    {request.dateReceived}
                  </span>
                </div>
              )}

              <div className="amx-kv-item" style={{ gridColumn: '1 / -1' }}>
                <span className="amx-kv-label">Approval Documents</span>
                {request.attachments && request.attachments.length > 0 ? (
                  <div className="amx-attachments-list" id="req-meta-attachments">
                    {request.attachments.map((att) => (
                      <div key={att.id} className="amx-attachment-chip">
                        <span className="material-symbols-outlined amx-attachment-icon" aria-hidden="true">
                          {att.name.endsWith('.pdf')
                            ? 'picture_as_pdf'
                            : att.name.match(/\.(png|jpg|jpeg)$/i)
                            ? 'image'
                            : 'description'}
                        </span>
                        <div className="amx-attachment-info">
                          <span className="amx-attachment-name" title={att.name}>{att.name}</span>
                          <span className="amx-attachment-size">
                            {att.size}{att.uploadDate ? ` • ${att.uploadDate}` : ''}
                          </span>
                        </div>
                        <div className="amx-attachment-actions">
                          <button
                            type="button"
                            className="amx-attachment-action-btn"
                            onClick={() => handlePreviewDocument(att)}
                            title={`Preview ${att.name}`}
                            aria-label={`Preview ${att.name}`}
                            id={`btn-preview-${att.id}`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">
                              visibility
                            </span>
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            className="amx-attachment-action-btn"
                            onClick={() => handleDownloadDocument(att)}
                            title={`Download ${att.name}`}
                            aria-label={`Download ${att.name}`}
                            id={`btn-download-${att.id}`}
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
                  <span className="amx-kv-value amx-text-muted" id="req-meta-attachments-empty">
                    Not provided
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel 4: Request History & Audit Trail */}
        <div className="amx-panel-card">
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                history
              </span>
              Request History & Audit Trail
            </h3>
          </div>
          <div className="amx-panel-body">
            <div className="amx-history-timeline">
              {request.history.map((evt) => (
                <div key={evt.id} className="amx-timeline-item">
                  <div className="amx-timeline-dot">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                      {evt.stage === 'Fulfilled'
                        ? 'check'
                        : evt.stage === 'Rejected'
                        ? 'close'
                        : evt.stage === 'In Review'
                        ? 'visibility'
                        : 'schedule'}
                    </span>
                  </div>
                  <div className="amx-timeline-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 className="amx-timeline-action">{evt.action}</h4>
                      <span className="amx-timeline-meta" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {evt.timestamp}
                      </span>
                    </div>
                    <span className="amx-timeline-meta">Performed by: {evt.performedBy}</span>
                    {evt.note && <div className="amx-timeline-note">{evt.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SCREEN 3: REQUEST PROCESSING MODAL */}
      {/* ================================================================= */}
      {isProcessModalOpen && (
        <div className="amx-modal-backdrop" onClick={() => setIsProcessModalOpen(false)}>
          <div
            className="amx-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="modal-process-title"
          >
            <div className="amx-modal-header">
              <h3 className="amx-modal-title" id="modal-process-title">
                Process Request — {request.id}
              </h3>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setIsProcessModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmProcess}>
              <div className="amx-modal-body">
                {/* Current State -> Target State */}
                <div className="amx-modal-verify-box">
                  <span className="amx-kv-label">State Transition</span>
                  <div className="amx-state-transition-pill">
                    <span className={`amx-req-status-badge ${statusClass}`}>
                      {request.status}
                    </span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--amx-dash-text-muted)' }} aria-hidden="true">
                      arrow_forward
                    </span>
                    <span
                      className={`amx-req-status-badge ${
                        targetState === 'In Review'
                          ? 'in-review'
                          : targetState === 'Fulfilled'
                          ? 'fulfilled'
                          : 'rejected'
                      }`}
                    >
                      {targetState}
                    </span>
                  </div>
                </div>

                {/* Requested Item Verification */}
                <div className="amx-modal-verify-box">
                  <span className="amx-kv-label">Requested Item Verification</span>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--amx-dash-text)' }}>
                    {request.requestedItem}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--amx-dash-text-muted)', flexWrap: 'wrap' }}>
                    <span>Category: <strong>{request.category}</strong></span>
                    <span>Quantity: <strong>{request.quantity} Units</strong></span>
                    <span>Priority: <strong>{request.priority}</strong></span>
                  </div>
                </div>

                {/* Operational Note (Optional) */}
                <div className="amx-form-group">
                  <label className="amx-form-label">Operational Note (Optional)</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    placeholder="e.g. Allocation verified against Central Hardware stock"
                    value={operationalNote}
                    onChange={(e) => setOperationalNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="amx-modal-footer">
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => setIsProcessModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={targetState === 'Rejected' ? 'amx-btn-reject' : 'amx-btn-primary'}
                  disabled={isSubmittingTransition}
                >
                  {isSubmittingTransition ? 'Processing...' : `Confirm ${targetState}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewState && (
        <div className="amx-modal-backdrop" onClick={handleClosePreview}>
          <div
            className="amx-modal-dialog"
            style={{ maxWidth: '640px', width: '92vw' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-preview-doc-title"
          >
            <div className="amx-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }}>
                  description
                </span>
                <h3 className="amx-modal-title" id="modal-preview-doc-title" style={{ fontSize: '15px' }}>
                  Document Preview
                </h3>
              </div>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={handleClosePreview}
                aria-label="Close preview"
                id="btn-close-doc-preview"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            <div className="amx-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', backgroundColor: 'var(--amx-dash-bg)', borderRadius: '6px', border: '1px solid var(--amx-dash-border-light)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--amx-dash-secondary)' }}>
                  {previewState.doc.name.endsWith('.pdf') ? 'picture_as_pdf' : previewState.doc.name.match(/\.(png|jpg|jpeg)$/i) ? 'image' : 'description'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--amx-dash-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} id="preview-doc-name">
                    {previewState.doc.name}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--amx-dash-text-muted)', fontFamily: 'JetBrains Mono, monospace' }} id="preview-doc-meta">
                    {previewState.doc.size}{previewState.doc.uploadDate ? ` • Recorded on ${previewState.doc.uploadDate}` : ''}
                  </span>
                </div>
              </div>

              {previewState.isLoading && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--amx-dash-text-muted)' }}>
                  Loading document preview...
                </div>
              )}

              {previewState.error && (
                <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '6px', color: '#991b1b', fontSize: '13px' }}>
                  <strong>Preview error:</strong> {previewState.error}
                </div>
              )}

              {previewState.objectUrl && previewState.contentType === 'application/pdf' && (
                <div style={{ width: '100%', height: '480px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--amx-dash-border-light)' }}>
                  <iframe
                    src={previewState.objectUrl}
                    title={previewState.doc.name}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
              )}

              {previewState.objectUrl && previewState.contentType?.startsWith('image/') && (
                <div style={{ textAlign: 'center', maxHeight: '480px', overflow: 'auto', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--amx-dash-border-light)' }}>
                  <img
                    src={previewState.objectUrl}
                    alt={previewState.doc.name}
                    style={{ maxWidth: '100%', maxHeight: '460px', objectFit: 'contain', borderRadius: '4px' }}
                  />
                </div>
              )}
            </div>

            <div className="amx-modal-footer">
              <button
                type="button"
                className="amx-btn-secondary"
                onClick={handleClosePreview}
                id="btn-dismiss-doc-preview"
              >
                Close Preview
              </button>
              <button
                type="button"
                className="amx-btn-primary"
                id="btn-download-from-preview"
                onClick={() => {
                  handleDownloadDocument(previewState.doc);
                  handleClosePreview();
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                  download
                </span>
                <span>Download Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default RequestDetailsPage;
