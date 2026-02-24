'use client';
import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../../lib/utils';
import { Loader2, Shield, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ entity_type: '', action: '', is_sensitive: false });
  const pageSize = 50;

  useEffect(() => { loadLogs(); }, [page, filter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (filter.entity_type) params.entity_type = filter.entity_type;
      if (filter.action) params.action = filter.action;
      if (filter.is_sensitive) params.is_sensitive = 'true';
      const res = await api.get('/audit-log', { params });
      setLogs(res.data?.logs ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Audit Log</h1><p className="page-subtitle">Complete system activity trail &bull; Immutable</p></div>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <select className="select-field w-40" value={filter.entity_type} onChange={e => { setFilter(f => ({...f, entity_type: e.target.value})); setPage(1); }}>
            <option value="">All Entities</option><option>server</option><option>incident</option><option>maintenance</option><option>user</option>
            <option>team</option><option>department</option><option>location</option><option>rack</option><option>auth</option><option>setting</option></select>
          <select className="select-field w-40" value={filter.action} onChange={e => { setFilter(f => ({...f, action: e.target.value})); setPage(1); }}>
            <option value="">All Actions</option><option>CREATE</option><option>UPDATE</option><option>DELETE</option>
            <option>LOGIN</option><option>VIEW_CREDENTIALS</option><option>ROLE_CHANGE</option><option>PASSWORD_CHANGE</option><option>ASSIGN_ENGINEER</option></select>
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-[var(--border-soft)] text-sm text-[var(--text-secondary)] hover:bg-[var(--background-soft)]">
            <input type="checkbox" checked={filter.is_sensitive} onChange={e => { setFilter(f => ({...f, is_sensitive: e.target.checked})); setPage(1); }} className="w-4 h-4" />
            <Shield className="w-3.5 h-3.5 text-[var(--danger)]" /> Sensitive Only
          </label>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <span className="text-sm text-[var(--text-muted)]">{total} log{total !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
        ) : (
          <>
            <div className="table-container overflow-x-auto">
              <table className="w-full">
                <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>IP</th><th>Sensitive</th></tr></thead>
                <tbody>
                  {logs.length === 0 ? <tr><td colSpan={7} className="text-center py-12"><div className="state-empty">No logs found</div></td></tr> :
                    logs.map(l => (
                      <tr key={l.log_id} className={l.is_sensitive ? 'bg-[var(--danger)]/5' : ''}>
                        <td className="text-xs whitespace-nowrap">{formatDateTime(l.performed_at)}</td>
                        <td className="text-sm font-medium">{l.username}</td>
                        <td><span className={`badge ${l.action === 'DELETE' || l.action === 'VIEW_CREDENTIALS' || l.action === 'ROLE_CHANGE'
                          ? 'badge-red' : l.action === 'CREATE' ? 'badge-green' : l.action === 'LOGIN' ? 'badge-blue' : 'badge-gray'}`}>
                          {l.action}</span></td>
                        <td className="text-xs">{l.entity_type}</td>
                        <td className="text-xs font-mono">{l.entity_id || '—'}</td>
                        <td className="text-xs font-mono text-[var(--text-secondary)]">{l.ip_address}</td>
                        <td>{l.is_sensitive ? <Shield className="w-3.5 h-3.5 text-[var(--danger)]" /> : null}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-[var(--section-bg)] border-t border-[var(--border)]">
                <div className="text-xs text-[var(--text-secondary)]">Showing {((page-1)*pageSize)+1}–{Math.min(page*pageSize, total)} of {total}</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-ghost disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm text-[var(--text-secondary)]">Page {page} of {totalPages}</span>
                  <button type="button" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="btn-ghost disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
