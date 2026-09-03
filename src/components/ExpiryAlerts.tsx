import React from 'react';
import type { ExpiryAlertItem } from '../data/dashboardData';

interface ExpiryAlertsProps {
  alerts: ExpiryAlertItem[];
}

export const ExpiryAlerts: React.FC<ExpiryAlertsProps> = ({ alerts = [] }) => {
  return (
    <section className="amx-card-panel amx-expiry-card" aria-labelledby="expiry-alerts-title">
      {/* Watermark Warning Icon */}
      <div className="amx-expiry-watermark" aria-hidden="true">
        <span className="material-symbols-outlined">warning</span>
      </div>

      {/* Header */}
      <div className="amx-expiry-header">
        <span className="material-symbols-outlined" aria-hidden="true">calendar_today</span>
        <h3 id="expiry-alerts-title" style={{ fontSize: 'inherit', fontWeight: 'inherit', margin: 0 }}>
          Expiry Alerts
        </h3>
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
