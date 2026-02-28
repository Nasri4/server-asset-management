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
  Cpu, Clock, MapPin, ArrowUpRight,
} from 'lucide-react';

/* ─── Styles ─── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Nunito:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

  :root {
    --ink:        #0f172a;
    --paper:      #f0f4ff;
    --card-bg:    #ffffff;
    --section-bg: #f8faff;
    --muted:      #94a3b8;
    --muted2:     #cbd5e1;
    --accent:     #2563EB;
    --accent-soft:#eff4ff;
    --panel:      #0f1829;
    --border:     #e1e9f8;
    --border-str: #c7d7f5;
    --ok:         #6eb894;
    --ok-soft:    #edf7f2;
    --warn:       #d4924a;
    --warn-soft:  #fdf3e7;
    --danger:     #c05c5c;
    --danger-soft:#fdf0f0;
    --info:       #5b87c9;
    --info-soft:  #eef3fb;
    --text-pri:   #0f172a;
    --text-sec:   #475569;
  }
  .dark {
    --paper:      #080d1a;
    --card-bg:    #0e1525;
    --section-bg: #111827;
    --border:     #1e2d4f;
    --border-str: #2a3f6f;
    --text-pri:   #e2e8f0;
    --text-sec:   #94a3b8;
    --muted:      #64748b;
    --muted2:     #334155;
    --accent-soft:#0f1e3d;
    --ok-soft:    #0e1f18;
    --warn-soft:  #1e1508;
    --danger-soft:#1e0e0e;
    --info-soft:  #0e1525;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .db-root {
    font-family: 'Plus Jakarta Sans', sans-serif;
    color: var(--text-pri);
    padding: 2rem 2rem 3rem;
    max-width: 1280px;
    margin: 0 auto;
    animation: rootIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes rootIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }

  /* ── Section spacing ── */
  .db-section { margin-top: 2.5rem; }

  /* ── Page header ── */
  .db-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  .db-eyebrow {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent);
    margin-bottom: 0.35rem;
  }
  .db-title {
    font-family: 'Nunito', sans-serif;
    font-size: 2.2rem;
    font-weight: 500;
    color: var(--text-pri);
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .db-sub {
    font-size: 0.72rem;
    color: var(--muted);
    margin-top: 0.35rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .db-sub-dot {
    width: 3px; height: 3px; border-radius: 50%;
    background: var(--muted2); flex-shrink: 0;
  }
  .header-right { display: flex; align-items: center; gap: 0.75rem; }

  /* ── Badges ── */
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.62rem; font-weight: 600;
    padding: 4px 10px; border-radius: 100px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .badge-ok    { background: var(--ok-soft);     color: var(--ok);     border: 1px solid rgba(110,184,148,0.25); }
  .badge-warn  { background: var(--warn-soft);   color: var(--warn);   border: 1px solid rgba(212,146,74,0.25); }
  .badge-danger{ background: var(--danger-soft); color: var(--danger); border: 1px solid rgba(192,92,92,0.25); }
  .badge-info  { background: var(--info-soft);   color: var(--info);   border: 1px solid rgba(91,135,201,0.25); }
  .badge-accent{ background: var(--accent-soft); color: var(--accent); border: 1px solid rgba(37,99,235,0.20); }
  .badge-muted { background: var(--section-bg);  color: var(--muted);  border: 1px solid var(--border); }

  .pulse-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: currentColor;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.4; transform:scale(0.8); }
  }

  /* ── Btn ── */
  .btn-ghost {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.72rem; font-weight: 500;
    color: var(--text-sec);
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 14px;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex; align-items: center; gap: 5px;
    transition: border-color 0.15s, color 0.15s;
  }
  .btn-ghost:hover { border-color: var(--border-str); color: var(--text-pri); }

  /* ── KPI Grid ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }
  .kpi-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem 1.25rem 1.25rem;
    position: relative;
    overflow: hidden;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    animation: cardIn 0.6s cubic-bezier(0.22,1,0.36,1) both;
  }
  .kpi-card:hover {
    border-color: var(--border-str);
    box-shadow: 0 4px 20px rgba(15,17,23,0.06);
    transform: translateY(-1px);
  }
  .kpi-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: var(--kpi-accent, var(--border));
    border-radius: 16px 16px 0 0;
  }
  @keyframes cardIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }

  .kpi-top { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; margin-bottom: 1rem; width: 100%; }
  .kpi-icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .kpi-value {
    font-family: 'Nunito', sans-serif;
    font-size: 2.6rem; font-weight: 700;
    line-height: 1; color: var(--text-pri);
    letter-spacing: -0.02em;
  }
  .kpi-label { font-size: 0.68rem; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500; text-align: center; }

  /* ── Card ── */
  .d-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .d-card:hover { border-color: var(--border-str); }

  .card-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--section-bg);
  }
  .card-head-left { display: flex; align-items: center; gap: 0.6rem; }
  .card-head-dot {
    width: 7px; height: 7px; border-radius: 50%;
    flex-shrink: 0;
  }
  .card-head-title {
    font-size: 0.78rem; font-weight: 600;
    color: var(--text-pri); letter-spacing: 0.01em;
  }
  .card-head-sub { font-size: 0.65rem; color: var(--muted); }
  .card-link {
    font-size: 0.68rem; font-weight: 500;
    color: var(--accent); text-decoration: none;
    display: inline-flex; align-items: center; gap: 3px;
    transition: opacity 0.15s;
  }
  .card-link:hover { opacity: 0.75; }
  .card-body { padding: 1.25rem; }

  /* ── Bar chart ── */
  .bar-row { display: flex; flex-direction: column; gap: 0.9rem; }
  .bar-item {}
  .bar-meta {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 6px;
  }
  .bar-label-left { display: flex; align-items: center; gap: 7px; font-size: 0.76rem; font-weight: 500; color: var(--text-pri); }
  .bar-swatch { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .bar-right { display: flex; align-items: center; gap: 0.75rem; }
  .bar-count { font-size: 0.8rem; font-weight: 700; color: var(--text-pri); font-family: 'Nunito', sans-serif; }
  .bar-pct   { font-size: 0.65rem; color: var(--muted); font-weight: 500; min-width: 34px; text-align: right; }
  .bar-track { height: 6px; background: var(--section-bg); border-radius: 99px; overflow: hidden; border: 1px solid var(--border); }
  .bar-fill  { height: 100%; border-radius: 99px; transition: width 0.8s cubic-bezier(0.22,1,0.36,1); }

  /* ── Health summary row ── */
  .health-summary {
    margin-top: 1.25rem; padding-top: 1.25rem;
    border-top: 1px solid var(--border);
    display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
  }
  .hs-item {}
  .hs-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 3px; }
  .hs-value { font-family: 'Nunito', sans-serif; font-size: 1.8rem; font-weight: 500; line-height: 1; }

  /* ── Maintenance list ── */
  .maint-list { display: flex; flex-direction: column; gap: 0.6rem; }
  .maint-item {
    display: flex; align-items: center; gap: 0.85rem;
    padding: 0.85rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--section-bg);
    transition: border-color 0.15s, background 0.15s;
  }
  .maint-item:hover { border-color: var(--border-str); background: var(--card-bg); }
  .maint-icon {
    width: 34px; height: 34px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .maint-body { flex: 1; min-width: 0; }
  .maint-title { font-size: 0.76rem; font-weight: 500; color: var(--text-pri); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .maint-meta  { display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap; }
  .maint-code  { font-size: 0.65rem; font-family: monospace; color: var(--muted); }
  .maint-right { text-align: right; flex-shrink: 0; }
  .maint-time  { display: flex; align-items: center; gap: 3px; font-size: 0.65rem; color: var(--muted); }

  /* ── Activity timeline ── */
  .timeline { display: flex; flex-direction: column; gap: 0; }
  .tl-item  { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.6rem 0; position: relative; }
  .tl-item + .tl-item { border-top: 1px solid var(--border); }
  .tl-dot {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px;
  }
  .tl-body { flex: 1; min-width: 0; }
  .tl-who  { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .tl-user { font-size: 0.76rem; font-weight: 600; color: var(--text-pri); }
  .tl-entity {
    font-size: 0.6rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; padding: 2px 7px; border-radius: 4px;
    background: var(--accent-soft); color: var(--accent);
  }
  .tl-action { font-size: 0.72rem; color: var(--text-sec); margin-top: 1px; }
  .tl-time   { font-size: 0.62rem; color: var(--muted); margin-top: 2px; }

  /* ── Workspace grid ── */
  .ws-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 1rem;
  }
  .ws-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .ws-card:hover { border-color: var(--border-str); box-shadow: 0 4px 16px rgba(15,17,23,0.05); }
  .ws-head {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.75rem 0.9rem;
    border-bottom: 1px solid var(--border);
    background: var(--section-bg);
  }
  .ws-head-title { font-size: 0.74rem; font-weight: 600; color: var(--text-pri); flex: 1; }
  .ws-body { padding: 0.6rem 0.9rem; max-height: 160px; overflow-y: auto; }
  .ws-item { padding: 0.35rem 0; }
  .ws-item + .ws-item { border-top: 1px solid var(--border); }
  .ws-link { font-size: 0.74rem; color: var(--accent); text-decoration: none; font-weight: 500; font-family: monospace; }
  .ws-link:hover { opacity: 0.75; }
  .ws-sub  { font-size: 0.65rem; color: var(--muted); margin-top: 1px; }
  .ws-foot { padding: 0.5rem 0.9rem; border-top: 1px solid var(--border); }
  .ws-foot a { font-size: 0.65rem; font-weight: 500; color: var(--accent); text-decoration: none; }

  /* ── Summary cards ── */
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
  .summary-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.1rem 1.1rem 0.9rem;
    display: flex; flex-direction: column; gap: 0.6rem;
    transition: border-color 0.2s, transform 0.2s;
  }
  .summary-card:hover { border-color: var(--border-str); transform: translateY(-1px); }
  .summary-top { display: flex; align-items: center; gap: 0.75rem; }
  .summary-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .summary-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .summary-value { font-family: 'Nunito', sans-serif; font-size: 1.8rem; font-weight: 500; line-height: 1; color: var(--text-pri); }
  .summary-note  { font-size: 0.65rem; font-weight: 500; }

  /* ── Two-col ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

  /* ── Section heading ── */
  .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; }
  .section-title {
    font-size: 0.72rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--muted); display: flex; align-items: center; gap: 6px;
  }
  .section-title-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }

  /* ── Empty state ── */
  .empty-state { padding: 2.5rem 1rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
  .empty-icon  { color: var(--muted2); margin-bottom: 4px; }
  .empty-title { font-size: 0.8rem; font-weight: 600; color: var(--text-pri); }
  .empty-desc  { font-size: 0.72rem; color: var(--muted); }

  /* ── Loading ── */
  .db-loading {
    display: flex; align-items: center; justify-content: center;
    min-height: 60vh; gap: 0.75rem;
    font-size: 0.8rem; color: var(--muted);
  }
  .db-loading svg { color: var(--accent); }

  /* scrollbar */
  .thin-scroll::-webkit-scrollbar { width: 4px; }
  .thin-scroll::-webkit-scrollbar-track { background: transparent; }
  .thin-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
`;

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData]           = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { loadDashboard(); }, []);
  useEffect(() => {
    if (user?.engineer_id) {
      api.get('/dashboard/engineer-workspace').then(r => setWorkspace(r.data)).catch(() => setWorkspace(null));
    } else { setWorkspace(null); }
  }, [user?.engineer_id]);

  async function loadDashboard() {
    try { const r = await api.get('/dashboard'); setData(r.data); }
    catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <>
      <style>{styles}</style>
      <div className="db-loading">
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading operations center…</span>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );

  const stats     = data?.serverStats || {};
  const incidents = data?.incidentsBySeverity || [];
  const upcoming  = data?.upcomingMaintenance || [];
  const activity  = data?.recentActivity || [];
  const totalInc  = incidents.reduce((s, i) => s + i.count, 0);
  const uptime    = 99.98;
  const activePct = Math.round((stats.active_servers || 0) / (stats.total_servers || 1) * 100);
  const maintPct  = Math.round((stats.maintenance_servers || 0) / (stats.total_servers || 1) * 100);

  const severityColors = {
    Critical: { bar: '#c05c5c', swatch: '#c05c5c' },
    High:     { bar: '#d4924a', swatch: '#d4924a' },
    Medium:   { bar: '#5b87c9', swatch: '#5b87c9' },
    Low:      { bar: '#6eb894', swatch: '#6eb894' },
  };
  const healthColors = {
    Active:          '#6eb894',
    Inactive:        '#9a9490',
    Maintenance:     '#d4924a',
    Decommissioned:  '#c05c5c',
  };

  return (
    <>
      <style>{styles}</style>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div className="db-root">

        {/* ── Header ── */}
        <header className="db-header">
          <div>
            <div className="db-eyebrow">Operations Center</div>
            <h1 className="db-title">
              {user?.full_name?.split(' ')[0]
                ? `Welcome, ${user.full_name.split(' ')[0]}`
                : 'Dashboard'}
            </h1>
            <p className="db-sub">
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <span className="db-sub-dot" />
              <span>Hormuud Asset Management</span>
            </p>
          </div>
          <div className="header-right">
            <span className="badge badge-ok">
              <span className="pulse-dot" style={{ width: 5, height: 5 }} />
              {uptime}% Uptime
            </span>
            <Link href="/reports" className="btn-ghost">
              Reports <ArrowUpRight size={11} />
            </Link>
          </div>
        </header>

        {/* ── KPI Row ── */}
        <div className="kpi-grid" style={{ marginTop: '1.75rem' }}>
          {[
            { label: 'Total Servers',      value: stats.total_servers   || 0, badge: 'Fleet',                 badgeClass: 'badge-accent',  icon: Server,       iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)',  kpiAccent: 'var(--accent)',  delay: '0ms' },
            { label: 'Active',             value: stats.active_servers  || 0, badge: `${activePct}% online`,  badgeClass: 'badge-ok',      icon: CheckCircle2, iconBg: 'var(--ok-soft)',    iconColor: 'var(--ok)',      kpiAccent: 'var(--ok)',      delay: '60ms' },
            { label: 'Open Incidents',     value: totalInc,                   badge: `${incidents.find(i=>i.severity==='Critical')?.count||0} critical`, badgeClass: 'badge-danger', icon: AlertTriangle, iconBg: 'var(--danger-soft)', iconColor: 'var(--danger)', kpiAccent: 'var(--danger)', delay: '120ms' },
            { label: 'Under Maintenance',  value: stats.maintenance_servers||0, badge: `${data?.overdueCount||0} overdue`, badgeClass: 'badge-warn', icon: Wrench, iconBg: 'var(--warn-soft)', iconColor: 'var(--warn)', kpiAccent: 'var(--warn)', delay: '180ms' },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="kpi-card" style={{ '--kpi-accent': kpi.kpiAccent, animationDelay: kpi.delay }}>
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: kpi.iconBg }}>
                    <Icon size={15} style={{ color: kpi.iconColor }} />
                  </div>
                  <span className={`badge ${kpi.badgeClass}`}>{kpi.badge}</span>
                </div>
                <div className="kpi-value">{kpi.value.toLocaleString()}</div>
                <div className="kpi-label">{kpi.label}</div>
              </div>
            );
          })}
        </div>

        {/* ── Engineer Workspace ── */}
        {user?.engineer_id && workspace && (
          <div className="db-section">
            <div className="section-head">
              <div className="section-title">
                <span className="section-title-dot" />
                My Operations
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Your assigned work</span>
            </div>
            <div className="ws-grid">
              {[
                { title: 'Assigned Servers', icon: Server,        iconColor: 'var(--accent)',  items: workspace.assignedServers||[], linkAll: '/servers',     render: s => (
                  <div key={s.server_id} className="ws-item">
                    <Link href={`/servers/${s.server_id}`} className="ws-link">{s.server_code}</Link>
                    <div className="ws-sub">{s.hostname}</div>
                  </div>
                )},
                { title: 'Active Maintenance', icon: Wrench,      iconColor: 'var(--warn)',    items: workspace.myMaintenance||[], linkAll: '/maintenance',  render: m => (
                  <div key={m.maintenance_id} className="ws-item">
                    <Link href={`/maintenance?id=${m.maintenance_id}`} style={{fontSize:'0.74rem',color:'var(--text-pri)',textDecoration:'none'}} className="ws-title-link">{m.title}</Link>
                    <div className="ws-sub">{m.server_code} · {formatDate(m.scheduled_date)}</div>
                  </div>
                )},
                { title: 'Open Incidents',   icon: AlertTriangle, iconColor: 'var(--danger)',  items: workspace.myIncidents||[], linkAll: '/incidents',    render: i => (
                  <div key={i.incident_id} className="ws-item">
                    <Link href={`/incidents?id=${i.incident_id}`} style={{fontSize:'0.74rem',color:'var(--text-pri)',textDecoration:'none'}}>{i.title}</Link>
                    <div className="ws-sub">{i.server_code} · <span style={{color:'var(--danger)'}}>{i.severity}</span></div>
                  </div>
                )},
                { title: 'Upcoming Visits',  icon: MapPin,        iconColor: 'var(--ok)',      items: workspace.myVisits||[], linkAll: '/servers', linkLabel: 'My servers', render: v => (
                  <div key={v.visit_id} className="ws-item">
                    <Link href={`/servers/${v.server_id}`} className="ws-link">{v.server_code}</Link>
                    <div className="ws-sub">{formatDate(v.visit_date)} · {v.visit_type||'Visit'}</div>
                  </div>
                )},
              ].map(sec => {
                const Icon = sec.icon;
                return (
                  <div key={sec.title} className="ws-card">
                    <div className="ws-head">
                      <Icon size={13} style={{ color: sec.iconColor, flexShrink: 0 }} />
                      <span className="ws-head-title">{sec.title}</span>
                      {sec.items.length > 0 && <span className="badge badge-muted" style={{fontSize:'0.58rem',padding:'2px 7px'}}>{sec.items.length}</span>}
                    </div>
                    <div className="ws-body thin-scroll">
                      {sec.items.length === 0
                        ? <div style={{padding:'1rem 0',textAlign:'center',fontSize:'0.7rem',color:'var(--muted)'}}>None assigned</div>
                        : sec.items.map(sec.render)
                      }
                    </div>
                    <div className="ws-foot">
                      <Link href={sec.linkAll}>{sec.linkLabel || 'View all'} →</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Charts ── */}
        <div className="two-col db-section">

          {/* Incidents by severity */}
          <div className="d-card">
            <div className="card-head">
              <div className="card-head-left">
                <div className="card-head-dot" style={{ background: 'var(--danger)' }} />
                <span className="card-head-title">Incidents by Severity</span>
              </div>
              <Link href="/incidents" className="card-link">View all <ArrowRight size={11} /></Link>
            </div>
            <div className="card-body">
              {incidents.length ? (
                <div className="bar-row">
                  {incidents.map(inc => {
                    const c = severityColors[inc.severity] || { bar: 'var(--muted)', swatch: 'var(--muted)' };
                    return (
                      <div className="bar-item" key={inc.severity}>
                        <div className="bar-meta">
                          <div className="bar-label-left">
                            <div className="bar-swatch" style={{ background: c.swatch }} />
                            {inc.severity}
                          </div>
                          <div className="bar-right">
                            <span className="bar-count">{inc.count}</span>
                            <span className="bar-pct">{Math.round((inc.count/totalInc)*100)||0}%</span>
                          </div>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${(inc.count/totalInc)*100}%`, background: c.bar }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <CheckCircle2 size={28} className="empty-icon" style={{ color: 'var(--ok)' }} />
                  <div className="empty-title">All Clear</div>
                  <div className="empty-desc">No open incidents reported</div>
                </div>
              )}
            </div>
          </div>

          {/* Server Health */}
          <div className="d-card">
            <div className="card-head">
              <div className="card-head-left">
                <div className="card-head-dot" style={{ background: 'var(--ok)' }} />
                <span className="card-head-title">Server Health</span>
              </div>
              <span className="card-head-sub">{stats.total_servers||0} total</span>
            </div>
            <div className="card-body">
              <div className="bar-row">
                {[
                  { label: 'Active',         count: stats.active_servers,         total: stats.total_servers },
                  { label: 'Inactive',       count: stats.inactive_servers,       total: stats.total_servers },
                  { label: 'Maintenance',    count: stats.maintenance_servers,    total: stats.total_servers },
                  { label: 'Decommissioned', count: stats.decommissioned_servers, total: stats.total_servers },
                ].map(s => {
                  const pct = Math.round(((s.count||0)/(s.total||1))*100);
                  const color = healthColors[s.label];
                  return (
                    <div className="bar-item" key={s.label}>
                      <div className="bar-meta">
                        <div className="bar-label-left">
                          <div className="bar-swatch" style={{ background: color }} />
                          {s.label}
                        </div>
                        <div className="bar-right">
                          <span className="bar-count">{s.count||0}</span>
                          <span className="bar-pct">{pct}%</span>
                        </div>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="health-summary">
                <div className="hs-item">
                  <div className="hs-label">Avg. Uptime</div>
                  <div className="hs-value" style={{ color: 'var(--text-pri)' }}>99.98%</div>
                </div>
                <div className="hs-item">
                  <div className="hs-label">Health Score</div>
                  <div className="hs-value" style={{ color: 'var(--ok)' }}>A+</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Maintenance & Activity ── */}
        <div className="two-col db-section">

          {/* Upcoming Maintenance */}
          <div className="d-card">
            <div className="card-head">
              <div className="card-head-left">
                <div className="card-head-dot" style={{ background: 'var(--warn)' }} />
                <span className="card-head-title">Upcoming Maintenance</span>
              </div>
              <Link href="/maintenance" className="card-link">Schedule <ArrowRight size={11} /></Link>
            </div>
            <div className="card-body">
              {upcoming.length ? (
                <div className="maint-list">
                  {upcoming.map((m, i) => (
                    <div key={m.maintenance_id} className="maint-item">
                      <div className="maint-icon" style={{ background: i === 0 ? 'var(--warn-soft)' : 'var(--section-bg)' }}>
                        <Wrench size={14} style={{ color: i === 0 ? 'var(--warn)' : 'var(--muted)' }} />
                      </div>
                      <div className="maint-body">
                        <div className="maint-title">{m.title}</div>
                        <div className="maint-meta">
                          <span className="maint-code">{m.server_code}</span>
                          <span className={`badge ${m.priority==='High'?'badge-danger':m.priority==='Medium'?'badge-warn':'badge-info'}`}
                            style={{ fontSize: '0.58rem', padding: '1px 6px' }}>
                            {m.priority}
                          </span>
                        </div>
                      </div>
                      <div className="maint-right">
                        <div className="maint-time">
                          <Clock size={10} />
                          {formatDateTime(m.scheduled_date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <CheckCircle2 size={28} className="empty-icon" style={{ color: 'var(--ok)' }} />
                  <div className="empty-title">No Scheduled Maintenance</div>
                  <div className="empty-desc">All systems running smoothly</div>
                </div>
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="d-card">
            <div className="card-head">
              <div className="card-head-left">
                <div className="card-head-dot pulse-dot" style={{ background: 'var(--accent)', animationDuration: '2s' }} />
                <span className="card-head-title">Activity Timeline</span>
              </div>
              <Link href="/audit-log" className="card-link">Full log <ArrowRight size={11} /></Link>
            </div>
            <div className="card-body thin-scroll" style={{ maxHeight: 400, overflowY: 'auto' }}>
              {activity.length ? (
                <div className="timeline">
                  {activity.map((a, i) => (
                    <div key={a.log_id} className="tl-item">
                      <div className="tl-dot" style={{ background: i === 0 ? 'var(--accent-soft)' : 'var(--section-bg)' }}>
                        <Activity size={13} style={{ color: i === 0 ? 'var(--accent)' : 'var(--muted)' }} />
                      </div>
                      <div className="tl-body">
                        <div className="tl-who">
                          <span className="tl-user">{a.username}</span>
                          <span className="tl-entity">{a.entity_type}</span>
                        </div>
                        <div className="tl-action"><strong>{a.action}</strong> operation</div>
                        <div className="tl-time">{timeAgo(a.performed_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Activity size={28} className="empty-icon" />
                  <div className="empty-title">No Activity Yet</div>
                  <div className="empty-desc">System activity will appear here</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="summary-grid db-section">
          <div className="summary-card">
            <div className="summary-top">
              <div className="summary-icon" style={{ background: 'var(--warn-soft)' }}>
                <ShieldAlert size={16} style={{ color: 'var(--warn)' }} />
              </div>
              <div>
                <div className="summary-label">Expiring Warranties</div>
                <div className="summary-value">{data?.expiringWarranties||0}</div>
              </div>
            </div>
            <div className="summary-note" style={{ color: 'var(--warn)' }}>Within 90 days — review required</div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div className="summary-icon" style={{ background: 'var(--accent-soft)' }}>
                <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="summary-label">Under Maintenance</div>
                <div className="summary-value">{stats.maintenance_servers||0}</div>
              </div>
            </div>
            <div className="summary-note" style={{ color: 'var(--text-sec)' }}>{maintPct}% of {stats.total_servers||0} total servers</div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div className="summary-icon" style={{ background: 'var(--ok-soft)' }}>
                <Cpu size={16} style={{ color: 'var(--ok)' }} />
              </div>
              <div>
                <div className="summary-label">Total Infrastructure</div>
                <div className="summary-value">{stats.total_servers||0}</div>
              </div>
            </div>
            <div className="summary-note" style={{ color: 'var(--ok)' }}>{stats.active_servers||0} operational · {activePct}% active</div>
          </div>
        </div>

      </div>
    </>
  );
}