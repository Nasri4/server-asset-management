'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../../lib/auth';
import { formatDate, formatDateTime, timeAgo, getStatusColor } from '../../../lib/utils';
import {
  Server, AlertTriangle, Wrench, ShieldAlert, Activity,
  ArrowRight, Loader2, TrendingUp, CheckCircle2,
  Cpu, Clock, MapPin,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (user?.engineer_id) {
      api.get('/dashboard/engineer-workspace').then((res) => setWorkspace(res.data)).catch(() => setWorkspace(null));
    } else {
      setWorkspace(null);
    }
  }, [user?.engineer_id]);

  async function loadDashboard() {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  const stats = data?.serverStats || {};
  const incidents = data?.incidentsBySeverity || [];
  const upcoming = data?.upcomingMaintenance || [];
  const activity = data?.recentActivity || [];

  const totalIncidents = incidents.reduce((sum, i) => sum + i.count, 0);
  const uptime = 99.98;
  const activePercentage = Math.round((stats.active_servers || 0) / (stats.total_servers || 1) * 100);
  const maintenancePercentage = Math.round((stats.maintenance_servers || 0) / (stats.total_servers || 1) * 100);

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Center</h1>
          <p className="page-subtitle flex items-center gap-2 flex-wrap">
            <span>{user?.full_name}</span>
            <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" aria-hidden />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="badge-green gap-1.5">
            <span className="status-dot-pulse bg-[var(--success)]" />
            {uptime}% Uptime
          </div>
          <Link href="/reports" className="btn-secondary text-xs no-print">
            Reports
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Servers', value: stats.total_servers || 0, icon: Server, badge: 'Total', badgeClass: 'badge-blue', iconBg: 'bg-[var(--primary-soft)]', iconColor: 'text-[var(--primary)]' },
          { label: 'Active', value: stats.active_servers || 0, icon: CheckCircle2, badge: `${activePercentage}%`, badgeClass: 'badge-green', iconBg: 'bg-[var(--success-soft)]', iconColor: 'text-[var(--success)]' },
          { label: 'Open Incidents', value: totalIncidents, icon: AlertTriangle, badge: `${incidents.find(i => i.severity === 'Critical')?.count || 0} critical`, badgeClass: 'badge-red', iconBg: 'bg-[var(--danger-soft)]', iconColor: 'text-[var(--danger)]' },
          { label: 'Under Maintenance', value: stats.maintenance_servers || 0, icon: Wrench, badge: `${data?.overdueCount || 0} overdue`, badgeClass: 'badge-yellow', iconBg: 'bg-[var(--warning-soft)]', iconColor: 'text-[var(--warning)]' },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="metric-card">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className={`w-4.5 h-4.5 ${kpi.iconColor}`} />
                </div>
                <span className={kpi.badgeClass}>{kpi.badge}</span>
              </div>
              <div className="metric-value">{kpi.value}</div>
              <div className="metric-label">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Engineer Workspace */}
      {user?.engineer_id && workspace && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--primary)]" />
              My Operations
            </h2>
            <span className="text-xs text-[var(--text-muted)]">Your assigned work</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Assigned Servers', icon: Server, iconColor: 'text-[var(--primary)]', items: workspace.assignedServers || [], linkAll: '/servers', render: (s) => (
                <li key={s.server_id}>
                  <Link href={`/servers/${s.server_id}`} className="text-sm text-[var(--primary)] hover:underline font-mono">{s.server_code}</Link>
                  <span className="text-[var(--text-muted)] text-xs ml-1">{s.hostname}</span>
                </li>
              )},
              { title: 'Active Maintenance', icon: Wrench, iconColor: 'text-[var(--warning)]', items: workspace.myMaintenance || [], linkAll: '/maintenance', render: (m) => (
                <li key={m.maintenance_id}>
                  <Link href={`/maintenance?id=${m.maintenance_id}`} className="text-sm text-[var(--text-primary)] hover:underline block truncate">{m.title}</Link>
                  <span className="text-xs text-[var(--text-muted)]">{m.server_code} · {formatDate(m.scheduled_date)}</span>
                </li>
              )},
              { title: 'Open Incidents', icon: AlertTriangle, iconColor: 'text-[var(--danger)]', items: workspace.myIncidents || [], linkAll: '/incidents', render: (i) => (
                <li key={i.incident_id}>
                  <Link href={`/incidents?id=${i.incident_id}`} className="text-sm text-[var(--text-primary)] hover:underline block truncate">{i.title}</Link>
                  <span className="text-xs text-[var(--text-muted)]">{i.server_code} · <span className={getStatusColor(i.severity)}>{i.severity}</span></span>
                </li>
              )},
              { title: 'Upcoming Visits', icon: MapPin, iconColor: 'text-[var(--success)]', items: workspace.myVisits || [], linkAll: '/servers', linkLabel: 'My servers', render: (v) => (
                <li key={v.visit_id}>
                  <Link href={`/servers/${v.server_id}`} className="text-sm text-[var(--primary)] hover:underline font-mono">{v.server_code}</Link>
                  <span className="text-xs text-[var(--text-muted)] block">{formatDate(v.visit_date)} · {v.visit_type || 'Visit'}</span>
                </li>
              )},
            ].map(section => {
              const Icon = section.icon;
              return (
                <div key={section.title} className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--section-bg)] flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${section.iconColor}`} />
                    <span className="font-medium text-sm text-[var(--text-primary)]">{section.title}</span>
                    {section.items.length > 0 && <span className="ml-auto badge-gray text-[10px]">{section.items.length}</span>}
                  </div>
                  <div className="p-3 max-h-44 overflow-y-auto scrollbar-thin">
                    {section.items.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)] py-2 text-center">None</p>
                    ) : (
                      <ul className="space-y-2">{section.items.map(section.render)}</ul>
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-[var(--border)]">
                    <Link href={section.linkAll} className="text-xs font-medium text-[var(--primary)]">{section.linkLabel || 'View all'}</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Incidents by Severity */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--section-bg)]">
            <div className="flex items-center gap-2.5">
              <div className="status-dot bg-[var(--danger)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Incidents by Severity</h2>
            </div>
            <Link href="/incidents" className="text-xs font-medium text-[var(--primary)] hover:opacity-80 transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            {incidents.length ? (
              <div className="space-y-4">
                {incidents.map(inc => (
                  <div key={inc.severity} className="group">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`status-dot ${
                          inc.severity === 'Critical' ? 'bg-[var(--danger)]' :
                          inc.severity === 'High' ? 'bg-[var(--warning)]' :
                          inc.severity === 'Medium' ? 'bg-[var(--info)]' :
                          'bg-[var(--primary)]'
                        }`} />
                        <span className="font-medium text-[var(--text-primary)]">{inc.severity}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[var(--text-primary)]">{inc.count}</span>
                        <span className="text-[var(--text-muted)] text-xs w-10 text-right font-medium">
                          {Math.round((inc.count / totalIncidents) * 100) || 0}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-[var(--section-bg)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          inc.severity === 'Critical' ? 'bg-[var(--danger)]' :
                          inc.severity === 'High' ? 'bg-[var(--warning)]' :
                          inc.severity === 'Medium' ? 'bg-[var(--info)]' :
                          'bg-[var(--primary)]'
                        }`}
                        style={{ width: `${(inc.count / totalIncidents) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="state-empty py-10">
                <CheckCircle2 className="w-8 h-8 text-[var(--success)] mb-2" />
                <p className="font-medium text-[var(--text-primary)] mb-1">All Clear</p>
                <p className="text-sm">No open incidents reported</p>
              </div>
            )}
          </div>
        </div>

        {/* Server Health */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--section-bg)]">
            <div className="flex items-center gap-2.5">
              <div className="status-dot bg-[var(--success)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Server Health</h2>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">{stats.total_servers || 0} total</span>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {[
                { label: 'Active', count: stats.active_servers, color: 'var(--success)', pct: Math.round((stats.active_servers || 0) / (stats.total_servers || 1) * 100) },
                { label: 'Inactive', count: stats.inactive_servers, color: 'var(--text-muted)', pct: Math.round((stats.inactive_servers || 0) / (stats.total_servers || 1) * 100) },
                { label: 'Maintenance', count: stats.maintenance_servers, color: 'var(--warning)', pct: Math.round((stats.maintenance_servers || 0) / (stats.total_servers || 1) * 100) },
                { label: 'Decommissioned', count: stats.decommissioned_servers, color: 'var(--danger)', pct: Math.round((stats.decommissioned_servers || 0) / (stats.total_servers || 1) * 100) },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="status-dot" style={{ backgroundColor: s.color }} />
                      <span className="text-[var(--text-primary)] font-medium">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[var(--text-primary)]">{s.count || 0}</span>
                      <span className="text-[var(--text-muted)] text-xs w-10 text-right font-medium">{s.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-[var(--section-bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-5 border-t border-[var(--border)] grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">Avg. Uptime</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">99.98%</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">Health Score</div>
                <div className="text-xl font-bold text-[var(--success)]">A+</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Maintenance */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--section-bg)]">
            <div className="flex items-center gap-2.5">
              <div className="status-dot bg-[var(--warning)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Upcoming Maintenance</h2>
            </div>
            <Link href="/maintenance" className="text-xs font-medium text-[var(--primary)] hover:opacity-80 transition-colors flex items-center gap-1">
              Schedule <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            {upcoming.length ? (
              <div className="space-y-3">
                {upcoming.map((m, index) => (
                  <div key={m.maintenance_id} className="flex items-center gap-4 p-3.5 rounded-lg border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--section-bg)] transition-all">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      index === 0 ? 'bg-[var(--warning-soft)]' : 'bg-[var(--section-bg)]'
                    }`}>
                      <Wrench className={`w-4 h-4 ${index === 0 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">{m.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-[var(--text-muted)]">{m.server_code}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          m.priority === 'High' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' :
                          m.priority === 'Medium' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' :
                          'bg-[var(--primary-soft)] text-[var(--primary)]'
                        }`}>{m.priority}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(m.scheduled_date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="state-empty py-10">
                <CheckCircle2 className="w-8 h-8 text-[var(--success)] mb-2" />
                <p className="font-medium text-[var(--text-primary)] mb-1">No Scheduled Maintenance</p>
                <p className="text-sm">All systems running smoothly</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--section-bg)]">
            <div className="flex items-center gap-2.5">
              <div className="status-dot-pulse bg-[var(--primary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Activity Timeline</h2>
            </div>
            <Link href="/audit-log" className="text-xs font-medium text-[var(--primary)] hover:opacity-80 transition-colors flex items-center gap-1">
              Full log <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5 max-h-[420px] overflow-y-auto scrollbar-thin">
            {activity.length ? (
              <div className="space-y-3">
                {activity.map((a, index) => (
                  <div key={a.log_id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      index === 0 ? 'bg-[var(--primary-soft)]' : 'bg-[var(--section-bg)]'
                    }`}>
                      <Activity className={`w-3.5 h-3.5 ${index === 0 ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`} />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{a.username}</span>
                        <span className="text-xs text-[var(--primary)] font-medium bg-[var(--primary-soft)] px-1.5 py-0.5 rounded">
                          {a.entity_type}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                        <span className="font-medium">{a.action}</span> operation
                      </p>
                      <span className="text-xs text-[var(--text-muted)] mt-0.5 block">{timeAgo(a.performed_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="state-empty py-10">
                <Activity className="w-8 h-8 text-[var(--text-muted)] mb-2" />
                <p className="font-medium text-[var(--text-primary)] mb-1">No Activity Yet</p>
                <p className="text-sm">System activity will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--warning-soft)]">
              <ShieldAlert className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Expiring Warranties</div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{data?.expiringWarranties || 0}</div>
            </div>
          </div>
          <div className="text-xs text-[var(--warning)] font-medium">Within 90 days — review required</div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--primary-soft)]">
              <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Under Maintenance</div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{stats.maintenance_servers || 0}</div>
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">{maintenancePercentage}% of {stats.total_servers || 0} total servers</div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--success-soft)]">
              <Cpu className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Total Infrastructure</div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{stats.total_servers || 0}</div>
            </div>
          </div>
          <div className="text-xs text-[var(--success)] font-medium">{stats.active_servers || 0} operational · {activePercentage}% active</div>
        </div>
      </div>
    </div>
  );
}
