'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import {
  Server, Loader2, Pencil, Eye, Search, Trash2, KeyRound,
  ShieldCheck, Copy, EyeOff, X, ChevronLeft, ChevronRight,
  Database, Plus, AlertTriangle, CheckCircle2,
  WifiOff, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

/* ╔══════════════════════════════════════════════════════════════╗
   ║  DESIGN SYSTEM — TELCO Server Inventory                     ║
   ╚══════════════════════════════════════════════════════════════╝ */
const DS = {
  /* Surfaces */
  pageBg:      '#EDF1F7',
  cardBg:      '#FFFFFF',
  headerBg:    '#F8FAFC',
  rowSep:      '#F1F5F9',        /* ultra-subtle horizontal row divider */
  rowHover:    '#F0F9FF',
  rowHoverBorder: '#BAE6FD',

  /* Borders */
  outerBorder: '#DDE4EE',
  headerLine:  '#E2E8F0',        /* header bottom 2px line */

  /* Typography — strict hierarchy */
  inkBlack:    '#0F172A',        /* primary data — near-black for max contrast */
  inkDark:     '#1E293B',        /* headings */
  inkMid:      '#475569',        /* secondary labels, sub-values */
  inkMuted:    '#94A3B8',        /* placeholders, tertiary */
  inkHead:     '#64748B',        /* column headers */

  /* Accent */
  blue:        '#17A4F7',
  blueSoft:    'rgba(23,164,247,0.10)',
  blueBorder:  'rgba(23,164,247,0.25)',

  /* Semantic */
  green:       '#16A34A',
  greenSoft:   'rgba(22,163,74,0.10)',
  amber:       '#D97706',
  amberSoft:   'rgba(217,119,6,0.10)',
  red:         '#DC2626',
  redSoft:     'rgba(220,38,38,0.09)',
  slate:       '#64748B',
  slateSoft:   'rgba(100,116,139,0.10)',

  /* Fonts */
  sans:   "'Inter', system-ui, -apple-system, sans-serif",
  mono:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",

  /* Geometry */
  r4:  4,
  r8:  8,
  r12: 12,
  r16: 16,
};

/* ─── Status helpers ─────────────────────────────────────────────
   Returns only a dot color + soft readable text color.
   No backgrounds, no borders — just a dot and text.
─────────────────────────────────────────────────────────────── */
function getStatusMeta(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'online')
    return { dot: '#22C55E', color: '#15803D' };
  if (s === 'maintenance' || s === 'under maintenance')
    return { dot: '#F59E0B', color: '#92400E' };
  if (s === 'high load')
    return { dot: '#F97316', color: '#9A3412' };
  if (s === 'inactive' || s === 'offline' || s === 'decommissioned')
    return { dot: '#F87171', color: '#991B1B' };
  return { dot: '#94A3B8', color: DS.inkMid };
}

/* ╔══════════════════════════════════════════════════════════════╗
   ║  SUB-COMPONENTS                                              ║
   ╚══════════════════════════════════════════════════════════════╝ */

/* Status — soft dot + plain colored text, no pill/badge */
function StatusDot({ status }) {
  if (!status) return <span style={{ color: DS.inkMuted, fontSize: 13 }}>—</span>;
  const m = getStatusMeta(status);
  const isActive = status.toLowerCase() === 'active' || status.toLowerCase() === 'online';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      fontSize: 13, fontWeight: 500,
      color: m.color, fontFamily: DS.sans,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isActive && (
          <span style={{
            position: 'absolute', width: 14, height: 14, borderRadius: '50%',
            background: m.dot, opacity: 0.2,
            animation: 'pulse-ring 2s ease-in-out infinite',
          }} />
        )}
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      </span>
      {status}
    </span>
  );
}

