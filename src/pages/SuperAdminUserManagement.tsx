import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getUser } from '../auth/session';
import {
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  getSuperAdminAnalytics,
  type SuperAdminUserRecord,
  type CanonicalRole,
  type SuperAdminAnalyticsResponse,
} from '../api/superadminApi';
import './SuperAdminUserManagement.css';

interface SuperAdminUserManagementProps {
  onNavigate?: (subRoute: string) => void;
  onSignOut?: () => void;
}

const CANONICAL_ROLES: CanonicalRole[] = ['employee', 'host', 'admin', 'guard', 'superadmin'];

const DEPARTMENTS = [
  'Product Engineering',
  'Operations & Asset Control',
  'Physical Security',
  'Facilities & Logistics',
  'IT & Security Governance',
  'Executive',
];

export const SuperAdminUserManagementPage: React.FC<SuperAdminUserManagementProps> = ({
  onNavigate,
  onSignOut,
}) => {
  const currentUser = getUser();

  // Data states
  const [users, setUsers] = useState<SuperAdminUserRecord[]>([]);
  const [analytics, setAnalytics] = useState<SuperAdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Kebab menu state
  const [openKebabId, setOpenKebabId] = useState<number | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SuperAdminUserRecord | null>(null);
  const [resettingUser, setResettingUser] = useState<SuperAdminUserRecord | null>(null);
  const [confirmStatusUser, setConfirmStatusUser] = useState<SuperAdminUserRecord | null>(null);

  // Form states - Add User
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addEmpId, setAddEmpId] = useState('');
  const [addRole, setAddRole] = useState<CanonicalRole>('employee');
  const [addDept, setAddDept] = useState(DEPARTMENTS[0]);
  const [addPassword, setAddPassword] = useState('AssetMX-Gov@2026!x');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Form states - Edit User
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<CanonicalRole>('employee');
  const [editDept, setEditDept] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Form states - Reset Password
  const [resetNewPassword, setResetNewPassword] = useState('TempAuth#99824X');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('TempAuth#99824X');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetNotifyEmail, setResetNotifyEmail] = useState(true);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Form states - Status Change
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Fetch users & analytics
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const is_active_param =
        selectedStatus === 'Active' ? true : selectedStatus === 'Inactive' ? false : undefined;

      const [usersResp, analyticsResp] = await Promise.all([
        listUsers({
          role: selectedRole !== 'All' ? selectedRole : undefined,
          department: selectedDept !== 'All' ? selectedDept : undefined,
          search: searchTerm.trim() ? searchTerm.trim() : undefined,
          is_active: is_active_param,
          page,
          page_size: pageSize,
        }),
        getSuperAdminAnalytics().catch(() => null),
      ]);

      setUsers(usersResp.items);
      setTotalUsers(usersResp.total);
      setTotalPages(usersResp.total_pages || 1);
      if (analyticsResp) {
        setAnalytics(analyticsResp);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load user directory';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedRole, selectedDept, selectedStatus, searchTerm, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close kebab on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.amx-sa-actions-cell')) {
        setOpenKebabId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // KPI Calculations
  const kpiData = useMemo(() => {
    const total = analytics?.total_users ?? totalUsers;
    const active = analytics?.active_users ?? users.filter((u) => u.is_active).length;
    const inactive = Math.max(0, total - active);
    const superadmins =
      analytics?.users_by_role?.['superadmin'] ??
      users.filter((u) => u.role === 'superadmin').length;
    const inactivePct = total > 0 ? ((inactive / total) * 100).toFixed(1) : '0';

    return { total, active, inactive, superadmins, inactivePct };
  }, [analytics, totalUsers, users]);

  // Initials generator
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Reset all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedRole('All');
    setSelectedStatus('All');
    setSelectedDept('All');
    setPage(1);
  };

  // Generate random password helper
  const handleAutoGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pwd = 'AssetMX-';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAddPassword(pwd);
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setAddFullName('');
    setAddEmail('');
    setAddEmpId('');
    setAddRole('employee');
    setAddDept(DEPARTMENTS[0]);
    setAddPassword('AssetMX-Gov@2026!x');
    setAddError(null);
    setIsAddModalOpen(true);
  };

  // Submit Add User
  const handleSubmitAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!addFullName.trim()) {
      setAddError('Full name is required');
      return;
    }
    if (!addEmail.trim() || !addEmail.includes('@')) {
      setAddError('A valid corporate email is required');
      return;
    }
    if (!addEmpId.trim()) {
      setAddError('Employee ID is required');
      return;
    }
    if (addPassword.length < 8) {
      setAddError('Temporary password must be at least 8 characters');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      await createUser({
        full_name: addFullName.trim(),
        email: addEmail.trim().toLowerCase(),
        employee_id: addEmpId.trim(),
        role: addRole,
        department: addDept,
        password: addPassword,
      });

      showToast(`User ${addFullName} created successfully!`, 'success');
      setIsAddModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      setAddError(msg);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: SuperAdminUserRecord) => {
    setOpenKebabId(null);
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditDept(user.department || DEPARTMENTS[0]);
    setEditIsActive(user.is_active);
    setEditError(null);
  };

  // Submit Edit User
  const handleSubmitEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (!editFullName.trim()) {
      setEditError('Full name is required');
      return;
    }
    if (!editEmail.trim() || !editEmail.includes('@')) {
      setEditError('A valid corporate email is required');
      return;
    }

    // Self-deactivation prevention check
    if (editingUser.id === currentUser?.id && !editIsActive) {
      setEditError('Cannot deactivate your own active SuperAdmin session');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      await updateUser(editingUser.id, {
        full_name: editFullName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        department: editDept,
        is_active: editIsActive,
      });

      showToast(`User ${editFullName} updated successfully!`, 'success');
      setEditingUser(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user';
      setEditError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenResetModal = (user: SuperAdminUserRecord) => {
    setOpenKebabId(null);
    setResettingUser(user);
    setResetNewPassword('TempAuth#99824X');
    setResetConfirmPassword('TempAuth#99824X');
    setResetNotifyEmail(true);
    setResetError(null);
  };

  // Submit Reset Password
  const handleSubmitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    setResetError(null);

    if (resetNewPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    setIsSubmittingReset(true);
    try {
      await resetUserPassword(resettingUser.id, resetNewPassword);
      showToast(`Password reset successfully for ${resettingUser.full_name}`, 'success');
      setResettingUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      setResetError(msg);
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Open Status Confirmation Modal
  const handleOpenStatusModal = (user: SuperAdminUserRecord) => {
    setOpenKebabId(null);
    if (user.id === currentUser?.id && user.is_active) {
      showToast('Cannot deactivate your own active SuperAdmin session', 'error');
      return;
    }
    setConfirmStatusUser(user);
  };

  // Submit Status Change (Activate / Deactivate)
  const handleSubmitStatusChange = async () => {
    if (!confirmStatusUser) return;
    setIsSubmittingStatus(true);
    try {
      const nextStatus = !confirmStatusUser.is_active;
      await updateUserStatus(confirmStatusUser.id, nextStatus);
      showToast(
        `User ${confirmStatusUser.full_name} has been ${
          nextStatus ? 're-activated' : 'deactivated'
        }`,
        'success',
      );
      setConfirmStatusUser(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user status';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  return (
    <DashboardLayout
      currentNav="User & Role Management"
      role="superadmin"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      onSearch={(q) => {
        setSearchTerm(q);
        setPage(1);
      }}
      searchPlaceholder="Search users, roles, audits, system logs..."
    >
      <div className="amx-sa-users-container">
        {/* Header & Breadcrumb */}
        <div className="amx-sa-header-section">
          <div className="amx-sa-breadcrumb-row">
            <div className="amx-sa-breadcrumb">
              <span>Administration</span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                chevron_right
              </span>
              <span className="amx-sa-breadcrumb-current">Users &amp; Roles</span>
            </div>
            <div className="amx-sa-breadcrumb-badge">
              <span className="material-symbols-outlined">verified_user</span>
              <span>Platform Administration</span>
            </div>
          </div>

          <div className="amx-sa-title-bar">
            <div className="amx-sa-title-col">
              <h1 className="amx-sa-title">User &amp; Role Management</h1>
              <p className="amx-sa-subtitle">
                Manage platform users, access roles, and account status across AssetMX.
              </p>
            </div>

            <div className="amx-sa-header-actions">
              <button
                type="button"
                className="amx-sa-btn-primary"
                id="open-add-user-btn"
                onClick={handleOpenAddModal}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  add
                </span>
                <span>Add New User</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="amx-sa-kpi-grid">
          {/* Card 1: Total Users */}
          <div className="amx-sa-kpi-card">
            <div className="amx-sa-kpi-header">
              <span className="amx-sa-kpi-label">Total Users</span>
              <div className="amx-sa-kpi-icon-box">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  group
                </span>
              </div>
            </div>
            <div className="amx-sa-kpi-main">
              <span className="amx-sa-kpi-value">{kpiData.total.toLocaleString()}</span>
              <span className="amx-sa-kpi-pill">6 Hubs</span>
            </div>
            <div className="amx-sa-kpi-footer">
              <span
                className="material-symbols-outlined"
                style={{ color: 'var(--amx-sa-secondary)' }}
              >
                group
              </span>
              <span>Total registered platform accounts</span>
            </div>
          </div>

          {/* Card 2: Active Users */}
          <div className="amx-sa-kpi-card">
            <div className="amx-sa-kpi-header">
              <span className="amx-sa-kpi-label">Active Users</span>
              <div className="amx-sa-kpi-icon-box active">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  check_circle
                </span>
              </div>
            </div>
            <div className="amx-sa-kpi-main">
              <span className="amx-sa-kpi-value">{kpiData.active.toLocaleString()}</span>
            </div>
            <div className="amx-sa-kpi-footer">
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--amx-sa-secondary)',
                  display: 'inline-block',
                }}
              />
              <span>Currently active accounts</span>
            </div>
          </div>

          {/* Card 3: Inactive Users */}
          <div className="amx-sa-kpi-card">
            <div className="amx-sa-kpi-header">
              <span className="amx-sa-kpi-label">Inactive Users</span>
              <div className="amx-sa-kpi-icon-box">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  block
                </span>
              </div>
            </div>
            <div className="amx-sa-kpi-main">
              <span className="amx-sa-kpi-value">{kpiData.inactive.toLocaleString()}</span>
              <span className="amx-sa-kpi-pill">{kpiData.inactivePct}%</span>
            </div>
            <div className="amx-sa-kpi-footer">
              <span className="material-symbols-outlined">person_off</span>
              <span>Deactivated / offboarded accounts</span>
            </div>
          </div>

          {/* Card 4: SuperAdmin Accounts */}
          <div className="amx-sa-kpi-card">
            <div className="amx-sa-kpi-header">
              <span className="amx-sa-kpi-label">SuperAdmin Accounts</span>
              <div className="amx-sa-kpi-icon-box governance">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  security
                </span>
              </div>
            </div>
            <div className="amx-sa-kpi-main">
              <span className="amx-sa-kpi-value">{kpiData.superadmins}</span>
            </div>
            <div className="amx-sa-kpi-footer">
              <span
                className="material-symbols-outlined"
                style={{ color: 'var(--amx-sa-secondary)' }}
              >
                admin_panel_settings
              </span>
              <span>Platform administrator accounts with governance access</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="amx-sa-filters-card">
          <div className="amx-sa-filters-row">
            {/* Search Input */}
            <div className="amx-sa-search-wrap">
              <span className="material-symbols-outlined amx-sa-search-icon">search</span>
              <input
                type="text"
                className="amx-sa-search-input"
                id="user-search-input"
                placeholder="Search by name, email or employee ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="amx-sa-search-clear"
                  onClick={() => {
                    setSearchTerm('');
                    setPage(1);
                  }}
                  title="Clear search"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    close
                  </span>
                </button>
              )}
            </div>

            {/* Dropdowns */}
            <div className="amx-sa-dropdowns-group">
              {/* Role Filter */}
              <div className="amx-sa-select-wrap">
                <select
                  className="amx-sa-select"
                  id="role-filter"
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="All">All Roles</option>
                  <option value="Employee">Employee</option>
                  <option value="Host">Host</option>
                  <option value="Admin">Admin</option>
                  <option value="Guard">Guard</option>
                  <option value="SuperAdmin">SuperAdmin</option>
                </select>
                <span className="material-symbols-outlined amx-sa-select-icon">
                  arrow_drop_down
                </span>
              </div>

              {/* Status Filter */}
              <div className="amx-sa-select-wrap">
                <select
                  className="amx-sa-select"
                  id="status-filter"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <span className="material-symbols-outlined amx-sa-select-icon">
                  arrow_drop_down
                </span>
              </div>

              {/* Department Filter */}
              <div className="amx-sa-select-wrap">
                <select
                  className="amx-sa-select"
                  id="dept-filter"
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined amx-sa-select-icon">
                  arrow_drop_down
                </span>
              </div>

              {/* Clear Filters Button */}
              <button
                type="button"
                className="amx-sa-btn-clear"
                id="clear-filters-btn"
                onClick={handleClearFilters}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  clear_all
                </span>
                <span>Clear Filters</span>
              </button>
            </div>
          </div>

          {/* Active Filter Badges */}
          <div className="amx-sa-active-filters">
            <span className="amx-sa-active-label">Active Filters:</span>
            <div className="amx-sa-filter-pill">
              <span>
                Role: <strong>{selectedRole}</strong>
              </span>
            </div>
            <div className="amx-sa-filter-pill">
              <span>
                Status: <strong>{selectedStatus}</strong>
              </span>
            </div>
            <div className="amx-sa-filter-pill">
              <span>
                Department:{' '}
                <strong style={{ color: 'var(--amx-sa-text-muted)' }}>{selectedDept}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* User Directory Table Card */}
        <div className="amx-sa-table-card">
          {loading ? (
            <div className="amx-sa-state-box">
              <div className="amx-sa-spinner" />
              <p className="amx-sa-state-desc">Loading platform user directory...</p>
            </div>
          ) : error ? (
            <div className="amx-sa-state-box">
              <span
                className="material-symbols-outlined amx-sa-state-icon"
                style={{ color: 'var(--amx-sa-error)' }}
              >
                error
              </span>
              <h3 className="amx-sa-state-title">Failed to Load Users</h3>
              <p className="amx-sa-state-desc">{error}</p>
              <button
                type="button"
                className="amx-sa-btn-secondary"
                onClick={fetchData}
                style={{ marginTop: '8px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  refresh
                </span>
                <span>Retry</span>
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="amx-sa-state-box">
              <span className="material-symbols-outlined amx-sa-state-icon">person_search</span>
              <h3 className="amx-sa-state-title">No Users Found</h3>
              <p className="amx-sa-state-desc">
                No platform accounts matched your current search and filter criteria.
              </p>
              <button
                type="button"
                className="amx-sa-btn-secondary"
                onClick={handleClearFilters}
                style={{ marginTop: '8px' }}
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <>
              <div className="amx-sa-table-wrap">
                <table className="amx-sa-table" aria-label="Users Directory">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Full Name</th>
                      <th>Email Address</th>
                      <th>Employee ID</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Account Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const isSelf = user.id === currentUser?.id;
                      const formattedUserId = `USR-${String(user.id).padStart(5, '0')}`;
                      const initials = getInitials(user.full_name);
                      const isMenuOpen = openKebabId === user.id;

                      return (
                        <tr
                          key={user.id}
                          className={!user.is_active ? 'inactive-row' : undefined}
                          data-user-id={user.id}
                        >
                          {/* User ID */}
                          <td className="amx-sa-user-id">{formattedUserId}</td>

                          {/* Full Name & Avatar */}
                          <td>
                            <div className="amx-sa-name-cell">
                              <div
                                className={`amx-sa-avatar ${
                                  isSelf
                                    ? 'current-user'
                                    : user.role === 'superadmin'
                                    ? 'superadmin'
                                    : user.role === 'admin'
                                    ? 'admin'
                                    : ''
                                }`}
                              >
                                {initials}
                              </div>
                              <div className="amx-sa-name-info">
                                <span className="amx-sa-name-text">{user.full_name}</span>
                                {isSelf && (
                                  <span className="amx-sa-you-badge">Current User (You)</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Email Address */}
                          <td className="amx-sa-mono-cell">{user.email}</td>

                          {/* Employee ID */}
                          <td className="amx-sa-mono-cell">{user.employee_id}</td>

                          {/* Role */}
                          <td>
                            <span className={`amx-sa-role-badge ${user.role}`}>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                          </td>

                          {/* Department */}
                          <td style={{ color: 'var(--amx-sa-text-muted)' }}>
                            {user.department || '—'}
                          </td>

                          {/* Status */}
                          <td>
                            <span
                              className={`amx-sa-status-badge ${
                                user.is_active ? 'active' : 'inactive'
                              }`}
                            >
                              <span className="amx-sa-status-dot" />
                              <span>{user.is_active ? 'Active' : 'Inactive'}</span>
                            </span>
                          </td>

                          {/* Actions Kebab Menu */}
                          <td className="amx-sa-actions-cell">
                            <button
                              type="button"
                              className="amx-sa-kebab-btn"
                              title="Actions menu"
                              aria-label={`Actions for ${user.full_name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenKebabId(isMenuOpen ? null : user.id);
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '18px' }}
                              >
                                more_vert
                              </span>
                            </button>

                            {isMenuOpen && (
                              <div className="amx-sa-kebab-menu" role="menu">
                                <button
                                  type="button"
                                  className="amx-sa-menu-item"
                                  role="menuitem"
                                  onClick={() => handleOpenEditModal(user)}
                                >
                                  <span className="material-symbols-outlined">edit</span>
                                  <span>Edit User</span>
                                </button>

                                <button
                                  type="button"
                                  className="amx-sa-menu-item"
                                  role="menuitem"
                                  onClick={() => handleOpenResetModal(user)}
                                >
                                  <span className="material-symbols-outlined">lock_reset</span>
                                  <span>Reset Password</span>
                                </button>

                                <div className="amx-sa-menu-divider" />

                                {isSelf ? (
                                  <div
                                    className="amx-sa-menu-item disabled"
                                    title="Cannot deactivate own active SuperAdmin session"
                                  >
                                    <span className="material-symbols-outlined">block</span>
                                    <span>Deactivate (Self-Locked)</span>
                                  </div>
                                ) : user.is_active ? (
                                  <button
                                    type="button"
                                    className="amx-sa-menu-item danger"
                                    role="menuitem"
                                    onClick={() => handleOpenStatusModal(user)}
                                  >
                                    <span className="material-symbols-outlined">person_off</span>
                                    <span>Deactivate Account</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="amx-sa-menu-item success"
                                    role="menuitem"
                                    onClick={() => handleOpenStatusModal(user)}
                                  >
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <span>Re-activate Account</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="amx-sa-pagination">
                <div className="amx-sa-pagination-info">
                  <span>
                    Showing <strong>{users.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> -{' '}
                    <strong>{Math.min(page * pageSize, totalUsers)}</strong> of{' '}
                    <strong>{totalUsers}</strong> registered users
                  </span>
                  <div className="amx-sa-pagination-sep" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Rows:</span>
                    <select
                      className="amx-sa-rows-select"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="amx-sa-page-controls">
                  <button
                    type="button"
                    className="amx-sa-page-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    title="Previous page"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      chevron_left
                    </span>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && p - prev > 1;

                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && (
                            <span style={{ padding: '0 4px', color: 'var(--amx-sa-text-subtle)' }}>
                              ...
                            </span>
                          )}
                          <button
                            type="button"
                            className={`amx-sa-page-btn ${p === page ? 'active' : ''}`}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    type="button"
                    className="amx-sa-page-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    title="Next page"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODAL A: ADD NEW USER ────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="amx-sa-modal-backdrop" role="dialog" aria-modal="true">
          <div className="amx-sa-modal-card">
            <div className="amx-sa-modal-header">
              <div className="amx-sa-modal-title-group">
                <div className="amx-sa-modal-icon-box">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    person_add
                  </span>
                </div>
                <div>
                  <h3 className="amx-sa-modal-title">Add New User</h3>
                  <span className="amx-sa-modal-subtitle">User Provisioning &amp; Onboarding</span>
                </div>
              </div>
              <button
                type="button"
                className="amx-sa-modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
                title="Close modal"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  close
                </span>
              </button>
            </div>

            {addError && (
              <div className="amx-sa-error-banner">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  error
                </span>
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAddUser} className="amx-sa-form-grid">
              {/* Full Name */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  Full Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="amx-sa-form-input"
                  placeholder="e.g. Jonathan Reynolds"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  required
                />
              </div>

              {/* Corporate Email */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  Corporate Email Address <span className="req">*</span>
                </label>
                <input
                  type="email"
                  className="amx-sa-form-input"
                  placeholder="j.reynolds@assetmx.internal"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  required
                />
              </div>

              {/* Employee ID & Canonical Role */}
              <div className="amx-sa-field-row">
                <div className="amx-sa-field-col">
                  <label className="amx-sa-form-label">
                    Employee ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="amx-sa-form-input font-mono"
                    placeholder="EMP-5012"
                    value={addEmpId}
                    onChange={(e) => setAddEmpId(e.target.value)}
                    required
                  />
                </div>
                <div className="amx-sa-field-col">
                  <label className="amx-sa-form-label">
                    Canonical Role <span className="req">*</span>
                  </label>
                  <select
                    className="amx-sa-form-select"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as CanonicalRole)}
                    required
                  >
                    {CANONICAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Department */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  Department <span className="req">*</span>
                </label>
                <select
                  className="amx-sa-form-select"
                  value={addDept}
                  onChange={(e) => setAddDept(e.target.value)}
                  required
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Temporary Password */}
              <div className="amx-sa-field-col">
                <div className="amx-sa-password-header">
                  <label className="amx-sa-form-label">
                    Temporary Password <span className="req">*</span>
                  </label>
                  <button
                    type="button"
                    className="amx-sa-auto-gen-btn"
                    onClick={handleAutoGeneratePassword}
                  >
                    Auto-Generate
                  </button>
                </div>
                <div className="amx-sa-password-wrap">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    className="amx-sa-form-input font-mono"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="amx-sa-password-toggle"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    title={showAddPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {showAddPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <span className="amx-sa-form-hint">
                  User will be prompted to reset upon initial login.
                </span>
              </div>

              {/* Footer Actions */}
              <div className="amx-sa-modal-footer">
                <button
                  type="button"
                  className="amx-sa-btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmittingAdd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amx-sa-btn-primary"
                  disabled={isSubmittingAdd}
                >
                  {isSubmittingAdd ? (
                    'Creating...'
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        check
                      </span>
                      <span>Create User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL B: EDIT USER ──────────────────────────────────────────── */}
      {editingUser && (
        <div className="amx-sa-modal-backdrop" role="dialog" aria-modal="true">
          <div className="amx-sa-modal-card">
            <div className="amx-sa-modal-header">
              <div className="amx-sa-modal-title-group">
                <div className="amx-sa-modal-icon-box neutral">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    manage_accounts
                  </span>
                </div>
                <div>
                  <h3 className="amx-sa-modal-title">Edit User</h3>
                  <span className="amx-sa-modal-subtitle">
                    {`USR-${String(editingUser.id).padStart(5, '0')} — ${editingUser.full_name}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="amx-sa-modal-close-btn"
                onClick={() => setEditingUser(null)}
                title="Close modal"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  close
                </span>
              </button>
            </div>

            {editError && (
              <div className="amx-sa-error-banner">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  error
                </span>
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEditUser} className="amx-sa-form-grid">
              {/* Full Name */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  Full Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="amx-sa-form-input"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                />
              </div>

              {/* Corporate Email */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  Corporate Email Address <span className="req">*</span>
                </label>
                <input
                  type="email"
                  className="amx-sa-form-input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>

              {/* Canonical Role */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  Canonical Role <span className="req">*</span>
                </label>
                <select
                  className="amx-sa-form-select"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as CanonicalRole)}
                  required
                >
                  {CANONICAL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
                <span className="amx-sa-form-hint">
                  Role change requires clearance audit log entry.
                </span>
              </div>

              {/* Department */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  Department <span className="req">*</span>
                </label>
                <select
                  className="amx-sa-form-select"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  required
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Status Toggle */}
              <div className="amx-sa-toggle-box">
                <div className="amx-sa-toggle-info">
                  <span className="amx-sa-toggle-label">Account Status</span>
                  <span className="amx-sa-toggle-sub">
                    {editIsActive ? 'Active access across all modules' : 'Deactivated account'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: editIsActive ? 'var(--amx-sa-secondary)' : 'var(--amx-sa-text-subtle)',
                    }}
                  >
                    {editIsActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                  <label className="amx-sa-switch">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      disabled={editingUser.id === currentUser?.id}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                    />
                    <span className="amx-sa-slider" />
                  </label>
                </div>
              </div>

              {editingUser.id === currentUser?.id && (
                <span className="amx-sa-form-hint" style={{ color: 'var(--amx-sa-text-muted)' }}>
                  Self-deactivation is disabled for your own active session.
                </span>
              )}

              {/* Footer Actions */}
              <div className="amx-sa-modal-footer">
                <button
                  type="button"
                  className="amx-sa-btn-secondary"
                  onClick={() => setEditingUser(null)}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amx-sa-btn-primary"
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? (
                    'Saving...'
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        save
                      </span>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL C: RESET PASSWORD ──────────────────────────────────────── */}
      {resettingUser && (
        <div className="amx-sa-modal-backdrop" role="dialog" aria-modal="true">
          <div className="amx-sa-modal-card">
            <div className="amx-sa-modal-header">
              <div className="amx-sa-modal-title-group">
                <div className="amx-sa-modal-icon-box danger">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    lock_reset
                  </span>
                </div>
                <div>
                  <h3 className="amx-sa-modal-title">Reset Password</h3>
                  <span className="amx-sa-modal-subtitle">
                    {`USR-${String(resettingUser.id).padStart(5, '0')} — ${resettingUser.full_name}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="amx-sa-modal-close-btn"
                onClick={() => setResettingUser(null)}
                title="Close modal"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  close
                </span>
              </button>
            </div>

            {/* Mandatory Warning Banner */}
            <div className="amx-sa-warning-banner">
              <span className="material-symbols-outlined">warning</span>
              <p className="amx-sa-warning-text">
                <strong>Forced Password Reset:</strong> The user will be required to change their
                credentials on their next login session. Active sessions will terminate.
              </p>
            </div>

            {resetError && (
              <div className="amx-sa-error-banner">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  error
                </span>
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitResetPassword} className="amx-sa-form-grid">
              {/* New Temporary Password */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  New Temporary Password <span className="req">*</span>
                </label>
                <div className="amx-sa-password-wrap">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    className="amx-sa-form-input font-mono"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="amx-sa-password-toggle"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    title={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {showResetPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="amx-sa-field-col">
                <label className="amx-sa-form-label">
                  Confirm Password <span className="req">*</span>
                </label>
                <div className="amx-sa-password-wrap">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    className="amx-sa-form-input font-mono"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    required
                  />
                  {resetNewPassword && resetNewPassword === resetConfirmPassword && (
                    <span
                      className="material-symbols-outlined"
                      style={{
                        position: 'absolute',
                        right: '8px',
                        color: 'var(--amx-sa-secondary)',
                        fontSize: '18px',
                      }}
                    >
                      check_circle
                    </span>
                  )}
                </div>
              </div>

              {/* Notify User Checkbox */}
              <div className="amx-sa-toggle-box">
                <span style={{ fontSize: '12px', color: 'var(--amx-sa-text-muted)' }}>
                  Notify user via secure corporate email
                </span>
                <input
                  type="checkbox"
                  checked={resetNotifyEmail}
                  onChange={(e) => setResetNotifyEmail(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              {/* Footer Actions */}
              <div className="amx-sa-modal-footer">
                <button
                  type="button"
                  className="amx-sa-btn-secondary"
                  onClick={() => setResettingUser(null)}
                  disabled={isSubmittingReset}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amx-sa-btn-danger"
                  disabled={isSubmittingReset}
                >
                  {isSubmittingReset ? (
                    'Resetting...'
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        security_update_good
                      </span>
                      <span>Confirm Password Reset</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL D: STATUS CONFIRMATION DIALOG (Deactivate / Re-activate) ── */}
      {confirmStatusUser && (
        <div className="amx-sa-modal-backdrop" role="dialog" aria-modal="true">
          <div className="amx-sa-modal-card">
            <div className="amx-sa-modal-header">
              <div className="amx-sa-modal-title-group">
                <div
                  className={`amx-sa-modal-icon-box ${
                    confirmStatusUser.is_active ? 'danger' : 'neutral'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {confirmStatusUser.is_active ? 'person_off' : 'check_circle'}
                  </span>
                </div>
                <div>
                  <h3 className="amx-sa-modal-title">
                    {confirmStatusUser.is_active
                      ? 'Deactivate User Account'
                      : 'Re-activate User Account'}
                  </h3>
                  <span className="amx-sa-modal-subtitle">
                    {`USR-${String(confirmStatusUser.id).padStart(5, '0')} — ${confirmStatusUser.full_name}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="amx-sa-modal-close-btn"
                onClick={() => setConfirmStatusUser(null)}
                title="Close modal"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  close
                </span>
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--amx-sa-text)', lineHeight: 1.5 }}>
              {confirmStatusUser.is_active ? (
                <p>
                  Are you sure you want to deactivate{' '}
                  <strong>{confirmStatusUser.full_name}</strong>? The user will immediately lose
                  access to the platform and all active sessions will terminate.
                </p>
              ) : (
                <p>
                  Are you sure you want to re-activate{' '}
                  <strong>{confirmStatusUser.full_name}</strong>? The user will regain access to all
                  assigned modules and assets.
                </p>
              )}
            </div>

            <div className="amx-sa-modal-footer">
              <button
                type="button"
                className="amx-sa-btn-secondary"
                onClick={() => setConfirmStatusUser(null)}
                disabled={isSubmittingStatus}
              >
                Cancel
              </button>
              <button
                type="button"
                className={confirmStatusUser.is_active ? 'amx-sa-btn-danger' : 'amx-sa-btn-primary'}
                onClick={handleSubmitStatusChange}
                disabled={isSubmittingStatus}
              >
                {isSubmittingStatus
                  ? 'Processing...'
                  : confirmStatusUser.is_active
                  ? 'Confirm Deactivation'
                  : 'Confirm Re-activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATIONS ──────────────────────────────────────────── */}
      {toast && (
        <div className="amx-sa-toast-container">
          <div className={`amx-sa-toast ${toast.type}`}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {toast.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

