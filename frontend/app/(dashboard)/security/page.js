'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { getStatusColor } from '../../../lib/utils';
import {
  Loader2, ShieldCheck, Server, Search,
  Plus, X, AlertCircle, Eye, Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ServerContextBanner from '../../../components/ui/ServerContextBanner';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

const emptySec = {
  server_id: '',
  os_name: '', os_version: '',
  hardening_status: 'Pending',
  compliance_status: '',
  ssh_key_only: false,
  antivirus_installed: false,
  backup_enabled: false,
  backup_frequency: '',
  backup_destination: '',
  log_retention_days: 90,
  last_audit_date: '',
  next_audit_date: '',
};

function useBodyLock(active) {
  useEffect(() => {
    if (active) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [active]);
}

export default function SecurityPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [servers, setServers] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptySec);
  const [creating, setCreating] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(emptySec);
  const [editing, setEditing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const anyModal = showCreate || showEdit || !!deleteTarget;
  useBodyLock(anyModal);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/security')
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch((err) => { toast.error(err.response?.data?.error || 'Failed to load security data'); setList([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showCreate || showEdit) {
      api.get('/servers', { params: { page_size: 500 } })
        .then((r) => setServers(Array.isArray(r.data?.servers) ? r.data.servers : []))
        .catch(() => setServers([]));
    }
  }, [showCreate, showEdit]);

  const filteredList = !search.trim() ? list : list.filter((s) =>
    (s.server_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.hostname || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.os_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.hardening_status || '').toLowerCase().includes(search.toLowerCase())
  );

  function setC(f, v) { setCreateForm((p) => ({ ...p, [f]: v })); }
  function setE(f, v) { setEditForm((p) => ({ ...p, [f]: v })); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.server_id) { toast.error('Please select a server'); return; }
    setCreating(true);
    try {
      await api.put(`/security/${createForm.server_id}`, createForm);
      toast.success('Security record saved');
      setShowCreate(false);
      setCreateForm(emptySec);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save security record');
    } finally { setCreating(false); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editForm.server_id) { toast.error('No server selected'); return; }
    setEditing(true);
    try {
      await api.put(`/security/${editForm.server_id}`, editForm);
      toast.success('Security record updated');
      setShowEdit(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update security record');
    } finally { setEditing(false); }
  }

  function openEdit(row) {
    setEditForm({
      server_id: String(row.server_id),
      os_name: row.os_name || '', os_version: row.os_version || '',
      hardening_status: row.hardening_status || 'Pending',
      compliance_status: row.compliance_status || '',
      ssh_key_only: !!row.ssh_key_only,
      antivirus_installed: !!row.antivirus_installed,
      backup_enabled: !!row.backup_enabled,
      backup_frequency: row.backup_frequency || '',
      backup_destination: row.backup_destination || '',
      log_retention_days: row.log_retention_days ?? 90,
      last_audit_date: row.last_audit_date ? new Date(row.last_audit_date).toISOString().slice(0, 10) : '',
      next_audit_date: row.next_audit_date ? new Date(row.next_audit_date).toISOString().slice(0, 10) : '',
    });
    setShowEdit(true);
  }

  const SecForm = ({ open, form, set, onSubmit, submitting, submitLabel, onClose, title, description, isCreate }) => (
    <Modal open={open} onClose={!submitting ? onClose : undefined} title={title} description={description} size="wide">
      <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="dialog-body">
          {isCreate && (
            <div className="dialog-section">
              <span className="dialog-section-title">Server</span>
              <div>
                <label className="label">Server *</label>
                <select required className="select-field" value={form.server_id} onChange={(e) => set('server_id', e.target.value)}>
                  <option value="">Select server…</option>
                  {servers.map((s) => (
                    <option key={s.server_id} value={s.server_id}>
                      {s.server_code}{s.hostname ? ` — ${s.hostname}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="dialog-section">
            <span className="dialog-section-title">Operating System</span>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">OS Name</label><input className="input-field" placeholder="Ubuntu, RHEL, Windows…" value={form.os_name} onChange={(e) => set('os_name', e.target.value)} /></div>
              <div><label className="label">OS Version</label><input className="input-field" placeholder="22.04 LTS" value={form.os_version} onChange={(e) => set('os_version', e.target.value)} /></div>
            </div>
          </div>
          <div className="dialog-section">
            <span className="dialog-section-title">Hardening &amp; Compliance</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Hardening Status</label>
                <select className="select-field" value={form.hardening_status} onChange={(e) => set('hardening_status', e.target.value)}>
                  <option value="Pending">Pending</option>
                  <option value="Hardened">Hardened</option>
                  <option value="Partially Hardened">Partially Hardened</option>
                  <option value="Not Hardened">Not Hardened</option>
                </select>
              </div>
              <div>
                <label className="label">Compliance Status</label>
                <select className="select-field" value={form.compliance_status} onChange={(e) => set('compliance_status', e.target.value)}>
                  <option value="">Not set</option>
                  <option value="Compliant">Compliant</option>
                  <option value="Non-Compliant">Non-Compliant</option>
                  <option value="In Review">In Review</option>
                </select>
              </div>
              <div><label className="label">Last Audit Date</label><input type="date" className="input-field" value={form.last_audit_date} onChange={(e) => set('last_audit_date', e.target.value)} /></div>
              <div><label className="label">Next Audit Date</label><input type="date" className="input-field" value={form.next_audit_date} onChange={(e) => set('next_audit_date', e.target.value)} /></div>
            </div>
          </div>
          <div className="dialog-section">
            <span className="dialog-section-title">Backup &amp; Logging</span>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Backup Frequency</label><input className="input-field" placeholder="Daily, Weekly…" value={form.backup_frequency} onChange={(e) => set('backup_frequency', e.target.value)} /></div>
              <div><label className="label">Backup Destination</label><input className="input-field" placeholder="NAS, S3, Tape…" value={form.backup_destination} onChange={(e) => set('backup_destination', e.target.value)} /></div>
              <div><label className="label">Log Retention (days)</label><input type="number" min="1" className="input-field" value={form.log_retention_days} onChange={(e) => set('log_retention_days', e.target.value)} /></div>
            </div>
          </div>
          <div className="dialog-section">
            <span className="dialog-section-title">Security Flags</span>
            <div className="flex flex-col gap-2">
              {[
                { key: 'ssh_key_only', label: 'SSH Key Only (no password login)' },
                { key: 'antivirus_installed', label: 'Antivirus Installed' },
                { key: 'backup_enabled', label: 'Backup Enabled' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} className="w-4 h-4 rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={onClose} disabled={submitting} className="dialog-btn-cancel">Cancel</button>
          <button type="submit" disabled={submitting} className="dialog-btn-primary">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );

  return (
    <div className="space-y-6 animate-in">
      <ServerContextBanner />
      <div className="page-header">
        <div>
          <h1 className="page-title">Security & Compliance</h1>
          <p className="page-subtitle">Server security posture and hardening status</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/servers" className="btn-secondary flex-shrink-0">
            <Server className="w-4 h-4" /> All servers
          </Link>
          <button type="button" onClick={() => { setCreateForm(emptySec); setShowCreate(true); }} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> Add Security Record
          </button>
        </div>
      </div>

      <SecForm open={showCreate} form={createForm} set={setC} onSubmit={handleCreate} submitting={creating}
        submitLabel="Save Record" onClose={() => { setShowCreate(false); setCreateForm(emptySec); }}
        title="Add Security Record" description="Assign OS and security posture to a server." isCreate />
      <SecForm open={showEdit} form={editForm} set={setE} onSubmit={handleEdit} submitting={editing}
        submitLabel="Update Record" onClose={() => setShowEdit(false)}
        title="Edit Security Record" description="Update security and compliance details." isCreate={false} />

      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Clear security record" description="This will reset all security data for this server." danger>
        <div className="dialog-body">
          <p className="text-sm text-[var(--text-secondary)]">Clear security data for <span className="font-mono font-semibold text-[var(--text-primary)]">{deleteTarget?.server_code}</span>?</p>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="dialog-btn-cancel">Cancel</button>
          <button
            type="button" disabled={deleting} className="dialog-btn-danger"
            onClick={async () => {
              setDeleting(true);
              try {
                await api.put(`/security/${deleteTarget.server_id}`, {
                  os_name: null, os_version: null, hardening_status: 'Pending',
                  compliance_status: null, ssh_key_only: false, antivirus_installed: false,
                  backup_enabled: false, backup_frequency: null, log_retention_days: 90,
                });
                toast.success('Security data cleared');
                setDeleteTarget(null); load();
              } catch (err) {
                toast.error(err.response?.data?.error || 'Failed to clear');
              } finally { setDeleting(false); }
            }}
          >
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Clearing…</> : 'Clear Record'}
          </button>
        </div>
      </Modal>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="text" placeholder="Search by server, OS, hardening status…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{filteredList.length} record{filteredList.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="table-container overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
          ) : (
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th>Server</th>
                  <th>OS</th>
                  <th>Hardening</th>
                  <th>Compliance</th>
                  <th>Backup</th>
                  <th>SSH / AV</th>
                  <th className="text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <div className="state-empty inline-flex flex-col">
                        <ShieldCheck className="w-10 h-10 text-[var(--text-muted)] mb-2" />
                        {list.length === 0 ? 'No security records. Add one to get started.' : 'No matches for your search.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredList.map((s) => (
                    <tr key={s.server_id}>
                      <td>
                        <Link href={`/servers/${s.server_id}`} className="font-mono font-medium text-[var(--primary)] hover:underline">
                          {s.server_code}
                        </Link>
                        {s.hostname && <span className="text-xs text-[var(--text-muted)] block">{s.hostname}</span>}
                      </td>
                      <td className="text-sm">
                        {s.os_name ? `${s.os_name}${s.os_version ? ' ' + s.os_version : ''}` : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td><span className={getStatusColor(s.hardening_status)}>{s.hardening_status || '—'}</span></td>
                      <td className="text-sm">{s.compliance_status || <span className="text-[var(--text-muted)]">—</span>}</td>
                      <td className="text-sm">
                        {s.backup_enabled ? (
                          <span className="badge-green">Yes{s.backup_frequency ? ` · ${s.backup_frequency}` : ''}</span>
                        ) : <span className="badge-gray">No</span>}
                      </td>
                      <td className="text-sm">
                        <div className="flex items-center gap-1">
                          {s.ssh_key_only ? <span className="badge-blue text-[10px]">SSH Key</span> : null}
                          {s.antivirus_installed ? <span className="badge-green text-[10px]">AV</span> : null}
                          {!s.ssh_key_only && !s.antivirus_installed && <span className="text-[var(--text-muted)]">—</span>}
                        </div>
                      </td>
                      <td className="text-right">
                        <RowActions items={[
                          { label: 'View Server', icon: <Eye className="w-4 h-4" />, onClick: () => { window.location.href = `/servers/${s.server_id}`; } },
                          { label: 'Edit Security', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(s) },
                          { type: 'divider' },
                          { label: 'Clear Record', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => setDeleteTarget(s) },
                        ]} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
