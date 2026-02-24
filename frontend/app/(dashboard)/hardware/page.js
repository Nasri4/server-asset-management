'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import {
  Loader2, Cpu, Server, Search, HardDrive, CpuIcon,
  Plus, Eye, Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ServerContextBanner from '../../../components/ui/ServerContextBanner';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

const emptyHw = {
  server_id: '',
  vendor: '', model: '', serial_number: '', asset_tag: '',
  cpu_model: '', cpu_cores: '', ram_gb: '', storage_tb: '',
  raid_level: '', nic_count: '', power_supply: '',
  warranty_start: '', warranty_expiry: '',
};

// FIX 1: Robust Body Lock - Toos ugu xir scroll-ka
function useBodyLock(active) {
  useEffect(() => {
    if (active) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [active]);
}

// FIX 2: Component-ga banaanka u soo saar (Performance fix)
const HwForm = ({ open, form, set, onSubmit, submitting, submitLabel, onClose, title, description, isCreate, servers }) => (
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
          <span className="dialog-section-title">Device Identity</span>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Vendor</label><input className="input-field" placeholder="Dell, HP, Lenovo…" value={form.vendor} onChange={(e) => set('vendor', e.target.value)} /></div>
            <div><label className="label">Model</label><input className="input-field" placeholder="PowerEdge R740" value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
            <div><label className="label">Serial Number</label><input className="input-field" placeholder="SN-12345" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></div>
            <div><label className="label">Asset Tag</label><input className="input-field" placeholder="ASSET-001" value={form.asset_tag} onChange={(e) => set('asset_tag', e.target.value)} /></div>
          </div>
        </div>
        <div className="dialog-section">
          <span className="dialog-section-title">Compute</span>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">CPU Model</label><input className="input-field" placeholder="Intel Xeon Gold 6248" value={form.cpu_model} onChange={(e) => set('cpu_model', e.target.value)} /></div>
            <div><label className="label">CPU Cores</label><input type="number" min="1" className="input-field" placeholder="16" value={form.cpu_cores} onChange={(e) => set('cpu_cores', e.target.value)} /></div>
            <div><label className="label">RAM (GB)</label><input type="number" min="1" className="input-field" placeholder="64" value={form.ram_gb} onChange={(e) => set('ram_gb', e.target.value)} /></div>
            <div><label className="label">Storage (TB)</label><input type="number" min="0" step="0.1" className="input-field" placeholder="2" value={form.storage_tb} onChange={(e) => set('storage_tb', e.target.value)} /></div>
            <div><label className="label">RAID Level</label><input className="input-field" placeholder="RAID 5, RAID 10…" value={form.raid_level} onChange={(e) => set('raid_level', e.target.value)} /></div>
            <div><label className="label">NIC Count</label><input type="number" min="0" className="input-field" placeholder="4" value={form.nic_count} onChange={(e) => set('nic_count', e.target.value)} /></div>
            <div><label className="label">Power Supply</label><input className="input-field" placeholder="Redundant 750W" value={form.power_supply} onChange={(e) => set('power_supply', e.target.value)} /></div>
          </div>
        </div>
        <div className="dialog-section">
          <span className="dialog-section-title">Warranty</span>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Warranty Start</label><input type="date" className="input-field" value={form.warranty_start} onChange={(e) => set('warranty_start', e.target.value)} /></div>
            <div><label className="label">Warranty Expiry</label><input type="date" className="input-field" value={form.warranty_expiry} onChange={(e) => set('warranty_expiry', e.target.value)} /></div>
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

export default function HardwarePage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [servers, setServers] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyHw);
  const [creating, setCreating] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(emptyHw);
  const [editing, setEditing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Activate body lock
  const anyModal = showCreate || showEdit || !!deleteTarget;
  useBodyLock(anyModal);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/hardware')
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch((err) => { toast.error(err.response?.data?.error || 'Failed to load hardware'); setList([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showCreate || showEdit) {
      api.get('/servers', { params: { page_size: 500 } })
        .then((r) => setServers(Array.isArray(r.data?.servers) ? r.data.servers : []))
        .catch(() => setServers([]));
    } else {
      setServers([]);
    }
  }, [showCreate, showEdit]);

  const filteredList = !search.trim() ? list : list.filter((s) =>
    (s.server_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.hostname || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.vendor || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.model || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.serial_number || '').toLowerCase().includes(search.toLowerCase())
  );

  function setC(f, v) { setCreateForm((p) => ({ ...p, [f]: v })); }
  function setE(f, v) { setEditForm((p) => ({ ...p, [f]: v })); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.server_id) { toast.error('Please select a server'); return; }
    setCreating(true);
    try {
      await api.put(`/servers/${createForm.server_id}/hardware`, createForm);
      toast.success('Hardware saved');
      setShowCreate(false);
      setCreateForm(emptyHw);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save hardware');
    } finally { setCreating(false); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editForm.server_id) { toast.error('No server selected'); return; }
    setEditing(true);
    try {
      await api.put(`/servers/${editForm.server_id}/hardware`, editForm);
      toast.success('Hardware updated');
      setShowEdit(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update hardware');
    } finally { setEditing(false); }
  }

  function openEdit(row) {
    setEditForm({
      server_id: String(row.server_id),
      vendor: row.vendor || '', model: row.model || '',
      serial_number: row.serial_number || '', asset_tag: row.asset_tag || '',
      cpu_model: row.cpu_model || '', cpu_cores: row.cpu_cores ?? '',
      ram_gb: row.ram_gb ?? '', storage_tb: row.storage_tb ?? '',
      raid_level: row.raid_level || '', nic_count: row.nic_count ?? '',
      power_supply: row.power_supply || '',
      warranty_start: row.warranty_start ? new Date(row.warranty_start).toISOString().slice(0, 10) : '',
      warranty_expiry: row.warranty_expiry ? new Date(row.warranty_expiry).toISOString().slice(0, 10) : '',
    });
    setShowEdit(true);
  }

  // FIX 3: Structure - Isticmaal Fragment <> si Modals-ka u noqdaan kuwo xor ah
  return (
    <>
      <div className="space-y-6 animate-in">
        <ServerContextBanner />
        <div className="page-header">
          <div>
            <h1 className="page-title">Server Hardware</h1>
            <p className="page-subtitle">Hardware specs, warranty, and asset details by server</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/servers" className="btn-secondary flex-shrink-0">
              <Server className="w-4 h-4" /> All servers
            </Link>
            <button type="button" onClick={() => { setCreateForm(emptyHw); setShowCreate(true); }} className="btn-primary flex-shrink-0">
              <Plus className="w-4 h-4" /> Add Hardware
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <div className="table-toolbar">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input type="text" placeholder="Search by server, vendor, model, serial…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{filteredList.length} record{filteredList.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="table-container overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" /></div>
            ) : (
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr>
                    <th>Server</th>
                    <th>Vendor / Model</th>
                    <th>CPU / RAM</th>
                    <th>Storage</th>
                    <th>Serial / Asset</th>
                    <th>Warranty Expiry</th>
                    <th className="text-right w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12">
                        <div className="state-empty inline-flex flex-col">
                          <Cpu className="w-10 h-10 text-[var(--text-muted)] mb-2" />
                          {list.length === 0 ? 'No hardware records. Add one to get started.' : 'No matches for your search.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((row) => (
                      <tr key={row.server_id}>
                        <td>
                          <Link href={`/servers/${row.server_id}`} className="font-mono font-medium text-[var(--primary)] hover:underline inline-flex items-center gap-1">
                            <Server className="w-3.5 h-3.5" />{row.server_code}
                          </Link>
                          {row.hostname && <span className="text-xs text-[var(--text-muted)] block">{row.hostname}</span>}
                        </td>
                        <td className="text-sm">
                          {row.vendor || row.model ? [row.vendor, row.model].filter(Boolean).join(' · ') : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="text-sm">
                          {row.cpu_model || row.cpu_cores != null || row.ram_gb != null ? (
                            <span className="inline-flex items-center gap-1">
                              <CpuIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                              {[row.cpu_model, row.cpu_cores != null ? `${row.cpu_cores}c` : null, row.ram_gb != null ? `${row.ram_gb}GB` : null].filter(Boolean).join(' · ')}
                            </span>
                          ) : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="text-sm text-[var(--text-secondary)]">
                          {row.storage_tb != null ? (
                            <span className="inline-flex items-center gap-1">
                              <HardDrive className="w-3.5 h-3.5" />{row.storage_tb} TB
                              {row.raid_level && <span className="badge-gray text-[10px]">{row.raid_level}</span>}
                            </span>
                          ) : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="text-sm font-mono text-[var(--text-secondary)]">
                          {row.serial_number || row.asset_tag ? (
                            <span>{row.serial_number || '—'}{row.asset_tag && <span className="text-[var(--text-muted)]"> / {row.asset_tag}</span>}</span>
                          ) : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="text-sm text-[var(--text-secondary)]">
                          {row.warranty_expiry ? formatDate(row.warranty_expiry) : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="text-right">
                          <RowActions items={[
                            { label: 'View Server', icon: <Eye className="w-4 h-4" />, onClick: () => { window.location.href = `/servers/${row.server_id}`; } },
                            { label: 'Edit Hardware', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(row) },
                            { type: 'divider' },
                            { label: 'Clear Hardware', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => setDeleteTarget(row) },
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

      {/* Modals are now OUTSIDE the animate-in div to fix backdrop stacking context */}
      <HwForm
        open={showCreate}
        form={createForm} set={setC}
        onSubmit={handleCreate} submitting={creating}
        submitLabel="Save Hardware"
        onClose={() => { setShowCreate(false); setCreateForm(emptyHw); }}
        title="Add Server Hardware"
        description="Link hardware specs to a server. Select a server then fill in the details."
        isCreate
        servers={servers}
      />

      <HwForm
        open={showEdit}
        form={editForm} set={setE}
        onSubmit={handleEdit} submitting={editing}
        submitLabel="Update Hardware"
        onClose={() => { setShowEdit(false); }}
        title="Edit Hardware"
        description="Update the hardware specifications for this server."
        isCreate={false}
        servers={servers}
      />

      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Remove hardware record" description="This will clear all hardware data for this server." danger>
        <div className="dialog-body">
          <p className="text-sm text-[var(--text-secondary)]">
            Remove hardware data for <span className="font-mono font-semibold text-[var(--text-primary)]">{deleteTarget?.server_code}</span>?
          </p>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="dialog-btn-cancel">Cancel</button>
          <button
            type="button"
            disabled={deleting}
            className="dialog-btn-danger"
            onClick={async () => {
              setDeleting(true);
              try {
                await api.put(`/servers/${deleteTarget.server_id}/hardware`, {
                  vendor: null, model: null, serial_number: null, asset_tag: null,
                  cpu_model: null, cpu_cores: null, ram_gb: null, storage_tb: null,
                  raid_level: null, nic_count: null, power_supply: null,
                  warranty_start: null, warranty_expiry: null,
                });
                toast.success('Hardware data cleared');
                setDeleteTarget(null);
                load();
              } catch (err) {
                toast.error(err.response?.data?.error || 'Failed to clear hardware');
              } finally { setDeleting(false); }
            }}
          >
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Clearing…</> : 'Clear Hardware'}
          </button>
        </div>
      </Modal>
    </>
  );
}