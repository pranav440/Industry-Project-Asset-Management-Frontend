// =====================================================================
// AssetMX Employee My Assigned Assets Page — Frozen Stitch Design
// Self-Service inventory of non-consumable assets formally assigned to the employee
// =====================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import { listMyAssets, AssetApiError, type AssetRecord } from '../api/assetApi';
import './EmployeeMyAssignedAssets.css';

interface EmployeeMyAssignedAssetsPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

type CategoryFilterKey = 'all' | 'compute' | 'displays' | 'peripherals' | 'mobile';

export interface EmployeeAssignedAsset {
  id: string;
  name: string;
  category: string;
  categoryKey: string;
  location: string;
  status: string;
  statusCode: 'active' | 'maintenance' | 'transit';
  icon: string;
  specification: string;
  assignedDate: string;
  custodianName: string;
  custodianEmpId: string;
  custodianDepartment: string;
  serialNumber: string;
  hardwareModel: string;
  qrCodeDataUrl?: string;
  qrCodeValue?: string;
  technicalSpecs: Array<{ label: string; value: string }>;
  custodyLog: Array<{ date: string; time: string; event: string }>;
  acquisition: {
    purchaseDate: string;
    warrantyStatus: string;
    warrantyCover: string;
    totalCost: string;
  };
}

function getAssetIcon(category?: string, name?: string): string {
  const text = `${category || ''} ${name || ''}`.toLowerCase();
  if (text.includes('laptop') || text.includes('macbook') || text.includes('thinkpad') || text.includes('compute')) {
    return 'laptop_mac';
  }
  if (text.includes('monitor') || text.includes('display') || text.includes('ultrasharp')) {
    return 'desktop_windows';
  }
  if (text.includes('mouse') || text.includes('keyboard') || text.includes('peripheral') || text.includes('adapter')) {
    return 'mouse';
  }
  if (text.includes('phone') || text.includes('mobile') || text.includes('tablet')) {
    return 'smartphone';
  }
  return 'devices';
}

function normalizeCategoryKey(cat?: string): string {
  const c = (cat || '').toLowerCase();
  if (/compute|laptop|workstation/i.test(c)) return 'compute';
  if (/display|monitor/i.test(c)) return 'displays';
  if (/peripheral|audio|headset|keyboard|mouse/i.test(c)) return 'peripherals';
  if (/mobile|security|tablet|key/i.test(c)) return 'mobile';
  return 'other';
}

