import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AssetStatusBadge } from '../components/AssetStatusBadge';
import {
  getAsset,
  updateAsset,
  getAssetValuations,
  recordAssetValuation,
  type AssetApiError,
  type AssetMovementRecord,
  type MaintenanceHistoryApiRecord,
  type AuditLogApiRecord,
  type AssetValuationApiRecord,
  type AssetValuationSummaryApiRecord,
} from '../api/assetApi';
import { type AssetDetailsData, type LifecycleStage, type AuditHistoryRecord, ASSET_DETAILS_MOCK_DATA, DEFAULT_ASSET_DETAILS_DATA } from '../data/assetDetailsData';
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
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    category: '',
    specification: '',
    location: '',
    custodian: '',
    purchaseDate: '',
    vendorName: '',
    totalCost: '',
    warrantyPeriod: '',
    serialNumber: '',
  });
  const [saving, setSaving] = useState(false);

  const formatDisplayDate = (val: string | null | undefined): string => {
    if (!val) return 'Not available';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getAuditIconAndColor = (action: string): { icon: string; iconColor: string } => {
    const act = action.toLowerCase();
    if (act.includes('created') || act.includes('registered')) {
      return { icon: 'verified_user', iconColor: '#059669' };
    }
    if (act.includes('transfer') || act.includes('movement')) {
      return { icon: 'swap_horiz', iconColor: '#0284c7' };
    }
    if (act.includes('maintenance') || act.includes('service')) {
      return { icon: 'build', iconColor: '#d97706' };
    }
    if (act.includes('dispos')) {
      return { icon: 'delete_outline', iconColor: '#dc2626' };
    }
    return { icon: 'edit_note', iconColor: '#0891b2' };
  };

  const computeLifecycleStages = (
    status: string,
    purchaseDate: string,
    allocationDate: string | null
  ): LifecycleStage[] => {
    const isDisposed = status === 'Disposed';
    const isInMaintenance = status === 'In Maintenance';
    const isInTransit = status === 'In Transit';

    return [
      {
        step: 1,
        name: '1. Allocation & Onboarding',
        subtitle: 'Procured, barcoded & cataloged in inventory',
        statusLabel: 'Completed',
        statusType: 'completed',
        dateLabel: formatDisplayDate(allocationDate || purchaseDate),
      },
      {
        step: 2,
        name: '2. Active Deployment',
        subtitle: isInTransit
          ? 'Currently in physical transit between hubs'
          : isDisposed
          ? 'Completed deployment cycle'
          : 'In active deployment & custodian possession',
        statusLabel: isInTransit ? 'In Transit' : isDisposed ? 'Completed' : 'Current Stage',
        statusType: isInTransit ? 'current' : isDisposed ? 'completed' : 'current',
        dateLabel: `Since ${formatDisplayDate(allocationDate || purchaseDate)}`,
      },
      {
        step: 3,
        name: '3. Maintenance & Servicing',
        subtitle: isInMaintenance
          ? 'Under active service and diagnosis'
          : 'Periodic preventive & corrective maintenance',
        statusLabel: isInMaintenance ? 'Active Service' : 'Scheduled',
        statusType: isInMaintenance ? 'current' : 'scheduled',
        dateLabel: isInMaintenance ? 'In Progress' : 'Routine',
      },
      {
        step: 4,
        name: '4. Disposal & Decommission',
        subtitle: isDisposed
          ? 'Asset decommissioned and archived'
          : 'E-waste recycling / certified vendor buyback',
        statusLabel: isDisposed ? 'Disposed' : 'Pending',
        statusType: isDisposed ? 'completed' : 'pending',
        dateLabel: isDisposed ? 'Decommissioned' : 'End of Lifecycle',
      },
    ];
  };

  const mapAssetRecord = (record: Awaited<ReturnType<typeof getAsset>>): AssetDetailsData => ({
    id: record.asset_id,
    name: record.name,
    status: record.status,
    category: record.category,
    specification: record.specification || 'Not available',
    serialNumber: record.serial_number || 'Not available',
    assignedCustodianDepartment: record.custodian,
    assignedCustodianName: record.custodian,
    assignedLocation: record.location,
    assignedSubLocation: 'Floor Unit',
    warrantyStatus: record.warranty_period,
    warrantyCover: record.warranty_period.toLowerCase().includes('year') ? 'Manufacturer Warranty' : 'Standard Cover',
    lifecycleStageText: `Stage ${record.status === 'Disposed' ? '4: Disposed' : record.status === 'In Maintenance' ? '3: Maintenance' : record.status === 'In Transit' ? '2: In Transit' : '2: Active Usage'}`,
    estimatedEndOfLife: record.warranty_period ? 'Active Warranty Period' : 'Not available',
    qrVerifiedText: 'Verified & Active',
    qrExplanation: `Asset Tag Value: ${record.qr_code_value}`,
    lifecycleStages: computeLifecycleStages(record.status, record.purchase_date, record.allocation_date),
    acquisition: {
      purchaseDate: formatDisplayDate(record.purchase_date),
      vendorName: record.vendor_name,
      invoiceReference: record.invoice_reference || 'Not available',
      poNumber: record.invoice_reference || 'PO-DIRECT',
      totalCost: record.total_cost.startsWith('₹') ? record.total_cost : `₹${record.total_cost}`,
      warrantyPeriod: record.warranty_period,
      configuredDepreciation: record.depreciation || 'Standard Linear (10%/yr)',
    },
    custody: {
      assignedCustodian: record.custodian,
      department: record.custodian,
      assignedLocation: record.location,
      allocationDate: formatDisplayDate(record.allocation_date || record.purchase_date),
      designatedUser: record.custodian,
      accountabilityStatus: 'Verified Active',
    },
    movementHistory: (record.movement_history || []).map((movement: AssetMovementRecord) => ({
      id: movement.movement_id,
      date: formatDisplayDate(movement.initiated_at),
      movementType: 'Transfer',
      from: movement.from_location,
      to: movement.to_location,
      custodian: movement.to_custodian,
      verification: movement.status,
    })),
    maintenanceHistory: (record.maintenance_history || []).map((mnt: MaintenanceHistoryApiRecord) => ({
      id: mnt.id,
      date: mnt.date,
      serviceEvent: mnt.serviceEvent,
      vendor: mnt.vendor,
      cost: mnt.cost.startsWith('₹') ? mnt.cost : `₹${mnt.cost}`,
      status: mnt.status as 'Completed' | 'Scheduled' | 'In Progress',
    })),
    auditHistory: (record.audit_history || []).map((audit: AuditLogApiRecord): AuditHistoryRecord => {
      const { icon, iconColor } = getAuditIconAndColor(audit.action);
      return {
        id: String(audit.id),
        event: audit.action,
        icon,
        iconColor,
        dateTime: audit.occurred_at
          ? new Date(audit.occurred_at).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Recorded',
        performedBy: audit.actor_user_id ? `User #${audit.actor_user_id}` : 'System Admin',
      };
    }),
    qrCodeDataUrl: record.qr_code_data_url,
  });

  useEffect(() => {
    let active = true;
    setAsset(null);
    setApiError(null);
    setIsEditing(false);
    getAsset(assetId)
      .then((record) => {
        if (!active) return;
        const mapped = mapAssetRecord(record);
        setAsset(mapped);
        setFormState({
          name: mapped.name,
          category: mapped.category,
          specification: mapped.specification === 'Not available' ? '' : mapped.specification,
          location: mapped.assignedLocation,
          custodian: mapped.assignedCustodianDepartment,
          purchaseDate: record.purchase_date,
          vendorName: mapped.acquisition.vendorName,
          totalCost: record.total_cost,
          warrantyPeriod: mapped.acquisition.warrantyPeriod,
          serialNumber: mapped.serialNumber === 'Not available' ? '' : mapped.serialNumber,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallback = ASSET_DETAILS_MOCK_DATA[assetId] || DEFAULT_ASSET_DETAILS_DATA;
        if (fallback) {
          setAsset(fallback);
          setFormState({
            name: fallback.name,
            category: fallback.category,
            specification: fallback.specification === 'Not available' ? '' : fallback.specification,
            location: fallback.assignedLocation,
            custodian: fallback.assignedCustodianDepartment,
            purchaseDate: fallback.acquisition.purchaseDate,
            vendorName: fallback.acquisition.vendorName,
            totalCost: fallback.acquisition.totalCost,
            warrantyPeriod: fallback.acquisition.warrantyPeriod,
            serialNumber: fallback.serialNumber === 'Not available' ? '' : fallback.serialNumber,
          });
          return;
        }
        const status = (error as AssetApiError).status;
        setApiError(status === 401 ? 'Your session has expired. Please sign in again.' : status === 403 ? 'Admin access is required to view assets.' : status === 404 ? 'Asset not found.' : error instanceof Error ? error.message : 'Unable to load asset.');
      });
    return () => {
      active = false;
    };
  }, [assetId]);

  // Valuation & Depreciation State
  const [valuationLedger, setValuationLedger] = useState<AssetValuationApiRecord[]>([]);
  const [valuationSummary, setValuationSummary] = useState<AssetValuationSummaryApiRecord | null>(null);
  const [isLoadingValuations, setIsLoadingValuations] = useState(false);
  const [valuationError, setValuationError] = useState<string | null>(null);
  const [isSubmittingValuation, setIsSubmittingValuation] = useState(false);
  const [isValModalOpen, setIsValModalOpen] = useState(false);
  const [valModalStep, setValModalStep] = useState<'form' | 'review'>('form');
  const [valForm, setValForm] = useState({
    effectiveDate: '',
    previousValue: '',
    newRecordedValue: '',
    formulaUsed: '',
    notes: '',
    reference: '',
  });
  const [valErrors, setValErrors] = useState<{
    effectiveDate?: string;
    newRecordedValue?: string;
    formulaUsed?: string;
    notes?: string;
  }>({});

  const loadValuations = async (targetId: string) => {
    setIsLoadingValuations(true);
    setValuationError(null);
    try {
      const data = await getAssetValuations(targetId);
      setValuationLedger(data.items || []);
      setValuationSummary(data.summary || null);
    } catch (err: unknown) {
      console.error('Failed to load asset valuation history', err);
      setValuationError(err instanceof Error ? err.message : 'Failed to load valuation ledger');
      setValuationLedger([]);
      setValuationSummary(null);
    } finally {
      setIsLoadingValuations(false);
    }
  };

  useEffect(() => {
    if (assetId) {
      loadValuations(assetId);
    }
  }, [assetId]);

  const parseCurrencyNumber = (val: string | number | undefined | null): number | null => {
    if (val === undefined || val === null) return null;
    const cleaned = String(val).replace(/[^0-9.-]+/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const formatCurrency = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === '') return 'Not recorded';
    const num = typeof val === 'number' ? val : parseCurrencyNumber(val);
    if (num === null) return String(val);
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const originalAcquisitionCost =
    valuationSummary?.originalAcquisitionCost || asset?.acquisition?.totalCost || 'Not recorded';
  const currentRecordedValue =
    valuationSummary?.currentRecordedValue || (
      valuationLedger.length > 0
        ? formatCurrency(valuationLedger[0].newRecordedValue)
        : (asset?.acquisition?.totalCost || 'Not recorded')
    );
  const lastValuationUpdate =
    valuationSummary?.lastValuationUpdate
      ? formatDisplayDate(valuationSummary.lastValuationUpdate)
      : (
        valuationLedger.length > 0
          ? formatDisplayDate(valuationLedger[0].effectiveDate)
          : 'Not recorded'
      );
  const configuredDepreciationFormula = asset?.acquisition?.configuredDepreciation || 'Not recorded';

  const handleOpenValModal = () => {
    const prevVal = currentRecordedValue;
    setValForm({
      effectiveDate: new Date().toISOString().split('T')[0],
      previousValue: prevVal !== 'Not recorded' ? prevVal : 'Not recorded',
      newRecordedValue: '',
      formulaUsed: configuredDepreciationFormula !== 'Not recorded' ? configuredDepreciationFormula : '',
      notes: '',
      reference: '',
    });
    setValErrors({});
    setValModalStep('form');
    setIsValModalOpen(true);
  };

  const handleReviewValuation = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof valErrors = {};

    if (!valForm.effectiveDate.trim()) {
      errors.effectiveDate = 'Effective Date is required';
    }

    const parsedNew = parseCurrencyNumber(valForm.newRecordedValue);
    if (!valForm.newRecordedValue.trim()) {
      errors.newRecordedValue = 'New Recorded Value is required';
    } else if (parsedNew === null || parsedNew < 0) {
      errors.newRecordedValue = 'New Recorded Value must be a valid non-negative number';
    }

    if (!valForm.notes.trim()) {
      errors.notes = 'Calculation Notes / Justification is required';
    }

    setValErrors(errors);
    if (Object.keys(errors).length === 0) {
      setValModalStep('review');
    }
  };

  const handleConfirmValuation = async () => {
    if (!asset) return;
    const parsedNew = parseCurrencyNumber(valForm.newRecordedValue);
    if (parsedNew === null) return;

    setIsSubmittingValuation(true);
    try {
      await recordAssetValuation(asset.id, {
        effectiveDate: valForm.effectiveDate,
        newRecordedValue: parsedNew,
        formulaUsed: valForm.formulaUsed.trim() || undefined,
        notes: valForm.notes.trim(),
        reference: valForm.reference.trim() || undefined,
      });

      await loadValuations(asset.id);
      setIsValModalOpen(false);
      showToast(`Valuation update of ${formatCurrency(parsedNew)} recorded for ${asset.id}.`);
    } catch (err: unknown) {
      console.error('Failed to record valuation update', err);
      const msg = err instanceof Error ? err.message : 'Failed to record valuation update';
      showToast(`Error: ${msg}`);
    } finally {
      setIsSubmittingValuation(false);
    }
  };

  const handleEditSave = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const result = await updateAsset(asset.id, {
        name: formState.name.trim(),
        category: formState.category.trim(),
        specification: formState.specification.trim() || undefined,
        location: formState.location.trim(),
        custodian: formState.custodian.trim(),
        purchaseDate: formState.purchaseDate,
        vendorName: formState.vendorName.trim(),
        totalCost: formState.totalCost.trim(),
        warrantyPeriod: formState.warrantyPeriod.trim(),
      });
      const mapped = mapAssetRecord(result);
      setAsset(mapped);
      setIsEditing(false);
      showToast(`Asset ${asset.id} updated successfully.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Asset update failed.');
    } finally {
      setSaving(false);
    }
  };

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
              onClick={() => setIsEditing((current) => !current)}
              aria-label="Edit Asset"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                edit
              </span>
              <span>{isEditing ? 'Cancel Edit' : 'Edit Asset'}</span>
            </button>
          </div>
        </div>

        {isEditing && (
          <div className="amx-details-card" style={{ marginBottom: '20px' }}>
            <div className="amx-card-header-bar">
              <h3 className="amx-card-heading">Edit Asset Details</h3>
            </div>
            <div className="amx-2col-fields-grid" style={{ marginTop: '16px' }}>
              <label className="amx-field-group">
                <span className="amx-field-label">Asset Name</span>
                <input value={formState.name} onChange={(e) => setFormState((current) => ({ ...current, name: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Category</span>
                <input value={formState.category} onChange={(e) => setFormState((current) => ({ ...current, category: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Specification</span>
                <input value={formState.specification} onChange={(e) => setFormState((current) => ({ ...current, specification: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Serial Number</span>
                <input value={formState.serialNumber} onChange={(e) => setFormState((current) => ({ ...current, serialNumber: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Location</span>
                <input value={formState.location} onChange={(e) => setFormState((current) => ({ ...current, location: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Custodian</span>
                <input value={formState.custodian} onChange={(e) => setFormState((current) => ({ ...current, custodian: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Purchase Date</span>
                <input type="date" value={formState.purchaseDate} onChange={(e) => setFormState((current) => ({ ...current, purchaseDate: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Vendor Name</span>
                <input value={formState.vendorName} onChange={(e) => setFormState((current) => ({ ...current, vendorName: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Total Cost</span>
                <input value={formState.totalCost} onChange={(e) => setFormState((current) => ({ ...current, totalCost: e.target.value }))} />
              </label>
              <label className="amx-field-group">
                <span className="amx-field-label">Warranty Period</span>
                <input value={formState.warrantyPeriod} onChange={(e) => setFormState((current) => ({ ...current, warrantyPeriod: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button type="button" className="amx-action-btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
              <button type="button" className="amx-action-btn-primary" onClick={handleEditSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

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
              {asset.qrCodeDataUrl ? (
                <img
                  src={asset.qrCodeDataUrl}
                  style={{ width: '130px', height: '130px' }}
                  alt={`QR Code for ${asset.id}`}
                />
              ) : (
                <div style={{ width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', border: '1px solid var(--amx-dash-border-light)', borderRadius: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '80px', color: '#0F172A' }} aria-hidden="true">
                    qr_code_2
                  </span>
                </div>
              )}
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

        {/* 3. Valuation & Depreciation Card */}
        <div className="amx-details-card amx-valuation-card">
          <div className="amx-table-top-bar" style={{ marginBottom: 0 }}>
            <div className="amx-table-top-title-area">
              <h3 className="amx-card-heading">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0891B2' }} aria-hidden="true">
                  trending_down
                </span>
                Valuation &amp; Depreciation
              </h3>
              <p className="amx-table-top-desc">Manual valuation adjustments, recorded depreciation, and immutable financial audit ledger.</p>
            </div>
            <button
              type="button"
              className="amx-table-action-sm-btn primary"
              onClick={handleOpenValModal}
              id="btn-record-valuation-update"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">
                add_chart
              </span>
              <span>Record Valuation Update</span>
            </button>
          </div>

          {/* Valuation Summary Grid */}
          <div className="amx-valuation-summary-grid">
            <div className="amx-field-group">
              <span className="amx-field-label">Original Acquisition Cost</span>
              <span className="amx-field-value mono" id="val-summary-acq-cost">{originalAcquisitionCost}</span>
            </div>
            <div className="amx-field-group">
              <span className="amx-field-label">Current Recorded Value</span>
              <span className="amx-field-value mono highlight" id="val-summary-current-value">{currentRecordedValue}</span>
            </div>
            <div className="amx-field-group">
              <span className="amx-field-label">Last Valuation Update</span>
              <span className="amx-field-value" id="val-summary-last-update">{lastValuationUpdate}</span>
            </div>
            <div className="amx-field-group">
              <span className="amx-field-label">Valuation / Depreciation Method</span>
              <span className="amx-field-value" id="val-summary-formula">{configuredDepreciationFormula}</span>
            </div>
          </div>

          {/* Valuation History Ledger */}
          <div className="amx-valuation-ledger-wrap">
            <span className="amx-valuation-ledger-title">Valuation History Ledger</span>
            <div className="amx-details-table-wrapper">
              <table className="amx-details-table" id="val-history-ledger-table">
                <thead>
                  <tr>
                    <th scope="col">Effective Date</th>
                    <th scope="col">Previous Value</th>
                    <th scope="col">New Recorded Value</th>
                    <th scope="col">Formula Used</th>
                    <th scope="col">Updated By</th>
                    <th scope="col">Recorded At</th>
                    <th scope="col">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingValuations ? (
                    <tr>
                      <td colSpan={7} className="amx-table-empty">
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--amx-dash-text-muted)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#0891B2', display: 'block', marginBottom: '6px' }}>
                            hourglass_top
                          </span>
                          Loading valuation history from ledger...
                        </div>
                      </td>
                    </tr>
                  ) : valuationError ? (
                    <tr>
                      <td colSpan={7} className="amx-table-empty">
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--amx-dash-danger, #ef4444)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>
                            error
                          </span>
                          <div>{valuationError}</div>
                          <button
                            type="button"
                            className="amx-action-btn secondary"
                            style={{ marginTop: '10px' }}
                            onClick={() => assetId && loadValuations(assetId)}
                          >
                            Retry Loading
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : valuationLedger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="amx-table-empty">
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--amx-dash-text-muted)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                            hourglass_empty
                          </span>
                          No valuation or depreciation adjustments recorded yet for this asset.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    valuationLedger.map((val) => (
                      <tr key={val.id}>
                        <td className="amx-td-mono">{formatDisplayDate(val.effectiveDate)}</td>
                        <td className="amx-td-mono">{formatCurrency(val.previousValue)}</td>
                        <td className="amx-td-mono" style={{ fontWeight: 700, color: 'var(--amx-dash-secondary)' }}>
                          {formatCurrency(val.newRecordedValue)}
                        </td>
                        <td>{val.formulaUsed || '—'}</td>
                        <td className="amx-td-muted">{val.updatedBy || 'Not recorded'}</td>
                        <td className="amx-td-mono" style={{ fontSize: '11.5px', color: 'var(--amx-dash-text-muted)' }}>
                          {val.recordedAt ? new Date(val.recordedAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : '—'}
                        </td>
                        <td>
                          {val.reference && (
                            <div className="amx-valuation-ref-badge">{val.reference}</div>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--amx-dash-text)' }}>{val.notes}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
              onClick={() => onNavigate?.(`assets/${asset.id}/transfer`)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                swap_horiz
              </span>
              <span>Initiate Transfer</span>
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
                {asset.movementHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--amx-dash-text-muted)', fontStyle: 'italic' }}>
                      No physical movement or relocation records logged yet.
                    </td>
                  </tr>
                ) : (
                  asset.movementHistory.map((mov) => (
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
                  ))
                )}
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
              onClick={() => onNavigate?.(`assets/${asset.id}/maintenance`)}
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
                {asset.maintenanceHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--amx-dash-text-muted)', fontStyle: 'italic' }}>
                      No maintenance records found. Click &quot;Log Service Event&quot; to record service or repairs.
                    </td>
                  </tr>
                ) : (
                  asset.maintenanceHistory.map((mnt) => (
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
                  ))
                )}
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
                {asset.auditHistory.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--amx-dash-text-muted)', fontStyle: 'italic' }}>
                      No audit history entries recorded.
                    </td>
                  </tr>
                ) : (
                  asset.auditHistory.map((audit) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Record Valuation Update Modal */}
      {isValModalOpen && (
        <div className="amx-valuation-modal-backdrop" onClick={() => setIsValModalOpen(false)}>
          <div
            className="amx-valuation-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="val-modal-title"
          >
            <div className="amx-modal-header">
              <div>
                <span className="amx-modal-step-badge">
                  {valModalStep === 'form' ? 'Step 1 of 2: Entry' : 'Step 2 of 2: Review & Confirmation'}
                </span>
                <h3 id="val-modal-title" className="amx-modal-title">
                  {valModalStep === 'form' ? 'Record Valuation Update' : 'Review Valuation Entry'}
                </h3>
              </div>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setIsValModalOpen(false)}
                aria-label="Close dialog"
                id="btn-close-val-modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {valModalStep === 'form' ? (
              <form onSubmit={handleReviewValuation} noValidate className="amx-modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="amx-form-group-val">
                    <label className="amx-form-label-val" htmlFor="val-effective-date">
                      <span>Effective Date <span style={{ color: 'var(--amx-dash-error)' }}>*</span></span>
                    </label>
                    <input
                      id="val-effective-date"
                      type="date"
                      className={`amx-input-val ${valErrors.effectiveDate ? 'has-error' : ''}`}
                      value={valForm.effectiveDate}
                      onChange={(e) => setValForm({ ...valForm, effectiveDate: e.target.value })}
                    />
                    {valErrors.effectiveDate && (
                      <span className="amx-field-error-val" id="val-error-effectiveDate">{valErrors.effectiveDate}</span>
                    )}
                  </div>

                  <div className="amx-form-group-val">
                    <label className="amx-form-label-val" htmlFor="val-previous-value">
                      <span>Previous Recorded Value</span>
                      <span style={{ fontSize: '11px', color: 'var(--amx-dash-text-muted)' }}>Read-only</span>
                    </label>
                    <input
                      id="val-previous-value"
                      type="text"
                      readOnly
                      className="amx-input-val is-readonly"
                      value={valForm.previousValue}
                    />
                  </div>

                  <div className="amx-form-group-val">
                    <label className="amx-form-label-val" htmlFor="val-new-value">
                      <span>New Recorded Value (₹) <span style={{ color: 'var(--amx-dash-error)' }}>*</span></span>
                      <span style={{ fontSize: '11px', color: 'var(--amx-dash-text-muted)' }}>Numeric, non-negative</span>
                    </label>
                    <input
                      id="val-new-value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 150000"
                      className={`amx-input-val ${valErrors.newRecordedValue ? 'has-error' : ''}`}
                      value={valForm.newRecordedValue}
                      onChange={(e) => setValForm({ ...valForm, newRecordedValue: e.target.value })}
                    />
                    {valErrors.newRecordedValue && (
                      <span className="amx-field-error-val" id="val-error-newRecordedValue">{valErrors.newRecordedValue}</span>
                    )}
                  </div>

                  <div className="amx-form-group-val">
                    <label className="amx-form-label-val" htmlFor="val-formula">
                      <span>Formula Used / Calculation Method <span style={{ color: 'var(--amx-dash-error)' }}>*</span></span>
                    </label>
                    <input
                      id="val-formula"
                      type="text"
                      placeholder="e.g. Straight Line Method (SLM) - 5 Year Life"
                      className={`amx-input-val ${valErrors.formulaUsed ? 'has-error' : ''}`}
                      value={valForm.formulaUsed}
                      onChange={(e) => setValForm({ ...valForm, formulaUsed: e.target.value })}
                    />
                    {valErrors.formulaUsed && (
                      <span className="amx-field-error-val" id="val-error-formulaUsed">{valErrors.formulaUsed}</span>
                    )}
                  </div>

                  <div className="amx-form-group-val">
                    <label className="amx-form-label-val" htmlFor="val-notes">
                      <span>Calculation Notes / Justification <span style={{ color: 'var(--amx-dash-error)' }}>*</span></span>
                    </label>
                    <textarea
                      id="val-notes"
                      rows={3}
                      placeholder="Detail the basis for this valuation change or depreciation entry..."
                      className={`amx-textarea-val ${valErrors.notes ? 'has-error' : ''}`}
                      value={valForm.notes}
                      onChange={(e) => setValForm({ ...valForm, notes: e.target.value })}
                    />
                    {valErrors.notes && (
                      <span className="amx-field-error-val" id="val-error-notes">{valErrors.notes}</span>
                    )}
                  </div>

                  <div className="amx-form-group-val">
                    <label className="amx-form-label-val" htmlFor="val-reference">
                      <span>Supporting Reference</span>
                      <span style={{ fontSize: '11px', color: 'var(--amx-dash-text-muted)' }}>Optional</span>
                    </label>
                    <input
                      id="val-reference"
                      type="text"
                      placeholder="e.g. Audit Report 2026-Q3 / Memo #782"
                      className="amx-input-val"
                      value={valForm.reference}
                      onChange={(e) => setValForm({ ...valForm, reference: e.target.value })}
                    />
                  </div>
                </div>

                <div className="amx-modal-footer">
                  <button
                    type="button"
                    className="amx-action-btn secondary"
                    onClick={() => setIsValModalOpen(false)}
                    id="btn-cancel-valuation"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="amx-action-btn primary"
                    id="btn-proceed-review-valuation"
                  >
                    <span>Proceed to Review</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      arrow_forward
                    </span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="amx-modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--amx-dash-text-muted)' }}>
                    Please review the valuation adjustment details below before committing this entry to the ledger.
                  </p>

                  <div className="amx-review-val-box">
                    <div className="amx-review-val-grid">
                      <div className="amx-field-group">
                        <span className="amx-field-label">Previous Recorded Value</span>
                        <span className="amx-field-value mono" id="val-review-prev-val">{valForm.previousValue}</span>
                      </div>
                      <div className="amx-field-group">
                        <span className="amx-field-label">Proposed New Recorded Value</span>
                        <span className="amx-field-value mono highlight" style={{ fontSize: '15px' }} id="val-review-new-val">
                          {formatCurrency(valForm.newRecordedValue)}
                        </span>
                      </div>
                    </div>

                    <div className="amx-field-group" style={{ borderTop: '1px solid var(--amx-dash-border-light)', paddingTop: '10px' }}>
                      <span className="amx-field-label">Net Adjustment / Difference</span>
                      <div id="val-review-diff-container">
                        {(() => {
                          const prevNum = parseCurrencyNumber(valForm.previousValue);
                          const newNum = parseCurrencyNumber(valForm.newRecordedValue);
                          if (prevNum === null || newNum === null) {
                            return <span className="amx-diff-badge neutral">N/A</span>;
                          }
                          const diff = newNum - prevNum;
                          if (diff < 0) {
                            return (
                              <span className="amx-diff-badge depreciation" id="val-diff-badge">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_down</span>
                                Depreciation: -₹{Math.abs(diff).toLocaleString('en-IN')}
                              </span>
                            );
                          } else if (diff > 0) {
                            return (
                              <span className="amx-diff-badge revaluation" id="val-diff-badge">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
                                Revaluation: +₹{diff.toLocaleString('en-IN')}
                              </span>
                            );
                          } else {
                            return (
                              <span className="amx-diff-badge neutral" id="val-diff-badge">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>remove</span>
                                No Change (₹0)
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    <div className="amx-review-val-grid" style={{ borderTop: '1px solid var(--amx-dash-border-light)', paddingTop: '10px' }}>
                      <div className="amx-field-group">
                        <span className="amx-field-label">Effective Date</span>
                        <span className="amx-field-value mono" id="val-review-effective-date">{formatDisplayDate(valForm.effectiveDate)}</span>
                      </div>
                      <div className="amx-field-group">
                        <span className="amx-field-label">Formula Used</span>
                        <span className="amx-field-value" id="val-review-formula">{valForm.formulaUsed}</span>
                      </div>
                    </div>

                    <div className="amx-field-group" style={{ borderTop: '1px solid var(--amx-dash-border-light)', paddingTop: '10px' }}>
                      <span className="amx-field-label">Calculation Notes / Justification</span>
                      <span className="amx-field-value" style={{ whiteSpace: 'pre-wrap' }} id="val-review-notes">{valForm.notes}</span>
                    </div>

                    {valForm.reference && (
                      <div className="amx-field-group">
                        <span className="amx-field-label">Supporting Reference</span>
                        <span className="amx-field-value mono" id="val-review-reference">{valForm.reference}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="amx-modal-footer">
                  <button
                    type="button"
                    className="amx-action-btn secondary"
                    onClick={() => setValModalStep('form')}
                    id="btn-back-edit-valuation"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      arrow_back
                    </span>
                    <span>Back to Edit</span>
                  </button>
                  <button
                    type="button"
                    className="amx-action-btn primary"
                    onClick={handleConfirmValuation}
                    id="btn-confirm-record-valuation"
                    disabled={isSubmittingValuation}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      {isSubmittingValuation ? 'progress_activity' : 'check_circle'}
                    </span>
                    <span>{isSubmittingValuation ? 'Recording Entry...' : 'Confirm & Record Entry'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AssetDetailsPage;
