// =====================================================================
// AssetMX Employee My Assigned Assets Page — Frozen Stitch Design
// Self-Service inventory of non-consumable assets formally assigned to the employee
// =====================================================================

import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import { getScopedEmployeeAssets, type EmployeeAssignedAsset } from '../data/employeeData';
import { ASSET_DETAILS_MOCK_DATA, type AssetDetailsData } from '../data/assetDetailsData';
import './EmployeeMyAssignedAssets.css';

interface EmployeeMyAssignedAssetsPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

type CategoryFilterKey = 'all' | 'compute' | 'displays' | 'peripherals' | 'mobile';

export const EmployeeMyAssignedAssetsPage: React.FC<EmployeeMyAssignedAssetsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();
  const rawAssets = useMemo(() => getScopedEmployeeAssets(currentUser), [currentUser]);

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
            /peripheral|audio|headset|keyboard/i.test(asset.category);
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
          (asset.serialNumber && asset.serialNumber.toLowerCase().includes(term)) ||
          (asset.legacyId && asset.legacyId.toLowerCase().includes(term)) ||
          (asset.altName && asset.altName.toLowerCase().includes(term));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [rawAssets, selectedCategory, selectedStatus, searchTerm]);

  // Open asset inspection drawer
  const handleOpenDetails = (asset: EmployeeAssignedAsset) => {
    // Verify asset is formally in this employee's assigned assets
    const isAllocated = rawAssets.some((a) => a.id === asset.id || a.legacyId === asset.id);
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

  const userDisplayName = currentUser?.full_name || 'Marcus Vance';
  const userEmpId = currentUser?.employee_id || 'EMP-2024-0419';
  const userDept = (currentUser as any)?.department || 'Product Design & UX';

  // Find rich details from mock database if available
  const richDetails: AssetDetailsData | null = useMemo(() => {
    if (!selectedAsset) return null;
    return (
      ASSET_DETAILS_MOCK_DATA[selectedAsset.id] ||
      (selectedAsset.legacyId ? ASSET_DETAILS_MOCK_DATA[selectedAsset.legacyId] : null) ||
      null
    );
  }, [selectedAsset]);

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
            <div className="amx-eaa-kpi-body">
              <div className="amx-eaa-kpi-value" id="kpiTotalVal">
                {totalCount}
              </div>
              <div className="amx-eaa-kpi-subtext">Formally issued to you</div>
            </div>
          </div>

          {/* Card 2: Active Assets */}
          <div className="amx-eaa-kpi-card" id="kpiActiveAssets">
            <div className="amx-eaa-kpi-header">
              <span className="amx-eaa-kpi-label">Active Assets</span>
              <span className="amx-eaa-kpi-pill cyan" id="kpiActivePill">
                <span className="amx-eaa-kpi-dot cyan" aria-hidden="true"></span>
                Operational
              </span>
            </div>
            <div className="amx-eaa-kpi-body">
              <div className="amx-eaa-kpi-value" id="kpiActiveVal">
                {activeCount}
              </div>
              <div className="amx-eaa-kpi-subtext">In your custody &amp; in use</div>
            </div>
          </div>

          {/* Card 3: In Maintenance */}
          <div className="amx-eaa-kpi-card" id="kpiMaintenanceAssets">
            <div className="amx-eaa-kpi-header">
              <span className="amx-eaa-kpi-label">In Maintenance</span>
              <span className="amx-eaa-kpi-pill neutral" id="kpiMaintenancePill">
                <span className="amx-eaa-kpi-dot neutral" aria-hidden="true"></span>
                IT Ticket Open
              </span>
            </div>
            <div className="amx-eaa-kpi-body">
              <div className="amx-eaa-kpi-value" id="kpiMaintenanceVal">
                {maintenanceCount}
              </div>
              <div className="amx-eaa-kpi-subtext">With IT service lab (B-102)</div>
            </div>
          </div>

          {/* Card 4: In Transit */}
          <div className="amx-eaa-kpi-card" id="kpiTransitAssets">
            <div className="amx-eaa-kpi-header">
              <span className="amx-eaa-kpi-label">In Transit</span>
              <div className="amx-eaa-kpi-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  local_shipping
                </span>
              </div>
            </div>
            <div className="amx-eaa-kpi-body">
              <div className={`amx-eaa-kpi-value ${transitCount === 0 ? 'dim' : ''}`} id="kpiTransitVal">
                {transitCount}
              </div>
              <div className="amx-eaa-kpi-subtext">
                {transitCount === 0 ? 'No transfers in progress' : `${transitCount} units moving`}
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Controls Toolbar */}
        <div className="amx-eaa-toolbar" id="eaaToolbar">
          <div className="amx-eaa-toolbar-inner">
            {/* Search Input */}
            <div className="amx-eaa-search-box">
              <span className="material-symbols-outlined amx-eaa-search-icon" style={{ fontSize: '20px' }} aria-hidden="true">
                search
              </span>
              <input
                type="text"
                className="amx-eaa-search-input"
                id="eaaSearchInput"
                placeholder="Search by Asset ID or Asset Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search by Asset ID or Asset Name"
              />
            </div>

            {/* Filter Pills & Counter */}
            <div className="amx-eaa-filter-pills" role="tablist" aria-label="Category filter tabs">
              <button
                type="button"
                className={`amx-eaa-pill-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                id="pillFilterAll"
                onClick={() => setSelectedCategory('all')}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                className={`amx-eaa-pill-btn ${selectedCategory === 'compute' ? 'active' : ''}`}
                id="pillFilterCompute"
                onClick={() => setSelectedCategory('compute')}
              >
                Compute &amp; Laptops
              </button>
              <button
                type="button"
                className={`amx-eaa-pill-btn ${selectedCategory === 'displays' ? 'active' : ''}`}
                id="pillFilterDisplays"
                onClick={() => setSelectedCategory('displays')}
              >
                Displays
              </button>
              <button
                type="button"
                className={`amx-eaa-pill-btn ${selectedCategory === 'peripherals' ? 'active' : ''}`}
                id="pillFilterPeripherals"
                onClick={() => setSelectedCategory('peripherals')}
              >
                Peripherals
              </button>
              <button
                type="button"
                className={`amx-eaa-pill-btn ${selectedCategory === 'mobile' ? 'active' : ''}`}
                id="pillFilterMobile"
                onClick={() => setSelectedCategory('mobile')}
              >
                Mobile Devices
              </button>

              <div className="amx-eaa-pill-sep" aria-hidden="true"></div>

              <span className="amx-eaa-counter-badge" id="assetCounterBadge">
                Showing {filteredAssets.length} of {totalCount} assets
              </span>

              {(searchTerm || selectedCategory !== 'all' || selectedStatus) && (
                <button
                  type="button"
                  className="amx-eaa-btn-reset"
                  id="resetFiltersBtn"
                  onClick={handleResetFilters}
                  title="Reset search and filters"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">
                    close
                  </span>
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Assigned Assets Table Card */}
        <div className="amx-eaa-table-card" id="eaaTableCard">
          <div className="amx-eaa-table-wrap">
            <table className="amx-eaa-table" aria-label="Formally assigned assets table">
              <thead className="amx-eaa-thead">
                <tr>
                  <th className="amx-eaa-th">Asset ID</th>
                  <th className="amx-eaa-th" style={{ minWidth: '260px' }}>
                    Equipment &amp; Specification
                  </th>
                  <th className="amx-eaa-th">Category</th>
                  <th className="amx-eaa-th" style={{ minWidth: '180px' }}>
                    Current Location
                  </th>
                  <th className="amx-eaa-th">Assigned Date</th>
                  <th className="amx-eaa-th">Custodian</th>
                  <th className="amx-eaa-th">Status</th>
                  <th className="amx-eaa-th" style={{ textAlign: 'right' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="amx-eaa-tbody">
                {totalCount === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="amx-eaa-empty-state" id="eaaEmptyStateNoAssets">
                        <span className="material-symbols-outlined amx-eaa-empty-icon" aria-hidden="true">
                          devices
                        </span>
                        <h3 className="amx-eaa-empty-title">No Assets Formally Assigned</h3>
                        <p className="amx-eaa-empty-desc">
                          You do not currently have any equipment or hardware checked out to your custody.
                          Submit an Asset Request via Self-Service if you require hardware allocation.
                        </p>
                        <button
                          type="button"
                          className="amx-eaa-btn-view-requests"
                          onClick={() => onNavigate?.('create-request')}
                          style={{ marginTop: '8px' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                            post_add
                          </span>
                          <span>Create Request</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="amx-eaa-empty-state" id="eaaEmptyStateNoMatch">
                        <span className="material-symbols-outlined amx-eaa-empty-icon" aria-hidden="true">
                          search_off
                        </span>
                        <h3 className="amx-eaa-empty-title">No matching assets found</h3>
                        <p className="amx-eaa-empty-desc">
                          No assigned equipment matches your current search or filter criteria.
                        </p>
                        <button
                          type="button"
                          className="amx-eaa-btn-reset"
                          onClick={handleResetFilters}
                          style={{ marginTop: '8px' }}
                        >
                          <span>Clear filters</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    const isCopied = copiedId === asset.id;
                    const isMaint = asset.status.toLowerCase().includes('maintenance');
                    const isTransit = asset.status.toLowerCase().includes('transit');

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
                            {asset.assignedDate || '12 Jan 2024'}
                          </span>
                        </td>

                        {/* 6. Custodian */}
                        <td className="amx-eaa-td">
                          <div className="amx-eaa-custodian-cell">
                            <span className="amx-eaa-custodian-name">
                              {asset.custodianName || userDisplayName}
                            </span>
                            <span className="amx-eaa-custodian-empid">
                              {asset.custodianEmpId || userEmpId}
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

        {/* Self-Service Guidance Card (Editorial Layout) */}
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

                {/* 2. Allocation & Custody Information */}
                <div>
                  <span className="amx-eaa-drawer-section-title" style={{ display: 'block', marginBottom: '8px' }}>
                    Allocation &amp; Custody
                  </span>
                  <div className="amx-eaa-drawer-card">
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Assigned Custodian</span>
                      <span className="amx-eaa-spec-value">
                        {selectedAsset.custodianName || userDisplayName} ({selectedAsset.custodianEmpId || userEmpId})
                      </span>
                    </div>
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Department / Unit</span>
                      <span className="amx-eaa-spec-value">
                        {selectedAsset.custodianDepartment || userDept}
                      </span>
                    </div>
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Assigned Date</span>
                      <span className="amx-eaa-spec-value">
                        {selectedAsset.assignedDate || '12 January 2024'}
                      </span>
                    </div>
                    <div className="amx-eaa-spec-row">
                      <span className="amx-eaa-spec-label">Designated Location</span>
                      <span className="amx-eaa-spec-value">{selectedAsset.location}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Technical Specifications Card */}
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
                          {selectedAsset.serialNumber || 'SN-RECORDED-TAG'}
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

                    {richDetails?.acquisition && (
                      <>
                        <div className="amx-eaa-spec-row">
                          <span className="amx-eaa-spec-label">Acquisition Cost</span>
                          <span className="amx-eaa-spec-value">{richDetails.acquisition.totalCost}</span>
                        </div>
                        <div className="amx-eaa-spec-row">
                          <span className="amx-eaa-spec-label">Warranty Status</span>
                          <span className="amx-eaa-spec-value">{richDetails.warrantyStatus}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 4. Recorded History / Custody Events */}
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
                    ) : richDetails?.movementHistory && richDetails.movementHistory.length > 0 ? (
                      richDetails.movementHistory.map((mov, idx) => (
                        <div key={idx} className="amx-eaa-timeline-item">
                          <div
                            className={`amx-eaa-timeline-dot ${idx === 0 ? '' : 'muted'}`}
                            aria-hidden="true"
                          ></div>
                          <div>
                            <div>
                              <span className="amx-eaa-timeline-time">{mov.date}</span>
                              <span className="amx-eaa-timeline-subtime">&bull; {mov.movementType}</span>
                            </div>
                            <p className="amx-eaa-timeline-desc">
                              Transferred from {mov.from} to {mov.to} (Custodian: {mov.custodian})
                            </p>
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

                {/* 5. Employee Notice Box */}
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
