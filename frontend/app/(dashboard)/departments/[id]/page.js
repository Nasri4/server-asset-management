'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';
import { ArrowLeft, Loader2, Pencil, Building2, Users, Server } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DepartmentDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get('/departments/' + id)
      .then((r) => setData(r.data))
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load department');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  if (!data?.department) {
    return (
      <div className="state-empty py-16">
        <Building2 className="w-12 h-12 text-[var(--text-muted)] mb-3" />
        <p>Department not found</p>
        <Link href="/teams" className="text-[var(--primary)] text-sm mt-2 inline-block">← Back to Teams & Departments</Link>
      </div>
    );
  }

  const dept = data.department;
  const teams = data.teams || [];

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/teams" className="btn-ghost flex-shrink-0 p-2 rounded-lg" aria-label="Back"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="min-w-0">
            <h1 className="page-title">{dept.department_name}</h1>
            <p className="page-subtitle">Department details</p>
          </div>
        </div>
        <Link href="/teams" className="btn-secondary flex-shrink-0"><Pencil className="w-4 h-4" /> Edit on Teams page</Link>
      </div>

      <div className="card">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dept.description && <div><p className="label mb-1">Description</p><p className="text-sm text-[var(--text-primary)]">{dept.description}</p></div>}
            {dept.head_name && <div><p className="label mb-1">Head</p><p className="text-sm text-[var(--text-primary)]">{dept.head_name}</p></div>}
            {dept.head_email && <div><p className="label mb-1">Head email</p><p className="text-sm text-[var(--text-primary)]">{dept.head_email}</p></div>}
            {dept.head_phone && <div><p className="label mb-1">Head phone</p><p className="text-sm text-[var(--text-primary)]">{dept.head_phone}</p></div>}
          </div>
        </div>
        <div className="p-5">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Teams in this department</h2>
          {teams.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No teams in this department.</p>
          ) : (
            <ul className="space-y-2">
              {teams.map((t) => (
                <li key={t.team_id}>
                  <Link href={'/teams/' + t.team_id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--section-bg)] transition-colors">
                    <span className="font-medium text-[var(--text-primary)]">{t.team_name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{t.engineer_count ?? 0} engineer{(t.engineer_count ?? 0) !== 1 ? 's' : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
