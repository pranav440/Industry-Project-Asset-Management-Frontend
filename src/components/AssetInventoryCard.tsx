import React, { useState } from 'react';
import type { AssetInventoryData } from '../data/dashboardData';

interface AssetInventoryCardProps {
  data: AssetInventoryData;
  onFilterChange?: (dimension: string, value: string) => void;
  onViewAssets?: () => void;
}

export const AssetInventoryCard: React.FC<AssetInventoryCardProps> = ({
  data,
  onFilterChange,
  onViewAssets,
}) => {
  const [selectedLocation, setSelectedLocation] = useState(data.location || 'All Locations');
  const [selectedCustodian, setSelectedCustodian] = useState(data.custodian || 'All Custodians');
  const [selectedCategory, setSelectedCategory] = useState(data.category || 'All Categories');

  const locations = ['All Locations', 'HQ - Floor 4', 'Warehouse A', 'Campus B', 'Basement B1'];
  const custodians = ['All Custodians', 'IT Dept', 'Facilities', 'Operations', 'DevOps'];
  const categories = ['All Categories', 'Hardware', 'IT Peripherals', 'Office Supplies', 'Lab Equipment'];

  const handleLocationToggle = () => {
    const nextIdx = (locations.indexOf(selectedLocation) + 1) % locations.length;
    const nextVal = locations[nextIdx];
    setSelectedLocation(nextVal);
    onFilterChange?.('location', nextVal);
  };

  const handleCustodianToggle = () => {
    const nextIdx = (custodians.indexOf(selectedCustodian) + 1) % custodians.length;
    const nextVal = custodians[nextIdx];
    setSelectedCustodian(nextVal);
    onFilterChange?.('custodian', nextVal);
  };

  const handleCategoryToggle = () => {
    const nextIdx = (categories.indexOf(selectedCategory) + 1) % categories.length;
    const nextVal = categories[nextIdx];
    setSelectedCategory(nextVal);
    onFilterChange?.('category', nextVal);
  };

  const activeCount = data.byStatus?.['Active'] ?? data.byStatus?.['active'] ?? 0;
  const maintenanceCount = data.byStatus?.['In Maintenance'] ?? data.byStatus?.['in_maintenance'] ?? 0;
  const inTransitCount = data.byStatus?.['In Transit'] ?? data.byStatus?.['in_transit'] ?? 0;

  return (
    <section className="amx-card-panel" aria-labelledby="asset-inventory-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h3 id="asset-inventory-title" className="amx-section-title">
            Asset Inventory
          </h3>
          {data.totalAssets !== undefined && (
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--amx-dash-text-muted)' }}>
              Total: <strong style={{ color: 'var(--amx-dash-text-primary)' }}>{data.totalAssets}</strong> registered units
            </p>
          )}
        </div>
        {onViewAssets && (
          <button
            type="button"
            onClick={onViewAssets}
            style={{
              background: 'none',
              border: 'none',
              color: '#0891B2',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            <span>View All</span>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
          </button>
        )}
      </div>

      {data.byStatus && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: '#D1FAE5',
            color: '#059669',
          }}>
            Active: {activeCount}
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: '#FEF3C7',
            color: '#D97706',
          }}>
            Maintenance: {maintenanceCount}
          </span>
          {inTransitCount > 0 && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '9999px',
              backgroundColor: '#E0F2FE',
              color: '#0284C7',
            }}>
              In Transit: {inTransitCount}
            </span>
          )}
        </div>
      )}

      <div className="amx-inventory-list">
        <div
          className="amx-inventory-item"
          style={{ cursor: 'pointer' }}
          onClick={handleLocationToggle}
          title="Click to cycle location filter"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLocationToggle(); }}
        >
          <span className="amx-inventory-label">Location Filter</span>
          <span className="amx-inventory-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {selectedLocation}
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--amx-dash-secondary-dim)' }}>
              unfold_more
            </span>
          </span>
        </div>

        <div
          className="amx-inventory-item"
          style={{ cursor: 'pointer' }}
          onClick={handleCustodianToggle}
          title="Click to cycle custodian filter"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCustodianToggle(); }}
        >
          <span className="amx-inventory-label">Custodian Filter</span>
          <span className="amx-inventory-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {selectedCustodian}
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--amx-dash-secondary-dim)' }}>
              unfold_more
            </span>
          </span>
        </div>

        <div
          className="amx-inventory-item"
          style={{ cursor: 'pointer' }}
          onClick={handleCategoryToggle}
          title="Click to cycle category filter"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCategoryToggle(); }}
        >
          <span className="amx-inventory-label">Category Filter</span>
          <span className="amx-inventory-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {selectedCategory}
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--amx-dash-secondary-dim)' }}>
              unfold_more
            </span>
          </span>
        </div>
      </div>
    </section>
  );
};

