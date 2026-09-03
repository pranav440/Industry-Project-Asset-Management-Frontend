import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AssetFilters } from '../components/AssetFilters';
import { AssetTable } from '../components/AssetTable';
import { ASSETS_MOCK_DATA, type AssetItem } from '../data/assetsData';
import './Assets.css';

interface AssetsPageProps {
  onNavigate?: (route: string) => void;
  onSignOut?: () => void;
}

export const AssetsPage: React.FC<AssetsPageProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [custodianFilter, setCustodianFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleExport = () => {
    showToast('Exporting Asset Inventory records (.CSV)...');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setLocationFilter('');
    setCustodianFilter('');
    setCategoryFilter('');
    setCurrentPage(1);
    showToast('Filters reset to default.');
  };

  const handleRowAction = (asset: AssetItem) => {
    showToast(`Asset details options for ${asset.id} (${asset.name})`);
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

  // Filter assets based on Search + Location + Custodian + Category
  const filteredAssets = useMemo(() => {
    return ASSETS_MOCK_DATA.filter((item) => {
      // Global Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          item.id.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.custodian.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q);

        if (!matchesSearch) return false;
      }

      // Location match
      if (locationFilter && item.location !== locationFilter) {
        return false;
      }

      // Custodian match
      if (custodianFilter && item.custodian !== custodianFilter) {
        return false;
      }

      // Category match
      if (categoryFilter && item.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, locationFilter, custodianFilter, categoryFilter]);

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
      searchPlaceholder="Search assets..."
      onAddAsset={() => showToast('New Asset Registration workflow — Future module dependency.')}
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

      <div className="amx-assets-page-container">
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
              aria-label="Export asset inventory records"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                download
              </span>
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Main Card: Filters Toolbar + Table */}
        <div className="amx-asset-main-card">
          <AssetFilters
            location={locationFilter}
            custodian={custodianFilter}
            category={categoryFilter}
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
            onReset={handleResetFilters}
          />

          <AssetTable
            assets={filteredAssets}
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
