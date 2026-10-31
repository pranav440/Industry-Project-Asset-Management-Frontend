import React, { useState, useEffect } from 'react';
import { getUser, type UserRole } from '../auth/session';

interface HeaderProps {
  onSearch?: (query: string) => void;
  searchValue?: string;
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  onProfileClick?: () => void;
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
  searchPlaceholder,
  userName,
  userRoleSubtitle,
  role,
}) => {
  const [internalVal, setInternalVal] = useState(searchValue ?? '');
  const currentUser = getUser();
  const resolvedRole = role ?? currentUser?.role ?? 'admin';
  const resolvedName = userName ?? (
    resolvedRole === 'employee'
      ? (currentUser?.full_name || 'Marcus Vance')
      : resolvedRole === 'host'
      ? (currentUser?.full_name || 'Sarah Jenkins')
      : currentUser?.full_name
  );
  const resolvedSubtitle = userRoleSubtitle ?? (
    resolvedRole === 'employee'
      ? 'Product Design (Employee)'
      : resolvedRole === 'host'
      ? 'Host Security Officer'
      : 'Administrator (Admin)'
  );
  const resolvedPlaceholder = searchPlaceholder ?? (
    resolvedRole === 'host'
      ? 'Search gate passes, assets, movement...'
      : resolvedRole === 'employee'
      ? 'Search my requests, assets...'
      : 'Search assets, requests...'
  );

  useEffect(() => {
    if (searchValue !== undefined) {
      setInternalVal(searchValue);
    }
  }, [searchValue]);

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

        <div
          className="amx-user-avatar"
          title={`User Profile (${resolvedRole})`}
          role="button"
          tabIndex={0}
          aria-label="User Profile menu"
          onClick={onProfileClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onProfileClick?.(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#131b2e',
            color: '#acedff',
            fontWeight: 700,
            fontSize: '13px',
            overflow: 'hidden',
          }}
        >
          {resolvedRole === 'host' ? (
            <span style={{ letterSpacing: '0.04em' }}>SJ</span>
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
      </div>
    </header>
  );
};

