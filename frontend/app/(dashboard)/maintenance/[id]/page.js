'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { formatDateTime, getStatusColor } from '../../../../lib/utils';

export default function MaintenanceDetailsPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);

  useEffect(() => {
    if (id) loadDetails();
  }, [id]);

  async function loadDetails() {
    try {
      const res = await api.get(`/maintenance/${id}`);
      setItem(res.data || null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load maintenance details');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-7 h-7 animate-spin text-[var(--primary)]" /></div>;
  }

  if (!item) {
    return <div className="state-empty inline-flex">Maintenance record not found</div>;
  }

  const checklist = Array.isArray(item.checklist_tasks) ? item.checklist_tasks : [];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance Details</h1>
          <p className="page-subtitle">Schedule, template, and run history</p>
        </div>
        <div className="flex gap-2">
          <Link href="/maintenance/schedules" className="btn-ghost">Back</Link>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              try {
                await api.post(`/maintenance/${item.maintenance_id}/complete`, {});
                toast.success('Marked completed');
                loadDetails();
              } catch (error) {
                toast.error(error.response?.data?.error || 'Failed to complete maintenance');
              }
            }}
          >
            Mark Completed
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Schedule</h3>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Title:</span> {item.title}</p>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Server:</span> <Link href={`/servers/${item.server_id}`} className="text-[var(--primary)] hover:underline">{item.server_code}</Link></p>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Type:</span> {item.maintenance_type}</p>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Status:</span> <span className={getStatusColor(item.status)}>{item.status}</span></p>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Priority:</span> <span className={getStatusColor(item.priority)}>{item.priority}</span></p>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Scheduled:</span> {formatDateTime(item.scheduled_date)}</p>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Engineer:</span> {item.engineer_name || '—'}</p>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Template:</span> {item.template_name || '—'}</p>
          <p className="text-sm"><span className="text-[var(--text-muted)]">Recurrence:</span> {item.recurrence_type || 'None'} {item.recurrence_interval ? `(${item.recurrence_interval} days)` : ''}</p>
          <p className="text-sm text-[var(--text-secondary)]">{item.description || 'No description'}</p>
        </div>

        <div className="card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Checklist</h3>
          {checklist.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No checklist</p>
          ) : (
            <div className="space-y-1">
              {checklist.map((entry, idx) => (
                <p key={`${entry.task}-${idx}`} className="text-sm text-[var(--text-secondary)]">• {entry.task} {entry.done ? '(done)' : ''}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Runs</h3>
          <p className="text-sm text-[var(--text-muted)]">{Array.isArray(item.runs) ? item.runs.length : 0} entries</p>
        </div>
        <div className="table-container overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th>Status</th><th>Result</th><th>Started</th><th>Completed</th><th>Completed By</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {!Array.isArray(item.runs) || item.runs.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center"><span className="state-empty inline-flex">No run history</span></td></tr>
              ) : item.runs.map((run) => (
                <tr key={run.run_id}>
                  <td><span className={getStatusColor(run.run_status || 'Pending')}>{run.run_status || '—'}</span></td>
                  <td><span className={getStatusColor(run.run_result || 'Completed')}>{run.run_result || '—'}</span></td>
                  <td className="text-sm">{formatDateTime(run.started_at)}</td>
                  <td className="text-sm">{formatDateTime(run.completed_at)}</td>
                  <td className="text-sm">{run.completed_by_name || '—'}</td>
                  <td className="text-sm text-[var(--text-secondary)]">{run.completion_notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
