import React, { useState } from 'react';
import type { AssetInventoryData } from '../data/dashboardData';

interface AssetInventoryCardProps {
  data: AssetInventoryData;
  onFilterChange?: (dimension: string, value: string) => void;
}

export const AssetInventoryCard: React.FC<AssetInventoryCardProps> = ({
  data,
  onFilterChange,
}) => {
  const [selectedLocation, setSelectedLocation] = useState(data.location);
  const [selectedCustodian, setSelectedCustodian] = useState(data.custodian);
  const [selectedCategory, setSelectedCategory] = useState(data.category);

  const locations = ['HQ - Floor 4', 'Warehouse A', 'Campus B'];
  const custodians = ['IT Dept', 'Facilities', 'Operations'];
  const categories = ['Hardware', 'IT Peripherals', 'Office Supplies'];

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

  return (
    <section className="amx-card-panel" aria-labelledby="asset-inventory-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 id="asset-inventory-title" className="amx-section-title">
          Asset Inventory
        </h3>
        <span style={{ fontSize: '11px', color: 'var(--amx-dash-text-muted)', fontWeight: 600 }}>
          CLICK TO FILTER
        </span>
      </div>

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
          <span className="amx-inventory-label">Location</span>
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
          <span className="amx-inventory-label">Custodian</span>
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
          <span className="amx-inventory-label">Category</span>
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
