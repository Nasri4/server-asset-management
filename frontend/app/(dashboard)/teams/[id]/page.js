'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';
import { getStatusColor } from '../../../../lib/utils';
import { 
  ArrowLeft, Loader2, Pencil, Users, Server, 
  Phone, Mail, User, Building2, X, Save,
  AlertCircle, Edit, Eye, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../../components/ui/Modal';

const emptyTeam = {
  team_name: '',
  department_id: '',
  description: '',
  oncall_phone: '',
  oncall_email: ''
};

export default function TeamDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(emptyTeam);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadTeam();
    loadDepartments();
  }, [id]);

  function loadTeam() {
    setLoading(true);
    api.get('/teams/' + id)
      .then((r) => {
        setData(r.data);
        const team = r.data.team || {};
        setEditForm({
          team_name: team.team_name || '',
          department_id: team.department_id || '',
          description: team.description || '',
          oncall_phone: team.oncall_phone || '',
          oncall_email: team.oncall_email || ''
        });
      })
      .catch((err) => { 
        toast.error(err.response?.data?.error || 'Failed to load team'); 
        setData(null); 
      })
      .finally(() => setLoading(false));
  }

  function loadDepartments() {
    api.get('/departments')
      .then((r) => setDepartments(Array.isArray(r.data) ? r.data : []))
      .catch(() => setDepartments([]));
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setUpdating(true);
    try {
      await api.put('/teams/' + id, {
        ...editForm,
        department_id: parseInt(editForm.department_id)
      });
      toast.success('Team updated successfully');
      setShowEdit(false);
      loadTeam();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update team');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="state-empty py-16">
        <AlertCircle className="w-12 h-12 text-[var(--danger)] mb-3" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Team Not Found</h2>
        <p className="text-[var(--text-secondary)] mb-4">The team you're looking for doesn't exist.</p>
        <Link href="/teams" className="btn-primary inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to Teams</Link>
      </div>
    );
  }

  const team = data.team || {};
  const engineers = data.engineers || [];
  const servers = data.servers || [];

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/teams" className="btn-ghost flex-shrink-0 p-2 rounded-lg" title="Back to teams"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="min-w-0">
            <h1 className="page-title">{team.team_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="page-subtitle">{team.department_name || 'No Department'}</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setShowEdit(true)} className="btn-primary flex-shrink-0"><Pencil className="w-4 h-4" /> Edit Team</button>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        <button type="button" onClick={() => setActiveTab('overview')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'overview' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Overview</button>
        <button type="button" onClick={() => setActiveTab('engineers')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${activeTab === 'engineers' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}><Users className="w-4 h-4" /> Engineers ({engineers.length})</button>
        <button type="button" onClick={() => setActiveTab('servers')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${activeTab === 'servers' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}><Server className="w-4 h-4" /> Servers ({servers.length})</button>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit team" description="Update team details and on-call contact.">
        <form onSubmit={handleUpdate} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section">
              <span className="dialog-section-title">Identity</span>
              <div className="space-y-4">
                <div><label className="label">Team name *</label><input required className="input-field" value={editForm.team_name} onChange={(e) => setEditForm(f => ({ ...f, team_name: e.target.value }))} /></div>
                <div><label className="label">Department</label><select className="select-field" value={editForm.department_id} onChange={(e) => setEditForm(f => ({ ...f, department_id: e.target.value }))}><option value="">Select department</option>{departments.map((dept) => <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>)}</select></div>
                <div><label className="label">Description</label><textarea className="input-field h-24 resize-none" placeholder="Brief description" value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">On-call contact</span>
              <div className="grid grid-cols-1 gap-4">
                <div><label className="label">Phone</label><input className="input-field" placeholder="Phone" value={editForm.oncall_phone} onChange={(e) => setEditForm(f => ({ ...f, oncall_phone: e.target.value }))} /></div>
                <div><label className="label">Email</label><input type="email" className="input-field" placeholder="oncall@example.com" value={editForm.oncall_email} onChange={(e) => setEditForm(f => ({ ...f, oncall_email: e.target.value }))} /></div>
              </div>
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setShowEdit(false)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" disabled={updating} className="dialog-btn-primary">{updating ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save changes</>}</button>
          </div>
        </form>
      </Modal>

      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--primary-soft)]"><Building2 className="w-5 h-5 text-[var(--primary)]" /></div>
                  <div><p className="text-xs text-[var(--text-muted)]">Department</p><p className="text-sm font-medium text-[var(--text-primary)]">{team.department_name || '—'}</p></div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--success-soft)]"><Users className="w-5 h-5 text-[var(--success)]" /></div>
                  <div><p className="text-xs text-[var(--text-muted)]">Engineers</p><p className="text-sm font-medium text-[var(--text-primary)]">{engineers.length}</p></div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--primary-soft)]"><Server className="w-5 h-5 text-[var(--primary)]" /></div>
                  <div><p className="text-xs text-[var(--text-muted)]">Servers</p><p className="text-sm font-medium text-[var(--text-primary)]">{servers.length}</p></div>
                </div>
              </div>
            </div>
            {team.description && (
              <div className="card p-5">
                <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Description</h3>
                <p className="text-[var(--text-primary)]">{team.description}</p>
              </div>
            )}
            {(team.oncall_phone || team.oncall_email) && (
              <div className="card p-5">
                <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">On-call Contact</h3>
                <div className="space-y-2">
                  {team.oncall_phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-[var(--text-muted)]" /><a href={`tel:${team.oncall_phone}`} className="text-[var(--primary)] hover:underline">{team.oncall_phone}</a></div>}
                  {team.oncall_email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-[var(--text-muted)]" /><a href={`mailto:${team.oncall_email}`} className="text-[var(--primary)] hover:underline">{team.oncall_email}</a></div>}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'engineers' && (
          <div className="table-wrapper">
            <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--section-bg)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Team Engineers</h3>
            </div>
            {engineers.length === 0 ? (
              <div className="p-12 text-center state-empty">
                <Users className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                <p className="font-medium text-[var(--text-primary)]">No Engineers</p>
                <p className="text-sm text-[var(--text-secondary)]">This team doesn't have any engineers assigned yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {engineers.map((engineer) => (
                  <div key={engineer.engineer_id} className="px-5 py-4 hover:bg-[var(--section-bg)] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--primary-soft)]">
                          <User className="w-5 h-5 text-[var(--primary)]" />
                        </div>
                        <div>
                          <Link href={`/engineers/${engineer.engineer_id}`} className="font-medium text-[var(--primary)] hover:underline">
                            {engineer.full_name}
                          </Link>
                          {engineer.email && <div className="text-xs text-[var(--text-muted)]">{engineer.email}</div>}
                        </div>
                      </div>
                      <Link href={`/engineers/${engineer.engineer_id}`} className="btn-ghost p-2 rounded-lg" title="View engineer"><Eye className="w-4 h-4" /></Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'servers' && (
          <div className="table-wrapper">
            <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--section-bg)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Assigned Servers</h3>
            </div>
            {servers.length === 0 ? (
              <div className="p-12 text-center state-empty">
                <Server className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                <p className="font-medium text-[var(--text-primary)]">No Servers</p>
                <p className="text-sm text-[var(--text-secondary)]">This team doesn't have any servers assigned yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {servers.map((server) => (
                  <div key={server.server_id} className="px-5 py-4 hover:bg-[var(--section-bg)] transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <Link href={`/servers/${server.server_id}`} className="font-mono font-medium text-[var(--primary)] hover:underline">{server.server_code}</Link>
                        {server.hostname && <div className="text-xs text-[var(--text-muted)] mt-1">{server.hostname}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={getStatusColor(server.status)}>{server.status || 'Unknown'}</span>
                        <Link href={`/servers/${server.server_id}`} className="btn-ghost p-2 rounded-lg" title="View server"><Eye className="w-4 h-4" /></Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}