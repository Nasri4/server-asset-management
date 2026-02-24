'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { Loader2, Plus, Eye, X, Pencil, Trash2, Server, Search, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import ServerContextBanner from '../../../components/ui/ServerContextBanner';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

const emptyForm = {
  app_name: '',
  app_type: '',
  version: '',
  environment: 'Development',
  criticality: 'Medium',
  sla_level: '',
  description: '',
  repository: '',
  owner: ''
};


export default function ApplicationsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState('');

  function load() {
    setLoading(true);
    api.get('/applications')
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load');
        setList([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filteredList = !search.trim()
    ? list
    : list.filter(
        (app) =>
          (app.app_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (app.app_type || '').toLowerCase().includes(search.toLowerCase()) ||
          (app.environment || '').toLowerCase().includes(search.toLowerCase())
      );

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/applications', createForm);
      toast.success('Application created');
      setShowCreate(false);
      setCreateForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    setUpdating(true);
    try {
      await api.put(`/applications/${editingId}`, editForm);
      toast.success('Application updated');
      setShowEdit(false);
      setEditingId(null);
      setEditForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/applications/${id}`);
      toast.success('Application deleted');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  }

  function openEditModal(app) {
    setEditingId(app.application_id);
    setEditForm({
      app_name: app.app_name || '',
      app_type: app.app_type || '',
      version: app.version || '',
      environment: app.environment || 'Development',
      criticality: app.criticality || 'Medium',
      sla_level: app.sla_level || '',
      description: app.description || '',
      repository: app.repository || '',
      owner: app.owner || ''
    });
    setShowEdit(true);
  }

  const badgeCriticality = (c) => {
    const map = { Critical: 'badge-red', High: 'badge-yellow', Medium: 'badge-blue', Low: 'badge-green' };
    return map[c] || 'badge-gray';
  };
  const badgeEnv = (env) => {
    const map = { Production: 'badge-green', Staging: 'badge-yellow', Development: 'badge-blue' };
    return map[env] || 'badge-gray';
  };

  const AppForm = ({ open, onClose, title, description, form, setForm, onSubmit, submitting, submitLabel }) => (
    <Modal open={open} onClose={onClose} title={title} description={description} size="wide">
      <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="dialog-body">
          <div className="dialog-section">
            <span className="dialog-section-title">Basic information</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Application name *</label><input required className="input-field" placeholder="e.g. Core API" value={form.app_name} onChange={(e) => setForm((f) => ({ ...f, app_name: e.target.value }))} /></div>
              <div><label className="label">Type</label><input className="input-field" placeholder="e.g. Web, API" value={form.app_type} onChange={(e) => setForm((f) => ({ ...f, app_type: e.target.value }))} /></div>
              <div><label className="label">Version</label><input className="input-field" placeholder="1.0.0" value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} /></div>
              <div><label className="label">Environment</label><select className="select-field" value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}><option value="Development">Development</option><option value="Staging">Staging</option><option value="Production">Production</option></select></div>
            </div>
          </div>
          <div className="dialog-section">
            <span className="dialog-section-title">Configuration</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Criticality</label><select className="select-field" value={form.criticality} onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
              <div><label className="label">SLA level</label><input className="input-field" placeholder="24/7" value={form.sla_level} onChange={(e) => setForm((f) => ({ ...f, sla_level: e.target.value }))} /></div>
              <div><label className="label">Owner</label><input className="input-field" placeholder="Team or person" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} /></div>
              <div><label className="label">Repository</label><input className="input-field" placeholder="Git URL" value={form.repository} onChange={(e) => setForm((f) => ({ ...f, repository: e.target.value }))} /></div>
            </div>
          </div>
          <div className="dialog-section">
            <label className="label">Description</label>
            <textarea className="input-field h-20 resize-none" placeholder="Brief description of the application" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={onClose} className="dialog-btn-cancel">Cancel</button>
          <button type="submit" disabled={submitting} className="dialog-btn-primary">{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );

  return (
    <div className="space-y-6 animate-in">
      <ServerContextBanner />
      <div className="page-header">
        <div>
          <h1 className="page-title">Applications</h1>
          <p className="page-subtitle">Manage and monitor applications across servers</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" /> Create application
        </button>
      </div>

      <AppForm open={showCreate} onClose={() => { setShowCreate(false); setCreateForm(emptyForm); }} title="Create application" description="Register a new application in the system." form={createForm} setForm={setCreateForm} onSubmit={handleCreate} submitting={creating} submitLabel="Create application" />
      <AppForm open={showEdit} onClose={() => { setShowEdit(false); setEditingId(null); setEditForm(emptyForm); }} title="Edit application" description="Update application details." form={editForm} setForm={setEditForm} onSubmit={handleEdit} submitting={updating} submitLabel="Save changes" />

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete application" description="This action cannot be undone." danger>
        <div className="dialog-body">
          <p className="text-sm text-[var(--text-secondary)]">Are you sure you want to delete this application? This action is permanent and cannot be reversed.</p>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={() => setDeleteConfirm(null)} className="dialog-btn-cancel">Cancel</button>
          <button type="button" onClick={() => handleDelete(deleteConfirm)} className="dialog-btn-danger">Delete</button>
        </div>
      </Modal>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="text" placeholder="Search by name, type, environment…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{filteredList.length} application{filteredList.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="table-container overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
            </div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Environment</th>
                  <th>Criticality</th>
                  <th>Servers</th>
                  <th className="text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <div className="state-empty inline-flex">
                        {list.length === 0 ? 'No applications yet. Create one to get started.' : 'No matches for your search.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredList.map((app) => (
                    <tr key={app.application_id}>
                      <td>
                        <Link href={`/applications/${app.application_id}`} className="font-medium text-[var(--primary)] hover:underline">
                          {app.app_name}
                        </Link>
                      </td>
                      <td className="text-sm text-[var(--text-primary)]">{app.app_type || '—'}</td>
                      <td><span className="text-sm font-mono badge-gray">{app.version || '—'}</span></td>
                      <td><span className={badgeEnv(app.environment)}>{app.environment || '—'}</span></td>
                      <td><span className={badgeCriticality(app.criticality)}>{app.criticality || '—'}</span></td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                          <Server className="w-4 h-4" />
                          {app.server_count ?? 0}
                        </span>
                      </td>
                      <td className="text-right">
                        <RowActions items={[
                          { label: 'View', icon: <Eye className="w-4 h-4" />, onClick: () => { window.location.href = `/applications/${app.application_id}`; } },
                          { label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => openEditModal(app) },
                          { type: 'divider' },
                          { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => setDeleteConfirm(app.application_id) },
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
