import React from 'react';

export type ReportTab =
  | 'overview'
  | 'utilization'
  | 'requests'
  | 'reassignment'
  | 'maintenance'
  | 'disposal';

interface ReportTabsProps {
  activeTab: ReportTab;
  onSelectTab: (tab: ReportTab) => void;
}

export const ReportTabs: React.FC<ReportTabsProps> = ({ activeTab, onSelectTab }) => {
  const tabs: { id: ReportTab; label: string; icon: string; path: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'insights', path: '/reports' },
    { id: 'utilization', label: 'Asset Utilization', icon: 'pie_chart', path: '/reports/utilization' },
    { id: 'requests', label: 'Requests Report', icon: 'pending_actions', path: '/reports/requests' },
    { id: 'reassignment', label: 'Reassignment & Movement', icon: 'swap_horiz', path: '/reports/reassignment' },
    { id: 'maintenance', label: 'Maintenance vs Asset Value', icon: 'build', path: '/reports/maintenance' },
    { id: 'disposal', label: 'Disposal & Replacement Forecast', icon: 'event_repeat', path: '/reports/disposal' },
  ];

  return (
    <div className="amx-report-tabs-nav" role="tablist" aria-label="Reports & Analytics Views">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`report-panel-${tab.id}`}
            id={`report-tab-${tab.id}`}
            className={`amx-report-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="material-symbols-outlined amx-tab-icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="amx-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
