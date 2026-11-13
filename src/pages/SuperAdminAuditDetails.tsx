import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getCachedAuditEvent,
  fetchAuditEventById,
  parseAuditId,
  formatEventId,
  formatUtcTimestamp,
  type AuditLogListItem,
} from '../api/superadminApi';
import './SuperAdminAuditDetails.css';

interface SuperAdminAuditDetailsProps {
  eventId: string;
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

// Action badge category styling helper
function getActionBadgeClass(action: string): string {
  const act = action.toLowerCase();
  if (act.includes('status')) return 'amx-audit-badge amx-audit-badge-amber';
  if (act.includes('transferred') || act.includes('movement')) return 'amx-audit-badge amx-audit-badge-cyan';
  if (act.includes('escalated') || act.includes('incident') || act.includes('failed') || act.includes('denied'))
    return 'amx-audit-badge amx-audit-badge-red';
  if (act.includes('approved') || act.includes('active') || act.includes('cleared'))
    return 'amx-audit-badge amx-audit-badge-emerald';
  if (act.includes('created')) return 'amx-audit-badge amx-audit-badge-blue';
  if (act.includes('maintenance')) return 'amx-audit-badge amx-audit-badge-purple';
  if (act.includes('updated') || act.includes('password')) return 'amx-audit-badge amx-audit-badge-indigo';
  return 'amx-audit-badge amx-audit-badge-gray';
}

// Syntax-highlighted JSON Viewer component
const JsonViewer: React.FC<{ data: Record<string, any> | null | undefined; emptyMessage: string }> = ({
  data,
  emptyMessage,
}) => {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="amx-ad-empty-state-panel">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          info
        </span>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  // Tokenize and format JSON with syntax spans
  const jsonString = JSON.stringify(data, null, 2);

  // Simple token regex highlighting for JSON
  const highlightedHtml = jsonString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'amx-json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'amx-json-key';
          } else {
            cls = 'amx-json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'amx-json-boolean';
        } else if (/null/.test(match)) {
          cls = 'amx-json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );

  return (
    <pre className="amx-ad-code-block">
      <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
    </pre>
  );
};

export const SuperAdminAuditDetailsPage: React.FC<SuperAdminAuditDetailsProps> = ({
  eventId,
  onNavigate,
  onSignOut,
}) => {
  const [event, setEvent] = useState<AuditLogListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numericId = parseAuditId(eventId);

  // Load or recover event data (cache-first, fallback to backend search)
  const loadEvent = useCallback(async () => {
    if (numericId === null) {
      setError(`Invalid audit event identifier: "${eventId}"`);
      setLoading(false);
      return;
    }

    // 1. Check local in-memory cache first (instant data handoff)
    const cached = getCachedAuditEvent(numericId);
    if (cached) {
      setEvent(cached);
      setLoading(false);
      return;
    }

    // 2. Direct refresh fallback: fetch from backend list API
    setLoading(true);
    setError(null);
    try {
      const recovered = await fetchAuditEventById(numericId);
      if (recovered) {
        setEvent(recovered);
      } else {
        setError(`Audit event "${eventId}" (ID: ${numericId}) was not found in the governance ledger.`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve audit event details.');
    } finally {
      setLoading(false);
    }
  }, [numericId, eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleBackToLogs = () => {
    if (onNavigate) {
      onNavigate('superadmin/audit-logs');
    } else {
      window.history.pushState({}, '', '/superadmin/audit-logs');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const formattedEvtId = event
    ? formatEventId(event.id, event.occurred_at)
    : formatEventId(eventId);
  const formattedTime = event ? formatUtcTimestamp(event.occurred_at) : '—';

  return (
    <DashboardLayout
      currentNav="Audit & Logs"
      role="superadmin"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="amx-ad-page-container">
        {/* Navigation & Breadcrumb Header */}
        <section className="amx-ad-header-section" aria-label="Page Navigation">
          <div className="amx-ad-breadcrumb-row">
            <nav className="amx-ad-breadcrumb" aria-label="Breadcrumb">
              <span>Administration</span>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#94a3b8' }}>
                chevron_right
              </span>
              <span
                className="amx-ad-breadcrumb-link"
                onClick={handleBackToLogs}
                role="button"
                tabIndex={0}
              >
                Audit &amp; Logs
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#94a3b8' }}>
                chevron_right
              </span>
              <span className="amx-ad-breadcrumb-current">Event Details</span>
            </nav>

            <button
              type="button"
              className="amx-ad-btn-back"
              onClick={handleBackToLogs}
              title="Return to Audit & Logs list"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_back
              </span>
              <span>Back to Audit Logs</span>
            </button>
          </div>
        </section>

        {loading ? (
          <div className="amx-ad-error-card">
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#00687a' }}>
              hourglass_empty
            </span>
            <div className="amx-ad-error-title">Retrieving Audit Event Details</div>
            <div className="amx-ad-error-desc">
              Locating immutable event record <strong>{eventId}</strong> from governance ledger...
            </div>
          </div>
        ) : error || !event ? (
          <div className="amx-ad-error-card">
            <span className="material-symbols-outlined amx-ad-error-icon">search_off</span>
            <div className="amx-ad-error-title">Audit Event Not Found</div>
            <div className="amx-ad-error-desc">
              {error || `Unable to locate event ${eventId} in the governance audit ledger.`}
            </div>
            <button
              type="button"
              className="amx-ad-btn-back"
              onClick={handleBackToLogs}
              style={{ marginTop: 12 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_back
              </span>
              <span>Back to Audit Logs</span>
            </button>
          </div>
        ) : (
          <>
            {/* Event Title Card */}
            <section className="amx-ad-title-card" aria-label="Event Summary">
              <div className="amx-ad-title-card-top">
                <div className="amx-ad-title-text">
                  <h1>Audit Event Details</h1>
                  <div className="amx-ad-title-badges">
                    <span className="amx-ad-evt-id-badge">{formattedEvtId}</span>
                    <span style={{ color: '#cbd5e1' }}>&bull;</span>
                    <span className={getActionBadgeClass(event.action)}>{event.action}</span>
                    <span style={{ color: '#cbd5e1' }}>&bull;</span>
                    <span className="amx-ad-timestamp-text">{formattedTime}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Core Metadata Grid */}
            <section className="amx-ad-meta-card" aria-label="Core Metadata">
              <div className="amx-ad-section-heading">
                <span>Core Metadata</span>
              </div>
              <div className="amx-ad-meta-grid">
                <div className="amx-ad-meta-item">
                  <span className="amx-ad-meta-label">Actor User ID</span>
                  <span className="amx-ad-meta-value">USR-{event.actor_user_id}</span>
                </div>
                <div className="amx-ad-meta-item">
                  <span className="amx-ad-meta-label">Asset Identifier</span>
                  {event.asset_identifier ? (
                    <span className="amx-ad-meta-value">{event.asset_identifier}</span>
                  ) : (
                    <span className="amx-ad-meta-value-empty">&mdash;</span>
                  )}
                </div>
                <div className="amx-ad-meta-item">
                  <span className="amx-ad-meta-label">Consumable Identifier</span>
                  {event.consumable_identifier ? (
                    <span className="amx-ad-meta-value">{event.consumable_identifier}</span>
                  ) : (
                    <span className="amx-ad-meta-value-empty">&mdash;</span>
                  )}
                </div>
                <div className="amx-ad-meta-item">
                  <span className="amx-ad-meta-label">Request Identifier</span>
                  {event.request_identifier ? (
                    <span className="amx-ad-meta-value">{event.request_identifier}</span>
                  ) : (
                    <span className="amx-ad-meta-value-empty">&mdash;</span>
                  )}
                </div>
                <div className="amx-ad-meta-item">
                  <span className="amx-ad-meta-label">Gate Pass Identifier</span>
                  {event.gate_pass_identifier ? (
                    <span className="amx-ad-meta-value">{event.gate_pass_identifier}</span>
                  ) : (
                    <span className="amx-ad-meta-value-empty">&mdash;</span>
                  )}
                </div>
                <div className="amx-ad-meta-item">
                  <span className="amx-ad-meta-label">Movement ID</span>
                  {event.movement_id ? (
                    <span className="amx-ad-meta-value">{event.movement_id}</span>
                  ) : (
                    <span className="amx-ad-meta-value-empty">&mdash;</span>
                  )}
                </div>
              </div>
            </section>

            {/* Section A: Before State */}
            <section className="amx-ad-state-card" aria-label="Before State">
              <div className="amx-ad-section-heading">
                <span>Section A: Before State</span>
                <span className="amx-ad-json-tag">JSON</span>
              </div>
              <JsonViewer
                data={event.before_state}
                emptyMessage="No prior state recorded for this event (initial creation or stateless action)."
              />
            </section>

            {/* Section B: After State */}
            <section className="amx-ad-state-card" aria-label="After State">
              <div className="amx-ad-section-heading">
                <span>Section B: After State</span>
                <span className="amx-ad-json-tag">JSON</span>
              </div>
              <JsonViewer
                data={event.after_state}
                emptyMessage="No subsequent state recorded for this event."
              />
            </section>

            {/* Section C: Event Metadata */}
            <section className="amx-ad-state-card" aria-label="Event Metadata">
              <div className="amx-ad-section-heading">
                <span>Section C: Event Metadata</span>
                <span className="amx-ad-json-tag">JSON</span>
              </div>
              <JsonViewer
                data={event.metadata}
                emptyMessage="No additional metadata payload attached to this record."
              />
            </section>

            {/* Immutability Policy Banner */}
            <footer className="amx-ad-footer-banner" aria-label="Audit Integrity Information">
              <div className="amx-ad-footer-left">
                <div className="amx-ad-footer-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    lock
                  </span>
                </div>
                <div className="amx-ad-footer-text">
                  <strong>Audit Ledger Immutability Policy:</strong> All audit records are permanently recorded in the immutable platform ledger and cannot be altered, rolled back, or deleted.
                </div>
              </div>
              <div className="amx-ad-footer-badge">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#059669',
                    display: 'inline-block',
                  }}
                />
                <span>Governance Ledger Verified</span>
              </div>
            </footer>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

