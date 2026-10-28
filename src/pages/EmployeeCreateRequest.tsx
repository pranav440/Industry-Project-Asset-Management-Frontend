import React, { useState, useRef } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import { addEmployeeRequest } from '../data/employeeData';
import type { RequestItemData, RequestPriority, RequestType } from '../data/requestsData';
import './EmployeeCreateRequest.css';

interface EmployeeCreateRequestPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

interface LocalAttachment {
  id: string;
  name: string;
  size: string;
  uploadDate: string;
  type?: string;
}

const ASSET_CATEGORIES = [
  'Peripherals & Displays',
  'IT Equipment & Compute',
  'Office Furniture & Ergonomics',
  'Lab & Prototyping Hardware',
  'Audio / Visual Media Gear',
];

const ASSET_SUBCATEGORIES = [
  'External Displays & Mounts',
  'Adapters, Hubs & Docks',
  'Input Peripherals & Mice',
  'Laptops & Mobilised Units',
  'Standing Desks & Chairs',
];

const CONSUMABLE_CATEGORIES = [
  'IT Cables & Adapters',
  'Office & Printing Supplies',
  'Cleaning & Sanitization',
  'Pantry & Refreshments',
  'Maintenance Parts',
];

const CONSUMABLE_SUBCATEGORIES = [
  'Connectors & Dongles',
  'Stationery & Paper',
  'Sanitizers & Wipes',
  'Beverages & Snacks',
  'Fasteners & Tape',
];

