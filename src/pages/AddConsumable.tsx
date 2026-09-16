import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getStoredConsumables,
  saveStoredConsumables,
  computeStockStatus,
  CONSUMABLE_FILTER_OPTIONS,
  type ConsumableDetailsData,
} from '../data/consumablesData';
import './AddConsumable.css';

interface AddConsumablePageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

interface FormState {
  name: string;
  category: string;
  location: string;
  initialStock: string;
  threshold: string;
  batchId: string;
  expiryDate: string;
}

interface FormErrors {
  name?: string;
  category?: string;
  location?: string;
  initialStock?: string;
  threshold?: string;
  batchId?: string;
  expiryDate?: string;
}

export const AddConsumablePage: React.FC<AddConsumablePageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    category: '',
    location: '',
    initialStock: '',
    threshold: '',
    batchId: '',
    expiryDate: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [createdConsumable, setCreatedConsumable] = useState<ConsumableDetailsData | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

  const handleInputChange = (field: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Item Name is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.location) {
      newErrors.location = 'Location is required';
    }

    const stockNum = parseInt(formData.initialStock, 10);
    if (!formData.initialStock.trim()) {
      newErrors.initialStock = 'Initial Stock Quantity is required';
    } else if (isNaN(stockNum) || stockNum <= 0) {
      newErrors.initialStock = 'Initial Stock Quantity must be greater than 0';
    }

    const threshNum = parseInt(formData.threshold, 10);
    if (!formData.threshold.trim()) {
      newErrors.threshold = 'Stock Threshold is required';
    } else if (isNaN(threshNum) || threshNum < 0) {
      newErrors.threshold = 'Stock Threshold must be 0 or greater';
    }

    if (!formData.batchId.trim()) {
      newErrors.batchId = 'Batch ID is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Please fix all form validation errors.');
      return;
    }

    const stockNum = parseInt(formData.initialStock, 10);
    const threshNum = parseInt(formData.threshold, 10);
    const generatedId = `CON-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const now = new Date();
    const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newConsumable: ConsumableDetailsData = {
      id: generatedId,
      name: formData.name.trim(),
      category: formData.category,
      location: formData.location,
      availableStock: stockNum,
      threshold: threshNum,
      batchId: formData.batchId.trim(),
      expiryDate: formData.expiryDate ? formData.expiryDate.trim() : '',
      status: computeStockStatus(stockNum, threshNum),
      batchQuantity: stockNum,
      issueHistory: [],
      movementLedger: [
        {
          id: `MOV-${Date.now().toString().slice(-4)}`,
          timestamp: timestampStr,
          operationType: 'Initial Inward / Batch Receipt',
          deltaQuantity: stockNum,
          postBalance: stockNum,
          reference: `Initial Registration & Batch Intake (${formData.batchId.trim()})`,
        },
      ],
    };

    const currentList = getStoredConsumables();
    const updatedList = [newConsumable, ...currentList];
    saveStoredConsumables(updatedList);
    setCreatedConsumable(newConsumable);
    showToast(`Consumable "${newConsumable.name}" registered successfully.`);
  };

  const parsedStock = parseInt(formData.initialStock, 10);
  const parsedThreshold = parseInt(formData.threshold, 10);
  const previewStatus =
    !isNaN(parsedStock) && !isNaN(parsedThreshold)
      ? computeStockStatus(parsedStock, parsedThreshold)
      : 'In Stock';

  return (
    <DashboardLayout
      currentNav="Consumables"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => {
        setCreatedConsumable(null);
        setFormData({
          name: '',
          category: '',
          location: '',
          initialStock: '',
          threshold: '',
          batchId: '',
          expiryDate: '',
        });
        setErrors({});
      }}
      onNotificationsClick={() =>
        showToast('1 Alert: Cyan Dye Ink Cartridge low stock; Lithium batteries near expiry.')
      }
      onHelpClick={() => showToast('AssetMX Consumables Registration Manual.')}
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

      <div className="amx-add-consumable-container">
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
          <span className="amx-breadcrumb-curr">Add Consumable</span>
        </nav>

        {/* Page Title */}
        <div className="amx-consumables-title-area">
          <h2 className="amx-consumables-title">Add Consumable</h2>
          <p className="amx-consumables-subtitle">
            Register a consumable item and define its initial stock, batch, and expiry information.
          </p>
        </div>

        {/* Success State Banner */}
        {createdConsumable ? (
          <div className="amx-success-banner" role="alert">
            <div className="amx-success-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }} aria-hidden="true">
                check_circle
              </span>
            </div>
            <div className="amx-success-content">
              <h3 className="amx-success-title">Consumable Created Successfully!</h3>
              <p className="amx-success-desc">
                <strong>{createdConsumable.name}</strong> (ID: {createdConsumable.id}) has been recorded with an initial batch of {createdConsumable.availableStock} units at {createdConsumable.location}.
              </p>
              <div className="amx-success-actions">
                <button
                  type="button"
                  className="amx-btn-primary"
                  onClick={() => onNavigate?.(`consumables/${encodeURIComponent(createdConsumable.id)}`)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    visibility
                  </span>
                  <span>View Consumable Details</span>
                </button>
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => onNavigate?.('consumables')}
                >
                  Back to Consumables
                </button>
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => {
                    setCreatedConsumable(null);
                    setFormData({
                      name: '',
                      category: '',
                      location: '',
                      initialStock: '',
                      threshold: '',
                      batchId: '',
                      expiryDate: '',
                    });
                  }}
                >
                  Register Another Item
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="amx-add-consumable-grid">
            {/* Left 2-Step Form */}
            <form onSubmit={handleSubmit} className="amx-form-steps-card">
              {/* STEP 1: Consumable Information */}
              <div className="amx-step-section">
                <div className="amx-step-header">
                  <span className="amx-step-badge">1</span>
                  <h3 className="amx-step-title">Consumable Information</h3>
                </div>

                <div className="amx-form-group">
                  <label className="amx-form-label">Item Name *</label>
                  <input
                    type="text"
                    className={`amx-form-input ${errors.name ? 'error' : ''}`}
                    placeholder="e.g. Cyan Dye Ink Cartridge (T502)"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                  {errors.name && <span className="amx-form-error">{errors.name}</span>}
                </div>

                <div className="amx-form-row-2">
                  <div className="amx-form-group">
                    <label className="amx-form-label">Category *</label>
                    <select
                      className={`amx-form-select ${errors.category ? 'error' : ''}`}
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                    >
                      <option value="">Select Category</option>
                      {CONSUMABLE_FILTER_OPTIONS.categories
                        .filter((c) => c.value)
                        .map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                    </select>
                    {errors.category && <span className="amx-form-error">{errors.category}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-form-label">Location *</label>
                    <select
                      className={`amx-form-select ${errors.location ? 'error' : ''}`}
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                    >
                      <option value="">Select Location</option>
                      {CONSUMABLE_FILTER_OPTIONS.locations
                        .filter((l) => l.value)
                        .map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                    </select>
                    {errors.location && <span className="amx-form-error">{errors.location}</span>}
                  </div>
                </div>

                <div className="amx-form-row-2">
                  <div className="amx-form-group">
                    <label className="amx-form-label">Initial Stock Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      className={`amx-form-input ${errors.initialStock ? 'error' : ''}`}
                      placeholder="e.g. 50"
                      value={formData.initialStock}
                      onChange={(e) => handleInputChange('initialStock', e.target.value)}
                    />
                    {errors.initialStock && <span className="amx-form-error">{errors.initialStock}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-form-label">Stock Threshold *</label>
                    <input
                      type="number"
                      min="0"
                      className={`amx-form-input ${errors.threshold ? 'error' : ''}`}
                      placeholder="e.g. 15"
                      value={formData.threshold}
                      onChange={(e) => handleInputChange('threshold', e.target.value)}
                    />
                    {errors.threshold && <span className="amx-form-error">{errors.threshold}</span>}
                  </div>
                </div>
              </div>

              {/* STEP 2: Batch & Expiry */}
              <div className="amx-step-divider" />
              <div className="amx-step-section">
                <div className="amx-step-header">
                  <span className="amx-step-badge">2</span>
                  <h3 className="amx-step-title">Batch & Expiry</h3>
                </div>

                <div className="amx-form-row-2">
                  <div className="amx-form-group">
                    <label className="amx-form-label">Batch ID *</label>
                    <input
                      type="text"
                      className={`amx-form-input ${errors.batchId ? 'error' : ''}`}
                      placeholder="e.g. BAT-2026-09A"
                      value={formData.batchId}
                      onChange={(e) => handleInputChange('batchId', e.target.value)}
                    />
                    {errors.batchId && <span className="amx-form-error">{errors.batchId}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-form-label">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      className="amx-form-input"
                      value={formData.expiryDate}
                      onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="amx-form-actions-bar">
                <button
                  type="button"
                  className="amx-btn-secondary"
                  onClick={() => onNavigate?.('consumables')}
                >
                  Cancel
                </button>
                <button type="submit" className="amx-btn-primary">
                  Save Consumable
                </button>
              </div>
            </form>

            {/* Right Live Consumable Summary Panel */}
            <aside className="amx-summary-panel" aria-label="Consumable live summary">
              <div className="amx-summary-header">
                <h3 className="amx-summary-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }} aria-hidden="true">
                    preview
                  </span>
                  Consumable Summary
                </h3>
              </div>
              <div className="amx-summary-body">
                <div className="amx-summary-item">
                  <span className="amx-summary-label">Item Name</span>
                  <span className="amx-summary-val">{formData.name.trim() || '—'}</span>
                </div>
                <div className="amx-summary-item">
                  <span className="amx-summary-label">Category</span>
                  <span className="amx-summary-val">{formData.category || '—'}</span>
                </div>
                <div className="amx-summary-item">
                  <span className="amx-summary-label">Location</span>
                  <span className="amx-summary-val">{formData.location || '—'}</span>
                </div>
                <div className="amx-summary-item">
                  <span className="amx-summary-label">Initial Stock</span>
                  <span className="amx-summary-val">
                    {formData.initialStock ? `${formData.initialStock} Units` : '—'}
                  </span>
                </div>
                <div className="amx-summary-item">
                  <span className="amx-summary-label">Threshold</span>
                  <span className="amx-summary-val">
                    {formData.threshold ? `${formData.threshold} Units` : '—'}
                  </span>
                </div>
                <div className="amx-summary-item">
                  <span className="amx-summary-label">Projected Stock Status</span>
                  <span className="amx-summary-val">
                    <span
                      className={`amx-stock-badge ${
                        previewStatus === 'In Stock'
                          ? 'in-stock'
                          : previewStatus === 'Low Stock'
                          ? 'low-stock'
                          : 'out-of-stock'
                      }`}
                    >
                      {previewStatus}
                    </span>
                  </span>
                </div>
                <div className="amx-summary-item">
                  <span className="amx-summary-label">Batch ID</span>
                  <span className="amx-summary-val" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formData.batchId.trim() || '—'}
                  </span>
                </div>
                <div className="amx-summary-item">
                  <span className="amx-summary-label">Expiry Date</span>
                  <span className="amx-summary-val">{formData.expiryDate || 'Non-expiring'}</span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AddConsumablePage;
