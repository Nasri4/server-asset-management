'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle, Clock3, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { formatDateTime, getStatusColor } from '../../../lib/utils';
import Modal from '../../../components/ui/Modal';

export default function MaintenanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, overdue: 0 });
  const [upcoming, setUpcoming] = useState([]);
  const [completeItem, setCompleteItem] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const res = await api.get('/maintenance/dashboard');
      setStats(res.data?.stats || { total: 0, active: 0, completed: 0, overdue: 0 });
      setUpcoming(Array.isArray(res.data?.upcoming) ? res.data.upcoming : []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load maintenance dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function submitComplete(e) {
    e.preventDefault();
    if (!completeItem) return;
    try {
      await api.post(`/maintenance/${completeItem.maintenance_id}/complete`, {
        completion_notes: completionNotes,
      });
      toast.success('Maintenance completed');
      setCompleteItem(null);
      setCompletionNotes('');
      loadDashboard();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to complete maintenance');
    }
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance Dashboard</h1>
          <p className="page-subtitle">Track due work, complete tasks, and monitor schedule health.</p>
        </div>
        <Link href="/maintenance/create" className="btn-primary">Create Schedule</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-[var(--text-muted)]">Total</p><p className="text-2xl font-semibold text-[var(--text-primary)]">{stats.total || 0}</p></div>
        <div className="card p-4"><p className="text-xs text-[var(--text-muted)]">Active</p><p className="text-2xl font-semibold text-[var(--text-primary)]">{stats.active || 0}</p></div>
        <div className="card p-4"><p className="text-xs text-[var(--text-muted)]">Completed</p><p className="text-2xl font-semibold text-[var(--text-primary)]">{stats.completed || 0}</p></div>
        <div className="card p-4"><p className="text-xs text-[var(--text-muted)]">Overdue</p><p className="text-2xl font-semibold text-[var(--danger)]">{stats.overdue || 0}</p></div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Upcoming & Active</h3>
          <div className="flex items-center gap-2">
            <Link href="/maintenance/schedules" className="btn-ghost text-sm">View Schedules</Link>
            <Link href="/maintenance/history" className="btn-ghost text-sm">View History</Link>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" /></div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Server</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Engineer</th>
                  <th>Scheduled</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center"><span className="state-empty inline-flex">No upcoming or active maintenance</span></td></tr>
                ) : (
                  upcoming.map((item) => (
                    <tr key={item.maintenance_id}>
                      <td className="font-medium text-[var(--text-primary)]"><Link href={`/maintenance/${item.maintenance_id}`} className="hover:underline">{item.title}</Link></td>
                      <td className="font-mono text-sm"><Link href={`/servers/${item.server_id}`} className="text-[var(--primary)] hover:underline">{item.server_code}</Link></td>
                      <td><span className={getStatusColor(item.status)}>{item.status}</span></td>
                      <td><span className={getStatusColor(item.priority)}>{item.priority}</span></td>
                      <td className="text-sm">{item.engineer_name || '—'}</td>
                      <td className="text-sm">{formatDateTime(item.scheduled_date)}</td>
                      <td className="text-right">
                        <button type="button" className="btn-ghost text-sm" onClick={() => setCompleteItem(item)}>
                          Complete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!completeItem}
        onClose={() => setCompleteItem(null)}
        title="Complete maintenance"
        description={completeItem ? `${completeItem.title} • ${completeItem.server_code}` : ''}
        size="sm"
      >
        <form onSubmit={submitComplete} className="flex flex-col">
          <div className="dialog-body">
            <label className="label">Completion notes</label>
            <textarea
              className="input-field h-24 resize-none"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Optional completion details"
            />
          </div>
          <div className="dialog-footer">
            <button type="button" className="dialog-btn-cancel" onClick={() => setCompleteItem(null)}>Cancel</button>
            <button type="submit" className="dialog-btn-primary">Mark Completed</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
