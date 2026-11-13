import React, { useState, useEffect, useRef } from 'react';
import { getUser, clearSession, type UserRole } from '../auth/session';

interface HeaderProps {
  onSearch?: (query: string) => void;
  searchValue?: string;
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  onProfileClick?: () => void;
  onSignOut?: () => void;
  searchPlaceholder?: string;
  userName?: string;
  userRoleSubtitle?: string;
  role?: UserRole;
}

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  searchValue,
  onNotificationsClick,
  onHelpClick,
  onProfileClick,
  onSignOut,
  searchPlaceholder,
  userName,
  userRoleSubtitle,
  role,
}) => {
  const [internalVal, setInternalVal] = useState(searchValue ?? '');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const currentUser = getUser();
  const resolvedRole = role ?? currentUser?.role ?? 'admin';
  const resolvedName = userName ?? (
    resolvedRole === 'employee'
      ? (currentUser?.full_name || 'Marcus Vance')
      : resolvedRole === 'host'
      ? (currentUser?.full_name || 'Sarah Jenkins')
      : resolvedRole === 'guard'
      ? (currentUser?.full_name || 'Marcus Vance')
      : currentUser?.full_name
  );
  const resolvedSubtitle = userRoleSubtitle ?? (
    resolvedRole === 'employee'
      ? 'Product Design (Employee)'
      : resolvedRole === 'host'
      ? 'Host Security Officer'
      : resolvedRole === 'guard'
      ? 'Checkpoint Security Guard (Gate 1)'
      : resolvedRole === 'superadmin'
      ? 'Governance & Platform Administration'
      : 'Administrator (Admin)'
  );
  const resolvedPlaceholder = searchPlaceholder ?? (
    resolvedRole === 'guard'
      ? 'Search gate passes, badges, license plates, assets...'
      : resolvedRole === 'host'
      ? 'Search gate passes, assets, movement...'
      : resolvedRole === 'employee'
      ? 'Search my requests, assets...'
      : resolvedRole === 'superadmin'
      ? 'Search users, roles, audits, system logs...'
      : 'Search assets, requests...'
  );

  useEffect(() => {
    if (searchValue !== undefined) {
      setInternalVal(searchValue);
    }
  }, [searchValue]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen]);

  const toggleProfile = () => {
    setIsProfileOpen((prev) => !prev);
    if (onProfileClick) {
      onProfileClick();
    }
  };

  const handleSignOut = () => {
    setIsProfileOpen(false);
    if (onSignOut) {
      onSignOut();
    } else {
      clearSession();
      window.location.href = '/login';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalVal(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  return (
    <header className="amx-app-header" role="banner">
      {/* Search Input */}
      <div className="amx-header-search-wrap">
        <span className="material-symbols-outlined amx-search-icon" aria-hidden="true">
          search
        </span>
        <input
          type="search"
          className="amx-search-input"
          placeholder={resolvedPlaceholder}
          value={internalVal}
          onChange={handleChange}
          aria-label={resolvedPlaceholder}
        />
      </div>

      {/* Action Controls & Profile */}
      <div className="amx-header-actions">
        <button
          type="button"
          className="amx-header-btn"
          aria-label="1 unread notification"
          title="Notifications"
          onClick={onNotificationsClick}
        >
          <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
          <span className="amx-badge-dot" aria-hidden="true" />
        </button>

        <button
          type="button"
          className="amx-header-btn"
          aria-label="Help and enterprise documentation"
          title="Help & Documentation"
          onClick={onHelpClick}
        >
          <span className="material-symbols-outlined" aria-hidden="true">help_outline</span>
        </button>

        {resolvedName && (
          <div
            className="amx-header-user-meta"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              marginRight: '2px',
            }}
          >
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--amx-dash-text)',
                lineHeight: 1.2,
              }}
            >
              {resolvedName}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--amx-dash-text-muted)',
              }}
            >
              {resolvedSubtitle}
            </span>
          </div>
        )}

        <div ref={profileRef} style={{ position: 'relative' }}>
          <div
            className="amx-user-avatar"
            title={`User Profile (${resolvedRole})`}
            role="button"
            tabIndex={0}
            aria-label="User Profile menu"
            aria-expanded={isProfileOpen}
            onClick={toggleProfile}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleProfile(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#131b2e',
              color: '#acedff',
              fontWeight: 700,
              fontSize: '13px',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
          >
            {resolvedRole === 'host' ? (
              <span style={{ letterSpacing: '0.04em' }}>SJ</span>
            ) : resolvedRole === 'guard' ? (
              <span style={{ letterSpacing: '0.04em' }}>MV</span>
            ) : (
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_gJW4-CiPC6EvQEY0S7_1SjwP3YwK8dtCA94bMz6dNHkDEJvQQXGRnVBF6vaL-qVwSdQn1hmhw_OkKiEMTxo-2zPwn8E0U-d1KXH9wsXNkN_xhPX4c-CnzrwSanbjSh4U2QysBM8wosable9WgGubS-OS0fgNgQwgirHge94FKuGZfwVx4-KtZC7Uy8-VhEajhmCA_jOaXSK3hoU1S-PUHIbbeY0MMyx-Sm5Pb25C_eqf01L-IJgMmw"
                alt="User profile avatar"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Profile Dropdown Popover */}
          {isProfileOpen && (
            <div
              className="amx-profile-dropdown"
              role="dialog"
              aria-label="User Account Menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '280px',
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                zIndex: 1000,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                animation: 'amx-fade-in 0.15s ease-out',
              }}
            >
              {/* User Identity Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#131b2e',
                    color: '#acedff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '15px',
                    flexShrink: 0,
                  }}
                >
                  {(resolvedName || 'U').charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {resolvedName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {currentUser?.email || `${resolvedRole}@assetmx.local`}
                  </div>
                </div>
              </div>

              {/* Department & Role Pills */}
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>System Role:</span>
                  <span
                    style={{
                      textTransform: 'uppercase',
                      fontWeight: 800,
                      fontSize: '10px',
                      letterSpacing: '0.05em',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: resolvedRole === 'superadmin' ? '#e0e7ff' : '#dae2fd',
                      color: resolvedRole === 'superadmin' ? '#4338ca' : '#131b2e',
                    }}
                  >
                    {resolvedRole}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Employee ID:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#334155' }}>
                    {currentUser?.employee_id || (resolvedRole === 'superadmin' ? 'SAD001' : 'EMP-2026')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Department:</span>
                  <span style={{ color: '#334155', fontWeight: 600 }}>
                    {currentUser?.department || (resolvedRole === 'guard' ? 'Facilities & Security' : 'Operations')}
                  </span>
                </div>
              </div>

              {/* Account Setting Notice */}
              <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.3 }}>
                Profile directory records managed via enterprise authentication. Profile updates require administrative authorization.
              </div>

              {/* Divider & Actions */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fecaca'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    logout
                  </span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

