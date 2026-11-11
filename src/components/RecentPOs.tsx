import React from 'react';
import type { PurchaseOrderItem } from '../data/dashboardData';

interface RecentPOsProps {
  pos?: PurchaseOrderItem[] | null;
}

export const RecentPOs: React.FC<RecentPOsProps> = ({ pos = [] }) => {
  const isUnconfigured = pos === null || (Array.isArray(pos) && pos.length === 0);

  return (
    <section className="amx-card-panel" aria-labelledby="recent-pos-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 id="recent-pos-title" className="amx-section-title" style={{ margin: 0 }}>
          Recent POs
        </h3>
        {isUnconfigured && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'var(--amx-dash-surface-highest, #1f293d)',
              color: 'var(--amx-dash-text-muted, #94a3b8)',
              border: '1px solid var(--amx-dash-border, rgba(255, 255, 255, 0.1))',
            }}
          >
            Not Configured
          </span>
        )}
      </div>
      <div className="amx-pos-list">
        {isUnconfigured ? (
          <div style={{ color: 'var(--amx-dash-text-muted)', fontSize: '13px', fontStyle: 'italic', margin: '14px 0' }}>
            <p style={{ margin: '0 0 6px 0' }}>Purchase order procurement is not configured in AssetMX.</p>
            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--amx-dash-text-muted)', opacity: 0.8 }}>
              No purchase order records or vendor procurement integrations are tracked in this environment.
            </p>
          </div>
        ) : (
          (pos || []).map((po) => (
            <div key={po.poNumber} className="amx-pos-item">
              <div>
                <p className="amx-po-code" title={po.poNumber}>{po.poNumber}</p>
                <p className="amx-po-vendor" title={po.vendor}>{po.vendor}</p>
              </div>
              <div className="amx-po-received">
                {po.receivedDate}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
