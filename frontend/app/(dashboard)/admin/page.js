'use client';
import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import PhoneInput from '../../../components/ui/PhoneInput';
import EmailInput from '../../../components/ui/EmailInput';
import { Settings, Users, Shield, Bell, Key, Loader2, Plus, Eye, EyeOff, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';

const TABS = ['Users', 'Roles', 'Settings'];

export default function AdminPage() {
  const { hasRole, hasPermission, user } = useAuth();
  const [tab, setTab] = useState('Users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [settings, setSettings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', phone: '', role_id: '', department_id: '', team_id: '', engineer_id: '' });
  const [permissions, setPermissions] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [rolePermissionIds, setRolePermissionIds] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [u, r, s, d, t, p, e] = await Promise.all([
        api.get('/admin/users'), api.get('/admin/roles'), api.get('/admin/settings'),
        api.get('/departments'), api.get('/teams'),
        api.get('/admin/permissions').catch(() => ({ data: [] })),
        api.get('/engineers').catch(() => ({ data: [] })),
      ]);
      setUsers(u.data ?? []); setRoles(r.data ?? []); setSettings(s.data ?? []); setDepartments(d.data ?? []); setTeams(t.data ?? []);
      setPermissions(p?.data ?? []);
      setEngineers(e?.data ?? []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  async function openRolePermissions(role) {
    setEditingRole(role);
    try {
      const res = await api.get(`/admin/roles/${role.role_id}/permissions`);
      setRolePermissionIds((res.data ?? []).map(p => p.permission_id));
    } catch {
      setRolePermissionIds([]);
    }
  }

  function toggleRolePermission(permId) {
    setRolePermissionIds(prev => prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]);
  }

  function toggleAllInModule(module) {
    const inModule = permissions.filter(p => p.module === module).map(p => p.permission_id);
    const allSelected = inModule.every(id => rolePermissionIds.includes(id));
    if (allSelected) setRolePermissionIds(prev => prev.filter(id => !inModule.includes(id)));
    else setRolePermissionIds(prev => [...new Set([...prev, ...inModule])]);
  }

  async function saveRolePermissions() {
    if (!editingRole) return;
    setSavingPermissions(true);
    try {
      await api.put(`/admin/roles/${editingRole.role_id}/permissions`, { permission_ids: rolePermissionIds });
      toast.success('Role permissions updated');
      setEditingRole(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update permissions');
    } finally {
      setSavingPermissions(false);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    try {
      await api.post('/admin/users', { ...form, role_id: parseInt(form.role_id),
        department_id: form.department_id ? parseInt(form.department_id) : null,
        team_id: form.team_id ? parseInt(form.team_id) : null,
        engineer_id: form.engineer_id ? parseInt(form.engineer_id) : null });
      toast.success('User created');
      setShowForm(false);
      setForm({ username: '', password: '', full_name: '', email: '', phone: '', role_id: '', department_id: '', team_id: '', engineer_id: '' });
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  }

  async function toggleUser(userId, currentActive) {
    try {
      await api.put(`/admin/users/${userId}`, { is_active: !currentActive });
      toast.success('User updated');
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    }
  }

  async function updateSetting(key, value) {
    try {
      await api.put(`/admin/settings/${key}`, { value });
      toast.success('Setting updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update setting');
    }
  }

  const canManageUsers = hasRole('Admin') || hasPermission('admin.users');
  const selectedRole = roles.find(r => String(r.role_id) === String(form.role_id));
  const selectedRoleName = (selectedRole?.role_name || '').toLowerCase();
  const isDepartmentRole = selectedRoleName.includes('department');
  const isTeamRole = selectedRoleName.includes('team') || selectedRoleName.includes('section');
  const isEngineerRole = selectedRoleName.includes('engineer');

  const actorRole = (user?.role_name || user?.role || '').toLowerCase();
  const actorIsAdmin = actorRole.includes('admin');
  const actorDepartmentId = user?.department_id || null;
  const actorTeamId = user?.team_id || null;

  const visibleDepartments = departments.filter((d) => {
    if (actorIsAdmin) return true;
    if (!actorDepartmentId) return false;
    return d.department_id === actorDepartmentId;
  });

  const visibleTeams = teams.filter((team) => {
    if (!form.department_id) return false;
    if (team.department_id !== parseInt(form.department_id, 10)) return false;
    if (actorIsAdmin) return true;
    if (actorTeamId) return team.team_id === actorTeamId;
    return true;
  });

  const visibleEngineers = engineers.filter((eng) => {
    if (eng.linked_user_id || eng.linked_username) return false;
    if (form.department_id && eng.department_id && eng.department_id !== parseInt(form.department_id, 10)) return false;
    if (form.team_id && eng.team_id && eng.team_id !== parseInt(form.team_id, 10)) return false;
    if (actorIsAdmin) return true;
    if (actorTeamId) return eng.team_id === actorTeamId;
    if (actorDepartmentId) return eng.department_id === actorDepartmentId;
    return false;
  });

  function onRoleChange(nextRoleId) {
    setForm((prev) => ({
      ...prev,
      role_id: nextRoleId,
      department_id: '',
      team_id: '',
      engineer_id: '',
    }));
  }

  function onDepartmentChange(nextDepartmentId) {
    setForm((prev) => ({ ...prev, department_id: nextDepartmentId, team_id: '', engineer_id: '' }));
  }

  function onTeamChange(nextTeamId) {
    setForm((prev) => ({ ...prev, team_id: nextTeamId, engineer_id: '' }));
  }

  function onEngineerChange(nextEngineerId) {
    const selectedEngineer = engineers.find((eng) => String(eng.engineer_id) === String(nextEngineerId));
    if (!selectedEngineer) {
      setForm((prev) => ({ ...prev, engineer_id: '', department_id: '', team_id: '' }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      engineer_id: String(selectedEngineer.engineer_id),
      department_id: selectedEngineer.department_id ? String(selectedEngineer.department_id) : prev.department_id,
      team_id: selectedEngineer.team_id ? String(selectedEngineer.team_id) : prev.team_id,
    }));
  }

  if (!canManageUsers) return <div className="text-center py-20 text-[var(--text-secondary)]">Admin access required.</div>;
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="page-subtitle">User management, roles, and system configuration</p>
        </div>
        {tab === 'Users' && (
          <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> Create User
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-[var(--border-soft)] mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-3 text-sm border-b-2 transition-all -mb-px ${tab === t ? 'tab-active' : 'tab-inactive'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'Users' && (
        <div>
          <Modal open={showForm} onClose={() => setShowForm(false)} title="Create user" description="Add a new user with role and optional department/team." size="wide">
            <form onSubmit={createUser} className="flex flex-col flex-1 min-h-0">
              <div className="dialog-body">
                <div className="dialog-section">
                  <span className="dialog-section-title">Account</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="label">Username *</label><input required className="input-field" placeholder="Login name" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} /></div>
                    <div><label className="label">Full name *</label><input required className="input-field" placeholder="Display name" value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} /></div>
                    <div className="md:col-span-2">
                      <label className="label">Password *</label>
                      <div className="relative">
                        <input required type={showPass ? 'text' : 'password'} className="input-field pr-11" placeholder="Minimum length per policy" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--primary)]">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      </div>
                    </div>
                    <div><label className="label">Email</label><EmailInput className="input-field" value={form.email} onChange={v => setForm(f => ({...f, email: v}))} /></div>
                    <div><label className="label">Phone (for OTP)</label><PhoneInput id="admin-phone" value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} /></div>
                  </div>
                </div>
                <div className="dialog-section">
                  <span className="dialog-section-title">Role & organization</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Role *</label>
                      <select required className="select-field" value={form.role_id} onChange={e => onRoleChange(e.target.value)}>
                        <option value="">Select role</option>
                        {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                      </select>
                    </div>

                    {(isDepartmentRole || isTeamRole || isEngineerRole) && (
                      <div>
                        <label className="label">Department {isDepartmentRole || isTeamRole ? '*' : ''}</label>
                        <select
                          required={isDepartmentRole || isTeamRole}
                          className="select-field"
                          value={form.department_id}
                          onChange={e => onDepartmentChange(e.target.value)}
                          disabled={isEngineerRole && !!form.engineer_id}
                        >
                          <option value="">Select department</option>
                          {visibleDepartments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                        </select>
                      </div>
                    )}

                    {(isTeamRole || isEngineerRole) && (
                      <div>
                        <label className="label">Team {isTeamRole ? '*' : ''}</label>
                        <select
                          required={isTeamRole}
                          className="select-field"
                          value={form.team_id}
                          onChange={e => onTeamChange(e.target.value)}
                          disabled={isEngineerRole && !!form.engineer_id}
                        >
                          <option value="">Select team</option>
                          {visibleTeams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
                        </select>
                      </div>
                    )}

                    {isEngineerRole && (
                      <div className="md:col-span-3">
                        <label className="label">Engineer *</label>
                        <select
                          required
                          className="select-field"
                          value={form.engineer_id}
                          onChange={e => onEngineerChange(e.target.value)}
                        >
                          <option value="">Select engineer</option>
                          {visibleEngineers.map(eng => (
                            <option key={eng.engineer_id} value={eng.engineer_id}>
                              {eng.full_name} {eng.team_name ? `(${eng.team_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="dialog-footer">
                <button type="button" onClick={() => setShowForm(false)} className="dialog-btn-cancel">Cancel</button>
                <button type="submit" className="dialog-btn-primary">Create user</button>
              </div>
            </form>
          </Modal>

          <div className="table-wrapper">
            <div className="table-toolbar">
              <span className="text-sm text-[var(--text-muted)]">{users.length} user{users.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="table-container overflow-x-auto">
              <table className="w-full">
                <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Department</th><th>Team</th><th>Phone</th><th>Status</th><th className="text-right w-24">Actions</th></tr></thead>
                <tbody>
                  {!users.length ? (
                    <tr><td colSpan={8} className="text-center py-12"><div className="state-empty">No users yet</div></td></tr>
                  ) : users.map(u => (
                    <tr key={u.user_id}>
                      <td className="font-mono font-medium">{u.username}</td>
                      <td>{u.full_name}</td>
                      <td><span className="badge-blue">{u.role_name}</span></td>
                      <td className="text-xs">{u.department_name || '—'}</td>
                      <td className="text-xs">{u.team_name || '—'}</td>
                      <td className="text-xs font-mono">{u.phone || '—'}</td>
                      <td>{u.is_active ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}</td>
                      <td className="text-right">
                        <button type="button" onClick={() => toggleUser(u.user_id, u.is_active)}
                                className={`text-xs font-medium ${u.is_active ? 'text-[var(--danger)] hover:opacity-90' : 'text-[var(--success)] hover:opacity-90'}`}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Roles tab */}
      {tab === 'Roles' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {roles.map(r => (
              <div key={r.role_id} className="card p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-[var(--primary-soft)] rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">{r.role_name}</div>
                    <div className="text-xs text-[var(--text-muted)]">Level {r.level}</div>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-4 flex-1">{r.description}</p>
                <button type="button" onClick={() => openRolePermissions(r)} className="btn-secondary w-full text-sm">
                  Edit permissions
                </button>
              </div>
            ))}
          </div>

          <Modal open={!!editingRole} onClose={() => setEditingRole(null)} title="Edit permissions" description={editingRole ? `${editingRole.role_name} — changes apply immediately.` : ''} size="wide">
            <div className="dialog-body">
              <p className="text-sm text-[var(--text-secondary)] mb-4">Check the permissions to grant to this role.</p>
              <div className="space-y-6">
                {Object.entries(permissions.reduce((acc, p) => { (acc[p.module] = acc[p.module] || []).push(p); return acc; }, {})).map(([module, perms]) => (
                  <div key={module} className="dialog-section">
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" className="rounded border-[var(--border-soft)]"
                        checked={perms.every(p => rolePermissionIds.includes(p.permission_id))}
                        onChange={() => toggleAllInModule(module)} />
                      <span className="dialog-section-title capitalize">{module}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-6">
                      {perms.map(p => (
                        <label key={p.permission_id} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                          <input type="checkbox" className="rounded border-[var(--border-soft)]"
                            checked={rolePermissionIds.includes(p.permission_id)}
                            onChange={() => toggleRolePermission(p.permission_id)} />
                          {p.permission_name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={() => setEditingRole(null)} className="dialog-btn-cancel">Cancel</button>
              <button type="button" onClick={saveRolePermissions} disabled={savingPermissions} className="dialog-btn-primary">
                {savingPermissions ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save permissions</>}
              </button>
            </div>
          </Modal>
        </div>
      )}

      {/* Settings tab */}
      {tab === 'Settings' && (
        <div className="space-y-1">
          {Object.entries(settings.reduce((acc, s) => { (acc[s.category] = acc[s.category] || []).push(s); return acc; }, {})).map(([cat, items]) => (
            <div key={cat} className="card p-5 mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-4">{cat}</h3>
              <div className="space-y-4">
                {items.map(s => (
                  <div key={s.setting_key} className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm text-[var(--text-primary)]">{s.setting_key.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{s.description}</div>
                    </div>
                    <input className="input-field w-48 text-right" defaultValue={s.setting_value}
                           onBlur={e => { if (e.target.value !== s.setting_value) updateSetting(s.setting_key, e.target.value); }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
