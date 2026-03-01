'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { formatDate, timeAgo } from '../../../lib/utils';
import {
  Server, Monitor, AlertTriangle, Wrench,
  ArrowUpRight, Plus, Ticket,
  Activity, TrendingUp, TrendingDown,
  Shield, CheckCircle2, ChevronRight,
  Network, Router, PackageCheck, BarChart3,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────── */
function severityBadgeClass(s) {
  if (s === 'Critical' || s === 'High') return 'badge-red';
  if (s === 'Medium') return 'badge-yellow';
  return 'badge-blue';
}
function severityBorder(s) {
  if (s === 'Critical' || s === 'High') return 'var(--danger)';
  if (s === 'Medium') return 'var(--warning)';
  return 'var(--primary)';
}

/* ─── Donut chart ─────────────────────────────────────────────── */
function DonutChart({ segments, size = 128, stroke = 15 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, g) => s + g.value, 0) || 1;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const el = (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-acc}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.7s ease' }}
          />
        );
        acc += dash;
        return el;
      })}
    </svg>
  );
}

/* ─── Stat card ───────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, accent, trend }) {
  return (
    <div className="card relative overflow-hidden group hover:shadow-md transition-all duration-200">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: accent }} />
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
            <Icon className="w-4 h-4" style={{ color: iconColor }} />
          </div>
          {trend !== undefined && trend !== 0 && (
            <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${trend > 0 ? 'text-[var(--success)] bg-[var(--success-soft)]' : 'text-[var(--danger)] bg-[var(--danger-soft)]'}`}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-[var(--text-primary)] leading-none">{value}</p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mt-1.5 mb-1">{label}</p>
        <p className="text-[11px] text-[var(--text-secondary)]">{sub}</p>
      </div>
    </div>
  );
}

/* ─── Status pill ─────────────────────────────────────────────── */
function StatusPill({ label, status }) {
  const cfg = {
    online:   { color: 'var(--success)', bg: 'var(--success-soft)', text: 'Operational' },
    degraded: { color: 'var(--warning)', bg: 'var(--warning-soft)', text: 'Degraded' },
    offline:  { color: 'var(--danger)',  bg: 'var(--danger-soft)',  text: 'Offline' },
  }[status] || { color: 'var(--success)', bg: 'var(--success-soft)', text: 'Operational' };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: cfg.bg }}>
      <div className="relative flex-shrink-0">
        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
        {status === 'online' && (
          <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-50" style={{ background: cfg.color }} />
        )}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-[var(--text-primary)] leading-none">{label}</p>
        <p className="text-[10px] mt-0.5 leading-none" style={{ color: cfg.color }}>{cfg.text}</p>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [serverStats, setServerStats] = useState({ total_servers: 0, active_servers: 0, inactive_servers: 0, maintenance_servers: 0 });
  const [incidentsBySeverity, setIncidentsBySeverity] = useState([]);
  const [upcomingMaintenance, setUpcomingMaintenance] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadDashboard();
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await api.get('/dashboard');
      const d = res.data || {};
      setServerStats(d.serverStats || {});
      setIncidentsBySeverity(d.incidentsBySeverity || []);
      setUpcomingMaintenance(d.upcomingMaintenance || []);
      setRecentActivity(d.recentActivity || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  const totalIncidents = useMemo(() => incidentsBySeverity.reduce((s, i) => s + (i.count || 0), 0), [incidentsBySeverity]);
  const highPriority   = useMemo(() => incidentsBySeverity.filter(i => i.severity === 'Critical' || i.severity === 'High').reduce((s, i) => s + (i.count || 0), 0), [incidentsBySeverity]);

  const mockWS = { total: 450, assigned: 320, inStock: 130 };
  const distribution = [
    { label: 'Servers',         value: serverStats.total_servers || 0, color: 'var(--primary)' },
    { label: 'Workstations',    value: mockWS.total,                   color: 'var(--success)' },
    { label: 'Network Devices', value: 35,                             color: 'var(--warning)' },
  ];
  const distTotal = distribution.reduce((s, r) => s + r.value, 0) || 1;

  const alertRows = [
    ...upcomingMaintenance.slice(0, 3).map(m => ({
      type: 'maintenance',
      title: m.title || 'Scheduled maintenance',
      meta: `${m.server_code || 'Server'} · ${formatDate(m.scheduled_date)}`,
      priority: m.priority || 'Medium',
      time: m.scheduled_date,
    })),
    ...recentActivity.slice(0, 3).map(a => ({
      type: 'activity',
      title: `${a.username || 'User'} ${a.action || 'updated'} ${a.entity_type || 'asset'}`,
      meta: `${a.entity_type || 'System'} operation`,
      priority: 'Info',
      time: a.performed_at,
    })),
  ].slice(0, 5);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr  = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const shortcuts = [
    { href: '/servers',         icon: Server,      label: 'Servers & VMs',        desc: 'Manage compute assets and operational status.',     color: 'var(--primary)',  bg: 'var(--primary-soft)' },
    { href: '/workstations',    icon: Monitor,     label: 'Workstations / PCs',   desc: 'Track endpoint lifecycle, assignment, and inventory.', color: 'var(--success)', bg: 'var(--success-soft)' },
    { href: '/network-devices', icon: Router,      label: 'Network Devices',      desc: 'Monitor routers, switches, and edge assets.',         color: 'var(--warning)', bg: 'var(--warning-soft)' },
    { href: '/software',        icon: PackageCheck,label: 'Software & Licenses',  desc: 'Manage software inventory and license compliance.',   color: '#0EA5E9',         bg: 'rgba(14,165,233,0.10)' },
    { href: '/ipam',            icon: Network,     label: 'IPAM',                 desc: 'IP address management and subnet planning.',          color: '#8B5CF6',         bg: 'rgba(139,92,246,0.10)' },
    { href: '/reports',         icon: BarChart3,   label: 'Reports & Analytics',  desc: 'Operational insights, trends, and audit data.',       color: '#EC4899',         bg: 'rgba(236,72,153,0.10)' },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl border-2 border-[var(--primary)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-5 animate-in">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] leading-tight">{greeting} 👋</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{dateStr} · Enterprise IT Asset Hub</p>
          </div>
          <button type="button" onClick={loadDashboard} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* ── System Status Bar ── */}
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Shield className="w-3.5 h-3.5 text-[var(--success)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">System Status</span>
            <span className="ml-auto text-[10px] text-[var(--text-muted)]">Live monitoring</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatusPill label="Core Infrastructure" status={serverStats.inactive_servers > 0 ? 'degraded' : 'online'} />
            <StatusPill label="Network Layer"       status="online" />
            <StatusPill label="Security Services"   status="online" />
            <StatusPill label="Monitoring"          status={upcomingMaintenance.length > 3 ? 'degraded' : 'online'} />
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard
            label="Total Servers" value={serverStats.total_servers || 0}
            sub={`${serverStats.active_servers || 0} Active · ${serverStats.inactive_servers || 0} Offline`}
            icon={Server} iconBg="var(--primary-soft)" iconColor="var(--primary)" accent="var(--primary)" trend={2}
          />
          <StatCard
            label="Workstations" value={mockWS.total}
            sub={`${mockWS.assigned} Assigned · ${mockWS.inStock} In Stock`}
            icon={Monitor} iconBg="var(--success-soft)" iconColor="var(--success)" accent="var(--success)"
          />
          <StatCard
            label="Active Incidents" value={totalIncidents}
            sub={`${highPriority} High Priority`}
            icon={AlertTriangle} iconBg="var(--danger-soft)" iconColor="var(--danger)" accent="var(--danger)"
            trend={highPriority > 0 ? -highPriority : 0}
          />
          <StatCard
            label="Maintenance" value={upcomingMaintenance.length}
            sub={`${serverStats.maintenance_servers || 0} Servers in maintenance`}
            icon={Wrench} iconBg="var(--warning-soft)" iconColor="var(--warning)" accent="var(--warning)"
          />
        </div>

        {/* ── Main Row ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">

          {/* Alerts panel */}
          <div className="xl:col-span-3 card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Infrastructure Health & Alerts</h2>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Latest incidents, maintenance, and activity signals</p>
              </div>
              <Link href="/incidents" className="flex items-center gap-1 text-[11px] font-medium text-[var(--primary)] hover:underline">
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-3 space-y-2 flex-1">
              {!alertRows.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="w-9 h-9 text-[var(--success)] mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">All Clear</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">No alerts right now. Infrastructure is stable.</p>
                </div>
              ) : (
                alertRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background-soft)] p-3 flex items-start gap-3 hover:border-[var(--primary)] transition-colors"
                    style={{ borderLeft: `3px solid ${severityBorder(row.priority)}` }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: row.type === 'maintenance' ? 'var(--warning-soft)' : 'var(--primary-soft)' }}
                    >
                      {row.type === 'maintenance'
                        ? <Wrench className="w-4 h-4 text-[var(--warning)]" />
                        : <Activity className="w-4 h-4 text-[var(--primary)]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{row.title}</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{row.meta}</p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <span className={`block text-[10px] ${severityBadgeClass(row.priority)}`}>{row.priority}</span>
                      <p className="text-[10px] text-[var(--text-muted)]">{row.time ? timeAgo(row.time) : '—'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer quick actions */}
            <div className="px-3 pb-3 pt-2 border-t border-[var(--border)] bg-[var(--background-soft)] flex flex-wrap gap-2">
              <Link href="/servers/register" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Provision Server
              </Link>
              <Link href="/incidents" className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5" /> Log Incident
              </Link>
              <button type="button" disabled className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 opacity-40 cursor-not-allowed">
                <Monitor className="w-3.5 h-3.5" /> Assign PC
              </button>
            </div>
          </div>

          {/* Asset Distribution with donut */}
          <div className="xl:col-span-2 card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Asset Distribution</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Breakdown across key asset categories</p>
            </div>

            <div className="p-4 flex flex-col items-center gap-4 flex-1">
              {/* Donut */}
              <div className="relative">
                <DonutChart segments={distribution} size={128} stroke={16} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-bold text-[var(--text-primary)] leading-none">{distTotal.toLocaleString()}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Total</p>
                </div>
              </div>

              {/* Legend + bars */}
              <div className="w-full space-y-3">
                {distribution.map((row) => {
                  const pct = Math.round((row.value / distTotal) * 100);
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                          <span className="font-medium text-[var(--text-primary)]">{row.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text-primary)]">{row.value}</span>
                          <span className="text-[10px] text-[var(--text-muted)] w-7 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: row.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total tile */}
              <div className="w-full rounded-xl p-3" style={{ background: 'var(--background-soft)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-muted)]">Unified Asset Count</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-0.5">{distTotal.toLocaleString()}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">Servers + Workstations + Network devices</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation Shortcuts ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shortcuts.map(({ href, icon: Icon, label, desc, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="card p-4 flex items-start gap-3 hover:border-[var(--primary)] hover:shadow-md transition-all duration-200 group"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{ background: bg }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors flex-shrink-0" />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