/* KPI metric card — icon left, number + label right */
function KpiCard({ icon: Icon, value, label, accent, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: DS.cardBg,
      border: `1px solid ${DS.outerBorder}`,
      borderRadius: DS.r12,
      padding: '14px 18px',
      boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03)',
      minWidth: 160, flex: 1,
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      cursor: 'default',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.09)';
      e.currentTarget.style.transform = 'translateY(-1px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}
    >
      {/* Icon container */}
      <div style={{
        width: 46, height: 46, borderRadius: DS.r8,
        background: `${accent}18`,
        border: `1px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={20} color={accent} strokeWidth={1.8} />
      </div>
      {/* Metric */}
      <div>
        <div style={{
          fontSize: 26, fontWeight: 800, color: DS.inkDark,
          lineHeight: 1, fontFamily: DS.sans, letterSpacing: '-0.03em',
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: DS.inkMuted,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          marginTop: 4, fontFamily: DS.sans,
        }}>
          {label}
        </div>
        {sub !== undefined && (
          <div style={{ fontSize: 11, color: DS.inkMuted, marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════════════╗
   ║  PAGE                                                        ║
   ╚══════════════════════════════════════════════════════════════╝ */
export default function ServersPage() {
  const [data, setData]         = useState({ servers: [], total: 0, page: 1, page_size: 25 });
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [searchSubmit, setSearchSubmit] = useState('');

  const [selected, setSelected]         = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const [credModal, setCredModal]     = useState(null);
  const [credOtp, setCredOtp]         = useState('');
  const [credLoading, setCredLoading] = useState(false);
  const [showPassMap, setShowPassMap] = useState({});

  useEffect(() => {
    const open = !!deleteTarget || !!credModal;
    document.body.classList.toggle('modal-open', open);
    return () => document.body.classList.remove('modal-open');
  }, [deleteTarget, credModal]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, page_size: 25 };
    if (searchSubmit) params.search = searchSubmit;
    api.get('/servers', { params })
      .then((r) => setData({
        servers:   r.data?.servers   ?? [],
        total:     r.data?.total     ?? 0,
        page:      r.data?.page      ?? page,
        page_size: r.data?.page_size ?? 25,
      }))
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load servers');
        setData((d) => ({ ...d, servers: [] }));
      })
      .finally(() => setLoading(false));
  }, [page, searchSubmit]);

  useEffect(() => { load(); }, [load]);

  const totalPages  = Math.max(1, Math.ceil(data.total / data.page_size));
  const rowOffset   = (data.page - 1) * data.page_size;

  /* Checkbox helpers */
  const allIds     = data.servers.map(s => s.server_id);
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someChecked = !allChecked && allIds.some(id => selected.has(id));
  const toggleAll  = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(allIds));
  };
  const toggleRow  = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  /* KPI counters */
  const kpiActive  = data.servers.filter(s => ['active','online'].includes(s.status?.toLowerCase())).length;
  const kpiWarn    = data.servers.filter(s => ['maintenance','under maintenance','high load'].includes(s.status?.toLowerCase())).length;
  const kpiOffline = data.servers.filter(s => ['inactive','offline','decommissioned'].includes(s.status?.toLowerCase())).length;

  const handleSearch = (e) => {
    e?.preventDefault();
    setSearchSubmit(search.trim());
    setPage(1);
  };
  const clearSearch = () => { setSearch(''); setSearchSubmit(''); setPage(1); };

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete('/servers/' + deleteTarget.server_id);
      toast.success(`${deleteTarget.server_code} decommissioned`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete server');
    } finally {
      setDeleting(false);
    }
  }

  function openCredModal(server) {
    setCredModal({ server, step: 'request', credentials: [], devOtp: null });
    setCredOtp('');
    setShowPassMap({});
  }
  function closeCredModal() {
    setCredModal(null);
    setCredOtp('');
    setCredLoading(false);
  }

  async function handleRequestOtp() {
    if (!credModal) return;
    setCredLoading(true);
    try {
      const res = await api.post('/otp/request', {
        purpose: 'credentials_' + credModal.server.server_id,
        method: 'sms',
      });
      toast.success(res.data?.message || 'OTP sent');
      setCredModal((m) => ({ ...m, step: 'verify', devOtp: res.data?.devOtp || null }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setCredLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!credModal || !credOtp.trim()) return;
    setCredLoading(true);
    try {
      const res = await api.post(
        '/servers/' + credModal.server.server_id + '/credentials/unlock',
        { otp: credOtp.trim() }
      );
      setCredModal((m) => ({ ...m, step: 'show', credentials: res.data?.credentials || [] }));
      setCredOtp('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setCredLoading(false);
    }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard?.writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error('Copy failed'));
  }

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <div className="animate-in" style={{
      display: 'flex', flexDirection: 'column', gap: 20,
      fontFamily: DS.sans,
    }}>

      {/* ──────────────────────────────────────────────
          PAGE HEADER
      ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        {/* Left: icon + title + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Icon box with gradient */}
          <div style={{
            width: 52, height: 52, borderRadius: DS.r12, flexShrink: 0,
            background: 'linear-gradient(135deg, #17A4F7 0%, #0B8FDE 100%)',
            boxShadow: '0 4px 14px rgba(23,164,247,0.35), 0 1px 3px rgba(23,164,247,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Server size={24} color="#fff" strokeWidth={1.8} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{
                fontSize: 22, fontWeight: 800, color: DS.inkDark,
                letterSpacing: '-0.025em', margin: 0, lineHeight: 1.15,
              }}>
                Server Inventory
              </h1>
              {!loading && (
                <span style={{
                  padding: '3px 10px',
                  background: DS.blueSoft, color: DS.blue,
                  border: `1px solid ${DS.blueBorder}`,
                  borderRadius: 20,
                  fontSize: 12, fontWeight: 700,
                  fontFamily: DS.mono,
                }}>
                  {data.total}
                </span>
              )}
            </div>
            <p style={{
              margin: '5px 0 0', fontSize: 14, color: DS.inkMuted,
              fontWeight: 400, lineHeight: 1.4,
            }}>
              Manage and monitor all registered server assets
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={load}
            title="Refresh"
            style={{
              width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: DS.cardBg, border: `1px solid ${DS.outerBorder}`,
              borderRadius: DS.r8, cursor: 'pointer', color: DS.inkMuted,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = DS.headerBg; e.currentTarget.style.color = DS.inkMid; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = DS.cardBg; e.currentTarget.style.color = DS.inkMuted; }}
          >
            <RefreshCw size={15} strokeWidth={2} />
          </button>

          <Link href="/servers/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 18px',
            background: 'linear-gradient(135deg, #17A4F7 0%, #0B8FDE 100%)',
            color: '#fff',
            borderRadius: DS.r8,
            fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(23,164,247,0.35)',
            border: '1px solid rgba(255,255,255,0.15)',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(23,164,247,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(23,164,247,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Register Server
          </Link>
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          KPI STRIP
      ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard icon={Database}      value={loading ? '—' : data.total}   label="Total Servers"   accent="#17A4F7" />
        <KpiCard icon={CheckCircle2}  value={loading ? '—' : kpiActive}    label="Online"          accent="#16A34A" />
        <KpiCard icon={AlertTriangle} value={loading ? '—' : kpiWarn}      label="Maintenance"     accent="#D97706" />
        <KpiCard icon={WifiOff}       value={loading ? '—' : kpiOffline}   label="Offline"         accent="#DC2626" />
      </div>

      {/* ──────────────────────────────────────────────
          TABLE CARD
      ────────────────────────────────────────────── */}
      <div style={{
        background: DS.cardBg,
        border: `1px solid ${DS.outerBorder}`,
        borderRadius: DS.r16,
        boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.04)',
        overflow: 'hidden',
      }}>

        {/* ── Toolbar ─────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          background: DS.headerBg,
          borderBottom: `1px solid ${DS.outerBorder}`,
        }}>
          {/* Search input */}
          <form
            onSubmit={handleSearch}
            style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 400 }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={15}
                style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)', color: DS.inkMuted,
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search by code, hostname, IP address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', height: 38,
                  padding: '0 36px 0 38px',
                  background: DS.cardBg,
                  border: `1px solid ${DS.outerBorder}`,
                  borderRadius: DS.r8,
                  fontSize: 14, color: DS.inkBlack,
                  fontFamily: DS.sans, outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = DS.blue;
                  e.target.style.boxShadow = `0 0 0 3px ${DS.blueSoft}`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = DS.outerBorder;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: DS.inkMuted,
                    display: 'flex', alignItems: 'center', padding: 2,
                    borderRadius: 4,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="submit"
              style={{
                height: 38, padding: '0 16px',
                background: DS.cardBg,
                border: `1px solid ${DS.outerBorder}`,
                borderRadius: DS.r8,
                fontSize: 14, fontWeight: 600,
                color: DS.inkMid, cursor: 'pointer',
                fontFamily: DS.sans, whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#EDF1F7'; e.currentTarget.style.color = DS.inkDark; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = DS.cardBg; e.currentTarget.style.color = DS.inkMid; }}
            >
              Search
            </button>
          </form>

          {/* Right meta */}
          <div style={{
            marginLeft: 'auto', display: 'flex',
            alignItems: 'center', gap: 10,
          }}>
            {loading && (
              <Loader2
                size={16}
                color={DS.blue}
                style={{ animation: 'srv-spin 0.8s linear infinite', flexShrink: 0 }}
              />
            )}
            {!loading && (
              <span style={{ fontSize: 13, color: DS.inkMuted }}>
                {searchSubmit ? (
                  <>
                    <strong style={{ color: DS.inkMid }}>{data.total}</strong>
                    {' '}result{data.total !== 1 ? 's' : ''} for{' '}
                    <em style={{ color: DS.inkMid }}>"{searchSubmit}"</em>
                  </>
                ) : (
                  <>Showing <strong style={{ color: DS.inkMid }}>{data.servers.length}</strong> of <strong style={{ color: DS.inkMid }}>{data.total}</strong></>
                )}
              </span>
            )}
            {searchSubmit && (
              <button
                onClick={clearSearch}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', background: 'none',
                  border: `1px solid ${DS.outerBorder}`,
                  borderRadius: DS.r4,
                  fontSize: 12, color: DS.inkMuted, cursor: 'pointer',
                  fontFamily: DS.sans,
                  transition: 'all 0.15s',
                }}
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Table ─────────────────────────────────── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            minWidth: 900,
            borderCollapse: 'collapse',
            fontFamily: DS.sans,
          }}>

            {/* ── thead ── */}
            <thead>
              <tr style={{ background: DS.headerBg, borderBottom: `2px solid ${DS.headerLine}` }}>

                {/* Checkbox — select all */}
                <th style={{ width: 44, padding: '9px 0 9px 16px', verticalAlign: 'middle' }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: DS.blue }}
                  />
                </th>

                {[
                  { label: '#',             w: 40   },
                  { label: 'Server',        w: 180  },
                  { label: 'Status',        w: 130  },
                  { label: 'Environment',   w: 120  },
                  { label: 'IP Address',    w: 140  },
                  { label: 'OS / Platform', w: 'auto' },
                  { label: 'Assigned To',   w: 160  },
                  { label: 'Last Updated',  w: 120  },
                  { label: '',              w: 48   },
                ].map(({ label, w }, i) => (
                  <th key={i} style={{
                    padding: '9px 14px',
                    textAlign: label === '#' || label === '' ? 'center' : 'left',
                    fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: DS.inkHead,
                    fontFamily: DS.sans,
                    whiteSpace: 'nowrap',
                    width: w,
                    userSelect: 'none',
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            {/* ── tbody ── */}
            <tbody>
              {/* Loading skeleton */}
              {loading && !data.servers.length && (
                <tr>
                  <td colSpan={11} style={{ padding: '72px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: DS.blueSoft,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Loader2
                          size={24}
                          color={DS.blue}
                          style={{ animation: 'srv-spin 0.8s linear infinite' }}
                        />
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: DS.inkDark, margin: '0 0 4px' }}>
                          Loading servers…
                        </p>
                        <p style={{ fontSize: 13, color: DS.inkMuted, margin: 0 }}>
                          Fetching inventory from the registry
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {!loading && !data.servers.length && (
                <tr>
                  <td colSpan={11} style={{ padding: '72px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: DS.r16,
                        background: DS.headerBg,
                        border: `2px dashed ${DS.outerBorder}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Server size={28} color={DS.inkMuted} strokeWidth={1.5} />
                      </div>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 700, color: DS.inkDark, margin: '0 0 6px' }}>
                          {searchSubmit ? 'No matching servers' : 'No servers registered'}
                        </p>
                        <p style={{ fontSize: 13, color: DS.inkMuted, margin: 0 }}>
                          {searchSubmit
                            ? `No results for "${searchSubmit}". Try a different term.`
                            : 'Get started by registering your first server asset.'}
                        </p>
                      </div>
                      {searchSubmit ? (
                        <button
                          onClick={clearSearch}
                          style={{
                            padding: '8px 16px',
                            background: DS.cardBg,
                            border: `1px solid ${DS.outerBorder}`,
                            borderRadius: DS.r8,
                            fontSize: 13, fontWeight: 500, color: DS.inkMid,
                            cursor: 'pointer',
                          }}
                        >
                          Clear search
                        </button>
                      ) : (
                        <Link
                          href="/servers/register"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '9px 18px',
                            background: DS.blue, color: '#fff',
                            borderRadius: DS.r8,
                            fontSize: 14, fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          <Plus size={15} /> Register Server
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!loading && data.servers.map((s, idx) => {
                const isLast     = idx === data.servers.length - 1;
                const rowBorder  = isLast ? 'none' : `1px solid ${DS.rowSep}`;
                const isSelected = selected.has(s.server_id);
                const rowBg      = isSelected ? 'rgba(23,164,247,0.05)' : DS.cardBg;

                return (
                  <tr
                    key={s.server_id}
                    style={{ background: rowBg, transition: 'background 0.1s ease' }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = DS.rowHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}
                  >
                    {/* ── Checkbox ── */}
                    <td style={{ padding: '10px 0 10px 16px', borderBottom: rowBorder, verticalAlign: 'middle', width: 44 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(s.server_id)}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: DS.blue }}
                      />
                    </td>

                    {/* ── Row number ── */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                      <span style={{ fontSize: 11, color: DS.inkMuted, fontFamily: DS.mono }}>
                        {String(rowOffset + idx + 1).padStart(2, '0')}
                      </span>
                    </td>

                    {/* ── Server code + hostname ── */}
                    <td style={{ padding: '10px 14px', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                      <Link
                        href={'/servers/' + s.server_id}
                        style={{
                          fontSize: 13, fontWeight: 700, color: '#0369A1',
                          textDecoration: 'none', fontFamily: DS.mono,
                          letterSpacing: '0.01em', display: 'block',
                          transition: 'color 0.1s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = DS.blue; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#0369A1'; }}
                      >
                        {s.server_code}
                      </Link>
                      {s.hostname && (
                        <span style={{ fontSize: 11, color: DS.inkMuted, fontFamily: DS.mono, display: 'block', marginTop: 2 }}>
                          {s.hostname}
                        </span>
                      )}
                    </td>

                    {/* ── Status ── */}
                    <td style={{ padding: '10px 14px', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                      <StatusDot status={s.status} />
                    </td>

                    {/* ── Environment — plain text ── */}
                    <td style={{ padding: '10px 14px', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                      <span style={{ fontSize: 13, color: s.environment ? DS.inkMid : DS.inkMuted, fontFamily: DS.sans }}>
                        {s.environment || '—'}
                      </span>
                    </td>

                    {/* ── IP Address ── */}
                    <td style={{ padding: '10px 14px', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                      <span style={{
                        fontSize: 13, fontWeight: 500, fontFamily: DS.mono,
                        color: s.ip_address ? DS.inkBlack : DS.inkMuted,
                      }}>
                        {s.ip_address ?? '—'}
                      </span>
                    </td>

                    {/* ── OS / Platform ── */}
                    <td style={{ padding: '10px 14px', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                      {s.os_name ? (
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: DS.inkBlack }}>{s.os_name}</span>
                          {s.os_version && (
                            <span style={{ display: 'block', fontSize: 11, color: DS.inkMuted, marginTop: 2 }}>
                              v{s.os_version}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: DS.inkMuted }}>—</span>
                      )}
                    </td>

                    {/* ── Assignment ── */}
                    <td style={{ padding: '10px 14px', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                      {(s.primary_engineer ?? s.assigned_engineer) ? (
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: DS.inkDark, display: 'block' }}>
                            {s.primary_engineer ?? s.assigned_engineer}
                          </span>
                          {s.department_name && (
                            <span style={{ fontSize: 11, color: DS.inkMuted, display: 'block', marginTop: 2 }}>
                              {s.department_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: DS.inkMuted }}>—</span>
                      )}
                    </td>

                    {/* ── Last Updated ── */}
                    <td style={{ padding: '10px 14px', borderBottom: rowBorder, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12, color: DS.inkMid }}>
                        {s.updated_at
                          ? new Date(s.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </span>
                    </td>

                    {/* ── Actions ── */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                      <RowActions items={[
                        { label: 'View Details',  icon: <Eye size={14} />,      onClick: () => { window.location.href = '/servers/' + s.server_id; } },
                        { label: 'Edit Server',   icon: <Pencil size={14} />,   onClick: () => { window.location.href = '/servers/' + s.server_id + '/edit'; } },
                        { label: 'Credentials',   icon: <KeyRound size={14} />, onClick: () => openCredModal(s) },
                        { type: 'divider' },
                        { label: 'Decommission',  icon: <Trash2 size={14} />,   onClick: () => setDeleteTarget(s), danger: true },
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ─────────────────────── */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px',
            background: DS.headerBg,
            borderTop: `1px solid ${DS.outerBorder}`,
          }}>
            <span style={{ fontSize: 13, color: DS.inkMuted }}>
              Page{' '}
              <strong style={{ color: DS.inkDark }}>{data.page}</strong>
              {' '}of{' '}
              <strong style={{ color: DS.inkDark }}>{totalPages}</strong>
              <span style={{ marginLeft: 8, color: DS.headerLine }}>·</span>
              <span style={{ marginLeft: 8 }}>
                <strong style={{ color: DS.inkDark }}>{data.total}</strong> total records
              </span>
            </span>

            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { label: 'Previous', icon: <ChevronLeft size={14} />, action: () => setPage(p => Math.max(1, p - 1)), disabled: page <= 1 },
                { label: 'Next',     icon: <ChevronRight size={14} />, action: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page >= totalPages, iconRight: true },
              ].map(({ label, icon, action, disabled, iconRight }) => (
                <button
                  key={label}
                  onClick={action}
                  disabled={disabled}
                  style={{
                    height: 34, padding: '0 14px',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: disabled ? DS.headerBg : DS.cardBg,
                    border: `1px solid ${DS.outerBorder}`,
                    borderRadius: DS.r8,
                    fontSize: 13, fontWeight: 600,
                    color: disabled ? DS.inkMuted : DS.inkMid,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                    fontFamily: DS.sans,
                  }}
                  onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = DS.headerBg; e.currentTarget.style.color = DS.inkDark; }}}
                  onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.background = DS.cardBg; e.currentTarget.style.color = DS.inkMid; }}}
                >
                  {!iconRight && icon}
                  {label}
                  {iconRight && icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          DECOMMISSION MODAL
      ════════════════════════════════════════════════════ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Decommission Server"
        description="This action marks the server as decommissioned."
        danger
      >
        <div className="dialog-body">
          <p className="text-sm text-[var(--text-primary)]">
            Are you sure you want to decommission{' '}
            <span className="font-mono font-semibold">{deleteTarget?.server_code}</span>
            {deleteTarget?.hostname
              ? <span className="text-[var(--text-secondary)]"> ({deleteTarget.hostname})</span>
              : ''}?
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            The record is retained in the database and flagged as Decommissioned.
          </p>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="dialog-btn-cancel">
            Cancel
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="dialog-btn-danger">
            {deleting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Decommissioning…</>
              : 'Decommission'}
          </button>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════
          CREDENTIALS OTP MODAL
      ════════════════════════════════════════════════════ */}
      <Modal
        open={!!credModal}
        onClose={() => !credLoading && closeCredModal()}
        title="Credential Access"
        description={credModal?.server?.server_code}
      >
        {credModal?.step === 'request' && (
          <>
            <div className="dialog-body">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--section-bg)] p-4 space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">OTP Verification Required</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  A one-time password will be sent to your registered contact before credentials are revealed.
                </p>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={closeCredModal} className="dialog-btn-cancel">Cancel</button>
              <button type="button" onClick={handleRequestOtp} disabled={credLoading} className="dialog-btn-primary">
                {credLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : <><KeyRound className="w-4 h-4" /> Send OTP</>}
              </button>
            </div>
          </>
        )}

        {credModal?.step === 'verify' && (
          <>
            <div className="dialog-body space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Enter the OTP sent to your phone or email to unlock credentials.
              </p>
              {credModal.devOtp && (
                <div className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
                  Dev mode — OTP: <span className="font-mono font-bold">{credModal.devOtp}</span>
                </div>
              )}
              <div>
                <label className="label">OTP Code</label>
                <input
                  type="text" inputMode="numeric" maxLength={8}
                  className="input-field font-mono tracking-widest text-center text-lg"
                  placeholder="000000" value={credOtp}
                  onChange={(e) => setCredOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  autoFocus
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={() => setCredModal(m => ({ ...m, step: 'request' }))} className="dialog-btn-cancel">Back</button>
              <button type="button" onClick={handleVerifyOtp} disabled={credLoading || !credOtp.trim()} className="dialog-btn-primary">
                {credLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  : 'Verify & Unlock'}
              </button>
            </div>
          </>
        )}

        {credModal?.step === 'show' && (
          <>
            <div className="dialog-body">
              {!credModal.credentials.length ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">
                  No credentials stored for this server.
                </p>
              ) : (
                <div className="space-y-3">
                  {credModal.credentials.map((cred, i) => (
                    <div key={cred.credential_id ?? i} className="rounded-xl border border-[var(--border)] bg-[var(--section-bg)] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          {cred.credential_type || 'Credential'}
                        </span>
                        {cred.port && (
                          <span className="text-xs font-mono text-[var(--text-secondary)]">Port {cred.port}</span>
                        )}
                      </div>
                      {cred.username && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-[var(--text-muted)]">Username</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-mono">{cred.username}</span>
                            <button type="button" onClick={() => copyToClipboard(cred.username, 'Username')} className="btn-ghost p-1 rounded">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      {cred.password_encrypted && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-[var(--text-muted)]">Password</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-mono">
                              {showPassMap[i] ? cred.password_encrypted : '••••••••'}
                            </span>
                            <button type="button" onClick={() => setShowPassMap(m => ({ ...m, [i]: !m[i] }))} className="btn-ghost p-1 rounded">
                              {showPassMap[i] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            {showPassMap[i] && (
                              <button type="button" onClick={() => copyToClipboard(cred.password_encrypted, 'Password')} className="btn-ghost p-1 rounded">
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {cred.notes && <p className="text-xs text-[var(--text-muted)]">{cred.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-[var(--text-muted)] mt-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Access has been logged in the server activity log.
              </p>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={closeCredModal} className="dialog-btn-primary">Done</button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Scoped keyframes ── */}
      <style>{`
        @keyframes srv-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.35; }
          50%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(1);   opacity: 0; }
        }
      `}</style>
    </div>
  );
}
