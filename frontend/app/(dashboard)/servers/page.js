'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { getStatusColor } from '../../../lib/utils';
import {
  Server, Loader2, Pencil, Eye, Search, Trash2, KeyRound,
  ShieldCheck, AlertCircle, Copy, EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

export default function ServersPage() {
  const [data, setData] = useState({ servers: [], total: 0, page: 1, page_size: 25 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchSubmit, setSearchSubmit] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null); // { server_id, server_code, hostname }
  const [deleting, setDeleting] = useState(false);

  // Credentials OTP state
  const [credModal, setCredModal] = useState(null); // { server, step: 'request'|'verify'|'show', credentials: [], devOtp }
  const [credOtp, setCredOtp] = useState('');
  const [credLoading, setCredLoading] = useState(false);
  const [showPassMap, setShowPassMap] = useState({}); // keyed by credential_id

  // Body scroll lock when any dialog is open
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
        servers: r.data?.servers ?? [],
        total: r.data?.total ?? 0,
        page: r.data?.page ?? page,
        page_size: r.data?.page_size ?? 25,
      }))
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load servers');
        setData((d) => ({ ...d, servers: [] }));
      })
      .finally(() => setLoading(false));
  }, [page, searchSubmit]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  const handleSearch = (e) => {
    e?.preventDefault();
    setSearchSubmit(search.trim() || '');
    setPage(1);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
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

  // ── Credentials OTP ─────────────────────────────────────────────────────────
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
      const purpose = 'credentials_' + credModal.server.server_id;
      const res = await api.post('/otp/request', { purpose, method: 'sms' });
      const devOtp = res.data?.devOtp || null;
      toast.success(res.data?.message || 'OTP sent');
      setCredModal((m) => ({ ...m, step: 'verify', devOtp }));
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
      const res = await api.post('/servers/' + credModal.server.server_id + '/credentials/unlock', { otp: credOtp.trim() });
      setCredModal((m) => ({ ...m, step: 'show', credentials: res.data?.credentials || [] }));
      setCredOtp('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setCredLoading(false);
    }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copied`)).catch(() => toast.error('Copy failed'));
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Servers</h1>
          <p className="page-subtitle">Manage server inventory — view, edit, or register new</p>
        </div>
        <Link href="/servers/register" className="btn-primary flex-shrink-0">
          <Server className="w-4 h-4" /> Register Server
        </Link>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search by code, hostname..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <button type="submit" className="btn-secondary">Search</button>
          </form>
          <p className="text-sm text-[var(--text-secondary)]">
            {data.total} server{data.total !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="table-container overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th>Code</th>
                <th>Hostname</th>
                <th>Type</th>
                <th>Status</th>
                <th>IP</th>
                <th>OS</th>
                <th>Environment</th>
                <th>Department</th>
                <th>Engineer</th>
                <th>Last update</th>
                <th className="text-right w-44">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data.servers.length ? (
                <tr>
                  <td colSpan={11} className="text-center py-16">
                    <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin mx-auto" />
                  </td>
                </tr>
              ) : !data.servers.length ? (
                <tr>
                  <td colSpan={11} className="text-center py-12">
                    <div className="state-empty">No servers found. Register a server to get started.</div>
                  </td>
                </tr>
              ) : (
                data.servers.map((s) => (
                  <tr key={s.server_id} className="hover:bg-[var(--background-soft)] transition-colors">
                    <td>
                      <Link href={'/servers/' + s.server_id} className="font-mono font-medium text-[var(--primary)] hover:underline">
                        {s.server_code}
                      </Link>
                    </td>
                    <td className="font-mono text-sm text-[var(--text-primary)]">{s.hostname || '—'}</td>
                    <td className="text-sm">{s.server_type || '—'}</td>
                    <td><span className={getStatusColor(s.status)}>{s.status || '—'}</span></td>
                    <td className="font-mono text-sm">{s.ip_address ?? '—'}</td>
                    <td className="text-sm">{s.os_name ? [s.os_name, s.os_version].filter(Boolean).join(' ') : '—'}</td>
                    <td className="text-sm">{s.environment || '—'}</td>
                    <td className="text-sm">{s.department_name || '—'}</td>
                    <td className="text-sm">{s.primary_engineer ?? s.assigned_engineer ?? '—'}</td>
                    <td className="text-sm text-[var(--text-secondary)]">{s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}</td>
                    <td className="text-right">
                      <RowActions items={[
                        { label: 'View Details', icon: <Eye className="w-4 h-4" />, onClick: () => { window.location.href = '/servers/' + s.server_id; } },
                        { label: 'Edit Server', icon: <Pencil className="w-4 h-4" />, onClick: () => { window.location.href = '/servers/' + s.server_id + '/edit'; } },
                        { label: 'Credentials', icon: <KeyRound className="w-4 h-4" />, onClick: () => openCredModal(s) },
                        { type: 'divider' },
                        { label: 'Decommission', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteTarget(s), danger: true },
                      ]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-[var(--section-bg)] border-t border-[var(--border)]">
            <p className="text-sm text-[var(--text-secondary)]">Page {data.page} of {totalPages}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm">Previous</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Decommission server"
        description="This will mark the server as Decommissioned."
        danger
      >
        <div className="dialog-body">
          <p className="text-sm text-[var(--text-primary)]">
            Are you sure you want to decommission{' '}
            <span className="font-mono font-semibold">{deleteTarget?.server_code}</span>
            {deleteTarget?.hostname ? <span className="text-[var(--text-secondary)]"> ({deleteTarget.hostname})</span> : ''}?
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            The server record is retained but marked as Decommissioned.
          </p>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="dialog-btn-cancel">Cancel</button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="dialog-btn-danger">
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Decommissioning…</> : 'Decommission'}
          </button>
        </div>
      </Modal>

      {/* ── Credentials OTP Modal ── */}
      <Modal
        open={!!credModal}
        onClose={() => !credLoading && closeCredModal()}
        title="Credentials Access"
        description={credModal?.server?.server_code}
      >
        {credModal?.step === 'request' && (
          <>
            <div className="dialog-body">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--section-bg)] p-4 space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">OTP Verification Required</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  An OTP will be sent to your registered phone or email to verify your identity before credentials are revealed.
                </p>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={closeCredModal} className="dialog-btn-cancel">Cancel</button>
              <button type="button" onClick={handleRequestOtp} disabled={credLoading} className="dialog-btn-primary">
                {credLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><KeyRound className="w-4 h-4" /> Send OTP</>}
              </button>
            </div>
          </>
        )}
        {credModal?.step === 'verify' && (
          <>
            <div className="dialog-body space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">Enter the OTP sent to your phone/email to unlock credentials.</p>
              {credModal.devOtp && (
                <div className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
                  Dev mode — OTP: <span className="font-mono font-bold">{credModal.devOtp}</span>
                </div>
              )}
              <div>
                <label className="label">OTP Code</label>
                <input type="text" inputMode="numeric" maxLength={8} className="input-field font-mono tracking-widest text-center text-lg"
                  placeholder="000000" value={credOtp}
                  onChange={(e) => setCredOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()} autoFocus />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={() => setCredModal((m) => ({ ...m, step: 'request' }))} className="dialog-btn-cancel">Back</button>
              <button type="button" onClick={handleVerifyOtp} disabled={credLoading || !credOtp.trim()} className="dialog-btn-primary">
                {credLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Verify & Unlock'}
              </button>
            </div>
          </>
        )}
        {credModal?.step === 'show' && (
          <>
            <div className="dialog-body">
              {!credModal.credentials.length ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">No credentials stored for this server.</p>
              ) : (
                <div className="space-y-3">
                  {credModal.credentials.map((cred, i) => (
                    <div key={cred.credential_id ?? i} className="rounded-xl border border-[var(--border)] bg-[var(--section-bg)] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{cred.credential_type || 'Credential'}</span>
                        {cred.port && <span className="text-xs font-mono text-[var(--text-secondary)]">Port {cred.port}</span>}
                      </div>
                      {cred.username && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-[var(--text-muted)]">Username</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-mono">{cred.username}</span>
                            <button type="button" onClick={() => copyToClipboard(cred.username, 'Username')} className="btn-ghost p-1 rounded"><Copy className="w-3 h-3" /></button>
                          </div>
                        </div>
                      )}
                      {cred.password_encrypted && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-[var(--text-muted)]">Password</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-mono">{showPassMap[i] ? cred.password_encrypted : '••••••••'}</span>
                            <button type="button" onClick={() => setShowPassMap((m) => ({ ...m, [i]: !m[i] }))} className="btn-ghost p-1 rounded">
                              {showPassMap[i] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            {showPassMap[i] && <button type="button" onClick={() => copyToClipboard(cred.password_encrypted, 'Password')} className="btn-ghost p-1 rounded"><Copy className="w-3 h-3" /></button>}
                          </div>
                        </div>
                      )}
                      {cred.notes && <p className="text-xs text-[var(--text-muted)]">{cred.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-[var(--text-muted)] mt-3 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Access logged in the server activity log.
              </p>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={closeCredModal} className="dialog-btn-primary">Done</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
