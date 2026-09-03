import React from 'react';
import type { PurchaseOrderItem } from '../data/dashboardData';

interface RecentPOsProps {
  pos: PurchaseOrderItem[];
}

export const RecentPOs: React.FC<RecentPOsProps> = ({ pos = [] }) => {
  return (
    <section className="amx-card-panel" aria-labelledby="recent-pos-title">
      <h3 id="recent-pos-title" className="amx-section-title" style={{ marginBottom: '16px' }}>
        Recent POs
      </h3>
      <div className="amx-pos-list">
        {(pos || []).length === 0 ? (
          <p style={{ color: 'var(--amx-dash-text-muted)', fontSize: '13px', fontStyle: 'italic', margin: '14px 0' }}>
            No recent purchase orders found.
          </p>
        ) : (
          pos.map((po) => (
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
