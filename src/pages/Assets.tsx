import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AssetFilters } from '../components/AssetFilters';
import { AssetTable } from '../components/AssetTable';
import { listAssets, type AssetApiError, type AssetRecord } from '../api/assetApi';
import type { AssetItem } from '../data/assetsData';
import { getUser } from '../auth/session';
import './Assets.css';

interface AssetsPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const AssetsPage: React.FC<AssetsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const currentUser = useMemo(() => getUser(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [custodianFilter, setCustodianFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      const result = await listAssets({
        search: searchQuery.trim() || undefined,
        location: locationFilter || undefined,
        custodian: custodianFilter || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        pageSize: 10,
      });

      setAssets(result.items || []);
      setTotal(result.total ?? 0);
      setTotalPages(Math.max(result.total_pages ?? 1, 1));
    } catch (error: unknown) {
      const status = (error as AssetApiError).status;
      setApiError(
        status === 401
          ? 'Your session has expired. Please sign in again.'
          : status === 403
          ? 'Admin access is required to view assets.'
          : status === 422
          ? 'The asset query filters are invalid.'
          : status && status >= 500
          ? 'The asset service is temporarily unavailable. Please retry.'
          : error instanceof Error
          ? error.message
          : 'Unable to load assets. Please check your connection and retry.'
      );
      setAssets([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, locationFilter, custodianFilter, categoryFilter, statusFilter, currentPage]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setLocationFilter('');
    setCustodianFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setCurrentPage(1);
    showToast('Filters reset to default.');
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const exportParams = {
        search: searchQuery.trim() || undefined,
        location: locationFilter || undefined,
        custodian: custodianFilter || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
      };

      const EXPORT_PAGE_SIZE = 100;
      let currentPageNum = 1;
      const firstResponse = await listAssets({
        ...exportParams,
        page: currentPageNum,
        pageSize: EXPORT_PAGE_SIZE,
      });

      const totalMatching = Number(firstResponse.total ?? 0);
      if (totalMatching === 0 || !firstResponse.items || firstResponse.items.length === 0) {
        showToast('No assets available to export.');
        setIsExporting(false);
        return;
      }

      // Deduplicate by stable asset_id
      const recordMap = new Map<string, AssetRecord>();
      firstResponse.items.forEach((item) => {
        if (item.asset_id && !recordMap.has(item.asset_id)) {
          recordMap.set(item.asset_id, item);
        }
      });

      const actualPageSize = Math.max(1, Number(firstResponse.page_size || EXPORT_PAGE_SIZE));
      const totalPages = Math.ceil(totalMatching / actualPageSize);

      while (currentPageNum < totalPages) {
        currentPageNum += 1;
        const nextResponse = await listAssets({
          ...exportParams,
          page: currentPageNum,
          pageSize: actualPageSize,
        });

        if (!nextResponse.items || nextResponse.items.length === 0) {
          break;
        }

        nextResponse.items.forEach((item) => {
          if (item.asset_id && !recordMap.has(item.asset_id)) {
            recordMap.set(item.asset_id, item);
          }
        });
      }

      const allRecords = Array.from(recordMap.values());
      const exportedCount = allRecords.length;

      const escapeCsv = (val: string | number | null | undefined): string => {
        if (val == null) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const lines: string[] = [];
      lines.push('AssetMX Asset Inventory Ledger Export');
      lines.push(`Generated,${new Date().toISOString()}`);
      lines.push(`Total Matching Records,${totalMatching}`);
      lines.push(`Exported Records,${exportedCount}`);
      lines.push('');
      lines.push('Asset ID,Asset Name,Category,Specification,Serial Number,Location,Custodian,Status,Purchase Date,Vendor,Total Cost,Warranty Period,Invoice Reference');

      allRecords.forEach((item) => {
        lines.push(
          [
            escapeCsv(item.asset_id),
            escapeCsv(item.name),
            escapeCsv(item.category),
            escapeCsv(item.specification || ''),
            escapeCsv(item.serial_number || ''),
            escapeCsv(item.location),
            escapeCsv(item.custodian),
            escapeCsv(item.status),
            escapeCsv(item.purchase_date || ''),
            escapeCsv(item.vendor_name || ''),
            escapeCsv(item.total_cost || ''),
            escapeCsv(item.warranty_period || ''),
            escapeCsv(item.invoice_reference || ''),
          ].join(',')
        );
      });

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `assetmx-inventory-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Exported ${exportedCount} asset record${exportedCount === 1 ? '' : 's'} to CSV.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to complete CSV export';
      showToast(`Failed to export assets: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRowAction = (asset: AssetItem) => {
    onNavigate?.(`assets/${asset.id}`);
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

  const tableAssets: AssetItem[] = assets.map((asset) => ({
    id: asset.asset_id,
    name: asset.name,
    category: asset.category,
    location: asset.location,
    custodian: asset.custodian,
    status: asset.status,
  }));

  return (
    <DashboardLayout
      currentNav="Assets"
      onNavigate={handleNav}
      onSignOut={onSignOut}
      onSearch={(q) => {
        setSearchQuery(q);
        setCurrentPage(1);
      }}
      searchValue={searchQuery}
      searchPlaceholder="Search assets by ID, name, custodian, location..."
      onAddAsset={() => onNavigate?.('assets/new')}
      onNotificationsClick={() =>
        showToast('Administrative alerts: check asset lifecycle updates.')
      }
      onHelpClick={() => showToast('AssetMX Enterprise Help Center & User Manual.')}
      onProfileClick={() => showToast(`Active User: ${currentUser?.full_name || 'Administrator'} (Role: ${currentUser?.role || 'Admin'}).`)}
      userName={currentUser?.full_name || 'Administrator'}
      userRoleSubtitle={currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Administrator'}
      role={currentUser?.role || 'admin'}
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

      <div className="amx-assets-page-container">
        {apiError && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#dc2626' }}>
                error
              </span>
              <span>{apiError}</span>
            </div>
            <button
              type="button"
              onClick={() => loadAssets()}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #dc2626',
                color: '#dc2626',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {isLoading && (
          <div
            role="status"
            style={{
              padding: '10px 14px',
              color: 'var(--amx-dash-text-muted)',
              fontSize: '13.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}
              aria-hidden="true"
            >
              sync
            </span>
            <span>Loading assets...</span>
          </div>
        )}

        {/* Page Header */}
        <div className="amx-assets-header">
          <div className="amx-assets-title-area">
            <h2 className="amx-assets-title">Assets</h2>
            <p className="amx-assets-subtitle">
              Centralized visibility and management of organizational assets.
            </p>
          </div>
          <div className="amx-assets-header-actions">
            <button
              type="button"
              className="amx-assets-export-btn"
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Export asset inventory records"
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '18px',
                  animation: isExporting ? 'spin 1s linear infinite' : undefined,
                }}
                aria-hidden="true"
              >
                {isExporting ? 'sync' : 'download'}
              </span>
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>

        {/* Main Card: Filters Toolbar + Table */}
        <div className="amx-asset-main-card">
          <AssetFilters
            location={locationFilter}
            custodian={custodianFilter}
            category={categoryFilter}
            status={statusFilter}
            onLocationChange={(val) => {
              setLocationFilter(val);
              setCurrentPage(1);
            }}
            onCustodianChange={(val) => {
              setCustodianFilter(val);
              setCurrentPage(1);
            }}
            onCategoryChange={(val) => {
              setCategoryFilter(val);
              setCurrentPage(1);
            }}
            onStatusChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
            onReset={handleResetFilters}
          />

          <AssetTable
            assets={tableAssets}
            total={total}
            pageSize={10}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={(page) => setCurrentPage(page)}
            onActionClick={handleRowAction}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AssetsPage;
