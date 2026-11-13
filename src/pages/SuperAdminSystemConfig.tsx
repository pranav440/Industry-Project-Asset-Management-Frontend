import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getSystemConfig,
  updateSystemConfig,
  type SystemConfigItem,
} from '../api/superadminApi';
import './SuperAdminSystemConfig.css';

interface SuperAdminSystemConfigProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

interface ConfigMetadata {
  key: string;
  title: string;
  category: string;
  domain: string;
  icon: string;
  systemDefault: number;
  min: number;
  max?: number;
  unit: string;
  rangeNotice: string;
  description: string;
}

const CANONICAL_CONFIG_META: Record<string, ConfigMetadata> = {
  'app.security.password_min_length': {
    key: 'app.security.password_min_length',
    title: 'Minimum Password Length',
    category: 'Security Governance',
    domain: 'Core Access',
    icon: 'shield',
    systemDefault: 8,
    min: 8,
    max: 32,
    unit: 'chars',
    rangeNotice: 'Valid range: 8 – 32 characters',
    description:
      'Enforces the minimum character length required for user account credentials across all web and mobile authentication sessions.',
  },
  'app.gatepass.default_return_days': {
    key: 'app.gatepass.default_return_days',
    title: 'Default Return Days',
    category: 'Perimeter Security',
    domain: 'Movement Protocol',
    icon: 'badge',
    systemDefault: 7,
    min: 1,
    unit: 'days',
    rangeNotice: 'Valid range: Positive integer (min 1 day)',
    description: 'Standard return duration for returnable gate passes before escalation.',
  },
  'app.consumables.low_stock_warning_percent': {
    key: 'app.consumables.low_stock_warning_percent',
    title: 'Low Stock Warning Percentage',
    category: 'Supply Chain & Logistics',
    domain: 'Inventory Monitoring',
    icon: 'inventory_2',
    systemDefault: 20,
    min: 1,
    max: 100,
    unit: '%',
    rangeNotice: 'Valid range: 1 – 100 percent',
    description: 'Threshold percentage trigger for low stock warning badges.',
  },
  'app.requests.approval_sla_hours': {
    key: 'app.requests.approval_sla_hours',
    title: 'Approval SLA Hours',
    category: 'Workflow Automation',
    domain: 'Operational Turnaround',
    icon: 'assignment_turned_in',
    systemDefault: 48,
    min: 1,
    unit: 'hrs',
    rangeNotice: 'Valid range: Positive integer (min 1 hour)',
    description: 'Standard SLA window for manager request approval.',
  },
  'app.maintenance.reminder_advance_days': {
    key: 'app.maintenance.reminder_advance_days',
    title: 'Reminder Advance Days',
    category: 'Asset Lifecycle & Operations',
    domain: 'Preventive Scheduling',
    icon: 'build',
    systemDefault: 14,
    min: 0,
    unit: 'days',
    rangeNotice: 'Valid range: Non-negative integer (min 0 days)',
    description: 'Advance notice days before scheduled preventive maintenance.',
  },
};

const ORDERED_KEYS = [
  'app.security.password_min_length',
  'app.gatepass.default_return_days',
  'app.consumables.low_stock_warning_percent',
  'app.requests.approval_sla_hours',
  'app.maintenance.reminder_advance_days',
];

