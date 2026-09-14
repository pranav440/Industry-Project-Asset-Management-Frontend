import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AssetStatusBadge } from '../components/AssetStatusBadge';
import { getAsset, type AssetApiError } from '../api/assetApi';
import type { AssetDetailsData } from '../data/assetDetailsData';
import './AssetDetails.css';

interface AssetDetailsPageProps {
  assetId?: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const AssetDetailsPage: React.FC<AssetDetailsPageProps> = ({
  assetId = 'AST-NC-2026-0012',
  onNavigate,
  onSignOut,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [asset, setAsset] = useState<AssetDetailsData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setAsset(null);
    setApiError(null);
    getAsset(assetId)
      .then((record) => {
        if (!active) return;
        setAsset({
          id: record.asset_id,
          name: record.name,
          status: record.status,
          category: record.category,
          specification: record.specification || 'Not available',
          serialNumber: record.serial_number || 'Not available',
          assignedCustodianDepartment: record.custodian,
          assignedCustodianName: 'Not available',
          assignedLocation: record.location,
          assignedSubLocation: 'Not available',
          warrantyStatus: record.warranty_period,
          warrantyCover: 'Not available',
          lifecycleStageText: 'Not available',
          estimatedEndOfLife: 'Not available',
          qrVerifiedText: 'Backend generated',
          qrExplanation: `Backend QR association: ${record.qr_code_value}`,
          lifecycleStages: [],
          acquisition: {
            purchaseDate: record.purchase_date,
            vendorName: record.vendor_name,
            invoiceReference: record.invoice_reference || 'Not available',
            poNumber: 'Not available',
            totalCost: record.total_cost,
            warrantyPeriod: record.warranty_period,
            configuredDepreciation: record.depreciation || 'Not available',
          },
          custody: {
            assignedCustodian: record.custodian,
            department: 'Not available',
            assignedLocation: record.location,
            allocationDate: record.allocation_date || 'Not available',
            designatedUser: 'Not available',
            accountabilityStatus: 'Not available',
          },
          movementHistory: [],
          maintenanceHistory: [],
          auditHistory: [],
          qrCodeDataUrl: record.qr_code_data_url,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = (error as AssetApiError).status;
        setApiError(status === 401 ? 'Your session has expired. Please sign in again.' : status === 403 ? 'Admin access is required to view assets.' : status === 404 ? 'Asset not found.' : error instanceof Error ? error.message : 'Unable to load asset.');
      });
    return () => {
      active = false;
    };
  }, [assetId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleCopyId = () => {
    if (!asset) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(asset.id);
    }
    showToast(`Asset ID ${asset.id} copied to clipboard.`);
  };

  if (!asset) {
    return <div role={apiError ? 'alert' : 'status'}>{apiError || 'Loading asset...'}</div>;
  }

  const handleNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      onNavigate?.('dashboard');
    } else if (subRoute === 'assets') {
      onNavigate?.('assets');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} module — Scheduled for future backend integration.`);
      onNavigate?.(subRoute);
    }
  };

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

      <div className="amx-asset-details-container">
        {/* Breadcrumb & Page Top Bar */}
        <div className="amx-details-top-bar">
          <div className="amx-details-title-col">
            <nav className="amx-breadcrumb-nav" aria-label="Breadcrumb">
              <button
                type="button"
                className="amx-back-link"
                onClick={() => onNavigate?.('assets')}
                aria-label="Back to Assets Inventory"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                  arrow_back
                </span>
                <span>Back to Assets</span>
              </button>
              <span className="amx-breadcrumb-separator" aria-hidden="true">/</span>
              <span className="amx-breadcrumb-current">Asset Details</span>
              <span className="amx-breadcrumb-separator" aria-hidden="true">/</span>
              <span className="amx-breadcrumb-id">{asset.id}</span>
            </nav>
            <p className="amx-details-subtitle">
              Detailed information, lifecycle history, and accountability for this asset.
            </p>
          </div>

          {/* Admin Action Buttons */}
          <div className="amx-details-actions">
            <button
              type="button"
              className="amx-action-btn-secondary"
              onClick={() => onNavigate?.(`assets/${asset.id}/transfer`)}
              aria-label="Initiate Transfer"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                swap_horiz
              </span>
              <span>Initiate Transfer</span>
            </button>
            <button
              type="button"
              className="amx-action-btn-secondary"
              onClick={() => showToast(`Reassign Custodian for ${asset.id} — Future module workflow.`)}
              aria-label="Reassign Custodian"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                person_outline
              </span>
              <span>Reassign Custodian</span>
            </button>
            <button
              type="button"
              className="amx-action-btn-primary"
              onClick={() => showToast(`Edit Asset details for ${asset.id} — Future module workflow.`)}
              aria-label="Edit Asset"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                edit
              </span>
              <span>Edit Asset</span>
            </button>
          </div>
        </div>

        {/* 1. Asset Summary & QR Identification Grid */}
        <div className="amx-summary-grid">
          {/* Main Asset Summary Card */}
          <div className="amx-details-card">
            <div className="amx-summary-header">
              <div>
                <div className="amx-summary-title-wrap">
                  <h2 className="amx-summary-asset-name">{asset.name}</h2>
                  <AssetStatusBadge status={asset.status} />
                </div>
                <div className="amx-summary-id-row">
                  <span>{asset.id}</span>
                  <button
                    type="button"
                    className="amx-copy-btn"
                    onClick={handleCopyId}
                    title="Copy Asset ID"
                    aria-label="Copy Asset ID"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                      content_copy
                    </span>
                  </button>
                </div>
              </div>
              <div className="amx-summary-lifecycle-badge">
                <span className="amx-lifecycle-badge-label">Lifecycle Stage</span>
                <span className="amx-lifecycle-badge-value">{asset.lifecycleStageText}</span>
              </div>
            </div>

            {/* Specs Grid */}
            <div className="amx-summary-specs-grid">
              <div className="amx-spec-box">
                <span className="amx-spec-label">Category</span>
                <span className="amx-spec-val">{asset.category}</span>
              </div>
              <div className="amx-spec-box">
                <span className="amx-spec-label">Specification / Sub-category</span>
                <span className="amx-spec-val">{asset.specification}</span>
              </div>
              <div className="amx-spec-box">
                <span className="amx-spec-label">Hardware Serial No.</span>
                <span className="amx-spec-val mono">{asset.serialNumber}</span>
              </div>
              <div className="amx-spec-box">
                <span className="amx-spec-label">Assigned Custodian</span>
                <span className="amx-spec-val">{asset.assignedCustodianDepartment}</span>
                <span className="amx-spec-sub">{asset.assignedCustodianName}</span>
              </div>
              <div className="amx-spec-box">
                <span className="amx-spec-label">Assigned Location</span>
                <span className="amx-spec-val">{asset.assignedLocation}</span>
                <span className="amx-spec-sub">{asset.assignedSubLocation}</span>
              </div>
              <div className="amx-spec-box">
                <span className="amx-spec-label">Warranty Status</span>
                <span className="amx-spec-val success">{asset.warrantyStatus}</span>
                <span className="amx-spec-sub">{asset.warrantyCover}</span>
              </div>
            </div>
          </div>

          {/* QR Identification Card */}
          <div className="amx-details-card amx-qr-card">
            <div className="amx-qr-header">
              <span className="amx-qr-title">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#06B6D4' }} aria-hidden="true">
                  qr_code_2
                </span>
                Asset QR Tag
              </span>
              <span className="amx-qr-status-pill">
                <span className="amx-qr-dot" aria-hidden="true" />
                {asset.qrVerifiedText}
              </span>
            </div>

            <div className="amx-qr-svg-wrap">
              <img
                src={asset.qrCodeDataUrl}
                style={{ width: '130px', height: '130px' }}
                alt={`QR Code for ${asset.id}`}
              />
            </div>

            <p className="amx-qr-id-text">{asset.id}</p>
            <p className="amx-qr-desc">{asset.qrExplanation}</p>
          </div>
        </div>

        {/* 2. Asset Lifecycle Stage Stepper */}
        <div className="amx-details-card">
          <div className="amx-lifecycle-header">
            <h3 className="amx-card-heading">Asset Lifecycle Stage</h3>
            <span className="amx-card-meta-text">Estimated End of Life: {asset.estimatedEndOfLife}</span>
          </div>

          <div className="amx-lifecycle-stepper-grid">
            {asset.lifecycleStages.map((stage) => (
              <div
                key={stage.step}
                className={`amx-step-card ${stage.statusType}`}
              >
                <div>
                  <div className="amx-step-top">
                    <span className={`amx-step-circle ${stage.statusType}`}>
                      {stage.statusType === 'completed' ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                          check
                        </span>
                      ) : (
                        stage.step
                      )}
                    </span>
                    <span className={`amx-step-status-tag ${stage.statusType}`}>
                      {stage.statusLabel}
                    </span>
                  </div>
                  <h4 className="amx-step-title">{stage.name}</h4>
                  <p className="amx-step-desc">{stage.subtitle}</p>
                </div>
                <p className="amx-step-date">{stage.dateLabel}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Acquisition & Financials AND Custody & Current Location */}
        <div className="amx-details-row-2">
          {/* Card A: Acquisition Details */}
          <div className="amx-details-card">
            <div className="amx-card-header-bar">
              <h3 className="amx-card-heading">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0891B2' }} aria-hidden="true">
                  receipt_long
                </span>
                Acquisition & Financials
              </h3>
              <span className="amx-td-mono" style={{ fontSize: '12px' }}>{asset.acquisition.poNumber}</span>
            </div>

            <div className="amx-2col-fields-grid">
              <div className="amx-field-group">
                <span className="amx-field-label">Purchase Date</span>
                <span className="amx-field-value">{asset.acquisition.purchaseDate}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Vendor Name</span>
                <span className="amx-field-value">{asset.acquisition.vendorName}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Invoice / Reference</span>
                <span className="amx-field-value mono">{asset.acquisition.invoiceReference}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Total Cost</span>
                <span className="amx-field-value mono">{asset.acquisition.totalCost}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Warranty Period</span>
                <span className="amx-field-value">{asset.acquisition.warrantyPeriod}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Configured Depreciation</span>
                <span className="amx-field-value">{asset.acquisition.configuredDepreciation}</span>
              </div>
            </div>
          </div>

          {/* Card B: Custody & Location Details */}
          <div className="amx-details-card">
            <div className="amx-card-header-bar">
              <h3 className="amx-card-heading">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0891B2' }} aria-hidden="true">
                  badge
                </span>
                Custody & Current Location
              </h3>
            </div>

            <div className="amx-2col-fields-grid">
              <div className="amx-field-group">
                <span className="amx-field-label">Assigned Custodian</span>
                <span className="amx-field-value">{asset.custody.assignedCustodian}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Department</span>
                <span className="amx-field-value">{asset.custody.department}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Assigned Location</span>
                <span className="amx-field-value">{asset.custody.assignedLocation}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Allocation Date</span>
                <span className="amx-field-value">{asset.custody.allocationDate}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Designated User</span>
                <span className="amx-field-value">{asset.custody.designatedUser}</span>
              </div>
              <div className="amx-field-group">
                <span className="amx-field-label">Accountability Status</span>
                <span className="amx-accountability-badge">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                    verified
                  </span>
                  {asset.custody.accountabilityStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Movement History Table */}
        <div className="amx-details-table-card">
          <div className="amx-table-top-bar">
            <div className="amx-table-top-title-area">
              <h3 className="amx-card-heading">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0891B2' }} aria-hidden="true">
                  swap_horiz
                </span>
                Movement History
              </h3>
              <p className="amx-table-top-desc">Audit trail of physical relocations and custodian handovers with QR verification.</p>
            </div>
            <button
              type="button"
              className="amx-table-action-sm-btn secondary"
              onClick={() => showToast('Filter Trail options — Future filter parameters.')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                filter_list
              </span>
              <span>Filter Trail</span>
            </button>
          </div>

          <div className="amx-details-table-wrapper">
            <table className="amx-details-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Movement Type</th>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Custodian</th>
                  <th scope="col">Verification</th>
                </tr>
              </thead>
              <tbody>
                {asset.movementHistory.map((mov) => (
                  <tr key={mov.id}>
                    <td className="amx-td-mono">{mov.date}</td>
                    <td className="amx-td-semibold">{mov.movementType}</td>
                    <td className="amx-td-muted">{mov.from}</td>
                    <td className="amx-td-semibold">{mov.to}</td>
                    <td className="amx-td-muted">{mov.custodian}</td>
                    <td>
                      <span className="amx-qr-verified-tag">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                          check_circle
                        </span>
                        {mov.verification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Maintenance History Table */}
        <div className="amx-details-table-card">
          <div className="amx-table-top-bar">
            <div className="amx-table-top-title-area">
              <h3 className="amx-card-heading">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0891B2' }} aria-hidden="true">
                  build
                </span>
                Maintenance History
              </h3>
              <p className="amx-table-top-desc">Log of scheduled servicing, repairs, and vendor warranties.</p>
            </div>
            <button
              type="button"
              className="amx-table-action-sm-btn primary"
              onClick={() => showToast('Log Service Event workflow — Future maintenance module.')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                add
              </span>
              <span>Log Service Event</span>
            </button>
          </div>

          <div className="amx-details-table-wrapper">
            <table className="amx-details-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Service / Event</th>
                  <th scope="col">Vendor</th>
                  <th scope="col">Cost</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {asset.maintenanceHistory.map((mnt) => (
                  <tr key={mnt.id}>
                    <td className="amx-td-mono">{mnt.date}</td>
                    <td className="amx-td-semibold">{mnt.serviceEvent}</td>
                    <td className="amx-td-muted">{mnt.vendor}</td>
                    <td className="amx-td-mono">{mnt.cost}</td>
                    <td>
                      {mnt.status === 'Completed' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#D1FAE5',
                            color: '#059669',
                          }}
                        >
                          Completed
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#F1F5F9',
                            color: '#45464d',
                            border: '1px solid #c6c6cd',
                          }}
                        >
                          Scheduled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Audit History Log */}
        <div className="amx-audit-table-card">
          <div className="amx-card-header-bar">
            <div>
              <h3 className="amx-card-heading">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0891B2' }} aria-hidden="true">
                  history_edu
                </span>
                Audit History
              </h3>
              <p className="amx-table-top-desc" style={{ marginTop: '3px' }}>Chronological audit log and system activity records.</p>
            </div>
            <span className="amx-td-mono" style={{ fontSize: '12px' }}>
              {asset.auditHistory.length} Records
            </span>
          </div>

          <div className="amx-details-table-wrapper">
            <table className="amx-details-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date & Time</th>
                  <th scope="col">Performed By</th>
                </tr>
              </thead>
              <tbody>
                {asset.auditHistory.map((audit) => (
                  <tr key={audit.id}>
                    <td>
                      <div className="amx-audit-event-cell">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '16px', color: audit.iconColor || '#0891B2' }}
                          aria-hidden="true"
                        >
                          {audit.icon}
                        </span>
                        <span>{audit.event}</span>
                      </div>
                    </td>
                    <td className="amx-td-mono">{audit.dateTime}</td>
                    <td className="amx-td-muted">{audit.performedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AssetDetailsPage;
