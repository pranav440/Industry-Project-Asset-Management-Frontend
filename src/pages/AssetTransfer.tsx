import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AssetStatusBadge } from '../components/AssetStatusBadge';
import { getAsset, type AssetApiError } from '../api/assetApi';
import { ASSET_DETAILS_MOCK_DATA, DEFAULT_ASSET_DETAILS_DATA, type AssetDetailsData } from '../data/assetDetailsData';
import { ASSET_FILTER_OPTIONS } from '../data/assetsData';
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
}

interface FormErrors {
  destinationLocation?: string;
  newCustodian?: string;
}

export const AssetTransferPage: React.FC<AssetTransferPageProps> = ({
  assetId = 'AST-NC-2026-0012',
  onNavigate,
  onSignOut,
}) => {
  const [asset, setAsset] = useState<AssetDetailsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<TransferFormState>({
    destinationLocation: '',
    newCustodian: '',
    transferReason: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    assetId: string;
    destination: string;
    newCustodian: string;
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setApiError(null);

    getAsset(assetId)
      .then((record) => {
        if (!active) return;
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
          assignedSubLocation: 'Not available',
          warrantyStatus: record.warranty_period,
          warrantyCover: 'Not available',
          lifecycleStageText: 'Active Assignment',
          estimatedEndOfLife: 'Not available',
          qrVerifiedText: 'Backend generated',
          qrExplanation: `QR Association: ${record.qr_code_value}`,
          lifecycleStages: [],
          acquisition: {
            purchaseDate: record.purchase_date,
            vendorName: record.vendor_name,
            invoiceReference: record.invoice_reference || '',
            poNumber: '',
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
            accountabilityStatus: 'Active',
          },
          movementHistory: [],
          maintenanceHistory: [],
          auditHistory: [],
          qrCodeDataUrl: record.qr_code_data_url,
        });
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        // Fallback to local mock data if exists or default
        const mockFallback = ASSET_DETAILS_MOCK_DATA[assetId] || {
          ...DEFAULT_ASSET_DETAILS_DATA,
          id: assetId,
        };
        if (mockFallback) {
          setAsset(mockFallback);
          setLoading(false);
        } else {
          const status = (error as AssetApiError)?.status;
          setApiError(
            status === 401
              ? 'Your session has expired. Please sign in again.'
              : status === 403
              ? 'Admin access is required.'
              : status === 404
              ? 'Asset not found.'
              : 'Unable to load asset information.'
          );
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [assetId]);

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
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleInitiateClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Please select all required transfer fields.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    setSuccessInfo({
      assetId: asset?.id || assetId,
      destination: formData.destinationLocation,
      newCustodian: formData.newCustodian,
    });
    showToast('Asset transfer initiated successfully.');
  };

  const locationOptions = [
    { value: 'HQ - Floor 4, Dev Pod 4B', label: 'HQ - Floor 4, Dev Pod 4B' },
    { value: 'HQ - Floor 2, Design Wing', label: 'HQ - Floor 2, Design Wing' },
    { value: 'HQ - Data Center Basement B1', label: 'HQ - Data Center Basement B1' },
    { value: 'Regional Annex - West Wing Labs', label: 'Regional Annex - West Wing Labs' },
    { value: 'Distribution Facility - Bay 12', label: 'Distribution Facility - Bay 12' },
    { value: 'Warehouse Storage - Zone A', label: 'Warehouse Storage - Zone A' },
    ...ASSET_FILTER_OPTIONS.locations.filter((l) => l.value !== ''),
  ];

  const custodianOptions = [
    { value: 'Marcus Vance (EMP-0941) — IT Systems', label: 'Marcus Vance (EMP-0941) — IT Systems' },
    { value: 'Elena Rostova (EMP-1102) — DevOps', label: 'Elena Rostova (EMP-1102) — DevOps' },
    { value: 'Devin Cole (EMP-0419) — Product Lead', label: 'Devin Cole (EMP-0419) — Product Lead' },
    { value: 'Sarah Jenkins (EMP-0312) — Facilities', label: 'Sarah Jenkins (EMP-0312) — Facilities' },
    { value: 'Central Inventory Pool (Unassigned)', label: 'Central Inventory Pool (Unassigned)' },
    ...ASSET_FILTER_OPTIONS.custodians.filter((c) => c.value !== ''),
  ];

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
      <DashboardLayout currentNav="Assets" onNavigate={handleNav} onSignOut={onSignOut}>
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          Loading asset information for transfer...
        </div>
      </DashboardLayout>
    );
  }

  if (apiError || !asset) {
    return (
      <DashboardLayout currentNav="Assets" onNavigate={handleNav} onSignOut={onSignOut}>
        <div role="alert" style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
          {apiError || 'Asset not found.'}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      currentNav="Assets"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(q) => showToast(`Search query: ${q}`)}
      searchPlaceholder="Search assets..."
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Printer Ink (Cyan) expires today; Stationery low stock.')
      }
      onHelpClick={() => showToast('AssetMX Enterprise Help Center & User Manual.')}
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="amx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirmTransferModalTitle">
          <div className="amx-confirm-modal">
            <div className="amx-modal-header">
              <h3 id="confirmTransferModalTitle" className="amx-modal-title">
                Review & Confirm Transfer
              </h3>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setShowConfirmModal(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="amx-modal-body">
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
              >
                Cancel
              </button>
              <button
                type="button"
                className="amx-transfer-btn-primary"
                onClick={handleConfirmSubmit}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  check_circle
                </span>
                <span>Confirm Transfer</span>
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
            aria-label="Back to Asset Details"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
              arrow_back
            </span>
            <span>Asset Details ({asset.id})</span>
          </button>
          <span className="amx-transfer-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="amx-transfer-breadcrumb-curr">Initiate Transfer</span>
        </nav>

        {/* Success State Banner */}
        {successInfo && (
          <div className="amx-transfer-success-banner" role="alert">
            <div className="amx-transfer-success-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                verified
              </span>
            </div>
            <div className="amx-transfer-success-content">
              <h3 className="amx-transfer-success-title">Transfer Initiated</h3>
              <p className="amx-transfer-success-desc">
                Asset transfer request has been successfully recorded. Movement authorization is active.
              </p>
              <div className="amx-transfer-success-details">
                <span><strong>Asset ID:</strong> {successInfo.assetId}</span>
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
                  Back to Assets
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
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                swap_horiz
              </span>
              <span>Initiate Transfer</span>
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
                    <span className="material-symbols-outlined">inventory_2</span>
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
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8' }}>
                      lock
                    </span>
                  </div>
                </div>

                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Asset Name</label>
                  <div className="amx-transfer-readonly-box">
                    <span>{asset.name}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8' }}>
                      lock
                    </span>
                  </div>
                </div>

                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Category</label>
                  <div className="amx-transfer-readonly-box">
                    <span>{asset.category}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8' }}>
                      lock
                    </span>
                  </div>
                </div>

                <div className="amx-transfer-form-group">
                  <label className="amx-transfer-label">Current Status</label>
                  <div className="amx-transfer-readonly-box" style={{ padding: '6px 12px' }}>
                    <AssetStatusBadge status={asset.status} />
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8' }}>
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
                    <span className="material-symbols-outlined">badge</span>
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
                    <span className="material-symbols-outlined">move_up</span>
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
                  >
                    <option value="">Select Destination Location</option>
                    {locationOptions.map((loc, idx) => (
                      <option key={`${loc.value}-${idx}`} value={loc.value}>
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
                  >
                    <option value="">Select New Custodian</option>
                    {custodianOptions.map((cust, idx) => (
                      <option key={`${cust.value}-${idx}`} value={cust.value}>
                        {cust.label}
                      </option>
                    ))}
                  </select>
                  {errors.newCustodian && (
                    <span className="amx-transfer-field-error">{errors.newCustodian}</span>
                  )}
                </div>

                <div className="amx-transfer-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="amx-transfer-label" htmlFor="transferReasonInput">
                    Transfer Reason / Operational Justification
                  </label>
                  <textarea
                    id="transferReasonInput"
                    className="amx-transfer-textarea"
                    placeholder="Provide justification or project reallocation notes (optional)..."
                    value={formData.transferReason}
                    onChange={(e) => handleInputChange('transferReason', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Section 4: Movement Information */}
            <section className="amx-transfer-card" aria-labelledby="secMovementInfoTitle">
              <div className="amx-transfer-card-header">
                <div className="amx-transfer-card-title-wrap">
                  <div className="amx-transfer-card-icon">
                    <span className="material-symbols-outlined">schedule</span>
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
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    history_toggle_off
                  </span>
                  <span>Auto-recorded upon confirmation</span>
                </div>
              </div>

              {/* Informational QR Callout */}
              <div className="amx-transfer-qr-note">
                <span className="material-symbols-outlined amx-transfer-qr-note-icon">
                  qr_code_scanner
                </span>
                <div>
                  <h4 className="amx-transfer-qr-note-title">Transit Verification Notice</h4>
                  <p className="amx-transfer-qr-note-text">
                    QR-based movement validation is performed during applicable transit checkpoints.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Summary Column */}
          <div className="amx-transfer-right-col">
            <aside className="amx-transfer-summary-card" aria-label="Transfer Summary">
              <h3 className="amx-summary-card-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--amx-dash-secondary)' }}>
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
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
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
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
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
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    swap_horiz
                  </span>
                  <span>Initiate Transfer</span>
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
