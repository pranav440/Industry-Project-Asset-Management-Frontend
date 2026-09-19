import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AssetStatusBadge } from '../components/AssetStatusBadge';
import { createMaintenance, getAsset, listMaintenance, type AssetApiError, type MaintenanceApiRecord } from '../api/assetApi';
import type { AssetDetailsData } from '../data/assetDetailsData';
import './AssetMaintenance.css';

export interface MaintenanceRecordItem {
  id: string;
  date: string;
  isoDate: string;
  type: 'Preventive' | 'Corrective';
  vendor: string;
  technician?: string;
  cost: number;
  status: 'Completed' | 'Scheduled';
  notes?: string;
  timestamp?: string;
  loggedBy?: string;
}

interface AssetMaintenancePageProps {
  assetId?: string;
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

interface MaintenanceFormData {
  serviceDate: string;
  maintenanceType: string;
  serviceVendor: string;
  technician: string;
  maintenanceCost: string;
  serviceNotes: string;
}

interface MaintenanceFormErrors {
  serviceDate?: string;
  maintenanceType?: string;
  serviceVendor?: string;
  maintenanceCost?: string;
}

export const AssetMaintenancePage: React.FC<AssetMaintenancePageProps> = ({
  assetId = 'AST-NC-2026-0012',
  onNavigate,
  onSignOut,
}) => {
  const [asset, setAsset] = useState<AssetDetailsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Success Notification State
  const [successInfo, setSuccessInfo] = useState<{
    id: string;
    assetName: string;
    assetId: string;
    type: string;
    vendor: string;
    date: string;
  } | null>(null);

  const [records, setRecords] = useState<MaintenanceRecordItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedRecordForView, setSelectedRecordForView] = useState<MaintenanceRecordItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<MaintenanceFormData>({
    serviceDate: new Date().toISOString().split('T')[0],
    maintenanceType: '',
    serviceVendor: '',
    technician: '',
    maintenanceCost: '',
    serviceNotes: '',
  });

  const [formErrors, setFormErrors] = useState<MaintenanceFormErrors>({});

  const showToast = (message: string) => {
    setSaveError(message);
  };

  const formatDateDisplay = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const mapMaintenanceRecord = (record: MaintenanceApiRecord): MaintenanceRecordItem => ({
    id: record.maintenance_id,
    date: formatDateDisplay(record.service_date),
    isoDate: record.service_date,
    type: record.maintenance_type,
    vendor: record.service_vendor,
    technician: record.technician || undefined,
    cost: record.maintenance_cost,
    status: record.status,
    notes: record.service_notes || undefined,
    timestamp: record.created_at ? new Date(record.created_at).toLocaleString('en-IN') : undefined,
    loggedBy: record.created_by,
  });

  const apiErrorMessage = (error: unknown, fallback: string) => {
    const status = (error as AssetApiError)?.status;
    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'Admin access is required.';
    if (status === 404) return 'Asset not found.';
    if (status === 422) return error instanceof Error ? error.message : 'Please check the maintenance details.';
    if (status >= 500) return 'The server could not process the request.';
    return error instanceof Error ? error.message : fallback;
  };

  // Fetch asset context and persisted maintenance history.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setApiError(null);

    Promise.all([getAsset(assetId), listMaintenance(assetId)])
      .then(([record, maintenance]) => {
        if (!active) return;
        setAsset({
          id: record.asset_id,
          name: record.name,
          status: record.status,
          category: record.category,
          specification: record.specification || 'Standard Enterprise Laptop',
          serialNumber: record.serial_number || 'SN-88294-DL5430',
          assignedCustodianDepartment: record.custodian,
          assignedCustodianName: record.custodian,
          assignedLocation: record.location,
          assignedSubLocation: 'Dev Pod 4B',
          warrantyStatus: record.warranty_period,
          warrantyCover: '3-Year Onsite Cover',
          lifecycleStageText: 'Stage 2: Active Usage',
          estimatedEndOfLife: 'Jan 2028',
          qrVerifiedText: 'Verified & Active',
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
            accountabilityStatus: 'Active Assignment',
          },
          movementHistory: [],
          maintenanceHistory: [],
          auditHistory: [],
          qrCodeDataUrl: record.qr_code_data_url,
        });
        setRecords(maintenance.map(mapMaintenanceRecord));
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setApiError(apiErrorMessage(error, 'Unable to load asset maintenance information.'));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [assetId]);

