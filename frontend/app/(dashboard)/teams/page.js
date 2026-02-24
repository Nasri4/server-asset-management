'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { 
  Loader2, Plus, Eye, Pencil, X, Building2, Users, 
  Phone, Mail, User, Server, ChevronRight, Edit, Trash2,
  AlertCircle, CheckCircle, Clock, Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

const emptyDept = { 
  department_name: '', 
  description: '', 
  head_name: '', 
  head_email: '', 
  head_phone: '' 
};

const emptyTeam = { 
  team_name: '', 
  department_id: '', 
  description: '', 
  oncall_phone: '', 
  oncall_email: '' 
};

export default function TeamsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(true);
  
  // Department state
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [createDeptForm, setCreateDeptForm] = useState(emptyDept);
  const [creatingDept, setCreatingDept] = useState(false);
  const [editDeptId, setEditDeptId] = useState(null);
  const [editDeptForm, setEditDeptForm] = useState(emptyDept);
  const [savingDept, setSavingDept] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);

  // Team state
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [createTeamForm, setCreateTeamForm] = useState(emptyTeam);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [editTeamId, setEditTeamId] = useState(null);
  const [editTeamForm, setEditTeamForm] = useState(emptyTeam);
  const [updatingTeam, setUpdatingTeam] = useState(false);

  function loadTeams() {
    setLoadingTeams(true);
    api.get('/teams')
      .then((r) => setTeams(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
  }
  
  function loadDepts() {
    setLoadingDepts(true);
    api.get('/departments')
      .then((r) => setDepartments(Array.isArray(r.data) ? r.data : []))
      .catch(() => setDepartments([]))
      .finally(() => setLoadingDepts(false));
  }
  
  useEffect(() => { 
    loadTeams(); 
    loadDepts(); 
  }, []);

  // Department functions
  async function handleCreateDept(e) {
    e.preventDefault();
    setCreatingDept(true);
    try {
      await api.post('/departments', createDeptForm);
      toast.success('Department created successfully');
      setShowCreateDept(false);
      setCreateDeptForm(emptyDept);
      loadDepts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create department');
    } finally {
      setCreatingDept(false);
    }
  }

  async function handleEditDept(e) {
    e.preventDefault();
    if (!editDeptId) return;
    setSavingDept(true);
    try {
      await api.put('/departments/' + editDeptId, editDeptForm);
      toast.success('Department updated successfully');
      setEditDeptId(null);
      loadDepts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update department');
    } finally {
      setSavingDept(false);
    }
  }

  async function handleDeleteDept(id) {
    try {
      await api.delete('/departments/' + id);
      toast.success('Department deleted successfully');
      setDeleteConfirm(null);
      loadDepts();
      if (selectedDept?.department_id === id) {
        setSelectedDept(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete department');
    }
  }

  // Team functions
  async function handleCreateTeam(e) {
    e.preventDefault();
    setCreatingTeam(true);
    try {
      await api.post('/teams', {
        ...createTeamForm,
        department_id: createTeamForm.department_id ? parseInt(createTeamForm.department_id) : null
      });
      toast.success('Team created successfully');
      setShowCreateTeam(false);
      setCreateTeamForm(emptyTeam);
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create team');
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleEditTeam(e) {
    e.preventDefault();
    if (!editTeamId) return;
    setUpdatingTeam(true);
    try {
      await api.put('/teams/' + editTeamId, {
        ...editTeamForm,
        department_id: editTeamForm.department_id ? parseInt(editTeamForm.department_id) : null
      });
      toast.success('Team updated successfully');
      setEditTeamId(null);
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update team');
    } finally {
      setUpdatingTeam(false);
    }
  }

  function openEditDept(d) {
    setEditDeptId(d.department_id);
    setEditDeptForm({
      department_name: d.department_name || '',
      description: d.description || '',
      head_name: d.head_name || '',
      head_email: d.head_email || '',
      head_phone: d.head_phone || ''
    });
  }

  function openEditTeam(t) {
    setEditTeamId(t.team_id);
    setEditTeamForm({
      team_name: t.team_name || '',
      department_id: t.department_id || '',
      description: t.description || '',
      oncall_phone: t.oncall_phone || '',
      oncall_email: t.oncall_email || ''
    });
  }

  function viewDepartment(deptId) {
    router.push(`/departments/${deptId}`);
  }

  function viewTeam(teamId) {
    router.push(`/teams/${teamId}`);
  }

  const DepartmentCard = ({ dept }) => {
    const teamCount = teams.filter(t => t.department_id === dept.department_id).length;
    const deptTeams = teams.filter(t => t.department_id === dept.department_id);

    return (
      <div
        className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => viewDepartment(dept.department_id)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[var(--primary-soft)]"><Building2 className="w-4 h-4 text-[var(--primary)]" /></div>
            <div>
              <h3 className="font-medium text-sm text-[var(--text-primary)]">{dept.department_name}</h3>
              <p className="text-xs text-[var(--text-muted)]">ID: {dept.department_id}</p>
            </div>
          </div>
          <span className="badge-blue">{teamCount} teams</span>
        </div>
        {dept.description && <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{dept.description}</p>}
        <div className="flex gap-3 mb-3">
          <div className="flex-1 rounded-lg p-2 bg-[var(--section-bg)]">
            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]"><Users className="w-3 h-3" /> Teams</div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{teamCount}</p>
          </div>
          <div className="flex-1 rounded-lg p-2 bg-[var(--section-bg)]">
            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]"><Server className="w-3 h-3" /> Servers</div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{dept.server_count || 0}</p>
          </div>
        </div>
        {(dept.head_name || dept.head_email) && (
          <div className="border-t border-[var(--border)] pt-2 mb-2">
            <h4 className="text-xs font-medium text-[var(--text-muted)] mb-1">Head</h4>
            <div className="space-y-0.5">
              {dept.head_name && <div className="flex items-center gap-1 text-xs text-[var(--text-primary)]"><User className="w-3 h-3" />{dept.head_name}</div>}
              {dept.head_email && <div className="flex items-center gap-1 text-xs text-[var(--primary)]"><Mail className="w-3 h-3" />{dept.head_email}</div>}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); openEditDept(dept); }} className="btn-ghost p-1.5 rounded" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(dept.department_id); }} className="btn-ghost p-1.5 rounded text-[var(--danger)] hover:bg-[var(--danger-soft)]" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); viewDepartment(dept.department_id); }} className="flex items-center gap-0.5 text-xs font-medium text-[var(--primary)] hover:underline">View <ChevronRight className="w-3 h-3" /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Teams & Departments</h1>
          <p className="page-subtitle">Manage your organization structure</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={() => setShowCreateDept(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New department
          </button>
          <button type="button" onClick={() => setShowCreateTeam(true)} className="btn-secondary">
            <Plus className="w-4 h-4" /> New team
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <Modal open={showCreateDept} onClose={() => setShowCreateDept(false)} title="Create department" description="Add a new department to your organization.">
          <form onSubmit={handleCreateDept} className="flex flex-col flex-1 min-h-0">
            <div className="dialog-body">
              <div className="dialog-section"><span className="dialog-section-title">Identity</span><div className="space-y-4"><div><label className="label">Department name *</label><input required className="input-field" placeholder="e.g. Engineering" value={createDeptForm.department_name} onChange={(e) => setCreateDeptForm(f => ({ ...f, department_name: e.target.value }))} /></div><div><label className="label">Description</label><textarea rows={3} className="input-field resize-none" placeholder="Brief description" value={createDeptForm.description} onChange={(e) => setCreateDeptForm(f => ({ ...f, description: e.target.value }))} /></div></div></div>
              <div className="dialog-section"><span className="dialog-section-title">Department head (optional)</span><div className="space-y-4"><div><label className="label">Full name</label><input className="input-field" placeholder="Full name" value={createDeptForm.head_name} onChange={(e) => setCreateDeptForm(f => ({ ...f, head_name: e.target.value }))} /></div><div><label className="label">Email</label><input type="email" className="input-field" placeholder="email@example.com" value={createDeptForm.head_email} onChange={(e) => setCreateDeptForm(f => ({ ...f, head_email: e.target.value }))} /></div><div><label className="label">Phone</label><input className="input-field" placeholder="Phone" value={createDeptForm.head_phone} onChange={(e) => setCreateDeptForm(f => ({ ...f, head_phone: e.target.value }))} /></div></div></div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={() => setShowCreateDept(false)} className="dialog-btn-cancel">Cancel</button>
              <button type="submit" disabled={creatingDept} className="dialog-btn-primary">{creatingDept ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create department'}</button>
            </div>
          </form>
        </Modal>

        <Modal open={showCreateTeam} onClose={() => setShowCreateTeam(false)} title="Create team" description="Add a new team and link it to a department.">
          <form onSubmit={handleCreateTeam} className="flex flex-col flex-1 min-h-0">
            <div className="dialog-body">
              <div className="dialog-section"><span className="dialog-section-title">Identity</span><div className="space-y-4"><div><label className="label">Team name *</label><input required className="input-field" placeholder="e.g. Backend Team" value={createTeamForm.team_name} onChange={(e) => setCreateTeamForm(f => ({ ...f, team_name: e.target.value }))} /></div><div><label className="label">Department</label><select className="select-field" value={createTeamForm.department_id} onChange={(e) => setCreateTeamForm(f => ({ ...f, department_id: e.target.value }))}><option value="">Select department</option>{departments.map((dept) => <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>)}</select></div><div><label className="label">Description</label><textarea rows={3} className="input-field resize-none" placeholder="Brief description" value={createTeamForm.description} onChange={(e) => setCreateTeamForm(f => ({ ...f, description: e.target.value }))} /></div></div></div>
              <div className="dialog-section"><span className="dialog-section-title">On-call contact (optional)</span><div className="grid grid-cols-1 gap-4"><div><label className="label">Phone</label><input className="input-field" placeholder="Phone" value={createTeamForm.oncall_phone} onChange={(e) => setCreateTeamForm(f => ({ ...f, oncall_phone: e.target.value }))} /></div><div><label className="label">Email</label><input type="email" className="input-field" placeholder="oncall@example.com" value={createTeamForm.oncall_email} onChange={(e) => setCreateTeamForm(f => ({ ...f, oncall_email: e.target.value }))} /></div></div></div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={() => setShowCreateTeam(false)} className="dialog-btn-cancel">Cancel</button>
              <button type="submit" disabled={creatingTeam} className="dialog-btn-primary">{creatingTeam ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create team'}</button>
            </div>
          </form>
        </Modal>

        <Modal open={!!editDeptId} onClose={() => setEditDeptId(null)} title="Edit department" description="Update department details.">
          <form onSubmit={handleEditDept} className="flex flex-col flex-1 min-h-0">
            <div className="dialog-body">
              <div className="dialog-section"><span className="dialog-section-title">Identity</span><div className="space-y-4"><div><label className="label">Department name *</label><input required className="input-field" value={editDeptForm.department_name} onChange={(e) => setEditDeptForm(f => ({ ...f, department_name: e.target.value }))} /></div><div><label className="label">Description</label><textarea rows={3} className="input-field resize-none" value={editDeptForm.description} onChange={(e) => setEditDeptForm(f => ({ ...f, description: e.target.value }))} /></div></div></div>
              <div className="dialog-section"><span className="dialog-section-title">Department head</span><div className="space-y-4"><div><label className="label">Full name</label><input className="input-field" value={editDeptForm.head_name} onChange={(e) => setEditDeptForm(f => ({ ...f, head_name: e.target.value }))} /></div><div><label className="label">Email</label><input type="email" className="input-field" value={editDeptForm.head_email} onChange={(e) => setEditDeptForm(f => ({ ...f, head_email: e.target.value }))} /></div><div><label className="label">Phone</label><input className="input-field" value={editDeptForm.head_phone} onChange={(e) => setEditDeptForm(f => ({ ...f, head_phone: e.target.value }))} /></div></div></div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={() => setEditDeptId(null)} className="dialog-btn-cancel">Cancel</button>
              <button type="submit" disabled={savingDept} className="dialog-btn-primary">{savingDept ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}</button>
            </div>
          </form>
        </Modal>

        <Modal open={!!editTeamId} onClose={() => setEditTeamId(null)} title="Edit team" description="Update team details and on-call contact.">
          <form onSubmit={handleEditTeam} className="flex flex-col flex-1 min-h-0">
            <div className="dialog-body">
              <div className="dialog-section"><span className="dialog-section-title">Identity</span><div className="space-y-4"><div><label className="label">Team name *</label><input required className="input-field" value={editTeamForm.team_name} onChange={(e) => setEditTeamForm(f => ({ ...f, team_name: e.target.value }))} /></div><div><label className="label">Department</label><select className="select-field" value={editTeamForm.department_id} onChange={(e) => setEditTeamForm(f => ({ ...f, department_id: e.target.value }))}><option value="">Select department</option>{departments.map((dept) => <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>)}</select></div><div><label className="label">Description</label><textarea rows={3} className="input-field resize-none" value={editTeamForm.description} onChange={(e) => setEditTeamForm(f => ({ ...f, description: e.target.value }))} /></div></div></div>
              <div className="dialog-section"><span className="dialog-section-title">On-call contact</span><div className="grid grid-cols-1 gap-4"><div><label className="label">Phone</label><input className="input-field" value={editTeamForm.oncall_phone} onChange={(e) => setEditTeamForm(f => ({ ...f, oncall_phone: e.target.value }))} /></div><div><label className="label">Email</label><input type="email" className="input-field" value={editTeamForm.oncall_email} onChange={(e) => setEditTeamForm(f => ({ ...f, oncall_email: e.target.value }))} /></div></div></div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={() => setEditTeamId(null)} className="dialog-btn-cancel">Cancel</button>
              <button type="submit" disabled={updatingTeam} className="dialog-btn-primary">{updatingTeam ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}</button>
            </div>
          </form>
        </Modal>

        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete department" description="This action cannot be undone." danger>
          <div className="dialog-body">
            <p className="text-sm text-[var(--text-secondary)]">Are you sure you want to delete this department? Teams under it may be affected.</p>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setDeleteConfirm(null)} className="dialog-btn-cancel">Cancel</button>
            <button type="button" onClick={() => handleDeleteDept(deleteConfirm)} className="dialog-btn-danger">Delete</button>
          </div>
        </Modal>

        {/* Departments Grid */}
        {loadingDepts ? (
          <div className="flex items-center justify-center h-40 card"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
        ) : (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Departments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {!departments.length ? (
                <div className="col-span-full state-empty">
                  <Building2 className="w-8 h-8 text-[var(--text-muted)] mb-2" />
                  <p>No departments yet</p>
                </div>
              ) : (
                departments.map((dept) => (
                  <DepartmentCard key={dept.department_id} dept={dept} />
                ))
              )}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Teams</h2>
          <div className="table-wrapper">
            {loadingTeams ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
            ) : (
              <div className="table-container overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Team</th><th>Department</th><th>Engineers</th><th>Servers</th><th className="text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!teams.length ? (
                      <tr><td colSpan={5} className="text-center py-12"><div className="state-empty inline-flex">No teams yet</div></td></tr>
                    ) : teams.map((team) => (
                      <tr key={team.team_id}>
                        <td><button type="button" onClick={() => viewTeam(team.team_id)} className="text-sm font-medium text-[var(--primary)] hover:underline text-left">{team.team_name}</button></td>
                        <td className="text-sm text-[var(--text-primary)]">{team.department_name || '—'}</td>
                        <td className="text-sm">{team.engineer_count ?? 0}</td>
                        <td className="text-sm">{team.server_count ?? 0}</td>
                        <td className="text-right">
                          <RowActions items={[
                            { label: 'View Team', icon: <Eye className="w-4 h-4" />, onClick: () => viewTeam(team.team_id) },
                            { label: 'Edit Team', icon: <Pencil className="w-4 h-4" />, onClick: () => openEditTeam(team) },
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
      </div>
    </div>
  );
}