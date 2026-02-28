'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { formatDateTime, getStatusColor } from '../../../../lib/utils';

export default function MaintenanceHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [result, setResult] = useState('');

  useEffect(() => {
    loadHistory();
  }, [result]);

  async function loadHistory() {
    try {
      const params = {};
      if (result) params.result = result;
      const res = await api.get('/maintenance/history', { params });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load maintenance history');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">Completed and past maintenance runs.</p>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <select className="select-field w-44" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">All results</option>
            <option value="Success">Success</option>
            <option value="Partial">Partial</option>
            <option value="Failed">Failed</option>
          </select>
          <p className="text-sm text-[var(--text-muted)]">{items.length} runs</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" /></div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Schedule</th><th>Server</th><th>Result</th><th>Status</th><th>Engineer</th><th>Completed By</th><th>Completed At</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center"><span className="state-empty inline-flex">No maintenance history</span></td></tr>
                ) : items.map((item) => (
                  <tr key={item.run_id}>
                    <td className="font-medium"><Link href={`/maintenance/${item.maintenance_id}`} className="hover:underline text-[var(--text-primary)]">{item.title}</Link></td>
                    <td className="font-mono text-sm"><Link href={`/servers/${item.server_id}`} className="text-[var(--primary)] hover:underline">{item.server_code}</Link></td>
                    <td><span className={getStatusColor(item.run_result || 'Completed')}>{item.run_result || '—'}</span></td>
                    <td><span className={getStatusColor(item.run_status || 'Completed')}>{item.run_status || '—'}</span></td>
                    <td className="text-sm">{item.engineer_name || '—'}</td>
                    <td className="text-sm">{item.completed_by_name || '—'}</td>
                    <td className="text-sm">{formatDateTime(item.completed_at || item.started_at)}</td>
                    <td className="text-sm text-[var(--text-secondary)]">{item.completion_notes || '—'}</td>
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
