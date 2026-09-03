import React from 'react';
import type { AssetItem } from '../data/assetsData';
import { AssetStatusBadge } from './AssetStatusBadge';

interface AssetTableProps {
  assets: AssetItem[];
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onActionClick?: (asset: AssetItem) => void;
}

export const AssetTable: React.FC<AssetTableProps> = ({
  assets = [],
  currentPage = 1,
  onPageChange,
  onActionClick,
}) => {
  const visibleCount = assets.length;

  return (
    <div className="amx-asset-table-card">
      <div className="amx-asset-table-scroll-wrapper">
        <table className="amx-asset-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '160px' }}>Asset ID</th>
              <th scope="col" style={{ minWidth: '190px' }}>Asset Name</th>
              <th scope="col" style={{ minWidth: '140px' }}>Category</th>
              <th scope="col" style={{ minWidth: '150px' }}>Location</th>
              <th scope="col" style={{ minWidth: '150px' }}>Custodian</th>
              <th scope="col" style={{ minWidth: '145px' }}>Status</th>
              <th scope="col" style={{ width: '70px', textAlign: 'right' }}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={7} className="amx-empty-table-cell">
                  <div className="amx-empty-state">
                    <span className="material-symbols-outlined amx-empty-icon" aria-hidden="true">
                      search_off
                    </span>
                    <p className="amx-empty-title">No assets found.</p>
                    <p className="amx-empty-desc">Try changing your search or filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.id} className="amx-asset-row">
                  <td className="amx-asset-id-cell" title={asset.id}>
                    {asset.id}
                  </td>
                  <td className="amx-asset-name-cell" title={asset.name}>
                    {asset.name}
                  </td>
                  <td className="amx-asset-muted-cell" title={asset.category}>
                    {asset.category}
                  </td>
                  <td className="amx-asset-muted-cell" title={asset.location}>
                    {asset.location}
                  </td>
                  <td className="amx-asset-muted-cell" title={asset.custodian}>
                    {asset.custodian}
                  </td>
                  <td className="amx-asset-status-cell">
                    <AssetStatusBadge status={asset.status} />
                  </td>
                  <td className="amx-asset-action-cell">
                    <button
                      type="button"
                      className="amx-row-action-btn"
                      aria-label={`Options for asset ${asset.id} (${asset.name})`}
                      title="More options"
                      onClick={() => onActionClick?.(asset)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        more_vert
                      </span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="amx-asset-pagination">
        <span className="amx-pagination-info">
          {visibleCount === 0
            ? 'Showing 0 of 124 assets'
            : `Showing 1 to ${visibleCount} of 124 assets`}
        </span>
        <div className="amx-pagination-controls" role="navigation" aria-label="Asset inventory pagination">
          <button
            type="button"
            className="amx-page-btn arrow"
            disabled={currentPage <= 1}
            aria-label="Previous Page"
            onClick={() => onPageChange?.(currentPage - 1)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
              chevron_left
            </span>
          </button>
          <button
            type="button"
            className={`amx-page-btn ${currentPage === 1 ? 'active' : ''}`}
            aria-current={currentPage === 1 ? 'page' : undefined}
            onClick={() => onPageChange?.(1)}
          >
            1
          </button>
          <button
            type="button"
            className={`amx-page-btn ${currentPage === 2 ? 'active' : ''}`}
            aria-current={currentPage === 2 ? 'page' : undefined}
            onClick={() => onPageChange?.(2)}
          >
            2
          </button>
          <button
            type="button"
            className={`amx-page-btn ${currentPage === 3 ? 'active' : ''}`}
            aria-current={currentPage === 3 ? 'page' : undefined}
            onClick={() => onPageChange?.(3)}
          >
            3
          </button>
          <span className="amx-page-ellipsis" aria-hidden="true">...</span>
          <button
            type="button"
            className="amx-page-btn arrow"
            aria-label="Next Page"
            onClick={() => onPageChange?.(currentPage + 1)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
