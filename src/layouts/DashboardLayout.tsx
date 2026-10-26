import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { type UserRole } from '../auth/session';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentNav?: string;
  role?: UserRole;
  userName?: string;
  userRoleSubtitle?: string;
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
  role,
  userName,
  userRoleSubtitle,
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
        role={role}
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
          role={role}
          userName={userName}
          userRoleSubtitle={userRoleSubtitle}
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

