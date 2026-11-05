import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import { type GatePassItemData } from '../data/gatePassData';
import {
  escalateGatePass,
  getGatePass,
  mapGatePassApiRecord,
  validateGatePassQR,
  verifyEntryGatePass,
  verifyExitGatePass,
  GatePassApiError,
  type GatePassQRValidationResult,
} from '../api/gatePassApi';
import './GatePassDetails.css';
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
  const currentUser = getUser();
  const isGuard = currentUser?.role === 'guard';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isAuthorized = isGuard || isAdmin;

  const [gatePass, setGatePass] = useState<GatePassItemData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [exitGateInput, setExitGateInput] = useState('North Gate - Commercial Bay 1');
  const [exitNotesInput, setExitNotesInput] = useState('');
  const [entryGateInput, setEntryGateInput] = useState('Destination Receiving Gate');
  const [entryNotesInput, setEntryNotesInput] = useState('');
  const [escalateReasonInput, setEscalateReasonInput] = useState('');

    const [isSubmittingExit, setIsSubmittingExit] = useState<boolean>(false);
    const [isSubmittingEntry, setIsSubmittingEntry] = useState<boolean>(false);
    const [isSubmittingEscalate, setIsSubmittingEscalate] = useState<boolean>(false);

  const [qrInput, setQrInput] = useState('');
  const [isValidatingQR, setIsValidatingQR] = useState(false);
  const [qrValidation, setQrValidation] = useState<GatePassQRValidationResult | null>(null);
  const [qrValidationTimestamp, setQrValidationTimestamp] = useState<string | null>(null);

  // Input method tracking: 'camera' | 'hardware' | 'manual'
  const [qrInputMethod, setQrInputMethod] = useState<'camera' | 'hardware' | 'manual' | null>(null);

  // Camera scanner state
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraStatus, setCameraStatus] = useState<
    'idle' | 'initializing' | 'waiting' | 'detected' | 'validating' | 'success' | 'failed'
  >('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const hasDetectedRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);

  const stopCameraScanner = useCallback(async () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner) return;
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // ignore
    }

    try {
      scanner.clear();
    } catch {
      // ignore
    }

    html5QrCodeRef.current = null;
    isStoppingRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [passId, stopCameraScanner]);

  const startCameraScanner = useCallback(async (cameraIdToUse?: string) => {
    setCameraError(null);
    setCameraStatus('initializing');
    hasDetectedRef.current = false;

    if (
      typeof window === 'undefined' ||
      !navigator?.mediaDevices ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      setCameraStatus('failed');
      setCameraError(
        'Camera scanning requires a secure connection (HTTPS or localhost) and browser media permissions.'
      );
      return;
    }

    await stopCameraScanner();

    const elementId = 'amx-gate-camera-preview';
    const previewEl = document.getElementById(elementId);
    if (!previewEl) {
      setTimeout(() => startCameraScanner(cameraIdToUse), 60);
      return;
    }

    try {
      let devices: Array<{ id: string; label: string }> = [];
      try {
        const enumerated = await Html5Qrcode.getCameras();
        if (enumerated && enumerated.length > 0) {
          devices = enumerated.map((d, i) => ({ id: d.id, label: d.label || `Camera ${i + 1}` }));
          setAvailableCameras(devices);
        }
      } catch (err) {
        console.warn('Unable to enumerate cameras:', err);
      }

      const scanner = new Html5Qrcode(elementId, { verbose: false });
      html5QrCodeRef.current = scanner;

      const cameraConfig = cameraIdToUse || (devices.length > 0 ? devices[0].id : { facingMode: 'environment' });

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText: string) => {
          if (hasDetectedRef.current) return;
          hasDetectedRef.current = true;

          setCameraStatus('detected');
          const cleanQr = decodedText.trim();
          setQrInput(cleanQr);
          setQrInputMethod('camera');

          await stopCameraScanner();

          setCameraStatus('validating');
          setIsValidatingQR(true);
          try {
            const targetAction =
              gatePass?.status === 'Approved'
                ? 'exit'
                : gatePass?.status === 'Active'
                  ? 'entry'
                  : 'inspect';

            const result = await validateGatePassQR({
              qr_code: cleanQr,
              expected_pass_id: passId,
              target_action: targetAction,
            });

            setQrValidation(result);
            setQrValidationTimestamp(
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );

            if (result.valid && result.pass_id === passId && result.action_eligible) {
              setCameraStatus('success');
              showToast(`QR Authenticated: Bound to ${result.pass_id} (${result.resolved_format}).`);
              setTimeout(() => {
                setIsCameraOpen(false);
                setCameraStatus('idle');
              }, 1200);
            } else if (result.valid && result.pass_id !== passId) {
              setCameraStatus('failed');
              setCameraError(`Mismatched QR code: Scanned code belongs to pass "${result.pass_id}", but currently viewing "${passId}".`);
              showToast(`QR Mismatch: Scanned pass ${result.pass_id} does not match ${passId}.`);
            } else if (result.valid && !result.action_eligible) {
              setCameraStatus('failed');
              setCameraError(`Action Ineligible: ${result.eligibility_reason}`);
              showToast(`QR matched, but ineligible: ${result.eligibility_reason}`);
            } else {
              setCameraStatus('failed');
              setCameraError(`Validation Failed: ${result.message}`);
              showToast(`QR Validation Failed: ${result.message}`);
            }
          } catch (error: unknown) {
            setCameraStatus('failed');
            const err = error as GatePassApiError;
            const msg = err.message || 'QR validation request failed.';
            setCameraError(msg);
            showToast(msg);
          } finally {
            setIsValidatingQR(false);
          }
        },
        (_errorMessage: string) => {
          // ignore per-frame failures while waiting
        }
      );

      setCameraStatus('waiting');
    } catch (err: unknown) {
      await stopCameraScanner();
      setCameraStatus('failed');
      const errName = (err as Error)?.name || '';
      const errMsg = (err as Error)?.message || String(err);

      if (errName === 'NotAllowedError' || errMsg.includes('Permission') || errMsg.includes('NotAllowed')) {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (errName === 'NotFoundError' || errMsg.includes('NotFound') || errMsg.includes('no camera')) {
        setCameraError('No camera device found on this system. Connect a camera or use hardware scanner / manual entry.');
      } else if (errName === 'NotReadableError' || errMsg.includes('NotReadable') || errMsg.includes('in use')) {
        setCameraError('Camera is currently unavailable or in use by another application.');
      } else {
        setCameraError(`Unable to start camera: ${errMsg}`);
      }
    }
  }, [passId, gatePass?.status, stopCameraScanner]);

  useEffect(() => {
    if (isCameraOpen && cameraStatus === 'initializing') {
      startCameraScanner(selectedCameraId || undefined);
    }
  }, [isCameraOpen, cameraStatus, selectedCameraId, startCameraScanner]);

  const handleToggleCamera = async () => {
    if (isCameraOpen) {
      await stopCameraScanner();
      setIsCameraOpen(false);
      setCameraStatus('idle');
      setCameraError(null);
    } else {
      setIsCameraOpen(true);
      setCameraStatus('initializing');
      setCameraError(null);
    }
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    if (isCameraOpen) {
      await startCameraScanner(newId || undefined);
    }
  };

  const handleRetryCamera = () => {
    startCameraScanner(selectedCameraId || undefined);
  };

  const handleInputChange = (val: string) => {
    setQrInput(val);
    setQrInputMethod((prev) => (prev === 'hardware' ? 'hardware' : 'manual'));
    if (qrValidation) setQrValidation(null);
  };

  const handleSetHardwareMode = () => {
    setQrInputMethod('hardware');
    showToast('Hardware Scanner Mode active: Ready for USB / Bluetooth barcode reader input.');
    const el = document.getElementById('amx-gate-qr-input');
    if (el) el.focus();
  };

  const handleSetManualMode = () => {
    setQrInputMethod('manual');
    const el = document.getElementById('amx-gate-qr-input');
    if (el) el.focus();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const fetchPass = useCallback(async () => {
    if (!passId) {
      setLoadError('No gate pass ID specified.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await getGatePass(passId);
      const mapped = mapGatePassApiRecord(data);
      setGatePass(mapped);
      if (mapped.gateActivity.exitGate) setExitGateInput(mapped.gateActivity.exitGate);
      if (mapped.gateActivity.entryGate) setEntryGateInput(mapped.gateActivity.entryGate);
    } catch (error: unknown) {
      const status = (error as GatePassApiError).status;
      const msg =
        status === 404
          ? `Gate pass "${passId}" was not found.`
          : status === 401
            ? 'Your session has expired. Please sign in again.'
            : status === 403
              ? 'You are not authorized to view this gate pass.'
              : error instanceof Error
                ? error.message
                : 'Unable to load gate verification.';
      setLoadError(msg);
      showToast(msg);
    } finally {
      setIsLoading(false);
    }
  }, [passId]);

  useEffect(() => {
    fetchPass();
  }, [fetchPass]);

  const handleNav = (subRoute: string) => {
    if (isGuard) {
      if (subRoute === 'gate-pass' || subRoute === 'gate pass' || subRoute === 'dashboard') {
        onNavigate?.('gate-pass');
      } else if (subRoute.startsWith('gate-pass/')) {
        onNavigate?.(subRoute);
      } else if (subRoute === 'signout' || subRoute === 'login') {
        onSignOut?.();
      } else {
        onNavigate?.('gate-pass');
      }
      return;
    }
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

  const handleValidateQR = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = qrInput.trim();
    if (!trimmed) {
      showToast('Please enter or scan a QR code payload to validate.');
      return;
    }

    setIsValidatingQR(true);
    try {
      const targetAction =
        gatePass?.status === 'Approved'
          ? 'exit'
          : gatePass?.status === 'Active'
            ? 'entry'
            : 'inspect';

      const result = await validateGatePassQR({
        qr_code: trimmed,
        expected_pass_id: passId,
        target_action: targetAction,
      });

      setQrValidation(result);
      setQrValidationTimestamp(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );

      if (result.valid && result.action_eligible) {
        showToast(`QR Authenticated: Bound to ${result.pass_id} (${result.resolved_format}).`);
      } else if (result.valid && !result.action_eligible) {
        showToast(`QR matched, but ineligible for current action: ${result.eligibility_reason}`);
      } else {
        showToast(`QR Validation Failed: ${result.message}`);
      }
    } catch (error: unknown) {
      const err = error as GatePassApiError;
      showToast(err.message || 'QR validation request failed.');
    } finally {
      setIsValidatingQR(false);
    }
  };

  const handleVerifyExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingExit) return;

    if (!exitGateInput.trim()) {
      showToast('Exit gate location is required.');
      return;
    }

    if (gatePass?.status !== 'Approved') {
      showToast(`Cannot record exit: Gate pass status is "${gatePass?.status || 'Unknown'}", but "Approved" is required.`);
      return;
    }

    if (!qrValidation || !qrValidation.valid || qrValidation.pass_id !== passId) {
      showToast('Mandatory QR validation required under SRS QR-03. Please scan and validate the pass QR code before completing verification.');
      return;
    }

    setIsSubmittingExit(true);
    try {
      const updated = await verifyExitGatePass(passId, {
        exit_gate: exitGateInput.trim(),
        exit_notes: exitNotesInput.trim() || undefined,
        qr_code: qrInput.trim(),
      });
      const mapped = mapGatePassApiRecord(updated);
      setGatePass(mapped);
      showToast(`Exit verification successfully recorded for ${passId}. Pass is now Active in Transit.`);
    } catch (error: unknown) {
      const status = (error as GatePassApiError).status;
      showToast(
        status === 409
          ? 'This gate pass cannot be exited in its current state (must be Approved).'
          : status === 422
            ? 'Exit gate details are invalid or missing.'
            : status === 403
              ? 'You do not have permission to record exit verification.'
              : error instanceof Error
                ? error.message
                : 'Unable to record exit verification.'
      );
    } finally {
      setIsSubmittingExit(false);
    }
  };

  const handleVerifyEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEntry) return;

    if (gatePass?.passType === 'Non-Returnable') {
      showToast('Non-returnable gate passes cannot undergo entry verification.');
      return;
    }

    if (gatePass?.status !== 'Active') {
      showToast(`Cannot record entry: Gate pass status is "${gatePass?.status || 'Unknown'}", but "Active" is required.`);
      return;
    }

    if (!entryGateInput.trim()) {
      showToast('Entry gate location is required.');
      return;
    }

    if (!qrValidation || !qrValidation.valid || qrValidation.pass_id !== passId) {
      showToast('Mandatory QR validation required under SRS QR-03. Please scan and validate the pass QR code before completing verification.');
      return;
    }

    setIsSubmittingEntry(true);
    try {
      const updated = await verifyEntryGatePass(passId, {
        entry_gate: entryGateInput.trim(),
        entry_notes: entryNotesInput.trim() || undefined,
        qr_code: qrInput.trim(),
      });
      const mapped = mapGatePassApiRecord(updated);
      setGatePass(mapped);
      showToast(`Entry verification successfully recorded for ${passId}. Pass is now Completed.`);
    } catch (error: unknown) {
      const status = (error as GatePassApiError).status;
      showToast(
        status === 409
          ? 'This gate pass cannot undergo entry verification (must be Active and returnable).'
          : status === 422
            ? 'Entry gate details are invalid or missing.'
            : status === 403
              ? 'You do not have permission to record entry verification.'
              : error instanceof Error
                ? error.message
                : 'Unable to record entry verification.'
      );
    } finally {
      setIsSubmittingEntry(false);
    }
  };

  const handleEscalatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEscalate) return;

    if (!escalateReasonInput.trim()) {
      showToast('Please provide an operational reason for escalation.');
      return;
    }

    if (gatePass?.status !== 'Pending' && gatePass?.status !== 'Approved') {
      showToast(`Cannot escalate pass: Escalation is only valid in Pending or Approved status (currently: ${gatePass?.status}).`);
      return;
    }

    setIsSubmittingEscalate(true);
    try {
      const updated = await escalateGatePass(passId, {
        reason: escalateReasonInput.trim(),
        action_required: 'Administrative gate exception review required.',
      });
      const mapped = mapGatePassApiRecord(updated);
      setGatePass(mapped);
      setEscalateReasonInput('');
      showToast(`Gate Pass ${passId} has been successfully escalated.`);
    } catch (error: unknown) {
      const status = (error as GatePassApiError).status;
      showToast(
        status === 409
          ? 'This gate pass cannot be escalated in its current state.'
          : status === 422
            ? 'Escalation details are invalid.'
            : status === 403
              ? 'You do not have permission to escalate this gate pass.'
              : error instanceof Error
                ? error.message
                : 'Unable to escalate the gate pass.'
      );
    } finally {
      setIsSubmittingEscalate(false);
    }
  };

  const roleSubtitle =
    currentUser?.role === 'guard'
      ? 'Security Officer (Guard)'
      : currentUser?.role === 'host'
        ? 'Host Security Officer'
        : undefined;

  // Unauthenticated or Unauthorized role boundary
  if (!isAuthorized) {
    return (
      <DashboardLayout
        currentNav="Gate Pass"
        role={currentUser?.role}
        userName={currentUser?.full_name}
        userRoleSubtitle={roleSubtitle}
        onNavigate={handleNav}
        onSignOut={onSignOut}
      >
        <div className="amx-verification-container">
          <div className="amx-panel-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#dc2626' }}>
              gpp_bad
            </span>
            <h3 style={{ margin: '14px 0 8px', fontSize: '18px', color: 'var(--amx-dash-text)' }}>
              Access Restricted
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--amx-dash-text-muted)' }}>
              Gate pass verification is restricted to Security Officers and Administrators.
            </p>
            <button
              type="button"
              className="amx-btn-verify-gate"
              onClick={() => handleNav('dashboard')}
            >
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Loading state
  if (isLoading && !gatePass) {
    return (
      <DashboardLayout
        currentNav="Gate Pass"
        role={currentUser?.role}
        userName={currentUser?.full_name}
        userRoleSubtitle={roleSubtitle}
        onNavigate={handleNav}
        onSignOut={onSignOut}
      >
        <div className="amx-verification-container">
          <div className="amx-panel-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <span
              className="material-symbols-outlined amx-spin"
              style={{ fontSize: '32px', color: 'var(--amx-dash-primary)' }}
            >
              progress_activity
            </span>
            <p style={{ marginTop: '14px', fontSize: '14.5px', color: 'var(--amx-dash-text)' }}>
              Loading gate verification details for {passId}...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Initial load error state (404, network error, etc.)
  if (loadError && !gatePass) {
    return (
      <DashboardLayout
        currentNav="Gate Pass"
        role={currentUser?.role}
        userName={currentUser?.full_name}
        userRoleSubtitle={roleSubtitle}
        onNavigate={handleNav}
        onSignOut={onSignOut}
      >
        <div className="amx-verification-container">
          <nav className="amx-breadcrumb-nav" aria-label="Breadcrumb">
            <button
              type="button"
              className="amx-back-btn"
              onClick={() => handleNav('gate-pass')}
              aria-label="Back to Gate Passes"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                arrow_back
              </span>
              <span>Back to Gate Passes</span>
            </button>
          </nav>
          <div className="amx-panel-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#dc2626' }}>
              error
            </span>
            <h3 style={{ margin: '14px 0 8px', fontSize: '18px', color: 'var(--amx-dash-text)' }}>
              Unable to Load Gate Pass
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--amx-dash-text-muted)' }}>
              {loadError}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="amx-btn-verify-gate"
                onClick={fetchPass}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  refresh
                </span>
                <span>Retry Loading</span>
              </button>
              <button
                type="button"
                className="amx-btn-override"
                onClick={() => handleNav('gate-pass')}
              >
                <span>View All Gate Passes</span>
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!gatePass) {
    return null;
  }

  const isNonReturnable = gatePass.passType === 'Non-Returnable';
  const isApproved = gatePass.status === 'Approved';
  const isActive = gatePass.status === 'Active';
  const isExitVerified = gatePass.gateActivity.exitStatus === 'Verified';
  const isEntryVerified = gatePass.gateActivity.entryStatus === 'Verified';
  const canEscalate = gatePass.status === 'Pending' || gatePass.status === 'Approved';

  return (
    <DashboardLayout
      currentNav="Gate Pass"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      role={currentUser?.role}
      userName={currentUser?.full_name}
      userRoleSubtitle={roleSubtitle}
      onAddAsset={isAdmin ? () => onNavigate?.('assets/new') : undefined}
      onNotificationsClick={() =>
        showToast('1 Alert: Gate verification checkpoint notification.')
      }
      onHelpClick={() => showToast('AssetMX Gate Verification Manual.')}
      onProfileClick={() =>
        showToast(`Signed in as: ${currentUser?.full_name || (isGuard ? 'Security Guard' : 'Administrator')} (${currentUser?.email || ''}) — Role: ${currentUser?.role || 'guard'}`)
      }
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
              Verify physical gate activity and synchronize movement events with the central system.
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
                <span className="amx-kv-value" style={{ fontWeight: 600 }}>{gatePass.assetOrItem} (Qty: {gatePass.quantity})</span>
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

        {/* Section: Real-Time QR Validation (SRS QR-03) */}
        <div className="amx-panel-card" style={{ marginBottom: '24px' }}>
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-primary)' }}>
                qr_code_scanner
              </span>
              Mandatory QR Validation (SRS QR-03)
            </h3>
            {qrValidation ? (
              <span className={`amx-gp-status-badge ${qrValidation.valid && qrValidation.action_eligible ? 'active' : 'escalated'}`}>
                {qrValidation.valid && qrValidation.action_eligible ? 'QR Validated' : 'QR Ineligible / Invalid'}
              </span>
            ) : (
              <span className="amx-gp-status-badge pending">Awaiting QR Scan</span>
            )}
          </div>
          <div className="amx-panel-body">
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--amx-dash-text-muted)', lineHeight: '1.45' }}>
              Per SRS QR-03, gate movement events enforce real-time server-side QR validation. Scan the physical gate-pass tag or bound asset QR URN before confirming gate departure or return.
            </p>

            {/* Input Method Toolbar */}
            <div className="amx-qr-method-row">
              <div className="amx-qr-method-group">
                <button
                  type="button"
                  className={`amx-btn-camera-scan ${isCameraOpen ? 'active' : ''}`}
                  onClick={handleToggleCamera}
                  aria-label={isCameraOpen ? 'Close camera scanner' : 'Scan using Camera'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {isCameraOpen ? 'videocam_off' : 'photo_camera'}
                  </span>
                  <span>{isCameraOpen ? 'Close Camera' : 'Scan using Camera'}</span>
                </button>

                <button
                  type="button"
                  className={`amx-method-pill-btn ${qrInputMethod === 'hardware' ? 'active' : ''}`}
                  onClick={handleSetHardwareMode}
                  title="Enable hardware scanner input mode (USB or Bluetooth barcode scanner)"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    barcode_scanner
                  </span>
                  <span>Hardware Scanner</span>
                </button>

                <button
                  type="button"
                  className={`amx-method-pill-btn ${qrInputMethod === 'manual' ? 'active' : ''}`}
                  onClick={handleSetManualMode}
                  title="Enable manual keyboard text entry mode"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    keyboard
                  </span>
                  <span>Manual Entry</span>
                </button>
              </div>

              {availableCameras.length > 1 && isCameraOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label htmlFor="amxCameraSelect" style={{ fontSize: '12px', color: 'var(--amx-dash-text-muted)' }}>
                    Camera:
                  </label>
                  <select
                    id="amxCameraSelect"
                    className="amx-camera-device-select"
                    value={selectedCameraId}
                    onChange={handleCameraChange}
                    aria-label="Select Camera Device"
                  >
                    {availableCameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Camera Viewport & Status Panel */}
            {isCameraOpen && (
              <div className="amx-camera-scanner-panel">
                <div className="amx-camera-panel-header">
                  <div className="amx-camera-title-wrap">
                    <span className="material-symbols-outlined" style={{ color: '#38bdf8', fontSize: '18px' }}>
                      videocam
                    </span>
                    <span>Live Camera Viewfinder</span>
                  </div>
                  <button
                    type="button"
                    className="amx-method-pill-btn"
                    onClick={handleToggleCamera}
                    aria-label="Close viewfinder"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      close
                    </span>
                    <span>Close</span>
                  </button>
                </div>

                <div className="amx-camera-preview-box">
                  <div id="amx-gate-camera-preview" />
                  {cameraStatus === 'waiting' && (
                    <div className="amx-viewfinder-overlay">
                      <div className="amx-viewfinder-scanline" />
                    </div>
                  )}
                  {cameraStatus === 'initializing' && (
                    <div style={{ textAlign: 'center', color: '#38bdf8', padding: '20px' }}>
                      <span className="material-symbols-outlined amx-spin" style={{ fontSize: '32px' }}>
                        progress_activity
                      </span>
                      <p style={{ marginTop: '8px', fontSize: '13px' }}>Initializing camera preview...</p>
                    </div>
                  )}
                  {cameraStatus === 'failed' && (
                    <div style={{ textAlign: 'center', color: '#f87171', padding: '20px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
                        videocam_off
                      </span>
                      <p style={{ marginTop: '8px', fontSize: '13px' }}>Camera unavailable or failed.</p>
                    </div>
                  )}
                </div>

                {/* Status Bar */}
                <div className={`amx-camera-status-strip ${cameraStatus}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className={`material-symbols-outlined ${cameraStatus === 'initializing' || cameraStatus === 'validating' ? 'amx-spin' : ''}`}
                      style={{ fontSize: '18px' }}
                    >
                      {cameraStatus === 'initializing' && 'progress_activity'}
                      {cameraStatus === 'waiting' && 'crop_free'}
                      {cameraStatus === 'detected' && 'check_circle'}
                      {cameraStatus === 'validating' && 'sync'}
                      {cameraStatus === 'success' && 'verified'}
                      {cameraStatus === 'failed' && 'error'}
                    </span>
                    <span>
                      {cameraStatus === 'initializing' && 'Initializing camera...'}
                      {cameraStatus === 'waiting' && 'Waiting for QR code... Align pass tag within viewfinder.'}
                      {cameraStatus === 'detected' && 'QR code detected! Stopping camera...'}
                      {cameraStatus === 'validating' && 'Validating QR code with central registry...'}
                      {cameraStatus === 'success' && `Validation successful! Bound to pass ${passId}.`}
                      {cameraStatus === 'failed' && (cameraError || 'Validation failed.')}
                    </span>
                  </div>

                  {cameraStatus === 'failed' && (
                    <button
                      type="button"
                      className="amx-btn-camera-scan"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={handleRetryCamera}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        refresh
                      </span>
                      <span>Retry</span>
                    </button>
                  )}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--amx-dash-text-muted)', textAlign: 'center' }}>
                  Camera scanning requests standard browser media permissions. No frames or photographs are stored.
                </div>
              </div>
            )}

            {/* Existing Form Input */}
            <form onSubmit={handleValidateQR} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '260px' }}>
                <input
                  id="amx-gate-qr-input"
                  type="text"
                  className="amx-form-input"
                  placeholder="Scan barcode, scan with camera, or enter QR payload (e.g. assetmx:pass:GP-...)..."
                  value={qrInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  disabled={isValidatingQR}
                />
                {qrInputMethod && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {qrInputMethod === 'camera' && (
                      <span className="amx-source-pill camera">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          photo_camera
                        </span>
                        Source: Camera Scan
                      </span>
                    )}
                    {qrInputMethod === 'hardware' && (
                      <span className="amx-source-pill hardware">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          barcode_scanner
                        </span>
                        Source: Hardware Scanner (HID)
                      </span>
                    )}
                    {qrInputMethod === 'manual' && (
                      <span className="amx-source-pill manual">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          keyboard
                        </span>
                        Source: Manual Text Entry
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="amx-btn-verify-gate"
                disabled={isValidatingQR || !qrInput.trim()}
                style={{ opacity: isValidatingQR || !qrInput.trim() ? 0.6 : 1 }}
              >
                <span className={`material-symbols-outlined ${isValidatingQR ? 'amx-spin' : ''}`} style={{ fontSize: '18px' }}>
                  {isValidatingQR ? 'progress_activity' : 'qr_code_scanner'}
                </span>
                <span>{isValidatingQR ? 'Validating...' : 'Validate QR'}</span>
              </button>

              {qrValidation && (
                <button
                  type="button"
                  className="amx-btn-override"
                  onClick={() => {
                    setQrInput('');
                    setQrValidation(null);
                    setQrInputMethod(null);
                  }}
                >
                  <span>Clear</span>
                </button>
              )}
            </form>

            {/* Validation Result Telemetry */}
            {qrValidation && (
              <div style={{ marginTop: '16px' }}>
                {qrValidation.valid ? (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '8px',
                      backgroundColor: qrValidation.action_eligible ? 'rgba(5, 150, 105, 0.08)' : 'rgba(234, 179, 8, 0.08)',
                      border: `1px solid ${qrValidation.action_eligible ? 'rgba(5, 150, 105, 0.25)' : 'rgba(234, 179, 8, 0.25)'}`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '24px', color: qrValidation.action_eligible ? '#059669' : '#ca8a04' }}
                    >
                      {qrValidation.action_eligible ? 'verified' : 'info'}
                    </span>
                    <div style={{ flex: 1, fontSize: '13px' }}>
                      <div style={{ fontWeight: 700, color: qrValidation.action_eligible ? '#047857' : '#92400e', fontSize: '14px' }}>
                        {qrValidation.action_eligible ? 'QR Validated & Authenticated by Backend' : 'QR Valid — Action Ineligible'}
                      </div>
                      <div style={{ color: 'var(--amx-dash-text)', marginTop: '4px' }}>
                        Resolved Record: <strong>{qrValidation.pass_id}</strong> ({qrValidation.asset_or_item}) — Format: <code>{qrValidation.resolved_format}</code>
                      </div>
                      <div style={{ color: 'var(--amx-dash-text-muted)', marginTop: '2px', fontSize: '12px' }}>
                        {qrValidation.eligibility_reason} (Server verified at {qrValidationTimestamp})
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(220, 38, 38, 0.08)',
                      border: '1px solid rgba(220, 38, 38, 0.25)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#dc2626' }}>
                      gpp_bad
                    </span>
                    <div style={{ flex: 1, fontSize: '13px' }}>
                      <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: '14px' }}>
                        QR Validation Rejected
                      </div>
                      <div style={{ color: '#7f1d1d', marginTop: '4px' }}>
                        {qrValidation.message}
                      </div>
                      <div style={{ color: '#991b1b', marginTop: '2px', fontSize: '12px' }}>
                        Detail: {qrValidation.eligibility_reason || 'Record does not match expected criteria'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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
              <span className={`amx-gp-status-badge ${(gatePass.gateActivity.exitStatus || 'Pending').toLowerCase()}`}>
                {gatePass.gateActivity.exitStatus || 'Pending'}
              </span>
            </div>
            <div className="amx-panel-body">
                {
                  isExitVerified?(
                <div style = {{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: 'var(--amx-dash-text)' }} >
                  <div><strong>Exit Status:</strong> Verified</div>
                  <div><strong>Date / Time:</strong> {gatePass.gateActivity.exitTimestamp || 'Recorded'}</div>
                  <div><strong>Exit Gate / Location:</strong> {gatePass.gateActivity.exitGate || 'Not specified'}</div>
                  {gatePass.gateActivity.exitOfficer && <div><strong>Officer:</strong> {gatePass.gateActivity.exitOfficer}</div>}
              {gatePass.gateActivity.exitNotes && <div><strong>Operational Notes:</strong> {gatePass.gateActivity.exitNotes}</div>}
              <div style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  check_circle
                </span>
                Exit verification recorded.
              </div>
            </div>
            ) : isApproved ? (
            <form onSubmit={handleVerifyExit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="amx-form-group">
                <label className="amx-form-label">Exit Gate / Location *</label>
                <input
                  type="text"
                  className="amx-form-input"
                  value={exitGateInput}
                  onChange={(e) => setExitGateInput(e.target.value)}
                  placeholder="e.g. North Gate - Commercial Bay 1"
                  required
                  disabled={isSubmittingExit}
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
                  disabled={isSubmittingExit}
                />
              </div>
                  <button
                    type="submit"
                    className="amx-btn-verify-gate"
                    disabled={isSubmittingExit}
                    style={{ alignSelf: 'flex-start', opacity: isSubmittingExit ? 0.7 : 1 }}
                  >
                    <span
                      className={`material-symbols-outlined ${isSubmittingExit ? 'amx-spin' : ''}`}
                      style={{ fontSize: '18px' }}
                      aria-hidden="true"
                    >
                      {isSubmittingExit ? 'progress_activity' : 'output'}
                    </span>
                    <span>{isSubmittingExit ? 'Verifying Exit...' : 'Verify Exit'}</span>
                  </button>
                </form>
                ) : (
                <div className={`amx-verification-notice ${gatePass.status.toLowerCase()}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {gatePass.status === 'Pending' ? 'hourglass_empty' : gatePass.status === 'Escalated' ? 'warning' : 'cancel'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {gatePass.status === 'Pending'
                        ? 'Awaiting Administrative Approval'
                        : gatePass.status === 'Escalated'
                          ? 'Pass Currently Escalated'
                          : `Pass Status: ${gatePass.status}`}
                    </div>
                    <div style={{ fontSize: '12.5px', marginTop: '3px' }}>
                      {gatePass.status === 'Pending'
                        ? 'Exit verification can only be conducted after an Administrator has approved the gate pass request.'
                        : gatePass.status === 'Escalated'
                          ? 'An operational exception is active. Exit verification is blocked until cleared by an Administrator.'
                          : 'This gate pass is not in an Approved status and is ineligible for gate departure.'}
                    </div>
                  </div>
                </div>
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
                <span className={`amx-gp-status-badge ${isNonReturnable ? 'na' : (gatePass.gateActivity.entryStatus || 'Pending').toLowerCase()}`}>
                  {isNonReturnable ? 'N/A' : gatePass.gateActivity.entryStatus || 'Pending'}
                </span>
            </div>
            <div className="amx-panel-body">
                {
                  isNonReturnable?(
                <div className = "amx-verification-notice neutral" >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#64748b' }}>
                    block
                  </span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Non-Returnable Gate Pass</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--amx-dash-text-muted)', marginTop: '3px' }}>
                      This pass is designated for permanent outbound transfer or handover. Items will not return to the facility; therefore, inbound entry verification is not applicable.
                    </div>
                  </div>
                </div>
            ) : isEntryVerified ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: 'var(--amx-dash-text)' }}>
              <div><strong>Entry Status:</strong> Verified</div>
              <div><strong>Date / Time:</strong> {gatePass.gateActivity.entryTimestamp || 'Recorded'}</div>
              <div><strong>Entry Gate / Location:</strong> {gatePass.gateActivity.entryGate || 'Not specified'}</div>
              {gatePass.gateActivity.entryOfficer && <div><strong>Officer:</strong> {gatePass.gateActivity.entryOfficer}</div>}
              {gatePass.gateActivity.entryNotes && <div><strong>Operational Notes:</strong> {gatePass.gateActivity.entryNotes}</div>}
              <div style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  check_circle
                </span>
                Entry verification recorded.
              </div>
            </div>
            ) : isActive ? (
            <form onSubmit={handleVerifyEntry} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="amx-form-group">
                <label className="amx-form-label">Entry Gate / Location *</label>
                <input
                  type="text"
                  className="amx-form-input"
                  value={entryGateInput}
                  onChange={(e) => setEntryGateInput(e.target.value)}
                  placeholder="e.g. Destination Receiving Gate"
                  required
                  disabled={isSubmittingEntry}
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
                  disabled={isSubmittingEntry}
                />
              </div>
                  <button
                    type="submit"
                    className="amx-btn-approve"
                    disabled={isSubmittingEntry}
                    style={{ alignSelf: 'flex-start', opacity: isSubmittingEntry ? 0.7 : 1 }}
                  >
                    <span
                      className={`material-symbols-outlined ${isSubmittingEntry ? 'amx-spin' : ''}`}
                      style={{ fontSize: '18px' }}
                      aria-hidden="true"
                    >
                      {isSubmittingEntry ? 'progress_activity' : 'input'}
                    </span>
                    <span>{isSubmittingEntry ? 'Verifying Entry...' : 'Verify Entry'}</span>
                  </button>
                </form>
                ) : (
                <div className="amx-verification-notice info">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    info
                  </span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Inbound Verification Pending Exit</div>
                    <div style={{ fontSize: '12.5px', marginTop: '3px' }}>
                      Inbound return verification requires the gate pass to be <strong>Active in Transit</strong>. Once exit verification is performed, entry verification will become available upon return.
                    </div>
                  </div>
                </div>
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
                    Flagged at {gatePass.escalation.timestamp} by {gatePass.escalation.escalatedBy || 'Officer'}
                  </div>
                </div>
              </div>
            ): canEscalate ? (
            <form onSubmit={handleEscalatePass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--amx-dash-text-muted)' }}>
                Flag an operational exception if physical discrepancy or manifest mismatch is detected at the gate prior to departure.
              </p>
              <div className="amx-form-group">
                <label className="amx-form-label">Reason for Escalation *</label>
                <input
                  type="text"
                  className="amx-form-input"
                  placeholder="e.g. Packaging discrepancy or item serial mismatch"
                  value={escalateReasonInput}
                  onChange={(e) => setEscalateReasonInput(e.target.value)}
                  required
                  disabled={isSubmittingEscalate}
                />
              </div>
                  <button
                    type="submit"
                    className="amx-btn-escalate"
                    disabled={isSubmittingEscalate}
                    style={{ alignSelf: 'flex-start', opacity: isSubmittingEscalate ? 0.7 : 1 }}
                  >
                    <span
                      className={`material-symbols-outlined ${isSubmittingEscalate ? 'amx-spin' : ''}`}
                      style={{ fontSize: '18px' }}
                      aria-hidden="true"
                    >
                      {isSubmittingEscalate ? 'progress_activity' : 'warning'}
                    </span>
                    <span>{isSubmittingEscalate ? 'Escalating...' : 'Escalate Pass'}</span>
                  </button>
                </form>
                ) : (
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--amx-dash-text-muted)' }}>
                  Gate escalation is restricted to pre-departure checkpoints (Pending or Approved passes). For in-transit or completed items, contact Central Operations.
                </p>
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
                          {gatePass.history && gatePass.history.length > 0 ? (
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
                                            : evt.action.includes('Escalation') || evt.action.includes('Escalated')
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
                    ) : (
                    <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--amx-dash-text-muted)' }}>
                      No verification history recorded yet.
                    </p>
            )}
                  </div>
        </div>
            </div>
          </DashboardLayout>
          );
};

          export default GateVerificationPage;