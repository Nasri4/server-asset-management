'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { formatDateTime, formatDate, getStatusColor } from '../../../lib/utils';
import { AlertTriangle, Plus, Loader2, X, Pencil, Clock, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ServerContextBanner from '../../../components/ui/ServerContextBanner';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

function slaStatus(sla_deadline, status) {
  if (!sla_deadline || ['Resolved', 'Closed'].includes(status)) return null;
  const deadline = new Date(sla_deadline);
  const now = new Date();
  if (deadline < now) return { label: 'Overdue', class: 'text-[var(--danger)]' };
  const hoursLeft = (deadline - now) / (1000 * 60 * 60);
  if (hoursLeft <= 2) return { label: formatDateTime(deadline), class: 'text-[var(--warning)]' };
  return { label: formatDateTime(deadline), class: 'text-[var(--text-secondary)]' };
}

export default function IncidentsPage() {
  const searchParams = useSearchParams();
  const serverIdFromUrl = searchParams.get('server_id');
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [showForm, setShowForm] = useState(false);
  const [servers, setServers] = useState([]);
  const [form, setForm] = useState({ server_id: serverIdFromUrl || '', incident_type: '', title: '', severity: 'Medium', description: '' });
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (serverIdFromUrl) {
      setForm((f) => ({ ...f, server_id: serverIdFromUrl }));
      setShowForm(true);
    }
  }, [serverIdFromUrl]);

  useEffect(() => { loadIncidents(); }, [filter]);

  async function loadIncidents() {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.severity) params.severity = filter.severity;
      const res = await api.get('/incidents', { params });
      setIncidents(res.data?.incidents ?? []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }

  async function loadServers() {
    try { const res = await api.get('/servers', { params: { page_size: 200 } }); setServers(Array.isArray(res.data?.servers) ? res.data.servers : []); } catch { setServers([]); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/incidents', { ...form, server_id: parseInt(form.server_id) });
      toast.success('Incident created');
      setShowForm(false);
      setForm({ server_id: serverIdFromUrl || '', incident_type: '', title: '', severity: 'Medium', description: '' });
      loadIncidents();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    try {
      await api.put(`/incidents/${editItem.incident_id}`, editForm);
      toast.success('Incident updated');
      setEditItem(null);
      loadIncidents();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  }

  function openEdit(i) {
    setEditItem(i);
    setEditForm({ status: i.status, severity: i.severity, root_cause: i.root_cause || '', resolution_notes: i.resolution_notes || '' });
  }

  return (
    <div className="space-y-6 animate-in">
      <ServerContextBanner />
      <div className="page-header">
        <div>
          <h1 className="page-title">Incidents</h1>
          <p className="page-subtitle">Incident management and tracking</p>
        </div>
        <button type="button" onClick={() => { setShowForm(true); loadServers(); }} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" /> New Incident
        </button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Report incident" description="Create a new incident for a server." size="wide">
        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section">
              <span className="dialog-section-title">Details</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Server *</label><select required className="select-field" value={form.server_id} onChange={e => setForm(f => ({...f, server_id: e.target.value}))}><option value="">Select server</option>{servers.map(s => <option key={s.server_id} value={s.server_id}>{s.server_code}{s.hostname ? ` — ${s.hostname}` : ''}</option>)}</select></div>
                <div><label className="label">Title *</label><input required className="input-field" placeholder="Short summary" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} /></div>
                <div><label className="label">Type</label><select className="select-field" value={form.incident_type} onChange={e => setForm(f => ({...f, incident_type: e.target.value}))}><option value="">Select type</option><option>Hardware</option><option>Network</option><option>Software</option><option>Security</option><option>Power</option><option>Other</option></select></div>
                <div><label className="label">Severity *</label><select required className="select-field" value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))}><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Description</span>
              <textarea className="input-field h-20 resize-none" placeholder="What happened?" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setShowForm(false)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" className="dialog-btn-primary">Create incident</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit incident" description={editItem?.title || ''}>
        <form onSubmit={handleEdit} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section">
              <span className="dialog-section-title">Status</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Status</label><select className="select-field" value={editForm.status} onChange={e => setEditForm(f => ({...f, status: e.target.value}))}><option>Open</option><option>Investigating</option><option>Resolved</option><option>Closed</option></select></div>
                <div><label className="label">Severity</label><select className="select-field" value={editForm.severity} onChange={e => setEditForm(f => ({...f, severity: e.target.value}))}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Resolution</span>
              <div className="space-y-4">
                <div><label className="label">Root cause</label><input className="input-field" placeholder="Identified cause" value={editForm.root_cause} onChange={e => setEditForm(f => ({...f, root_cause: e.target.value}))} /></div>
                <div><label className="label">Resolution notes</label><textarea className="input-field h-20 resize-none" placeholder="What was done to resolve" value={editForm.resolution_notes} onChange={e => setEditForm(f => ({...f, resolution_notes: e.target.value}))} /></div>
              </div>
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setEditItem(null)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" className="dialog-btn-primary">Save changes</button>
          </div>
        </form>
      </Modal>

      <div className="table-wrapper">
        <div className="table-toolbar flex-wrap">
          <div className="flex flex-wrap items-center gap-2">
            <select className="select-field w-40" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">All status</option><option>Open</option><option>Investigating</option><option>Resolved</option><option>Closed</option>
            </select>
            <select className="select-field w-40" value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}>
              <option value="">All severity</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{incidents.length} incident{incidents.length !== 1 ? 's' : ''}</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" /></div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Title</th><th>Server</th><th>Type</th><th>Severity</th><th>Status</th><th>SLA</th><th>Assigned to</th><th>Reported</th>
                  <th className="text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12"><div className="state-empty inline-flex">No incidents found. Report one from a server or here.</div></td></tr>
                ) : incidents.map((i) => {
                  const sla = slaStatus(i.sla_deadline, i.status);
                  return (
                    <tr key={i.incident_id}>
                      <td className="font-medium text-[var(--text-primary)]">{i.title}</td>
                      <td className="font-mono text-sm">{i.server_id ? <Link href={'/servers/' + i.server_id} className="text-[var(--primary)] hover:underline">{i.server_code}</Link> : i.server_code}</td>
                      <td className="text-sm">{i.incident_type || '—'}</td>
                      <td><span className={getStatusColor(i.severity)}>{i.severity}</span></td>
                      <td><span className={getStatusColor(i.status)}>{i.status}</span></td>
                      <td className="text-sm">{sla ? <span className={sla.class} title="SLA deadline">{sla.label}</span> : '—'}</td>
                      <td className="text-sm">{i.assigned_engineer || '—'}</td>
                      <td className="text-sm">{formatDateTime(i.reported_at)}</td>
                      <td className="text-right">
                        <RowActions items={[
                          { label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(i) },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
