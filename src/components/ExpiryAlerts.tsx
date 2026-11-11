import React from 'react';
import type { ExpiryAlertItem } from '../data/dashboardData';

interface ExpiryAlertsProps {
  alerts: ExpiryAlertItem[];
  onViewConsumables?: () => void;
}

export const ExpiryAlerts: React.FC<ExpiryAlertsProps> = ({ alerts = [], onViewConsumables }) => {
  return (
    <section className="amx-card-panel amx-expiry-card" aria-labelledby="expiry-alerts-title">
      {/* Watermark Warning Icon */}
      <div className="amx-expiry-watermark" aria-hidden="true">
        <span className="material-symbols-outlined">warning</span>
      </div>

      {/* Header */}
      <div className="amx-expiry-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" aria-hidden="true">calendar_today</span>
          <h3 id="expiry-alerts-title" style={{ fontSize: 'inherit', fontWeight: 'inherit', margin: 0 }}>
            Expiry Alerts
          </h3>
        </div>
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
            aria-label="View all consumables"
          >
            <span>View All</span>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
          </button>
        )}
      </div>

      {/* Alert List */}
      <ul className="amx-expiry-list">
        {(alerts || []).length === 0 ? (
          <li style={{ color: 'var(--amx-dash-text-muted)', fontSize: '13px', fontStyle: 'italic', listStyle: 'none' }}>
            No critical expiry alerts at this time.
          </li>
        ) : (
          alerts.map((alert) => (
            <li
              key={alert.id}
              className={`amx-expiry-item ${alert.isUrgent ? 'urgent' : 'normal'}`}
            >
              <div>
                <p className="amx-expiry-item-title">{alert.title}</p>
                <p
                  className={`amx-expiry-item-date ${
                    alert.isUrgent ? 'urgent' : 'normal'
                  }`}
                >
                  {alert.expiryText}
                </p>
              </div>
              <span
                className={`material-symbols-outlined amx-expiry-icon ${
                  alert.isUrgent ? 'urgent' : 'normal'
                }`}
                aria-label={alert.isUrgent ? 'Urgent Alert' : 'Informational Alert'}
              >
                {alert.isUrgent ? 'error' : 'info'}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
};
