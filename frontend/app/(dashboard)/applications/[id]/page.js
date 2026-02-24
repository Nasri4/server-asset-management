'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';
import { getStatusColor } from '../../../../lib/utils';
import { ArrowLeft, Loader2, Server } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/applications/' + id).then((r) => setData(r.data)).catch((err) => { toast.error(err.response?.data?.error || 'Failed to load application'); setData(null); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>;
  if (!data) return <div className="state-empty mt-12"><span className="text-lg font-medium text-[var(--text-primary)] mb-1">Application Not Found</span><p className="text-sm">The requested application could not be loaded.</p></div>;

  const app = data.application || {};
  const servers = data.servers || [];

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/applications" className="btn-ghost flex-shrink-0" aria-label="Back to applications">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="page-title">{app.app_name}</h1>
            {app.description && <p className="page-subtitle">{app.description}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {app.app_type && <span className="text-xs px-2 py-0.5 rounded bg-[var(--background-soft)] text-[var(--text-secondary)]">{app.app_type}</span>}
              {app.version && <span className="text-xs font-mono text-[var(--text-muted)]">{app.version}</span>}
              {app.criticality && <span className={getStatusColor(app.criticality)}>{app.criticality}</span>}
              {app.sla_level && <span className="text-xs text-[var(--text-secondary)]">SLA: {app.sla_level}</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--border)]">Servers</h3>
        {!servers.length ? (
          <div className="state-empty py-8"><Server className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Servers Linked</p><p className="text-sm">This application has not been deployed to any servers</p></div>
        ) : (
          <ul className="space-y-2">
            {servers.map((s) => (
              <li key={s.server_id} className="py-2 border-b border-[var(--border-soft)] last:border-0">
                <Link href={'/servers/' + s.server_id} className="font-mono text-[var(--primary)] hover:underline">{s.server_code}</Link>
                {s.hostname && <span className="text-xs text-[var(--text-secondary)] ml-2">{s.hostname}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