export const EmployeeMyAssignedAssetsPage: React.FC<EmployeeMyAssignedAssetsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();
  const [apiAssets, setApiAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterKey>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Selected asset for right-rail inspection drawer
  const [selectedAsset, setSelectedAsset] = useState<EmployeeAssignedAsset | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAssets = () => {
    setLoading(true);
    setError(null);
    listMyAssets({ pageSize: 100 })
      .then((res) => {
        setApiAssets(res.items || []);
      })
      .catch((err) => {
        setError(
          err instanceof AssetApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Unable to load assigned assets'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleCopy = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    showToast(`Copied ${text} to clipboard`);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const userDisplayName = currentUser?.full_name || 'Marcus Vance';
  const userEmpId = currentUser?.employee_id || 'EMP-2024-0419';
  const userDept = (currentUser as any)?.department || 'Product Design & UX';

  // Map API records to rich EmployeeAssignedAsset model
  const rawAssets = useMemo<EmployeeAssignedAsset[]>(() => {
    return apiAssets.map((asset) => {
      const catKey = normalizeCategoryKey(asset.category);
      const isMaint = (asset.status || '').toLowerCase().includes('maintenance');
      const isTransit = (asset.status || '').toLowerCase().includes('transit');
      const statusCode: 'active' | 'maintenance' | 'transit' = isMaint
        ? 'maintenance'
        : isTransit
        ? 'transit'
        : 'active';

      const technicalSpecs = [
        { label: 'Hardware Serial Number', value: asset.serial_number || 'N/A' },
        { label: 'Specification', value: asset.specification || asset.category },
        { label: 'Category', value: asset.category },
        { label: 'Vendor / Brand', value: asset.vendor_name || 'Standard Vendor' },
        { label: 'Warranty Period', value: asset.warranty_period || 'Standard Coverage' },
        { label: 'QR Tag Code', value: asset.qr_code_value || `assetmx:${asset.asset_id}` },
      ];

      const custodyLog =
        asset.movement_history && asset.movement_history.length > 0
          ? asset.movement_history.map((m) => ({
              date: m.initiated_at ? m.initiated_at.split('T')[0] : 'Recorded',
              time: m.status || 'Completed',
              event: `Transferred from ${m.from_location} to ${m.to_location} (${m.from_custodian} → ${m.to_custodian}). Reason: ${m.reason || 'Workstation setup'}.`,
            }))
          : [
              {
                date: asset.allocation_date
                  ? asset.allocation_date.split('T')[0]
                  : asset.purchase_date
                  ? asset.purchase_date.split('T')[0]
                  : 'Recorded',
                time: 'Initial Assignment',
                event: `Allocated to ${asset.custodian} at ${asset.location}.`,
              },
            ];

      return {
        id: asset.asset_id,
        name: asset.name,
        category: asset.category,
        categoryKey: catKey,
        location: asset.location,
        status: asset.status,
        statusCode,
        icon: getAssetIcon(asset.category, asset.name),
        specification: asset.specification || asset.category,
        assignedDate: asset.allocation_date
          ? asset.allocation_date.split('T')[0]
          : asset.purchase_date
          ? asset.purchase_date.split('T')[0]
          : 'Recorded',
        custodianName: asset.custodian || userDisplayName,
        custodianEmpId: userEmpId,
        custodianDepartment: userDept,
        serialNumber: asset.serial_number || 'SN-RECORDED-TAG',
        hardwareModel: asset.specification || asset.name,
        qrCodeDataUrl: asset.qr_code_data_url,
        qrCodeValue: asset.qr_code_value,
        technicalSpecs,
        custodyLog,
        acquisition: {
          purchaseDate: asset.purchase_date ? asset.purchase_date.split('T')[0] : 'N/A',
          warrantyStatus: asset.warranty_period || 'Standard Coverage',
          warrantyCover: `Vendor: ${asset.vendor_name || 'Standard'}`,
          totalCost: asset.total_cost ? `₹${asset.total_cost}` : 'Recorded',
        },
      };
    });
  }, [apiAssets, userDisplayName, userEmpId, userDept]);

  // Derive summary metrics from the employee's assigned assets
  const totalCount = rawAssets.length;
  const activeCount = rawAssets.filter(
    (a) => a.statusCode === 'active' || a.status.toLowerCase().includes('active')
  ).length;
  const maintenanceCount = rawAssets.filter(
    (a) => a.statusCode === 'maintenance' || a.status.toLowerCase().includes('maintenance')
  ).length;
  const transitCount = rawAssets.filter(
    (a) => a.statusCode === 'transit' || a.status.toLowerCase().includes('transit')
  ).length;

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return rawAssets.filter((asset) => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'compute') {
          const match =
            asset.categoryKey === 'compute' ||
            /compute|laptop|workstation/i.test(asset.category);
          if (!match) return false;
        } else if (selectedCategory === 'displays') {
          const match =
            asset.categoryKey === 'displays' ||
            /display|monitor/i.test(asset.category);
          if (!match) return false;
        } else if (selectedCategory === 'peripherals') {
          const match =
            asset.categoryKey === 'peripherals' ||
            /peripheral|audio|headset|keyboard|mouse/i.test(asset.category);
          if (!match) return false;
        } else if (selectedCategory === 'mobile') {
          const match =
            asset.categoryKey === 'mobile' ||
            /mobile|security|tablet|key/i.test(asset.category);
          if (!match) return false;
        }
      }

      // Status filter
      if (selectedStatus) {
        if (selectedStatus === 'active' && !asset.status.toLowerCase().includes('active')) {
          return false;
        }
        if (
          selectedStatus === 'maintenance' &&
          !asset.status.toLowerCase().includes('maintenance')
        ) {
          return false;
        }
        if (selectedStatus === 'transit' && !asset.status.toLowerCase().includes('transit')) {
          return false;
        }
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch =
          asset.id.toLowerCase().includes(term) ||
          asset.name.toLowerCase().includes(term) ||
          (asset.specification && asset.specification.toLowerCase().includes(term)) ||
          (asset.category && asset.category.toLowerCase().includes(term)) ||
          (asset.location && asset.location.toLowerCase().includes(term)) ||
          (asset.serialNumber && asset.serialNumber.toLowerCase().includes(term));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [rawAssets, selectedCategory, selectedStatus, searchTerm]);

  // Open asset inspection drawer
  const handleOpenDetails = (asset: EmployeeAssignedAsset) => {
    const isAllocated = rawAssets.some((a) => a.id === asset.id);
    if (!isAllocated) {
      setDrawerError('Asset Record Not Found or Access Restricted');
      setSelectedAsset(null);
    } else {
      setDrawerError(null);
      setSelectedAsset(asset);
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedAsset(null);
    setDrawerError(null);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedStatus('');
  };

  return (
    <DashboardLayout
      currentNav="My Assigned Assets"
      role="employee"
      userName={userDisplayName}
      userRoleSubtitle="Product Design (Employee)"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      searchPlaceholder="Search my requests, assets..."
    >
      <div className="amx-eaa-page">
        {/* Top Context / Action Row */}
        <div className="amx-eaa-top-row">
          <div className="amx-eaa-breadcrumbs" aria-label="Breadcrumb navigation">
            <button
              type="button"
              className="amx-eaa-crumb-link"
              id="backToDashboardBtn"
              onClick={() => onNavigate?.('dashboard')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                arrow_back
              </span>
              <span>Back to Dashboard</span>
            </button>
            <span className="amx-eaa-crumb-sep">/</span>
            <span className="amx-eaa-crumb-text">Self-Service</span>
            <span className="amx-eaa-crumb-sep">/</span>
            <span className="amx-eaa-crumb-current">My Assigned Assets</span>
          </div>

          <div className="amx-eaa-notice-badge" id="eaaNoticeBadge">
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--amx-dash-cyan, #00687a)' }} aria-hidden="true">
              verified_user
            </span>
            <span>
              Read-Only Employee View &bull; {totalCount} {totalCount === 1 ? 'equipment asset' : 'equipment assets'} formally assigned
            </span>
          </div>
        </div>

        {/* Page Header Row */}
        <div className="amx-eaa-header-row">
          <div>
            <h1 className="amx-eaa-title">My Assigned Assets</h1>
            <p className="amx-eaa-subtitle">
              View hardware, displays, and equipment formally allocated to your custodian record.
            </p>
          </div>
          <button
            type="button"
            className="amx-eaa-btn-view-requests"
            id="viewMyRequestsBtn"
            onClick={() => onNavigate?.('my-requests')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--amx-dash-text-muted, #76777d)' }} aria-hidden="true">
              list_alt
            </span>
            <span>View My Requests</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="amx-eaa-support-card" style={{ padding: '48px 24px', textAlign: 'center', justifyContent: 'center' }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '32px', color: 'var(--amx-dash-cyan, #00687a)', animation: 'spin 1s linear infinite' }}
              aria-hidden="true"
            >
              sync
            </span>
            <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--amx-dash-text-muted, #76777d)' }}>
              Loading assigned assets from registry...
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div
            style={{
              padding: '24px',
              border: '1px solid #ffdad6',
              backgroundColor: '#fff8f7',
              borderRadius: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '28px' }} aria-hidden="true">
                error
              </span>
              <div>
                <h3 style={{ margin: 0, color: '#410002', fontSize: '16px' }}>Failed to Load Assigned Assets</h3>
                <p style={{ margin: '4px 0 0', color: '#93000a', fontSize: '14px' }}>{error}</p>
              </div>
            </div>
            <button
              type="button"
              className="amx-eaa-support-btn"
              style={{ marginTop: '16px' }}
              onClick={fetchAssets}
            >
              Retry
            </button>
          </div>
        )}

        {/* Live Content */}
        {!loading && !error && (
          <>
            {/* KPI Summary Row: 4 Compact Systematic Cards */}
            <div className="amx-eaa-kpi-grid" id="eaaKpiGrid">
              {/* Card 1: Total Assigned */}
              <div className="amx-eaa-kpi-card" id="kpiTotalAssigned">
                <div className="amx-eaa-kpi-header">
                  <span className="amx-eaa-kpi-label">Total Assigned Assets</span>
                  <div className="amx-eaa-kpi-icon-wrap" aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      devices
                    </span>
                  </div>
                </div>
                <div className="amx-eaa-kpi-number" id="valTotalAssigned">
                  {totalCount}
                </div>
                <div className="amx-eaa-kpi-footer">
                  <span className="amx-eaa-kpi-tag cyan">Custodian Records</span>
                  <span className="amx-eaa-kpi-subtext">Active equipment</span>
                </div>
              </div>

              {/* Card 2: Active Custody */}
              <div className="amx-eaa-kpi-card" id="kpiActiveCustody">
                <div className="amx-eaa-kpi-header">
                  <span className="amx-eaa-kpi-label">Active In Custody</span>
                  <div className="amx-eaa-kpi-icon-wrap cyan" aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      check_circle
                    </span>
                  </div>
                </div>
                <div className="amx-eaa-kpi-number" id="valActiveCustody">
                  {activeCount}
                </div>
                <div className="amx-eaa-kpi-footer">
                  <span className="amx-eaa-kpi-tag cyan">In Service</span>
                  <span className="amx-eaa-kpi-subtext">Verified operational</span>
                </div>
              </div>

              {/* Card 3: In Maintenance */}
              <div className="amx-eaa-kpi-card" id="kpiInMaintenance">
                <div className="amx-eaa-kpi-header">
                  <span className="amx-eaa-kpi-label">In Maintenance</span>
                  <div className="amx-eaa-kpi-icon-wrap neutral" aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      build
                    </span>
                  </div>
                </div>
                <div className="amx-eaa-kpi-number" id="valInMaintenance">
                  {maintenanceCount}
                </div>
                <div className="amx-eaa-kpi-footer">
                  <span className="amx-eaa-kpi-tag neutral">Diagnostics</span>
                  <span className="amx-eaa-kpi-subtext">Service queue</span>
                </div>
              </div>

              {/* Card 4: In Transit */}
              <div className="amx-eaa-kpi-card" id="kpiInTransit">
                <div className="amx-eaa-kpi-header">
                  <span className="amx-eaa-kpi-label">In Transit / Gate-Pass</span>
                  <div className="amx-eaa-kpi-icon-wrap teal" aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      local_shipping
                    </span>
                  </div>
                </div>
                <div className="amx-eaa-kpi-number" id="valInTransit">
                  {transitCount}
                </div>
                <div className="amx-eaa-kpi-footer">
                  <span className="amx-eaa-kpi-tag teal">Dispatched</span>
                  <span className="amx-eaa-kpi-subtext">Movement logged</span>
                </div>
              </div>
            </div>

            {/* Inventory Container */}
            <div className="amx-eaa-table-container">
              {/* Filter / Search Bar */}
              <div className="amx-eaa-filter-bar">
                {/* Search Box */}
                <div className="amx-eaa-search-box">
                  <span className="material-symbols-outlined amx-eaa-search-icon" aria-hidden="true">
                    search
                  </span>
                  <input
                    type="text"
                    className="amx-eaa-search-input"
                    id="assetSearchInput"
                    placeholder="Search by Asset ID, Model, Serial No..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Filters */}
                <div className="amx-eaa-filter-group">
                  {/* Category Pills */}
                  <div className="amx-eaa-pills-wrap" role="tablist" aria-label="Asset category filters">
                    <button
                      type="button"
                      className={`amx-eaa-pill-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                      onClick={() => setSelectedCategory('all')}
                    >
                      All ({totalCount})
                    </button>
                    <button
                      type="button"
                      className={`amx-eaa-pill-btn ${selectedCategory === 'compute' ? 'active' : ''}`}
                      onClick={() => setSelectedCategory('compute')}
                    >
                      Compute
                    </button>
                    <button
                      type="button"
                      className={`amx-eaa-pill-btn ${selectedCategory === 'displays' ? 'active' : ''}`}
                      onClick={() => setSelectedCategory('displays')}
                    >
                      Displays
                    </button>
                    <button
                      type="button"
                      className={`amx-eaa-pill-btn ${selectedCategory === 'peripherals' ? 'active' : ''}`}
                      onClick={() => setSelectedCategory('peripherals')}
                    >
                      Peripherals
                    </button>
                    <button
                      type="button"
                      className={`amx-eaa-pill-btn ${selectedCategory === 'mobile' ? 'active' : ''}`}
                      onClick={() => setSelectedCategory('mobile')}
                    >
                      Mobile &amp; Security
                    </button>
                  </div>

                  {/* Status Select */}
                  <div className="amx-eaa-select-wrap">
                    <select
                      id="statusSelect"
                      className="amx-eaa-select"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      aria-label="Filter assets by status"
                    >
                      <option value="">Status: All</option>
                      <option value="active">Active / In Custody</option>
                      <option value="maintenance">In Maintenance</option>
                      <option value="transit">In Transit</option>
                    </select>
                    <span className="material-symbols-outlined amx-eaa-select-icon" aria-hidden="true">
                      expand_more
                    </span>
                  </div>

                  {(searchTerm || selectedCategory !== 'all' || selectedStatus) && (
                    <button
                      type="button"
                      className="amx-eaa-btn-reset"
                      onClick={handleResetFilters}
                      title="Reset filters"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">
                        restart_alt
                      </span>
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="amx-eaa-table-scroll">
                <table className="amx-eaa-table" aria-label="Assigned Assets Table">
                  <thead>
                    <tr className="amx-eaa-thead-tr">
                      <th scope="col" className="amx-eaa-th">Asset ID</th>
                      <th scope="col" className="amx-eaa-th">Equipment &amp; Specification</th>
                      <th scope="col" className="amx-eaa-th">Category</th>
                      <th scope="col" className="amx-eaa-th">Current Location</th>
                      <th scope="col" className="amx-eaa-th">Assigned Date</th>
                      <th scope="col" className="amx-eaa-th">Custodian</th>
                      <th scope="col" className="amx-eaa-th">Status</th>
                      <th scope="col" className="amx-eaa-th" style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="amx-eaa-empty-state" id="emptyStateBox">
                            <span className="material-symbols-outlined amx-eaa-empty-icon" aria-hidden="true">
                              devices_off
                            </span>
                            <h3 className="amx-eaa-empty-title">
                              {rawAssets.length === 0
                                ? 'No assets assigned to your custody'
                                : 'No matching assets found'}
                            </h3>
                            <p className="amx-eaa-empty-desc">
                              {rawAssets.length === 0
                                ? 'You do not have any non-consumable equipment or hardware registered to your employee record. Use Create Request to request equipment.'
                                : 'No assigned equipment matches your current search or category filter. Try clearing your filters.'}
                            </p>
                            {rawAssets.length === 0 ? (
                              <button
                                type="button"
                                className="amx-eaa-support-btn"
                                onClick={() => onNavigate?.('create-request')}
                              >
                                Create Request
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="amx-eaa-btn-reset"
                                onClick={handleResetFilters}
                              >
                                Reset Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => {
                        const isCopied = copiedId === asset.id;
                        const isMaint = asset.statusCode === 'maintenance';
                        const isTransit = asset.statusCode === 'transit';

                        return (
                          <tr
                            key={asset.id}
                            className="amx-eaa-tr asset-row"
                            data-category={asset.categoryKey || 'other'}
                            onClick={() => handleOpenDetails(asset)}
                            title={`Click to view inspection details for ${asset.id}`}
                          >
                            {/* 1. Asset ID */}
                            <td className="amx-eaa-td">
                              <div className="amx-eaa-id-cell">
                                <span>{asset.id}</span>
                                <button
                                  type="button"
                                  className="amx-eaa-copy-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(asset.id, asset.id);
                                  }}
                                  title="Copy Asset Tag to clipboard"
                                  aria-label={`Copy Asset Tag ${asset.id}`}
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: '15px' }}
                                    aria-hidden="true"
                                  >
                                    {isCopied ? 'check' : 'content_copy'}
                                  </span>
                                </button>
                              </div>
                            </td>

                            {/* 2. Equipment & Specification */}
                            <td className="amx-eaa-td">
                              <div className="amx-eaa-equip-cell">
                                <div className="amx-eaa-equip-icon-wrap" aria-hidden="true">
                                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                    {asset.icon || 'devices'}
                                  </span>
                                </div>
                                <div className="amx-eaa-equip-info">
                                  <span className="amx-eaa-equip-title">{asset.name}</span>
                                  <span className="amx-eaa-equip-spec">
                                    {asset.specification || asset.category}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 3. Category */}
                            <td className="amx-eaa-td">
                              <span className="amx-eaa-cat-text">{asset.category}</span>
                            </td>

                            {/* 4. Current Location */}
                            <td className="amx-eaa-td">
                              <div className="amx-eaa-loc-cell">
                                <span
                                  className="material-symbols-outlined amx-eaa-loc-icon"
                                  style={{
                                    color: isMaint ? '#76777d' : 'var(--amx-dash-cyan, #00687a)',
                                  }}
                                  aria-hidden="true"
                                >
                                  {isMaint ? 'build' : asset.location.includes('Remote') ? 'home_pin' : 'location_on'}
                                </span>
                                <span>{asset.location}</span>
                              </div>
                            </td>

                            {/* 5. Assigned Date */}
                            <td className="amx-eaa-td">
                              <span className="amx-eaa-date-text">
                                {asset.assignedDate}
                              </span>
                            </td>

                            {/* 6. Custodian */}
                            <td className="amx-eaa-td">
                              <div className="amx-eaa-custodian-cell">
                                <span className="amx-eaa-custodian-name">
                                  {asset.custodianName}
                                </span>
                                <span className="amx-eaa-custodian-empid">
                                  {asset.custodianEmpId}
                                </span>
                              </div>
                            </td>

                            {/* 7. Status */}
                            <td className="amx-eaa-td">
                              <span
                                className={`amx-eaa-status-badge ${
                                  isMaint ? 'maintenance' : isTransit ? 'transit' : 'active'
                                }`}
                              >
                                <span
                                  className={`amx-eaa-kpi-dot ${isMaint ? 'neutral' : 'cyan'}`}
                                  aria-hidden="true"
                                ></span>
                                <span>{asset.status}</span>
                              </span>
                            </td>

                            {/* 8. Action */}
                            <td className="amx-eaa-td" style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="amx-eaa-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetails(asset);
                                }}
                                aria-label={`View details for ${asset.id}`}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: '16px' }}
                                  aria-hidden="true"
                                >
                                  visibility
                                </span>
                                <span>View Details</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Metadata */}
              <div className="amx-eaa-table-footer">
                <span className="amx-eaa-custodian-notice">
                  Formally registered custodian:{' '}
                  <strong>
                    {userDisplayName} ({userEmpId})
                  </strong>{' '}
                  &bull; {userDept}
                </span>
                <div className="amx-eaa-policy-reminder">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
                    info
                  </span>
                  <span>
                    Assets must be surrendered to Hardware Operations upon role transition or offboarding.
                  </span>
                </div>
              </div>
            </div>

            {/* Self-Service Guidance Card */}
            <div className="amx-eaa-support-card" id="eaaSupportCard">
              <div className="amx-eaa-support-left">
                <div className="amx-eaa-support-icon-wrap" aria-hidden="true">
                  <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                    support_agent
                  </span>
                </div>
                <div>
                  <h2 className="amx-eaa-support-title">Need adjustments or hardware support?</h2>
                  <p className="amx-eaa-support-desc">
                    As an employee, asset assignment modifications (such as desk relocations, ergonomic
                    loaners, or faulty battery replacements) must be processed through corporate IT ticket
                    workflows.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="amx-eaa-support-btn"
                id="itPolicyBtn"
                onClick={() =>
                  showToast(
                    'Corporate IT Hardware Policy: All equipment allocations require manager signoff and asset tagging before deployment.'
                  )
                }
              >
                IT Hardware Policy
              </button>
            </div>
          </>
        )}
      </div>

      {/* Backdrop for Inspection Drawer */}
      {isDrawerOpen && (
        <div
          className="amx-eaa-drawer-backdrop"
          id="drawer-backdrop"
          onClick={handleCloseDrawer}
          aria-hidden="true"
        />
      )}

      {/* Right-Rail Asset Inspection Drawer (Read-Only) */}
      {isDrawerOpen && (
        <aside
          className="amx-eaa-drawer"
          id="asset-detail-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawerTitle"
        >
          {/* Drawer Header */}
          <div className="amx-eaa-drawer-header">
            <div className="amx-eaa-drawer-header-left">
              <div className="amx-eaa-drawer-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {selectedAsset?.icon || 'devices'}
                </span>
              </div>
              <div>
                <div className="amx-eaa-drawer-title-row">
                  <span className="amx-eaa-drawer-title" id="drawerTitle">
                    Asset Details
                  </span>
                  <span className="amx-eaa-drawer-pill-readonly" id="drawerReadOnlyBadge">
                    Read-Only
                  </span>
                </div>
                <span className="amx-eaa-drawer-asset-id" id="drawerAssetId">
                  {selectedAsset?.id || 'AST-RECORD'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="amx-eaa-drawer-close-btn"
              id="drawerCloseBtn"
              onClick={handleCloseDrawer}
              aria-label="Close Inspector"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                close
              </span>
            </button>
          </div>

          {/* Drawer Body / Scrollable Content */}
          <div className="amx-eaa-drawer-body">
            {drawerError ? (
              <div className="amx-eaa-empty-state" id="drawerErrorBox">
                <span className="material-symbols-outlined amx-eaa-empty-icon" style={{ color: '#ba1a1a' }}>
                  gpp_bad
                </span>
                <h3 className="amx-eaa-empty-title">Asset Record Not Found</h3>
                <p className="amx-eaa-empty-desc">
                  {drawerError}. This equipment is not allocated to your employee custodian account.
                </p>
              </div>
            ) : selectedAsset ? (
              <>
                {/* 1. Primary Identity Card */}
                <div className="amx-eaa-drawer-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="amx-eaa-drawer-section-title">Hardware Spec</span>
                    <span
                      className={`amx-eaa-status-badge ${
                        selectedAsset.status.toLowerCase().includes('maintenance') ? 'maintenance' : 'active'
                      }`}
                    >
                      <span className="amx-eaa-kpi-dot cyan" aria-hidden="true"></span>
                      <span>{selectedAsset.status}</span>
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: '17px',
                      fontWeight: 700,
                      color: 'var(--amx-dash-text, #191c1e)',
                      margin: 0,
                    }}
                  >
                    {selectedAsset.name}
                  </h3>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--amx-dash-text-muted, #76777d)',
                      margin: 0,
                    }}
                  >
                    {selectedAsset.hardwareModel || selectedAsset.specification}
                  </p>
                </div>

                {/* 2. QR Code & Digital Asset Tag */}
                <div>
                  <span className="amx-eaa-drawer-section-title" style={{ display: 'block', marginBottom: '8px' }}>
                    Asset Tag &amp; Verification QR
                  </span>
                  <div className="amx-eaa-drawer-card" style={{ textAlign: 'center', padding: '16px' }}>
                    {selectedAsset.qrCodeDataUrl ? (
                      <img
                        src={selectedAsset.qrCodeDataUrl}
                        alt={`QR Code for ${selectedAsset.id}`}
                        style={{
                          width: '130px',
                          height: '130px',
                          margin: '0 auto',
                          display: 'block',
                          borderRadius: '8px',
                          border: '1px solid var(--amx-dash-border, #c6c6cd)',
                          backgroundColor: '#ffffff',
                          padding: '4px',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '16px',
                          backgroundColor: '#f1f4f6',
                          borderRadius: '8px',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                      >
                        {selectedAsset.qrCodeValue || `assetmx:${selectedAsset.id}`}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--amx-dash-text-muted, #76777d)',
                      }}
                    >
                      {selectedAsset.qrCodeValue || `assetmx:${selectedAsset.id}`}
                    </div>
                  </div>
                </div>

                {/* 3. Allocation & Custody Information */}
                <div>
                  <span className="amx-eaa-drawer-section-title" style={{ display: 'block', marginBottom: '8px' }}>
                    Allocation &amp; Custody
                  </span>
                  <div className="amx-eaa-drawer-card">
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Assigned Custodian</span>
                      <span className="amx-eaa-spec-value">
                        {selectedAsset.custodianName} ({selectedAsset.custodianEmpId})
                      </span>
                    </div>
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Department / Unit</span>
                      <span className="amx-eaa-spec-value">
                        {selectedAsset.custodianDepartment}
                      </span>
                    </div>
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Assigned Date</span>
                      <span className="amx-eaa-spec-value">
                        {selectedAsset.assignedDate}
                      </span>
                    </div>
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Designated Location</span>
                      <span className="amx-eaa-spec-value">{selectedAsset.location}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Technical Specifications Card */}
                <div>
                  <span className="amx-eaa-drawer-section-title" style={{ display: 'block', marginBottom: '8px' }}>
                    Technical Specifications
                  </span>
                  <div className="amx-eaa-drawer-card">
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Hardware Serial Number</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span
                          className="amx-eaa-spec-value"
                          style={{ fontFamily: 'var(--amx-dash-mono, monospace)', fontWeight: 600 }}
                        >
                          {selectedAsset.serialNumber}
                        </span>
                        <button
                          type="button"
                          className="amx-eaa-copy-btn"
                          onClick={() =>
                            handleCopy(
                              selectedAsset.serialNumber || selectedAsset.id,
                              'serial-' + selectedAsset.id
                            )
                          }
                          title="Copy serial number"
                          aria-label="Copy serial number"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            {copiedId === 'serial-' + selectedAsset.id ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {selectedAsset.technicalSpecs?.map((spec, i) => (
                      <div key={i} className="amx-eaa-spec-row">
                        <span className="amx-eaa-spec-label">{spec.label}</span>
                        <span className="amx-eaa-spec-value">{spec.value}</span>
                      </div>
                    ))}

                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Acquisition Cost</span>
                      <span className="amx-eaa-spec-value">{selectedAsset.acquisition.totalCost}</span>
                    </div>
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Warranty Status</span>
                      <span className="amx-eaa-spec-value">{selectedAsset.acquisition.warrantyStatus}</span>
                    </div>
                  </div>
                </div>

                {/* 5. Recorded History / Custody Events */}
                <div>
                  <span className="amx-eaa-drawer-section-title" style={{ display: 'block', marginBottom: '8px' }}>
                    Custody Log
                  </span>
                  <div className="amx-eaa-drawer-card" style={{ gap: '16px' }}>
                    {selectedAsset.custodyLog && selectedAsset.custodyLog.length > 0 ? (
                      selectedAsset.custodyLog.map((log, idx) => (
                        <div key={idx} className="amx-eaa-timeline-item">
                          <div
                            className={`amx-eaa-timeline-dot ${idx === 0 ? '' : 'muted'}`}
                            aria-hidden="true"
                          ></div>
                          <div>
                            <div>
                              <span className="amx-eaa-timeline-time">{log.date}</span>
                              <span className="amx-eaa-timeline-subtime">&bull; {log.time}</span>
                            </div>
                            <p className="amx-eaa-timeline-desc">{log.event}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="amx-eaa-spec-row">
                        <span className="amx-eaa-spec-label">Custody Trail</span>
                        <span className="amx-eaa-spec-value">Initial allocation on record</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Employee Notice Box */}
                <div className="amx-eaa-drawer-notice">
                  <span className="material-symbols-outlined amx-eaa-drawer-notice-icon" aria-hidden="true">
                    info
                  </span>
                  <p className="amx-eaa-drawer-notice-text">
                    This record is read-only. For relocation requests, hardware faults, or accessories,
                    submit an Asset Request via Self-Service.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {/* Drawer Footer Actions */}
          <div className="amx-eaa-drawer-footer">
            <button
              type="button"
              className="amx-eaa-drawer-footer-btn"
              id="drawerDismissBtn"
              onClick={handleCloseDrawer}
            >
              Close Inspector
            </button>
          </div>
        </aside>
      )}

      {/* Toast Alert Feedback */}
      {toastMessage && (
        <div className="amx-eaa-toast" id="eaaToast" role="status">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </DashboardLayout>
  );
};

export default EmployeeMyAssignedAssetsPage;
