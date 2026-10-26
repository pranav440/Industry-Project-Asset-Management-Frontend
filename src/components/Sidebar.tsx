import React from 'react';
import { getUser, type UserRole } from '../auth/session';

interface SidebarProps {
  currentNav?: string;
  role?: UserRole;
  onNavigate?: (path: string) => void;
  onSignOut?: () => void;
  onAddAsset?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentNav = 'Dashboard',
  role,
  onNavigate,
  onSignOut,
  onAddAsset,
}) => {
  const activeRole = role ?? getUser()?.role ?? 'admin';
  const isEmployee = activeRole === 'employee';

  const adminNavItems = [
    { label: 'Dashboard', path: 'dashboard', icon: 'dashboard', fill: true },
    { label: 'Assets', path: 'assets', icon: 'inventory_2' },
    { label: 'Consumables', path: 'consumables', icon: 'shopping_cart' },
    { label: 'Requests', path: 'requests', icon: 'pending_actions' },
    { label: 'Movement', path: 'movement', icon: 'swap_horiz' },
    { label: 'Gate Pass', path: 'gate-pass', icon: 'confirmation_number' },
    { label: 'Maintenance', path: 'maintenance', icon: 'build' },
    { label: 'Reports', path: 'reports', icon: 'assessment' },
    { label: 'Administration', path: 'administration', icon: 'settings' },
  ];

  const employeeNavItems = [
    { label: 'Dashboard', path: 'dashboard', icon: 'grid_view', fill: true },
    { label: 'My Requests', path: 'my-requests', icon: 'pending_actions' },
    { label: 'Create Request', path: 'create-request', icon: 'post_add' },
    { label: 'My Assigned Assets', path: 'my-assigned-assets', icon: 'devices' },
    { label: 'My Consumption', path: 'my-consumption', icon: 'bar_chart' },
  ];

  const navItems = isEmployee ? employeeNavItems : adminNavItems;

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const handleSignOutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSignOut) {
      onSignOut();
    }
  };

  return (
    <nav className="amx-sidebar" aria-label="Main Navigation">
      {/* Brand Header */}
      <div className="amx-sidebar-brand">
        <span className="material-symbols-outlined amx-brand-logo-icon" aria-hidden="true">
          {isEmployee ? 'inventory_2' : 'dataset'}
        </span>
        <div>
          <h1 className="amx-brand-title">AssetMX</h1>
          <p className="amx-brand-subtitle">
            {isEmployee ? 'Employee Portal' : 'Enterprise Management'}
          </p>
        </div>
      </div>

      {/* Action CTA for Admin or Section Label for Employee */}
      {!isEmployee ? (
        <div className="amx-sidebar-cta">
          <button
            type="button"
            className="amx-add-asset-btn"
            onClick={onAddAsset}
            aria-label="Add New Asset"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">
              add
            </span>
            <span>Add New Asset</span>
          </button>
        </div>
      ) : (
        <div className="amx-sidebar-section-header" style={{ padding: '4px 24px 12px 24px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--amx-dash-navy-muted, #8b95ad)',
            }}
          >
            Self-Service Menu
          </span>
        </div>
      )}

      {/* Main Nav Items */}
      <div className="amx-sidebar-nav">
        <ul className="amx-nav-list" role="menubar">
          {navItems.map((item) => {
            const isActive =
              item.label.toLowerCase() === currentNav.toLowerCase() ||
              item.path.toLowerCase() === currentNav.toLowerCase();
            return (
              <li key={item.path} className="amx-nav-item" role="none">
                <a
                  href={`#${item.path}`}
                  role="menuitem"
                  aria-current={isActive ? 'page' : undefined}
                  className={`amx-nav-link ${isActive ? 'active' : ''}`}
                  onClick={(e) => handleNavClick(e, item.path)}
                  data-path={item.path}
                >
                  <span
                    className="material-symbols-outlined"
                    style={isActive && item.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Utility Footer */}
      <div className="amx-sidebar-footer">
        <ul className="amx-nav-list" role="menu">
          <li className="amx-nav-item" role="none">
            <a
              href="#support"
              role="menuitem"
              className="amx-nav-link"
              onClick={(e) => handleNavClick(e, 'support')}
              data-path="support"
            >
              <span className="material-symbols-outlined" aria-hidden="true">contact_support</span>
              <span>Support</span>
            </a>
          </li>
          <li className="amx-nav-item" role="none">
            <a
              href="#signout"
              role="menuitem"
              className="amx-nav-link"
              onClick={handleSignOutClick}
              data-path="login"
            >
              <span className="material-symbols-outlined" aria-hidden="true">logout</span>
              <span>Sign Out</span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
};

