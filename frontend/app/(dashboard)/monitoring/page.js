'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { getStatusColor } from '../../../lib/utils';
import { Loader2, Eye, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MonitoringPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/monitoring').then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch((err) => { toast.error(err.response?.data?.error || 'Failed to load monitoring'); setList([]); }).finally(() => setLoading(false)); }, []);
  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Monitoring</h1>
          <p className="page-subtitle">Server health and monitoring status</p>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="table-toolbar">
          <span className="text-sm text-[var(--text-muted)]">{list.length} server{list.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Server</th><th>Hostname</th><th>Health</th><th>Uptime</th><th>Tool</th><th>Alerts</th>
                  <th className="text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!list.length ? (
                  <tr><td colSpan={7} className="text-center py-12"><div className="state-empty">No monitoring data.</div></td></tr>
                ) : list.map((m) => (
                  <tr key={m.server_id} className="hover:bg-[var(--background-soft)]">
                    <td><Link href={'/servers/' + m.server_id} className="font-mono font-medium text-[var(--primary)] hover:underline">{m.server_code}</Link></td>
                    <td className="font-mono text-sm">{m.hostname || '—'}</td>
                    <td><span className={getStatusColor(m.health_status)}>{m.health_status || '—'}</span></td>
                    <td className="text-sm">{m.uptime_percent != null ? m.uptime_percent + '%' : '—'}</td>
                    <td className="text-sm">{m.monitoring_tool || '—'}</td>
                    <td className="text-sm">{m.alert_enabled ? 'On' : 'Off'}</td>
                    <td className="text-right">
                      <Link href={'/servers/' + m.server_id} className="btn-ghost p-2 rounded inline-flex" title="View"><Eye className="w-4 h-4" /></Link>
                      <Link href={'/servers/' + m.server_id + '/edit'} className="btn-ghost p-2 rounded inline-flex" title="Edit"><Pencil className="w-4 h-4" /></Link>
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
