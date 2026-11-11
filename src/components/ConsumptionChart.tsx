import React from 'react';
import type { DepartmentConsumptionItem } from '../data/dashboardData';

interface ConsumptionChartProps {
  total?: string;
  departments?: DepartmentConsumptionItem[] | null;
}

export const ConsumptionChart: React.FC<ConsumptionChartProps> = ({
  total = '₹0',
  departments = [],
}) => {
  const isConfigured = Boolean(departments && departments.length > 0);
  const deptSummary = (departments || [])
    .map((d) => `${d.name}: ${d.percentage}%`)
    .join(', ');

  return (
    <section className="amx-card-panel amx-consumption-card" aria-labelledby="consumption-chart-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 id="consumption-chart-title" className="amx-section-title" style={{ margin: 0 }}>
          Consumption by Dept
        </h3>
        {!isConfigured && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'var(--amx-dash-surface-highest, #1f293d)',
              color: 'var(--amx-dash-text-muted, #94a3b8)',
              border: '1px solid var(--amx-dash-border, rgba(255, 255, 255, 0.1))',
            }}
          >
            Not Configured
          </span>
        )}
      </div>

      {!isConfigured ? (
        <div
          className="amx-chart-wrapper"
          style={{
            minHeight: '160px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '24px 12px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '36px', color: 'var(--amx-dash-text-muted)', marginBottom: '8px', opacity: 0.6 }}
            aria-hidden="true"
          >
            pie_chart
          </span>
          <p style={{ color: 'var(--amx-dash-text-muted)', fontSize: '13px', fontStyle: 'italic', margin: '0 0 6px 0' }}>
            Department consumption telemetry is not configured in AssetMX.
          </p>
          <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--amx-dash-text-muted)', opacity: 0.8 }}>
            Cost center allocation and departmental consumption analytics are not tracked.
          </p>
        </div>
      ) : (
        <>
          {/* Real React/CSS Donut Visualization */}
          <div className="amx-chart-wrapper">
            <div
              className="amx-donut-chart"
              role="img"
              aria-label={`Department consumption distribution chart. Total: ${total}. Breakdown: ${deptSummary}`}
            >
              <div className="amx-donut-hole">
                <span className="amx-donut-center-text">{total}</span>
              </div>
            </div>
          </div>

          {/* Legends */}
          <div className="amx-dept-legends">
            <div className="amx-legend-col">
              {(departments || []).slice(0, 2).map((dept) => (
                <div key={dept.name} className="amx-legend-item">
                  <span
                    className="amx-legend-dot"
                    style={{ backgroundColor: dept.colorHex }}
                    aria-hidden="true"
                  />
                  <span>
                    {dept.name} ({dept.percentage}%)
                  </span>
                </div>
              ))}
            </div>
            <div className="amx-legend-col">
              {(departments || []).slice(2).map((dept) => (
                <div key={dept.name} className="amx-legend-item">
                  <span
                    className="amx-legend-dot"
                    style={{ backgroundColor: dept.colorHex }}
                    aria-hidden="true"
                  />
                  <span>
                    {dept.name} ({dept.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
