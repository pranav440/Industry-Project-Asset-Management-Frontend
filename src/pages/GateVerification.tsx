import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getStoredGatePasses,
  saveStoredGatePasses,
  type GatePassItemData,
} from '../data/gatePassData';
import './GateVerification.css';

interface GateVerificationPageProps {
  passId: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const GateVerificationPage: React.FC<GateVerificationPageProps> = ({
  passId,
  onNavigate,
  onSignOut,
}) => {
  const [gatePass, setGatePass] = useState<GatePassItemData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Inputs for Verification
  const [exitGateInput, setExitGateInput] = useState('North Gate - Commercial Bay 1');
  const [exitNotesInput, setExitNotesInput] = useState('');
  const [entryGateInput, setEntryGateInput] = useState('Destination Receiving Gate');
  const [entryNotesInput, setEntryNotesInput] = useState('');
  const [escalateReasonInput, setEscalateReasonInput] = useState('');

  useEffect(() => {
    const list = getStoredGatePasses();
    const found = list.find((p) => p.id === passId);
    if (found) {
      setGatePass(found);
      if (found.gateActivity.exitGate) setExitGateInput(found.gateActivity.exitGate);
      if (found.gateActivity.entryGate) setEntryGateInput(found.gateActivity.entryGate);
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
        <div style={{ padding: '32px', textAlign: 'center' }}>Loading gate verification...</div>
      </DashboardLayout>
    );
  }

  const nowString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // 1. Verify Exit
  const handleVerifyExit = (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = nowString();

    const newHistoryEntry = {
      id: `EVT-GP-${Date.now().toString().slice(-4)}`,
      timestamp,
      action: 'Exit verification',
      performedBy: 'Guard Station A',
      note: exitNotesInput.trim() || `Outbound dispatch recorded at ${exitGateInput}`,
      statusSnapshot: 'Active' as const,
    };

    const updatedPass: GatePassItemData = {
      ...gatePass,
      status: 'Active',
      authorizationState: 'Active in Transit',
      gateActivity: {
        ...gatePass.gateActivity,
        exitStatus: 'Verified',
        exitTimestamp: timestamp,
        exitGate: exitGateInput,
        exitOfficer: 'Guard Station A',
        exitNotes: exitNotesInput.trim() || undefined,
      },
      history: [newHistoryEntry, ...gatePass.history],
    };

    const all = getStoredGatePasses();
    const idx = all.findIndex((p) => p.id === gatePass.id);
    if (idx >= 0) all[idx] = updatedPass;
    saveStoredGatePasses(all);
    setGatePass(updatedPass);
    showToast(`Exit verification recorded for ${gatePass.id}. Pass is now Active.`);
  };

  // 2. Verify Entry
  const handleVerifyEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = nowString();

    const newHistoryEntry = {
      id: `EVT-GP-${Date.now().toString().slice(-4)}`,
      timestamp,
      action: 'Entry verification',
      performedBy: 'Host Receiving Desk',
      note: entryNotesInput.trim() || `Inbound arrival recorded at ${entryGateInput}`,
      statusSnapshot: 'Completed' as const,
    };

    const updatedPass: GatePassItemData = {
      ...gatePass,
      status: 'Completed',
      authorizationState: 'Completed',
      gateActivity: {
        ...gatePass.gateActivity,
        entryStatus: 'Verified',
        entryTimestamp: timestamp,
        entryGate: entryGateInput,
        entryOfficer: 'Host Receiving Desk',
        entryNotes: entryNotesInput.trim() || undefined,
      },
      history: [newHistoryEntry, ...gatePass.history],
    };

    const all = getStoredGatePasses();
    const idx = all.findIndex((p) => p.id === gatePass.id);
    if (idx >= 0) all[idx] = updatedPass;
    saveStoredGatePasses(all);
    setGatePass(updatedPass);
    showToast(`Entry verification recorded for ${gatePass.id}. Movement Completed.`);
  };

  // 3. Escalate Pass
  const handleEscalatePass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateReasonInput.trim()) {
      showToast('Please provide an operational reason for escalation.');
      return;
    }
    const timestamp = nowString();

