import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import {
  getScopedEmployeeIssuanceRecords,
} from '../data/employeeData';
import './EmployeeMyConsumption.css';

interface EmployeeMyConsumptionPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

type TimeFilterKey = 'all' | 'month';

interface CategoryMetric {
  name: string;
  categoryKey: string;
  units: number;
  percentage: number;
  colorClass: string;
}

export const EmployeeMyConsumptionPage: React.FC<EmployeeMyConsumptionPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();
  const rawRecords = useMemo(
    () => getScopedEmployeeIssuanceRecords(currentUser),
    [currentUser]
  );

  // Filters state
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyReqId = (reqId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(reqId).catch(() => {});
    }
    showToast(`Copied ${reqId} to clipboard`);
  };

  const handleNav = (subRoute: string) => {
    if (onNavigate) {
      onNavigate(subRoute);
    }
  };

  // 1. Time-filtered dataset
  const timeScopedRecords = useMemo(() => {
    if (timeFilter === 'month') {
      return rawRecords.filter((r) => r.isCurrentMonth);
    }
    return rawRecords;
  }, [rawRecords, timeFilter]);

  // Total unit counts for the time filter toggle buttons
  const allTimeTotalUnits = useMemo(
    () => rawRecords.reduce((sum, r) => sum + r.quantityIssued, 0),
    [rawRecords]
  );
  const thisMonthTotalUnits = useMemo(
    () => rawRecords.filter((r) => r.isCurrentMonth).reduce((sum, r) => sum + r.quantityIssued, 0),
    [rawRecords]
  );

  // 2. Fully filtered dataset (applying search and category filter)
  const filteredRecords = useMemo(() => {
    let result = timeScopedRecords;

    if (selectedCategory !== 'all') {
      result = result.filter(
        (r) =>
          r.categoryKey.toLowerCase() === selectedCategory.toLowerCase() ||
          r.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.itemName.toLowerCase().includes(q) ||
          r.specification.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.relatedRequestId.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q)
      );
    }

    return result;
  }, [timeScopedRecords, selectedCategory, searchTerm]);

  // 3. Category options derived from available time-scoped records
  const categoryOptions = useMemo(() => {
    const map = new Map<string, { name: string; key: string; units: number }>();
    timeScopedRecords.forEach((r) => {
      const existing = map.get(r.categoryKey);
      if (existing) {
        existing.units += r.quantityIssued;
      } else {
        map.set(r.categoryKey, {
          name: r.category,
          key: r.categoryKey,
          units: r.quantityIssued,
        });
      }
    });
    return Array.from(map.values());
  }, [timeScopedRecords]);

  // 4. Category distribution breakdown (calculated from timeScopedRecords)
  const categoryDistribution = useMemo<CategoryMetric[]>(() => {
    const totalUnits = timeScopedRecords.reduce((sum, r) => sum + r.quantityIssued, 0);
    if (totalUnits === 0) return [];

    const map = new Map<string, { name: string; key: string; units: number }>();
    timeScopedRecords.forEach((r) => {
      const curr = map.get(r.category);
      if (curr) {
        curr.units += r.quantityIssued;
      } else {
        map.set(r.category, {
          name: r.category,
          key: r.categoryKey,
          units: r.quantityIssued,
        });
      }
    });

    const colorClasses: Record<string, string> = {
      cables: 'amx-mc-bar-cables',
      ergonomics: 'amx-mc-bar-ergonomics',
      stationery: 'amx-mc-bar-stationery',
      cleaning: 'amx-mc-bar-cleaning',
    };

    return Array.from(map.values())
      .map((cat) => {
        const pct = Math.round((cat.units / totalUnits) * 1000) / 10;
        return {
          name: cat.name,
          categoryKey: cat.key,
          units: cat.units,
          percentage: pct,
          colorClass: colorClasses[cat.key] || 'amx-mc-bar-other',
        };
      })
      .sort((a, b) => b.units - a.units);
  }, [timeScopedRecords]);

  // 5. Four Summary KPI Card Values
  const kpiTotalIssued = useMemo(
    () => timeScopedRecords.reduce((sum, r) => sum + r.quantityIssued, 0),
    [timeScopedRecords]
  );

  const kpiDistinctCategories = useMemo(() => {
    const catSet = new Set(timeScopedRecords.map((r) => r.category));
    return catSet.size;
  }, [timeScopedRecords]);

  const kpiCategoryNamesSubtext = useMemo(() => {
    if (timeScopedRecords.length === 0) return 'No recorded categories';
    const names = Array.from(new Set(timeScopedRecords.map((r) => r.category)));
    return names.join(', ');
  }, [timeScopedRecords]);

  const kpiFulfilledRequestsCount = useMemo(() => {
    const reqSet = new Set(timeScopedRecords.map((r) => r.relatedRequestId));
    return reqSet.size;
  }, [timeScopedRecords]);

  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthName = monthNames[now.getMonth()];
  const currentYear = now.getFullYear();

  const kpiPeriodTitle = timeFilter === 'all' ? 'All Time' : 'This Month';
  const kpiPeriodSubtext =
    timeFilter === 'all'
      ? 'Aug 2025 – Feb 2026 (Recorded Issues)'
      : `${currentMonthName} ${currentYear} (Current Cycle)`;

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setTimeFilter('all');
    showToast('Filters reset to default.');
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' || selectedCategory !== 'all' || timeFilter !== 'all';

  const userDisplayName = currentUser?.full_name || 'Marcus Vance';
  const userEmpId =
    currentUser?.employee_id ||
    (currentUser as { emp_id?: string })?.emp_id ||
    'EMP-4092';

  return (
    <DashboardLayout
      currentNav="My Consumption"
      role="employee"
      userName={userDisplayName}
      userRoleSubtitle="Product Design (Employee)"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      searchPlaceholder="Search my requests, consumables..."
      onNotificationsClick={() =>
        showToast('Notifications: 1 update — Monitor requisition REQ-2026-0841 moved to In Review.')
      }
      onHelpClick={() =>
        showToast('AssetMX Employee Self-Service Help & Documentation.')
      }
      onProfileClick={() =>
        showToast(
          `Signed in as: ${userDisplayName} (${currentUser?.email || 'employee@assetmx.local'}) — Role: Employee`
        )
      }
    >
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div id="mcToast" className="amx-mc-toast" role="status" aria-live="polite">
          <span className="material-symbols-outlined amx-mc-toast-icon">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="amx-mc-page">
        {/* Top Context & Informational Identity Bar */}
        <div className="amx-mc-top-row">
          <div className="amx-mc-breadcrumbs">
            <button
              type="button"
              className="amx-mc-crumb-link"
              id="mcBackToDashboardBtn"
              onClick={() => handleNav('dashboard')}
              aria-label="Back to Dashboard"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                arrow_back
              </span>
              <span>Dashboard</span>
            </button>
            <span className="amx-mc-crumb-sep">/</span>
            <span>Self-Service</span>
            <span className="amx-mc-crumb-sep">/</span>
            <span className="amx-mc-crumb-current">My Consumption</span>
          </div>

          <div className="amx-mc-notice-badge">
            <span className="amx-mc-notice-dot"></span>
            <span>
              Read-Only Employee View • Logged-in Custodian:{' '}
              <strong style={{ color: 'var(--amx-dash-text, #191c1e)' }}>
                {userDisplayName} ({userEmpId})
              </strong>
            </span>
          </div>
        </div>

        {/* Page Header Row */}
        <div className="amx-mc-header-row">
          <div>
            <h1 className="amx-mc-title">My Consumption</h1>
            <p className="amx-mc-subtitle">
              Review consumable items issued to you and your usage history.
            </p>
          </div>

          <div className="amx-mc-header-actions">
            <button
              type="button"
              className="amx-mc-btn-view-requests"
              id="mcViewMyRequestsBtn"
              onClick={() => handleNav('my-requests')}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '20px', color: 'var(--amx-dash-cyan, #00687a)' }}
                aria-hidden="true"
              >
                pending_actions
              </span>
              <span>View My Requests</span>
            </button>
          </div>
        </div>

        {/* Four Summary Metric Cards */}
        <div className="amx-mc-kpi-grid" id="mcKpiGrid">
          {/* Card 1: Total Quantity Issued */}
          <div className="amx-mc-kpi-card" id="kpiCardTotalIssued">
            <div className="amx-mc-kpi-card-header">
              <span className="amx-mc-kpi-label">TOTAL QUANTITY ISSUED</span>
              <div className="amx-mc-kpi-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  inventory
                </span>
              </div>
            </div>
            <div>
              <div className="amx-mc-kpi-value" id="kpiTotalIssuedVal">
                {kpiTotalIssued}
              </div>
              <div className="amx-mc-kpi-subtext" id="kpiTotalIssuedSub">
                {timeFilter === 'all'
                  ? 'Units formally received across all records'
                  : 'Units formally received this cycle'}
              </div>
            </div>
          </div>

          {/* Card 2: Distinct Categories */}
          <div className="amx-mc-kpi-card" id="kpiCardDistinctCategories">
            <div className="amx-mc-kpi-card-header">
              <span className="amx-mc-kpi-label">DISTINCT CATEGORIES</span>
              <div className="amx-mc-kpi-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  grid_view
                </span>
              </div>
            </div>
            <div>
              <div className="amx-mc-kpi-value" id="kpiDistinctCategoriesVal">
                {kpiDistinctCategories}
              </div>
              <div
                className="amx-mc-kpi-subtext"
                id="kpiDistinctCategoriesSub"
                title={kpiCategoryNamesSubtext}
              >
                {kpiCategoryNamesSubtext}
              </div>
            </div>
          </div>

          {/* Card 3: Fulfilled Requests */}
          <div className="amx-mc-kpi-card" id="kpiCardFulfilledRequests">
            <div className="amx-mc-kpi-card-header">
              <span className="amx-mc-kpi-label">FULFILLED REQUESTS</span>
              <div className="amx-mc-kpi-icon-wrap teal" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  task_alt
                </span>
              </div>
            </div>
            <div>
              <div className="amx-mc-kpi-value" id="kpiFulfilledRequestsVal">
                {kpiFulfilledRequestsCount}
              </div>
              <div className="amx-mc-kpi-subtext">Completed consumable requests only</div>
            </div>
          </div>

          {/* Card 4: Reporting Period */}
          <div className="amx-mc-kpi-card" id="kpiCardReportingPeriod">
            <div className="amx-mc-kpi-card-header">
              <span className="amx-mc-kpi-label">REPORTING PERIOD</span>
              <div className="amx-mc-kpi-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  calendar_today
                </span>
              </div>
            </div>
            <div>
              <div
                className="amx-mc-kpi-value"
                id="kpiReportingPeriodVal"
                style={{ fontSize: '24px' }}
              >
                {kpiPeriodTitle}
              </div>
              <div className="amx-mc-kpi-subtext" id="kpiReportingPeriodSub">
                {kpiPeriodSubtext}
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls Toolbar */}
        <div className="amx-mc-toolbar" id="mcToolbar">
          {/* Left: Search Box */}
          <div className="amx-mc-search-wrap">
            <span className="material-symbols-outlined amx-mc-search-icon" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              id="consumption-search"
              className="amx-mc-search-input"
              placeholder="Search by item name or Request ID (e.g. REQ-2026)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search consumable records"
            />
          </div>

          {/* Right: Segmented Filters */}
          <div className="amx-mc-toolbar-controls">
            {/* Time Range Toggle */}
            <div className="amx-mc-time-toggle" role="group" aria-label="Time range filter">
              <button
                type="button"
                id="toggle-all"
                className={`amx-mc-time-btn ${timeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTimeFilter('all')}
              >
                All Time ({allTimeTotalUnits})
              </button>
              <button
                type="button"
                id="toggle-month"
                className={`amx-mc-time-btn ${timeFilter === 'month' ? 'active' : ''}`}
                onClick={() => setTimeFilter('month')}
              >
                This Month ({thisMonthTotalUnits})
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="amx-mc-cat-pills" id="category-pills">
              <button
                type="button"
                className={`amx-mc-cat-pill cat-pill ${
                  selectedCategory === 'all' ? 'active' : ''
                }`}
                data-cat="all"
                onClick={() => setSelectedCategory('all')}
              >
                All Categories
              </button>
              {categoryOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`amx-mc-cat-pill cat-pill ${
                    selectedCategory.toLowerCase() === opt.key.toLowerCase() ||
                    selectedCategory.toLowerCase() === opt.name.toLowerCase()
                      ? 'active'
                      : ''
                  }`}
                  data-cat={opt.key}
                  onClick={() => setSelectedCategory(opt.key)}
                >
                  {opt.name} ({opt.units})
                </button>
              ))}
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                id="mcResetFiltersBtn"
                className="amx-mc-reset-btn"
                onClick={handleResetFilters}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  restart_alt
                </span>
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Middle Section: Visual Breakdown & Policy Notice */}
        <div className="amx-mc-middle-grid">
          {/* Category Distribution Summary */}
          <div className="amx-mc-dist-card" id="mcDistributionCard">
            <div>
              <div className="amx-mc-dist-header">
                <h2 className="amx-mc-dist-title">Category Distribution Summary</h2>
                <span className="amx-mc-dist-total-badge" id="mcDistributionTotalUnits">
                  {kpiTotalIssued} Units Total
                </span>
              </div>
              <p className="amx-mc-dist-desc">
                Aggregate breakdown of issued units by equipment & consumable classification
              </p>

              {/* Progress Bars */}
              {categoryDistribution.length === 0 ? (
                <div
                  className="amx-mc-empty-state"
                  style={{ padding: '24px 0', border: 'none' }}
                >
                  <p className="amx-mc-empty-text">No qualifying category units to display.</p>
                </div>
              ) : (
                <div className="amx-mc-progress-list" id="mcProgressList">
                  {categoryDistribution.map((item) => (
                    <div key={item.name} className="amx-mc-progress-item">
                      <div className="amx-mc-progress-meta">
                        <span className="amx-mc-progress-name">{item.name}</span>
                        <div className="amx-mc-progress-stat">
                          <span className="amx-mc-progress-units">{item.units} Units</span>
                          <span className="amx-mc-progress-pct">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="amx-mc-progress-track">
                        <div
                          className={`amx-mc-progress-bar ${item.colorClass}`}
                          style={{ width: `${item.percentage}%` }}
                          role="progressbar"
                          aria-valuenow={item.percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Issued Consumables Notice */}
          <div className="amx-mc-notice-card" id="mcNoticeCard">
            <div>
              <div className="amx-mc-notice-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                  info
                </span>
              </div>
              <h3 className="amx-mc-notice-heading">Issued Consumables Notice</h3>
              <p className="amx-mc-notice-text">
                This page displays consumable items and quantities that have been formally
                recorded as issued or fulfilled to your employee custodian profile. Pending,
                in-review, or unfulfilled requests do not count toward your issued totals and will
                appear here only upon verified physical handover.
              </p>

              <div className="amx-mc-notice-sync-box">
                <span className="material-symbols-outlined amx-mc-notice-sync-icon" aria-hidden="true">
                  verified_user
                </span>
                <div>
                  <div className="amx-mc-notice-sync-title">Custodian Profile Synchronized</div>
                  <div className="amx-mc-notice-sync-sub">
                    Formal issuance verified by Hardware Operations.
                  </div>
                </div>
              </div>
            </div>

            <div className="amx-mc-notice-footer">Custodian Status: Verified Custody</div>
          </div>
        </div>

        {/* Issued Consumables History Table */}
        <div className="amx-mc-table-card" id="mcTableCard">
          {/* Table Header Toolbar */}
          <div className="amx-mc-table-header">
            <div className="amx-mc-table-title-group">
              <h2 className="amx-mc-table-title">Issued Consumables History</h2>
              <span className="amx-mc-table-records-badge" id="mcRecordsBadge">
                {filteredRecords.length} {filteredRecords.length === 1 ? 'Record' : 'Records'} Issued
              </span>
            </div>
            <div>
              <span className="amx-mc-table-verified-label">Showing Verified Issues</span>
            </div>
          </div>

          {/* Table or Empty States */}
          {rawRecords.length === 0 ? (
            /* Honest empty state when signed-in employee has zero issued records */
            <div className="amx-mc-empty-state" id="mcEmptyStateNoConsumption">
              <span className="material-symbols-outlined amx-mc-empty-icon" aria-hidden="true">
                inventory_2
              </span>
              <h3 className="amx-mc-empty-title">No Consumable Records Formally Issued</h3>
              <p className="amx-mc-empty-text">
                No consumable equipment, peripherals, or supplies are currently recorded as
                issued to your employee profile. Approved requisitions will appear here once
                handover is confirmed.
              </p>
              <button
                type="button"
                className="amx-mc-empty-btn"
                onClick={() => handleNav('create-request')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  add_circle
                </span>
                <span>Create Requisition</span>
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            /* Empty state when search or filters return 0 results */
            <div className="amx-mc-empty-state" id="mcEmptyStateNoMatch">
              <span className="material-symbols-outlined amx-mc-empty-icon" aria-hidden="true">
                filter_alt_off
              </span>
              <h3 className="amx-mc-empty-title">No matching consumable records found</h3>
              <p className="amx-mc-empty-text">
                No issued items match your search or category filter criteria. Try adjusting your
                keywords or clear the filters.
              </p>
              <button
                type="button"
                className="amx-mc-empty-btn"
                id="mcClearFiltersBtn"
                onClick={handleResetFilters}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="amx-mc-table-wrap">
              <table className="amx-mc-table" aria-label="Issued Consumables History Table">
                <thead>
                  <tr>
                    <th>Item Name & Spec</th>
                    <th>Category</th>
                    <th>Qty Issued</th>
                    <th>Fulfillment Date</th>
                    <th>Related Request ID</th>
                    <th>Status / Reference</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody id="issued-table-body">
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      data-category={record.categoryKey}
                      className="amx-mc-row"
                    >
                      {/* 1. Item Name & Spec */}
                      <td>
                        <div className="amx-mc-item-cell">
                          <div className="amx-mc-item-icon-wrap" aria-hidden="true">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                              {record.icon}
                            </span>
                          </div>
                          <div className="amx-mc-item-info">
                            <span className="amx-mc-item-title">{record.itemName}</span>
                            <span className="amx-mc-item-spec">{record.specification}</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Category */}
                      <td>
                        <span className="amx-mc-cat-badge">{record.category}</span>
                      </td>

                      {/* 3. Qty Issued */}
                      <td>
                        <span className="amx-mc-qty-pill">
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '16px' }}
                            aria-hidden="true"
                          >
                            check_circle
                          </span>
                          <span>{record.quantityIssued} Units</span>
                        </span>
                      </td>

                      {/* 4. Fulfillment Date */}
                      <td>
                        <span className="amx-mc-date-cell">{record.fulfillmentDate}</span>
                      </td>

                      {/* 5. Related Request ID */}
                      <td>
                        <div className="amx-mc-req-cell">
                          <span className="amx-mc-req-id">{record.relatedRequestId}</span>
                          <button
                            type="button"
                            className="amx-mc-copy-btn"
                            title="Copy Request ID"
                            aria-label={`Copy Request ID ${record.relatedRequestId}`}
                            onClick={() => handleCopyReqId(record.relatedRequestId)}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: '16px' }}
                              aria-hidden="true"
                            >
                              content_copy
                            </span>
                          </button>
                        </div>
                      </td>

                      {/* 6. Status / Reference */}
                      <td>
                        <div className="amx-mc-status-cell">
                          <span className="amx-mc-status-pill">
                            <span className="amx-mc-status-dot" aria-hidden="true"></span>
                            <span>{record.status}</span>
                          </span>
                          <span className="amx-mc-ref-num">{record.reference}</span>
                        </div>
                      </td>

                      {/* 7. Action */}
                      <td className="amx-mc-action-cell">
                        <button
                          type="button"
                          className="amx-mc-btn-view-details"
                          onClick={() => handleNav(`my-requests/${record.relatedRequestId}`)}
                        >
                          <span>View Request Details</span>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '18px' }}
                            aria-hidden="true"
                          >
                            open_in_new
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table Pagination / Footer */}
              <div className="amx-mc-table-footer">
                <div className="amx-mc-footer-info" id="mcFooterInfo">
                  Displaying 1-{filteredRecords.length} of {filteredRecords.length} confirmed issuances
                </div>
                <div className="amx-mc-pagination">
                  <button
                    type="button"
                    className="amx-mc-page-btn disabled"
                    disabled
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <span className="amx-mc-page-num">Page 1 of 1</span>
                  <button
                    type="button"
                    className="amx-mc-page-btn disabled"
                    disabled
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Informational / Guidance Card */}
        <div className="amx-mc-footer-card" id="mcRecordedConsumptionNotice">
          <div className="amx-mc-footer-card-icon" aria-hidden="true">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
              info
            </span>
          </div>
          <div className="amx-mc-footer-card-content">
            <h4 className="amx-mc-footer-card-title">Recorded Consumption Record</h4>
            <p className="amx-mc-footer-card-desc">
              This page displays consumable equipment and supplies formally recorded as issued to
              your employee custodian account. Only completed and verified physical handovers are
              tracked in these records.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

