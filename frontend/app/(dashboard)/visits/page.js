'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { formatDateTime } from '../../../lib/utils';
import {
  Loader2, Plus, X, Pencil, Trash2, CalendarCheck, Server,
  UserCircle, Search, AlertCircle, ExternalLink, Eye, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

const VISIT_TYPES = ['Inspection', 'Maintenance', 'Audit', 'Installation', 'Troubleshooting', 'Other'];

const emptyForm = {
  server_id: '',
  engineer_id: '',
  visit_date: '',
  visit_type: 'Inspection',
  purpose: '',
  findings: '',
  actions_taken: '',
};

function VisitsPageInner() {
  const searchParams = useSearchParams();
  const serverContext = searchParams.get('server_id');

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [servers, setServers] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [contextServer, setContextServer] = useState(null);

  // Load server context if navigated from a server
  useEffect(() => {
    if (serverContext) {
      api.get('/servers/' + serverContext)
        .then((r) => setContextServer(r.data?.server || null))
        .catch(() => setContextServer(null));
    }
  }, [serverContext]);

  function load() {
    setLoading(true);
    const params = serverContext ? { server_id: serverContext } : {};
    api.get('/visits', { params })
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load visits');
        setList([]);
      })
      .finally(() => setLoading(false));
  }

  function loadDropdowns() {
    Promise.all([
      api.get('/servers', { params: { page_size: 500 } }),
      api.get('/engineers'),
    ])
      .then(([s, e]) => {
        setServers(Array.isArray(s.data?.servers) ? s.data.servers : []);
        setEngineers(Array.isArray(e.data) ? e.data : []);
      })
      .catch(() => toast.error('Failed to load servers or engineers'));
  }

  useEffect(() => { load(); }, [serverContext]);

  useEffect(() => {
    if (showCreate || showEdit) loadDropdowns();
  }, [showCreate, showEdit]);

  // Pre-select server when in context
  useEffect(() => {
    if (showCreate && serverContext) {
      setCreateForm((f) => ({ ...f, server_id: serverContext }));
    }
  }, [showCreate, serverContext]);

  const filteredList = !search.trim()
    ? list
    : list.filter(
        (v) =>
          (v.server_code || '').toLowerCase().includes(search.toLowerCase()) ||
          (v.hostname || '').toLowerCase().includes(search.toLowerCase()) ||
          (v.engineer_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (v.visit_type || '').toLowerCase().includes(search.toLowerCase())
      );

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.server_id || !createForm.engineer_id || !createForm.visit_date) {
      toast.error('Server, engineer, and visit date are required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/visits', {
        server_id: parseInt(createForm.server_id),
        engineer_id: parseInt(createForm.engineer_id),
        visit_date: createForm.visit_date,
        visit_type: createForm.visit_type,
        purpose: createForm.purpose,
        findings: createForm.findings,
        actions_taken: createForm.actions_taken,
      });
      toast.success('Visit registered');
      setShowCreate(false);
      setCreateForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create visit');
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    setUpdating(true);
    try {
      await api.put(`/visits/${editingId}`, {
        engineer_id: parseInt(editForm.engineer_id),
        visit_date: editForm.visit_date,
        visit_type: editForm.visit_type,
        purpose: editForm.purpose,
        findings: editForm.findings,
        actions_taken: editForm.actions_taken,
      });
      toast.success('Visit updated');
      setShowEdit(false);
      setEditingId(null);
      setEditForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update visit');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/visits/${deleteTarget.visit_id}`);
      toast.success('Visit deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete visit');
    } finally {
      setDeleting(false);
    }
  }

  function openEditModal(visit) {
    setEditingId(visit.visit_id);
    setEditForm({
      server_id: String(visit.server_id),
      engineer_id: String(visit.engineer_id),
      visit_date: visit.visit_date ? new Date(visit.visit_date).toISOString().slice(0, 10) : '',
      visit_type: visit.visit_type || 'Inspection',
      purpose: visit.purpose || '',
      findings: visit.findings || '',
      actions_taken: visit.actions_taken || '',
    });
    setShowEdit(true);
  }

  const VisitForm = ({ open, onClose, title, description, form, setForm, onSubmit, submitting, submitLabel, isEdit }) => (
    <Modal open={open} onClose={onClose} title={title} description={description} size="wide">
      <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="dialog-body">
          <div className="dialog-section">
            <span className="dialog-section-title">Visit details</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isEdit && (
                <div>
                  <label className="label">Server *</label>
                  <select required className="select-field" value={form.server_id} onChange={(e) => setForm((f) => ({ ...f, server_id: e.target.value }))}>
                    <option value="">Select server…</option>
                    {servers.map((s) => (
                      <option key={s.server_id} value={s.server_id}>{s.server_code}{s.hostname ? ` (${s.hostname})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Engineer *</label>
                <select required className="select-field" value={form.engineer_id} onChange={(e) => setForm((f) => ({ ...f, engineer_id: e.target.value }))}>
                  <option value="">Select engineer…</option>
                  {engineers.map((eng) => <option key={eng.engineer_id} value={eng.engineer_id}>{eng.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Visit date *</label>
                <input type="date" required className="input-field" value={form.visit_date} onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Visit type</label>
                <select className="select-field" value={form.visit_type} onChange={(e) => setForm((f) => ({ ...f, visit_type: e.target.value }))}>
                  {VISIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Purpose / Notes</label>
                <textarea className="input-field h-20 resize-none" placeholder="Purpose of visit, location, notes…" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="dialog-section">
            <span className="dialog-section-title">Outcome</span>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">Findings / Result</label>
                <textarea className="input-field h-20 resize-none" placeholder="What was found or accomplished" value={form.findings} onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))} />
              </div>
              <div>
                <label className="label">Actions taken</label>
                <input className="input-field" placeholder="Summary of actions performed" value={form.actions_taken} onChange={(e) => setForm((f) => ({ ...f, actions_taken: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={onClose} className="dialog-btn-cancel">Cancel</button>
          <button type="submit" disabled={submitting} className="dialog-btn-primary">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );

  return (
    <div className="space-y-6 animate-in">
      {/* Server context banner */}
      {contextServer && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 text-sm">
          <Link href={`/servers/${serverContext}`} className="flex items-center gap-1.5 text-[var(--primary)] font-medium hover:underline flex-shrink-0">
            <ArrowLeft className="w-4 h-4" /> Back to Server
          </Link>
          <span className="text-[var(--text-muted)]">|</span>
          <span className="text-[var(--text-secondary)]">
            Server context: <span className="font-mono font-semibold text-[var(--text-primary)]">{contextServer.server_code}</span>
            {contextServer.hostname && <span className="text-[var(--text-muted)]"> ({contextServer.hostname})</span>}
          </span>
          <Link href={`/servers/${serverContext}`} className="ml-auto flex items-center gap-1 text-[var(--primary)] hover:underline flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5" /> View Details
          </Link>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Server Visits</h1>
          <p className="page-subtitle">Track on-site and remote visits to servers</p>
        </div>
        <button type="button" onClick={() => { setCreateForm(emptyForm); setShowCreate(true); }} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" /> Register visit
        </button>
      </div>

      <VisitForm
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(emptyForm); }}
        title="Register visit"
        description="Record an on-site or remote server visit."
        form={createForm} setForm={setCreateForm}
        onSubmit={handleCreate} submitting={creating}
        submitLabel="Register visit"
        isEdit={false}
      />
      <VisitForm
        open={showEdit}
        onClose={() => { setShowEdit(false); setEditingId(null); setEditForm(emptyForm); }}
        title="Edit visit"
        description="Update visit details and outcome."
        form={editForm} setForm={setEditForm}
        onSubmit={handleEdit} submitting={updating}
        submitLabel="Save changes"
        isEdit={true}
      />

      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Delete visit" description="This action cannot be undone." danger>
        <div className="dialog-body">
          <p className="text-sm text-[var(--text-secondary)]">
            Delete the <span className="font-medium text-[var(--text-primary)]">{deleteTarget?.visit_type}</span> visit
            on <span className="font-medium text-[var(--text-primary)]">{formatDateTime(deleteTarget?.visit_date)}</span>
            {deleteTarget?.server_code && <> for server <span className="font-mono font-semibold">{deleteTarget.server_code}</span></>}?
          </p>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="dialog-btn-cancel">Cancel</button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="dialog-btn-danger">
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Delete visit'}
          </button>
        </div>
      </Modal>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="text" placeholder="Search by server, engineer, type…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{filteredList.length} visit{filteredList.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="table-container overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
            </div>
          ) : (
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Server</th>
                  <th>Engineer</th>
                  <th>Type</th>
                  <th>Purpose / Notes</th>
                  <th>Findings</th>
                  <th className="text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <div className="state-empty inline-flex flex-col">
                        <CalendarCheck className="w-10 h-10 text-[var(--text-muted)] mb-2" />
                        {list.length === 0 ? 'No visits yet. Register a visit to get started.' : 'No matches for your search.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredList.map((v) => (
                    <tr key={v.visit_id}>
                      <td className="text-sm text-[var(--text-primary)] whitespace-nowrap">{formatDateTime(v.visit_date)}</td>
                      <td>
                        <Link href={`/servers/${v.server_id}`} className="font-mono font-medium text-[var(--primary)] hover:underline inline-flex items-center gap-1">
                          <Server className="w-3.5 h-3.5" />{v.server_code}
                        </Link>
                        {v.hostname && <span className="text-xs text-[var(--text-muted)] block">{v.hostname}</span>}
                      </td>
                      <td className="text-sm text-[var(--text-primary)]">
                        <span className="inline-flex items-center gap-1">
                          <UserCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" />{v.engineer_name || '—'}
                        </span>
                      </td>
                      <td><span className="badge-blue">{v.visit_type || 'Inspection'}</span></td>
                      <td className="text-sm text-[var(--text-secondary)] max-w-[180px] truncate" title={v.purpose}>{v.purpose || '—'}</td>
                      <td className="text-sm text-[var(--text-secondary)] max-w-[160px] truncate" title={v.findings}>{v.findings || '—'}</td>
                      <td className="text-right">
                        <RowActions items={[
                          { label: 'View Server', icon: <Eye className="w-4 h-4" />, onClick: () => { window.location.href = `/servers/${v.server_id}`; } },
                          { label: 'Edit Visit', icon: <Pencil className="w-4 h-4" />, onClick: () => openEditModal(v) },
                          { type: 'divider' },
                          { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => setDeleteTarget(v) },
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

export default function VisitsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" /></div>}>
      <VisitsPageInner />
    </Suspense>
  );
}
