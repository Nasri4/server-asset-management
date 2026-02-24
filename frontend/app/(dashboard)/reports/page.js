'use client';
import { useState } from 'react';
import api from '../../../lib/api';
import { Download, Loader2, Server, AlertTriangle, Wrench, Shield, Printer } from 'lucide-react';
import { formatDate, getStatusColor } from '../../../lib/utils';
import toast from 'react-hot-toast';

const REPORTS = [
  { key: 'server-inventory', label: 'Server Inventory', desc: 'Full server list with specs, location, team', icon: Server, iconBg: 'bg-[var(--primary-soft)]', iconColor: 'text-[var(--primary)]' },
  { key: 'incident-summary', label: 'Incident Summary', desc: 'Incidents by severity, resolution time, status', icon: AlertTriangle, iconBg: 'bg-[var(--danger-soft)]', iconColor: 'text-[var(--danger)]' },
  { key: 'maintenance-compliance', label: 'Maintenance Compliance', desc: 'Scheduled vs completed, overdue tracking', icon: Wrench, iconBg: 'bg-[var(--warning-soft)]', iconColor: 'text-[var(--warning)]' },
  { key: 'warranty-expiry', label: 'Warranty Expiry', desc: 'Servers with warranties expiring soon', icon: Shield, iconBg: 'bg-[var(--primary-soft)]', iconColor: 'text-[var(--primary)]' },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  async function runReport(key) {
    setActiveReport(key);
    setLoading(true);
    setData(null);
    try {
      const params = {};
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      const res = await api.get(`/reports/${key}`, { params });
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!data) return;
    const rows = Array.isArray(data) ? data : data.incidents || [];
    if (!rows.length) return toast.error('No data to export');
    const headers = Object.keys(rows[0]);
    const readableHeaders = headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    const csvLines = [
      readableHeaders.join(','),
      ...rows.map(r => headers.map(h => {
        const v = r[h];
        if (v == null) return '""';
        const str = String(v).replace(/"/g, '""');
        return `"${str}"`;
      }).join(','))
    ];
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${activeReport}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Generate and export operational reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {REPORTS.map(r => (
          <button key={r.key} onClick={() => runReport(r.key)}
                  className={`card-hover text-left transition-all ${activeReport === r.key ? 'border-[var(--primary)]/50 bg-[var(--primary-soft)]' : ''}`}>
            <div className={`w-10 h-10 ${r.iconBg} rounded-xl flex items-center justify-center mb-3`}>
              <r.icon className={`w-5 h-5 ${r.iconColor}`} />
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{r.label}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{r.desc}</div>
          </button>
        ))}
      </div>

      {activeReport && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{REPORTS.find(r => r.key === activeReport)?.label}</h3>
              {(activeReport === 'incident-summary') && (
                <div className="flex items-center gap-2">
                  <input type="date" className="input-field w-36 text-xs" value={dateRange.start} onChange={e => setDateRange(d => ({...d, start: e.target.value}))} />
                  <span className="text-[var(--text-muted)] text-xs">to</span>
                  <input type="date" className="input-field w-36 text-xs" value={dateRange.end} onChange={e => setDateRange(d => ({...d, end: e.target.value}))} />
                  <button onClick={() => runReport(activeReport)} className="btn-secondary text-xs">Apply</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="btn-ghost no-print"><Printer className="w-4 h-4" /> Print</button>
              <button onClick={exportCSV} className="btn-secondary no-print"><Download className="w-4 h-4" /> Export CSV</button>
            </div>
          </div>

          {loading ? <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div> : data ? (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              {activeReport === 'maintenance-compliance' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-[var(--background-soft)] rounded-xl"><div className="text-2xl font-bold text-[var(--text-primary)]">{data.total}</div><div className="text-xs text-[var(--text-muted)]">Total</div></div>
                  <div className="text-center p-4 bg-[var(--success)]/10 rounded-xl"><div className="text-2xl font-bold text-[var(--success)]">{data.completed}</div><div className="text-xs text-[var(--text-muted)]">Completed</div></div>
                  <div className="text-center p-4 bg-[var(--danger)]/10 rounded-xl"><div className="text-2xl font-bold text-[var(--danger)]">{data.overdue}</div><div className="text-xs text-[var(--text-muted)]">Overdue</div></div>
                  <div className="text-center p-4 bg-[var(--primary-soft)] rounded-xl"><div className="text-2xl font-bold text-[var(--primary)]">{data.upcoming}</div><div className="text-xs text-[var(--text-muted)]">Upcoming</div></div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[var(--background-soft)] sticky top-0">
                    <tr>{Object.keys((Array.isArray(data) ? data : data.incidents || [])[0] || {}).slice(0, 10).map(h =>
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{h.replace(/_/g, ' ')}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(data) ? data : data.incidents || []).map((row, i) => (
                      <tr key={i} className="border-t border-[var(--border-soft)] hover:bg-[var(--background-soft)]">
                        {Object.values(row).slice(0, 10).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-xs text-[var(--text-primary)]">{v instanceof Date ? formatDate(v) : String(v ?? '—')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : <p className="text-[var(--text-secondary)] text-sm">No data to display</p>}
        </div>
      )}
    </div>
  );
}
