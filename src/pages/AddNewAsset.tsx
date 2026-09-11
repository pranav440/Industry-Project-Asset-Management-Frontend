import React, { useState, useRef } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { registerNewAsset, type NewAssetPayload } from '../api/assetApi';
import { ASSET_FILTER_OPTIONS } from '../data/assetsData';
import './AddNewAsset.css';

interface AddNewAssetPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

interface FormState {
  name: string;
  category: string;
  specification: string;
  location: string;
  custodian: string;
  purchaseDate: string;
  vendorName: string;
  totalCost: string;
  warrantyPeriod: string;
  invoiceReference: string;
}

interface FormErrors {
  name?: string;
  category?: string;
  location?: string;
  custodian?: string;
  purchaseDate?: string;
  vendorName?: string;
  totalCost?: string;
  warrantyPeriod?: string;
}

export const AddNewAssetPage: React.FC<AddNewAssetPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    category: '',
    specification: '',
    location: '',
    custodian: '',
    purchaseDate: '',
    vendorName: '',
    totalCost: '',
    warrantyPeriod: '',
    invoiceReference: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [invoiceFile, setInvoiceFile] = useState<string | null>(null);
  const [warrantyFile, setWarrantyFile] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<string | null>(null);
  const [otherDocs, setOtherDocs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ assetId: string; message: string } | null>(null);

  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const warrantyInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const generalDocInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

  const handleInputChange = (field: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Asset Name is required';
    }
    if (!formData.category) {
      newErrors.category = 'Asset Category is required';
    }
    if (!formData.location) {
      newErrors.location = 'Assigned Location is required';
    }
    if (!formData.custodian) {
      newErrors.custodian = 'Custodian is required';
    }
    if (!formData.purchaseDate.trim()) {
      newErrors.purchaseDate = 'Purchase Date is required';
    }
    if (!formData.vendorName.trim()) {
      newErrors.vendorName = 'Vendor / Supplier Name is required';
    }
    if (!formData.totalCost.trim()) {
      newErrors.totalCost = 'Total Cost is required';
    }
    if (!formData.warrantyPeriod.trim()) {
      newErrors.warrantyPeriod = 'Warranty Period is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      showToast('Please complete all required fields (*)');
      return;
    }

    setIsSubmitting(true);
    setSuccessInfo(null);

    const payload: NewAssetPayload = {
      name: formData.name.trim(),
      category: formData.category,
      specification: formData.specification.trim(),
      location: formData.location,
      custodian: formData.custodian,
      purchaseDate: formData.purchaseDate,
      vendorName: formData.vendorName.trim(),
      totalCost: formData.totalCost.trim(),
      warrantyPeriod: formData.warrantyPeriod.trim(),
      invoiceReference: formData.invoiceReference.trim(),
      documents: {
        invoiceFileName: invoiceFile || undefined,
        warrantyFileName: warrantyFile || undefined,
        photoFileName: photoFile || undefined,
        otherFiles: otherDocs.length > 0 ? otherDocs : undefined,
      },
    };

    try {
      const result = await registerNewAsset(payload);
      setSuccessInfo({
        assetId: result.asset_id,
        message: 'Asset has been added to the asset registry and a unique QR identification has been generated.',
      });
      showToast('Asset registered successfully');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      name: '',
      category: '',
      specification: '',
      location: '',
      custodian: '',
      purchaseDate: '',
      vendorName: '',
      totalCost: '',
      warrantyPeriod: '',
      invoiceReference: '',
    });
    setErrors({});
    setInvoiceFile(null);
    setWarrantyFile(null);
    setPhotoFile(null);
    setOtherDocs([]);
    setSuccessInfo(null);
  };

  // Category and location options
  const categoryOptions = [
    { value: 'Hardware / Compute', label: 'Hardware / Compute' },
    { value: 'Machinery & Heavy Tools', label: 'Machinery & Heavy Tools' },
    { value: 'Office Infrastructure & Furniture', label: 'Office Infrastructure & Furniture' },
    { value: 'Network & Telecom Systems', label: 'Network & Telecom Systems' },
    { value: 'Facility & Security Equipment', label: 'Facility & Security Equipment' },
    ...ASSET_FILTER_OPTIONS.categories.filter((c) => c.value !== ''),
  ];

  const locationOptions = [
    { value: 'HQ - Floor 4, Dev Pod 4B', label: 'HQ - Floor 4, Dev Pod 4B' },
    { value: 'HQ - Data Center Basement B1', label: 'HQ - Data Center Basement B1' },
    { value: 'Regional Annex - West Wing Labs', label: 'Regional Annex - West Wing Labs' },
    { value: 'Distribution Facility - Bay 12', label: 'Distribution Facility - Bay 12' },
    { value: 'Remote / Field Assigned', label: 'Remote / Field Assigned' },
    ...ASSET_FILTER_OPTIONS.locations.filter((l) => l.value !== ''),
  ];

  const custodianOptions = [
    { value: 'Marcus Vance (EMP-0941) — IT Systems', label: 'Marcus Vance (EMP-0941) — IT Systems' },
    { value: 'Elena Rostova (EMP-1102) — DevOps', label: 'Elena Rostova (EMP-1102) — DevOps' },
    { value: 'Devin Cole (EMP-0419) — Product Lead', label: 'Devin Cole (EMP-0419) — Product Lead' },
    { value: 'Unassigned (Reserve Inventory Pool)', label: 'Unassigned (Reserve Inventory Pool)' },
    ...ASSET_FILTER_OPTIONS.custodians.filter((c) => c.value !== ''),
  ];

  return (
    <DashboardLayout
      currentNav="Assets"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(q) => showToast(`Search query: ${q}`)}
      searchPlaceholder="Search assets..."
      onAddAsset={() => {
        handleResetForm();
        showToast('New asset registration form refreshed.');
      }}
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

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={invoiceInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setInvoiceFile(e.target.files[0].name);
            showToast(`Attached invoice: ${e.target.files[0].name}`);
          }
        }}
      />
      <input
        type="file"
        ref={warrantyInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setWarrantyFile(e.target.files[0].name);
            showToast(`Attached warranty card: ${e.target.files[0].name}`);
          }
        }}
      />
      <input
        type="file"
        ref={photoInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setPhotoFile(e.target.files[0].name);
            showToast(`Attached asset photo: ${e.target.files[0].name}`);
          }
        }}
      />
      <input
        type="file"
        ref={generalDocInputRef}
        style={{ display: 'none' }}
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.docx"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const names = Array.from(e.target.files).map((f) => f.name);
            setOtherDocs((prev) => [...prev, ...names]);
            showToast(`Attached ${names.length} supporting document(s)`);
          }
        }}
      />

      <form className="amx-add-asset-container" onSubmit={handleSubmit} noValidate>
        {/* Breadcrumb Navigation */}
        <nav className="amx-breadcrumb-nav" aria-label="Breadcrumb">
          <button
            type="button"
            className="amx-back-btn"
            onClick={() => onNavigate?.('assets')}
            aria-label="Back to Assets Inventory"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
              arrow_back
            </span>
            <span>Assets</span>
          </button>
          <span className="amx-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="amx-breadcrumb-curr">Add New Asset</span>
        </nav>

        {/* Success Banner if Registered */}
        {successInfo && (
          <div className="amx-success-banner-card" role="alert">
            <div className="amx-success-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                verified
              </span>
            </div>
            <div>
              <h3 className="amx-success-title">Asset Registered: {successInfo.assetId}</h3>
              <p className="amx-success-msg">{successInfo.message}</p>
              <div className="amx-success-actions">
                <button
                  type="button"
                  className="amx-btn-view-registered"
                  onClick={() => onNavigate?.(`assets/${successInfo.assetId}`)}
                >
                  View Asset Details
                </button>
                <button
                  type="button"
                  className="amx-btn-register-another"
                  onClick={handleResetForm}
                >
                  Register Another Asset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="amx-page-header-row">
          <div className="amx-page-title-col">
            <h1 className="amx-add-asset-title">Add New Asset</h1>
            <p className="amx-add-asset-subtitle">
              Register a new organizational asset and assign its ownership, location, and supporting records.
            </p>
          </div>

          <div className="amx-page-actions-group">
            <button
              type="button"
              className="amx-btn-bulk-upload"
              onClick={() => showToast('Bulk Excel Upload workflow — Scheduled for next module release.')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--amx-dash-secondary)' }}>
                table_view
              </span>
              <span>Bulk Upload via Excel</span>
            </button>
            <button
              type="button"
              className="amx-btn-cancel"
              onClick={() => onNavigate?.('assets')}
            >
              Cancel
            </button>
            <button
              type="button"
              className="amx-btn-register-primary"
              disabled={isSubmitting}
              onClick={() => handleSubmit()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                verified
              </span>
              <span>{isSubmitting ? 'Registering...' : 'Register Asset'}</span>
            </button>
          </div>
        </div>

        {/* Master Two-Column Form Layout Grid */}
        <div className="amx-add-asset-grid">
            {/* LEFT COLUMN: Data Entry Cards (66%) */}
            <div className="amx-form-left-col">
              {/* CARD 1: Asset Information */}
              <section className="amx-form-card">
                <div className="amx-form-card-header">
                  <div className="amx-card-title-group">
                    <div className="amx-card-title-row">
                      <span className="amx-card-dot" aria-hidden="true" />
                      <h2 className="amx-card-title">Asset Information</h2>
                    </div>
                    <p className="amx-card-sub">Core classification, technical telemetry, and physical allocation</p>
                  </div>
                  <span className="amx-section-tag">SECTION 01</span>
                </div>

                <div className="amx-fields-grid-2">
                  <div className="amx-form-group amx-field-span-2">
                    <label className="amx-label" htmlFor="assetNameInput">
                      Asset Name <span className="amx-req-star">*</span>
                    </label>
                    <input
                      id="assetNameInput"
                      type="text"
                      className={`amx-input ${errors.name ? 'has-error' : ''}`}
                      placeholder="Enter asset name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                    />
                    {errors.name && <span className="amx-field-error">{errors.name}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-label" htmlFor="assetCategorySelect">
                      Asset Category <span className="amx-req-star">*</span>
                    </label>
                    <div className="amx-input-wrap">
                      <select
                        id="assetCategorySelect"
                        className={`amx-select ${errors.category ? 'has-error' : ''}`}
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                      >
                        <option value="" disabled>Select category</option>
                        {categoryOptions.map((opt, idx) => (
                          <option key={`${opt.value}-${idx}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined amx-input-icon">expand_more</span>
                    </div>
                    {errors.category && <span className="amx-field-error">{errors.category}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-label" htmlFor="specificationInput">
                      Specification / Sub-category
                    </label>
                    <input
                      id="specificationInput"
                      type="text"
                      className="amx-input"
                      placeholder="Enter specification"
                      value={formData.specification}
                      onChange={(e) => handleInputChange('specification', e.target.value)}
                    />
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-label" htmlFor="assignedLocationSelect">
                      Assigned Location <span className="amx-req-star">*</span>
                    </label>
                    <div className="amx-input-wrap">
                      <select
                        id="assignedLocationSelect"
                        className={`amx-select ${errors.location ? 'has-error' : ''}`}
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                      >
                        <option value="" disabled>Select location</option>
                        {locationOptions.map((opt, idx) => (
                          <option key={`${opt.value}-${idx}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined amx-input-icon">place</span>
                    </div>
                    {errors.location && <span className="amx-field-error">{errors.location}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-label" htmlFor="assignedCustodianSelect">
                      Custodian (Assigned Custodian) <span className="amx-req-star">*</span>
                    </label>
                    <div className="amx-input-wrap">
                      <select
                        id="assignedCustodianSelect"
                        className={`amx-select ${errors.custodian ? 'has-error' : ''}`}
                        value={formData.custodian}
                        onChange={(e) => handleInputChange('custodian', e.target.value)}
                      >
                        <option value="" disabled>Select custodian</option>
                        {custodianOptions.map((opt, idx) => (
                          <option key={`${opt.value}-${idx}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined amx-input-icon">person_pin</span>
                    </div>
                    {errors.custodian && <span className="amx-field-error">{errors.custodian}</span>}
                  </div>
                </div>

                <div className="amx-info-banner">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--amx-dash-secondary)' }}>
                    info
                  </span>
                  <span className="amx-info-banner-text">
                    Asset ID will be generated automatically after successful registration.
                  </span>
                </div>
              </section>

              {/* CARD 2: Acquisition & Warranty */}
              <section className="amx-form-card">
                <div className="amx-form-card-header">
                  <div className="amx-card-title-group">
                    <div className="amx-card-title-row">
                      <span className="amx-card-dot" aria-hidden="true" />
                      <h2 className="amx-card-title">Acquisition & Warranty</h2>
                    </div>
                    <p className="amx-card-sub">Capital expense validation, vendor lineage, and warranty records</p>
                  </div>
                  <span className="amx-section-tag">SECTION 02</span>
                </div>

                <div className="amx-fields-grid-3">
                  <div className="amx-form-group">
                    <label className="amx-label" htmlFor="purchaseDateInput">
                      Purchase Date <span className="amx-req-star">*</span>
                    </label>
                    <div className="amx-input-wrap">
                      <input
                        id="purchaseDateInput"
                        type="date"
                        className={`amx-input ${errors.purchaseDate ? 'has-error' : ''}`}
                        placeholder="Select purchase date"
                        value={formData.purchaseDate}
                        onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                      />
                    </div>
                    {errors.purchaseDate && <span className="amx-field-error">{errors.purchaseDate}</span>}
                  </div>

                  <div className="amx-form-group amx-field-span-2">
                    <label className="amx-label" htmlFor="vendorNameInput">
                      Vendor / Supplier Name <span className="amx-req-star">*</span>
                    </label>
                    <input
                      id="vendorNameInput"
                      type="text"
                      className={`amx-input ${errors.vendorName ? 'has-error' : ''}`}
                      placeholder="Enter vendor name"
                      value={formData.vendorName}
                      onChange={(e) => handleInputChange('vendorName', e.target.value)}
                    />
                    {errors.vendorName && <span className="amx-field-error">{errors.vendorName}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-label" htmlFor="totalCostInput">
                      Total Cost <span className="amx-req-star">*</span>
                    </label>
                    <div className="amx-input-wrap">
                      <span className="amx-input-currency-prefix">₹</span>
                      <input
                        id="totalCostInput"
                        type="text"
                        className={`amx-input with-currency ${errors.totalCost ? 'has-error' : ''}`}
                        placeholder="Enter total cost"
                        value={formData.totalCost}
                        onChange={(e) => handleInputChange('totalCost', e.target.value)}
                      />
                    </div>
                    {errors.totalCost && <span className="amx-field-error">{errors.totalCost}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-label" htmlFor="warrantyPeriodInput">
                      Warranty Period <span className="amx-req-star">*</span>
                    </label>
                    <div className="amx-input-wrap">
                      <input
                        id="warrantyPeriodInput"
                        type="text"
                        className={`amx-input ${errors.warrantyPeriod ? 'has-error' : ''}`}
                        placeholder="e.g. 3 Years Onsite"
                        value={formData.warrantyPeriod}
                        onChange={(e) => handleInputChange('warrantyPeriod', e.target.value)}
                      />
                      <span className="material-symbols-outlined amx-input-icon">verified_user</span>
                    </div>
                    {errors.warrantyPeriod && <span className="amx-field-error">{errors.warrantyPeriod}</span>}
                  </div>

                  <div className="amx-form-group">
                    <label className="amx-label" htmlFor="invoiceRefInput">
                      Invoice / Reference
                    </label>
                    <input
                      id="invoiceRefInput"
                      type="text"
                      className="amx-input"
                      placeholder="Enter reference/PO number"
                      value={formData.invoiceReference}
                      onChange={(e) => handleInputChange('invoiceReference', e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* CARD 3: Supporting Documents & Visual Assets */}
              <section className="amx-form-card">
                <div className="amx-form-card-header">
                  <div className="amx-card-title-group">
                    <div className="amx-card-title-row">
                      <span className="amx-card-dot" aria-hidden="true" />
                      <h2 className="amx-card-title">Supporting Documents & Media</h2>
                    </div>
                    <p className="amx-card-sub">Upload purchase invoices, warranty cards, and physical unit inspection photos</p>
                  </div>
                  <span className="amx-section-tag">SECTION 03</span>
                </div>

                <div className="amx-doc-types-grid">
                  {/* Document 1: Invoice */}
                  <div className="amx-doc-box">
                    <div>
                      <div className="amx-doc-icon-wrap">
                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                          receipt_long
                        </span>
                      </div>
                      <div className="amx-doc-meta">
                        <h3 className="amx-doc-title">Invoice</h3>
                        <p className="amx-doc-formats">PDF, JPG up to 10MB</p>
                      </div>
                    </div>
                    <div className="amx-doc-action-wrap">
                      {invoiceFile ? (
                        <div className="amx-file-chosen-preview">
                          <span className="amx-file-name-text" title={invoiceFile}>{invoiceFile}</span>
                          <button
                            type="button"
                            className="amx-remove-file-btn"
                            onClick={() => setInvoiceFile(null)}
                            title="Remove attachment"
                            aria-label="Remove invoice attachment"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="amx-upload-trigger-btn"
                          onClick={() => invoiceInputRef.current?.click()}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>upload_file</span>
                          <span>Upload Invoice</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Document 2: Warranty Card */}
                  <div className="amx-doc-box">
                    <div>
                      <div className="amx-doc-icon-wrap">
                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                          verified
                        </span>
                      </div>
                      <div className="amx-doc-meta">
                        <h3 className="amx-doc-title">Warranty Card</h3>
                        <p className="amx-doc-formats">PDF, JPG up to 10MB</p>
                      </div>
                    </div>
                    <div className="amx-doc-action-wrap">
                      {warrantyFile ? (
                        <div className="amx-file-chosen-preview">
                          <span className="amx-file-name-text" title={warrantyFile}>{warrantyFile}</span>
                          <button
                            type="button"
                            className="amx-remove-file-btn"
                            onClick={() => setWarrantyFile(null)}
                            title="Remove attachment"
                            aria-label="Remove warranty card attachment"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="amx-upload-trigger-btn"
                          onClick={() => warrantyInputRef.current?.click()}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>upload_file</span>
                          <span>Upload Warranty</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Document 3: Asset Photo */}
                  <div className="amx-doc-box">
                    <div>
                      <div className="amx-doc-icon-wrap">
                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                          photo_camera
                        </span>
                      </div>
                      <div className="amx-doc-meta">
                        <h3 className="amx-doc-title">Asset Photo</h3>
                        <p className="amx-doc-formats">JPG, PNG up to 10MB</p>
                      </div>
                    </div>
                    <div className="amx-doc-action-wrap">
                      {photoFile ? (
                        <div className="amx-file-chosen-preview">
                          <span className="amx-file-name-text" title={photoFile}>{photoFile}</span>
                          <button
                            type="button"
                            className="amx-remove-file-btn"
                            onClick={() => setPhotoFile(null)}
                            title="Remove attachment"
                            aria-label="Remove photo attachment"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="amx-upload-trigger-btn"
                          onClick={() => photoInputRef.current?.click()}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add_a_photo</span>
                          <span>Upload Photo</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* General Supporting Documents Dropzone */}
                <div
                  className="amx-general-dropzone"
                  onClick={() => generalDocInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      generalDocInputRef.current?.click();
                    }
                  }}
                  aria-label="Upload other supporting documents"
                >
                  <div className="amx-dropzone-icon-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                      cloud_upload
                    </span>
                  </div>
                  <div className="amx-dropzone-prompt">
                    {otherDocs.length > 0
                      ? `${otherDocs.length} additional document(s) selected`
                      : 'Drop other supporting documents here, or browse files'}
                  </div>
                  <p className="amx-dropzone-sub">
                    Accepts PDF, JPG, PNG, DOCX up to 10MB each (Batch uploads supported)
                  </p>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Telemetry, QR Tagging & Confirmation (34%) */}
            <div className="amx-summary-right-col">
              {/* CARD 4: QR Identification & Auto Tagging */}
              <section className="amx-form-card amx-qr-preview-card">
                <div className="amx-form-card-header">
                  <div className="amx-card-title-group">
                    <div className="amx-card-title-row">
                      <span className="amx-card-dot" aria-hidden="true" />
                      <h2 className="amx-card-title">QR Identification</h2>
                    </div>
                    <p className="amx-card-sub">Automated Tagging</p>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: 'var(--amx-dash-secondary)', fontSize: '22px' }}>
                    qr_code_scanner
                  </span>
                </div>

                <p className="amx-qr-card-desc">
                  A unique QR code will be generated and linked to this asset after registration. Scanning the QR code retrieves the asset profile.
                </p>

                <div className="amx-qr-preview-box">
                  <div className="amx-qr-tag-header">
                    <span className="amx-qr-tag-label">Asset Tag</span>
                    <span className="amx-qr-preview-tag">PREVIEW ONLY</span>
                  </div>

                  <div className="amx-qr-svg-holder">
                    <svg
                      className="w-36 h-36"
                      style={{ width: '130px', height: '130px' }}
                      fill="none"
                      viewBox="0 0 100 100"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-label="QR Preview Placeholder"
                    >
                      <rect fill="#0f172a" height="28" rx="2" width="28" x="5" y="5" />
                      <rect fill="#ffffff" height="18" rx="1" width="18" x="10" y="10" />
                      <rect fill="#00687a" height="10" rx="0.5" width="10" x="14" y="14" />
                      <rect fill="#0f172a" height="28" rx="2" width="28" x="67" y="5" />
                      <rect fill="#ffffff" height="18" rx="1" width="18" x="72" y="10" />
                      <rect fill="#00687a" height="10" rx="0.5" width="10" x="76" y="14" />
                      <rect fill="#0f172a" height="28" rx="2" width="28" x="5" y="67" />
                      <rect fill="#ffffff" height="18" rx="1" width="18" x="10" y="72" />
                      <rect fill="#00687a" height="10" rx="0.5" width="10" x="14" y="76" />
                      <rect fill="#0f172a" height="6" width="6" x="38" y="8" />
                      <rect fill="#0f172a" height="6" width="8" x="48" y="8" />
                      <rect fill="#00687a" height="6" width="14" x="38" y="20" />
                      <rect fill="#0f172a" height="6" width="18" x="42" y="32" />
                      <rect fill="#0f172a" height="6" width="8" x="10" y="42" />
                      <rect fill="#0f172a" height="8" width="14" x="22" y="48" />
                      <rect fill="#00687a" height="6" width="10" x="8" y="56" />
                      <rect fill="#0f172a" height="10" width="8" x="66" y="38" />
                      <rect fill="#0f172a" height="6" width="14" x="78" y="44" />
                      <rect fill="#00687a" height="6" width="8" x="68" y="56" />
                      <rect fill="#0f172a" height="6" width="12" x="80" y="56" />
                      <rect fill="#57dffe" height="16" rx="2" width="18" x="40" y="46" />
                      <rect fill="#001f26" height="4" width="6" x="46" y="52" />
                      <rect fill="#0f172a" height="8" width="6" x="38" y="68" />
                      <rect fill="#0f172a" height="12" width="10" x="48" y="72" />
                      <rect fill="#0f172a" height="6" width="8" x="66" y="68" />
                      <rect fill="#00687a" height="14" width="14" x="66" y="78" />
                      <rect fill="#0f172a" height="8" width="8" x="84" y="84" />
                    </svg>
                  </div>

                  <span className="amx-qr-binding-pill">
                    QR WILL BE BOUND UPON REGISTRATION
                  </span>
                </div>
              </section>

              {/* CARD 5: Registration Summary & Submission */}
              <section className="amx-form-card">
                <div className="amx-form-card-header">
                  <div className="amx-card-title-group">
                    <div className="amx-card-title-row">
                      <span className="amx-card-dot" aria-hidden="true" />
                      <h2 className="amx-card-title">Registration Summary</h2>
                    </div>
                    <p className="amx-card-sub">Asset Readiness Checklist</p>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: 'var(--amx-dash-secondary)', fontSize: '22px' }}>
                    fact_check
                  </span>
                </div>

                <p className="amx-summary-checklist-title">The asset will be registered with:</p>

                <div className="amx-checklist-group">
                  <div className="amx-checklist-item">
                    <span className="material-symbols-outlined">task_alt</span>
                    <span>Asset information</span>
                  </div>
                  <div className="amx-checklist-item">
                    <span className="material-symbols-outlined">task_alt</span>
                    <span>Acquisition & warranty details</span>
                  </div>
                  <div className="amx-checklist-item">
                    <span className="material-symbols-outlined">task_alt</span>
                    <span>Custodian & location assignment</span>
                  </div>
                  <div className="amx-checklist-item">
                    <span className="material-symbols-outlined">task_alt</span>
                    <span>Supporting documents</span>
                  </div>
                </div>

                <div className="amx-summary-actions">
                  <button
                    type="submit"
                    className="amx-btn-submit-full"
                    disabled={isSubmitting}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      add_circle
                    </span>
                    <span>{isSubmitting ? 'Registering...' : 'Register Asset'}</span>
                  </button>

                  <button
                    type="button"
                    className="amx-btn-draft-full"
                    onClick={() => showToast('Save as Draft workflow — Scheduled for next release.')}
                  >
                    Save as Draft
                  </button>
                </div>

                <p className="amx-compliance-note">
                  By registering, this unit is indexed into the enterprise compliance ledger.
                </p>
              </section>
            </div>
          </div>
        </form>
    </DashboardLayout>
  );
};

export default AddNewAssetPage;