    const newHistoryEntry = {
      id: `EVT-GP-${Date.now().toString().slice(-4)}`,
      timestamp,
      action: 'Escalation',
      performedBy: 'Guard Station A',
      note: escalateReasonInput.trim(),
      statusSnapshot: 'Escalated' as const,
    };

    const updatedPass: GatePassItemData = {
      ...gatePass,
      status: 'Escalated',
      authorizationState: 'Escalated — Gate Exception',
      escalation: {
        isEscalated: true,
        reason: escalateReasonInput.trim(),
        timestamp,
        actionRequired: 'Administrative gate exception review required.',
        escalatedBy: 'Guard Station A',
      },
      history: [newHistoryEntry, ...gatePass.history],
    };

    const all = getStoredGatePasses();
    const idx = all.findIndex((p) => p.id === gatePass.id);
    if (idx >= 0) all[idx] = updatedPass;
    saveStoredGatePasses(all);
    setGatePass(updatedPass);
    setEscalateReasonInput('');
    showToast(`Gate Pass ${gatePass.id} has been flagged for Escalation.`);
  };

  return (
    <DashboardLayout
      currentNav="Gate Pass"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Gate verification checkpoint notification.')
      }
      onHelpClick={() => showToast('AssetMX Gate Verification Manual.')}
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

      <div className="amx-verification-container">
        {/* Breadcrumb Navigation */}
        <nav className="amx-breadcrumb-nav" aria-label="Breadcrumb">
          <button
            type="button"
            className="amx-back-btn"
            onClick={() => onNavigate?.(`gate-pass/${encodeURIComponent(gatePass.id)}`)}
            aria-label="Back to Gate Pass Details"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
              arrow_back
            </span>
            <span>Back to Pass Details</span>
          </button>
          <span className="amx-breadcrumb-sep">/</span>
          <span className="amx-breadcrumb-curr">Verification</span>
        </nav>

        {/* Page Header */}
        <div className="amx-verification-header-row">
          <div className="amx-details-title-group">
            <h2 className="amx-details-title">Gate Verification</h2>
            <p className="amx-consumables-subtitle">
              Verify gate activity and record movement events.
            </p>
          </div>
          <span className={`amx-gp-status-badge ${gatePass.status.toLowerCase()}`}>
            {gatePass.status}
          </span>
        </div>

        {/* Gate Pass Information Overview Panel */}
        <div className="amx-panel-card" style={{ marginBottom: '24px' }}>
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                confirmation_number
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
                <span className="amx-kv-label">Requester</span>
                <span className="amx-kv-value">{gatePass.requesterName}</span>
              </div>
              <div className="amx-kv-item">
                <span className="amx-kv-label">Asset / Item</span>
                <span className="amx-kv-value" style={{ fontWeight: 600 }}>{gatePass.assetOrItem}</span>
              </div>
              <div className="amx-kv-item">
                <span className="amx-kv-label">Destination</span>
                <span className="amx-kv-value">{gatePass.destination}</span>
              </div>
              <div className="amx-kv-item">
                <span className="amx-kv-label">Current Status</span>
                <span className="amx-kv-value">
                  <span className={`amx-gp-status-badge ${gatePass.status.toLowerCase()}`}>
                    {gatePass.status}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Exit & Entry Verification Actions */}
        <div className="amx-verification-grid">
          {/* Section: Exit Verification */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#2563eb' }} aria-hidden="true">
                  output
                </span>
                Exit Verification
              </h3>
              <span className={`amx-gp-status-badge ${gatePass.gateActivity.exitStatus.toLowerCase()}`}>
                {gatePass.gateActivity.exitStatus}
              </span>
            </div>
            <div className="amx-panel-body">
              {gatePass.gateActivity.exitStatus === 'Verified' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: 'var(--amx-dash-text)' }}>
                  <div><strong>Exit Status:</strong> Verified</div>
                  <div><strong>Date / Time:</strong> {gatePass.gateActivity.exitTimestamp}</div>
                  <div><strong>Exit Gate / Location:</strong> {gatePass.gateActivity.exitGate}</div>
                  {gatePass.gateActivity.exitNotes && <div><strong>Operational Notes:</strong> {gatePass.gateActivity.exitNotes}</div>}
                  <div style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                      check_circle
                    </span>
                    Exit verification recorded.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerifyExit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="amx-form-group">
                    <label className="amx-form-label">Exit Gate / Location *</label>
                    <input
                      type="text"
                      className="amx-form-input"
                      value={exitGateInput}
                      onChange={(e) => setExitGateInput(e.target.value)}
                      required
                    />
                  </div>
                  <div className="amx-form-group">
                    <label className="amx-form-label">Operational Notes</label>
                    <input
                      type="text"
                      className="amx-form-input"
                      placeholder="e.g. Physical items verified against dispatch manifest"
                      value={exitNotesInput}
                      onChange={(e) => setExitNotesInput(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="amx-btn-verify-gate" style={{ alignSelf: 'flex-start' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                      output
                    </span>
                    <span>Verify Exit</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Section: Entry Verification */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#059669' }} aria-hidden="true">
                  input
                </span>
                Entry Verification
              </h3>
              <span className={`amx-gp-status-badge ${gatePass.gateActivity.entryStatus.toLowerCase()}`}>
                {gatePass.gateActivity.entryStatus}
              </span>
            </div>
            <div className="amx-panel-body">
              {gatePass.gateActivity.entryStatus === 'Verified' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: 'var(--amx-dash-text)' }}>
                  <div><strong>Entry Status:</strong> Verified</div>
                  <div><strong>Date / Time:</strong> {gatePass.gateActivity.entryTimestamp}</div>
                  <div><strong>Entry Gate / Location:</strong> {gatePass.gateActivity.entryGate}</div>
                  {gatePass.gateActivity.entryNotes && <div><strong>Operational Notes:</strong> {gatePass.gateActivity.entryNotes}</div>}
                  <div style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                      check_circle
                    </span>
                    Entry verification recorded.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerifyEntry} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="amx-form-group">
                    <label className="amx-form-label">Entry Gate / Location *</label>
                    <input
                      type="text"
                      className="amx-form-input"
                      value={entryGateInput}
                      onChange={(e) => setEntryGateInput(e.target.value)}
                      required
                    />
                  </div>
                  <div className="amx-form-group">
                    <label className="amx-form-label">Operational Notes</label>
                    <input
                      type="text"
                      className="amx-form-input"
                      placeholder="e.g. Inbound shipment verified by receiving desk"
                      value={entryNotesInput}
                      onChange={(e) => setEntryNotesInput(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="amx-btn-approve" style={{ alignSelf: 'flex-start' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                      input
                    </span>
                    <span>Verify Entry</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Section: Escalation Action */}
        <div className="amx-panel-card" style={{ marginBottom: '24px' }}>
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#dc2626' }} aria-hidden="true">
                warning
              </span>
              Escalation & Exception Handling
            </h3>
          </div>
          <div className="amx-panel-body">
            {gatePass.escalation.isEscalated ? (
              <div className="amx-escalation-banner" style={{ margin: 0 }}>
                <span className="material-symbols-outlined amx-escalation-banner-icon" aria-hidden="true">
                  error
                </span>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#b91c1c' }}>
                    Pass currently Escalated
                  </div>
                  <div style={{ fontSize: '13.5px', color: '#7f1d1d', marginTop: '4px' }}>
                    {gatePass.escalation.reason}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#991b1b', marginTop: '4px' }}>
                    Flagged at {gatePass.escalation.timestamp} by {gatePass.escalation.escalatedBy}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEscalatePass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--amx-dash-text-muted)' }}>
                  Flag an operational exception if physical discrepancy is detected at the gate.
                </p>
                <div className="amx-form-group">
                  <label className="amx-form-label">Reason for Escalation *</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    placeholder="e.g. Packaging discrepancy or item verification mismatch"
                    value={escalateReasonInput}
                    onChange={(e) => setEscalateReasonInput(e.target.value)}
                  />
                </div>
                <button type="submit" className="amx-btn-escalate" style={{ alignSelf: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    warning
                  </span>
                  <span>Escalate Pass</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Section: Audit History */}
        <div className="amx-panel-card">
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                history
              </span>
              Audit History
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
    </DashboardLayout>
  );
};

export default GateVerificationPage;
