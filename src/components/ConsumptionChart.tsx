import React from 'react';
import type { DepartmentConsumptionItem } from '../data/dashboardData';

interface ConsumptionChartProps {
  total: string;
  departments: DepartmentConsumptionItem[];
}

export const ConsumptionChart: React.FC<ConsumptionChartProps> = ({
  total = '₹0',
  departments = [],
}) => {
  const deptSummary = (departments || [])
    .map((d) => `${d.name}: ${d.percentage}%`)
    .join(', ');

  return (
    <section className="amx-card-panel amx-consumption-card" aria-labelledby="consumption-chart-title">
      <h3 id="consumption-chart-title" className="amx-section-title">
        Consumption by Dept
      </h3>

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
    </section>
  );
};
