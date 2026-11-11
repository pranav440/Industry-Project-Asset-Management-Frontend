import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import {
  getGatePass,
  validateGatePassQR,
  verifyExitGatePass,
  verifyEntryGatePass,
  escalateGatePass,
  mapGatePassApiRecord,
  GatePassApiError,
  type GatePassApiRecord,
  type GatePassQRValidationResult,
} from '../api/gatePassApi';
import {
  RECENT_CHECKPOINT_VERIFICATIONS_INITIAL,
  type ManifestAssetItem,
  type ChecklistItem,
  type RecentVerificationLogItem,
} from '../data/guardGateVerificationData';
import './GuardGateVerification.css';

interface GuardGateVerificationPageProps {
  passId?: string;
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

const INITIAL_CHECKLIST_CONFIG: ChecklistItem[] = [
  {
    id: 1,
    title: 'Server-Side Gate Pass QR Authenticated',
    description: 'Mandatory server-side QR validation under SRS QR-03',
    checked: false,
    locked: true,
  },
  {
    id: 2,
    title: 'Transporter ID & Driver Clearance Verified',
    description: 'Cross-check government photo ID against approved dispatch list',
    checked: false,
    locked: false,
  },
  {
    id: 3,
    title: 'Physical Serial Numbers & Tags Inspected',
    description: 'Guard physical inspection of hardware labels, serial tags, and custody handover',
    checked: false,
    locked: false,
  },
  {
    id: 4,
    title: 'Cargo Tamper Seals Intact',
    description: 'Inspect container security seal integrity',
    checked: false,
    locked: false,
  },
  {
    id: 5,
    title: 'Vehicle Registration & Plate Logged',
    description: 'Match vehicle registration plate at checkpoint bay',
    checked: false,
    locked: false,
  },
  {
    id: 6,
    title: 'Safety & Hazardous Materials Check',
    description: 'Inspect lithium/battery compliance and safety clearance',
    checked: false,
    locked: false,
  },
];

export const GuardGateVerificationPage: React.FC<GuardGateVerificationPageProps> = ({
  passId,
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();

  // Active Pass & Search Input
  const [activePassId, setActivePassId] = useState<string>(passId || '');
  const [searchInput, setSearchInput] = useState<string>(passId || '');

  // Backend Gate Pass Record
  const [rawApiPass, setRawApiPass] = useState<GatePassApiRecord | null>(null);
  const [gatePass, setGatePass] = useState<ReturnType<typeof mapGatePassApiRecord> | null>(null);
  const [isLoadingPass, setIsLoadingPass] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activePassIdRef = useRef<string>(activePassId);
  activePassIdRef.current = activePassId;
  const gatePassRef = useRef<typeof gatePass>(gatePass);
  gatePassRef.current = gatePass;

  // Operational State
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST_CONFIG);
  const [remarks, setRemarks] = useState<string>('');
  const [assetStatusOverride, setAssetStatusOverride] = useState<'Verified' | 'Pending Check' | 'Flagged'>('Pending Check');
  const [inspectedQtyInput, setInspectedQtyInput] = useState<number>(1);

  // Barrier & Timer State
  const [barrierState, setBarrierState] = useState<'locked' | 'ready' | 'open'>('locked');
  const [barrierTimer, setBarrierTimer] = useState<number>(0);

  // Recent Verifications Log
  const [recentLogs, setRecentLogs] = useState<RecentVerificationLogItem[]>(
    RECENT_CHECKPOINT_VERIFICATIONS_INITIAL
  );

  // Modals & Toast State
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [showCertModal, setShowCertModal] = useState<boolean>(false);
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState<boolean>(false);
  const [discrepancyReason, setDiscrepancyReason] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState<boolean>(false);

  // Submission in flight
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [isSubmittingEscalate, setIsSubmittingEscalate] = useState<boolean>(false);

  // QR Validation State (SRS QR-03)
  const [qrInput, setQrInput] = useState<string>('');
  const [isValidatingQR, setIsValidatingQR] = useState<boolean>(false);
  const [qrValidation, setQrValidation] = useState<GatePassQRValidationResult | null>(null);
  const [validatedQrCode, setValidatedQrCode] = useState<string>('');
  const [qrValidationTimestamp, setQrValidationTimestamp] = useState<string | null>(null);
  const [qrInputMethod, setQrInputMethod] = useState<'camera' | 'hardware' | 'manual' | null>(null);

  // Camera Scanner State
  const [cameraStatus, setCameraStatus] = useState<
    'idle' | 'initializing' | 'waiting' | 'detected' | 'validating' | 'success' | 'failed'
  >('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const hasDetectedRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);

  // Toast Helper
  const triggerToast = (msg: string, isError = false) => {
    setToastMessage(msg);
    setToastIsError(isError);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Stop camera scanner cleanly
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

  // Cleanup camera scanner on unmount or pass switch
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

  // Load Gate Pass Data from live backend API
  const fetchPassData = useCallback(async (idToFetch: string) => {
    const trimmed = idToFetch.trim();
    if (!trimmed) {
      setGatePass(null);
      setRawApiPass(null);
      setLoadError(null);
      setIsLoadingPass(false);
      return;
    }

    setIsLoadingPass(true);
    setLoadError(null);

    try {
      const apiRecord = await getGatePass(trimmed);
      const mapped = mapGatePassApiRecord(apiRecord);
      setRawApiPass(apiRecord);
      setGatePass(mapped);
      setInspectedQtyInput(mapped.quantity || 1);

      // Reset checklist and remarks from backend
      setRemarks(apiRecord.exit_notes || apiRecord.entry_notes || '');
      setChecklist(INITIAL_CHECKLIST_CONFIG.map((item) => ({ ...item, checked: false })));
      setAssetStatusOverride('Pending Check');
      setBarrierState('locked');
      setBarrierTimer(0);
      setQrValidation(null);
      setValidatedQrCode('');
      setQrInput('');
      setQrInputMethod(null);
    } catch (err: unknown) {
      setGatePass(null);
      setRawApiPass(null);
      const status = (err as GatePassApiError).status;
      const msg =
        status === 404
          ? `Gate pass "${trimmed}" was not found in the system.`
          : status === 401
            ? 'Your session has expired. Please sign in again.'
            : status === 403
              ? 'You do not have permission to view this gate pass.'
              : (err as Error).message || 'Unable to load gate pass verification.';
      setLoadError(msg);
      triggerToast(msg, true);
    } finally {
      setIsLoadingPass(false);
    }
  }, []);

  // Sync pass ID from route prop
  useEffect(() => {
    if (passId) {
      setActivePassId(passId);
      setSearchInput(passId);
      fetchPassData(passId);
    }
  }, [passId, fetchPassData]);

  // Start Camera Scanner
  const startCameraScanner = useCallback(
    async (cameraIdToUse?: string) => {
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

      const elementId = 'amx-ggv-camera-preview';
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
            devices = enumerated.map((d, i) => ({
              id: d.id,
              label: d.label || `Camera ${i + 1}`,
            }));
            setAvailableCameras(devices);
          }
        } catch (err) {
          console.warn('Unable to enumerate cameras:', err);
        }

        const scanner = new Html5Qrcode(elementId, { verbose: false });
        html5QrCodeRef.current = scanner;

        const cameraConfig =
          cameraIdToUse ||
          (devices.length > 0 ? devices[0].id : { facingMode: 'environment' });

        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          async (decodedText: string) => {
            if (hasDetectedRef.current) return;
            hasDetectedRef.current = true;

            setCameraStatus('detected');
            await stopCameraScanner();
            await handleValidateScannedCode(decodedText, 'camera');
          },
          () => {
            // ignore frame-level waiting errors
          }
        );

        setCameraStatus('waiting');
      } catch (err: unknown) {
        await stopCameraScanner();
        setCameraStatus('failed');
        const errName = (err as Error)?.name || '';
        const errMsg = (err as Error)?.message || String(err);

        if (
          errName === 'NotAllowedError' ||
          errMsg.includes('Permission') ||
          errMsg.includes('NotAllowed')
        ) {
          setCameraError(
            'Camera permission was denied. Please allow camera access in your browser settings.'
          );
        } else if (
          errName === 'NotFoundError' ||
          errMsg.includes('NotFound') ||
          errMsg.includes('no camera')
        ) {
          setCameraError(
            'No camera device found on this system. Connect a camera or use hardware scanner / manual entry.'
          );
        } else if (
          errName === 'NotReadableError' ||
          errMsg.includes('NotReadable') ||
          errMsg.includes('in use')
        ) {
          setCameraError('Camera is currently unavailable or in use by another application.');
        } else {
          setCameraError(`Unable to start camera: ${errMsg}`);
        }
      }
    },
    [stopCameraScanner]
  );

  // Trigger camera start when scanner modal opens
  useEffect(() => {
    if (showScannerModal && cameraStatus === 'initializing') {
      startCameraScanner(selectedCameraId || undefined);
    }
  }, [showScannerModal, cameraStatus, selectedCameraId, startCameraScanner]);

  // Open / Close Scanner Modal
  const handleOpenScanner = () => {
    setShowScannerModal(true);
    setCameraStatus('initializing');
    setCameraError(null);
  };

  const handleCloseScanner = async () => {
    await stopCameraScanner();
    setShowScannerModal(false);
    setCameraStatus('idle');
    setCameraError(null);
  };

  // Validate Scanned QR Code
  const handleValidateScannedCode = async (
    rawCode: string,
    method: 'camera' | 'hardware' | 'manual'
  ) => {
    const cleanQr = rawCode.trim();
    if (!cleanQr) return;

    setQrInput(cleanQr);
    setQrInputMethod(method);
    setIsValidatingQR(true);
    setCameraStatus('validating');

    // Extract pass ID if activePassId is not set
    let targetPassId = activePassIdRef.current;
    if (!targetPassId) {
      const passMatch = cleanQr.match(/GP-\d{4}-\d+/i);
      if (passMatch) {
        targetPassId = passMatch[0].toUpperCase();
        setActivePassId(targetPassId);
        setSearchInput(targetPassId);
      }
    }

    const currentPass = gatePassRef.current;
    const targetAction =
      currentPass?.status === 'Approved'
        ? 'exit'
        : currentPass?.status === 'Active'
          ? 'entry'
          : 'inspect';

    try {
      const result = await validateGatePassQR({
        qr_code: cleanQr,
        expected_pass_id: targetPassId || undefined,
        target_action: targetAction,
      });

      setQrValidation(result);
      setQrValidationTimestamp(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );

      if (result.valid) {
        if (targetPassId && result.pass_id && result.pass_id !== targetPassId) {
          setCameraStatus('failed');
          setCameraError(
            `Mismatched QR code: Scanned code belongs to pass "${result.pass_id}", but currently viewing "${targetPassId}".`
          );
          triggerToast(
            `QR Mismatch: Scanned pass ${result.pass_id} does not match active pass ${targetPassId}.`,
            true
          );
          return;
        }

        // Successfully validated
        setValidatedQrCode(cleanQr);
        setCameraStatus('success');

        // Auto-check mandatory Item 1 (Digital Token Authenticated) ONLY
        // SRS QR-03: Item 3 (Physical Serial Numbers Matched) requires physical inspection
        setChecklist((prev) =>
          prev.map((c) => (c.id === 1 ? { ...c, checked: true } : c))
        );

        triggerToast(`QR Authenticated: Bound to ${result.pass_id} (${result.resolved_format}).`);

        // If a different pass was scanned, fetch its records and bind QR
        if (!currentPass || currentPass.id !== result.pass_id) {
          if (result.pass_id) {
            setActivePassId(result.pass_id);
            setSearchInput(result.pass_id);
            await fetchPassData(result.pass_id);
            // Re-apply validated QR state after loading
            setValidatedQrCode(cleanQr);
            setQrInputMethod(method);
            setQrValidation(result);
            setChecklist((prev) =>
              prev.map((c) => (c.id === 1 ? { ...c, checked: true } : c))
            );
          }
        }

        setTimeout(() => {
          handleCloseScanner();
        }, 1200);
      } else {
        setCameraStatus('failed');
        setCameraError(`Validation Failed: ${result.message}`);
        triggerToast(`QR Validation Failed: ${result.message}`, true);
      }
    } catch (err: unknown) {
      setCameraStatus('failed');
      const msg = (err as GatePassApiError).message || 'QR validation request failed.';
      setCameraError(msg);
      triggerToast(msg, true);
    } finally {
      setIsValidatingQR(false);
    }
  };

  // Checklist completion count
  const completedChecklistCount = checklist.filter((item) => item.checked).length;
  const isAllChecklistComplete = completedChecklistCount === 6;

  // Update barrier state when checklist updates
  useEffect(() => {
    if (barrierState !== 'open') {
      const isQrValid = qrValidation?.valid && qrValidation?.pass_id === activePassId;
      if (isAllChecklistComplete && isQrValid) {
        setBarrierState('ready');
      } else {
        setBarrierState('locked');
      }
    }
  }, [isAllChecklistComplete, qrValidation, activePassId, barrierState]);

  // Local UI clearance reset timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (barrierState === 'open' && barrierTimer > 0) {
      interval = setInterval(() => {
        setBarrierTimer((prev) => {
          if (prev <= 1) {
            setBarrierState('locked');
            triggerToast('Local console view reset: Ready for next gate pass lookup.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [barrierState, barrierTimer]);

  // Toggle checklist item
  const handleToggleChecklist = (id: number) => {
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.id === 1 && !qrValidation?.valid) {
            triggerToast('Item 1 requires mandatory server-side QR scan validation under SRS QR-03.', true);
            return item;
          }
          const nextChecked = !item.checked;
          if (item.id === 3) {
            setAssetStatusOverride(nextChecked ? 'Verified' : 'Pending Check');
          }
          return { ...item, checked: nextChecked };
        }
        return item;
      })
    );
  };

  // Manual Asset Serial & Item Inspection Confirmation
  const handleVerifyAsset = () => {
    setAssetStatusOverride('Verified');
    setChecklist((prev) =>
      prev.map((c) => (c.id === 3 ? { ...c, checked: true } : c))
    );
    triggerToast(`Physical asset serial and tags manually confirmed by guard.`);
  };

  const handleQuickMatchAll = () => {
    setAssetStatusOverride('Verified');
    setChecklist((prev) =>
      prev.map((c) => (c.id === 3 ? { ...c, checked: true } : c))
    );
    triggerToast('All manifest items and serial tags manually confirmed by guard inspection.');
  };

  // Pass Lookup
  const handleSearchPass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchInput.trim().toUpperCase();
    if (!query) {
      triggerToast('Please enter a Gate Pass ID.', true);
      return;
    }
    setActivePassId(query);
    fetchPassData(query);
  };

  // Hardware Scanner / Manual Input Mode handlers
  const handleHardwareScannerSubmit = (code: string) => {
    handleValidateScannedCode(code, 'hardware');
  };

  // Confirm Gate Clearance (Verify Exit or Entry via Backend API)
  const handleConfirmBarrierRelease = async () => {
    if (!activePassId || !gatePass) {
      triggerToast('No active gate pass loaded.', true);
      return;
    }

    if (!isAllChecklistComplete) {
      triggerToast('Cannot record clearance: Complete all 6 checklist items first.', true);
      return;
    }

    // Mandatory QR validation under SRS QR-03
    if (!qrValidation?.valid || qrValidation.pass_id !== activePassId) {
      triggerToast(
        'Mandatory QR validation required under SRS QR-03. Please scan and validate the pass QR code before completing verification.',
        true
      );
      return;
    }

    if (isSubmittingAction) return;
    setIsSubmittingAction(true);

    const isExit = gatePass.status === 'Approved';
    const isEntry = gatePass.status === 'Active' && gatePass.passType === 'Returnable';

    if (!isExit && !isEntry) {
      triggerToast(
        `Pass with status "${gatePass.status}" cannot undergo gate clearance.`,
        true
      );
      setIsSubmittingAction(false);
      return;
    }

    try {
      let updated: GatePassApiRecord;
      const codeToSend = validatedQrCode || qrInput.trim();

      if (isExit) {
        updated = await verifyExitGatePass(activePassId, {
          exit_gate: 'Gate-01A',
          exit_notes: remarks.trim() || undefined,
          qr_code: codeToSend,
        });
      } else {
        updated = await verifyEntryGatePass(activePassId, {
          entry_gate: 'Gate-01A',
          entry_notes: remarks.trim() || undefined,
          qr_code: codeToSend,
        });
      }

      const mapped = mapGatePassApiRecord(updated);
      setGatePass(mapped);
      setRawApiPass(updated);

      setBarrierState('open');
      setBarrierTimer(45);

      const actionLabel = isExit ? 'Outward Exit' : 'Inward Entry';
      const newLog: RecentVerificationLogItem = {
        id: `LOG-${Date.now()}`,
        passId: activePassId,
        description: `${mapped.assetOrItem} (${mapped.quantity} items)`,
        direction: isExit ? 'Outward' : 'Inward',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Cleared',
        guard: currentUser?.full_name || 'Guard Officer',
      };
      setRecentLogs((prev) => [newLog, ...prev]);

      triggerToast(
        `Pass Clearance Recorded: ${actionLabel} verified for ${activePassId}. Pass is now ${mapped.status}.`
      );
    } catch (err: unknown) {
      const status = (err as GatePassApiError).status;
      const msg =
        status === 409
          ? 'Invalid state transition: This pass is not eligible for this verification action.'
          : status === 400
            ? (err as GatePassApiError).message || 'QR validation failed for this gate pass.'
            : status === 422
              ? 'Verification payload is invalid or gate information is missing.'
              : status === 403
                ? 'You do not have permission to verify gate passes.'
                : (err as Error).message || 'Verification request failed.';
      triggerToast(msg, true);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Flag Discrepancy (Escalate Gate Pass)
  const handleFlagDiscrepancy = async () => {
    const reason = (discrepancyReason || remarks).trim();
    if (!reason) {
      triggerToast('Discrepancy remarks required before logging incident.', true);
      return;
    }

    if (!activePassId || !gatePass) {
      triggerToast('No active gate pass loaded to escalate.', true);
      return;
    }

    if (isSubmittingEscalate) return;
    setIsSubmittingEscalate(true);

    try {
      const updated = await escalateGatePass(activePassId, {
        reason,
        action_required: 'Checkpoint physical inspection exception review required.',
      });

      const mapped = mapGatePassApiRecord(updated);
      setGatePass(mapped);
      setRawApiPass(updated);
      setBarrierState('locked');

      const flaggedLog: RecentVerificationLogItem = {
        id: `LOG-${Date.now()}`,
        passId: activePassId,
        description: `${mapped.assetOrItem}: ${reason}`,
        direction: gatePass.gateActivity.exitStatus === 'Verified' ? 'Inward' : 'Outward',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Flagged Discrepancy',
        guard: currentUser?.full_name || 'Guard Officer',
      };
      setRecentLogs((prev) => [flaggedLog, ...prev]);

      setShowDiscrepancyModal(false);
      setDiscrepancyReason('');
      triggerToast(`Gate pass ${activePassId} escalated and recorded in the system.`, true);
    } catch (err: unknown) {
      const msg =
        (err as GatePassApiError).message ||
        (err as Error).message ||
        'Failed to escalate gate pass.';
      triggerToast(msg, true);
    } finally {
      setIsSubmittingEscalate(false);
    }
  };

  // Cancel Verification
  const handleCancelVerification = () => {
    setBarrierState('locked');
    setBarrierTimer(0);
    triggerToast('Verification paused.');
  };

  // Derived UI Manifest Values
  const direction: 'Inward' | 'Outward' =
    gatePass?.passType === 'Returnable' && gatePass.gateActivity.exitStatus === 'Verified'
      ? 'Inward'
      : 'Outward';
  const directionLabel = direction === 'Inward' ? 'Inbound Intake' : 'Outbound Dispatch';

  const manifestStatus =
    gatePass?.status === 'Escalated'
      ? 'Flagged - Security Discrepancy'
      : barrierState === 'open'
        ? 'Gate Clearance Recorded (Verified)'
        : gatePass?.status || 'Awaiting Gate Pass Selection';

  // Derived Asset list from real Gate Pass
  const assets: ManifestAssetItem[] = useMemo(() => {
    if (!gatePass) return [];
    return [
      {
        tag: gatePass.id,
        name: gatePass.assetOrItem,
        spec: `${gatePass.passType} Gate Pass Movement â€¢ ${gatePass.department}`,
        classification: 'Controlled Asset',
        physicalSerial: `SN-${gatePass.id}`,
        expectedQty: gatePass.quantity || 1,
        inspectedQty: inspectedQtyInput,
        status: assetStatusOverride,
        icon: 'inventory_2',
      },
    ];
  }, [gatePass, inspectedQtyInput, assetStatusOverride]);

  const verifiedAssetsCount = assets.filter((a) => a.status === 'Verified').length;
  const pendingAssetsCount = assets.filter((a) => a.status === 'Pending Check').length;

  return (
    <DashboardLayout
      currentNav="Gate Verification"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="amx-ggv-container">
        {/* ==============================================================
            1. BREADCRUMBS & TOP BAR
            ============================================================== */}
        <div className="amx-ggv-topbar">
          <div className="amx-ggv-topbar-left">
            <div className="amx-ggv-breadcrumbs">
              <span
                className="amx-ggv-crumb-link"
                onClick={() => onNavigate && onNavigate('dashboard')}
              >
                Dashboard
              </span>
              <span className="amx-ggv-crumb-sep">/</span>
              <span className="amx-ggv-crumb-active">Gate Verification</span>
            </div>
            <div className="amx-ggv-title-row">
              <h1 className="amx-ggv-title">Gate Verification</h1>
              <span className="amx-ggv-node-chip">
                <span className="amx-ggv-node-dot"></span>
                Guard Verification Console
              </span>
              <span className="amx-ggv-shift-chip">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  shield_person
                </span>
                Guard Console
              </span>
            </div>
            <p className="amx-ggv-subtitle">
              Verify physical asset manifests, vehicle authorization, and secure custody transfers
              before recording software gate pass verification.
            </p>
          </div>

          <div className="amx-ggv-topbar-actions">
            <button
              type="button"
              className="amx-ggv-btn-report"
              id="quickReportBtn"
              disabled={!gatePass}
              onClick={() => setShowDiscrepancyModal(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                report_problem
              </span>
              Report Discrepancy
            </button>
            <button
              type="button"
              className="amx-ggv-btn-scan-top"
              id="cameraScanBtn"
              onClick={handleOpenScanner}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                qr_code_scanner
              </span>
              Scan Badge / QR
            </button>
          </div>
        </div>

        {/* ==============================================================
            2. HERO CHECKPOINT SEARCH & GATE PASS LOOKUP PANEL
            ============================================================== */}
        <div className="amx-ggv-hero-card">
          <div className="amx-ggv-hero-gradient"></div>

          <div className="amx-ggv-hero-header">
            <div>
              <div className="amx-ggv-hero-badge">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  sensors
                </span>
                Checkpoint Manifest Ingestion
              </div>
              <h2 className="amx-ggv-hero-title">Dispatch &amp; Custody Gate Pass Lookup</h2>
            </div>
            <div className="amx-ggv-rfid-chip">
              <span className="amx-ggv-rfid-dot"></span>
              Guard Verification Console
            </div>
          </div>

          <form className="amx-ggv-search-bar" onSubmit={handleSearchPass}>
            <div className="amx-ggv-search-wrapper">
              <span className="material-symbols-outlined amx-ggv-search-icon">badge</span>
              <input
                type="text"
                className="amx-ggv-search-input"
                id="gatePassInput"
                placeholder="Enter Gate Pass ID (e.g., GP-2026-0001)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="amx-ggv-btn-search"
              id="lookupPassBtn"
              onClick={() => handleSearchPass()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                search
              </span>
              Search Pass
            </button>
            <button
              type="button"
              className="amx-ggv-btn-scan-qr"
              id="scanBarcodeBtn"
              onClick={handleOpenScanner}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                barcode_scanner
              </span>
              QR / Barcode Scan
            </button>
          </form>

          {/* Input Method Source Indicator */}
          {qrInputMethod && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#76777d', fontWeight: 600 }}>
                Verification Source:
              </span>
              <span className={`amx-ggv-pill active`} style={{ fontSize: '11px', padding: '3px 8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>
                  {qrInputMethod === 'camera'
                    ? 'photo_camera'
                    : qrInputMethod === 'hardware'
                      ? 'barcode_scanner'
                      : 'edit'}
                </span>
                {qrInputMethod === 'camera'
                  ? 'Camera Scan'
                  : qrInputMethod === 'hardware'
                    ? 'Hardware Scanner (HID)'
                    : 'Manual Text Entry'}
              </span>
              {qrValidationTimestamp && (
                <span style={{ fontSize: '11px', color: '#76777d' }}>
                  Validated at {qrValidationTimestamp}
                </span>
              )}
            </div>
          )}

          <div className="amx-ggv-recent-row">
            <div className="amx-ggv-recent-pills">
              <span className="amx-ggv-recent-label">Quick Actions:</span>
              <button
                type="button"
                className="amx-ggv-pill"
                onClick={() => {
                  if (onNavigate) onNavigate('gate-pass');
                }}
              >
                Browse Gate Pass Ledger
              </button>
              {activePassId && (
                <button
                  type="button"
                  className="amx-ggv-pill active"
                  onClick={() => fetchPassData(activePassId)}
                >
                  Reload {activePassId}
                </button>
              )}
            </div>
            <span className="amx-ggv-recent-subtext">
              Scan physical slip QR code or tap terminal badge sensor
            </span>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoadingPass && (
          <div style={{ padding: '32px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e0e3e5' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#00687a', animation: 'spin 1.5s linear infinite' }}>
              sync
            </span>
            <p style={{ marginTop: '8px', color: '#45464d', fontWeight: 500 }}>
              Retrieving Gate Pass records from secure registry...
            </p>
          </div>
        )}

        {loadError && !isLoadingPass && (
          <div style={{ padding: '24px', background: 'rgba(186, 26, 26, 0.08)', borderRadius: '12px', border: '1px solid rgba(186, 26, 26, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '28px' }}>
                error
              </span>
              <div>
                <span style={{ fontWeight: 700, color: '#ba1a1a' }}>Failed to Load Gate Pass</span>
                <p style={{ margin: '2px 0 0', color: '#45464d', fontSize: '13px' }}>{loadError}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="amx-ggv-btn-search"
                style={{ height: '36px', padding: '0 14px', fontSize: '13px' }}
                onClick={() => fetchPassData(activePassId)}
              >
                Retry
              </button>
              <button
                type="button"
                className="amx-ggv-btn-cancel-barrier"
                style={{ padding: '6px 12px', fontSize: '13px' }}
                onClick={() => {
                  setLoadError(null);
                  setActivePassId('');
                  setSearchInput('');
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Awaiting Selection State */}
        {!activePassId && !isLoadingPass && !loadError && (
          <div style={{ padding: '40px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px dashed #76777d' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#00687a' }}>
              qr_code_scanner
            </span>
            <h3 style={{ margin: '12px 0 6px', color: '#191c1e', fontSize: '18px' }}>
              Ready for Checkpoint Inspection
            </h3>
            <p style={{ margin: 0, color: '#45464d', fontSize: '14px', maxWidth: '480px', marginInline: 'auto' }}>
              Scan the physical gate pass QR code using the camera scanner, connect a handheld HID scanner, or enter a Gate Pass ID in the search box above.
            </p>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                className="amx-ggv-btn-scan-qr"
                style={{ height: '42px', padding: '0 20px' }}
                onClick={handleOpenScanner}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  photo_camera
                </span>
                Scan Pass QR
              </button>
              <button
                type="button"
                className="amx-ggv-btn-search"
                style={{ height: '42px', padding: '0 20px' }}
                onClick={() => onNavigate && onNavigate('gate-pass')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  list_alt
                </span>
                Open Pass Ledger
              </button>
            </div>
          </div>
        )}

        {/* ==============================================================
            3. ACTIVE GATE PASS METADATA BANNER & MANIFEST CARD
            ============================================================== */}
        {gatePass && !isLoadingPass && (
          <div className="amx-ggv-manifest-card" id="passDetailsCard">
            <div className="amx-ggv-manifest-header">
              <div className="amx-ggv-manifest-header-left">
                <div className="amx-ggv-pass-id-group">
                  <span className="amx-ggv-pass-id-text" id="displayPassId">
                    {gatePass.id}
                  </span>
                  <span
                    className={`amx-ggv-direction-pill ${
                      direction === 'Inward' ? 'inward' : ''
                    }`}
                  >
                    {directionLabel}
                  </span>
                </div>
                <div className="amx-ggv-status-badge">
                  <span
                    className={`amx-ggv-status-dot ${
                      manifestStatus.includes('Flagged') ? 'flagged' : ''
                    }`}
                  ></span>
                  {manifestStatus}
                </div>
              </div>

              <div className="amx-ggv-manifest-header-right">
                <div className="amx-ggv-approver-chip">
                  <span className="material-symbols-outlined amx-ggv-approver-icon">verified</span>
                  {gatePass.decisionBy ? `${gatePass.decisionBy} (Clearance Officer)` : 'Awaiting Review'}
                </div>
                <button
                  type="button"
                  className="amx-ggv-btn-cert"
                  id="viewDigitalManifest"
                  onClick={() => setShowCertModal(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    file_open
                  </span>
                  View Pass Details
                </button>
              </div>
            </div>

            <div className="amx-ggv-metadata-grid">
              {/* Requester */}
              <div className="amx-ggv-meta-col">
                <span className="amx-ggv-meta-label">Requester / Employee</span>
                <div className="amx-ggv-meta-person">
                  <div className="amx-ggv-meta-avatar">
                    {gatePass.requesterName
                      ? gatePass.requesterName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : 'EM'}
                  </div>
                  <div className="amx-ggv-meta-name-box">
                    <span className="amx-ggv-meta-name">{gatePass.requesterName}</span>
                    <span className="amx-ggv-meta-badge">
                      Pass Type: {gatePass.passType}
                    </span>
                  </div>
                </div>
                <span className="amx-ggv-meta-sub">
                  Department: {gatePass.department}
                </span>
              </div>

              {/* Authorizer */}
              <div className="amx-ggv-meta-col">
                <span className="amx-ggv-meta-label">Host &amp; Custody Authorizer</span>
                <div className="amx-ggv-meta-person">
                  <span
                    className="material-symbols-outlined"
                    style={{ color: '#00687a', fontSize: '20px' }}
                  >
                    person_check
                  </span>
                  <span className="amx-ggv-meta-name">
                    {gatePass.decisionBy || 'Host Clearance Officer'}
                  </span>
                  <span className="amx-ggv-meta-badge">
                    ({rawApiPass?.authorization_state || 'Approved'})
                  </span>
                </div>
                <span className="amx-ggv-meta-sub">
                  Movement Date: {gatePass.movementDate || 'Current Shift'}
                </span>
              </div>

              {/* Routing */}
              <div className="amx-ggv-meta-col">
                <span className="amx-ggv-meta-label">Movement Routing</span>
                <div className="amx-ggv-route-row" style={{ marginTop: '4px' }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ color: '#76777d', fontSize: '18px' }}
                  >
                    warehouse
                  </span>
                  <span style={{ fontWeight: 500 }}>
                    {gatePass.currentLocation || 'Main Facility Logistics Bay'}
                  </span>
                </div>
                <div className="amx-ggv-route-arrow">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    arrow_forward
                  </span>
                  <span style={{ color: '#191c1e', fontWeight: 600 }}>
                    {gatePass.destination}
                  </span>
                </div>
              </div>

              {/* Carrier */}
              <div className="amx-ggv-meta-col">
                <span className="amx-ggv-meta-label">Transport Carrier &amp; Vehicle</span>
                <div className="amx-ggv-route-row" style={{ marginTop: '4px' }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ color: '#45464d', fontSize: '20px' }}
                  >
                    local_shipping
                  </span>
                  <span style={{ fontWeight: 600 }}>Logistics Courier Transit</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="amx-ggv-plate-pill">MH-12-TR-9041</span>
                  <span style={{ fontSize: '12px', color: '#45464d' }}>
                    Officer: {currentUser?.full_name || 'Checkpoint Guard'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            4. ASSET VERIFICATION & ITEM MANIFEST TABLE
            ============================================================== */}
        {gatePass && !isLoadingPass && (
          <div className="amx-ggv-table-card">
            <div className="amx-ggv-table-header">
              <div>
                <div className="amx-ggv-table-title-group">
                  <h2 className="amx-ggv-table-title">Asset Verification &amp; Item Manifest</h2>
                  <span
                    className={`amx-ggv-manifest-summary-badge ${
                      pendingAssetsCount === 0 ? 'all-verified' : ''
                    }`}
                    id="manifestSummaryBadge"
                  >
                    {assets.length} Assets Listed â€¢ {verifiedAssetsCount} Verified â€¢{' '}
                    {pendingAssetsCount} Pending
                  </span>
                </div>
                <p className="amx-ggv-table-subtitle">
                  Inspect physical item tags, hardware serials, and quantities against the gate pass manifest.
                </p>
              </div>

              <div className="amx-ggv-table-tools">
                <button
                  type="button"
                  className="amx-ggv-btn-match-all"
                  id="bulkVerifyBtn"
                  onClick={handleQuickMatchAll}
                >
                  Confirm Physical Check (Manual)
                </button>
                <div className="amx-ggv-table-tool-divider"></div>
                <span className="amx-ggv-table-hint-pill">
                  Manual Confirmation: Guard Observed Physical Verification
                </span>
                <span className="amx-ggv-table-lane-text">Inspection Mode: Manual Check</span>
              </div>
            </div>

            <div className="amx-ggv-table-wrapper">
              <table className="amx-ggv-table">
                <thead>
                  <tr>
                    <th>Asset Tag</th>
                    <th>Hardware Specification</th>
                    <th>Classification</th>
                    <th className="highlight-col">Observed Serial / Tag Ref</th>
                    <th style={{ textAlign: 'center' }}>Exp. Qty</th>
                    <th className="highlight-col" style={{ textAlign: 'center' }}>
                      Inspected Qty
                    </th>
                    <th className="highlight-col">Verification Status</th>
                    <th style={{ textAlign: 'right', paddingRight: '24px' }}>Checkpoint Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((item) => (
                    <tr
                      key={item.tag}
                      className={item.status === 'Pending Check' ? 'pending-row' : ''}
                      id={item.status === 'Pending Check' ? 'pendingRow' : undefined}
                    >
                      <td>
                        <div className="amx-ggv-tag-cell">
                          <span className="material-symbols-outlined amx-ggv-tag-icon">
                            {item.icon}
                          </span>
                          <span>{item.tag}</span>
                        </div>
                      </td>
                      <td>
                        <div className="amx-ggv-spec-box">
                          <span className="amx-ggv-spec-name">{item.name}</span>
                          <span className="amx-ggv-spec-desc">{item.spec}</span>
                        </div>
                      </td>
                      <td style={{ color: '#45464d' }}>{item.classification}</td>
                      <td>
                        <div className="amx-ggv-serial-chip">
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: '16px',
                              color: item.status === 'Verified' ? '#00687a' : '#76777d',
                            }}
                            id={item.status === 'Pending Check' ? 'pendingSerialIcon' : undefined}
                          >
                            {item.status === 'Verified' ? 'check_circle' : 'pending'}
                          </span>
                          <span
                            className="amx-ggv-serial-val"
                            id={item.status === 'Pending Check' ? 'pendingSerialText' : undefined}
                          >
                            {item.physicalSerial}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                        }}
                      >
                        {item.expectedQty}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.status === 'Pending Check' ? (
                          <input
                            type="number"
                            className="amx-ggv-qty-input"
                            id="physicalQtyInput"
                            value={inspectedQtyInput}
                            onChange={(e) => setInspectedQtyInput(Number(e.target.value))}
                            min={0}
                            max={item.expectedQty}
                          />
                        ) : (
                          <span className="amx-ggv-qty-val">{item.inspectedQty}</span>
                        )}
                      </td>
                      <td>
                        {item.status === 'Verified' && (
                          <span className="amx-ggv-verified-badge" id="pendingStatusBadge">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: '14px' }}
                            >
                              done_all
                            </span>
                            Verified
                          </span>
                        )}
                        {item.status === 'Pending Check' && (
                          <span className="amx-ggv-pending-badge" id="pendingStatusBadge">
                            <span
                              className="amx-ggv-status-dot"
                              style={{ backgroundColor: '#76777d' }}
                            ></span>
                            Pending Check
                          </span>
                        )}
                        {item.status === 'Flagged' && (
                          <span className="amx-ggv-flagged-badge">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: '14px' }}
                            >
                              report
                            </span>
                            Discrepancy
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                        {item.status === 'Verified' ? (
                          <button
                            type="button"
                            className="amx-ggv-btn-rescan"
                            onClick={() => {
                              handleVerifyAsset();
                              triggerToast(`Asset ${item.tag} manual inspection re-confirmed.`);
                            }}
                            title="Update verification inspection record"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                              sync
                            </span>
                            Re-verify Inspection
                          </button>
                        ) : (
                          <div className="amx-ggv-pending-actions">
                            <button
                              type="button"
                              className="amx-ggv-btn-verify-asset"
                              id="verifyAssetActionBtn"
                              onClick={handleVerifyAsset}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '16px' }}
                              >
                                fact_check
                              </span>
                              Verify Asset
                            </button>
                            <button
                              type="button"
                              className="amx-ggv-btn-flag-item"
                              id="flagAssetActionBtn"
                              title="Flag issue with this item"
                              onClick={() => {
                                setShowDiscrepancyModal(true);
                                setDiscrepancyReason(`Serial mismatch on ${item.tag} (${item.name})`);
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '18px' }}
                              >
                                report
                              </span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="amx-ggv-table-footer-notice">
              <span className="amx-ggv-footer-crypto">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px', color: '#00687a' }}
                >
                  verified
                </span>
                Server-Validated Token: assetmx:pass:{gatePass.id}
              </span>
              <span style={{ color: '#76777d' }}>
                Status: {gatePass.status} (Software Record)
              </span>
            </div>
          </div>
        )}

        {/* ==============================================================
            5. TWO-COLUMN OPERATIONAL SECURITY INSPECTION & DECISION CONSOLE
            ============================================================== */}
        {gatePass && !isLoadingPass && (
          <div className="amx-ggv-two-col">
            {/* Left: Perimeter Inspection Checklist */}
            <div className="amx-ggv-checklist-card">
              <div className="amx-ggv-checklist-head">
                <div className="amx-ggv-checklist-title-group">
                  <span className="material-symbols-outlined amx-ggv-checklist-title-icon">
                    checklist
                  </span>
                  <h3 className="amx-ggv-checklist-title">Perimeter Inspection Checklist</h3>
                </div>
                <span
                  className={`amx-ggv-checklist-counter ${
                    isAllChecklistComplete ? 'complete' : ''
                  }`}
                  id="checklistCounter"
                >
                  {completedChecklistCount} / 6 Complete
                </span>
              </div>
              <p className="amx-ggv-checklist-subtitle">
                Local pre-clearance checks: Guard sign-off required prior to recording software gate clearance.
              </p>

              <div className="amx-ggv-checklist-list">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className={`amx-ggv-check-item ${item.locked ? 'locked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={item.locked}
                      id={
                        item.id === 3
                          ? 'checkAssetSerial'
                          : item.id === 6
                            ? 'checkExitClearance'
                            : undefined
                      }
                      onChange={() => handleToggleChecklist(item.id)}
                    />
                    <div className="amx-ggv-check-content">
                      <span className="amx-ggv-check-title">{item.title}</span>
                      <span className="amx-ggv-check-desc">{item.description}</span>
                    </div>
                    <span
                      className={`material-symbols-outlined amx-ggv-check-icon ${
                        item.checked ? 'checked' : ''
                      }`}
                      id={
                        item.id === 3
                          ? 'check3Icon'
                          : item.id === 6
                            ? 'check6Icon'
                            : undefined
                      }
                    >
                      {item.checked ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Right: Gate Clearance Console */}
            <div className="amx-ggv-barrier-card">
              <div className="amx-ggv-barrier-head">
                <div>
                  <span className="amx-ggv-decision-label">Verification Engine</span>
                  <h3 className="amx-ggv-barrier-title">Gate Clearance Console</h3>
                </div>
                <div className="amx-ggv-barrier-head-right">
                  <span className="amx-ggv-barrier-dir-pill">
                    Direction: {direction} / {direction === 'Outward' ? 'Exit' : 'Entry'}
                  </span>
                  <div
                    className={`amx-ggv-decision-pill ${
                      barrierState === 'open'
                        ? 'open'
                        : isAllChecklistComplete && qrValidation?.valid
                          ? 'ready'
                          : 'in-progress'
                    }`}
                    id="decisionPill"
                  >
                    {barrierState === 'open'
                      ? 'GATE CLEARED'
                      : isAllChecklistComplete && qrValidation?.valid
                        ? 'READY FOR CLEARANCE'
                        : 'CHECK IN PROGRESS'}
                  </div>
                </div>
              </div>

              {/* Clearance Status Widget */}
              <div className="amx-ggv-barrier-widget">
                <div className="amx-ggv-barrier-status-left">
                  <div
                    className={`amx-ggv-barrier-light ${barrierState}`}
                    id="barrierLight"
                  ></div>
                  <div className="amx-ggv-barrier-name-box">
                    <span className="amx-ggv-barrier-name">
                      {direction === 'Inward'
                        ? 'Inbound Lane #01'
                        : 'Outbound Lane #01'}
                    </span>
                    <span className="amx-ggv-barrier-state-text" id="barrierStatusText">
                      {barrierState === 'open'
                        ? `Status: GATE CLEARED (Local UI Reset in: ${barrierTimer}s)`
                        : isAllChecklistComplete && qrValidation?.valid
                          ? 'Status: READY (Pre-checks Complete)'
                          : 'Status: PENDING (Pre-checks Incomplete)'}
                    </span>
                  </div>
                </div>
                <span className="amx-ggv-barrier-relay">Software Console Mode</span>
              </div>

              {/* Remarks Form */}
              <div className="amx-ggv-remarks-group">
                <div className="amx-ggv-remarks-label-row">
                  <label className="amx-ggv-remarks-label" htmlFor="guardRemarks">
                    Guard Shift Observations / Log Remarks
                  </label>
                  <span className="amx-ggv-remarks-hint">(Required if Discrepancy Flagged)</span>
                </div>
                <textarea
                  className="amx-ggv-remarks-textarea"
                  id="guardRemarks"
                  rows={3}
                  placeholder="Enter remarks regarding serial verification, transporter badges, or visual cargo inspection..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                ></textarea>
                <span className="amx-ggv-remarks-sub">
                  Observations are submitted to the backend gate pass history as verification notes.
                </span>
              </div>

              {/* Actions */}
              <div className="amx-ggv-barrier-actions">
                <button
                  type="button"
                  className="amx-ggv-btn-release"
                  id="confirmExitBtn"
                  disabled={
                    !isAllChecklistComplete ||
                    barrierState === 'open' ||
                    !qrValidation?.valid ||
                    isSubmittingAction ||
                    (gatePass.status !== 'Approved' &&
                      !(gatePass.status === 'Active' && gatePass.passType === 'Returnable'))
                  }
                  onClick={handleConfirmBarrierRelease}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                    {barrierState === 'open' ? 'lock_open' : 'lock'}
                  </span>
                  {barrierState === 'open'
                    ? `Clearance Recorded • Local UI Reset (${barrierTimer}s)`
                    : isSubmittingAction
                      ? 'Submitting Verification to Backend...'
                      : gatePass.status === 'Approved'
                        ? `Confirm Exit Clearance (Outbound)`
                        : gatePass.status === 'Active' && gatePass.passType === 'Returnable'
                          ? `Confirm Entry Clearance (Inward)`
                          : `Pass ${gatePass.status} (Clearance Ineligible)`}
                </button>
                {(!isAllChecklistComplete || !qrValidation?.valid) && barrierState !== 'open' && (
                  <span className="amx-ggv-release-hint">
                    Disabled: {!qrValidation?.valid ? 'Server-Side QR Validation (SRS QR-03) required' : 'Complete all 6 local checklist items'} to enable gate clearance
                  </span>
                )}

                <div className="amx-ggv-sub-actions-grid">
                  <button
                    type="button"
                    className="amx-ggv-btn-flag-barrier"
                    id="flagDiscrepancyBtn"
                    onClick={() => setShowDiscrepancyModal(true)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        flag
                      </span>
                      Flag Discrepancy
                    </span>
                    <span className="amx-ggv-flag-sub">(Remarks required)</span>
                  </button>
                  <button
                    type="button"
                    className="amx-ggv-btn-cancel-barrier"
                    id="cancelVerificationBtn"
                    onClick={handleCancelVerification}
                  >
                    Cancel Verification
                  </button>
                </div>
              </div>

              {/* Safety Prompt */}
              <div className="amx-ggv-safety-prompt">
                <span className="material-symbols-outlined amx-ggv-safety-icon">policy</span>
                <span className="amx-ggv-safety-text">
                  By confirming clearance, guard certifies that physical items match the
                  validated gate pass record and transport is cleared for checkpoint transit.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            6. RECENT VERIFICATIONS AUDIT TRAIL LOG
            ============================================================== */}
        <div className="amx-ggv-audit-card">
          <div className="amx-ggv-audit-header">
            <div>
              <h2 className="amx-ggv-audit-title">Recent Checkpoint Verification Activity</h2>
              <p className="amx-ggv-audit-subtitle">
                Local terminal session log of gate verification actions and security reviews for current shift.
              </p>
            </div>
            <div className="amx-ggv-audit-actions">
              <button
                type="button"
                className="amx-ggv-btn-export"
                onClick={() =>
                  triggerToast('Exporting shift verification log to audit CSV...')
                }
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  download
                </span>
                Export Shift Log
              </button>
              <button
                type="button"
                className="amx-ggv-btn-view-all"
                onClick={() => onNavigate && onNavigate('entry-exit-logs')}
              >
                View Full Audit Logs
              </button>
            </div>
          </div>

          <div className="amx-ggv-table-wrapper">
            <table className="amx-ggv-audit-table">
              <thead>
                <tr>
                  <th>Pass ID</th>
                  <th>Equipment Description</th>
                  <th>Direction</th>
                  <th>Timestamp</th>
                  <th>Clearance Status</th>
                  <th>Security Guard</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span
                        className="amx-ggv-audit-pass-id"
                        onClick={() => {
                          setActivePassId(log.passId);
                          setSearchInput(log.passId);
                          fetchPassData(log.passId);
                        }}
                        style={{ cursor: 'pointer' }}
                        title="Load this gate pass"
                      >
                        {log.passId}
                      </span>
                    </td>
                    <td style={{ color: '#191c1e', fontWeight: 500 }}>{log.description}</td>
                    <td className="amx-ggv-audit-dir">{log.direction}</td>
                    <td className="amx-ggv-audit-time">{log.time}</td>
                    <td>
                      {log.status === 'Cleared' ? (
                        <span className="amx-ggv-verified-badge">
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '13px' }}
                          >
                            check
                          </span>
                          Cleared
                        </span>
                      ) : (
                        <span className="amx-ggv-flagged-badge">
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '13px' }}
                          >
                            report
                          </span>
                          Flagged Discrepancy
                        </span>
                      )}
                    </td>
                    <td className="amx-ggv-audit-guard">{log.guard}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==============================================================
            7. ROLE BOUNDARIES & PHYSICAL SECURITY COMPLIANCE DISCLAIMER
            ============================================================== */}
        <div className="amx-ggv-boundary-banner">
          <div className="amx-ggv-boundary-left">
            <div className="amx-ggv-boundary-icon-box">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                admin_panel_settings
              </span>
            </div>
            <div className="amx-ggv-boundary-text-box">
              <span className="amx-ggv-boundary-title">Guard Operational Boundary Enforced</span>
              <p className="amx-ggv-boundary-desc">
                Checkpoint terminal role is restricted to physical inspection verification, pass manifest
                correlation, gate clearance recording, and immediate incident flagging. Master asset schema modifications,
                pass authoring, and inventory write overrides require Enterprise Admin credentials.
              </p>
            </div>
          </div>
          <div className="amx-ggv-boundary-tag">
            <span className="amx-ggv-boundary-tag-dot"></span>
            Gate Terminal Compliance ISO-27001
          </div>
        </div>

        {/* ==============================================================
            8. TOAST NOTIFICATION
            ============================================================== */}
        {toastMessage && (
          <div
            className={`amx-ggv-toast-container ${toastIsError ? 'error' : ''}`}
            id="toastNotification"
          >
            <span
              className={`material-symbols-outlined amx-ggv-toast-icon ${
                toastIsError ? 'error' : ''
              }`}
              id="toastIcon"
            >
              {toastIsError ? 'error' : 'check_circle'}
            </span>
            <span id="toastMessage">{toastMessage}</span>
          </div>
        )}

        {/* ==============================================================
            9. MODAL: QR / BARCODE SCANNER (Real html5-qrcode & HID)
            ============================================================== */}
        {showScannerModal && (
          <div className="amx-ggv-modal-overlay" onClick={handleCloseScanner}>
            <div className="amx-ggv-modal" onClick={(e) => e.stopPropagation()}>
              <div className="amx-ggv-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: '#57dffe', fontSize: '22px' }}>
                    photo_camera
                  </span>
                  <h3 className="amx-ggv-modal-title">Checkpoint Camera &amp; QR Scanner</h3>
                </div>
                <button
                  type="button"
                  className="amx-ggv-modal-close"
                  aria-label="Close camera scanner"
                  onClick={handleCloseScanner}
                >
                  âœ•
                </button>
              </div>

              <div className="amx-ggv-modal-body">
                {/* Camera Device Selector if multiple available */}
                {availableCameras.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#76777d' }}>Camera:</label>
                    <select
                      className="amx-camera-device-select"
                      aria-label="Select Camera Device"
                      value={selectedCameraId}
                      onChange={(e) => {
                        setSelectedCameraId(e.target.value);
                        startCameraScanner(e.target.value || undefined);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #c4c7c9',
                        fontSize: '12px',
                        backgroundColor: '#ffffff',
                        color: '#191c1e',
                        flex: 1,
                      }}
                    >
                      {availableCameras.map((cam) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Viewfinder Preview Box */}
                <div
                  className="amx-ggv-scanner-frame"
                  style={{ position: 'relative', width: '100%', minHeight: '240px', backgroundColor: '#0b1c30' }}
                >
                  <div
                    id="amx-ggv-camera-preview"
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  ></div>
                  <div className="amx-ggv-scanner-line"></div>

                  {cameraStatus === 'waiting' && (
                    <div style={{ position: 'absolute', bottom: '10px', left: 0, right: 0, textAlign: 'center', color: '#57dffe', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                      Align physical QR code or gate pass barcode in viewport
                    </div>
                  )}

                  {cameraStatus === 'initializing' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#57dffe' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1.5s linear infinite' }}>
                        sync
                      </span>
                      <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>
                        Initializing live camera viewfinder...
                      </span>
                    </div>
                  )}

                  {cameraStatus === 'validating' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(11, 28, 48, 0.85)', color: '#57dffe' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#57dffe' }}>
                        verified_user
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        Validating QR with server...
                      </span>
                    </div>
                  )}

                  {cameraStatus === 'success' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(0, 104, 122, 0.9)', color: '#ffffff' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '42px', color: '#57dffe' }}>
                        check_circle
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>
                        Authentication Successful
                      </span>
                      <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                        {validatedQrCode}
                      </span>
                    </div>
                  )}

                  {cameraStatus === 'failed' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center', background: 'rgba(186, 26, 26, 0.85)', color: '#ffffff', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>
                        error
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        {cameraError || 'Camera scan error'}
                      </span>
                      <button
                        type="button"
                        className="amx-ggv-btn-search"
                        style={{ height: '32px', padding: '0 12px', fontSize: '12px', background: '#ffffff', color: '#ba1a1a', border: 'none' }}
                        onClick={() => startCameraScanner(selectedCameraId || undefined)}
                      >
                        Retry Camera
                      </button>
                    </div>
                  )}
                </div>

                {/* Manual Text / USB HID Scanner Fallback Input */}
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#76777d' }}>
                    Or Enter / Scan QR String (HID Scanner / Manual):
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="amx-ggv-search-input"
                      id="amx-gate-qr-input"
                      placeholder="e.g. assetmx:pass:GP-2026-0001 or GP-2026-0001"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleHardwareScannerSubmit(qrInput);
                        }
                      }}
                      style={{ flex: 1, height: '40px', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      className="amx-ggv-btn-search"
                      id="validateManualQrBtn"
                      disabled={!qrInput.trim() || isValidatingQR}
                      onClick={() => handleValidateScannedCode(qrInput, 'manual')}
                      style={{ height: '40px', padding: '0 16px', fontSize: '13px' }}
                    >
                      {isValidatingQR ? 'Validating...' : 'Validate QR'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="amx-ggv-modal-footer">
                <button
                  type="button"
                  className="amx-ggv-btn-cancel-barrier"
                  onClick={handleCloseScanner}
                >
                  Close Scanner
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            10. MODAL: GATE PASS QR VERIFICATION DETAILS
            ============================================================== */}
        {showCertModal && (
          <div className="amx-ggv-modal-overlay" onClick={() => setShowCertModal(false)}>
            <div className="amx-ggv-modal" onClick={(e) => e.stopPropagation()}>
              <div className="amx-ggv-modal-header">
                <h3 className="amx-ggv-modal-title">Gate Pass QR Verification Details</h3>
                <button
                  type="button"
                  className="amx-ggv-modal-close"
                  onClick={() => setShowCertModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="amx-ggv-modal-body">
                <div style={{ padding: '16px', backgroundColor: '#f2f4f6', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>Gate Pass ID:</span>
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{gatePass?.id || activePassId}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>Pass Status:</span>
                    <span style={{ fontWeight: 600, color: '#00687a' }}>{gatePass?.status || 'Active'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>Requester:</span>
                    <span>{gatePass?.requesterName || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>Issuing Authority:</span>
                    <span>AssetMX Enterprise Identity Gateway</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>QR Format:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                      {qrValidation?.resolved_format || `assetmx:pass:${activePassId}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>Server Validation:</span>
                    <span style={{ color: qrValidation?.valid ? '#00687a' : '#ba1a1a', fontWeight: 600 }}>
                      {qrValidation?.valid ? 'SERVER VALIDATED & AUTHENTICATED' : 'NOT VALIDATED'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="amx-ggv-modal-footer">
                <button
                  type="button"
                  className="amx-ggv-btn-cancel-barrier"
                  onClick={() => setShowCertModal(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            11. MODAL: REPORT DISCREPANCY
            ============================================================== */}
        {showDiscrepancyModal && (
          <div className="amx-ggv-modal-overlay" onClick={() => setShowDiscrepancyModal(false)}>
            <div className="amx-ggv-modal" onClick={(e) => e.stopPropagation()}>
              <div className="amx-ggv-modal-header">
                <h3 className="amx-ggv-modal-title" style={{ color: '#ba1a1a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined">report_problem</span>
                  Flag Checkpoint Discrepancy
                </h3>
                <button
                  type="button"
                  className="amx-ggv-modal-close"
                  onClick={() => setShowDiscrepancyModal(false)}
                >
                  âœ•
                </button>
              </div>
              <div className="amx-ggv-modal-body">
                <p style={{ fontSize: '14px', color: '#45464d', margin: 0 }}>
                  Flagging this gate pass halts checkpoint clearance. Gate pass will be escalated and recorded in the system.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#76777d' }}>
                    Observed Issue Details:
                  </label>
                  <textarea
                    className="amx-ggv-remarks-textarea"
                    rows={3}
                    placeholder="Enter discrepancy reasons (e.g. serial mismatch, broken tamper seal, unauthorized driver)..."
                    value={discrepancyReason}
                    onChange={(e) => setDiscrepancyReason(e.target.value)}
                  ></textarea>
                </div>
              </div>
              <div className="amx-ggv-modal-footer">
                <button
                  type="button"
                  className="amx-ggv-btn-cancel-barrier"
                  onClick={() => setShowDiscrepancyModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="amx-ggv-btn-flag-barrier"
                  id="confirmDiscrepancyBtn"
                  style={{ padding: '8px 16px', flexDirection: 'row' }}
                  disabled={!discrepancyReason.trim() || isSubmittingEscalate}
                  onClick={handleFlagDiscrepancy}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    report
                  </span>
                  {isSubmittingEscalate ? 'Recording Escalation...' : 'Confirm Discrepancy Escalation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GuardGateVerificationPage;
