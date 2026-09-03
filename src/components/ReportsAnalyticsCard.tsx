import React from 'react';

interface ReportsAnalyticsCardProps {
  onViewAll?: () => void;
}

export const ReportsAnalyticsCard: React.FC<ReportsAnalyticsCardProps> = ({
  onViewAll,
}) => {
  return (
    <section className="amx-analytics-card">
      <span className="material-symbols-outlined amx-analytics-icon">
        bar_chart
      </span>
      <h3 className="amx-analytics-title">Reports &amp; Analytics</h3>
      <p className="amx-analytics-desc">
        Access utilization, request, maintenance and compliance analytics.
      </p>
      <button
        type="button"
        className="amx-analytics-btn"
        onClick={() => {
          if (onViewAll) {
            onViewAll();
          } else {
            alert('Reports & Analytics navigation placeholder');
          }
        }}
      >
        View All Analytics
      </button>
    </section>
  );
};