export const SuperAdminSystemConfigPage: React.FC<SuperAdminSystemConfigProps> = ({
  onNavigate,
  onSignOut,
}) => {
  // Original authoritative values from backend
  const [originalValues, setOriginalValues] = useState<Record<string, number>>({});
  // Current local edits
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  // Descriptions from backend
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Load configuration from backend
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSystemConfig();
      const orig: Record<string, number> = {};
      const desc: Record<string, string> = {};

      if (res && Array.isArray(res.configs)) {
        res.configs.forEach((item: SystemConfigItem) => {
          orig[item.key] = Number(item.value);
          if (item.description) {
            desc[item.key] = item.description;
          }
        });
      }

      // Ensure all 5 canonical keys exist with fallback defaults if missing
      ORDERED_KEYS.forEach((k) => {
        if (orig[k] === undefined) {
          orig[k] = CANONICAL_CONFIG_META[k].systemDefault;
        }
      });

      setOriginalValues(orig);
      setEditedValues(orig);
      setDescriptions(desc);
    } catch (err: any) {
      setError(err?.message || 'Failed to load system configuration parameters.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Validation helper
  const validateValue = (key: string, val: number): string | null => {
    const meta = CANONICAL_CONFIG_META[key];
    if (!meta) return null;
    if (isNaN(val) || !Number.isInteger(val)) {
      return 'Must be a valid integer';
    }
    if (val < meta.min) {
      return `Must be at least ${meta.min} ${meta.unit}`;
    }
    if (meta.max !== undefined && val > meta.max) {
      return `Cannot exceed ${meta.max} ${meta.unit}`;
    }
    return null;
  };

  // Stepper adjustment
  const handleAdjust = (key: string, delta: number) => {
    const meta = CANONICAL_CONFIG_META[key];
    if (!meta) return;

    setEditedValues((prev) => {
      const current = prev[key] !== undefined ? prev[key] : meta.systemDefault;
      let next = current + delta;
      if (next < meta.min) next = meta.min;
      if (meta.max !== undefined && next > meta.max) next = meta.max;
      return { ...prev, [key]: next };
    });
    setSuccessMessage(null);
  };

  // Direct numeric input change
  const handleInputChange = (key: string, valStr: string) => {
    const parsed = parseInt(valStr, 10);
    setEditedValues((prev) => ({
      ...prev,
      [key]: isNaN(parsed) ? (0 as any) : parsed,
    }));
    setSuccessMessage(null);
  };

  // Identify modified parameters
  const modifiedKeys = useMemo(() => {
    return ORDERED_KEYS.filter((key) => {
      return editedValues[key] !== undefined && editedValues[key] !== originalValues[key];
    });
  }, [editedValues, originalValues]);

  // Check if any edited value violates bounds
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    ORDERED_KEYS.forEach((key) => {
      const val = editedValues[key];
      const err = validateValue(key, val);
      if (err) {
        errors[key] = err;
      }
    });
    return errors;
  }, [editedValues]);

  const hasErrors = Object.keys(validationErrors).length > 0;
  const isSaveEnabled = modifiedKeys.length > 0 && !hasErrors && !isSaving;

  // Reset unsaved local edits
  const handleResetToOriginal = () => {
    setEditedValues(originalValues);
    setSuccessMessage(null);
    setError(null);
  };

  // Open confirmation modal
  const handleOpenConfirm = () => {
    if (!isSaveEnabled) return;
    setShowConfirmModal(true);
  };

  // Execute batch save to backend
  const handleConfirmSave = async () => {
    if (isSaving || !isSaveEnabled) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payloadConfigs = modifiedKeys.map((key) => ({
        key,
        value: editedValues[key],
      }));

      const res = await updateSystemConfig({ configs: payloadConfigs });

      const updatedOrig: Record<string, number> = { ...originalValues };
      if (res && Array.isArray(res.configs)) {
        res.configs.forEach((item) => {
          updatedOrig[item.key] = Number(item.value);
        });
      } else {
        modifiedKeys.forEach((key) => {
          updatedOrig[key] = editedValues[key];
        });
      }

      setOriginalValues(updatedOrig);
      setEditedValues(updatedOrig);
      setShowConfirmModal(false);
      setSuccessMessage(
        `${modifiedKeys.length} platform parameter(s) successfully updated and active.`,
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to save configuration parameters.');
      setShowConfirmModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout
      currentNav="System Configuration"
      role="superadmin"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="amx-cfg-container">
        {/* Breadcrumb & Title Bar */}
        <section className="amx-cfg-header-section" aria-label="Page Header">
          <div className="amx-cfg-breadcrumb-row">
            <nav className="amx-cfg-breadcrumb" aria-label="Breadcrumb">
              <span>Administration</span>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#94a3b8' }}>
                chevron_right
              </span>
              <span className="amx-cfg-breadcrumb-current">System Configuration</span>
            </nav>
            <span className="amx-cfg-breadcrumb-badge">
              Platform Administration
            </span>
          </div>

          <div className="amx-cfg-title-bar">
            <div className="amx-cfg-title-text">
              <h1>System Configuration</h1>
              <p>
                Manage global platform parameters, operational thresholds, and governance settings across AssetMX.
              </p>
            </div>
          </div>
        </section>

        {/* Global Parameter Ledger Strip */}
        <section className="amx-cfg-ledger-strip" aria-label="Global Parameter Ledger">
          <div className="amx-cfg-ledger-left">
            <div className="amx-cfg-ledger-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                tune
              </span>
            </div>
            <div>
              <h2 className="amx-cfg-ledger-title">Global Parameter Ledger</h2>
              <p className="amx-cfg-ledger-desc">
                Configuration parameters are updated together when you save changes.
              </p>
            </div>
          </div>

          <div className="amx-cfg-ledger-chips">
            <div className="amx-cfg-ledger-chip">
              <span className="amx-cfg-ledger-chip-label">Parameters</span>
              <span className="amx-cfg-ledger-chip-val">5 Active</span>
            </div>
            <div className="amx-cfg-ledger-chip">
              <span className="amx-cfg-ledger-chip-label">Categories</span>
              <span className="amx-cfg-ledger-chip-val">5 Domains</span>
            </div>
          </div>
        </section>

        {/* Status Banners */}
        {successMessage && (
          <div className="amx-cfg-banner-success" role="status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                check_circle
              </span>
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                close
              </span>
            </button>
          </div>
        )}

        {error && (
          <div className="amx-cfg-banner-error" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                error
              </span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                close
              </span>
            </button>
          </div>
        )}

        {/* 5 Canonical Parameter Cards */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--amx-cfg-text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>
              hourglass_empty
            </span>
            <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16 }}>Loading parameters...</div>
          </div>
        ) : (
          <div className="amx-cfg-cards-grid">
            {ORDERED_KEYS.map((key) => {
              const meta = CANONICAL_CONFIG_META[key];
              const currentVal = editedValues[key] !== undefined ? editedValues[key] : meta.systemDefault;
              const isModified = currentVal !== originalValues[key];
              const fieldError = validationErrors[key];

              return (
                <div
                  key={key}
                  className={`amx-cfg-card ${isModified ? 'amx-cfg-card-modified' : ''}`}
                >
                  <div>
                    <div className="amx-cfg-card-top">
                      <div className="amx-cfg-card-meta">
                        <div className="amx-cfg-card-icon">
                          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                            {meta.icon}
                          </span>
                        </div>
                        <div>
                          <div className="amx-cfg-card-category">{meta.category}</div>
                          <div className="amx-cfg-card-domain">{meta.domain}</div>
                        </div>
                      </div>
                      <span className="amx-cfg-key-badge">{meta.key}</span>
                    </div>

                    <div className="amx-cfg-card-body" style={{ marginTop: 14 }}>
                      <h3>{meta.title}</h3>
                      <p>{descriptions[key] || meta.description}</p>
                    </div>
                  </div>

                  <div className="amx-cfg-card-bottom">
                    <div className="amx-cfg-card-ref">
                      <div className="amx-cfg-default-notice">
                        <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#94a3b8' }}>
                          info
                        </span>
                        <span>
                          System default:{' '}
                          <strong style={{ fontFamily: 'var(--amx-cfg-font-mono)' }}>
                            {meta.systemDefault} {meta.unit}
                          </strong>
                        </span>
                      </div>
                      <span className="amx-cfg-range-notice">{meta.rangeNotice}</span>
                    </div>

                    {/* Numeric Stepper */}
                    <div>
                      <div className="amx-cfg-stepper">
                        <button
                          type="button"
                          className="amx-cfg-stepper-btn"
                          onClick={() => handleAdjust(key, -1)}
                          disabled={currentVal <= meta.min || isSaving}
                          aria-label={`Decrease ${meta.title}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            remove
                          </span>
                        </button>

                        <div className="amx-cfg-stepper-val-wrap">
                          <input
                            type="text"
                            className="amx-cfg-stepper-input"
                            value={currentVal}
                            onChange={(e) => handleInputChange(key, e.target.value)}
                            disabled={isSaving}
                            aria-label={meta.title}
                          />
                          <span className="amx-cfg-stepper-unit">{meta.unit}</span>
                        </div>

                        <button
                          type="button"
                          className="amx-cfg-stepper-btn"
                          onClick={() => handleAdjust(key, 1)}
                          disabled={(meta.max !== undefined && currentVal >= meta.max) || isSaving}
                          aria-label={`Increase ${meta.title}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            add
                          </span>
                        </button>
                      </div>
                      {fieldError && <div className="amx-cfg-error-hint">{fieldError}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Docked Change Management Bar */}
        {!loading && (
          <aside className="amx-cfg-docked-bar" aria-label="Unsaved Changes Toolbar">
            <div className="amx-cfg-docked-top">
              <div className="amx-cfg-docked-left">
                <div className="amx-cfg-docked-status">
                  <span
                    className="amx-cfg-docked-dot"
                    style={{
                      backgroundColor: modifiedKeys.length > 0 ? 'var(--amx-cfg-secondary)' : '#10b981',
                    }}
                  />
                  <span className="amx-cfg-docked-status-text">
                    {modifiedKeys.length > 0
                      ? `${modifiedKeys.length} Pending Local Modification${modifiedKeys.length > 1 ? 's' : ''}`
                      : 'All Parameters Synchronized'}
                  </span>
                  {modifiedKeys.length > 0 && (
                    <span className="amx-cfg-docked-badge">Uncommitted</span>
                  )}
                </div>

                {modifiedKeys.length > 0 && (
                  <div className="amx-cfg-diff-chips">
                    {modifiedKeys.map((key) => {
                      const meta = CANONICAL_CONFIG_META[key];
                      return (
                        <div key={key} className="amx-cfg-diff-chip">
                          <span className="amx-cfg-diff-key">{meta.title}:</span>
                          <span className="amx-cfg-diff-old">
                            {originalValues[key]} {meta.unit}
                          </span>
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                            arrow_forward
                          </span>
                          <span className="amx-cfg-diff-new">
                            {editedValues[key]} {meta.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="amx-cfg-docked-actions">
                <button
                  type="button"
                  className="amx-cfg-btn-reset"
                  onClick={handleResetToOriginal}
                  disabled={modifiedKeys.length === 0 || isSaving}
                  title="Discard local edits and restore previous values"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    undo
                  </span>
                  <span>Reset to Original Values</span>
                </button>

                <button
                  type="button"
                  className="amx-cfg-btn-save"
                  onClick={handleOpenConfirm}
                  disabled={!isSaveEnabled}
                  title={
                    hasErrors
                      ? 'Please resolve invalid parameter values'
                      : modifiedKeys.length === 0
                      ? 'No modifications to save'
                      : 'Save changes to platform ledger'
                  }
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    save
                  </span>
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  {modifiedKeys.length > 0 && (
                    <span className="amx-cfg-save-count">{modifiedKeys.length}</span>
                  )}
                </button>
              </div>
            </div>

            <div className="amx-cfg-docked-footer">
              <span>All modified parameters are submitted together.</span>
            </div>
          </aside>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="amx-cfg-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="amx-cfg-modal">
              <div className="amx-cfg-modal-header">
                <h2 id="modal-title">Confirm Parameter Update</h2>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSaving}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    close
                  </span>
                </button>
              </div>

              <div className="amx-cfg-modal-body">
                <div className="amx-cfg-modal-warning">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, flexShrink: 0 }}>
                    warning
                  </span>
                  <div>
                    You are about to update <strong>{modifiedKeys.length}</strong> platform configuration parameter(s). These changes will update active system configuration settings.
                  </div>
                </div>

                <table className="amx-cfg-diff-table">
                  <thead>
                    <tr>
                      <th>Parameter Key</th>
                      <th>Current Value</th>
                      <th>New Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modifiedKeys.map((key) => {
                      const meta = CANONICAL_CONFIG_META[key];
                      return (
                        <tr key={key}>
                          <td>{meta.key}</td>
                          <td style={{ color: '#64748b' }}>
                            {originalValues[key]} {meta.unit}
                          </td>
                          <td style={{ color: 'var(--amx-cfg-secondary)', fontWeight: 700 }}>
                            {editedValues[key]} {meta.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="amx-cfg-modal-footer">
                <button
                  type="button"
                  className="amx-cfg-btn-reset"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="amx-cfg-btn-save"
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    check
                  </span>
                  <span>{isSaving ? 'Applying Changes...' : 'Confirm & Apply Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

