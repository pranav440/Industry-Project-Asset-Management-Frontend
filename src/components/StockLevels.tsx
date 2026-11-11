import React from 'react';
import type { StockLevelItem } from '../data/dashboardData';

interface StockLevelsProps {
  stocks: StockLevelItem[];
  onViewConsumables?: () => void;
}

export const StockLevels: React.FC<StockLevelsProps> = ({ stocks = [], onViewConsumables }) => {
  return (
    <section className="amx-card-panel" aria-labelledby="stock-levels-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 id="stock-levels-title" className="amx-section-title" style={{ margin: 0 }}>
          Stock Levels
        </h3>
        {onViewConsumables && (
          <button
            type="button"
            onClick={onViewConsumables}
            style={{
              background: 'none',
              border: 'none',
              color: '#0891B2',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
            aria-label="Manage consumable stock levels"
          >
            <span>Manage Stock</span>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
          </button>
        )}
      </div>
      <div className="amx-stock-list">
        {(stocks || []).length === 0 ? (
          <p style={{ color: 'var(--amx-dash-text-muted)', fontSize: '13px', fontStyle: 'italic', margin: '16px 0' }}>
            No inventory stock data available.
          </p>
        ) : (
          stocks.map((stock) => (
            <div key={stock.id} className="amx-stock-item">
              <div
                className={`amx-stock-meta ${stock.isCritical ? 'critical' : ''}`}
              >
                <span className="amx-stock-category">{stock.category}</span>
                <span className="amx-stock-count">
                  {stock.current}/{stock.total}
                </span>
              </div>
              <div
                className="amx-stock-bar-bg"
                role="progressbar"
                aria-valuenow={stock.current}
                aria-valuemin={0}
                aria-valuemax={stock.total}
                aria-label={`${stock.category} stock level: ${stock.current} of ${stock.total}`}
              >
                <div
                  className="amx-stock-bar-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, stock.percentage))}%`,
                    backgroundColor: stock.colorHex,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
