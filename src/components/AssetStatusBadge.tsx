import React from 'react';
import type { AssetStatus } from '../data/assetsData';

interface AssetStatusBadgeProps {
  status: AssetStatus;
}

export const AssetStatusBadge: React.FC<AssetStatusBadgeProps> = ({ status }) => {
  const getBadgeStyles = (st: AssetStatus) => {
    switch (st) {
      case 'Active':
        return {
          backgroundColor: '#D1FAE5',
          color: '#059669',
          border: '1px solid rgba(5, 150, 105, 0.2)',
        };
      case 'In Maintenance':
        return {
          backgroundColor: '#FEF3C7',
          color: '#D97706',
          border: '1px solid rgba(217, 119, 6, 0.2)',
        };
      case 'Disposed':
        return {
          backgroundColor: '#F1F5F9',
          color: '#475569',
          border: '1px solid rgba(71, 85, 105, 0.2)',
        };
      case 'In Transit':
        return {
          backgroundColor: '#CFFAFE',
          color: '#0891B2',
          border: '1px solid rgba(8, 145, 178, 0.2)',
        };
      default:
        return {
          backgroundColor: '#F1F5F9',
          color: '#475569',
          border: '1px solid #E2E8F0',
        };
    }
  };

  const style = getBadgeStyles(status);

  return (
    <span
      className="amx-asset-status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px 12px',
        borderRadius: '9999px',
        fontSize: '11.5px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {status}
    </span>
  );
};
