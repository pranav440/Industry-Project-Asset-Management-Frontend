import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getRequest, transitionRequest, type RequestApiError, type RequestStatus } from '../api/requestApi';
import './RequestDetails.css';

interface RequestItemData {
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
  status: RequestStatus;
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

interface RequestDetailsPageProps {
  requestId: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
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
        setApiError(status === 401 ? 'Your session has expired. Please sign in again.' : status === 403 ? 'Admin access is required to view this request.' : status === 404 ? 'The selected request could not be found.' : status === 409 ? 'This request status change is not allowed.' : status === 422 ? 'The request data is invalid.' : status && status >= 500 ? 'The request service is temporarily unavailable.' : error instanceof Error ? error.message : 'Unable to load request details.');
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

  // Execute Status Transition
  const handleConfirmProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTransition(true);

    try {
      const updated = await transitionRequest(request.id, {
        target_status: targetState,
        operational_note: operationalNote.trim() || undefined,
      });

      setRequest({
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
        history: updated.history.map((entry) => ({
          id: entry.history_id,
          timestamp: entry.timestamp,
          stage: entry.stage,
          action: entry.action,
          performedBy: entry.performed_by,
          note: entry.note ?? undefined,
        })),
      });
      setIsProcessModalOpen(false);
      setOperationalNote('');
      showToast(`Request ${request.id} successfully updated to "${targetState}".`);
    } catch (error: unknown) {
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

        {/* Panel 3: Request History & Audit Trail */}
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
    </DashboardLayout>
  );
};

export default RequestDetailsPage;
