'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { Loader2, Plus, Eye, Pencil, User, Mail, Phone, Briefcase, Search, Server, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

const emptyForm = { full_name: '', phone: '', email: '', employee_id: '', team_id: '', specialization: '' };

export default function EngineersPage() {
  const [list, setList] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [searchSubmit, setSearchSubmit] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  function load() {
    setLoading(true);
    const params = {};
    if (searchSubmit) params.search = searchSubmit;
    if (teamFilter) params.team_id = teamFilter;
    
    api.get('/engineers', { params })
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch((err) => { 
        toast.error(err.response?.data?.error || 'Failed to load'); 
        setList([]); 
      })
      .finally(() => setLoading(false));
  }
  
  useEffect(() => { load(); }, [searchSubmit, teamFilter]);
  
  useEffect(() => { 
    api.get('/teams')
      .then((r) => setTeams(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTeams([])); 
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchSubmit(search);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchSubmit('');
    setTeamFilter('');
  };

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/engineers', { ...createForm, team_id: createForm.team_id ? parseInt(createForm.team_id) : null });
      toast.success('Engineer created.');
      setShowCreate(false);
      setCreateForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create engineer.');
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    setUpdating(true);
    try {
      await api.put(`/engineers/${editingId}`, { ...editForm, team_id: editForm.team_id ? parseInt(editForm.team_id) : null });
      toast.success('Engineer updated.');
      setShowEdit(false);
      setEditingId(null);
      setEditForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update engineer.');
    } finally {
      setUpdating(false);
    }
  }

  function openEditModal(engineer) {
    setEditingId(engineer.engineer_id);
    setEditForm({
      full_name: engineer.full_name || '',
      phone: engineer.phone || '',
      email: engineer.email || '',
      employee_id: engineer.employee_id || '',
      team_id: engineer.team_id ? engineer.team_id.toString() : '',
      specialization: engineer.specialization || ''
    });
    setShowEdit(true);
  }

  const ModalBody = ({ form, setForm }) => (
    <>
      <div className="dialog-section">
        <span className="dialog-section-title">Identity</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">Full name *</label><input required className="input-field" placeholder="e.g. John Smith" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
          <div><label className="label">Employee ID</label><input className="input-field" placeholder="Optional" value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} /></div>
          <div className="md:col-span-2"><label className="label">Team</label><select className="select-field" value={form.team_id} onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}><option value="">Select team…</option>{teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name} {t.department_name ? `(${t.department_name})` : ''}</option>)}</select></div>
        </div>
      </div>
      <div className="dialog-section">
        <span className="dialog-section-title">Contact & role</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">Email</label><input type="email" className="input-field" placeholder="engineer@company.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">Phone</label><input className="input-field" placeholder="+1234567890" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
          <div className="md:col-span-2"><label className="label">Specialization</label><input className="input-field" placeholder="e.g. Network, Security" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} /></div>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Engineers</h1>
          <p className="page-subtitle">Manage engineers, assignments and teams</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" /> New engineer
        </button>
      </div>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateForm(emptyForm); }} title="New engineer" description="Add a new engineer to your organization." size="wide">
        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body"><ModalBody form={createForm} setForm={setCreateForm} /></div>
          <div className="dialog-footer">
            <button type="button" onClick={() => { setShowCreate(false); setCreateForm(emptyForm); }} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" disabled={creating} className="dialog-btn-primary">{creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Create engineer'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => { setShowEdit(false); setEditingId(null); setEditForm(emptyForm); }} title="Edit engineer" description="Update engineer details." size="wide">
        <form onSubmit={handleEdit} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body"><ModalBody form={editForm} setForm={setEditForm} /></div>
          <div className="dialog-footer">
            <button type="button" onClick={() => { setShowEdit(false); setEditingId(null); setEditForm(emptyForm); }} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" disabled={updating} className="dialog-btn-primary">{updating ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}</button>
          </div>
        </form>
      </Modal>

      <div className="table-wrapper">
        <div className="table-toolbar flex-wrap">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input type="text" placeholder="Search by name, phone, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
            </div>
            <button type="submit" className="btn-secondary">Search</button>
          </form>
          <div className="flex items-center gap-2">
            <select className="select-field w-44" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">All teams</option>
              {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name} {t.department_name ? `(${t.department_name})` : ''}</option>)}
            </select>
            {(searchSubmit || teamFilter) && <button type="button" onClick={clearFilters} className="btn-ghost text-sm">Clear</button>}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{list.length} engineer{list.length !== 1 ? 's' : ''}</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" /></div>
        ) : !list.length ? (
          <div className="py-12 px-6 text-center">
            <div className="state-empty inline-flex flex-col gap-3">
              <Users className="w-12 h-12 text-[var(--text-muted)]" />
              <p>{searchSubmit || teamFilter ? 'No engineers match your filters.' : 'No engineers yet. Create one to get started.'}</p>
              {!searchSubmit && !teamFilter && <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">New engineer</button>}
            </div>
          </div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th>Engineer</th><th>Contact</th><th>Team</th><th>Department</th><th className="text-center">Servers</th><th className="text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((eng) => (
                  <tr key={eng.engineer_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center"><User className="w-4 h-4 text-[var(--primary)]" /></div>
                        <Link href={'/engineers/' + eng.engineer_id} className="font-medium text-[var(--primary)] hover:underline">{eng.full_name}</Link>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-0.5 text-sm text-[var(--text-secondary)]">
                        {eng.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{eng.phone}</div>}
                        {eng.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{eng.email}</div>}
                        {!eng.phone && !eng.email && '—'}
                      </div>
                    </td>
                    <td>{eng.team_name ? <span className="badge-blue inline-flex items-center gap-1"><Briefcase className="w-3 h-3" />{eng.team_name}</span> : '—'}</td>
                    <td className="text-sm text-[var(--text-primary)]">{eng.department_name || '—'}</td>
                    <td className="text-center"><span className="badge-gray inline-flex items-center gap-1"><Server className="w-3 h-3" />{eng.assigned_servers ?? 0}</span></td>
                    <td className="text-right">
                      <RowActions items={[
                        { label: 'View Profile', icon: <Eye className="w-4 h-4" />, onClick: () => { window.location.href = '/engineers/' + eng.engineer_id; } },
                        { label: 'Edit Engineer', icon: <Pencil className="w-4 h-4" />, onClick: () => openEditModal(eng) },
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