'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';
import { formatDate, formatDateTime, getStatusColor } from '../../../../lib/utils';
import { ArrowLeft, Loader2, Server, AlertTriangle, Wrench, MapPin } from 'lucide-react';

export default function EngineerProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/engineers/${id}`)
      .then(r => setData(r.data))
      .catch(err => {
        toast.error(err.response?.data?.error || 'Failed to load engineer');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>;
  if (!data) return <div className="state-empty mt-12"><span className="text-lg font-medium text-[var(--text-primary)] mb-1">Engineer Not Found</span><p className="text-sm">The requested engineer could not be loaded.</p></div>;

  const e = data.engineer;
  const m = data.metrics || {};

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/engineers" className="btn-ghost flex-shrink-0" aria-label="Back to engineers">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-14 h-14 bg-[var(--primary-soft)] rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-[var(--primary)]">{e.full_name?.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <h1 className="page-title">{e.full_name}</h1>
            <p className="page-subtitle">{e.team_name} &bull; {e.department_name}</p>
            <p className="text-[var(--text-secondary)] text-xs">{e.email} &bull; {e.phone}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-[var(--primary)]">{m.assigned_servers || 0}</div><div className="text-xs text-[var(--text-secondary)]">Assigned Servers</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-[var(--success)]">{m.incidents_resolved || 0}</div><div className="text-xs text-[var(--text-secondary)]">Incidents Resolved</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-[var(--warning)]">{m.incidents_open || 0}</div><div className="text-xs text-[var(--text-secondary)]">Open Incidents</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-[var(--primary)]">{m.maintenance_completed || 0}</div><div className="text-xs text-[var(--text-secondary)]">Maintenance Done</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{m.total_visits || 0}</div><div className="text-xs text-[var(--text-secondary)]">Site Visits</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Servers */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"><Server className="w-4 h-4 text-[var(--primary)]" /> Assigned Servers</h3>
          {data.assignedServers?.length ? data.assignedServers.map(s => (
            <Link key={s.assignment_id} href={`/servers/${s.server_id}`} className="flex items-center justify-between py-2 border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--background-soft)] px-2 rounded">
              <span className="font-mono text-sm text-[var(--primary)]">{s.server_code}</span>
              <span className={getStatusColor(s.status)}>{s.status}</span>
            </Link>
          )) : <p className="text-[var(--text-secondary)] text-sm">No servers assigned</p>}
        </div>

        {/* Recent Incidents */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[var(--danger)]" /> Recent Incidents</h3>
          {data.incidents?.length ? data.incidents.slice(0, 8).map(i => (
            <div key={i.incident_id} className="flex items-center justify-between py-2 border-b border-[var(--border-soft)] last:border-0">
              <div><div className="text-sm text-[var(--text-primary)]">{i.title}</div><div className="text-xs text-[var(--text-secondary)]">{i.server_code}</div></div>
              <span className={getStatusColor(i.status)}>{i.status}</span>
            </div>
          )) : <p className="text-[var(--text-secondary)] text-sm">No incidents</p>}
        </div>

        {/* Maintenance */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"><Wrench className="w-4 h-4 text-[var(--warning)]" /> Maintenance History</h3>
          {data.maintenance?.length ? data.maintenance.slice(0, 8).map(m => (
            <div key={m.maintenance_id} className="flex items-center justify-between py-2 border-b border-[var(--border-soft)] last:border-0">
              <div><div className="text-sm text-[var(--text-primary)]">{m.title}</div><div className="text-xs text-[var(--text-muted)]">{formatDate(m.scheduled_date)}</div></div>
              <span className={getStatusColor(m.status)}>{m.status}</span>
            </div>
          )) : <p className="text-[var(--text-secondary)] text-sm">No maintenance records</p>}
        </div>

        {/* Visits */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-[var(--primary)]" /> Site Visits</h3>
          {data.visits?.length ? data.visits.slice(0, 8).map(v => (
            <div key={v.visit_id} className="py-2 border-b border-[var(--border-soft)] last:border-0">
              <div className="flex items-center justify-between"><span className="font-mono text-xs text-[var(--primary)]">{v.server_code}</span><span className="text-xs text-[var(--text-muted)]">{formatDate(v.visit_date)}</span></div>
              {v.findings && <div className="text-xs text-[var(--text-secondary)] mt-1">{v.findings}</div>}
            </div>
          )) : <p className="text-[var(--text-secondary)] text-sm">No visits recorded</p>}
        </div>
      </div>
    </div>
  );
}