  // Copy Asset ID helper
  const handleCopyId = () => {
    if (asset?.id) {
      navigator.clipboard?.writeText(asset.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return records.filter((rec) => {
      const matchType = typeFilter === 'ALL' || rec.type === typeFilter;
      const matchSearch =
        rec.vendor.toLowerCase().includes(term) ||
        (rec.technician && rec.technician.toLowerCase().includes(term)) ||
        rec.date.toLowerCase().includes(term) ||
        rec.type.toLowerCase().includes(term);
      return matchType && matchSearch;
    });
  }, [records, searchTerm, typeFilter]);

  // Derived Metrics
  const totalCostSum = useMemo(() => {
    return records.reduce((acc, curr) => acc + curr.cost, 0);
  }, [records]);

  // Open / Close Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      serviceDate: new Date().toISOString().split('T')[0],
      maintenanceType: '',
      serviceVendor: '',
      technician: '',
      maintenanceCost: '',
      serviceNotes: '',
    });
    setFormErrors({});
    setSaveError(null);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setFormErrors({});
  };

  // Field change
  const handleInputChange = (field: keyof MaintenanceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof MaintenanceFormErrors]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const nextErrors: MaintenanceFormErrors = {};
    if (!formData.serviceDate.trim()) {
      nextErrors.serviceDate = 'Service Date is required.';
    }
    if (!formData.maintenanceType.trim()) {
      nextErrors.maintenanceType = 'Maintenance Type is required.';
    }
    if (!formData.serviceVendor.trim()) {
      nextErrors.serviceVendor = 'Service Vendor is required.';
    }
    if (!formData.maintenanceCost.trim() || isNaN(Number(formData.maintenanceCost)) || Number(formData.maintenanceCost) < 0) {
      nextErrors.maintenanceCost = 'Valid Maintenance Cost is required.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Submit Add Maintenance Record
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const created = await createMaintenance(assetId, {
        service_date: formData.serviceDate,
        maintenance_type: formData.maintenanceType as 'Preventive' | 'Corrective',
        service_vendor: formData.serviceVendor.trim(),
        ...(formData.technician.trim() ? { technician: formData.technician.trim() } : {}),
        maintenance_cost: Number(formData.maintenanceCost),
        ...(formData.serviceNotes.trim() ? { service_notes: formData.serviceNotes.trim() } : {}),
      });
      const newRecord = mapMaintenanceRecord(created);
      setRecords((prev) => [newRecord, ...prev]);
      setIsAddModalOpen(false);
      setSuccessInfo({
        id: newRecord.id,
        assetName: asset?.name || 'Asset',
        assetId: asset?.id || assetId,
        type: newRecord.type,
        vendor: newRecord.vendor,
        date: newRecord.date,
      });
    } catch (error: unknown) {
      showToast(apiErrorMessage(error, 'Unable to save the maintenance record.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Navigation Helper
  const handleNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      onNavigate?.('dashboard');
    } else if (subRoute === 'assets') {
      onNavigate?.('assets');
    } else if (subRoute === 'signout' || subRoute === 'login') {
      onSignOut?.();
    } else if (subRoute.startsWith('assets/')) {
      onNavigate?.(subRoute);
    } else {
      onNavigate?.(`assets#${subRoute}`);
    }
  };

  if (loading) {
    return (
      <DashboardLayout currentNav="Assets" onNavigate={handleNav} onSignOut={onSignOut}>
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          Loading asset maintenance details...
        </div>
      </DashboardLayout>
    );
  }

  if (apiError || !asset) {
    return (
      <DashboardLayout currentNav="Assets" onNavigate={handleNav} onSignOut={onSignOut}>
        <div role="alert" style={{ padding: '40px', textAlign: 'center', color: '#ba1a1a' }}>
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
      onSearch={() => {}}
      searchPlaceholder="Search assets..."
      onAddAsset={() => onNavigate?.('assets/new')}
    >
      <div className="amx-maintenance-container">
        {/* Breadcrumb Navigation */}
        <nav className="amx-maintenance-breadcrumb" aria-label="Breadcrumb">
          <button
            type="button"
            className="amx-maintenance-back-btn"
            onClick={() => onNavigate?.('assets')}
          >
            Assets
          </button>
          <span className="amx-maintenance-breadcrumb-sep" aria-hidden="true">/</span>
          <button
            type="button"
            className="amx-maintenance-back-btn"
            onClick={() => onNavigate?.(`assets/${asset.id}`)}
          >
            Asset Details
          </button>
          <span className="amx-maintenance-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="amx-maintenance-breadcrumb-pill">{asset.id}</span>
          <span className="amx-maintenance-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="amx-maintenance-breadcrumb-curr">Maintenance</span>
        </nav>

        {/* Page Header */}
        <div className="amx-maintenance-header-row">
          <div className="amx-maintenance-title-col">
            <h1 className="amx-maintenance-title">Asset Maintenance</h1>
            <p className="amx-maintenance-subtitle">
              Track preventive maintenance, service activity, costs, and maintenance history for this organizational asset.
            </p>
          </div>
          <div className="amx-maintenance-header-actions">
            <button
              type="button"
              className="amx-maintenance-btn-back"
              onClick={() => onNavigate?.(`assets/${asset.id}`)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                arrow_back
              </span>
              <span>Back to Asset Details</span>
            </button>
            <button
              type="button"
              className="amx-maintenance-btn-primary"
              onClick={handleOpenAddModal}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                add
              </span>
              <span>Add Maintenance Record</span>
            </button>
          </div>
        </div>

        {/* Dynamic Success State Banner */}
        {successInfo && (
          <div className="amx-maintenance-success-banner" role="alert">
            <div className="amx-success-banner-left">
              <div className="amx-success-banner-icon">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  check_circle
                </span>
              </div>
              <div className="amx-success-banner-content">
                <h3 className="amx-success-banner-title">Maintenance Record Added</h3>
                <p className="amx-success-banner-desc">
                  Record saved for {successInfo.assetName} ({successInfo.assetId}).
                </p>
                <div className="amx-success-banner-meta">
                  <span><strong>Service Date:</strong> {successInfo.date}</span>
                  <span><strong>Type:</strong> {successInfo.type}</span>
                  <span><strong>Vendor:</strong> {successInfo.vendor}</span>
                </div>
              </div>
            </div>
            <div className="amx-success-banner-actions">
              <button
                type="button"
                className="amx-btn-view-details-link"
                onClick={() => onNavigate?.(`assets/${successInfo.assetId}`)}
              >
                View Asset Details
              </button>
              <button
                type="button"
                className="amx-btn-close-banner"
                onClick={() => setSuccessInfo(null)}
                aria-label="Close notification"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  close
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Asset Context & Registry Record Card */}
        <section className="amx-asset-context-card" aria-label="Asset Context and Registry Record">
          <div className="amx-context-card-header">
            <div className="amx-context-title-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                inventory_2
              </span>
              <span>Asset Context &amp; Registry Record</span>
            </div>
          </div>

          <div className="amx-context-grid">
            <div className="amx-context-item">
              <span className="amx-context-label">Asset ID</span>
              <div className="amx-context-id-row amx-context-id-wrap">
                <span className="amx-context-value mono">{asset.id}</span>
                <button
                  type="button"
                  className="amx-context-copy-btn"
                  onClick={handleCopyId}
                  title={copiedId ? 'Copied!' : 'Copy Asset ID'}
                  aria-label="Copy Asset ID"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {copiedId ? 'done' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

            <div className="amx-context-item">
              <span className="amx-context-label">Asset Name</span>
              <span className="amx-context-value" title={asset.name}>
                {asset.name}
              </span>
            </div>

            <div className="amx-context-item">
              <span className="amx-context-label">Category</span>
              <span className="amx-context-value" title={asset.category}>
                {asset.category}
              </span>
            </div>

            <div className="amx-context-item">
              <span className="amx-context-label">Current Status</span>
              <div>
                <AssetStatusBadge status={asset.status} />
              </div>
            </div>

            <div className="amx-context-item">
              <span className="amx-context-label">Location</span>
              <span className="amx-context-value" title={asset.assignedLocation}>
                {asset.assignedLocation}
              </span>
            </div>

            <div className="amx-context-item">
              <span className="amx-context-label">Assigned Custodian</span>
              <div className="amx-custodian-badge">
                <div className="amx-custodian-avatar">
                  {(asset.custody.assignedCustodian || asset.assignedCustodianName || 'MV')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <span className="amx-context-value" title={asset.custody.assignedCustodian || asset.assignedCustodianName}>
                  {asset.custody.assignedCustodian || asset.assignedCustodianName}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Master 2-Column Grid */}
        <div className="amx-maintenance-grid">
          {/* LEFT COLUMN: Main Area */}
          <div className="amx-maintenance-left-col">
            {/* 1. Maintenance Overview Metrics */}
            <div className="amx-metrics-row">
              <div className="amx-metric-card">
                <div className="amx-metric-top">
                  <span className="amx-metric-label">Last Service</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    event_available
                  </span>
                </div>
                <div className="amx-metric-bottom">
                  <div className="amx-metric-val">15 Jan 2024</div>
                  <div className="amx-metric-sub">Initial Deployment Check</div>
                </div>
              </div>

              <div className="amx-metric-card">
                <div className="amx-metric-top">
                  <span className="amx-metric-label">Next Due</span>
                  <span className="amx-metric-badge">Scheduled</span>
                </div>
                <div className="amx-metric-bottom">
                  <div className="amx-metric-val cyan">15 Oct 2025</div>
                  <div className="amx-metric-sub">Routine Preventive Service</div>
                </div>
              </div>

              <div className="amx-metric-card">
                <div className="amx-metric-top">
                  <span className="amx-metric-label">Total Cost</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    payments
                  </span>
                </div>
                <div className="amx-metric-bottom">
                  <div className="amx-metric-val mono">₹{totalCostSum.toLocaleString('en-IN')}</div>
                  <div className="amx-metric-sub">{records.length} Recorded Services</div>
                </div>
              </div>
            </div>

            {/* 2. Maintenance History Table Card */}
            <div className="amx-table-card">
              <div className="amx-table-header-bar">
                <div className="amx-table-title-area">
                  <h2 className="amx-table-title">Maintenance History</h2>
                  <span className="amx-record-count-badge">
                    {records.length} {records.length === 1 ? 'Record' : 'Records'}
                  </span>
                </div>
                <div className="amx-table-controls">
                  <div className="amx-search-wrap">
                    <span className="material-symbols-outlined amx-search-icon" aria-hidden="true">
                      search
                    </span>
                    <input
                      type="text"
                      className="amx-table-search-input"
                      placeholder="Filter records..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <select
                    className="amx-table-filter-select"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter by maintenance type"
                  >
                    <option value="ALL">All Types</option>
                    <option value="Preventive">Preventive</option>
                    <option value="Corrective">Corrective</option>
                  </select>

                  <button
                    type="button"
                    className="amx-table-add-shortcut"
                    onClick={handleOpenAddModal}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                      add
                    </span>
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Table Body or Empty State */}
              <div className="amx-table-scroll">
                {filteredRecords.length === 0 ? (
                  <div className="amx-empty-table-state">
                    <span className="material-symbols-outlined amx-empty-table-icon" aria-hidden="true">
                      {records.length === 0 ? 'build_circle' : 'search_off'}
                    </span>
                    <h3 className="amx-empty-table-title">
                      {records.length === 0 ? 'No maintenance records yet' : 'No matching records found'}
                    </h3>
                    <p className="amx-empty-table-desc">
                      {records.length === 0
                        ? 'Maintenance and service activity for this asset will appear here once recorded.'
                        : 'Try adjusting your search keywords or type filter.'}
                    </p>
                    {records.length === 0 && (
                      <button
                        type="button"
                        className="amx-maintenance-btn-primary"
                        style={{ marginTop: '12px' }}
                        onClick={handleOpenAddModal}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          add
                        </span>
                        <span>Add Maintenance Record</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="amx-data-table">
                    <thead>
                      <tr>
                        <th scope="col">Service Date</th>
                        <th scope="col">Type</th>
                        <th scope="col">Service Vendor</th>
                        <th scope="col">Technician</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Cost</th>
                        <th scope="col" style={{ textAlign: 'center' }}>Status</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((item) => (
                        <tr key={item.id} onClick={() => setSelectedRecordForView(item)} style={{ cursor: 'pointer' }}>
                          <td className="amx-td-date">{item.date}</td>
                          <td>
                            <span className="amx-type-pill">{item.type}</span>
                          </td>
                          <td className="amx-td-vendor">{item.vendor}</td>
                          <td className="amx-td-technician">{item.technician || '-'}</td>
                          <td className="amx-td-cost">₹{item.cost.toLocaleString('en-IN')}</td>
                          <td style={{ textAlign: 'center' }}>
                            {item.status === 'Completed' ? (
                              <span className="amx-status-pill-completed">
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                                  check_circle
                                </span>
                                <span>Completed</span>
                              </span>
                            ) : (
                              <span className="amx-status-pill-scheduled">
                                <span>Scheduled</span>
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="amx-btn-view-details"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecordForView(item);
                              }}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Table Footer */}
              {filteredRecords.length > 0 && (
                <div className="amx-table-footer">
                  <span>
                    Showing 1 to {filteredRecords.length} of {records.length} entries
                  </span>
                  <div className="amx-pagination-controls">
                    <button type="button" className="amx-page-btn" disabled>
                      Previous
                    </button>
                    <button type="button" className="amx-page-btn active">
                      1
                    </button>
                    <button type="button" className="amx-page-btn" disabled>
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Informational QR Note */}
              <div className="amx-qr-note-bar">
                <div className="amx-qr-note-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                    qr_code_scanner
                  </span>
                </div>
                <span className="amx-qr-note-text">
                  Asset QR can be scanned by field technicians at the service location for service verification.
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Upcoming Maintenance Card */}
          <div className="amx-maintenance-right-col">
            <div className="amx-upcoming-card">
              <div className="amx-upcoming-header">
                <div className="amx-upcoming-title-wrap">
                  <span className="material-symbols-outlined amx-upcoming-title-icon" aria-hidden="true">
                    event_upcoming
                  </span>
                  <span>Upcoming Maintenance</span>
                </div>
                <span className="amx-upcoming-badge">In 28 Days</span>
              </div>

              <div className="amx-upcoming-alert-box">
                <div className="amx-upcoming-asset-row">
                  <span className="amx-upcoming-asset-name">{asset.name}</span>
                  <span className="amx-status-pill-scheduled">Scheduled</span>
                </div>

                <div className="amx-upcoming-date-row">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    calendar_today
                  </span>
                  <span>Due Date: <span className="val">15 Oct 2025</span></span>
                </div>

                <div className="amx-upcoming-task-box">
                  <span className="amx-task-box-label">Task Description</span>
                  <span className="amx-task-box-content">Preventive Diagnostics &amp; Thermal Check</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Add Maintenance Record Modal */}
      {isAddModalOpen && (
        <div className="amx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="addModalTitle">
          <div className="amx-modal-dialog">
            <div className="amx-modal-header">
              <div className="amx-modal-header-text">
                <h2 id="addModalTitle" className="amx-modal-title">Add Maintenance Record</h2>
                <p className="amx-modal-subtitle">Record a completed or scheduled service event for {asset.id}</p>
              </div>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={handleCloseAddModal}
                aria-label="Close dialog"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  close
                </span>
              </button>
            </div>

            <form onSubmit={handleSaveRecord} noValidate>
              <div className="amx-modal-form-body">
                {saveError && (
                  <div role="alert" className="amx-field-error-msg" style={{ marginBottom: '12px' }}>
                    {saveError}
                  </div>
                )}
                {/* Target Asset Chip (Read-Only) */}
                <div className="amx-modal-asset-chip">
                  <div className="amx-modal-asset-info">
                    <span className="material-symbols-outlined">laptop_mac</span>
                    <span>{asset.name}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', color: '#64748b', fontSize: '12px' }}>
                      ({asset.id})
                    </span>
                  </div>
                  <span className="amx-modal-asset-tag">Asset Verified</span>
                </div>

                {/* Service Date & Maintenance Type */}
                <div className="amx-form-grid-2">
                  <div className="amx-form-field-group">
                    <label className="amx-form-label" htmlFor="formServiceDate">
                      Service Date <span className="amx-form-label-star">*</span>
                    </label>
                    <input
                      id="formServiceDate"
                      type="date"
                      className={`amx-form-input ${formErrors.serviceDate ? 'has-error' : ''}`}
                      value={formData.serviceDate}
                      onChange={(e) => handleInputChange('serviceDate', e.target.value)}
                    />
                    {formErrors.serviceDate && (
                      <span className="amx-field-error-msg">{formErrors.serviceDate}</span>
                    )}
                  </div>

                  <div className="amx-form-field-group">
                    <label className="amx-form-label" htmlFor="formMaintenanceType">
                      Maintenance Type <span className="amx-form-label-star">*</span>
                    </label>
                    <select
                      id="formMaintenanceType"
                      className={`amx-form-select ${formErrors.maintenanceType ? 'has-error' : ''}`}
                      value={formData.maintenanceType}
                      onChange={(e) => handleInputChange('maintenanceType', e.target.value)}
                    >
                      <option value="">Select type</option>
                      <option value="Preventive">Preventive</option>
                      <option value="Corrective">Corrective</option>
                    </select>
                    {formErrors.maintenanceType && (
                      <span className="amx-field-error-msg">{formErrors.maintenanceType}</span>
                    )}
                  </div>
                </div>

                {/* Service Vendor & Technician */}
                <div className="amx-form-grid-2">
                  <div className="amx-form-field-group">
                    <label className="amx-form-label" htmlFor="formServiceVendor">
                      Service Vendor <span className="amx-form-label-star">*</span>
                    </label>
                    <select
                      id="formServiceVendor"
                      className={`amx-form-select ${formErrors.serviceVendor ? 'has-error' : ''}`}
                      value={formData.serviceVendor}
                      onChange={(e) => handleInputChange('serviceVendor', e.target.value)}
                    >
                      <option value="">Select or enter service vendor</option>
                      <option value="Dell Care Services">Dell Care Services (Authorized)</option>
                      <option value="TechSupply Co. Ltd.">TechSupply Co. Ltd.</option>
                      <option value="In-house IT Ops">In-house IT Ops</option>
                      <option value="SysCom Solutions">SysCom Solutions</option>
                      <option value="Hardware Services Inc.">Hardware Services Inc.</option>
                    </select>
                    {formErrors.serviceVendor && (
                      <span className="amx-field-error-msg">{formErrors.serviceVendor}</span>
                    )}
                  </div>

                  <div className="amx-form-field-group">
                    <label className="amx-form-label" htmlFor="formTechnician">
                      Technician
                    </label>
                    <input
                      id="formTechnician"
                      type="text"
                      className="amx-form-input"
                      placeholder="Enter technician name (optional)"
                      value={formData.technician}
                      onChange={(e) => handleInputChange('technician', e.target.value)}
                    />
                  </div>
                </div>

                {/* Maintenance Cost */}
                <div className="amx-form-field-group">
                  <label className="amx-form-label" htmlFor="formCost">
                    Maintenance Cost (₹) <span className="amx-form-label-star">*</span>
                  </label>
                  <div className="amx-cost-input-wrap">
                    <span className="amx-cost-currency-symbol">₹</span>
                    <input
                      id="formCost"
                      type="number"
                      min="0"
                      step="50"
                      className={`amx-form-input amx-cost-input ${formErrors.maintenanceCost ? 'has-error' : ''}`}
                      placeholder="e.g. 2400"
                      value={formData.maintenanceCost}
                      onChange={(e) => handleInputChange('maintenanceCost', e.target.value)}
                    />
                  </div>
                  {formErrors.maintenanceCost && (
                    <span className="amx-field-error-msg">{formErrors.maintenanceCost}</span>
                  )}
                </div>

                {/* Service Notes / Description */}
                <div className="amx-form-field-group">
                  <label className="amx-form-label" htmlFor="formNotes">
                    Service Notes / Description
                  </label>
                  <textarea
                    id="formNotes"
                    rows={3}
                    className="amx-form-textarea"
                    placeholder="Enter service description, parts checked, or diagnostics outcome..."
                    value={formData.serviceNotes}
                    onChange={(e) => handleInputChange('serviceNotes', e.target.value)}
                  />
                </div>
              </div>

              <div className="amx-modal-footer">
                <button
                  type="button"
                  className="amx-btn-modal-cancel"
                  onClick={handleCloseAddModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amx-btn-modal-submit"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: View Record Details Modal */}
      {selectedRecordForView && (
        <div className="amx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="viewModalTitle">
          <div className="amx-modal-dialog">
            <div className="amx-modal-header">
              <div className="amx-modal-header-text">
                <h2 id="viewModalTitle" className="amx-modal-title">Maintenance Record Details</h2>
                <p className="amx-modal-subtitle" style={{ fontFamily: 'JetBrains Mono' }}>
                  {selectedRecordForView.id}
                </p>
              </div>
              <button
                type="button"
                className="amx-modal-close-btn"
                onClick={() => setSelectedRecordForView(null)}
                aria-label="Close dialog"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  close
                </span>
              </button>
            </div>

            <div className="amx-modal-form-body">
              <div className="amx-details-grid">
                <div className="amx-detail-field">
                  <span className="amx-detail-label">Service Date</span>
                  <span className="amx-detail-value mono">{selectedRecordForView.date}</span>
                </div>
                <div className="amx-detail-field">
                  <span className="amx-detail-label">Maintenance Type</span>
                  <div>
                    <span className="amx-type-pill">{selectedRecordForView.type}</span>
                  </div>
                </div>
                <div className="amx-detail-field">
                  <span className="amx-detail-label">Service Vendor</span>
                  <span className="amx-detail-value">{selectedRecordForView.vendor}</span>
                </div>
                <div className="amx-detail-field">
                  <span className="amx-detail-label">Technician</span>
                  <span className="amx-detail-value">{selectedRecordForView.technician || 'In-house IT'}</span>
                </div>
                <div className="amx-detail-field">
                  <span className="amx-detail-label">Service Cost</span>
                  <span className="amx-detail-value mono" style={{ color: '#00687a' }}>
                    ₹{selectedRecordForView.cost.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="amx-detail-field">
                  <span className="amx-detail-label">Service Status</span>
                  <div>
                    {selectedRecordForView.status === 'Completed' ? (
                      <span className="amx-status-pill-completed">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          check_circle
                        </span>
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span className="amx-status-pill-scheduled">Scheduled</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="amx-form-field-group">
                <span className="amx-detail-label">Full Service Notes &amp; Diagnostics</span>
                <div className="amx-detail-notes-box">
                  {selectedRecordForView.notes || 'No specific notes recorded for this maintenance cycle.'}
                </div>
              </div>

              {selectedRecordForView.timestamp && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#76777d' }}>
                  <span>Logged by: {selectedRecordForView.loggedBy || 'Unavailable'}</span>
                  <span>{selectedRecordForView.timestamp}</span>
                </div>
              )}
            </div>

            <div className="amx-modal-footer">
              <button
                type="button"
                className="amx-btn-modal-cancel"
                onClick={() => setSelectedRecordForView(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AssetMaintenancePage;
