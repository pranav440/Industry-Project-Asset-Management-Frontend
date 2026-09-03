import React from 'react';
import type { StockLevelItem } from '../data/dashboardData';

interface StockLevelsProps {
  stocks: StockLevelItem[];
}

export const StockLevels: React.FC<StockLevelsProps> = ({ stocks = [] }) => {
  return (
    <section className="amx-card-panel" aria-labelledby="stock-levels-title">
      <h3 id="stock-levels-title" className="amx-section-title" style={{ marginBottom: '16px' }}>
        Stock Levels
      </h3>
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
