import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentNav?: string;
  onNavigate?: (path: string) => void;
  onSignOut?: () => void;
  onSearch?: (query: string) => void;
  searchValue?: string;
  onAddAsset?: () => void;
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  onProfileClick?: () => void;
  searchPlaceholder?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  currentNav = 'Dashboard',
  onNavigate,
  onSignOut,
  onSearch,
  searchValue,
  onAddAsset,
  onNotificationsClick,
  onHelpClick,
  onProfileClick,
  searchPlaceholder,
}) => {
  return (
    <div className="amx-dashboard-shell">
      {/* Full-height Sidebar */}
      <Sidebar
        currentNav={currentNav}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        onAddAsset={onAddAsset}
      />

      {/* Main Area */}
      <div className="amx-main-area">
        {/* Header */}
        <Header
          onSearch={onSearch}
          searchValue={searchValue}
          onNotificationsClick={onNotificationsClick}
          onHelpClick={onHelpClick}
          onProfileClick={onProfileClick}
          searchPlaceholder={searchPlaceholder}
        />

        {/* Scrollable Content */}
        <main className="amx-scrollable-content">
          <div className="amx-content-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
