import React, { useState } from 'react';
import type { RequestItem } from '../data/dashboardData';

interface RequestsTableProps {
  requests: RequestItem[];
}

type FilterTab = 'all' | 'open' | 'closed';

export const RequestsTable: React.FC<RequestsTableProps> = ({ requests = [] }) => {
  const [filter, setFilter] = useState<FilterTab>('open');

  const filteredRequests = (requests || []).filter((req) => {
    if (filter === 'all') return true;
    return req.filterType === filter;
  });

  return (
    <section className="amx-card-panel amx-table-panel" aria-labelledby="my-requests-title">
      {/* Table Header with Filter Tabs */}
      <div className="amx-table-header">
        <h3 id="my-requests-title" className="amx-section-title">My Requests</h3>
        <div className="amx-filter-tabs" role="tablist" aria-label="Request status filters">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`amx-filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'open'}
            className={`amx-filter-tab ${filter === 'open' ? 'active' : ''}`}
            onClick={() => setFilter('open')}
          >
            Open
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'closed'}
            className={`amx-filter-tab ${filter === 'closed' ? 'active' : ''}`}
            onClick={() => setFilter('closed')}
          >
            Closed
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="amx-table-wrapper">
        <table className="amx-data-table">
          <thead>
            <tr>
              <th scope="col">Request ID</th>
              <th scope="col">Item Name</th>
              <th scope="col">Status</th>
              <th scope="col">Approval Date</th>
              <th scope="col">Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    color: 'var(--amx-dash-text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  No requests found for the selected filter.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => {
                const statusClass = (req.status || '').toLowerCase();
                return (
                  <tr key={req.id}>
                    <td className="amx-code-text" title={req.id}>{req.id}</td>
                    <td title={req.itemName}>{req.itemName}</td>
                    <td>
                      <span className={`amx-status-badge ${statusClass}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="amx-date-text">{req.approvalDate || '--'}</td>
                    <td className="amx-date-text">{req.fulfilmentDate || '--'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
