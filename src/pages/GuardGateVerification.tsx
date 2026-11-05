import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  GUARD_GATE_PASS_MANIFESTS,
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

export const GuardGateVerificationPage: React.FC<GuardGateVerificationPageProps> = ({
  passId = 'GP-2026-0422',
  onNavigate,
  onSignOut,
}) => {
  // Active Pass & Search Input
  const [activePassId, setActivePassId] = useState<string>(passId);
  const [searchInput, setSearchInput] = useState<string>(passId);

  // Active Manifest State
  const initialManifest = useMemo(() => {
    return (
      GUARD_GATE_PASS_MANIFESTS[activePassId] ||
      GUARD_GATE_PASS_MANIFESTS['GP-2026-0422']
    );
  }, [activePassId]);

  const [assets, setAssets] = useState<ManifestAssetItem[]>(initialManifest.assets);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialManifest.checklist);
  const [remarks, setRemarks] = useState<string>(initialManifest.defaultRemarks);
  const [manifestStatus, setManifestStatus] = useState<string>(initialManifest.status);

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

  // Toast Helper
  const triggerToast = (msg: string, isError = false) => {
    setToastMessage(msg);
    setToastIsError(isError);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync state when activePassId changes
  useEffect(() => {
    const manifest =
      GUARD_GATE_PASS_MANIFESTS[activePassId] ||
      GUARD_GATE_PASS_MANIFESTS['GP-2026-0422'];
    setAssets(manifest.assets);
    setChecklist(manifest.checklist);
    setRemarks(manifest.defaultRemarks);
    setManifestStatus(manifest.status);
    setBarrierState('locked');
    setBarrierTimer(0);
    setSearchInput(activePassId);
  }, [activePassId]);

  // Checklist completion count
  const completedChecklistCount = checklist.filter((item) => item.checked).length;
  const isAllChecklistComplete = completedChecklistCount === 6;

  // Update barrier state when checklist updates (if not already opened)
  useEffect(() => {
    if (barrierState !== 'open') {
      if (isAllChecklistComplete) {
        setBarrierState('ready');
      } else {
        setBarrierState('locked');
      }
    }
  }, [isAllChecklistComplete, barrierState]);

  // Barrier countdown timer simulation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (barrierState === 'open' && barrierTimer > 0) {
      interval = setInterval(() => {
        setBarrierTimer((prev) => {
          if (prev <= 1) {
            setBarrierState('locked');
            triggerToast('Barrier auto-closed: Interlock re-engaged.');
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
        if (item.id === id && !item.locked) {
          return { ...item, checked: !item.checked };
        }
        return item;
      })
    );
  };

  // Single Asset Verification
  const handleVerifyAsset = (assetTag: string) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.tag === assetTag ? { ...a, status: 'Verified' as const } : a
      )
    );

    // Auto-check checklist item 3 (Physical Serial Numbers Matched)
    setChecklist((prev) =>
      prev.map((c) => (c.id === 3 ? { ...c, checked: true } : c))
    );

    triggerToast(`Asset ${assetTag} serial matched and verified.`);
  };

  // Quick Match All Serials
  const handleQuickMatchAll = () => {
    setAssets((prev) =>
      prev.map((a) => ({ ...a, status: 'Verified' as const }))
    );
    setChecklist((prev) =>
      prev.map((c) => (c.id === 3 ? { ...c, checked: true } : c))
    );
    triggerToast('All manifest serial numbers matched against cryptographic token.');
  };

  // Handle Pass Lookup
  const handleSearchPass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchInput.trim().toUpperCase();
    if (!query) return;

    if (GUARD_GATE_PASS_MANIFESTS[query]) {
      setActivePassId(query);
      triggerToast(`Loaded manifest records for ${query}`);
    } else {
      triggerToast(`Pass ${query} not in active local cache. Defaulting to GP-2026-0422.`, true);
      setActivePassId('GP-2026-0422');
    }
  };

  // Confirm Barrier Release
  const handleConfirmBarrierRelease = () => {
    if (!isAllChecklistComplete) {
      triggerToast('Cannot open barrier: Complete all 6 checklist items first.', true);
      return;
    }

    setBarrierState('open');
    setBarrierTimer(45);
    setManifestStatus('Physical Clearance Granted (Barrier Open)');

    // Add to recent logs
    const newLog: RecentVerificationLogItem = {
      id: `LOG-${Date.now()}`,
      passId: activePassId,
      description: `${assets[0]?.name || 'Consolidated Equipment'} (${assets.length} items)`,
      direction: initialManifest.direction,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Cleared',
      guard: 'M. Vance (Gate-01A)',
    };
    setRecentLogs((prev) => [newLog, ...prev]);

    triggerToast(
      `Barrier Interlock Released: ${initialManifest.direction} clearance recorded for ${activePassId}.`
    );
  };

  // Flag Discrepancy
  const handleFlagDiscrepancy = () => {
    if (!remarks.trim()) {
      triggerToast('Remarks required: Enter observations before flagging discrepancy.', true);
      return;
    }

    setManifestStatus('Flagged - Security Discrepancy');
    setBarrierState('locked');

    // Add flagged entry to recent audit log
    const flaggedLog: RecentVerificationLogItem = {
      id: `LOG-${Date.now()}`,
      passId: activePassId,
      description: `${initialManifest.carrier.plate}: Discrepancy flagged (${assets[0]?.tag || 'Asset'})`,
      direction: initialManifest.direction,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Flagged Discrepancy',
      guard: 'M. Vance (Gate-01A)',
    };
    setRecentLogs((prev) => [flaggedLog, ...prev]);

    setShowDiscrepancyModal(false);
    triggerToast(
      `Incident logged: Vehicle ${initialManifest.carrier.plate} held at Gate-01A for inspection.`,
      true
    );
  };

  // Cancel Verification
  const handleCancelVerification = () => {
    setBarrierState('locked');
    setBarrierTimer(0);
    triggerToast('Verification paused. Manifest returned to checkpoint queue.');
  };

  // Verified Assets summary count
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
                Active Node • Gate-01A
              </span>
              <span className="amx-ggv-shift-chip">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  shield_person
                </span>
                Shift A (Active)
              </span>
            </div>
            <p className="amx-ggv-subtitle">
              Verify physical asset manifests, vehicle authorization, and secure custody transfers
              before releasing physical checkpoint barriers.
            </p>
          </div>

          <div className="amx-ggv-topbar-actions">
            <button
              type="button"
              className="amx-ggv-btn-report"
              id="quickReportBtn"
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
              onClick={() => setShowScannerModal(true)}
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
              RFID Barrier Link: <strong style={{ color: '#191c1e' }}>ONLINE (99.8%)</strong>
            </div>
          </div>

          <form className="amx-ggv-search-bar" onSubmit={handleSearchPass}>
            <div className="amx-ggv-search-wrapper">
              <span className="material-symbols-outlined amx-ggv-search-icon">badge</span>
              <input
                type="text"
                className="amx-ggv-search-input"
                id="gatePassInput"
                placeholder="Enter Gate Pass ID (e.g., GP-2026-0422, GP-2026-0420)..."
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
              onClick={() => setShowScannerModal(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                barcode_scanner
              </span>
              QR / Barcode Scan
            </button>
          </form>

          <div className="amx-ggv-recent-row">
            <div className="amx-ggv-recent-pills">
              <span className="amx-ggv-recent-label">Recent Manifests:</span>
              <button
                type="button"
                className={`amx-ggv-pill ${activePassId === 'GP-2026-0420' ? 'active' : ''}`}
                data-id="GP-2026-0420"
                onClick={() => {
                  setActivePassId('GP-2026-0420');
                  triggerToast('Loaded manifest records for GP-2026-0420');
                }}
              >
                GP-2026-0420
              </button>
              <button
                type="button"
                className={`amx-ggv-pill-flagged ${activePassId === 'GP-2026-0418' ? 'active' : ''}`}
                data-id="GP-2026-0418"
                onClick={() => {
                  setActivePassId('GP-2026-0418');
                  triggerToast('Loaded manifest records for GP-2026-0418');
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                  flag
                </span>
                GP-2026-0418 (Flagged)
              </button>
              <button
                type="button"
                className={`amx-ggv-pill ${activePassId === 'GP-2026-0414' ? 'active' : ''}`}
                data-id="GP-2026-0414"
                onClick={() => {
                  setActivePassId('GP-2026-0414');
                  triggerToast('Loaded manifest records for GP-2026-0414');
                }}
              >
                GP-2026-0414
              </button>
            </div>
            <span className="amx-ggv-recent-subtext">
              Scan physical slip QR code or tap terminal badge sensor
            </span>
          </div>
        </div>

        {/* ==============================================================
            3. ACTIVE GATE PASS METADATA BANNER & MANIFEST CARD
            ============================================================== */}
        <div className="amx-ggv-manifest-card" id="passDetailsCard">
          <div className="amx-ggv-manifest-header">
            <div className="amx-ggv-manifest-header-left">
              <div className="amx-ggv-pass-id-group">
                <span className="amx-ggv-pass-id-text" id="displayPassId">
                  {initialManifest.passId}
                </span>
                <span
                  className={`amx-ggv-direction-pill ${
                    initialManifest.direction === 'Inward' ? 'inward' : ''
                  }`}
                >
                  {initialManifest.directionLabel}
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
                {initialManifest.approver}
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
                View Auth Cert
              </button>
            </div>
          </div>

          <div className="amx-ggv-metadata-grid">
            {/* Requester */}
            <div className="amx-ggv-meta-col">
              <span className="amx-ggv-meta-label">Requester / Employee</span>
              <div className="amx-ggv-meta-person">
                <div className="amx-ggv-meta-avatar">{initialManifest.requester.initials}</div>
                <div className="amx-ggv-meta-name-box">
                  <span className="amx-ggv-meta-name">{initialManifest.requester.name}</span>
                  <span className="amx-ggv-meta-badge">
                    Badge: {initialManifest.requester.badge}
                  </span>
                </div>
              </div>
              <span className="amx-ggv-meta-sub">
                Department: {initialManifest.requester.dept}
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
                <span className="amx-ggv-meta-name">{initialManifest.authorizer.name}</span>
                <span className="amx-ggv-meta-badge">({initialManifest.authorizer.code})</span>
              </div>
              <span className="amx-ggv-meta-sub">
                Authorized Window: {initialManifest.authorizer.window}
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
                <span style={{ fontWeight: 500 }}>{initialManifest.routing.origin}</span>
              </div>
              <div className="amx-ggv-route-arrow">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  arrow_forward
                </span>
                <span style={{ color: '#191c1e', fontWeight: 600 }}>
                  {initialManifest.routing.destination}
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
                <span style={{ fontWeight: 600 }}>{initialManifest.carrier.type}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span className="amx-ggv-plate-pill">{initialManifest.carrier.plate}</span>
                <span style={{ fontSize: '12px', color: '#45464d' }}>
                  Driver: {initialManifest.carrier.driver}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ==============================================================
            4. ASSET VERIFICATION & ITEM MANIFEST TABLE
            ============================================================== */}
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
                  {assets.length} Assets Listed • {verifiedAssetsCount} Verified •{' '}
                  {pendingAssetsCount} Pending
                </span>
              </div>
              <p className="amx-ggv-table-subtitle">
                Scan hardware serials and verify item counts against digital dispatch cryptotoken.
              </p>
            </div>

            <div className="amx-ggv-table-tools">
              <button
                type="button"
                className="amx-ggv-btn-match-all"
                id="bulkVerifyBtn"
                onClick={handleQuickMatchAll}
              >
                Quick Match Serials
              </button>
              <div className="amx-ggv-table-tool-divider"></div>
              <span className="amx-ggv-table-hint-pill">
                Fields highlighted: Guard Observed Physical Verification
              </span>
              <span className="amx-ggv-table-lane-text">Inspection Lane: Bay-01 Scanner</span>
            </div>
          </div>

          <div className="amx-ggv-table-wrapper">
            <table className="amx-ggv-table">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Hardware Specification</th>
                  <th>Classification</th>
                  <th className="highlight-col">Guard Physical Serial</th>
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
                          defaultValue={item.inspectedQty}
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
                          onClick={() =>
                            triggerToast(`Rescanned ${item.tag}. Serial ${item.physicalSerial} re-verified.`)
                          }
                          title="Update verification scan record"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            sync
                          </span>
                          Rescan / Update Scan Result
                        </button>
                      ) : (
                        <div className="amx-ggv-pending-actions">
                          <button
                            type="button"
                            className="amx-ggv-btn-verify-asset"
                            id="verifyAssetActionBtn"
                            onClick={() => handleVerifyAsset(item.tag)}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: '16px' }}
                            >
                              qr_code_scanner
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
                verified_user
              </span>
              Manifest Cryptographically Signed: {initialManifest.hash}
            </span>
            <span style={{ color: '#76777d' }}>Terminal ID: {initialManifest.terminalId}</span>
          </div>
        </div>

        {/* ==============================================================
            5. TWO-COLUMN OPERATIONAL SECURITY INSPECTION & DECISION CONSOLE
            ============================================================== */}
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
              All mandatory checks must be signed off by physical inspection guard.
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

          {/* Right: Barrier Release Console */}
          <div className="amx-ggv-barrier-card">
            <div className="amx-ggv-barrier-head">
              <div>
                <span className="amx-ggv-decision-label">Decision Engine</span>
                <h3 className="amx-ggv-barrier-title">Barrier Release Console</h3>
              </div>
              <div className="amx-ggv-barrier-head-right">
                <span className="amx-ggv-barrier-dir-pill">
                  Direction: {initialManifest.direction} /{' '}
                  {initialManifest.direction === 'Outward' ? 'Exit' : 'Entry'}
                </span>
                <div
                  className={`amx-ggv-decision-pill ${
                    barrierState === 'open'
                      ? 'open'
                      : isAllChecklistComplete
                      ? 'ready'
                      : 'in-progress'
                  }`}
                  id="decisionPill"
                >
                  {barrierState === 'open'
                    ? 'BARRIER OPEN'
                    : isAllChecklistComplete
                    ? 'READY FOR RELEASE'
                    : 'CHECK IN PROGRESS'}
                </div>
              </div>
            </div>

            {/* Barrier Widget */}
            <div className="amx-ggv-barrier-widget">
              <div className="amx-ggv-barrier-status-left">
                <div
                  className={`amx-ggv-barrier-light ${barrierState}`}
                  id="barrierLight"
                ></div>
                <div className="amx-ggv-barrier-name-box">
                  <span className="amx-ggv-barrier-name">
                    {initialManifest.direction === 'Inward'
                      ? 'Inbound Barrier #01'
                      : 'Outbound Barrier #01'}
                  </span>
                  <span className="amx-ggv-barrier-state-text" id="barrierStatusText">
                    {barrierState === 'open'
                      ? `Status: BARRIER OPEN (Timer: ${barrierTimer}s)`
                      : isAllChecklistComplete
                      ? 'Status: READY (Clear to Raise)'
                      : 'Status: LOCKED (Interlock Active)'}
                  </span>
                </div>
              </div>
              <span className="amx-ggv-barrier-relay">Relay: CH-4</span>
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
                Observations are permanently appended to the immutable custody chain log.
              </span>
            </div>

            {/* Actions */}
            <div className="amx-ggv-barrier-actions">
              <button
                type="button"
                className="amx-ggv-btn-release"
                id="confirmExitBtn"
                disabled={!isAllChecklistComplete || barrierState === 'open'}
                onClick={handleConfirmBarrierRelease}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  {barrierState === 'open' ? 'lock_open' : 'lock'}
                </span>
                {barrierState === 'open'
                  ? `Barrier Released • ${initialManifest.direction} Active (${barrierTimer}s)`
                  : `Confirm ${initialManifest.direction === 'Inward' ? 'Entry' : 'Exit'} & Open Barrier (${initialManifest.direction})`}
              </button>
              {!isAllChecklistComplete && barrierState !== 'open' && (
                <span className="amx-ggv-release-hint">
                  Disabled: Complete all 6 mandatory checklist items above to enable barrier release
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
                By issuing release, guard certifies that physical serial counts match the cryptographic manifest.
                Barrier clears automatically for 45 seconds. (Frontend simulation: no real barrier hardware is raised).
              </span>
            </div>
          </div>
        </div>

        {/* ==============================================================
            6. RECENT VERIFICATION AUDIT TRAIL (TODAY'S SHIFT)
            ============================================================== */}
        <div className="amx-ggv-audit-card">
          <div className="amx-ggv-audit-head">
            <div>
              <h2 className="amx-ggv-audit-title">Recent Checkpoint Verifications (Today's Shift)</h2>
              <p className="amx-ggv-audit-subtitle">
                Real-time log of vehicles and hardware validated at Gate-01A.
              </p>
            </div>
            <div className="amx-ggv-audit-total-chip">
              Total Today: {20 + recentLogs.length} Processed
            </div>
          </div>

          <div className="amx-ggv-table-wrapper">
            <table className="amx-ggv-audit-table">
              <thead>
                <tr>
                  <th>Pass ID</th>
                  <th>Details / Asset Manifest</th>
                  <th>Movement Direction</th>
                  <th>Time Cleared</th>
                  <th>Checkpoint Status</th>
                  <th style={{ textAlign: 'right' }}>Inspecting Guard</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="amx-ggv-audit-pass-id">{log.passId}</td>
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
                Checkpoint terminal role is restricted to physical inspection verification, digital manifest
                correlation, barrier release, and immediate incident flagging. Master asset schema modifications,
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
            9. MODAL: QR / BARCODE SCANNER SIMULATION
            ============================================================== */}
        {showScannerModal && (
          <div className="amx-ggv-modal-overlay" onClick={() => setShowScannerModal(false)}>
            <div className="amx-ggv-modal" onClick={(e) => e.stopPropagation()}>
              <div className="amx-ggv-modal-header">
                <h3 className="amx-ggv-modal-title">Checkpoint Hardware Scanner</h3>
                <button
                  type="button"
                  className="amx-ggv-modal-close"
                  onClick={() => setShowScannerModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="amx-ggv-modal-body">
                <div className="amx-ggv-scanner-frame">
                  <div className="amx-ggv-scanner-line"></div>
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#57dffe' }}>
                    qr_code_scanner
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                    Align physical barcode or slip QR code in viewport
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#76777d' }}>
                    Simulate Scanned Gate Pass ID:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['GP-2026-0422', 'GP-2026-0420', 'GP-2026-0418', 'GP-2026-0414'].map((pid) => (
                      <button
                        key={pid}
                        type="button"
                        className="amx-ggv-pill"
                        onClick={() => {
                          setActivePassId(pid);
                          setShowScannerModal(false);
                          triggerToast(`Scanner detected: Loaded manifest for ${pid}`);
                        }}
                      >
                        {pid}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="amx-ggv-modal-footer">
                <button
                  type="button"
                  className="amx-ggv-btn-cancel-barrier"
                  onClick={() => setShowScannerModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            10. MODAL: DIGITAL AUTHENTICATION CERTIFICATE
            ============================================================== */}
        {showCertModal && (
          <div className="amx-ggv-modal-overlay" onClick={() => setShowCertModal(false)}>
            <div className="amx-ggv-modal" onClick={(e) => e.stopPropagation()}>
              <div className="amx-ggv-modal-header">
                <h3 className="amx-ggv-modal-title">Digital Dispatch Cryptotoken Certificate</h3>
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
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{initialManifest.passId}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>Issuing Authority:</span>
                    <span>AssetMX Enterprise Identity Gateway</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>Cryptographic Hash:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{initialManifest.hash}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#76777d' }}>Security Status:</span>
                    <span style={{ color: '#00687a', fontWeight: 600 }}>VALID &amp; UNTAMPERED</span>
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
                  ✕
                </button>
              </div>
              <div className="amx-ggv-modal-body">
                <p style={{ fontSize: '14px', color: '#45464d', margin: 0 }}>
                  Flagging this gate pass locks the barrier relay and immediately routes the transport manifest
                  to the Security Officer escalation queue.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#76777d' }}>
                    Observed Issue Details:
                  </label>
                  <textarea
                    className="amx-ggv-remarks-textarea"
                    rows={3}
                    placeholder="Enter discrepancy reasons (e.g. serial mismatch, broken tamper seal, unauthorized driver)..."
                    value={discrepancyReason || remarks}
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
                  style={{ padding: '8px 16px', flexDirection: 'row' }}
                  onClick={handleFlagDiscrepancy}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    report
                  </span>
                  Confirm Discrepancy Lock
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
