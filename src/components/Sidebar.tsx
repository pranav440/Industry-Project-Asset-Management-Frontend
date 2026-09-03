import React from 'react';

interface SidebarProps {
  currentNav?: string;
  onNavigate?: (path: string) => void;
  onSignOut?: () => void;
  onAddAsset?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentNav = 'Dashboard',
  onNavigate,
  onSignOut,
  onAddAsset,
}) => {
  const mainNavItems = [
    { label: 'Dashboard', icon: 'dashboard', fill: true },
    { label: 'Assets', icon: 'inventory_2' },
    { label: 'Consumables', icon: 'shopping_cart' },
    { label: 'Requests', icon: 'pending_actions' },
    { label: 'Movement', icon: 'swap_horiz' },
    { label: 'Gate Pass', icon: 'confirmation_number' },
    { label: 'Maintenance', icon: 'build' },
    { label: 'Reports', icon: 'assessment' },
    { label: 'Administration', icon: 'settings' },
  ];

  const handleNavClick = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(label.toLowerCase());
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
          dataset
        </span>
        <div>
          <h1 className="amx-brand-title">AssetMX</h1>
          <p className="amx-brand-subtitle">Enterprise Management</p>
        </div>
      </div>

      {/* Action CTA */}
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

      {/* Main Nav Items */}
      <div className="amx-sidebar-nav">
        <ul className="amx-nav-list" role="menubar">
          {mainNavItems.map((item) => {
            const isActive = item.label.toLowerCase() === currentNav.toLowerCase();
            return (
              <li key={item.label} className="amx-nav-item" role="none">
                <a
                  href={`#${item.label.toLowerCase()}`}
                  role="menuitem"
                  aria-current={isActive ? 'page' : undefined}
                  className={`amx-nav-link ${isActive ? 'active' : ''}`}
                  onClick={(e) => handleNavClick(e, item.label)}
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
