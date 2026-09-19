import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getExpiryClassification,
  CONSUMABLE_FILTER_OPTIONS,
  type ConsumableDetailsData,
} from '../data/consumablesData';
import {
  getConsumable,
  issueConsumable,
  updateConsumable,
  updateConsumableStock,
  type AssetApiError,
  type ConsumableApiRecord,
} from '../api/assetApi';
import './ConsumableDetails.css';

interface ConsumableDetailsPageProps {
  consumableId: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const ConsumableDetailsPage: React.FC<ConsumableDetailsPageProps> = ({
  consumableId,
  onNavigate,
  onSignOut,
}) => {
  const [consumable, setConsumable] = useState<ConsumableDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal states
  const [isUpdateStockOpen, setIsUpdateStockOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Update Stock Form
  const [updateOpType, setUpdateOpType] = useState<'Stock Adjustment / Correction' | 'Initial Inward / Batch Receipt'>('Stock Adjustment / Correction');
  const [updateQty, setUpdateQty] = useState<string>('');
  const [updateReason, setUpdateReason] = useState<string>('');
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Issue Consumable Form
  const [issueQty, setIssueQty] = useState<string>('');
  const [issueRef, setIssueRef] = useState<string>('');
  const [issuedBy, setIssuedBy] = useState<string>('Marcus Vance (Admin)');
  const [issueError, setIssueError] = useState<string | null>(null);

  // Edit Consumable Form
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editThreshold, setEditThreshold] = useState<string>('');
  const [editBatchId, setEditBatchId] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mapConsumable = (item: ConsumableApiRecord): ConsumableDetailsData => ({
    id: item.consumable_id,
    name: item.name,
    category: item.category,
    batchId: item.batch_id,
    location: item.location,
    availableStock: item.available_stock,
    threshold: item.threshold,
    expiryDate: item.expiry_date || '',
    status: item.stock_status,
    batchQuantity: item.batch_quantity,
    issueHistory: item.issue_history.map((issue) => ({
      id: issue.issue_id,
      issueDate: issue.issue_date,
      quantity: issue.quantity,
      requestReference: issue.request_reference || '',
      issuedBy: issue.issued_by,
      remainingStock: issue.remaining_stock,
    })),
    movementLedger: item.movement_ledger.map((movement) => ({
      id: movement.movement_id,
      timestamp: movement.timestamp,
      operationType: movement.operation_type,
      deltaQuantity: movement.delta_quantity,
      postBalance: movement.post_balance,
      reference: movement.reference,
    })),
  });

  const apiErrorMessage = (error: unknown) => {
    const errorStatus = (error as AssetApiError).status;
    if (errorStatus === 401) return 'Your session has expired. Please sign in again.';
    if (errorStatus === 403) return 'Admin access is required.';
    if (errorStatus === 404) return 'Consumable not found.';
    if (errorStatus === 409) return error instanceof Error ? error.message : 'The stock operation could not be completed.';
    if (errorStatus === 422) return error instanceof Error ? error.message : 'Please check the entered values.';
    return error instanceof Error ? error.message : 'Unable to complete the request.';
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setApiError(null);
    getConsumable(consumableId)
      .then((record) => active && setConsumable(mapConsumable(record)))
      .catch((error: unknown) => active && setApiError(apiErrorMessage(error)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [consumableId]);

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
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} module — Scheduled for future backend integration.`);
      onNavigate?.(subRoute);
    }
  };

  if (loading || !consumable) {
    return (
      <DashboardLayout currentNav="Consumables" onNavigate={handleNav} onSignOut={onSignOut}>
        <div role={apiError ? 'alert' : 'status'} style={{ padding: '32px', textAlign: 'center' }}>{apiError || 'Loading consumable details...'}</div>
      </DashboardLayout>
    );
  }

  const currentStatus = consumable.status;
  const expiryClass = getExpiryClassification(consumable.expiryDate);

  // Calculate stock sufficiency percentage
  const maxBenchmark = Math.max(consumable.threshold * 2, 50, consumable.availableStock);
  const sufficiencyPercentage = Math.min(100, Math.round((consumable.availableStock / maxBenchmark) * 100));

  // --- Modal Open Handlers ---
  const openUpdateStock = () => {
    setUpdateOpType('Stock Adjustment / Correction');
    setUpdateQty('');
    setUpdateReason('');
    setUpdateError(null);
    setIsUpdateStockOpen(true);
  };

  const openIssueModal = () => {
    setIssueQty('');
    setIssueRef('');
    setIssuedBy('Marcus Vance (Admin)');
    setIssueError(null);
    setIsIssueModalOpen(true);
  };

  const openEditModal = () => {
    setEditName(consumable.name);
    setEditCategory(consumable.category);
    setEditLocation(consumable.location);
    setEditThreshold(String(consumable.threshold));
    setEditBatchId(consumable.batchId);
    setEditExpiryDate(consumable.expiryDate || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // --- Save / Action Handlers ---
  const handleSaveUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseInt(updateQty, 10);
    if (isNaN(qtyNum) || qtyNum === 0) {
      setUpdateError('Please enter a valid non-zero adjustment quantity (e.g. +10 or -5).');
      return;
    }

    setIsSaving(true);
    try {
      const response = await updateConsumableStock(consumable.id, {
        operation_type: updateOpType,
        delta_quantity: qtyNum,
        ...(updateReason.trim() ? { reference: updateReason.trim() } : {}),
      });
      setConsumable(mapConsumable(response));
      setIsUpdateStockOpen(false);
      showToast(`Stock updated successfully. New balance: ${response.available_stock} units.`);
    } catch (error: unknown) {
      setUpdateError(apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseInt(issueQty, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setIssueError('Issue quantity must be a positive number greater than 0.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await issueConsumable(consumable.id, {
        quantity: qtyNum,
        ...(issueRef.trim() ? { request_reference: issueRef.trim() } : {}),
      });
      setConsumable(mapConsumable(response));
      setIsIssueModalOpen(false);
      showToast(`Issued ${qtyNum} units. Remaining stock: ${response.available_stock}.`);
    } catch (error: unknown) {
      setIssueError(apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditError('Item Name is required.');
      return;
    }
    if (!editCategory) {
      setEditError('Category is required.');
      return;
    }
    if (!editLocation) {
      setEditError('Location is required.');
      return;
    }
    const threshNum = parseInt(editThreshold, 10);
    if (isNaN(threshNum) || threshNum < 0) {
      setEditError('Minimum Threshold must be a non-negative number.');
      return;
    }
    if (!editBatchId.trim()) {
      setEditError('Batch ID is required.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await updateConsumable(consumable.id, {
        name: editName.trim(),
        category: editCategory,
        location: editLocation,
        threshold: threshNum,
        batch_id: editBatchId.trim(),
        expiry_date: editExpiryDate.trim() || null,
      });
      setConsumable(mapConsumable(response));
      setIsEditModalOpen(false);
      showToast('Consumable details updated successfully.');
    } catch (error: unknown) {
      setEditError(apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout
      currentNav="Consumables"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('consumables/new')}
      onNotificationsClick={() =>
        showToast('1 Alert: Cyan Dye Ink Cartridge low stock; Lithium batteries near expiry.')
      }
      onHelpClick={() => showToast('AssetMX Consumables & Stock Management Manual.')}
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

      <div className="amx-details-page-container">
        {/* Breadcrumb Navigation */}
        <nav className="amx-breadcrumb-nav" aria-label="Breadcrumb">
          <button
            type="button"
            className="amx-back-btn"
            onClick={() => onNavigate?.('consumables')}
            aria-label="Back to Consumables"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
              arrow_back
            </span>
            <span>Back to Consumables</span>
          </button>
          <span className="amx-breadcrumb-sep">/</span>
          <span className="amx-breadcrumb-curr">{consumable.name}</span>
        </nav>

        {/* Top Header Row */}
        <div className="amx-details-header-row">
          <div className="amx-details-title-group">
            <div className="amx-details-title-wrap">
              <h2 className="amx-details-title">{consumable.name}</h2>
              <span className="amx-details-id-badge">{consumable.id}</span>
              <span
                className={`amx-stock-badge ${
                  currentStatus === 'In Stock'
                    ? 'in-stock'
                    : currentStatus === 'Low Stock'
                    ? 'low-stock'
                    : 'out-of-stock'
                }`}
              >
                {currentStatus}
              </span>
            </div>
            <p className="amx-consumables-subtitle">
              Batch: {consumable.batchId} • Location: {consumable.location}
            </p>
          </div>

          <div className="amx-details-header-actions">
            <button
              type="button"
              className="amx-btn-secondary"
              onClick={openEditModal}
              aria-label="Edit Consumable"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                edit
              </span>
              <span>Edit Consumable</span>
            </button>
            <button
              type="button"
              className="amx-btn-secondary"
              onClick={openIssueModal}
              disabled={consumable.availableStock <= 0}
              aria-label="Issue Consumable"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                output
              </span>
              <span>Issue Consumable</span>
            </button>
            <button
              type="button"
              className="amx-btn-primary"
              onClick={openUpdateStock}
              aria-label="Update Stock"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                sync_alt
              </span>
              <span>Update Stock</span>
            </button>
          </div>
        </div>

        {/* 2-Column Grid for Details */}
        <div className="amx-details-grid">
          {/* Panel 1: Consumable Information */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  inventory_2
                </span>
                Consumable Information
              </h3>
            </div>
            <div className="amx-panel-body">
              <div className="amx-kv-grid">
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Consumable ID</span>
                  <span className="amx-kv-value amx-kv-mono">{consumable.id}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Category</span>
                  <span className="amx-kv-value">{consumable.category}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Location</span>
                  <span className="amx-kv-value">{consumable.location}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Minimum Threshold</span>
                  <span className="amx-kv-value">{consumable.threshold} Units</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Current Available Stock</span>
                  <span
                    className="amx-kv-value"
                    style={{
                      fontSize: '18px',
                      color: currentStatus === 'Out of Stock' ? 'var(--amx-dash-error)' : currentStatus === 'Low Stock' ? '#D97706' : 'var(--amx-dash-text)',
                    }}
                  >
                    {consumable.availableStock} Units
                  </span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Stock Status</span>
                  <span className="amx-kv-value">
                    <span
                      className={`amx-stock-badge ${
                        currentStatus === 'In Stock'
                          ? 'in-stock'
                          : currentStatus === 'Low Stock'
                          ? 'low-stock'
                          : 'out-of-stock'
                      }`}
                    >
                      {currentStatus}
                    </span>
                  </span>
                </div>
              </div>

              {/* Stock Sufficiency Bar */}
              <div className="amx-stock-sufficiency-bar">
                <div className="amx-sufficiency-label-row">
                  <span style={{ color: 'var(--amx-dash-text-muted)' }}>Stock Sufficiency Indicator</span>
                  <span style={{ color: currentStatus === 'In Stock' ? '#059669' : '#D97706' }}>
                    {sufficiencyPercentage}% Capacity
                  </span>
                </div>
                <div className="amx-progress-track">
                  <div
                    className={`amx-progress-fill ${
                      currentStatus === 'In Stock'
                        ? 'in-stock'
                        : currentStatus === 'Low Stock'
                        ? 'low-stock'
                        : 'out-of-stock'
                    }`}
                    style={{ width: `${sufficiencyPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Batch & Expiry */}
          <div className="amx-panel-card">
            <div className="amx-panel-header">
              <h3 className="amx-panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                  qr_code_2
                </span>
                Batch & Expiry
              </h3>
            </div>
            <div className="amx-panel-body">
              <div className="amx-kv-grid">
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Batch ID</span>
                  <span className="amx-kv-value amx-kv-mono">{consumable.batchId}</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Initial Batch Quantity</span>
                  <span className="amx-kv-value">{consumable.batchQuantity} Units</span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Expiry Date</span>
                  <span className="amx-kv-value">
                    {consumable.expiryDate ? (
                      <span className={`amx-expiry-tag ${expiryClass}`}>
                        {consumable.expiryDate}
                      </span>
                    ) : (
                      <span className="amx-expiry-tag none">No Expiry Configured</span>
                    )}
                  </span>
                </div>
                <div className="amx-kv-item">
                  <span className="amx-kv-label">Expiry Status</span>
                  <span className="amx-kv-value">
                    {expiryClass === 'expired' && <span style={{ color: '#DC2626', fontWeight: 700 }}>Expired</span>}
                    {expiryClass === 'upcoming' && <span style={{ color: '#B45309', fontWeight: 700 }}>Expiring Soon</span>}
                    {expiryClass === 'normal' && <span style={{ color: '#059669', fontWeight: 600 }}>Normal Validity</span>}
                    {expiryClass === 'none' && <span style={{ color: 'var(--amx-dash-text-muted)' }}>Non-Expiring</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Consumption / Issue History */}
        <div className="amx-panel-card">
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                history
              </span>
              Consumption / Issue History
            </h3>
          </div>
          <div className="amx-table-scroll-wrapper">
            <table className="amx-ledger-table" aria-label="Consumption and issue history table">
              <thead>
                <tr>
                  <th scope="col">Issue Date</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Request / Reference</th>
                  <th scope="col">Issued By</th>
                  <th scope="col">Remaining Stock</th>
                </tr>
              </thead>
              <tbody>
                {consumable.issueHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--amx-dash-text-muted)' }}>
                      No consumption history recorded yet.
                    </td>
                  </tr>
                ) : (
                  consumable.issueHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="amx-mono-cell">{item.issueDate}</td>
                      <td style={{ fontWeight: 700, color: 'var(--amx-dash-text)' }}>{item.quantity} units</td>
                      <td>{item.requestReference}</td>
                      <td className="amx-muted-cell">{item.issuedBy}</td>
                      <td className="amx-mono-cell" style={{ fontWeight: 600 }}>{item.remainingStock} units</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 4: Stock Movement & Adjustment Ledger */}
        <div className="amx-panel-card">
          <div className="amx-panel-header">
            <h3 className="amx-panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                receipt_long
              </span>
              Stock Movement & Adjustment Ledger
            </h3>
          </div>
          <div className="amx-table-scroll-wrapper">
            <table className="amx-ledger-table" aria-label="Stock movement and adjustment ledger table">
              <thead>
                <tr>
                  <th scope="col">Date & Timestamp</th>
                  <th scope="col">Operation Type</th>
                  <th scope="col">Delta Quantity</th>
                  <th scope="col">Post-Operation Balance</th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                {consumable.movementLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--amx-dash-text-muted)' }}>
                      No ledger operations recorded yet.
                    </td>
                  </tr>
                ) : (
                  consumable.movementLedger.map((op) => {
                    const isNeg = op.deltaQuantity < 0;
                    return (
                      <tr key={op.id}>
                        <td className="amx-mono-cell">{op.timestamp}</td>
                        <td>
                          <span
                            className={`amx-op-tag ${
                              op.operationType === 'Disbursement / Issue'
                                ? 'issue'
                                : op.operationType === 'Initial Inward / Batch Receipt'
                                ? 'inward'
                                : 'adjustment'
                            }`}
                          >
                            {op.operationType}
                          </span>
                        </td>
                        <td>
                          <span className={isNeg ? 'amx-delta-neg' : 'amx-delta-pos'}>
                            {isNeg ? '' : '+'}
                            {op.deltaQuantity}
                          </span>
                        </td>
                        <td className="amx-mono-cell" style={{ fontWeight: 600 }}>
                          {op.postBalance} units
                        </td>
                        <td className="amx-muted-cell">{op.reference}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: Update Stock */}
      {/* ================================================================= */}
      {isUpdateStockOpen && (
        <div className="amx-modal-backdrop" onClick={() => setIsUpdateStockOpen(false)}>
          <div className="amx-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="modal-update-stock-title">
            <div className="amx-modal-header">
              <h3 className="amx-modal-title" id="modal-update-stock-title">Update Stock</h3>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setIsUpdateStockOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveUpdateStock}>
              <div className="amx-modal-body">
                {updateError && <div className="amx-form-error">{updateError}</div>}

                <div className="amx-form-group">
                  <label className="amx-form-label">Operation / Adjustment Type *</label>
                  <select
                    className="amx-form-select"
                    value={updateOpType}
                    onChange={(e) => setUpdateOpType(e.target.value as any)}
                  >
                    <option value="Stock Adjustment / Correction">Stock Adjustment / Correction</option>
                    <option value="Initial Inward / Batch Receipt">Initial Inward / Batch Receipt</option>
                  </select>
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">
                    Delta Quantity * (Current Stock: {consumable.availableStock})
                  </label>
                  <input
                    type="number"
                    className={`amx-form-input ${updateError ? 'error' : ''}`}
                    placeholder="e.g. 10 to add, or -5 to deduct"
                    value={updateQty}
                    onChange={(e) => {
                      setUpdateQty(e.target.value);
                      setUpdateError(null);
                    }}
                    required
                  />
                  <span style={{ fontSize: '12px', color: 'var(--amx-dash-text-muted)' }}>
                    Positive value increases stock; negative value reduces stock.
                  </span>
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Reference / Reason</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    placeholder="e.g. Physical inventory count discrepancy audit"
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="amx-modal-footer">
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => setIsUpdateStockOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="amx-btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: Issue Consumable */}
      {/* ================================================================= */}
      {isIssueModalOpen && (
        <div className="amx-modal-backdrop" onClick={() => setIsIssueModalOpen(false)}>
          <div className="amx-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="modal-issue-title">
            <div className="amx-modal-header">
              <h3 className="amx-modal-title" id="modal-issue-title">Issue Consumable</h3>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setIsIssueModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveIssue}>
              <div className="amx-modal-body">
                {issueError && <div className="amx-form-error">{issueError}</div>}

                <div className="amx-form-group">
                  <label className="amx-form-label">
                    Quantity to Issue * (Available: {consumable.availableStock} Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={consumable.availableStock}
                    className={`amx-form-input ${issueError ? 'error' : ''}`}
                    placeholder="e.g. 5"
                    value={issueQty}
                    onChange={(e) => {
                      setIssueQty(e.target.value);
                      setIssueError(null);
                    }}
                    required
                  />
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Request / Reference</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    placeholder="e.g. REQ-IT-9012 (Development Lab Workshop)"
                    value={issueRef}
                    onChange={(e) => setIssueRef(e.target.value)}
                  />
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Issued By</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    placeholder="Issuer name & role"
                    value={issuedBy}
                    onChange={(e) => setIssuedBy(e.target.value)}
                  />
                </div>
              </div>
              <div className="amx-modal-footer">
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => setIsIssueModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="amx-btn-primary" disabled={isSaving}>
                  {isSaving ? 'Issuing...' : 'Confirm Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: Edit Consumable */}
      {/* ================================================================= */}
      {isEditModalOpen && (
        <div className="amx-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="amx-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="modal-edit-title">
            <div className="amx-modal-header">
              <h3 className="amx-modal-title" id="modal-edit-title">Edit Consumable</h3>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="amx-modal-body">
                {editError && <div className="amx-form-error">{editError}</div>}

                <div className="amx-form-group">
                  <label className="amx-form-label">Item Name *</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Category *</label>
                  <select
                    className="amx-form-select"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    required
                  >
                    {CONSUMABLE_FILTER_OPTIONS.categories.filter((c) => c.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Location *</label>
                  <select
                    className="amx-form-select"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    required
                  >
                    {CONSUMABLE_FILTER_OPTIONS.locations.filter((l) => l.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Minimum Threshold *</label>
                  <input
                    type="number"
                    min="0"
                    className="amx-form-input"
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(e.target.value)}
                    required
                  />
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Batch ID *</label>
                  <input
                    type="text"
                    className="amx-form-input"
                    value={editBatchId}
                    onChange={(e) => setEditBatchId(e.target.value)}
                    required
                  />
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    className="amx-form-input"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="amx-modal-footer">
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="amx-btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ConsumableDetailsPage;
