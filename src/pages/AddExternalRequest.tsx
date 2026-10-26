import React, { useState, useRef } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  createExternalRequest,
  uploadRequestAttachment,
  RequestApiError,
  type ExternalRequestCreatePayload,
} from '../api/requestApi';
import {
  type RequestType,
  type RequestPriority,
  type RequestItemData,
} from '../data/requestsData';
import './AddExternalRequest.css';

interface AddExternalRequestPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export interface SelectedAttachment {
  id: string;
  file: File;
  name: string;
  size: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  error?: string;
  uploadedAttachmentId?: string;
}

interface FormState {
  dateReceived: string;
  externalReference: string;
  requesterName: string;
  department: string;
  contactInfo: string;
  requestType: RequestType;
  requestedItem: string;
  category: string;
  quantity: number;
  estimatedCost: string;
  procurementReference: string;
  priority: RequestPriority;
  justification: string;
}

interface FormErrors {
  dateReceived?: string;
  requesterName?: string;
  requestedItem?: string;
  category?: string;
  quantity?: string;
  justification?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'Peripherals & Displays', label: 'Peripherals & Displays' },
  { value: 'Computing Hardware', label: 'Computing Hardware' },
  { value: 'Network Infrastructure', label: 'Network Infrastructure' },
  { value: 'Office Equipment', label: 'Office Equipment' },
  { value: 'Facilities & Power', label: 'Facilities & Power' },
  { value: 'Consumables & Cables', label: 'Consumables & Cables' },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const AddExternalRequestPage: React.FC<AddExternalRequestPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [formData, setFormData] = useState<FormState>({
    dateReceived: '',
    externalReference: '',
    requesterName: '',
    department: '',
    contactInfo: '',
    requestType: 'Asset Request',
    requestedItem: '',
    category: '',
    quantity: 1,
    estimatedCost: '',
    procurementReference: '',
    priority: 'Medium',
    justification: '',
  });

  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<RequestItemData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } else if (subRoute === 'requests') {
      onNavigate?.('requests');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else {
      showToast(`${subRoute.charAt(0).toUpperCase() + subRoute.slice(1)} module — Scheduled for future backend integration.`);
      onNavigate?.(subRoute);
    }
  };

  const handleInputChange = (field: keyof FormState, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleQtyAdjust = (delta: number) => {
    const nextQty = Math.max(1, (Number(formData.quantity) || 1) + delta);
    handleInputChange('quantity', nextQty);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newItems: SelectedAttachment[] = Array.from(fileList).map((f) => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
      const isAllowedExt = ['.pdf', '.png', '.jpg', '.jpeg', '.docx'].includes(ext);
      const isAllowedSize = f.size <= 15 * 1024 * 1024;
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        name: f.name,
        size: formatFileSize(f.size),
        status: !isAllowedExt || !isAllowedSize ? 'failed' : 'pending',
        error: !isAllowedExt
          ? 'Unsupported format (allowed: .pdf, .png, .jpg, .jpeg, .docx)'
          : !isAllowedSize
          ? 'File exceeds 15 MiB limit'
          : undefined,
      };
    });

    setSelectedAttachments((prev) => [...prev, ...newItems]);
  };

  const handleRemoveAttachment = (id: string) => {
    setSelectedAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!formData.dateReceived.trim()) {
      nextErrors.dateReceived = 'Date Received is required';
    }
    if (!formData.requesterName.trim()) {
      nextErrors.requesterName = 'Requester Name is required';
    }
    if (!formData.requestedItem.trim()) {
      nextErrors.requestedItem = 'Requested Item / Asset Name is required';
    }
    if (!formData.category) {
      nextErrors.category = 'Category is required';
    }
    if (Number(formData.quantity) <= 0 || isNaN(Number(formData.quantity))) {
      nextErrors.quantity = 'Quantity must be at least 1';
    }
    if (!formData.justification.trim()) {
      nextErrors.justification = 'Business Justification is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      showToast('Please complete all required fields (*)');
      return;
    }

    const invalidFiles = selectedAttachments.filter(
      (f) => f.error && f.status === 'failed' && !f.uploadedAttachmentId
    );
    if (invalidFiles.length > 0) {
      showToast(`Please remove invalid files before submitting: ${invalidFiles.map((f) => f.name).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    setUploadErrorMsg(null);

    let currentReqId = createdRequestId;

    try {
      if (!currentReqId) {
        const email = formData.contactInfo.includes('@')
          ? formData.contactInfo.trim()
          : `${formData.requesterName.trim().toLowerCase().replace(/\s+/g, '.')}@external.local`;

        const payload: ExternalRequestCreatePayload = {
          request_source: 'External',
          date_received: formData.dateReceived,
          external_reference: formData.externalReference.trim() || undefined,
          requester_name: formData.requesterName.trim(),
          department: formData.department.trim() || undefined,
          contact_info: formData.contactInfo.trim() || undefined,
          requester_email: email,
          request_type: formData.requestType,
          requested_item: formData.requestedItem.trim(),
          category: formData.category,
          quantity: Number(formData.quantity) || 1,
          estimated_cost: formData.estimatedCost.trim() || undefined,
          procurement_reference: formData.procurementReference.trim() || undefined,
          priority: formData.priority,
          justification: formData.justification.trim(),
          processing_guidelines: 'External requisition recorded for administrative review.',
        };

        const res = await createExternalRequest(payload);
        currentReqId = res.request_id;
        setCreatedRequestId(currentReqId);
      }

      // Upload pending/failed attachments
      const updatedAttachments = [...selectedAttachments];
      let failedCount = 0;

      for (let i = 0; i < updatedAttachments.length; i++) {
        const att = updatedAttachments[i];
        if (att.status === 'success') continue;

        att.status = 'uploading';
        setSelectedAttachments([...updatedAttachments]);

        try {
          const uploadRes = await uploadRequestAttachment(currentReqId, att.file);
          att.status = 'success';
          att.uploadedAttachmentId = uploadRes.attachment_id;
          att.error = undefined;
        } catch (uploadErr: unknown) {
          att.status = 'failed';
          att.error =
            uploadErr instanceof RequestApiError
              ? uploadErr.message
              : uploadErr instanceof Error
              ? uploadErr.message
              : 'Upload failed';
          failedCount++;
        }
        setSelectedAttachments([...updatedAttachments]);
      }

      if (failedCount > 0) {
        setUploadErrorMsg(
          `Request ${currentReqId} has been created, but ${failedCount} attachment(s) failed to upload. Review the errors below and click "Retry Uploads".`
        );
        showToast(`Request created, but ${failedCount} attachment(s) failed to upload.`);
      } else {
        setCreatedRequest({
          id: currentReqId,
          requesterName: formData.requesterName.trim(),
          requesterEmail: formData.contactInfo.includes('@')
            ? formData.contactInfo.trim()
            : `${formData.requesterName.trim().toLowerCase().replace(/\s+/g, '.')}@external.local`,
          department: formData.department.trim() || 'General Operations',
          requestType: formData.requestType,
          requestedItem: formData.requestedItem.trim(),
          category: formData.category,
          quantity: Number(formData.quantity) || 1,
          priority: formData.priority,
          requestDate: formData.dateReceived,
          dateReceived: formData.dateReceived,
          externalReference: formData.externalReference.trim() || undefined,
          estimatedCost: formData.estimatedCost.trim() || undefined,
          procurementReference: formData.procurementReference.trim() || undefined,
          status: 'Pending',
          justification: formData.justification.trim(),
          history: [],
        });
        showToast('External request and all attachments recorded successfully');
      }
    } catch (err: unknown) {
      console.error('Failed to submit external request', err);
      const msg =
        err instanceof RequestApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to record external request';
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      dateReceived: '',
      externalReference: '',
      requesterName: '',
      department: '',
      contactInfo: '',
      requestType: 'Asset Request',
      requestedItem: '',
      category: '',
      quantity: 1,
      estimatedCost: '',
      procurementReference: '',
      priority: 'Medium',
      justification: '',
    });
    setSelectedAttachments([]);
    setCreatedRequestId(null);
    setUploadErrorMsg(null);
    setErrors({});
    setCreatedRequest(null);
  };

  return (
    <DashboardLayout
      currentNav="Requests"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() => showToast('No pending administrative notifications.')}
      onHelpClick={() => showToast('AssetMX External Request Documentation.')}
      onProfileClick={() => showToast('Active User: Administrator (Role: Admin).')}
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
            zIndex: 9999,
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

      <div className="amx-add-external-req-container">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="amx-breadcrumb-nav">
          <button
            type="button"
            className="amx-back-btn"
            onClick={() => onNavigate?.('requests')}
            aria-label="Back to Requests"
          >
            Requests
          </button>
          <span className="amx-breadcrumb-sep">/</span>
          <span className="amx-breadcrumb-curr">Add External Request</span>
        </nav>

        {/* Page Header Row */}
        <div className="amx-page-header-row">
          <div className="amx-page-title-col">
            <h1 className="amx-add-asset-title">Add External Request</h1>
            <p className="amx-add-asset-subtitle">
              Record an externally received request and attach supporting approval documents.
            </p>
          </div>
          <div className="amx-page-actions-group">
            <button
              type="button"
              className="amx-btn-cancel"
              onClick={() => onNavigate?.('requests')}
              id="cancel-external-req-btn"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                close
              </span>
              <span>Cancel</span>
            </button>
            <button
              type="button"
              className="amx-btn-register-primary"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              id="save-external-req-btn"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                save
              </span>
              <span>
                {isSubmitting
                  ? createdRequestId
                    ? 'Uploading...'
                    : 'Saving...'
                  : createdRequestId
                  ? 'Retry Uploads'
                  : 'Save Request'}
              </span>
            </button>
          </div>
        </div>

        {/* Master Form */}
        <form className="amx-ext-req-form" onSubmit={handleSubmit} noValidate>
          {/* Row 1: Section A (Source & Ref) & Section B (Requester Info) */}
          <div className="amx-ext-req-grid-2">
            {/* Card 1: Section A - Request Source & Reference */}
            <div className="amx-form-card">
              <div className="amx-form-card-header">
                <div className="amx-card-title-group">
                  <div className="amx-card-icon-wrap">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                      receipt_long
                    </span>
                  </div>
                  <div>
                    <h2 className="amx-card-title">Request Source &amp; Reference</h2>
                  </div>
                </div>
                <span className="amx-section-tag">SEC-01</span>
              </div>

              <div className="amx-card-body-stack">
                {/* Request Source (Read-only, Locked to External) */}
                <div className="amx-form-group">
                  <label className="amx-label">
                    <span className="amx-label-left">
                      Request Source <span className="amx-req-star">*</span>
                    </span>
                    <span className="amx-label-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                        lock
                      </span>
                      Locked
                    </span>
                  </label>
                  <div className="amx-input-wrap">
                    <input
                      type="text"
                      className="amx-input is-readonly amx-input-with-trailing-icon"
                      readOnly
                      value="External"
                      id="requestSource"
                      aria-label="Request Source"
                    />
                    <span className="material-symbols-outlined amx-trailing-icon" aria-hidden="true">
                      assignment_turned_in
                    </span>
                  </div>
                  <span className="amx-field-hint">
                    Designated intake channel for off-system requests.
                  </span>
                </div>

                {/* Date Received */}
                <div className="amx-form-group">
                  <label className="amx-label" htmlFor="dateReceived">
                    <span className="amx-label-left">
                      Date Received <span className="amx-req-star">*</span>
                    </span>
                  </label>
                  <div className="amx-input-wrap">
                    <input
                      type="date"
                      id="dateReceived"
                      className={`amx-input ${errors.dateReceived ? 'has-error' : ''}`}
                      value={formData.dateReceived}
                      onChange={(e) => handleInputChange('dateReceived', e.target.value)}
                      required
                    />
                  </div>
                  {errors.dateReceived && (
                    <span className="amx-field-error" role="alert">
                      {errors.dateReceived}
                    </span>
                  )}
                </div>

                {/* External Reference Number */}
                <div className="amx-form-group">
                  <label className="amx-label" htmlFor="extRef">
                    <span className="amx-label-left">External Reference Number</span>
                    <span className="amx-label-badge">Optional</span>
                  </label>
                  <div className="amx-input-wrap">
                    <input
                      type="text"
                      id="extRef"
                      className="amx-input"
                      placeholder="Enter external reference or paper voucher #"
                      value={formData.externalReference}
                      onChange={(e) => handleInputChange('externalReference', e.target.value)}
                    />
                  </div>
                  <span className="amx-field-hint">
                    Printed invoice ID, dispatch receipt stamp, or physical registry binder code.
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Section B - Requester Information */}
            <div className="amx-form-card">
              <div className="amx-form-card-header">
                <div className="amx-card-title-group">
                  <div className="amx-card-icon-wrap">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                      badge
                    </span>
                  </div>
                  <div>
                    <h2 className="amx-card-title">Requester Information</h2>
                  </div>
                </div>
                <span className="amx-section-tag">SEC-02</span>
              </div>

              <div className="amx-card-body-stack">
                {/* Requester Name */}
                <div className="amx-form-group">
                  <label className="amx-label" htmlFor="reqName">
                    <span className="amx-label-left">
                      Requester Name <span className="amx-req-star">*</span>
                    </span>
                  </label>
                  <div className="amx-input-wrap">
                    <span className="material-symbols-outlined amx-leading-icon" aria-hidden="true">
                      person_outline
                    </span>
                    <input
                      type="text"
                      id="reqName"
                      className={`amx-input amx-input-with-leading-icon ${errors.requesterName ? 'has-error' : ''}`}
                      placeholder="Enter requester full name"
                      value={formData.requesterName}
                      onChange={(e) => handleInputChange('requesterName', e.target.value)}
                      required
                    />
                  </div>
                  {errors.requesterName && (
                    <span className="amx-field-error" role="alert">
                      {errors.requesterName}
                    </span>
                  )}
                </div>

                {/* Organization / Department */}
                <div className="amx-form-group">
                  <label className="amx-label" htmlFor="reqOrg">
                    <span className="amx-label-left">Organization / Department</span>
                  </label>
                  <div className="amx-input-wrap">
                    <span className="material-symbols-outlined amx-leading-icon" aria-hidden="true">
                      domain
                    </span>
                    <input
                      type="text"
                      id="reqOrg"
                      className="amx-input amx-input-with-leading-icon"
                      placeholder="e.g. Facilities Management"
                      value={formData.department}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="amx-form-group">
                  <label className="amx-label" htmlFor="reqContact">
                    <span className="amx-label-left">Contact Information</span>
                    <span className="amx-label-badge">Email / Telephone</span>
                  </label>
                  <div className="amx-input-wrap">
                    <span className="material-symbols-outlined amx-leading-icon" aria-hidden="true">
                      contact_mail
                    </span>
                    <input
                      type="text"
                      id="reqContact"
                      className="amx-input amx-input-with-leading-icon"
                      placeholder="e.g. email or phone number"
                      value={formData.contactInfo}
                      onChange={(e) => handleInputChange('contactInfo', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section C: Requested Item Details */}
          <div className="amx-form-card">
            <div className="amx-form-card-header">
              <div className="amx-card-title-group">
                <div className="amx-card-icon-wrap">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    inventory_2
                  </span>
                </div>
                <div>
                  <h2 className="amx-card-title">Requested Item Details</h2>
                  <p className="amx-card-sub">
                    Classify the hardware asset or consumable batch specified in the requisition.
                  </p>
                </div>
              </div>
              <span className="amx-section-tag">SEC-03</span>
            </div>

            <div className="amx-fields-grid-3">
              {/* Request Type Toggle (Span Full) */}
              <div className="amx-form-group amx-col-span-full">
                <label className="amx-label">
                  <span className="amx-label-left">
                    Request Type <span className="amx-req-star">*</span>
                  </span>
                </label>
                <div className="amx-segmented-toggle" role="radiogroup" aria-label="Request Type">
                  <button
                    type="button"
                    className={`amx-toggle-option ${formData.requestType === 'Asset Request' ? 'active' : ''}`}
                    onClick={() => handleInputChange('requestType', 'Asset Request')}
                    role="radio"
                    aria-checked={formData.requestType === 'Asset Request'}
                  >
                    <span className="amx-toggle-dot" />
                    <span>Asset Request (Tracked Unit)</span>
                  </button>
                  <button
                    type="button"
                    className={`amx-toggle-option ${formData.requestType === 'Consumable Request' ? 'active' : ''}`}
                    onClick={() => handleInputChange('requestType', 'Consumable Request')}
                    role="radio"
                    aria-checked={formData.requestType === 'Consumable Request'}
                  >
                    <span className="amx-toggle-dot" />
                    <span>Consumable Request</span>
                  </button>
                </div>
              </div>

              {/* Requested Item / Asset Name (Span 2) */}
              <div className="amx-form-group amx-col-span-2">
                <label className="amx-label" htmlFor="itemName">
                  <span className="amx-label-left">
                    Requested Item / Asset Name <span className="amx-req-star">*</span>
                  </span>
                </label>
                <div className="amx-input-wrap">
                  <input
                    type="text"
                    id="itemName"
                    className={`amx-input ${errors.requestedItem ? 'has-error' : ''}`}
                    placeholder="e.g. Dell UltraSharp 32-inch Monitor"
                    value={formData.requestedItem}
                    onChange={(e) => handleInputChange('requestedItem', e.target.value)}
                    required
                  />
                </div>
                {errors.requestedItem && (
                  <span className="amx-field-error" role="alert">
                    {errors.requestedItem}
                  </span>
                )}
              </div>

              {/* Category */}
              <div className="amx-form-group">
                <label className="amx-label" htmlFor="itemCategory">
                  <span className="amx-label-left">
                    Category <span className="amx-req-star">*</span>
                  </span>
                </label>
                <div className="amx-input-wrap">
                  <select
                    id="itemCategory"
                    className={`amx-select ${errors.category ? 'has-error' : ''}`}
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined amx-trailing-icon" aria-hidden="true">
                    expand_more
                  </span>
                </div>
                {errors.category && (
                  <span className="amx-field-error" role="alert">
                    {errors.category}
                  </span>
                )}
              </div>

              {/* Quantity */}
              <div className="amx-form-group">
                <label className="amx-label" htmlFor="itemQty">
                  <span className="amx-label-left">
                    Quantity <span className="amx-req-star">*</span>
                  </span>
                </label>
                <div className={`amx-qty-stepper ${errors.quantity ? 'has-error' : ''}`}>
                  <button
                    type="button"
                    className="amx-qty-btn"
                    onClick={() => handleQtyAdjust(-1)}
                    aria-label="Decrease quantity"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      remove
                    </span>
                  </button>
                  <input
                    type="number"
                    id="itemQty"
                    className="amx-qty-input"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value, 10) || 1)}
                    required
                  />
                  <button
                    type="button"
                    className="amx-qty-btn"
                    onClick={() => handleQtyAdjust(1)}
                    aria-label="Increase quantity"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      add
                    </span>
                  </button>
                </div>
                {errors.quantity && (
                  <span className="amx-field-error" role="alert">
                    {errors.quantity}
                  </span>
                )}
              </div>

              {/* Estimated Cost */}
              <div className="amx-form-group">
                <label className="amx-label" htmlFor="itemCost">
                  <span className="amx-label-left">Estimated Cost</span>
                  <span className="amx-label-badge">Approximate</span>
                </label>
                <div className="amx-input-wrap">
                  <span className="amx-currency-symbol">₹</span>
                  <input
                    type="text"
                    id="itemCost"
                    className="amx-input amx-input-currency"
                    placeholder="0.00"
                    value={formData.estimatedCost}
                    onChange={(e) => handleInputChange('estimatedCost', e.target.value)}
                  />
                </div>
              </div>

              {/* Procurement Reference */}
              <div className="amx-form-group">
                <label className="amx-label" htmlFor="itemProcRef">
                  <span className="amx-label-left">Procurement Reference</span>
                  <span className="amx-label-badge">PO / Requisition</span>
                </label>
                <div className="amx-input-wrap">
                  <input
                    type="text"
                    id="itemProcRef"
                    className="amx-input"
                    placeholder="Enter PO or requisition reference if applicable"
                    value={formData.procurementReference}
                    onChange={(e) => handleInputChange('procurementReference', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section D: Business Justification & Priority */}
          <div className="amx-form-card">
            <div className="amx-form-card-header">
              <div className="amx-card-title-group">
                <div className="amx-card-icon-wrap">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    rate_review
                  </span>
                </div>
                <div>
                  <h2 className="amx-card-title">Business Justification &amp; Priority</h2>
                  <p className="amx-card-sub">
                    Provide context for allocation audits and procurement governance.
                  </p>
                </div>
              </div>
              <span className="amx-section-tag">SEC-04</span>
            </div>

            <div className="amx-ext-req-grid-2">
              {/* Priority Select */}
              <div className="amx-form-group">
                <label className="amx-label">
                  <span className="amx-label-left">
                    Priority Level <span className="amx-req-star">*</span>
                  </span>
                </label>
                <div className="amx-priority-card-group" role="radiogroup" aria-label="Priority Level">
                  {/* High */}
                  <div
                    className={`amx-priority-card ${formData.priority === 'High' ? 'selected' : ''}`}
                    onClick={() => handleInputChange('priority', 'High')}
                    role="radio"
                    aria-checked={formData.priority === 'High'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === ' ' && handleInputChange('priority', 'High')}
                  >
                    <div className="amx-priority-left">
                      <span className="amx-priority-dot high" />
                      <span className="amx-priority-name">High</span>
                    </div>
                    <span className="amx-priority-badge high">Urgent Operational</span>
                  </div>

                  {/* Medium */}
                  <div
                    className={`amx-priority-card ${formData.priority === 'Medium' ? 'selected' : ''}`}
                    onClick={() => handleInputChange('priority', 'Medium')}
                    role="radio"
                    aria-checked={formData.priority === 'Medium'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === ' ' && handleInputChange('priority', 'Medium')}
                  >
                    <div className="amx-priority-left">
                      <span className="amx-priority-dot medium" />
                      <span className="amx-priority-name">Medium</span>
                    </div>
                    <span className="amx-priority-badge medium">Standard Schedule</span>
                  </div>

                  {/* Low */}
                  <div
                    className={`amx-priority-card ${formData.priority === 'Low' ? 'selected' : ''}`}
                    onClick={() => handleInputChange('priority', 'Low')}
                    role="radio"
                    aria-checked={formData.priority === 'Low'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === ' ' && handleInputChange('priority', 'Low')}
                  >
                    <div className="amx-priority-left">
                      <span className="amx-priority-dot low" />
                      <span className="amx-priority-name">Low</span>
                    </div>
                    <span className="amx-priority-badge low">Backlog / Planned</span>
                  </div>
                </div>
              </div>

              {/* Business Justification */}
              <div className="amx-form-group">
                <label className="amx-label" htmlFor="justification">
                  <span className="amx-label-left">
                    Business Justification <span className="amx-req-star">*</span>
                  </span>
                  <span className="amx-label-badge" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formData.justification.length} / 500 chars
                  </span>
                </label>
                <div className="amx-input-wrap">
                  <textarea
                    id="justification"
                    rows={4}
                    maxLength={500}
                    className={`amx-textarea ${errors.justification ? 'has-error' : ''}`}
                    placeholder="Provide operational justification for this external request..."
                    value={formData.justification}
                    onChange={(e) => handleInputChange('justification', e.target.value)}
                    required
                  />
                </div>
                {errors.justification && (
                  <span className="amx-field-error" role="alert">
                    {errors.justification}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px', color: 'var(--amx-dash-text-muted)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--amx-dash-secondary)' }}>
                    info
                  </span>
                  <span>Detail the business purpose or operational need for this request.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section E: Supporting Approval Documents */}
          <div className="amx-form-card">
            <div className="amx-form-card-header">
              <div className="amx-card-title-group">
                <div className="amx-card-icon-wrap">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    attachment
                  </span>
                </div>
                <div>
                  <h2 className="amx-card-title">Supporting Approval Documents</h2>
                  <p className="amx-card-sub">
                    Attach scanned approval documents, signed forms, PDFs, or other supporting files.
                  </p>
                </div>
              </div>
              <span className="amx-section-tag">
                {selectedAttachments.length} {selectedAttachments.length === 1 ? 'FILE' : 'FILES'} ATTACHED
              </span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              className={`amx-dropzone ${isDragging ? 'is-dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-label="Upload supporting approval files"
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
                accept=".pdf,.png,.jpg,.jpeg,.docx"
              />
              <div className="amx-dropzone-icon-circle">
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }} aria-hidden="true">
                  cloud_upload
                </span>
              </div>
              <p className="amx-dropzone-title">
                Drag and drop approval files here, or <strong>browse files</strong>
              </p>
              <span className="amx-dropzone-hint">
                Supported formats: PDF, PNG, JPG, JPEG, DOCX (Max 15 MiB per file)
              </span>
            </div>

            {/* Upload Error Banner if partial failure occurred */}
            {uploadErrorMsg && (
              <div
                style={{
                  margin: '14px 0',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  color: '#dc2626',
                  fontSize: '13.5px',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  warning
                </span>
                <span>{uploadErrorMsg}</span>
              </div>
            )}

            {/* Attached Records List */}
            <div className="amx-attached-section">
              <div className="amx-attached-title">Attached Records</div>
              {selectedAttachments.length === 0 ? (
                <div className="amx-no-attachments">
                  <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--amx-dash-border)', marginBottom: '4px' }} aria-hidden="true">
                    folder_open
                  </span>
                  <p className="amx-no-attachments-text">No files attached yet</p>
                  <p className="amx-no-attachments-sub">
                    Upload scanned paper forms, memos, or invoices.
                  </p>
                </div>
              ) : (
                <div className="amx-attachments-list">
                  {selectedAttachments.map((file) => (
                    <div key={file.id} className="amx-attachment-item">
                      <div className="amx-attachment-info-left">
                        <span className="material-symbols-outlined amx-attachment-file-icon" aria-hidden="true">
                          {file.name.endsWith('.pdf')
                            ? 'picture_as_pdf'
                            : file.name.match(/\.(png|jpg|jpeg)$/i)
                            ? 'image'
                            : 'description'}
                        </span>
                        <div className="amx-attachment-meta">
                          <span className="amx-attachment-name" title={file.name}>
                            {file.name}
                          </span>
                          <span className="amx-attachment-size">
                            {file.size}
                            {file.status === 'uploading' && ' • Uploading to secure server...'}
                            {file.status === 'success' && ' • Stored securely on server'}
                            {file.status === 'failed' && ` • Error: ${file.error || 'Upload failed'}`}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {file.status === 'success' && (
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '20px', color: '#10b981' }}
                            title="Uploaded and stored securely"
                          >
                            check_circle
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '20px', color: '#ef4444' }}
                            title={file.error || 'Upload failed'}
                          >
                            error
                          </span>
                        )}
                        {file.status !== 'uploading' && (
                          <button
                            type="button"
                            className="amx-attachment-remove-btn"
                            onClick={() => handleRemoveAttachment(file.id)}
                            aria-label={`Remove ${file.name}`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              close
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="amx-bottom-actions-bar">
            <div className="amx-bottom-info">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--amx-dash-secondary)' }}>
                info
              </span>
              <span>
                <strong style={{ color: 'var(--amx-dash-error)' }}>*</strong> Required fields must be completed before recording into the master registry.
              </span>
            </div>
            <div className="amx-bottom-buttons">
              <button
                type="button"
                className="amx-btn-cancel"
                onClick={() => onNavigate?.('requests')}
              >
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className="amx-btn-register-primary"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  save
                </span>
                <span>
                  {isSubmitting
                    ? createdRequestId
                      ? 'Uploading...'
                      : 'Saving...'
                    : createdRequestId
                    ? 'Retry Uploads'
                    : 'Save Request'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Success Confirmation Modal */}
      {createdRequest && (
        <div className="amx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="amx-modal-card">
            <div className="amx-modal-top-row">
              <div className="amx-modal-check-circle">
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                  check_circle
                </span>
              </div>
              <div className="amx-modal-title-col">
                <span className="amx-modal-badge">Request Recorded</span>
                <h3 className="amx-modal-title" id="modal-title">
                  External Request Recorded
                </h3>
                <p className="amx-modal-desc">
                  Request record has been created for review in the Requests list.
                </p>
              </div>
            </div>

            <div className="amx-modal-info-box">
              <div className="amx-modal-info-row">
                <span className="amx-modal-info-label">Request ID:</span>
                <span className="amx-modal-info-val highlight">{createdRequest.id}</span>
              </div>
              <div className="amx-modal-info-row">
                <span className="amx-modal-info-label">Status:</span>
                <span className="amx-modal-info-val highlight">Ready for Review</span>
              </div>
              <div className="amx-modal-info-row">
                <span className="amx-modal-info-label">Channel:</span>
                <span className="amx-modal-info-val">External Intake</span>
              </div>
              <div className="amx-modal-info-row">
                <span className="amx-modal-info-label">Item / Asset:</span>
                <span className="amx-modal-info-val">{createdRequest.requestedItem}</span>
              </div>
              <div className="amx-modal-info-row">
                <span className="amx-modal-info-label">Requester:</span>
                <span className="amx-modal-info-val">{createdRequest.requesterName}</span>
              </div>
            </div>

            <div className="amx-modal-actions">
              <button
                type="button"
                className="amx-btn-modal-secondary"
                onClick={handleResetForm}
                id="create-another-btn"
              >
                Create Another
              </button>
              <button
                type="button"
                className="amx-btn-modal-primary"
                onClick={() => onNavigate?.('requests')}
                id="view-in-requests-btn"
              >
                <span>View in Requests</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AddExternalRequestPage;
