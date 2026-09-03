import React from 'react';
import type { MetricCardData } from '../data/dashboardData';

interface MetricCardProps {
  data: MetricCardData;
}

export const MetricCard: React.FC<MetricCardProps> = ({ data }) => {
  if (!data) return null;

  const isErrorIcon = data.id === 'pending-approvals' || data.id === 'low-stock-alerts';
  const hasRadialAlert = data.id === 'low-stock-alerts';

  return (
    <div
      className={`amx-card-panel amx-metric-card ${hasRadialAlert ? 'has-radial-alert' : ''}`}
      tabIndex={0}
      role="region"
      aria-label={`${data.title}: ${data.value}`}
    >
      <div className="amx-metric-card-top">
        <span className="amx-metric-title">{data.title}</span>
        <span
          className={`material-symbols-outlined amx-metric-icon ${isErrorIcon ? 'error' : ''}`}
          aria-hidden="true"
        >
          {data.icon}
        </span>
      </div>

      <div className="amx-metric-value">{data.value}</div>

      {/* Footer info: trend, subtext, or progress bar */}
      {data.trend && (
        <div className="amx-metric-trend">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
            {data.trend.direction === 'down' ? 'arrow_downward' : 'arrow_upward'}
          </span>
          <span>{data.trend.text}</span>
        </div>
      )}

      {data.subtext && (
        <div className={`amx-metric-subtext ${data.statusType ?? ''}`}>
          {data.subtext}
        </div>
      )}

      {data.progress !== undefined && (
        <div
          className="amx-progress-bar-bg"
          role="progressbar"
          aria-valuenow={data.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${data.title} progress: ${data.progress}%`}
        >
          <div
            className="amx-progress-bar-fill"
            style={{ width: `${Math.min(100, Math.max(0, data.progress))}%` }}
          />
        </div>
      )}
    </div>
  );
};
