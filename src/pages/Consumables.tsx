import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getStoredConsumables,
  computeStockStatus,
  getExpiryClassification,
  CONSUMABLE_FILTER_OPTIONS,
  type ConsumableDetailsData,
} from '../data/consumablesData';
import './Consumables.css';

interface ConsumablesPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const ConsumablesPage: React.FC<ConsumablesPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [consumables, setConsumables] = useState<ConsumableDetailsData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setConsumables(getStoredConsumables());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    showToast('Exporting Consumable Stock & Expiry Ledger (.CSV)...');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setStockStatusFilter('');
    setExpiryFilter('');
    setLocationFilter('');
    setCurrentPage(1);
    showToast('Consumable filters reset to default.');
  };

  // Compute 4 Summary Cards Metrics
  const summaryMetrics = useMemo(() => {
    const totalItems = consumables.length;
    let lowStockCount = 0;
    let expiringSoonCount = 0;
    let totalStockCount = 0;

    consumables.forEach((item) => {
      totalStockCount += item.availableStock;
      const status = computeStockStatus(item.availableStock, item.threshold);
      if (status === 'Low Stock' || status === 'Out of Stock') {
        lowStockCount += 1;
      }
      const expState = getExpiryClassification(item.expiryDate);
      if (expState === 'upcoming' || expState === 'expired') {
        expiringSoonCount += 1;
      }
    });

    return {
      totalItems,
      lowStockCount,
      expiringSoonCount,
      totalStockCount,
    };
  }, [consumables]);

  // Filter consumables list
  const filteredConsumables = useMemo(() => {
    return consumables.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesBatch = item.batchId.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesBatch && !matchesCategory) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter && item.category !== categoryFilter) {
        return false;
      }

      // Stock status filter
      const currentStatus = computeStockStatus(item.availableStock, item.threshold);
      if (stockStatusFilter && currentStatus !== stockStatusFilter) {
        return false;
      }

      // Expiry filter
      if (expiryFilter) {
        const expClass = getExpiryClassification(item.expiryDate);
        if (expClass !== expiryFilter) {
          return false;
        }
      }

      // Location filter
      if (locationFilter && item.location !== locationFilter) {
        return false;
      }

      return true;
    });
  }, [consumables, searchQuery, categoryFilter, stockStatusFilter, expiryFilter, locationFilter]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredConsumables.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredConsumables.slice(start, start + pageSize);
  }, [filteredConsumables, currentPage, pageSize]);

  const handleRowClick = (consumableId: string) => {
    onNavigate?.(`consumables/${encodeURIComponent(consumableId)}`);
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

  return (
    <DashboardLayout
      currentNav="Consumables"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(q) => {
        setSearchQuery(q);
        setCurrentPage(1);
      }}
      searchValue={searchQuery}
      searchPlaceholder="Search consumables..."
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

      <div className="amx-consumables-container">
        {/* Page Header */}
        <div className="amx-consumables-header">
          <div className="amx-consumables-title-area">
            <h2 className="amx-consumables-title">Consumables</h2>
            <p className="amx-consumables-subtitle">
              Manage consumable stock, batches, expiry, and consumption.
            </p>
          </div>
          <div className="amx-consumables-header-actions">
            <button
              type="button"
              className="amx-btn-secondary"
              onClick={handleExport}
              aria-label="Export consumable records"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                download
              </span>
              <span>Export</span>
            </button>
            <button
              type="button"
              className="amx-btn-primary"
              onClick={() => onNavigate?.('consumables/new')}
              aria-label="Add Consumable"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                add
              </span>
              <span>Add Consumable</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="amx-consumables-summary-grid">
          {/* Card 1: Total Items */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Total Items</span>
              <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">
                category
              </span>
            </div>
            <div className="amx-metric-value">{summaryMetrics.totalItems}</div>
            <div className="amx-metric-subtext">Registered consumable catalog SKUs</div>
          </div>

          {/* Card 2: Low Stock */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Low Stock</span>
              <span className="material-symbols-outlined amx-metric-icon error" aria-hidden="true">
                warning
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: summaryMetrics.lowStockCount > 0 ? '#ba1a1a' : undefined }}>
              {summaryMetrics.lowStockCount}
            </div>
            <div className="amx-metric-subtext error">At or below reorder threshold</div>
          </div>

          {/* Card 3: Expiring Soon */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Expiring Soon</span>
              <span className="material-symbols-outlined amx-metric-icon" style={{ color: '#D97706' }} aria-hidden="true">
                event_upcoming
              </span>
            </div>
            <div className="amx-metric-value" style={{ color: summaryMetrics.expiringSoonCount > 0 ? '#D97706' : undefined }}>
              {summaryMetrics.expiringSoonCount}
            </div>
            <div className="amx-metric-subtext">Within 45 days or expired</div>
          </div>

          {/* Card 4: Total Stock */}
          <div className="amx-card-panel amx-metric-card">
            <div className="amx-metric-card-top">
              <span className="amx-metric-title">Total Stock</span>
              <span className="material-symbols-outlined amx-metric-icon" aria-hidden="true">
                inventory
              </span>
            </div>
            <div className="amx-metric-value">{summaryMetrics.totalStockCount}</div>
            <div className="amx-metric-subtext">Combined units in inventory</div>
          </div>
        </div>

        {/* Main Table Card with Filter Bar */}
        <div className="amx-consumables-main-card">
          {/* Filter Bar */}
          <div className="amx-consumables-filters-bar">
            {/* Search */}
            <div className="amx-filter-search-wrap">
              <span className="material-symbols-outlined amx-filter-search-icon" aria-hidden="true">
                search
              </span>
              <input
                type="search"
                className="amx-filter-search-input"
                placeholder="Search consumables..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Search consumables"
              />
            </div>

            {/* Category Filter */}
            <select
              className="amx-consumable-filter-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Category"
            >
              {CONSUMABLE_FILTER_OPTIONS.categories.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Stock Status Filter */}
            <select
              className="amx-consumable-filter-select"
              value={stockStatusFilter}
              onChange={(e) => {
                setStockStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Stock Status"
            >
              {CONSUMABLE_FILTER_OPTIONS.stockStatuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Expiry Filter */}
            <select
              className="amx-consumable-filter-select"
              value={expiryFilter}
              onChange={(e) => {
                setExpiryFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Expiry"
            >
              {CONSUMABLE_FILTER_OPTIONS.expiries.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Location Filter */}
            <select
              className="amx-consumable-filter-select"
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Location"
            >
              {CONSUMABLE_FILTER_OPTIONS.locations.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Reset */}
            <button
              type="button"
              className="amx-filter-reset-btn"
              onClick={handleResetFilters}
              aria-label="Reset all filters"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                restart_alt
              </span>
              <span>Reset</span>
            </button>
          </div>

          {/* Table */}
          <div className="amx-table-scroll-wrapper">
            <table className="amx-consumables-table" aria-label="Consumables inventory list">
              <thead>
                <tr>
                  <th scope="col">Consumable ID</th>
                  <th scope="col">Item Name</th>
                  <th scope="col">Category</th>
                  <th scope="col">Batch ID</th>
                  <th scope="col">Location</th>
                  <th scope="col">Available Stock</th>
                  <th scope="col">Threshold</th>
                  <th scope="col">Expiry Date</th>
                  <th scope="col">Stock Status</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="amx-empty-table-cell">
                      <div className="amx-empty-state">
                        <span className="material-symbols-outlined amx-empty-icon" aria-hidden="true">
                          inventory_2
                        </span>
                        <p className="amx-empty-title">No consumables found</p>
                        <p className="amx-empty-desc">
                          Try adjusting your search criteria or resetting filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const status = computeStockStatus(item.availableStock, item.threshold);
                    const expiryClassification = getExpiryClassification(item.expiryDate);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleRowClick(item.id)}
                        tabIndex={0}
                        role="row"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleRowClick(item.id);
                          }
                        }}
                        aria-label={`View details for ${item.name}`}
                      >
                        <td className="amx-mono-cell">{item.id}</td>
                        <td className="amx-name-cell">{item.name}</td>
                        <td className="amx-muted-cell">{item.category}</td>
                        <td className="amx-mono-cell">{item.batchId}</td>
                        <td className="amx-muted-cell">{item.location}</td>
                        <td className={`amx-stock-cell ${status === 'Low Stock' ? 'low' : status === 'Out of Stock' ? 'out' : ''}`}>
                          {item.availableStock}
                        </td>
                        <td className="amx-muted-cell">{item.threshold}</td>
                        <td>
                          {item.expiryDate ? (
                            <span className={`amx-expiry-tag ${expiryClassification}`}>
                              {expiryClassification === 'expired' && (
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                                  error
                                </span>
                              )}
                              {expiryClassification === 'upcoming' && (
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">
                                  schedule
                                </span>
                              )}
                              {item.expiryDate}
                            </span>
                          ) : (
                            <span className="amx-expiry-tag none">N/A</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`amx-stock-badge ${
                              status === 'In Stock'
                                ? 'in-stock'
                                : status === 'Low Stock'
                                ? 'low-stock'
                                : 'out-of-stock'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="amx-action-btn-row"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(item.id);
                            }}
                            aria-label={`Open details for ${item.name}`}
                            title="Open details"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                              chevron_right
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="amx-consumables-pagination">
            <div className="amx-pagination-info">
              Showing {filteredConsumables.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredConsumables.length)} of{' '}
              {filteredConsumables.length} consumables
            </div>
            <div className="amx-pagination-controls">
              <button
                type="button"
                className="amx-page-btn arrow"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous Page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  chevron_left
                </span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`amx-page-btn ${pageNum === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                  aria-label={`Page ${pageNum}`}
                  aria-current={pageNum === currentPage ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              ))}

              <button
                type="button"
                className="amx-page-btn arrow"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next Page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ConsumablesPage;
