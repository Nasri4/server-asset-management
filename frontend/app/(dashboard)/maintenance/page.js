'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { formatDate, formatDateTime, getStatusColor } from '../../../lib/utils';
import Link from 'next/link';
import { Wrench, Plus, Loader2, X, Pencil, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import ServerContextBanner from '../../../components/ui/ServerContextBanner';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

export default function MaintenancePage() {
  const searchParams = useSearchParams();
  const serverIdFromUrl = searchParams.get('server_id');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', upcoming: false, overdue: false });
  const [viewTab, setViewTab] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [servers, setServers] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const MAINTENANCE_CHECKLIST_OPTIONS = [
  'OS Update', 'Security Patch', 'Backup Verification', 'Disk Cleanup',
  'Service Restart', 'Hardware Inspection', 'Network Check', 'Custom Tasks',
];
const RECURRENCE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Daily', label: 'Daily', interval: 1 },
  { value: 'Weekly', label: 'Weekly', interval: 7 },
  { value: 'Monthly', label: 'Monthly', interval: 30 },
  { value: 'Quarterly', label: 'Quarterly', interval: 90 },
  { value: 'Yearly', label: 'Yearly', interval: 365 },
];

  const [form, setForm] = useState({
    server_id: '', maintenance_type: 'Preventive', title: '', description: '',
    scheduled_date: '', scheduled_end: '', priority: 'Medium', assigned_engineer_id: '',
    notify_team: true, notify_engineer: true,
    recurrence_type: '', recurrence_interval: '',
    checklist_tasks: MAINTENANCE_CHECKLIST_OPTIONS.reduce((acc, t) => ({ ...acc, [t]: false }), {}),
  });
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => { loadMaintenance(); }, [filter]);

  useEffect(() => {
    if (serverIdFromUrl) {
      loadDropdowns().then(() => {
        setForm((f) => ({ ...f, server_id: serverIdFromUrl }));
        setShowForm(true);
      });
    }
  }, [serverIdFromUrl]);

  async function loadMaintenance() {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.upcoming) params.upcoming = 'true';
      if (filter.overdue) params.overdue = 'true';
      const res = await api.get('/maintenance', { params });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load maintenance');
    } finally {
      setLoading(false);
    }
  }

  async function loadDropdowns() {
    try {
      const [s, e] = await Promise.all([api.get('/servers', { params: { page_size: 200 } }), api.get('/engineers')]);
      setServers(Array.isArray(s.data?.servers) ? s.data.servers : []);
      setEngineers(Array.isArray(e.data) ? e.data : []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load dropdowns');
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const recurrence = RECURRENCE_OPTIONS.find(r => r.value === form.recurrence_type);
      const checklistPayload = Object.entries(form.checklist_tasks || {}).map(([task, done]) => ({ task, done }));
      await api.post('/maintenance', {
        server_id: parseInt(form.server_id),
        maintenance_type: form.maintenance_type,
        title: form.title,
        description: form.description,
        scheduled_date: form.scheduled_date,
        scheduled_end: form.scheduled_end || null,
        priority: form.priority,
        assigned_engineer_id: form.assigned_engineer_id ? parseInt(form.assigned_engineer_id) : null,
        notify_team: form.notify_team,
        notify_engineer: form.notify_engineer,
        recurrence_type: form.recurrence_type || undefined,
        recurrence_interval: recurrence?.interval ?? (form.recurrence_interval || undefined),
        checklist_tasks: checklistPayload.length ? checklistPayload : undefined,
      });
      toast.success('Maintenance scheduled. SMS notifications sent.');
      setShowForm(false);
      setForm({ server_id: '', maintenance_type: 'Preventive', title: '', description: '', scheduled_date: '', scheduled_end: '', priority: 'Medium', assigned_engineer_id: '', notify_team: true, notify_engineer: true, recurrence_type: '', recurrence_interval: '', checklist_tasks: MAINTENANCE_CHECKLIST_OPTIONS.reduce((acc, t) => ({ ...acc, [t]: false }), {}) });
      loadMaintenance();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    try {
      await api.put(`/maintenance/${editItem.maintenance_id}`, { ...editForm, assigned_engineer_id: editForm.assigned_engineer_id ? parseInt(editForm.assigned_engineer_id) : null });
      toast.success('Maintenance updated');
      setEditItem(null);
      loadMaintenance();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  }

  function openEdit(m) {
    setEditItem(m);
    const sd = m.scheduled_date ? new Date(m.scheduled_date).toISOString().slice(0, 16) : '';
    const se = m.scheduled_end ? new Date(m.scheduled_end).toISOString().slice(0, 16) : '';
    setEditForm({ status: m.status, priority: m.priority, assigned_engineer_id: m.assigned_engineer_id || '', scheduled_date: sd, scheduled_end: se, completion_notes: m.completion_notes || '' });
  }

  const activeItems = items.filter(m => !['Completed', 'Failed', 'Cancelled'].includes(m.status));
  const historyItems = items.filter(m => ['Completed', 'Failed', 'Cancelled'].includes(m.status));
  const displayItems = viewTab === 'active' ? activeItems : historyItems;

  async function handleComplete(m) {
    try {
      await api.put(`/maintenance/${m.maintenance_id}`, { status: 'Completed', completion_notes: `Completed on ${new Date().toLocaleDateString()}` });
      toast.success('Maintenance marked as completed');
      loadMaintenance();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to complete'); }
  }

  return (
    <div className="space-y-6 animate-in">
      <ServerContextBanner />
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance</h1>
          <p className="page-subtitle">Schedule and track server maintenance</p>
        </div>
        <button type="button" onClick={() => { setShowForm(true); loadDropdowns(); }} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" /> Schedule Maintenance
        </button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Schedule maintenance" description="Create a maintenance record and optionally notify the team." size="wide">
        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section">
              <span className="dialog-section-title">Details</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Server *</label><select required className="select-field" value={form.server_id} onChange={e => setForm(f => ({...f, server_id: e.target.value}))}><option value="">Select server</option>{servers.map(s => <option key={s.server_id} value={s.server_id}>{s.server_code}</option>)}</select></div>
                <div><label className="label">Title *</label><input required className="input-field" placeholder="e.g. Monthly patch" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} /></div>
                <div><label className="label">Type</label><select className="select-field" value={form.maintenance_type} onChange={e => setForm(f => ({...f, maintenance_type: e.target.value}))}><option>Preventive</option><option>Corrective</option><option>Emergency</option><option>Firmware Update</option><option>Hardware Replacement</option></select></div>
                <div><label className="label">Priority</label><select className="select-field" value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></div>
                <div><label className="label">Assign engineer</label><select className="select-field" value={form.assigned_engineer_id} onChange={e => setForm(f => ({...f, assigned_engineer_id: e.target.value}))}><option value="">Select engineer</option>{engineers.map(eng => <option key={eng.engineer_id} value={eng.engineer_id}>{eng.full_name}</option>)}</select></div>
                <div><label className="label">Recurrence</label><select className="select-field" value={form.recurrence_type} onChange={e => setForm(f => ({...f, recurrence_type: e.target.value}))}>{RECURRENCE_OPTIONS.map(o => <option key={o.value || 'none'} value={o.value}>{o.label}</option>)}</select></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Schedule</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Scheduled date *</label><input required type="datetime-local" className="input-field" value={form.scheduled_date} onChange={e => setForm(f => ({...f, scheduled_date: e.target.value}))} /></div>
                <div><label className="label">Scheduled end</label><input type="datetime-local" className="input-field" value={form.scheduled_end} onChange={e => setForm(f => ({...f, scheduled_end: e.target.value}))} /></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Description</span>
              <textarea className="input-field h-20 resize-none" placeholder="Additional notes" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Task checklist</span>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {MAINTENANCE_CHECKLIST_OPTIONS.map(task => (
                  <label key={task} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.checklist_tasks?.[task] || false} onChange={e => setForm(f => ({...f, checklist_tasks: { ...f.checklist_tasks, [task]: e.target.checked }}))} className="w-4 h-4 rounded border-[var(--border-soft)]" />
                    <span className="text-sm text-[var(--text-secondary)]">{task}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Notifications</span>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.notify_team} onChange={e => setForm(f => ({...f, notify_team: e.target.checked}))} className="w-4 h-4 rounded" /><span className="text-sm text-[var(--text-secondary)]">SMS team</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.notify_engineer} onChange={e => setForm(f => ({...f, notify_engineer: e.target.checked}))} className="w-4 h-4 rounded" /><span className="text-sm text-[var(--text-secondary)]">SMS engineer</span></label>
              </div>
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setShowForm(false)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" className="dialog-btn-primary">Schedule &amp; notify</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit maintenance" description={editItem?.title || ''} size="wide">
        <form onSubmit={handleEdit} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section">
              <span className="dialog-section-title">Status &amp; assignment</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="label">Status</label><select className="select-field" value={editForm.status} onChange={e => setEditForm(f => ({...f, status: e.target.value}))}><option>Scheduled</option><option>Pending</option><option>In Progress</option><option>Completed</option><option>Failed</option><option>Cancelled</option></select></div>
                <div><label className="label">Priority</label><select className="select-field" value={editForm.priority} onChange={e => setEditForm(f => ({...f, priority: e.target.value}))}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></div>
                <div><label className="label">Assign engineer</label><select className="select-field" value={editForm.assigned_engineer_id} onChange={e => setEditForm(f => ({...f, assigned_engineer_id: e.target.value}))}><option value="">Select engineer</option>{engineers.map(eng => <option key={eng.engineer_id} value={eng.engineer_id}>{eng.full_name}</option>)}</select></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Schedule</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Scheduled date</label><input type="datetime-local" className="input-field" value={editForm.scheduled_date} onChange={e => setEditForm(f => ({...f, scheduled_date: e.target.value}))} /></div>
                <div><label className="label">Scheduled end</label><input type="datetime-local" className="input-field" value={editForm.scheduled_end} onChange={e => setEditForm(f => ({...f, scheduled_end: e.target.value}))} /></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Completion notes</span>
              <textarea className="input-field h-20 resize-none" placeholder="Notes after completion" value={editForm.completion_notes} onChange={e => setEditForm(f => ({...f, completion_notes: e.target.value}))} />
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setEditItem(null)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" className="dialog-btn-primary">Save changes</button>
          </div>
        </form>
      </Modal>

      <div className="tab-bar mb-0 rounded-t-xl overflow-hidden">
        <button type="button" onClick={() => setViewTab('active')} className={`tab-item ${viewTab === 'active' ? 'tab-item-active' : ''}`}>
          <Clock className="w-3.5 h-3.5" /> Active <span className="tab-count">{activeItems.length}</span>
        </button>
        <button type="button" onClick={() => setViewTab('history')} className={`tab-item ${viewTab === 'history' ? 'tab-item-active' : ''}`}>
          <CheckCircle className="w-3.5 h-3.5" /> History <span className="tab-count">{historyItems.length}</span>
        </button>
      </div>

      <div className="table-wrapper" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <div className="table-toolbar flex-wrap">
          <div className="flex flex-wrap items-center gap-2">
            <select className="select-field w-40" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">All status</option>
              <option>Scheduled</option><option>Pending</option><option>In Progress</option><option>Completed</option><option>Cancelled</option>
            </select>
            {viewTab === 'active' && (
              <>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={filter.upcoming} onChange={e => setFilter(f => ({ ...f, upcoming: e.target.checked }))} className="rounded border-[var(--border)]" />
                  Upcoming
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={filter.overdue} onChange={e => setFilter(f => ({ ...f, overdue: e.target.checked }))} className="rounded border-[var(--border)]" />
                  Overdue
                </label>
              </>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)]">{displayItems.length} record{displayItems.length !== 1 ? 's' : ''}</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" /></div>
        ) : (
          <div className="table-container overflow-x-auto" style={{ borderRadius: 0 }}>
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th>Title</th><th>Server</th><th>Type</th><th>Priority</th><th>Status</th><th>Engineer</th><th>Scheduled</th>
                  <th className="text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12"><div className="state-empty inline-flex">{viewTab === 'active' ? 'No active maintenance. Schedule one to get started.' : 'No completed maintenance records yet.'}</div></td></tr>
                ) : displayItems.map((m) => (
                  <tr key={m.maintenance_id} className={m.status === 'Scheduled' && new Date(m.scheduled_date) < new Date() ? 'bg-[var(--danger-soft)]' : ''}>
                    <td className="font-medium text-[var(--text-primary)]">{m.title}</td>
                    <td className="font-mono text-sm">{m.server_id ? <Link href={'/servers/' + m.server_id} className="text-[var(--primary)] hover:underline">{m.server_code}</Link> : m.server_code}</td>
                    <td className="text-sm">{m.maintenance_type}</td>
                    <td><span className={getStatusColor(m.priority)}>{m.priority}</span></td>
                    <td><span className={getStatusColor(m.status)}>{m.status}</span></td>
                    <td className="text-sm">{m.engineer_name || '—'}</td>
                    <td className="text-sm">{formatDateTime(m.scheduled_date)}</td>
                    <td className="text-right">
                      <RowActions items={[
                        ...(viewTab === 'active' ? [
                          { label: 'Complete', icon: <CheckCircle className="w-4 h-4" />, onClick: () => handleComplete(m) },
                        ] : []),
                        { label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => { loadDropdowns(); openEdit(m); } },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
