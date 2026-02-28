'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { formatDateTime, getStatusColor } from '../../../../lib/utils';

export default function MaintenanceSchedulesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState({ status: '', q: '' });

  useEffect(() => {
    loadSchedules();
  }, [filter.status]);

  async function loadSchedules() {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.q.trim()) params.q = filter.q.trim();
      const res = await api.get('/maintenance/schedules', { params });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Schedules</h1>
          <p className="page-subtitle">Manage planned maintenance windows and assignments.</p>
        </div>
        <Link href="/maintenance/create" className="btn-primary">Create Schedule</Link>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input-field w-60"
              placeholder="Search title/server"
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
            />
            <button type="button" className="btn-ghost" onClick={loadSchedules}>Search</button>
            <select
              className="select-field w-44"
              value={filter.status}
              onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All status</option>
              <option>Scheduled</option>
              <option>Pending</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Failed</option>
              <option>Cancelled</option>
            </select>
          </div>
          <p className="text-sm text-[var(--text-muted)]">{items.length} schedules</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" /></div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <th>Title</th><th>Server</th><th>Status</th><th>Priority</th><th>Engineer</th><th>Scheduled</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center"><span className="state-empty inline-flex">No schedules found</span></td></tr>
                ) : items.map((item) => (
                  <tr key={item.maintenance_id}>
                    <td className="font-medium text-[var(--text-primary)]">{item.title}</td>
                    <td className="font-mono text-sm"><Link href={`/servers/${item.server_id}`} className="text-[var(--primary)] hover:underline">{item.server_code}</Link></td>
                    <td><span className={getStatusColor(item.status)}>{item.status}</span></td>
                    <td><span className={getStatusColor(item.priority)}>{item.priority}</span></td>
                    <td className="text-sm">{item.engineer_name || '—'}</td>
                    <td className="text-sm">{formatDateTime(item.scheduled_date)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/maintenance/${item.maintenance_id}`} className="btn-ghost text-sm">Details</Link>
                        {['Scheduled', 'Pending', 'In Progress'].includes(item.status) && (
                          <button
                            type="button"
                            className="btn-ghost text-sm"
                            onClick={async () => {
                              try {
                                await api.post(`/maintenance/${item.maintenance_id}/complete`, {});
                                toast.success('Marked completed');
                                loadSchedules();
                              } catch (error) {
                                toast.error(error.response?.data?.error || 'Failed to complete');
                              }
                            }}
                          >
                            Complete
                          </button>
                        )}
                      </div>
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