export const EmployeeCreateRequestPage: React.FC<EmployeeCreateRequestPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [requestType, setRequestType] = useState<RequestType>('Asset Request');
  const [itemName, setItemName] = useState<string>('Dell UltraSharp 27 4K Monitor (U2723QE)');
  const [category, setCategory] = useState<string>('Peripherals & Displays');
  const [subCategory, setSubCategory] = useState<string>('External Displays & Mounts');
  const [quantity, setQuantity] = useState<number>(1);
  const [requiredDate, setRequiredDate] = useState<string>('2026-03-10');
  const [priority, setPriority] = useState<RequestPriority>('High');
  const [estimatedCost, setEstimatedCost] = useState<string>('579.00');
  const [justification, setJustification] = useState<string>(
    'Primary monitor for dual-display UI/UX design workflow and accessibility contrast verification across multi-resolution component libraries.'
  );

  // Attachments State (starts with 1 realistic sample document matching Stitch)
  const [attachments, setAttachments] = useState<LocalAttachment[]>([
    {
      id: 'att-sample-1',
      name: 'spec_sheet_dell_u2723qe.pdf',
      size: '1.4 MB',
      uploadDate: 'Uploaded today, 10:14 AM',
      type: 'pdf',
    },
  ]);

  // Submission & Validation States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRequest, setSubmittedRequest] = useState<RequestItemData | null>(null);
  const [showValidationBanner, setShowValidationBanner] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>(
    'Please complete all required fields indicated with an asterisk (*) before proceeding with workflow submission.'
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Switch Request Type
  const handleTypeChange = (type: RequestType) => {
    setRequestType(type);
    setShowValidationBanner(false);

    if (type === 'Asset Request') {
      setCategory('Peripherals & Displays');
      setSubCategory('External Displays & Mounts');
      if (!itemName || itemName.includes('adapters') || itemName.includes('Pack')) {
        setItemName('Dell UltraSharp 27 4K Monitor (U2723QE)');
      }
    } else {
      setCategory('IT Cables & Adapters');
      setSubCategory('Connectors & Dongles');
      if (!itemName || itemName.includes('Dell') || itemName.includes('Monitor')) {
        setItemName('USB-C to HDMI 4K braided adapters (Pack of 3)');
      }
    }
  };

  // Quantity stepper adjustments
  const handleQtyChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(99, prev + delta)));
  };

  // File Upload Handlers
  const handleDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: LocalAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

      newAttachments.push({
        id: `att-${Date.now()}-${i}`,
        name: file.name,
        size: sizeStr,
        uploadDate: 'Uploaded just now',
        type: file.type.includes('pdf') ? 'pdf' : 'image',
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    showToast(`Attached ${files.length} document(s).`);
    // reset input
    e.target.value = '';
  };

  const handleRemoveAttachment = (id: string, name: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    showToast(`Removed ${name}.`);
  };

  // Submit Handler with Strict Validation
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submissions

    // Validate Required Fields
    if (!itemName.trim() || !category.trim() || !justification.trim() || !requiredDate.trim()) {
      setValidationError(
        'Please complete all required fields indicated with an asterisk (*) before proceeding with workflow submission.'
      );
      setShowValidationBanner(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validate Positive Quantity
    if (!quantity || quantity <= 0 || isNaN(quantity)) {
      setValidationError('Quantity must be a positive number of at least 1 unit.');
      setShowValidationBanner(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setShowValidationBanner(false);

    try {
      const requesterName = currentUser?.full_name || 'Marcus Vance';
      const requesterEmail = currentUser?.email || 'employee@assetmx.local';
      const department =
        ((currentUser as unknown) as Record<string, unknown>)?.department as string ||
        (currentUser?.role === 'employee' ? 'Product Design' : 'Enterprise Operations');

      const created = addEmployeeRequest({
        requesterName,
        requesterEmail,
        department,
        requestType,
        requestedItem: itemName.trim(),
        category,
        quantity,
        priority,
        requestDate: new Date().toISOString().split('T')[0],
        status: 'Pending',
        justification: justification.trim(),
        estimatedCost: estimatedCost.trim() ? `$${estimatedCost.replace('$', '').trim()}` : undefined,
        attachments: attachments.map((a) => ({
          id: a.id,
          name: a.name,
          size: a.size,
          type: a.type,
        })),
      });

      setSubmittedRequest(created);
    } catch (err) {
      console.error('Failed to submit employee request', err);
      showToast('An unexpected error occurred while creating the requisition.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setSubmittedRequest(null);
    onNavigate?.('dashboard');
  };

  const handleViewInMyRequests = () => {
    setSubmittedRequest(null);
    onNavigate?.('my-requests');
  };

  const currentCategories =
    requestType === 'Asset Request' ? ASSET_CATEGORIES : CONSUMABLE_CATEGORIES;
  const currentSubCategories =
    requestType === 'Asset Request' ? ASSET_SUBCATEGORIES : CONSUMABLE_SUBCATEGORIES;

  // Derive User Profile Initials
  const userDisplayName = currentUser?.full_name || 'Marcus Vance';
  const userInitials = userDisplayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const userEmployeeId = currentUser?.employee_id || 'EMP-2024-0419';
  const userDepartment =
    ((currentUser as unknown) as Record<string, unknown>)?.department as string ||
    (currentUser?.role === 'employee' ? 'Product Design & Research' : 'Enterprise Operations');

  return (
    <DashboardLayout
      currentNav="Create Request"
      role="employee"
      userName={userDisplayName}
      userRoleSubtitle="Product Design (Employee)"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      searchPlaceholder="Search my requests, assets..."
      onNotificationsClick={() =>
        showToast('Notifications: Requisition pipeline active. 1 item under assessment.')
      }
      onHelpClick={() =>
        showToast('Help & Policies: Self-service requisitions require departmental sign-off.')
      }
      onProfileClick={() =>
        showToast(`Profile: ${userDisplayName} (${userEmployeeId}) — ${userDepartment}`)
      }
    >
      <div className="amx-cr-page">
        {/* Top Breadcrumb & Page Header */}
        <div className="amx-cr-header-wrap">
          <nav className="amx-cr-breadcrumbs" aria-label="Breadcrumb">
            <a
              href="#dashboard"
              className="amx-cr-crumb-link"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('dashboard');
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                grid_view
              </span>
              <span>Dashboard</span>
            </a>
            <span className="amx-cr-crumb-sep">/</span>
            <span className="amx-cr-crumb-current">Create Request</span>
          </nav>

          <div className="amx-cr-title-row">
            <div className="amx-cr-title-left">
              <div className="amx-cr-headline-group">
                <h1 className="amx-cr-headline">Create Request</h1>
                <span className="amx-cr-pill-badge">Self-Service Request</span>
              </div>
              <p className="amx-cr-subtitle">
                Submit a formal requisition for hardware assets or consumable supplies for departmental review.
              </p>
            </div>

            <div className="amx-cr-header-actions">
              <button
                type="button"
                className="amx-cr-btn-secondary-action"
                id="validationToggleBtn"
                onClick={() => setShowValidationBanner((prev) => !prev)}
                title="Toggle Validation State"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  rule
                </span>
                <span>Toggle Validation State</span>
              </button>
              <button
                type="button"
                className="amx-cr-btn-secondary-action"
                id="demoDraftBtn"
                onClick={() => showToast('Draft saved locally for this active session.')}
                title="Save Draft"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  bookmark_border
                </span>
                <span>Save Draft</span>
              </button>
            </div>
          </div>
        </div>

        {/* Validation Warning Banner */}
        {showValidationBanner && (
          <div className="amx-cr-validation-banner" id="validationBanner" role="alert">
            <span className="material-symbols-outlined amx-cr-val-icon" aria-hidden="true">
              warning
            </span>
            <div className="amx-cr-val-content">
              <span className="amx-cr-val-title">Incomplete Requisition Details</span>
              <span className="amx-cr-val-desc">{validationError}</span>
            </div>
            <button
              type="button"
              className="amx-cr-val-close-btn"
              onClick={() => setShowValidationBanner(false)}
              aria-label="Dismiss warning"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                close
              </span>
            </button>
          </div>
        )}

        {/* Main 12-Column Grid */}
        <div className="amx-cr-grid">
          {/* Left Canvas (8 Cols) */}
          <div className="amx-cr-col-main">
            {/* Step 01: Requisition Classification */}
            <section className="amx-cr-card" aria-labelledby="step01-label">
              <div className="amx-cr-card-header">
                <div className="amx-cr-step-title">
                  <span className="amx-cr-dot" aria-hidden="true"></span>
                  <span className="amx-cr-step-label" id="step01-label">
                    Step 01 • Requisition Classification
                  </span>
                </div>
                <span className="amx-cr-step-badge">TYPE-SEL</span>
              </div>

              <div className="amx-cr-type-grid" role="radiogroup" aria-label="Request Type Selection">
                {/* Asset Option */}
                <label
                  className={`amx-cr-type-option ${requestType === 'Asset Request' ? 'selected' : ''}`}
                  id="typeAssetLabel"
                  onClick={() => handleTypeChange('Asset Request')}
                >
                  <input
                    type="radio"
                    name="request_type"
                    value="asset"
                    id="typeAssetInput"
                    checked={requestType === 'Asset Request'}
                    onChange={() => handleTypeChange('Asset Request')}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <div className="amx-cr-type-top">
                    <div className="amx-cr-type-icon-box" aria-hidden="true">
                      <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                        devices
                      </span>
                    </div>
                    {requestType === 'Asset Request' && (
                      <div className="amx-cr-type-check-circle" id="assetCheck" aria-hidden="true">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          check
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="amx-cr-type-title">Asset Request</span>
                  <p className="amx-cr-type-desc">
                    Hardware, IT equipment &amp; machinery intended for ongoing custody and asset tagging.
                  </p>
                  <div className="amx-cr-type-tag">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                      shield
                    </span>
                    <span>Tagging Required</span>
                  </div>
                </label>

                {/* Consumable Option */}
                <label
                  className={`amx-cr-type-option ${requestType === 'Consumable Request' ? 'selected' : ''}`}
                  id="typeConsumableLabel"
                  onClick={() => handleTypeChange('Consumable Request')}
                >
                  <input
                    type="radio"
                    name="request_type"
                    value="consumable"
                    id="typeConsumableInput"
                    checked={requestType === 'Consumable Request'}
                    onChange={() => handleTypeChange('Consumable Request')}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <div className="amx-cr-type-top">
                    <div className="amx-cr-type-icon-box" aria-hidden="true">
                      <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                        inventory
                      </span>
                    </div>
                    {requestType === 'Consumable Request' && (
                      <div className="amx-cr-type-check-circle" id="consumableCheck" aria-hidden="true">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          check
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="amx-cr-type-title">Consumable Request</span>
                  <p className="amx-cr-type-desc">
                    Office supplies, accessories, connectors &amp; replacement materials intended for consumption.
                  </p>
                  <div className="amx-cr-type-tag">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                      all_out
                    </span>
                    <span>Direct Dispense</span>
                  </div>
                </label>
              </div>
            </section>

            {/* Step 02: Item Specifications */}
            <section className="amx-cr-card" aria-labelledby="step02-label">
              <div className="amx-cr-card-header">
                <div className="amx-cr-step-title">
                  <span className="amx-cr-dot" aria-hidden="true"></span>
                  <span className="amx-cr-step-label" id="step02-label">
                    Step 02 • Item Specifications
                  </span>
                </div>
                <span className="amx-cr-step-badge" id="modeIndicatorLabel">
                  {requestType === 'Asset Request' ? 'CUSTODY-ASSET' : 'CONSUMABLE-DISPENSE'}
                </span>
              </div>

              {/* Dynamic Policy Notice Banner */}
              <div className="amx-cr-policy-banner" id="contextNotice">
                <span className="material-symbols-outlined amx-cr-policy-icon" aria-hidden="true">
                  info
                </span>
                <div className="amx-cr-policy-text">
                  <span className="amx-cr-policy-title" id="noticeTitle">
                    {requestType === 'Asset Request'
                      ? 'Capital Asset Policy'
                      : 'Consumable Requisition Policy'}
                  </span>
                  <span className="amx-cr-policy-desc" id="noticeText">
                    {requestType === 'Asset Request'
                      ? 'Capital assets require supervisory sign-off and serial barcode provisioning. Allocation follows central inventory check.'
                      : 'Consumable items will be dispensed from facility stock. Dispatched items do not require return custody tags.'}
                  </span>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="amx-cr-form-grid">
                {/* Requested Item Name */}
                <div className="amx-cr-field-col-full">
                  <label className="amx-cr-label" htmlFor="itemName">
                    <span>Requested Item / Asset Name</span>
                    <span className="amx-cr-required">*</span>
                  </label>
                  <div className="amx-cr-input-wrapper">
                    <input
                      type="text"
                      id="itemName"
                      name="itemName"
                      className="amx-cr-input"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder={
                        requestType === 'Asset Request'
                          ? 'e.g. Dell UltraSharp 27 4K Monitor (U2723QE)'
                          : 'e.g. USB-C to HDMI 4K braided adapters (Pack of 3)'
                      }
                      required
                    />
                    <span className="material-symbols-outlined amx-cr-input-icon" aria-hidden="true">
                      search
                    </span>
                  </div>
                  <span className="amx-cr-field-hint">
                    Specify exact manufacturer make, model, or SKU if known.
                  </span>
                </div>

                {/* Category */}
                <div className="amx-cr-field-col">
                  <label className="amx-cr-label" htmlFor="itemCategory">
                    <span>Category</span>
                    <span className="amx-cr-required">*</span>
                  </label>
                  <div className="amx-cr-input-wrapper">
                    <select
                      id="itemCategory"
                      className="amx-cr-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    >
                      {currentCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sub-Category */}
                <div className="amx-cr-field-col">
                  <label className="amx-cr-label" htmlFor="itemSubCategory">
                    <span>Sub-category</span>
                  </label>
                  <div className="amx-cr-input-wrapper">
                    <select
                      id="itemSubCategory"
                      className="amx-cr-select"
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                    >
                      {currentSubCategories.map((sc) => (
                        <option key={sc} value={sc}>
                          {sc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantity */}
                <div className="amx-cr-field-col">
                  <label className="amx-cr-label" htmlFor="itemQuantity">
                    <span>Quantity</span>
                    <span className="amx-cr-required">*</span>
                  </label>
                  <div className="amx-cr-stepper">
                    <button
                      type="button"
                      id="qtyMinus"
                      className="amx-cr-stepper-btn"
                      onClick={() => handleQtyChange(-1)}
                      aria-label="Decrease quantity"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        remove
                      </span>
                    </button>
                    <input
                      type="number"
                      id="itemQuantity"
                      className="amx-cr-stepper-input"
                      value={quantity}
                      min={1}
                      max={99}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setQuantity(isNaN(val) ? 1 : val);
                      }}
                      required
                    />
                    <button
                      type="button"
                      id="qtyPlus"
                      className="amx-cr-stepper-btn"
                      onClick={() => handleQtyChange(1)}
                      aria-label="Increase quantity"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        add
                      </span>
                    </button>
                  </div>
                  <span className="amx-cr-field-hint">Min. 1 unit required per ticket.</span>
                </div>

                {/* Required-By Date */}
                <div className="amx-cr-field-col">
                  <label className="amx-cr-label" htmlFor="requiredDate">
                    <span>Required-By Date</span>
                    <span className="amx-cr-required">*</span>
                  </label>
                  <div className="amx-cr-input-wrapper">
                    <input
                      type="date"
                      id="requiredDate"
                      className="amx-cr-input"
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                      required
                    />
                  </div>
                  <span className="amx-cr-field-hint">
                    Employee requested date preference. Not a guaranteed fulfillment date.
                  </span>
                </div>

                {/* Priority Selector */}
                <div className="amx-cr-field-col">
                  <label className="amx-cr-label">
                    <span>Urgency / Priority</span>
                  </label>
                  <div className="amx-cr-priority-group" role="group" aria-label="Urgency priority selector">
                    {(['Low', 'Medium', 'High'] as RequestPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`amx-cr-priority-btn priority-btn ${priority === p ? 'active' : ''}`}
                        data-priority={p.toLowerCase()}
                        onClick={() => setPriority(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estimated Unit Cost */}
                <div className="amx-cr-field-col">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="amx-cr-label" htmlFor="unitCost">
                      <span>Estimated Unit Cost</span>
                    </label>
                    <span className="amx-cr-field-hint" style={{ fontSize: '11px' }}>
                      Optional
                    </span>
                  </div>
                  <div className="amx-cr-input-wrapper">
                    <span className="amx-cr-currency-prefix">$</span>
                    <input
                      type="text"
                      id="unitCost"
                      className="amx-cr-input amx-cr-input-with-currency"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      placeholder="550.00"
                    />
                  </div>
                  <span className="amx-cr-field-hint">Estimated benchmark or quotation price.</span>
                </div>
              </div>
            </section>

            {/* Step 03: Operational Context & Business Justification */}
            <section className="amx-cr-card" aria-labelledby="step03-label">
              <div className="amx-cr-card-header">
                <div className="amx-cr-step-title">
                  <span className="amx-cr-dot" aria-hidden="true"></span>
                  <span className="amx-cr-step-label" id="step03-label">
                    Step 03 • Operational Context
                  </span>
                </div>
                <span className="amx-cr-step-badge" id="charCounter">
                  {justification.length} / 500
                </span>
              </div>

              <div className="amx-cr-field-col-full">
                <label className="amx-cr-label" htmlFor="justification">
                  <span>Purpose &amp; Business Justification</span>
                  <span className="amx-cr-required">*</span>
                </label>
                <textarea
                  id="justification"
                  name="justification"
                  className="amx-cr-textarea"
                  maxLength={500}
                  rows={4}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Detail operational context, project impact, or device failure that necessitates this requisition..."
                  required
                />
                <span className="amx-cr-field-hint">
                  Provide clear business context explaining why existing equipment or common resources are insufficient for upcoming sprint deliverables.
                </span>
              </div>
            </section>

            {/* Step 04: Specifications & Memos (Attachments) */}
            <section className="amx-cr-card" aria-labelledby="step04-label">
              <div className="amx-cr-card-header">
                <div className="amx-cr-step-title">
                  <span className="amx-cr-dot" aria-hidden="true"></span>
                  <span className="amx-cr-step-label" id="step04-label">
                    Step 04 • Specifications &amp; Memos
                  </span>
                </div>
                <span className="amx-cr-step-badge">OPTIONAL-DOCS</span>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                aria-label="Upload document attachments"
              />

              {/* Dropzone Area */}
              <div
                className="amx-cr-dropzone"
                id="dropZoneArea"
                onClick={handleDropzoneClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleDropzoneClick();
                }}
              >
                <div className="amx-cr-dropzone-icon" aria-hidden="true">
                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                    cloud_upload
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span className="amx-cr-dropzone-text">
                    Click to upload specifications or drag and drop
                  </span>
                  <span className="amx-cr-dropzone-sub">
                    Supported: PDF, PNG, JPG, or DOCX (Client-side handling only)
                  </span>
                </div>
              </div>

              {/* Attached Files List */}
              {attachments.length > 0 && (
                <div className="amx-cr-files-list">
                  <span className="amx-cr-files-header">
                    Attached Documentation ({attachments.length})
                  </span>
                  {attachments.map((file) => (
                    <div className="amx-cr-file-card" key={file.id} id="sampleFileCard">
                      <div className="amx-cr-file-meta">
                        <div className="amx-cr-file-icon" aria-hidden="true">
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {file.type === 'pdf' ? 'description' : 'image'}
                          </span>
                        </div>
                        <div className="amx-cr-file-info">
                          <span className="amx-cr-file-name">{file.name}</span>
                          <span className="amx-cr-file-sub">
                            {file.size} • {file.uploadDate}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="amx-cr-file-remove-btn"
                          title="Remove attachment"
                          onClick={() => handleRemoveAttachment(file.id, file.name)}
                          aria-label={`Remove ${file.name}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Sidebar (4 Cols Sticky) */}
          <aside className="amx-cr-col-side" aria-label="Requester & Summary Preview">
            {/* Requester Profile Card */}
            <div className="amx-cr-card">
              <div className="amx-cr-card-header">
                <span className="amx-cr-step-label">Requester Profile</span>
                <span className="amx-cr-step-badge">ACTIVE-SESSION</span>
              </div>

              <div className="amx-cr-profile-row">
                <div className="amx-cr-avatar" aria-hidden="true">
                  {userInitials}
                </div>
                <div className="amx-cr-profile-info">
                  <span className="amx-cr-profile-name">{userDisplayName}</span>
                  <span className="amx-cr-profile-role">
                    {currentUser?.role === 'employee'
                      ? 'Lead Experience Designer'
                      : 'System Operator'}
                  </span>
                </div>
              </div>

              <div className="amx-cr-meta-box">
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Department</span>
                  <span className="amx-cr-meta-value">{userDepartment}</span>
                </div>
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Employee ID</span>
                  <span
                    className="amx-cr-meta-value"
                    style={{ color: 'var(--amx-dash-cyan, #00687a)' }}
                  >
                    {userEmployeeId}
                  </span>
                </div>
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Cost Center</span>
                  <span className="amx-cr-meta-value">CC-88210-UX</span>
                </div>
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Request Date</span>
                  <span className="amx-cr-meta-value">
                    {new Date().toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="amx-cr-policy-note">
                <span className="material-symbols-outlined amx-cr-policy-note-icon" aria-hidden="true">
                  verified_user
                </span>
                <span>Requisitions are routed according to standard departmental review policy.</span>
              </div>
            </div>

            {/* Submission Summary Card */}
            <div className="amx-cr-card">
              <div className="amx-cr-card-header">
                <span className="amx-cr-step-label">Submission Summary</span>
                <span className="amx-cr-step-badge">PREVIEW</span>
              </div>

              <p className="amx-cr-summary-lead">
                This request will be submitted for departmental review upon completion.
              </p>

              <div className="amx-cr-meta-box">
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Request Type</span>
                  <span className="amx-cr-meta-value" id="summaryRequestType">
                    {requestType}
                  </span>
                </div>
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Item</span>
                  <span
                    className="amx-cr-meta-value"
                    id="summaryItemName"
                    style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={itemName}
                  >
                    {itemName || 'Not specified'}
                  </span>
                </div>
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Category</span>
                  <span className="amx-cr-meta-value">{category}</span>
                </div>
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Quantity</span>
                  <span className="amx-cr-meta-value" id="summaryQuantity">
                    {quantity} {quantity === 1 ? 'Unit' : 'Units'}
                  </span>
                </div>
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Priority</span>
                  <span
                    className="amx-cr-meta-value"
                    style={{
                      color:
                        priority === 'High'
                          ? '#ba1a1a'
                          : priority === 'Medium'
                          ? '#00687a'
                          : '#45464d',
                    }}
                  >
                    {priority}
                  </span>
                </div>
                <div className="amx-cr-meta-row">
                  <span className="amx-cr-meta-label">Target Preference</span>
                  <span
                    className="amx-cr-meta-value"
                    id="summaryTargetPreference"
                    style={{ color: 'var(--amx-dash-cyan, #00687a)' }}
                  >
                    {requiredDate ? `Requested by ${requiredDate}` : 'Standard SLA'}
                  </span>
                </div>
                {estimatedCost && (
                  <div className="amx-cr-meta-row">
                    <span className="amx-cr-meta-label">Estimated Cost</span>
                    <span className="amx-cr-meta-value">${estimatedCost.replace('$', '')}</span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Sticky Submission Actions Footer */}
        <div className="amx-cr-bottom-bar">
          <div className="amx-cr-bottom-info">
            <span className="material-symbols-outlined amx-cr-bottom-info-icon" aria-hidden="true">
              help_outline
            </span>
            <p className="amx-cr-bottom-info-text">
              Required fields must be completed before submission. Submitting creates a requisition pending supervisor review and does not constitute guaranteed allocation.
            </p>
          </div>

          <div className="amx-cr-bottom-actions">
            <button
              type="button"
              className="amx-cr-btn-cancel"
              onClick={() => onNavigate?.('dashboard')}
            >
              Cancel
            </button>
            <button
              type="button"
              className="amx-cr-btn-submit"
              id="submitRequestBtn"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                send
              </span>
              <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Confirmation Modal */}
        {submittedRequest && (
          <div
            className="amx-cr-modal-backdrop"
            id="confirmationModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modalHeading"
          >
            <div className="amx-cr-modal-card">
              <div className="amx-cr-modal-top">
                <div className="amx-cr-modal-icon-wrap" aria-hidden="true">
                  <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                    task_alt
                  </span>
                </div>
                <button
                  type="button"
                  className="amx-cr-modal-close-btn"
                  id="closeModalBtn"
                  onClick={handleModalClose}
                  aria-label="Close confirmation dialog"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                    close
                  </span>
                </button>
              </div>

              <div className="amx-cr-modal-lead">
                <span className="amx-cr-modal-tag">Workflow Initiated</span>
                <h3 className="amx-cr-modal-headline" id="modalHeading">
                  Request Submitted Successfully
                </h3>
                <p className="amx-cr-modal-desc">
                  Your equipment requisition has been registered in the enterprise asset registry and dispatched to your department approver.
                </p>
              </div>

              <div className="amx-cr-modal-details-box">
                <div className="amx-cr-modal-detail-row">
                  <span className="amx-cr-modal-detail-label">Reference Identifier</span>
                  <span className="amx-cr-modal-id" id="modalReqId">
                    {submittedRequest.id}
                  </span>
                </div>
                <div className="amx-cr-modal-detail-row">
                  <span className="amx-cr-modal-detail-label">Status</span>
                  <span className="amx-cr-modal-status-pill">Pending Departmental Review</span>
                </div>
                <div className="amx-cr-modal-detail-row">
                  <span className="amx-cr-modal-detail-label">Requested Item</span>
                  <span
                    className="amx-cr-meta-value"
                    style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {submittedRequest.requestedItem}
                  </span>
                </div>
                <div className="amx-cr-modal-detail-row">
                  <span className="amx-cr-modal-detail-label">Review Routing</span>
                  <span className="amx-cr-meta-value">Supervisor / Department Head</span>
                </div>
              </div>

              <div className="amx-cr-modal-actions">
                <button
                  type="button"
                  className="amx-cr-modal-btn-primary"
                  id="viewMyRequestsBtn"
                  onClick={handleViewInMyRequests}
                >
                  View in My Requests
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="amx-cr-toast" role="status">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              info
            </span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EmployeeCreateRequestPage;
