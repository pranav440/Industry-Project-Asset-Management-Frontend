import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AssetStatusBadge } from '../components/AssetStatusBadge';
import { getAsset, initiateTransfer, type AssetApiError, type AssetMovementRecord } from '../api/assetApi';
import type { AssetDetailsData } from '../data/assetDetailsData';
import { ASSET_FILTER_OPTIONS } from '../data/assetsData';
import { getUser } from '../auth/session';
import './AssetTransfer.css';

interface AssetTransferPageProps {
  assetId?: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

interface TransferFormState {
  destinationLocation: string;
  newCustodian: string;
  transferReason: string;
  qrCode: string;
}

interface FormErrors {
  destinationLocation?: string;
  newCustodian?: string;
  qrCode?: string;
  transferReason?: string;
}

export const AssetTransferPage: React.FC<AssetTransferPageProps> = ({
  assetId = 'AST-NC-2026-0012',
  onNavigate,
  onSignOut,
}) => {
  const currentUser = useMemo(() => getUser(), []);

  const [asset, setAsset] = useState<AssetDetailsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<TransferFormState>({
    destinationLocation: '',
    newCustodian: '',
    transferReason: '',
    qrCode: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    assetId: string;
    movementId: string;
    fromLocation: string;
    destination: string;
    fromCustodian: string;
    newCustodian: string;
    status: string;
  } | null>(null);

  // Today's formatted date
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const loadAssetData = useCallback(async () => {
    if (!assetId) {
      setAsset(null);
      setLoading(false);
      setApiError('No asset identifier provided.');
      return;
    }
    setLoading(true);
    setApiError(null);
    setTransferError(null);

    try {
      const record = await getAsset(assetId);
      const loadedQr = record.qr_code_value || `assetmx:${record.asset_id}`;
      setFormData((prev) => ({
        ...prev,
        qrCode: prev.qrCode || loadedQr,
      }));
      setAsset({
        id: record.asset_id,
        name: record.name,
        status: record.status,
        category: record.category,
        specification: record.specification || 'Standard Hardware Unit',
        serialNumber: record.serial_number || 'Not available',
        assignedCustodianDepartment: record.custodian,
        assignedCustodianName: record.custodian,
        assignedLocation: record.location,
        assignedSubLocation: 'Floor Unit',
        warrantyStatus: record.warranty_period,
        warrantyCover: 'Standard Cover',
        lifecycleStageText:
          record.status === 'Disposed'
            ? 'Disposed'
            : record.status === 'In Transit'
            ? 'In Transit'
            : 'Active Assignment',
        estimatedEndOfLife: record.warranty_period || 'Not recorded',
        qrVerifiedText: 'Verified & Active',
        qrExplanation: `QR Tag: ${record.qr_code_value}`,
        lifecycleStages: [],
        acquisition: {
          purchaseDate: record.purchase_date,
          vendorName: record.vendor_name,
          invoiceReference: record.invoice_reference || '',
          poNumber: record.invoice_reference || 'PO-DIRECT',
          totalCost: record.total_cost,
          warrantyPeriod: record.warranty_period,
          configuredDepreciation: record.depreciation || '',
        },
        custody: {
          assignedCustodian: record.custodian,
          department: record.custodian,
          assignedLocation: record.location,
          allocationDate: record.allocation_date || '',
          designatedUser: record.custodian,
          accountabilityStatus: record.status === 'Active' ? 'Active' : record.status,
        },
        movementHistory: (record.movement_history || []).map((movement: AssetMovementRecord) => ({
          id: movement.movement_id,
          date: new Date(movement.initiated_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          movementType: 'Transfer',
          from: movement.from_location,
          to: movement.to_location,
          custodian: movement.to_custodian,
          verification: movement.status,
        })),
        maintenanceHistory: [],
        auditHistory: [],
        qrCodeDataUrl: record.qr_code_data_url,
      });
    } catch (error: unknown) {
      const status = (error as AssetApiError)?.status;
      setAsset(null);
      setApiError(
        status === 401
          ? 'Your session has expired. Please sign in again.'
          : status === 403
          ? 'Admin access is required to transfer assets.'
          : status === 404
          ? `Asset "${assetId}" was not found in the inventory ledger.`
          : status && status >= 500
          ? 'The asset service is temporarily unavailable. Please retry.'
          : error instanceof Error
          ? error.message
          : 'Unable to load asset information.'
      );
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    loadAssetData();
  }, [loadAssetData]);

  const handleInputChange = (field: keyof TransferFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!formData.destinationLocation.trim()) {
      nextErrors.destinationLocation = 'Destination location is required.';
    }
    if (!formData.newCustodian.trim()) {
      nextErrors.newCustodian = 'New custodian is required.';
    }
    if (!formData.qrCode.trim()) {
      nextErrors.qrCode = 'Asset QR code is required for movement transfer under SRS QR-03.';
    }
    if (formData.transferReason.length > 500) {
      nextErrors.transferReason = 'Transfer reason cannot exceed 500 characters.';
    }
    if (
      asset &&
      formData.destinationLocation.trim() === asset.assignedLocation.trim() &&
      formData.newCustodian.trim() === (asset.custody.assignedCustodian || asset.assignedCustodianDepartment).trim()
    ) {
      nextErrors.destinationLocation = 'Destination location or new custodian must be different from current assignment.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleInitiateClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;

    if (asset.status === 'Disposed') {
      showToast('Disposed assets cannot be transferred.');
      return;
    }
    if (asset.status === 'In Transit') {
      showToast('Asset already has an active transfer in progress.');
      return;
    }

    if (!validateForm()) {
      showToast('Please correct the required transfer fields.');
      return;
    }
    setTransferError(null);
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (isSubmitting || !asset) return;
    setIsSubmitting(true);
    setTransferError(null);

    try {
      const response = await initiateTransfer(assetId, {
        destination_location: formData.destinationLocation.trim(),
        new_custodian: formData.newCustodian.trim(),
        qr_code: formData.qrCode.trim(),
        ...(formData.transferReason.trim() ? { transfer_reason: formData.transferReason.trim() } : {}),
      });

      // Update local asset state with returned updated asset and newly persisted movement
      setAsset((current) =>
        current
          ? {
              ...current,
              status: response.asset.status,
              assignedLocation: response.asset.location,
              assignedCustodianDepartment: response.asset.custodian,
              assignedCustodianName: response.asset.custodian,
              custody: {
                ...current.custody,
                assignedCustodian: response.asset.custodian,
                assignedLocation: response.asset.location,
              },
              movementHistory: (response.asset.movement_history || []).map((movement: AssetMovementRecord) => ({
                id: movement.movement_id,
                date: new Date(movement.initiated_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }),
                movementType: 'Transfer',
                from: movement.from_location,
                to: movement.to_location,
                custodian: movement.to_custodian,
                verification: movement.status,
              })),
            }
          : current
      );

      setShowConfirmModal(false);
      setSuccessInfo({
        assetId: response.asset.asset_id,
        movementId: response.movement.movement_id,
        fromLocation: response.movement.from_location,
        destination: response.movement.to_location,
        fromCustodian: response.movement.from_custodian,
        newCustodian: response.movement.to_custodian,
        status: response.movement.status,
      });

      // Reset form values
      setFormData((prev) => ({
        ...prev,
        destinationLocation: '',
        newCustodian: '',
        transferReason: '',
      }));
      setErrors({});

      showToast(`Asset transfer initiated successfully (${response.movement.movement_id}).`);
    } catch (error: unknown) {
      const status = (error as AssetApiError)?.status;
      const rawMessage = (error as { message?: string })?.message || (error instanceof Error ? error.message : '');
      const message =
        status === 400
          ? (rawMessage || 'QR validation failed for this asset.')
          : status === 401
          ? 'Your session has expired. Please sign in again.'
          : status === 403
          ? 'Admin access is required to initiate asset transfers.'
          : status === 404
          ? 'Asset not found.'
          : status === 409
          ? (rawMessage || 'This asset cannot be transferred right now.')
          : status === 422
          ? (rawMessage || 'Please check the transfer details.')
          : rawMessage || 'Unable to initiate the transfer.';
      setTransferError(message);
      showToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const locationOptions = useMemo(() => {
    const raw = [
      { value: 'HQ - Floor 4, Dev Pod 4B', label: 'HQ - Floor 4, Dev Pod 4B' },
      { value: 'HQ - Floor 2, Design Wing', label: 'HQ - Floor 2, Design Wing' },
      { value: 'HQ - Data Center Basement B1', label: 'HQ - Data Center Basement B1' },
      { value: 'Regional Annex - West Wing Labs', label: 'Regional Annex - West Wing Labs' },
      { value: 'Distribution Facility - Bay 12', label: 'Distribution Facility - Bay 12' },
      { value: 'Warehouse Storage - Zone A', label: 'Warehouse Storage - Zone A' },
      ...ASSET_FILTER_OPTIONS.locations.filter((l) => l.value !== ''),
    ];
    const seen = new Set<string>();
    return raw.filter((item) => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    });
  }, []);

  const custodianOptions = useMemo(() => {
    const raw = [
      { value: 'Marcus Vance (EMP-0941) — IT Systems', label: 'Marcus Vance (EMP-0941) — IT Systems' },
      { value: 'Elena Rostova (EMP-1102) — DevOps', label: 'Elena Rostova (EMP-1102) — DevOps' },
      { value: 'Devin Cole (EMP-0419) — Product Lead', label: 'Devin Cole (EMP-0419) — Product Lead' },
      { value: 'Sarah Jenkins (EMP-0312) — Facilities', label: 'Sarah Jenkins (EMP-0312) — Facilities' },
      { value: 'Central Inventory Pool (Unassigned)', label: 'Central Inventory Pool (Unassigned)' },
      ...ASSET_FILTER_OPTIONS.custodians.filter((c) => c.value !== ''),
    ];
    const seen = new Set<string>();
    return raw.filter((item) => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    });
  }, []);

  const handleNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      onNavigate?.('dashboard');
    } else if (subRoute === 'assets') {
      onNavigate?.('assets');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} module — Scheduled.`);
      onNavigate?.(subRoute);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        currentNav="Assets"
        onNavigate={handleNav}
        onSignOut={onSignOut}
        userName={currentUser?.full_name || 'Administrator'}
        userRoleSubtitle={currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Administrator'}
        role={currentUser?.role || 'admin'}
      >
        <div className="amx-transfer-container">
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--amx-dash-text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '32px', color: '#0891b2' }}
              aria-hidden="true"
            >
              progress_activity
            </span>
            <span>Loading asset information for transfer...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (apiError || !asset) {
    return (
      <DashboardLayout
        currentNav="Assets"
        onNavigate={handleNav}
        onSignOut={onSignOut}
        userName={currentUser?.full_name || 'Administrator'}
        userRoleSubtitle={currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Administrator'}
        role={currentUser?.role || 'admin'}
      >
        <div className="amx-transfer-container">
          <nav className="amx-transfer-breadcrumb" aria-label="Breadcrumb">
            <button
              type="button"
              className="amx-transfer-back-btn"
              onClick={() => onNavigate?.('assets')}
              aria-label="Back to Assets Inventory"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                arrow_back
              </span>
              <span>Back to Assets</span>
            </button>
            <span className="amx-transfer-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="amx-transfer-breadcrumb-curr">Initiate Transfer</span>
          </nav>

          <div
            role="alert"
            style={{
              padding: '24px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              fontSize: '14px',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }} aria-hidden="true">
                error
              </span>
              <span>{apiError || 'Asset not found.'}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button
                type="button"
                className="amx-transfer-btn-primary"
                onClick={loadAssetData}
                style={{ width: 'auto', padding: '0 16px', height: '36px' }}
              >
                Retry
              </button>
              <button
                type="button"
                className="amx-transfer-btn-cancel"
                onClick={() => onNavigate?.('assets')}
                style={{ width: 'auto', padding: '0 16px', height: '36px' }}
              >
                Back to Assets Inventory
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isDisposed = asset.status === 'Disposed';
  const isInTransit = asset.status === 'In Transit';
  const isTransferBlocked = isDisposed || isInTransit;

  return (
    <DashboardLayout
      currentNav="Assets"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(q) => showToast(`Search query: ${q}`)}
      searchPlaceholder="Search assets..."
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('Administrative alerts: check asset lifecycle updates.')
      }
      onHelpClick={() => showToast('AssetMX Enterprise Help Center & User Manual.')}
      onProfileClick={() =>
        showToast(`Active User: ${currentUser?.full_name || 'Administrator'} (Role: ${currentUser?.role || 'Admin'}).`)
      }
      userName={currentUser?.full_name || 'Administrator'}
      userRoleSubtitle={currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Administrator'}
      role={currentUser?.role || 'admin'}
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="amx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirmTransferModalTitle">
          <div className="amx-confirm-modal">
            <div className="amx-modal-header">
              <h3 id="confirmTransferModalTitle" className="amx-modal-title">
                Review &amp; Confirm Transfer
              </h3>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setShowConfirmModal(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            <div className="amx-modal-body">
              {transferError && (
                <div role="alert" style={{ marginBottom: '12px', color: '#ba1a1a', fontSize: '13px', fontWeight: 600 }}>
                  {transferError}
                </div>
              )}
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Please review the transfer details below before confirming movement authorization.
              </p>

              <div className="amx-review-grid">
                <div className="amx-review-row">
                  <span className="amx-review-label">Asset</span>
                  <span className="amx-review-val">{asset.name} ({asset.id})</span>
                </div>
                <div className="amx-review-row">
                  <span className="amx-review-label">Initiation Date</span>
                  <span className="amx-review-val">{todayFormatted}</span>
                </div>
                <div className="amx-review-row">
                  <span className="amx-review-label">From Location</span>
                  <span className="amx-review-val">{asset.assignedLocation}</span>
                </div>
                <div className="amx-review-row">
                  <span className="amx-review-label">To Location</span>
                  <span className="amx-review-val" style={{ color: '#00687a' }}>{formData.destinationLocation}</span>
                </div>
                <div className="amx-review-row">
                  <span className="amx-review-label">Current Custodian</span>
                  <span className="amx-review-val">{asset.custody.assignedCustodian}</span>
                </div>
                <div className="amx-review-row">
                  <span className="amx-review-label">New Custodian</span>
                  <span className="amx-review-val" style={{ color: '#00687a' }}>{formData.newCustodian}</span>
                </div>
                <div className="amx-review-row span-2">
                  <span className="amx-review-label">Validated QR Tag</span>
                  <span className="amx-review-val mono" style={{ fontSize: '12px' }}>{formData.qrCode}</span>
                </div>
                {formData.transferReason && (
                  <div className="amx-review-row span-2">
                    <span className="amx-review-label">Transfer Reason</span>
                    <span className="amx-review-val" style={{ fontWeight: 500, fontStyle: 'italic' }}>
                      {formData.transferReason}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="amx-modal-footer">
              <button
                type="button"
                className="amx-transfer-btn-cancel"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="amx-transfer-btn-primary"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  check_circle
                </span>
                <span>{isSubmitting ? 'Submitting...' : 'Confirm Transfer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="amx-transfer-container">
        {/* Breadcrumbs */}
        <nav className="amx-transfer-breadcrumb" aria-label="Breadcrumb">
          <button
            type="button"
            className="amx-transfer-back-btn"
            onClick={() => onNavigate?.(`assets/${asset.id}`)}
            aria-label={`Back to Asset Details (${asset.id})`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
              arrow_back
            </span>
            <span>Asset Details ({asset.id})</span>
          </button>
          <span className="amx-transfer-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="amx-transfer-breadcrumb-curr">Initiate Transfer</span>
        </nav>

        {/* Transfer Blocked Banners */}
        {isDisposed && (
          <div role="alert" className="amx-transfer-warning-banner">
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#dc2626' }} aria-hidden="true">
              block
            </span>
            <span>This asset has been disposed and cannot be transferred.</span>
          </div>
        )}

        {isInTransit && (
          <div role="alert" className="amx-transfer-warning-banner">
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#0284c7' }} aria-hidden="true">
              local_shipping
            </span>
            <span>
              This asset is currently in transit. Physical checkpoint verification must be completed before another transfer can be initiated.
            </span>
          </div>
        )}

        {/* Success State Banner */}
        {successInfo && (
          <div className="amx-transfer-success-banner" role="alert">
            <div className="amx-transfer-success-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }} aria-hidden="true">
                verified
              </span>
            </div>
            <div className="amx-transfer-success-content">
              <h3 className="amx-transfer-success-title">Transfer Initiated (Status: {successInfo.status})</h3>
              <p className="amx-transfer-success-desc">
                Asset transfer request has been successfully recorded in the ledger. Movement authorization is active.
              </p>
              <div className="amx-transfer-success-details">
                <span><strong>Asset ID:</strong> {successInfo.assetId}</span>
                <span><strong>Movement ID:</strong> {successInfo.movementId}</span>
                <span><strong>From:</strong> {successInfo.fromLocation}</span>
                <span><strong>Destination:</strong> {successInfo.destination}</span>
                <span><strong>New Custodian:</strong> {successInfo.newCustodian}</span>
              </div>
              <div className="amx-transfer-success-actions">
                <button
                  type="button"
                  className="amx-btn-view-details"
                  onClick={() => onNavigate?.(`assets/${successInfo.assetId}`)}
                >
                  View Asset Details
                </button>
                <button
                  type="button"
                  className="amx-btn-back-assets"
                  onClick={() => onNavigate?.('assets')}
                >
                  Back to Assets Inventory
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="amx-transfer-header-row">
          <div className="amx-transfer-title-col">
            <h1 className="amx-transfer-title">Initiate Asset Transfer</h1>
            <p className="amx-transfer-subtitle">
              Reassign physical custody or operational location for this asset with compliance tracking.
            </p>
          </div>
          <div className="amx-transfer-header-actions">
            <button
              type="button"
              className="amx-transfer-btn-cancel"
              onClick={() => onNavigate?.(`assets/${asset.id}`)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="amx-transfer-btn-primary"
              onClick={handleInitiateClick}
              disabled={isSubmitting || isTransferBlocked}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                swap_horiz
              </span>
              <span>{isSubmitting ? 'Submitting...' : 'Initiate Transfer'}</span>
            </button>
          </div>
        </div>

        {/* Master 2-Column Grid */}
        <form className="amx-transfer-grid" onSubmit={handleInitiateClick} noValidate>
          {/* Left Main Form Column */}
          <div className="amx-transfer-left-col">
            {/* Section 1: Asset Information (Read-Only) */}
            <section className="amx-transfer-card" aria-labelledby="secAssetInfoTitle">
              <div className="amx-transfer-card-header">
                <div className="amx-transfer-card-title-wrap">
                  <div className="amx-transfer-card-icon">
                    <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                  </div>
                  <div>
                    <h2 id="secAssetInfoTitle" className="amx-transfer-card-title">
                      Asset Information
                    </h2>
                    <p className="amx-transfer-card-sub">Fixed asset specification and current operating status</p>
                  </div>
                </div>
                <span className="amx-transfer-section-tag">READ ONLY</span>
              </div>

              <div className="amx-transfer-fields-2col">
                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Asset ID</label>
                  <div className="amx-transfer-readonly-box">
                    <span>{asset.id}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8' }} aria-hidden="true">
                      lock
                    </span>
                  </div>
                </div>

                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Asset Name</label>
                  <div className="amx-transfer-readonly-box">
                    <span>{asset.name}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8' }} aria-hidden="true">
                      lock
                    </span>
                  </div>
                </div>

                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Category</label>
                  <div className="amx-transfer-readonly-box">
                    <span>{asset.category}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8' }} aria-hidden="true">
                      lock
                    </span>
                  </div>
                </div>

                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Current Status</label>
                  <div className="amx-transfer-readonly-box" style={{ padding: '6px 12px' }}>
                    <AssetStatusBadge status={asset.status} />
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8' }} aria-hidden="true">
                      lock
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Current Assignment (Read-Only) */}
            <section className="amx-transfer-card" aria-labelledby="secCurrentAssignTitle">
              <div className="amx-transfer-card-header">
                <div className="amx-transfer-card-title-wrap">
                  <div className="amx-transfer-card-icon">
                    <span className="material-symbols-outlined" aria-hidden="true">badge</span>
                  </div>
                  <div>
                    <h2 id="secCurrentAssignTitle" className="amx-transfer-card-title">
                      Current Assignment
                    </h2>
                    <p className="amx-transfer-card-sub">Existing custody and physical station</p>
                  </div>
                </div>
                <span className="amx-transfer-section-tag">ORIGIN</span>
              </div>

              <div className="amx-transfer-fields-2col">
                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Current Custodian</label>
                  <div className="amx-transfer-readonly-box">
                    <span>{asset.custody.assignedCustodian || asset.assignedCustodianDepartment}</span>
                  </div>
                </div>

                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Current Department</label>
                  <div className="amx-transfer-readonly-box">
                    <span>{asset.custody.department || asset.assignedCustodianDepartment}</span>
                  </div>
                </div>

                <div className="amx-transfer-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="amx-transfer-label">Current Location</label>
                  <div className="amx-transfer-readonly-box">
                    <span>{asset.assignedLocation}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Transfer Details */}
            <section className="amx-transfer-card" aria-labelledby="secTransferDetailsTitle">
              <div className="amx-transfer-card-header">
                <div className="amx-transfer-card-title-wrap">
                  <div className="amx-transfer-card-icon">
                    <span className="material-symbols-outlined" aria-hidden="true">move_up</span>
                  </div>
                  <div>
                    <h2 id="secTransferDetailsTitle" className="amx-transfer-card-title">
                      Transfer Details
                    </h2>
                    <p className="amx-transfer-card-sub">Specify destination location, new custodian, and justification</p>
                  </div>
                </div>
                <span className="amx-transfer-section-tag">REQUIRED</span>
              </div>

              <div className="amx-transfer-fields-2col">
                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label" htmlFor="destLocationSelect">
                    Destination Location <span className="amx-transfer-req-star">*</span>
                  </label>
                  <select
                    id="destLocationSelect"
                    className={`amx-transfer-select ${errors.destinationLocation ? 'has-error' : ''}`}
                    value={formData.destinationLocation}
                    onChange={(e) => handleInputChange('destinationLocation', e.target.value)}
                    disabled={isTransferBlocked}
                  >
                    <option value="">Select Destination Location</option>
                    {locationOptions.map((loc) => (
                      <option key={loc.value} value={loc.value}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                  {errors.destinationLocation && (
                    <span className="amx-transfer-field-error">{errors.destinationLocation}</span>
                  )}
                </div>

                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label" htmlFor="newCustodianSelect">
                    New Custodian <span className="amx-transfer-req-star">*</span>
                  </label>
                  <select
                    id="newCustodianSelect"
                    className={`amx-transfer-select ${errors.newCustodian ? 'has-error' : ''}`}
                    value={formData.newCustodian}
                    onChange={(e) => handleInputChange('newCustodian', e.target.value)}
                    disabled={isTransferBlocked}
                  >
                    <option value="">Select New Custodian</option>
                    {custodianOptions.map((cust) => (
                      <option key={cust.value} value={cust.value}>
                        {cust.label}
                      </option>
                    ))}
                  </select>
                  {errors.newCustodian && (
                    <span className="amx-transfer-field-error">{errors.newCustodian}</span>
                  )}
                </div>

                <div className="amx-transfer-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="amx-transfer-label" htmlFor="qrCodeInput">
                    Asset QR Code / Tag <span className="amx-transfer-req-star">*</span> (Mandatory SRS QR-03 Validation)
                  </label>
                  <input
                    type="text"
                    id="qrCodeInput"
                    className={`amx-transfer-input ${errors.qrCode ? 'has-error' : ''}`}
                    placeholder="Scan asset QR code or enter URN (e.g. assetmx:AST-...)"
                    value={formData.qrCode}
                    onChange={(e) => handleInputChange('qrCode', e.target.value)}
                    disabled={isTransferBlocked}
                  >
                  </input>
                  {errors.qrCode && (
                    <span className="amx-transfer-field-error">{errors.qrCode}</span>
                  )}
                </div>

                <div className="amx-transfer-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="amx-transfer-label" htmlFor="transferReasonInput">
                    Transfer Reason / Operational Justification
                  </label>
                  <textarea
                    id="transferReasonInput"
                    className="amx-transfer-textarea"
                    placeholder="Provide justification or project reallocation notes (optional, max 500 characters)..."
                    value={formData.transferReason}
                    maxLength={500}
                    onChange={(e) => handleInputChange('transferReason', e.target.value)}
                    disabled={isTransferBlocked}
                  />
                  {errors.transferReason && (
                    <span className="amx-transfer-field-error">{errors.transferReason}</span>
                  )}
                </div>
              </div>
            </section>

            {/* Section 4: Movement Schedule Information */}
            <section className="amx-transfer-card" aria-labelledby="secMovementInfoTitle">
              <div className="amx-transfer-card-header">
                <div className="amx-transfer-card-title-wrap">
                  <div className="amx-transfer-card-icon">
                    <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                  </div>
                  <div>
                    <h2 id="secMovementInfoTitle" className="amx-transfer-card-title">
                      Movement Information
                    </h2>
                    <p className="amx-transfer-card-sub">Automatic timestamping and movement dispatch schedule</p>
                  </div>
                </div>
                <span className="amx-transfer-section-tag">AUTO LOGGED</span>
              </div>

              <div className="amx-transfer-movement-info">
                <div className="amx-movement-label-col">
                  <span className="amx-movement-label">Transfer Initiation Date</span>
                  <span className="amx-movement-value">{todayFormatted}</span>
                </div>
                <div className="amx-movement-badge">
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">
                    history_toggle_off
                  </span>
                  <span>Auto-recorded upon confirmation</span>
                </div>
              </div>

              {/* Informational QR Callout */}
              <div className="amx-transfer-qr-note">
                <span className="material-symbols-outlined amx-transfer-qr-note-icon" aria-hidden="true">
                  qr_code_scanner
                </span>
                <div>
                  <h4 className="amx-transfer-qr-note-title">Transit Verification Notice</h4>
                  <p className="amx-transfer-qr-note-text">
                    QR-based movement validation is performed during applicable transit checkpoints under SRS QR-03.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5: Persisted Movement & Transfer History */}
            <section className="amx-transfer-card" aria-labelledby="secMovementHistoryTitle">
              <div className="amx-transfer-card-header">
                <div className="amx-transfer-card-title-wrap">
                  <div className="amx-transfer-card-icon">
                    <span className="material-symbols-outlined" aria-hidden="true">history</span>
                  </div>
                  <div>
                    <h2 id="secMovementHistoryTitle" className="amx-transfer-card-title">
                      Movement &amp; Transfer History
                    </h2>
                    <p className="amx-transfer-card-sub">
                      Authoritative audit trail of physical relocations and custodial handovers
                    </p>
                  </div>
                </div>
                <span className="amx-transfer-section-tag">
                  {asset.movementHistory.length} {asset.movementHistory.length === 1 ? 'RECORD' : 'RECORDS'}
                </span>
              </div>

              <div className="amx-transfer-table-wrapper">
                <table className="amx-transfer-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Movement ID</th>
                      <th scope="col">From Location</th>
                      <th scope="col">To Location</th>
                      <th scope="col">To Custodian</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.movementHistory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: 'center',
                            padding: '24px 16px',
                            color: 'var(--amx-dash-text-muted)',
                            fontStyle: 'italic',
                          }}
                        >
                          No physical movement or relocation records logged yet for this asset.
                        </td>
                      </tr>
                    ) : (
                      asset.movementHistory.map((mov) => (
                        <tr key={mov.id}>
                          <td className="amx-td-mono">{mov.date}</td>
                          <td className="amx-td-mono" style={{ fontSize: '12px' }}>
                            {mov.id}
                          </td>
                          <td className="amx-td-muted">{mov.from}</td>
                          <td className="amx-td-semibold">{mov.to}</td>
                          <td className="amx-td-muted">{mov.custodian}</td>
                          <td>
                            <span
                              className={`amx-transfer-status-badge ${
                                mov.verification === 'Completed'
                                  ? 'completed'
                                  : mov.verification === 'In Transit'
                                  ? 'in-transit'
                                  : 'pending'
                              }`}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '14px' }}
                                aria-hidden="true"
                              >
                                {mov.verification === 'Completed'
                                  ? 'check_circle'
                                  : mov.verification === 'In Transit'
                                  ? 'local_shipping'
                                  : 'pending'}
                              </span>
                              <span>{mov.verification}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right Summary Column */}
          <div className="amx-transfer-right-col">
            <aside className="amx-transfer-summary-card" aria-label="Transfer Summary">
              <h3 className="amx-summary-card-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  summarize
                </span>
                <span>Transfer Summary</span>
              </h3>

              <div className="amx-summary-flow-box">
                {/* Asset */}
                <div className="amx-summary-flow-item">
                  <span className="amx-flow-item-label">Asset</span>
                  <span className="amx-flow-item-val">{asset.name} ({asset.id})</span>
                </div>

                <div className="amx-flow-divider">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    arrow_downward
                  </span>
                </div>

                {/* Locations */}
                <div className="amx-summary-flow-item">
                  <span className="amx-flow-item-label">Current Location</span>
                  <span className="amx-flow-item-val">{asset.assignedLocation}</span>
                </div>

                <div className="amx-summary-flow-item">
                  <span className="amx-flow-item-label">New Location</span>
                  <span className={`amx-flow-item-val ${!formData.destinationLocation ? 'unselected' : ''}`}>
                    {formData.destinationLocation || 'Select Destination'}
                  </span>
                </div>

                <div className="amx-flow-divider">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    arrow_downward
                  </span>
                </div>

                {/* Custodians */}
                <div className="amx-summary-flow-item">
                  <span className="amx-flow-item-label">Current Custodian</span>
                  <span className="amx-flow-item-val">{asset.custody.assignedCustodian}</span>
                </div>

                <div className="amx-summary-flow-item">
                  <span className="amx-flow-item-label">New Custodian</span>
                  <span className={`amx-flow-item-val ${!formData.newCustodian ? 'unselected' : ''}`}>
                    {formData.newCustodian || 'Select Custodian'}
                  </span>
                </div>
              </div>

              <div className="amx-summary-actions">
                <button
                  type="submit"
                  className="amx-btn-submit-transfer"
                  disabled={isSubmitting || isTransferBlocked}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    swap_horiz
                  </span>
                  <span>{isSubmitting ? 'Submitting...' : 'Initiate Transfer'}</span>
                </button>
              </div>

              <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
                Review details carefully. Custodial liability transfers upon confirmed checkpoint dispatch.
              </p>
            </aside>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AssetTransferPage;
