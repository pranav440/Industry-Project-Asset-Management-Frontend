import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getStoredGatePasses,
  saveStoredGatePasses,
  type GatePassItemData,
  type GatePassStatus,
} from '../data/gatePassData';
import './GatePassDetails.css';

interface GatePassDetailsPageProps {
  passId: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const GatePassDetailsPage: React.FC<GatePassDetailsPageProps> = ({
  passId,
  onNavigate,
  onSignOut,
}) => {
  const [gatePass, setGatePass] = useState<GatePassItemData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Decision Modal State (Supported: Approve, Reject, Override)
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'Approve' | 'Reject' | 'Override'>('Approve');
  const [operationalRemarks, setOperationalRemarks] = useState('');

  useEffect(() => {
    const list = getStoredGatePasses();
    const found = list.find((p) => p.id === passId);
    if (found) {
      setGatePass(found);
    } else if (list.length > 0) {
      setGatePass(list[0]);
    }
  }, [passId]);

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
    } else if (subRoute === 'gate-pass' || subRoute === 'gate pass') {
      onNavigate?.('gate-pass');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} module — Scheduled for future backend integration.`);
      onNavigate?.(subRoute);
    }
  };

  if (!gatePass) {
    return (
      <DashboardLayout currentNav="Gate Pass" onNavigate={handleNav} onSignOut={onSignOut}>
        <div style={{ padding: '32px', textAlign: 'center' }}>Loading gate pass details...</div>
      </DashboardLayout>
    );
  }

  const statusClass = gatePass.status.toLowerCase();

  // Open Decision Modal
  const handleOpenDecisionModal = (mode: 'Approve' | 'Reject' | 'Override') => {
    setModalMode(mode);
    setOperationalRemarks('');
    setIsDecisionModalOpen(true);
  };

  // Confirm Decision Transition
  const handleConfirmDecision = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let targetStatus: GatePassStatus = gatePass.status;
    let actionName = 'Administrative decision';
    let authState = gatePass.authorizationState;
    let decStatus = gatePass.decisionStatus;

    if (modalMode === 'Approve') {
      targetStatus = 'Approved';
      actionName = 'Approval decision';
      authState = 'Administrative Clearance Granted';
      decStatus = 'Approved by Administrator';
    } else if (modalMode === 'Reject') {
      targetStatus = 'Rejected';
      actionName = 'Rejection decision';
      authState = 'Administrative Request Denied';
      decStatus = 'Rejected by Administrator';
    } else if (modalMode === 'Override') {
      targetStatus = 'Approved';
      actionName = 'Override';
      authState = 'Administrative Override Clearance';
      decStatus = 'Override Granted by Administrator';
    }

    const newHistoryEntry = {
      id: `EVT-GP-${Date.now().toString().slice(-4)}`,
      timestamp: timestampStr,
      action: actionName,
      performedBy: 'Administrator',
      note: operationalRemarks.trim() || undefined,
      statusSnapshot: targetStatus,
    };

    const updatedPass: GatePassItemData = {
      ...gatePass,
      status: targetStatus,
      authorizationState: authState,
      decisionStatus: decStatus,
      decisionDate: timestampStr,
      decisionBy: 'Administrator',
      escalation: modalMode === 'Override' || modalMode === 'Approve' ? { isEscalated: false } : gatePass.escalation,
      history: [newHistoryEntry, ...gatePass.history],
    };

    const all = getStoredGatePasses();
    const idx = all.findIndex((p) => p.id === gatePass.id);
    if (idx >= 0) {
      all[idx] = updatedPass;
    } else {
      all.push(updatedPass);
    }
    saveStoredGatePasses(all);
    setGatePass(updatedPass);
    setIsDecisionModalOpen(false);
    showToast(`Gate Pass ${gatePass.id} status updated to "${targetStatus}".`);
  };

  return (
    <DashboardLayout
      currentNav="Gate Pass"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Gate pass record notification.')
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

      <div className="amx-gp-details-container">
        {/* Breadcrumb Navigation */}
        <nav className="amx-breadcrumb-nav" aria-label="Breadcrumb">
          <button
            type="button"
            className="amx-back-btn"
            onClick={() => onNavigate?.('gate-pass')}
            aria-label="Back to Gate Pass"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
              arrow_back
            </span>
            <span>Back to Gate Pass</span>
          </button>
          <span className="amx-breadcrumb-sep">/</span>
          <span className="amx-breadcrumb-curr">{gatePass.id}</span>
        </nav>

        {/* Top Header Row */}
        <div className="amx-gp-details-header-row">
          <div className="amx-details-title-group">
            <div className="amx-gp-details-title-wrap">
              <h2 className="amx-details-title">Gate Pass Details</h2>
              <span className="amx-details-id-badge">{gatePass.id}</span>
              <span className={`amx-gp-status-badge ${statusClass}`}>
                {gatePass.status}
              </span>
            </div>
            <p className="amx-consumables-subtitle">
              Requested on {gatePass.requestDate} by {gatePass.requesterName} ({gatePass.department})
            </p>
          </div>

          {/* State-Dependent Action Buttons per Spec */}
          <div className="amx-details-header-actions">
            {/* Pending State Actions: Approve, Reject */}
            {gatePass.status === 'Pending' && (
              <>
                <button
                  type="button"
                  className="amx-btn-reject"
                  onClick={() => handleOpenDecisionModal('Reject')}
                  aria-label="Reject Gate Pass"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    cancel
                  </span>
                  <span>Reject</span>
                </button>
                <button
                  type="button"
                  className="amx-btn-approve"
                  onClick={() => handleOpenDecisionModal('Approve')}
                  aria-label="Approve Gate Pass"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    check_circle
                  </span>
                  <span>Approve</span>
                </button>
              </>
            )}

            {/* Approved State Actions: Override, Gate Verification */}
            {gatePass.status === 'Approved' && (
              <>
                <button
                  type="button"
                  className="amx-btn-override"
                  onClick={() => handleOpenDecisionModal('Override')}
                  aria-label="Override"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    rule
                  </span>
                  <span>Override</span>
                </button>
                <button
                  type="button"
                  className="amx-btn-verify-gate"
                  onClick={() => onNavigate?.(`gate-pass/${encodeURIComponent(gatePass.id)}/verification`)}
                  aria-label="Gate Verification"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    verified_user
                  </span>
                  <span>Gate Verification</span>
                </button>
              </>
            )}

            {/* Active State Actions: Gate Verification */}
            {gatePass.status === 'Active' && (
              <button
                type="button"
                className="amx-btn-verify-gate"
                onClick={() => onNavigate?.(`gate-pass/${encodeURIComponent(gatePass.id)}/verification`)}
                aria-label="Gate Verification"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  verified_user
                </span>
                <span>Gate Verification</span>
              </button>
            )}

            {/* Escalated State Actions: Override, Gate Verification */}
            {gatePass.status === 'Escalated' && (
              <>
                <button
                  type="button"
                  className="amx-btn-override"
                  onClick={() => handleOpenDecisionModal('Override')}
                  aria-label="Override"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    rule
                  </span>
                  <span>Override</span>
                </button>
                <button
                  type="button"
                  className="amx-btn-verify-gate"
                  onClick={() => onNavigate?.(`gate-pass/${encodeURIComponent(gatePass.id)}/verification`)}
                  aria-label="Gate Verification"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    verified_user
                  </span>
                  <span>Gate Verification</span>
                </button>
              </>
            )}

            {/* Completed / Rejected: Verification Log */}
            {(gatePass.status === 'Completed' || gatePass.status === 'Rejected') && (
              <button
                type="button"
                className="amx-btn-secondary"
                onClick={() => onNavigate?.(`gate-pass/${encodeURIComponent(gatePass.id)}/verification`)}
                aria-label="Verification Log"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  history_toggle_off
                </span>
                <span>Verification Log</span>
              </button>
            )}
          </div>
        </div>

        {/* Escalation Status Banner (Show when applicable) */}
        {gatePass.escalation.isEscalated && (
          <div className="amx-escalation-banner" role="alert">
            <span className="material-symbols-outlined amx-escalation-banner-icon" aria-hidden="true">
              error
            </span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>
                Escalation Status: Active Gate Exception
              </div>
              <div style={{ fontSize: '13.5px', color: '#7f1d1d', marginBottom: '6px', lineHeight: 1.4 }}>
                <strong>Reason:</strong> {gatePass.escalation.reason}
              </div>
              <div style={{ fontSize: '13px', color: '#991b1b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span><strong>Timestamp:</strong> {gatePass.escalation.timestamp}</span>
                <span><strong>Action Required:</strong> {gatePass.escalation.actionRequired}</span>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Grid Layout */}
        <div className="amx-gp-details-grid">
          {/* Section 1: Gate Pass Information */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  info
                </span>
                Gate Pass Information
              </h3>
            </div>
            <div className="amx-panel-body">
              <div className="amx-kv-grid">
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Pass ID</span>
                  <span className="amx-kv-value amx-kv-mono">{gatePass.id}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Pass Type</span>
                  <span className="amx-kv-value">
                    <span className="amx-gp-type-badge">{gatePass.passType}</span>
                  </span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Request Date</span>
                  <span className="amx-kv-value amx-kv-mono">{gatePass.requestDate}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Current Status</span>
                  <span className="amx-kv-value">
                    <span className={`amx-gp-status-badge ${statusClass}`}>{gatePass.status}</span>
                  </span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Requester</span>
                  <span className="amx-kv-value">{gatePass.requesterName}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Department</span>
                  <span className="amx-kv-value">{gatePass.department}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Movement Information */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  swap_horiz
                </span>
                Movement Information
              </h3>
            </div>
            <div className="amx-panel-body">
              <div className="amx-kv-grid">
                <div className="amx-kv-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="amx-kv-label">Asset / Item</span>
                  <span className="amx-kv-value" style={{ fontSize: '15px' }}>{gatePass.assetOrItem}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Quantity</span>
                  <span className="amx-kv-value" style={{ fontWeight: 700 }}>{gatePass.quantity} Units</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Movement Date</span>
                  <span className="amx-kv-value amx-kv-mono">{gatePass.movementDate}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Current Location</span>
                  <span className="amx-kv-value">{gatePass.currentLocation}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Destination</span>
                  <span className="amx-kv-value" style={{ fontWeight: 600 }}>{gatePass.destination}</span>
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <span className="amx-kv-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Purpose / Justification
                </span>
                <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--amx-dash-border-light)', fontSize: '13.5px', lineHeight: 1.45, color: 'var(--amx-dash-text)' }}>
                  {gatePass.purpose}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Authorization & Control + Gate Activity Grid */}
        <div className="amx-gp-details-grid">
          {/* Authorization & Control */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  gavel
                </span>
                Authorization & Control
              </h3>
            </div>
            <div className="amx-panel-body">
              <div className="amx-kv-grid">
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Current Authorization State</span>
                  <span className="amx-kv-value" style={{ fontWeight: 600 }}>{gatePass.authorizationState}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Decision Status</span>
                  <span className="amx-kv-value">{gatePass.decisionStatus}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Decision Date</span>
                  <span className="amx-kv-value amx-kv-mono">{gatePass.decisionDate || '—'}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Decision By</span>
                  <span className="amx-kv-value">{gatePass.decisionBy || 'Pending Review'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gate Activity */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  sensor_door
                </span>
                Gate Activity
              </h3>
            </div>
            <div className="amx-panel-body">
              <div className="amx-gate-activity-box">
                {/* Exit Gate Activity */}
                <div className="amx-activity-card">
                  <div className="amx-activity-card-header">
                    <span className="amx-activity-card-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#2563eb' }} aria-hidden="true">
                        output
                      </span>
                      Exit Gate
                    </span>
                    <span className={`amx-gp-status-badge ${gatePass.gateActivity.exitStatus.toLowerCase()}`}>
                      {gatePass.gateActivity.exitStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--amx-dash-text-muted)' }}>
                    <div><strong>Gate:</strong> {gatePass.gateActivity.exitGate || '—'}</div>
                    <div><strong>Date/Time:</strong> {gatePass.gateActivity.exitTimestamp || 'Not recorded'}</div>
                    {gatePass.gateActivity.exitOfficer && <div><strong>Officer:</strong> {gatePass.gateActivity.exitOfficer}</div>}
                    {gatePass.gateActivity.exitNotes && <div><strong>Notes:</strong> {gatePass.gateActivity.exitNotes}</div>}
                  </div>
                </div>

                {/* Entry Gate Activity */}
                <div className="amx-activity-card">
                  <div className="amx-activity-card-header">
                    <span className="amx-activity-card-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#059669' }} aria-hidden="true">
                        input
                      </span>
                      Entry Gate
                    </span>
                    <span className={`amx-gp-status-badge ${gatePass.gateActivity.entryStatus.toLowerCase()}`}>
                      {gatePass.gateActivity.entryStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--amx-dash-text-muted)' }}>
                    <div><strong>Gate:</strong> {gatePass.gateActivity.entryGate || '—'}</div>
                    <div><strong>Date/Time:</strong> {gatePass.gateActivity.entryTimestamp || 'Not recorded'}</div>
                    {gatePass.gateActivity.entryOfficer && <div><strong>Officer:</strong> {gatePass.gateActivity.entryOfficer}</div>}
                    {gatePass.gateActivity.entryNotes && <div><strong>Notes:</strong> {gatePass.gateActivity.entryNotes}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Audit History & Log */}
        <div className="amx-panel-card">
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                history
              </span>
              Audit History & Log
            </h3>
          </div>
          <div className="amx-panel-body">
            <div className="amx-history-timeline">
              {gatePass.history.map((evt) => (
                <div key={evt.id} className="amx-timeline-item">
                  <div className="amx-timeline-dot">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                      {evt.action.includes('Approved') || evt.action.includes('Approval')
                        ? 'check'
                        : evt.action.includes('Reject')
                        ? 'close'
                        : evt.action.includes('Override')
                        ? 'rule'
                        : evt.action.includes('Escalation')
                        ? 'warning'
                        : evt.action.includes('Exit')
                        ? 'output'
                        : evt.action.includes('Entry')
                        ? 'input'
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
      {/* APPROVAL / DECISION MODAL (Review Gate Pass) */}
      {/* ================================================================= */}
      {isDecisionModalOpen && (
        <div className="amx-modal-backdrop" onClick={() => setIsDecisionModalOpen(false)}>
          <div
            className="amx-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="modal-decision-title"
          >
            <div className="amx-modal-header">
              <h3 className="amx-modal-title" id="modal-decision-title">
                Review Gate Pass — {gatePass.id}
              </h3>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setIsDecisionModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmDecision}>
              <div className="amx-modal-body">
                {/* Current State -> Target State */}
                <div className="amx-modal-verify-box">
                  <span className="amx-kv-label">State Transition</span>
                  <div className="amx-state-transition-pill">
                    <span className={`amx-gp-status-badge ${statusClass}`}>
                      {gatePass.status}
                    </span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--amx-dash-text-muted)' }} aria-hidden="true">
                      arrow_forward
                    </span>
                    <span
                      className={`amx-gp-status-badge ${
                        modalMode === 'Approve' || modalMode === 'Override'
                          ? 'approved'
                          : 'rejected'
                      }`}
                    >
                      {modalMode === 'Approve' || modalMode === 'Override'
                        ? 'Approved'
                        : 'Rejected'}
                    </span>
                  </div>
                </div>

                {/* Gate Pass Verification Info */}
                <div className="amx-modal-verify-box">
                  <span className="amx-kv-label">Gate Pass Summary</span>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--amx-dash-text)' }}>
                    {gatePass.assetOrItem} ({gatePass.quantity} Units)
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--amx-dash-text-muted)', flexWrap: 'wrap' }}>
                    <span>Pass Type: <strong>{gatePass.passType}</strong></span>
                    <span>Requester: <strong>{gatePass.requesterName}</strong></span>
                    <span>Destination: <strong>{gatePass.destination}</strong></span>
                  </div>
                </div>

                {/* Operational Remarks / Justification */}
                <div className="amx-form-group">
                  <label className="amx-form-label">Operational Remarks / Justification</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    placeholder="e.g. Administrative clearance verified against transport manifest"
                    value={operationalRemarks}
                    onChange={(e) => setOperationalRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="amx-modal-footer">
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => setIsDecisionModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={
                    modalMode === 'Approve'
                      ? 'amx-btn-approve'
                      : modalMode === 'Reject'
                      ? 'amx-btn-reject'
                      : 'amx-btn-override'
                  }
                >
                  {modalMode === 'Approve'
                    ? 'Confirm Approval'
                    : modalMode === 'Reject'
                    ? 'Confirm Rejection'
                    : 'Confirm Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default GatePassDetailsPage;
