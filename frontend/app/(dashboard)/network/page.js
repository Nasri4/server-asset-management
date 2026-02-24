'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import {
  Loader2, Globe, Server, Search, Shield, Network,
  Plus, Eye, Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ServerContextBanner from '../../../components/ui/ServerContextBanner';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

const emptyNet = {
  server_id: '',
  ip_address: '', secondary_ip: '', ipv6: '',
  subnet: '', vlan: '', gateway: '',
  dns_primary: '', dns_secondary: '',
  network_type: '', bandwidth: '',
  firewall_enabled: false, nat_enabled: false,
};

// FIX 1: Move NetForm OUTSIDE of NetworkPage so it doesn't remount on every render
const NetForm = ({ open, form, set, onSubmit, submitting, submitLabel, onClose, title, description, isCreate, servers }) => (
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
          <span className="dialog-section-title">IP Addressing</span>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Primary IP</label><input className="input-field" placeholder="10.0.1.100" value={form.ip_address} onChange={(e) => set('ip_address', e.target.value)} /></div>
            <div><label className="label">Secondary IP</label><input className="input-field" placeholder="10.0.1.101" value={form.secondary_ip} onChange={(e) => set('secondary_ip', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">IPv6</label><input className="input-field" placeholder="2001:db8::1" value={form.ipv6} onChange={(e) => set('ipv6', e.target.value)} /></div>
            <div><label className="label">Subnet Mask</label><input className="input-field" placeholder="255.255.255.0" value={form.subnet} onChange={(e) => set('subnet', e.target.value)} /></div>
            <div><label className="label">VLAN</label><input className="input-field" placeholder="VLAN 100" value={form.vlan} onChange={(e) => set('vlan', e.target.value)} /></div>
          </div>
        </div>
        <div className="dialog-section">
          <span className="dialog-section-title">Routing &amp; DNS</span>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Gateway</label><input className="input-field" placeholder="10.0.1.1" value={form.gateway} onChange={(e) => set('gateway', e.target.value)} /></div>
            <div><label className="label">Primary DNS</label><input className="input-field" placeholder="8.8.8.8" value={form.dns_primary} onChange={(e) => set('dns_primary', e.target.value)} /></div>
            <div><label className="label">Secondary DNS</label><input className="input-field" placeholder="8.8.4.4" value={form.dns_secondary} onChange={(e) => set('dns_secondary', e.target.value)} /></div>
            <div><label className="label">Network Type</label><input className="input-field" placeholder="Management, Data, DMZ…" value={form.network_type} onChange={(e) => set('network_type', e.target.value)} /></div>
            <div><label className="label">Bandwidth</label><input className="input-field" placeholder="1Gbps, 10Gbps…" value={form.bandwidth} onChange={(e) => set('bandwidth', e.target.value)} /></div>
          </div>
        </div>
        <div className="dialog-section">
          <span className="dialog-section-title">Security Flags</span>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={form.firewall_enabled} onChange={(e) => set('firewall_enabled', e.target.checked)} className="w-4 h-4 rounded" />
              Firewall Enabled
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={form.nat_enabled} onChange={(e) => set('nat_enabled', e.target.checked)} className="w-4 h-4 rounded" />
              NAT Enabled
            </label>
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

export default function NetworkPage() {
  console.log('🔥 NetworkPage RENDERING at:', new Date().toISOString());

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [servers, setServers] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyNet);
  const [creating, setCreating] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(emptyNet);
  const [editing, setEditing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // FIX 2: Use useCallback for fetching so it's stable and standard
  const fetchNetworkData = useCallback(async () => {
    console.log('📡 Loading network data...');
    setLoading(true);
    try {
      const r = await api.get('/network');
      setList(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load network data');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('🔄 Initial load - once');
    fetchNetworkData();
  }, [fetchNetworkData]); 

  useEffect(() => {
    if (showCreate || showEdit) {
      console.log('🔄 Fetching servers for modal');
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
    (s.ip_address || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.network_type || '').toLowerCase().includes(search.toLowerCase())
  );

  function setC(f, v) { setCreateForm((p) => ({ ...p, [f]: v })); }
  function setE(f, v) { setEditForm((p) => ({ ...p, [f]: v })); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.server_id) { 
      toast.error('Please select a server');
      return; 
    }
    setCreating(true);
    try {
      await api.put(`/servers/${createForm.server_id}/network`, createForm);
      toast.success('Network config saved');
      setShowCreate(false);
      setCreateForm(emptyNet);
      fetchNetworkData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save network config');
    } finally { setCreating(false); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editForm.server_id) { 
      toast.error('No server selected');
      return; 
    }
    setEditing(true);
    try {
      await api.put(`/servers/${editForm.server_id}/network`, editForm);
      toast.success('Network config updated');
      setShowEdit(false);
      fetchNetworkData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update network config');
    } finally { setEditing(false); }
  }

  function openEdit(row) {
    setEditForm({
      server_id: String(row.server_id),
      ip_address: row.ip_address || '', secondary_ip: row.secondary_ip || '',
      ipv6: row.ipv6 || '', subnet: row.subnet || '', vlan: row.vlan || '',
      gateway: row.gateway || '', dns_primary: row.dns_primary || '',
      dns_secondary: row.dns_secondary || '', network_type: row.network_type || '',
      bandwidth: row.bandwidth || '',
      firewall_enabled: !!row.firewall_enabled, nat_enabled: !!row.nat_enabled,
    });
    setShowEdit(true);
  }

  return (
    <div className="space-y-6 animate-in">
      <ServerContextBanner />
      <div className="page-header">
        <div>
          <h1 className="page-title">Server Network</h1>
          <p className="page-subtitle">IP configuration, VLAN, and network settings by server</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/servers" className="btn-secondary flex-shrink-0">
            <Server className="w-4 h-4" /> All servers
          </Link>
          <button type="button" onClick={() => { setCreateForm(emptyNet); setShowCreate(true); }} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> Add Network
          </button>
        </div>
      </div>

      <NetForm
        open={showCreate}
        form={createForm} set={setC} onSubmit={handleCreate} submitting={creating}
        submitLabel="Save Network" onClose={() => { setShowCreate(false); setCreateForm(emptyNet); }}
        title="Add Network Configuration" description="Assign network settings to a server." isCreate
        servers={servers} // FIX 3: Pass servers data as a prop now
      />
      <NetForm
        open={showEdit}
        form={editForm} set={setE} onSubmit={handleEdit} submitting={editing}
        submitLabel="Update Network" onClose={() => setShowEdit(false)}
        title="Edit Network Configuration" description="Update network settings for this server." isCreate={false}
        servers={servers} 
      />

      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Clear network config" description="All network data for this server will be reset." danger>
        <div className="dialog-body">
          <p className="text-sm text-[var(--text-secondary)]">Clear network data for <span className="font-mono font-semibold text-[var(--text-primary)]">{deleteTarget?.server_code}</span>?</p>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="dialog-btn-cancel">Cancel</button>
          <button
            type="button" disabled={deleting} className="dialog-btn-danger"
            onClick={async () => {
              setDeleting(true);
              try {
                await api.put(`/servers/${deleteTarget.server_id}/network`, {
                  ip_address: null, secondary_ip: null, ipv6: null, subnet: null,
                  vlan: null, gateway: null, dns_primary: null, dns_secondary: null,
                  network_type: null, bandwidth: null, firewall_enabled: false, nat_enabled: false,
                });
                toast.success('Network data cleared');
                setDeleteTarget(null); 
                fetchNetworkData();
              } catch (err) {
                toast.error(err.response?.data?.error || 'Failed to clear');
              } finally { setDeleting(false); }
            }}
          >
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Clearing…</> : 'Clear Network'}
          </button>
        </div>
      </Modal>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="text" placeholder="Search by server, IP, type…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{filteredList.length} record{filteredList.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="table-container overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" /></div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Server</th>
                  <th>Primary IP</th>
                  <th>Subnet / VLAN</th>
                  <th>Gateway / DNS</th>
                  <th>Type / Bandwidth</th>
                  <th>Flags</th>
                  <th className="text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <div className="state-empty inline-flex flex-col">
                        <Globe className="w-10 h-10 text-[var(--text-muted)] mb-2" />
                        {list.length === 0 ? 'No network records. Add one to get started.' : 'No matches for your search.'}
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
                      <td className="font-mono text-sm">{row.ip_address || <span className="text-[var(--text-muted)]">—</span>}</td>
                      <td className="text-sm text-[var(--text-secondary)]">
                        {row.subnet || row.vlan ? (
                          <span>{row.subnet || '—'}{row.vlan && <span className="badge-blue text-[10px] ml-1">VLAN {row.vlan}</span>}</span>
                        ) : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="text-sm text-[var(--text-secondary)]">
                        {row.gateway ? <span className="block">{row.gateway}</span> : null}
                        {row.dns_primary ? <span className="text-xs text-[var(--text-muted)]">DNS: {row.dns_primary}</span> : null}
                        {!row.gateway && !row.dns_primary && <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="text-sm text-[var(--text-secondary)]">
                        {row.network_type || row.bandwidth ? (
                          <span className="inline-flex items-center gap-1">
                            <Network className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            {[row.network_type, row.bandwidth].filter(Boolean).join(' · ')}
                          </span>
                        ) : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="text-sm">
                        <div className="flex items-center gap-1">
                          {row.firewall_enabled ? <span className="badge-green text-[10px]"><Shield className="w-3 h-3 mr-0.5" />FW</span> : null}
                          {row.nat_enabled ? <span className="badge-blue text-[10px]">NAT</span> : null}
                          {!row.firewall_enabled && !row.nat_enabled && <span className="text-[var(--text-muted)]">—</span>}
                        </div>
                      </td>
                      <td className="text-right">
                        <RowActions items={[
                          { label: 'View Server', icon: <Eye className="w-4 h-4" />, onClick: () => { window.location.href = `/servers/${row.server_id}`; } },
                          { label: 'Edit Network', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(row) },
                          { type: 'divider' },
                          { label: 'Clear Network', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => setDeleteTarget(row) },
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