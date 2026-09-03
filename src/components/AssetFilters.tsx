import React from 'react';
import { ASSET_FILTER_OPTIONS } from '../data/assetsData';

interface AssetFiltersProps {
  location: string;
  custodian: string;
  category: string;
  onLocationChange: (val: string) => void;
  onCustodianChange: (val: string) => void;
  onCategoryChange: (val: string) => void;
  onReset: () => void;
}

export const AssetFilters: React.FC<AssetFiltersProps> = ({
  location,
  custodian,
  category,
  onLocationChange,
  onCustodianChange,
  onCategoryChange,
  onReset,
}) => {
  return (
    <div className="amx-asset-filters-bar" role="search" aria-label="Asset inventory filters">
      <div className="amx-filter-group">
        <label htmlFor="filter-location" className="sr-only">Filter by Location</label>
        <select
          id="filter-location"
          className="amx-filter-select"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          aria-label="Filter by Location"
        >
          {ASSET_FILTER_OPTIONS.locations.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="amx-filter-group">
        <label htmlFor="filter-custodian" className="sr-only">Filter by Custodian</label>
        <select
          id="filter-custodian"
          className="amx-filter-select"
          value={custodian}
          onChange={(e) => onCustodianChange(e.target.value)}
          aria-label="Filter by Custodian"
        >
          {ASSET_FILTER_OPTIONS.custodians.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="amx-filter-group">
        <label htmlFor="filter-category" className="sr-only">Filter by Category</label>
        <select
          id="filter-category"
          className="amx-filter-select"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="Filter by Category"
        >
          {ASSET_FILTER_OPTIONS.categories.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="amx-filter-reset-wrap">
        <button
          type="button"
          className="amx-filter-reset-btn"
          onClick={onReset}
          aria-label="Reset all filters"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
            restart_alt
          </span>
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
