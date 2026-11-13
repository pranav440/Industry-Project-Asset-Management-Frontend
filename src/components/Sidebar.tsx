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
  const isHost = activeRole === 'host';
  const isGuard = activeRole === 'guard';
  const isSuperAdmin = activeRole === 'superadmin';

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

  const hostNavItems = [
    { label: 'Host Dashboard', path: 'dashboard', icon: 'grid_view', fill: true },
    { label: 'Gate Passes', path: 'gate-pass', icon: 'confirmation_number' },
    { label: 'Movement Activity', path: 'movement', icon: 'swap_horiz' },
  ];

  const guardNavItems = [
    { label: 'Guard Dashboard', path: 'dashboard', icon: 'security', fill: true },
    { label: 'Gate Passes', path: 'gate-pass', icon: 'confirmation_number' },
    { label: 'Gate Verification', path: 'gate-verification', icon: 'verified_user' },
    { label: 'Entry / Exit Logs', path: 'entry-exit-logs', icon: 'swap_horiz' },
    { label: 'Security Incidents', path: 'security-incidents', icon: 'report_problem' },
  ];

  const superadminNavItems = [
    { label: 'Platform Analytics', path: 'superadmin/analytics', icon: 'analytics', fill: true },
    { label: 'User & Role Management', path: 'superadmin/users', icon: 'manage_accounts' },
    { label: 'Audit & Logs', path: 'superadmin/audit-logs', icon: 'policy' },
    { label: 'System Configuration', path: 'superadmin/config', icon: 'settings' },
  ];

  const navItems = isEmployee
    ? employeeNavItems
    : isHost
    ? hostNavItems
    : isGuard
    ? guardNavItems
    : isSuperAdmin
    ? superadminNavItems
    : adminNavItems;

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
          {isEmployee ? 'inventory_2' : isGuard ? 'security' : isSuperAdmin ? 'admin_panel_settings' : 'dataset'}
        </span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="amx-brand-title">AssetMX</h1>
            {isHost && (
              <span
                className="amx-host-badge"
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(76, 215, 246, 0.16)',
                  color: 'var(--amx-dash-cyan-bright, #57dffe)',
                  border: '1px solid rgba(76, 215, 246, 0.3)',
                  lineHeight: 1.2,
                }}
              >
                HOST
              </span>
            )}
            {isGuard && (
              <span
                className="amx-guard-badge"
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(87, 223, 254, 0.16)',
                  color: 'var(--amx-dash-cyan-bright, #57dffe)',
                  border: '1px solid rgba(87, 223, 254, 0.3)',
                  lineHeight: 1.2,
                }}
              >
                GUARD
              </span>
            )}
            {isSuperAdmin && (
              <span
                className="amx-superadmin-badge"
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(99, 102, 241, 0.16)',
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  lineHeight: 1.2,
                }}
              >
                SUPERADMIN
              </span>
            )}
          </div>
          <p className="amx-brand-subtitle">
            {isEmployee ? 'Employee Portal' : isGuard ? 'Checkpoint Security' : isSuperAdmin ? 'Gov Core' : 'Enterprise Management'}
          </p>
        </div>
      </div>

      {/* Action CTA for Admin or Section Label for Host / Guard / Employee / SuperAdmin */}
      {isHost ? (
        <div className="amx-sidebar-section-header" style={{ padding: '6px 24px 10px 24px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--amx-dash-navy-muted, #8b95ad)',
            }}
          >
            Operations
          </span>
        </div>
      ) : isGuard ? (
        <div className="amx-sidebar-section-header" style={{ padding: '6px 24px 10px 24px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--amx-dash-navy-muted, #8b95ad)',
            }}
          >
            Checkpoint Operations
          </span>
        </div>
      ) : isSuperAdmin ? (
        <div className="amx-sidebar-section-header" style={{ padding: '6px 24px 10px 24px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--amx-dash-navy-muted, #8b95ad)',
            }}
          >
            Administration
          </span>
        </div>
      ) : !isEmployee ? (
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
        {(isHost || isGuard) && (
          <div className="amx-sidebar-section-header" style={{ padding: '0 24px 8px 24px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--amx-dash-navy-muted, #8b95ad)',
              }}
            >
              System
            </span>
          </div>
        )}
        <ul className="amx-nav-list" role="menu">
          <li className="amx-nav-item" role="none">
            <a
              href="#support"
              role="menuitem"
              className="amx-nav-link"
              onClick={(e) => handleNavClick(e, 'support')}
              data-path="support"
            >
              <span className="material-symbols-outlined" aria-hidden="true">help_outline</span>
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
        {isGuard ? (
          <div
            className="amx-sidebar-guard-version"
            style={{
              padding: '12px 24px 8px 24px',
              borderTop: '1px solid rgba(139, 149, 173, 0.15)',
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--amx-dash-cyan-bright, #57dffe)',
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  color: 'var(--amx-dash-navy-muted, #8b95ad)',
                }}
              >
                Checkpoint Gate-01
              </span>
            </div>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                color: 'rgba(139, 149, 173, 0.7)',
                paddingLeft: '12px',
              }}
            >
              v2.4.12-ent
            </span>
          </div>
        ) : isHost ? (
          <div
            className="amx-sidebar-host-version"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 24px 4px 24px',
              fontSize: '11px',
              color: 'var(--amx-dash-navy-muted, #8b95ad)',
              fontFamily: 'monospace',
            }}
          >
            <span>v2.4.12-ent</span>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--amx-dash-cyan-bright, #57dffe)',
                boxShadow: '0 0 6px rgba(87, 223, 254, 0.8)',
                display: 'inline-block',
              }}
              title="Perimeter Node Synchronized"
            />
          </div>
        ) : isSuperAdmin ? (
          <div
            className="amx-sidebar-superadmin-version"
            style={{
              padding: '12px 24px 8px 24px',
              borderTop: '1px solid rgba(139, 149, 173, 0.15)',
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#818cf8',
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  color: 'var(--amx-dash-navy-muted, #8b95ad)',
                }}
              >
                SuperAdmin Governance
              </span>
            </div>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                color: 'rgba(139, 149, 173, 0.7)',
                paddingLeft: '12px',
              }}
            >
              v2.4.12-gov
            </span>
          </div>
        ) : null}
      </div>
    </nav>
  );
};

