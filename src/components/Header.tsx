import React, { useState, useEffect } from 'react';

interface HeaderProps {
  onSearch?: (query: string) => void;
  searchValue?: string;
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  onProfileClick?: () => void;
  searchPlaceholder?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  searchValue,
  onNotificationsClick,
  onHelpClick,
  onProfileClick,
  searchPlaceholder = 'Search assets, requests...',
}) => {
  const [internalVal, setInternalVal] = useState(searchValue ?? '');

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
          placeholder={searchPlaceholder}
          value={internalVal}
          onChange={handleChange}
          aria-label={searchPlaceholder}
        />
      </div>

      {/* Action Controls & Profile */}
      <div className="amx-header-actions">
        <button
          type="button"
          className="amx-header-btn"
          aria-label="1 unread notification: Low stock alerts detected"
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

        <div
          className="amx-user-avatar"
          title="User Profile (Admin)"
          role="button"
          tabIndex={0}
          aria-label="User Profile menu"
          onClick={onProfileClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onProfileClick?.(); }}
        >
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_gJW4-CiPC6EvQEY0S7_1SjwP3YwK8dtCA94bMz6dNHkDEJvQQXGRnVBF6vaL-qVwSdQn1hmhw_OkKiEMTxo-2zPwn8E0U-d1KXH9wsXNkN_xhPX4c-CnzrwSanbjSh4U2QysBM8wosable9WgGubS-OS0fgNgQwgirHge94FKuGZfwVx4-KtZC7Uy8-VhEajhmCA_jOaXSK3hoU1S-PUHIbbeY0MMyx-Sm5Pb25C_eqf01L-IJgMmw"
            alt="User profile avatar"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      </div>
    </header>
  );
};
