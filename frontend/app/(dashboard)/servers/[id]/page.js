'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';
import { formatDate, formatDateTime, getStatusColor } from '../../../../lib/utils';
import {
  ArrowLeft, Loader2, Pencil, UserPlus, Wrench, Key, MoreVertical, Server,
  Cpu, Globe, Shield, Package, Activity, MapPin, AlertCircle, Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Server },
  { id: 'hardware', label: 'Hardware', icon: Cpu },
  { id: 'network', label: 'Network', icon: Globe },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'applications', label: 'Applications', icon: Package },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'incidents', label: 'Incidents', icon: AlertCircle },
  { id: 'visits', label: 'Visits', icon: MapPin },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'credentials', label: 'Credentials', icon: Lock },
];

function DataField({ label, value, mono }) {
  return (
    <div className="data-item">
      <span className="data-label">{label}</span>
      <span className={value ? (mono ? 'data-value data-value-mono' : 'data-value') : 'data-value data-value-empty'}>{value || '—'}</span>
    </div>
  );
}

function StatusField({ label, value, statusClass = '' }) {
  return (
    <div className="data-item">
      <span className="data-label">{label}</span>
      <span className={`data-value font-semibold ${statusClass}`}>{value || '—'}</span>
    </div>
  );
}

const TAB_IDS = ['overview', 'hardware', 'network', 'security', 'applications', 'maintenance', 'incidents', 'visits', 'activity', 'credentials'];

export default function ServerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TAB_IDS.includes(t)) setTab(t);
  }, [searchParams]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editingHw, setEditingHw] = useState(false);
  const [editingNet, setEditingNet] = useState(false);
  const [savingHw, setSavingHw] = useState(false);
  const [savingNet, setSavingNet] = useState(false);
  const [hwForm, setHwForm] = useState({ vendor: '', model: '', serial_number: '', asset_tag: '', cpu_model: '', cpu_cores: '', ram_gb: '', storage_tb: '', raid_level: '', nic_count: '', power_supply: '', warranty_start: '', warranty_expiry: '' });
  const [netForm, setNetForm] = useState({ ip_address: '', secondary_ip: '', ipv6: '', subnet: '', vlan: '', gateway: '', dns_primary: '', dns_secondary: '', network_type: '', bandwidth: '', firewall_enabled: false, nat_enabled: false });

  useEffect(() => {
    api.get('/servers/' + id)
      .then((res) => setData(res.data))
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load server');
        router.push('/servers');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (data?.hardware) {
      const h = data.hardware;
      setHwForm({
        vendor: h.vendor || '', model: h.model || '', serial_number: h.serial_number || '', asset_tag: h.asset_tag || '',
        cpu_model: h.cpu_model || '', cpu_cores: h.cpu_cores ?? '', ram_gb: h.ram_gb ?? '', storage_tb: h.storage_tb ?? '',
        raid_level: h.raid_level || '', nic_count: h.nic_count ?? '', power_supply: h.power_supply || '',
        warranty_start: h.warranty_start ? new Date(h.warranty_start).toISOString().slice(0, 10) : '',
        warranty_expiry: h.warranty_expiry ? new Date(h.warranty_expiry).toISOString().slice(0, 10) : '',
      });
    }
  }, [data?.hardware]);

  useEffect(() => {
    if (data?.network) {
      const n = data.network;
      setNetForm({
        ip_address: n.ip_address || '', secondary_ip: n.secondary_ip || '', ipv6: n.ipv6 || '', subnet: n.subnet || '',
        vlan: n.vlan || '', gateway: n.gateway || '', dns_primary: n.dns_primary || '', dns_secondary: n.dns_secondary || '',
        network_type: n.network_type || '', bandwidth: n.bandwidth || '', firewall_enabled: !!n.firewall_enabled, nat_enabled: !!n.nat_enabled,
      });
    }
  }, [data?.network]);

  async function saveHardware(e) {
    e.preventDefault();
    setSavingHw(true);
    try {
      await api.put('/servers/' + id + '/hardware', hwForm);
      toast.success('Hardware saved');
      setData((d) => ({ ...d, hardware: { ...d?.hardware, ...hwForm } }));
      setEditingHw(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save hardware');
    } finally {
      setSavingHw(false);
    }
  }

  async function saveNetwork(e) {
    e.preventDefault();
    setSavingNet(true);
    try {
      await api.put('/servers/' + id + '/network', netForm);
      toast.success('Network saved');
      setData((d) => ({ ...d, network: { ...d?.network, ...netForm } }));
      setEditingNet(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save network');
    } finally {
      setSavingNet(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[var(--app-bg)]">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  if (!data?.server) return null;

  const s = data.server;
  const hw = data.hardware;
  const net = data.network;
  const sec = data.security;
  const mon = data.monitoring;
  const applications = data.applications || [];
  const assignments = data.assignments || [];
  const maintenance = data.maintenance || [];
  const incidents = data.incidents || [];
  const visits = data.visits || [];
  const activity = data.activity || [];
  const credentials = data.credentials || [];
  const primaryEngineer = assignments?.[0]?.full_name;
  const lastMaint = maintenance?.[0];
  const openIncidents = incidents?.filter((i) => i.status && !['Resolved', 'Closed'].includes(i.status)) || [];

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <div className="bg-[var(--content-surface)] border-b border-[var(--border)] sticky top-0 z-10" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/servers" className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--section-bg)] hover:text-[var(--text-primary)] transition-colors" aria-label="Back to servers">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold font-mono truncate text-[var(--text-primary)]">{s.server_code}</h1>
                  <span className={getStatusColor(s.status)}>{s.status}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] truncate">{s.hostname || 'Server details'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={'/servers/' + id + '/edit'} className="btn-primary">
                <Pencil className="w-4 h-4" /> Edit Server
              </Link>
              <div className="relative">
                <button type="button" onClick={() => setMoreOpen(!moreOpen)} className="btn-secondary" aria-label="More actions">
                  <MoreVertical className="w-4 h-4" /> Actions
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMoreOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 py-1 w-52 dropdown-panel z-20 animate-in">
                      <Link href={'/servers/' + id + '?assign=1'} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--section-bg)]" onClick={() => setMoreOpen(false)}>
                        <UserPlus className="w-4 h-4 text-[var(--text-muted)]" /> Assign Engineer
                      </Link>
                      <Link href={'/maintenance?server_id=' + id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--section-bg)]" onClick={() => setMoreOpen(false)}>
                        <Wrench className="w-4 h-4 text-[var(--text-muted)]" /> Schedule Maintenance
                      </Link>
                      <Link href={'/incidents?server_id=' + id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--section-bg)]" onClick={() => setMoreOpen(false)}>
                        <AlertCircle className="w-4 h-4 text-[var(--text-muted)]" /> Report Incident
                      </Link>
                      <div className="my-1 border-t border-[var(--border)]" />
                      <Link href={'/servers/' + id + '?credentials=1'} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--section-bg)]" onClick={() => setMoreOpen(false)}>
                        <Key className="w-4 h-4 text-[var(--text-muted)]" /> Open Credentials
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-52 flex-shrink-0 hidden lg:block">
            <nav className="sticky top-24 card p-2 space-y-0.5">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`side-nav-item ${tab === t.id ? 'side-nav-item-active' : 'side-nav-item-inactive'}`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* RIGHT: Content column (mobile strip + main content) */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile tab strip */}
            <div className="lg:hidden overflow-x-auto pb-2 -mx-4 px-4 mb-4">
              <div className="flex gap-1 min-w-max">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold' : 'bg-[var(--content-surface)] text-[var(--text-secondary)] border border-[var(--border)]'}`}>
                      <Icon className="w-4 h-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content area */}
            <main className="flex-1 min-w-0 lg:min-w-[600px]">
            <div className="card overflow-hidden animate-in">
              {/* ——— OVERVIEW ——— */}
              {tab === 'overview' && (
                <div>
                  <div className="data-section">
                    <div className="data-section-title">Server Identity</div>
                    <div className="data-grid">
                      <DataField label="Hostname" value={s.hostname} mono />
                      <DataField label="Server Code" value={s.server_code} mono />
                      <StatusField label="Status" value={s.status} statusClass={getStatusColor(s.status)} />
                      <DataField label="Environment" value={s.environment} />
                      <DataField label="Server Type" value={s.server_type} />
                      <DataField label="Operating System" value={sec ? [sec.os_name, sec.os_version].filter(Boolean).join(' ') : null} />
                    </div>
                  </div>
                  <div className="data-section">
                    <div className="data-section-title">Location & Assignment</div>
                    <div className="data-grid">
                      <DataField label="Location" value={[s.site_name, s.city].filter(Boolean).join(', ')} />
                      <DataField label="Rack" value={s.rack_code ? `${s.rack_code}${s.rack_name ? ' — ' + s.rack_name : ''}` : null} mono />
                      <DataField label="Team" value={s.team_name} />
                      <DataField label="Assigned Engineer" value={primaryEngineer} />
                      <DataField label="Primary IP" value={net?.ip_address} mono />
                      <DataField label="VLAN" value={net?.vlan} />
                    </div>
                  </div>
                  <div className="data-section">
                    <div className="data-section-title">Operational Status</div>
                    <div className="data-grid">
                      <StatusField label="Health" value={mon?.health_status || 'Unknown'} statusClass={getStatusColor(mon?.health_status)} />
                      <StatusField label="Security Posture" value={sec?.hardening_status || 'Pending'} statusClass={getStatusColor(sec?.hardening_status)} />
                      <DataField label="Last Maintenance" value={lastMaint ? formatDate(lastMaint.scheduled_date) : 'None scheduled'} />
                      <StatusField label="Active Incidents" value={openIncidents.length > 0 ? `${openIncidents.length} open` : 'None'} statusClass={openIncidents.length > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'} />
                      <DataField label="Applications" value={applications.length > 0 ? `${applications.length} linked` : 'None'} />
                      <DataField label="Visits" value={visits.length > 0 ? `${visits.length} recorded` : 'None'} />
                    </div>
                  </div>
                </div>
              )}

              {/* ——— HARDWARE ——— */}
              {tab === 'hardware' && (
                <div>
                  <div className="data-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem' }}>
                    <div className="data-section-title" style={{ marginBottom: 0 }}>Hardware Specifications</div>
                    {!editingHw && (
                      <button type="button" onClick={() => setEditingHw(true)} className="text-xs font-medium text-[var(--primary)] hover:underline">
                        {hw ? 'Edit' : 'Add hardware'}
                      </button>
                    )}
                  </div>
                  {!editingHw ? (
                    hw ? (
                      <div>
                        <div className="data-section">
                          <div className="data-section-title">Device Identity</div>
                          <div className="data-grid">
                            <DataField label="Vendor" value={hw.vendor} />
                            <DataField label="Model" value={hw.model} />
                            <DataField label="Serial Number" value={hw.serial_number} mono />
                            <DataField label="Asset Tag" value={hw.asset_tag} mono />
                          </div>
                        </div>
                        <div className="data-section">
                          <div className="data-section-title">Compute</div>
                          <div className="data-grid">
                            <DataField label="CPU Model" value={hw.cpu_model} />
                            <DataField label="CPU Cores" value={hw.cpu_cores} />
                            <DataField label="RAM" value={hw.ram_gb ? `${hw.ram_gb} GB` : null} />
                            <DataField label="Storage" value={hw.storage_tb ? `${hw.storage_tb} TB` : null} />
                            <DataField label="RAID Level" value={hw.raid_level} />
                            <DataField label="NIC Count" value={hw.nic_count} />
                            <DataField label="Power Supply" value={hw.power_supply} />
                          </div>
                        </div>
                        <div className="data-section">
                          <div className="data-section-title">Warranty</div>
                          <div className="data-grid">
                            <DataField label="Warranty Start" value={hw.warranty_start ? formatDate(hw.warranty_start) : null} />
                            <DataField label="Warranty Expiry" value={hw.warranty_expiry ? formatDate(hw.warranty_expiry) : null} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="state-empty"><Cpu className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Hardware Recorded</p><p className="text-sm">Click &quot;Create hardware&quot; above to add specifications</p></div>
                    )
                  ) : (
                    <form onSubmit={saveHardware} className="space-y-4 max-w-2xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {['vendor', 'model', 'serial_number', 'asset_tag', 'cpu_model'].map((f) => (
                          <div key={f}><label className="label">{f.replace(/_/g, ' ')}</label><input className="input-field w-full" value={hwForm[f]} onChange={(e) => setHwForm((prev) => ({ ...prev, [f]: e.target.value }))} /></div>
                        ))}
                        <div><label className="label">cpu cores</label><input type="number" className="input-field w-full" value={hwForm.cpu_cores} onChange={(e) => setHwForm((prev) => ({ ...prev, cpu_cores: e.target.value }))} /></div>
                        <div><label className="label">ram gb</label><input type="number" className="input-field w-full" value={hwForm.ram_gb} onChange={(e) => setHwForm((prev) => ({ ...prev, ram_gb: e.target.value }))} /></div>
                        <div><label className="label">storage tb</label><input type="number" step="0.1" className="input-field w-full" value={hwForm.storage_tb} onChange={(e) => setHwForm((prev) => ({ ...prev, storage_tb: e.target.value }))} /></div>
                        <div><label className="label">warranty expiry</label><input type="date" className="input-field w-full" value={hwForm.warranty_expiry} onChange={(e) => setHwForm((prev) => ({ ...prev, warranty_expiry: e.target.value }))} /></div>
                      </div>
                      <div className="flex gap-2"><button type="button" onClick={() => setEditingHw(false)} className="btn-cancel">Cancel</button><button type="submit" disabled={savingHw} className="btn-save">{savingHw ? 'Saving...' : 'Save'}</button></div>
                    </form>
                  )}
                </div>
              )}

              {/* ——— NETWORK ——— */}
              {tab === 'network' && (
                <div>
                  <div className="data-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem' }}>
                    <div className="data-section-title" style={{ marginBottom: 0 }}>Network Configuration</div>
                    {!editingNet && <button type="button" onClick={() => setEditingNet(true)} className="text-xs font-medium text-[var(--primary)] hover:underline">{net ? 'Edit' : 'Add network'}</button>}
                  </div>
                  {!editingNet ? (
                    net ? (
                      <div>
                        <div className="data-section">
                          <div className="data-section-title">IP Addressing</div>
                          <div className="data-grid">
                            <DataField label="Primary IP" value={net.ip_address} mono />
                            <DataField label="Secondary IP" value={net.secondary_ip} mono />
                            <DataField label="IPv6" value={net.ipv6} mono />
                            <DataField label="Subnet Mask" value={net.subnet} mono />
                            <DataField label="VLAN" value={net.vlan} />
                            <DataField label="Gateway" value={net.gateway} mono />
                          </div>
                        </div>
                        <div className="data-section">
                          <div className="data-section-title">DNS & Routing</div>
                          <div className="data-grid">
                            <DataField label="Primary DNS" value={net.dns_primary} mono />
                            <DataField label="Secondary DNS" value={net.dns_secondary} mono />
                            <DataField label="Network Type" value={net.network_type} />
                            <DataField label="Bandwidth" value={net.bandwidth} />
                            <DataField label="Firewall" value={net.firewall_enabled ? 'Enabled' : 'Disabled'} />
                            <DataField label="NAT" value={net.nat_enabled ? 'Enabled' : 'Disabled'} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="state-empty"><Globe className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Network Recorded</p><p className="text-sm">Click &quot;Create network&quot; above to add configuration</p></div>
                    )
                  ) : (
                    <form onSubmit={saveNetwork} className="space-y-4 max-w-2xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="label">Primary IP</label><input className="input-field w-full" value={netForm.ip_address} onChange={(e) => setNetForm((prev) => ({ ...prev, ip_address: e.target.value }))} /></div>
                        <div><label className="label">Gateway</label><input className="input-field w-full" value={netForm.gateway} onChange={(e) => setNetForm((prev) => ({ ...prev, gateway: e.target.value }))} /></div>
                        <div><label className="label">Subnet</label><input className="input-field w-full" value={netForm.subnet} onChange={(e) => setNetForm((prev) => ({ ...prev, subnet: e.target.value }))} /></div>
                        <div><label className="label">VLAN</label><input className="input-field w-full" value={netForm.vlan} onChange={(e) => setNetForm((prev) => ({ ...prev, vlan: e.target.value }))} /></div>
                        <div><label className="label">Network type</label><input className="input-field w-full" value={netForm.network_type} onChange={(e) => setNetForm((prev) => ({ ...prev, network_type: e.target.value }))} /></div>
                        <div><label className="label">Bandwidth</label><input className="input-field w-full" value={netForm.bandwidth} onChange={(e) => setNetForm((prev) => ({ ...prev, bandwidth: e.target.value }))} /></div>
                        <div className="sm:col-span-2 flex gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={netForm.firewall_enabled} onChange={(e) => setNetForm((prev) => ({ ...prev, firewall_enabled: e.target.checked }))} /> Firewall enabled</label><label className="flex items-center gap-2"><input type="checkbox" checked={netForm.nat_enabled} onChange={(e) => setNetForm((prev) => ({ ...prev, nat_enabled: e.target.checked }))} /> NAT enabled</label></div>
                      </div>
                      <div className="flex gap-2"><button type="button" onClick={() => setEditingNet(false)} className="btn-cancel">Cancel</button><button type="submit" disabled={savingNet} className="btn-save">{savingNet ? 'Saving...' : 'Save'}</button></div>
                    </form>
                  )}
                </div>
              )}

              {/* ——— SECURITY ——— */}
              {tab === 'security' && (
                <div>
                  {sec ? (
                    <div>
                      <div className="data-section">
                        <div className="data-section-title">Security Posture</div>
                        <div className="data-grid">
                          <StatusField label="Hardening Status" value={sec.hardening_status} statusClass={getStatusColor(sec.hardening_status)} />
                          <StatusField label="Compliance" value={sec.compliance_status || 'Not set'} statusClass={getStatusColor(sec.compliance_status)} />
                          <DataField label="Operating System" value={sec.os_name ? [sec.os_name, sec.os_version].filter(Boolean).join(' ') : null} />
                        </div>
                      </div>
                      <div className="data-section">
                        <div className="data-section-title">Security Controls</div>
                        <div className="data-grid">
                          <DataField label="SSH Key Only" value={sec.ssh_key_only ? 'Yes' : 'No'} />
                          <DataField label="Antivirus" value={sec.antivirus_installed ? 'Installed' : 'Not installed'} />
                          <DataField label="Backup Enabled" value={sec.backup_enabled ? 'Yes' : 'No'} />
                          <DataField label="Backup Frequency" value={sec.backup_frequency} />
                          <DataField label="Backup Destination" value={sec.backup_destination} />
                          <DataField label="Log Retention" value={sec.log_retention_days ? `${sec.log_retention_days} days` : null} />
                        </div>
                      </div>
                      <div className="data-section">
                        <div className="data-section-title">Audit Schedule</div>
                        <div className="data-grid">
                          <DataField label="Last Audit" value={sec.last_audit_date ? formatDate(sec.last_audit_date) : null} />
                          <DataField label="Next Audit" value={sec.next_audit_date ? formatDate(sec.next_audit_date) : null} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6"><div className="state-empty"><Shield className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Security Record</p><p className="text-sm">Security information will appear once configured</p></div></div>
                  )}
                </div>
              )}

              {/* ——— APPLICATIONS ——— */}
              {tab === 'applications' && (
                <div>
                  <div className="data-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem' }}>
                    <div className="data-section-title" style={{ marginBottom: 0 }}>Linked Applications</div>
                    <Link href={`/applications?server_id=${id}`} className="text-xs font-medium text-[var(--primary)] hover:underline">Manage</Link>
                  </div>
                  {applications.length ? (
                    <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                      <table>
                        <thead><tr><th>Application</th><th>Type</th><th>Status</th></tr></thead>
                        <tbody>
                          {applications.map((a) => (
                            <tr key={a.application_id}>
                              <td className="font-medium">{a.app_name}</td>
                              <td className="text-[var(--text-secondary)]">{a.app_type || '—'}</td>
                              <td><span className={getStatusColor(a.status)}>{a.status || '—'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6"><div className="state-empty"><Package className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Applications Linked</p><p className="text-sm">Applications deployed on this server will appear here</p></div></div>
                  )}
                </div>
              )}

              {/* ——— MAINTENANCE ——— */}
              {tab === 'maintenance' && (
                <div>
                  <div className="data-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem' }}>
                    <div className="data-section-title" style={{ marginBottom: 0 }}>Maintenance History</div>
                    <Link href={`/maintenance?server_id=${id}`} className="text-xs font-medium text-[var(--primary)] hover:underline">Schedule new</Link>
                  </div>
                  {maintenance.length ? (
                    <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                      <table>
                        <thead><tr><th>Task</th><th>Scheduled</th><th>Priority</th><th>Status</th></tr></thead>
                        <tbody>
                          {maintenance.slice(0, 20).map((m) => (
                            <tr key={m.maintenance_id}>
                              <td className="font-medium">{m.title}</td>
                              <td className="text-[var(--text-secondary)] text-xs">{formatDate(m.scheduled_date)}</td>
                              <td><span className={getStatusColor(m.priority)}>{m.priority || '—'}</span></td>
                              <td><span className={getStatusColor(m.status)}>{m.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6"><div className="state-empty"><Wrench className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Maintenance Records</p><p className="text-sm">Schedule maintenance from the Actions menu above</p></div></div>
                  )}
                </div>
              )}

              {/* ——— INCIDENTS ——— */}
              {tab === 'incidents' && (
                <div>
                  <div className="data-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem' }}>
                    <div className="data-section-title" style={{ marginBottom: 0 }}>Incident Log</div>
                    <Link href={`/incidents?server_id=${id}`} className="text-xs font-medium text-[var(--primary)] hover:underline">Report incident</Link>
                  </div>
                  {incidents.length ? (
                    <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                      <table>
                        <thead><tr><th>Incident</th><th>Reported</th><th>Severity</th><th>Status</th></tr></thead>
                        <tbody>
                          {incidents.slice(0, 20).map((i) => (
                            <tr key={i.incident_id}>
                              <td className="font-medium">{i.title}</td>
                              <td className="text-[var(--text-secondary)] text-xs">{formatDate(i.reported_at)}</td>
                              <td><span className={getStatusColor(i.severity)}>{i.severity}</span></td>
                              <td><span className={getStatusColor(i.status)}>{i.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6"><div className="state-empty"><AlertCircle className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Incidents</p><p className="text-sm">No incidents have been reported for this server</p></div></div>
                  )}
                </div>
              )}

              {/* ——— VISITS ——— */}
              {tab === 'visits' && (
                <div>
                  <div className="data-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem' }}>
                    <div className="data-section-title" style={{ marginBottom: 0 }}>Site Visits</div>
                    <Link href="/visits" className="text-xs font-medium text-[var(--primary)] hover:underline">Log visit</Link>
                  </div>
                  {visits.length ? (
                    <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                      <table>
                        <thead><tr><th>Date</th><th>Engineer</th><th>Type</th><th>Purpose</th></tr></thead>
                        <tbody>
                          {visits.slice(0, 20).map((v) => (
                            <tr key={v.visit_id}>
                              <td className="text-xs">{formatDate(v.visit_date)}</td>
                              <td className="font-medium">{v.engineer_name || '—'}</td>
                              <td className="text-[var(--text-secondary)]">{v.visit_type || 'Inspection'}</td>
                              <td className="text-[var(--text-secondary)] text-xs truncate max-w-[200px]">{v.purpose || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6"><div className="state-empty"><MapPin className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Visits Recorded</p><p className="text-sm">Site visits for this server will appear here</p></div></div>
                  )}
                </div>
              )}

              {/* ——— ACTIVITY ——— */}
              {tab === 'activity' && (
                <div className="p-6">
                  <div className="data-section-title" style={{ marginBottom: '1rem' }}>Operation Timeline</div>
                  {activity.length ? (
                    <div className="timeline">
                      {activity.slice(0, 40).map((a, idx) => (
                        <div key={idx} className="timeline-item">
                          <div className={`timeline-dot ${idx === 0 ? 'timeline-dot-active' : ''}`} />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-[var(--text-primary)]">{a.action}</span>
                              {a.entity_type && <span className="text-xs ml-1.5 px-1.5 py-0.5 rounded bg-[var(--section-bg)] text-[var(--text-muted)]">{a.entity_type}</span>}
                              <span className="block text-xs text-[var(--text-secondary)] mt-0.5">{a.username}</span>
                            </div>
                            <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0">{formatDateTime(a.performed_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="state-empty"><Activity className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Recent Activity</p><p className="text-sm">Activity log entries will appear here</p></div>
                  )}
                </div>
              )}

              {/* ——— CREDENTIALS ——— */}
              {tab === 'credentials' && (
                <div className="p-6">
                  <div className="data-section-title" style={{ marginBottom: '0.75rem' }}>Access Credentials</div>
                  <p className="text-xs text-[var(--text-muted)] mb-4">Protected access. Use &quot;Open Credentials&quot; in the action bar. OTP verification may be required.</p>
                  {credentials.length ? (
                    <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                      <table>
                        <thead><tr><th>Type</th><th>Username</th><th>Port</th></tr></thead>
                        <tbody>
                          {credentials.map((c) => (
                            <tr key={c.credential_id}>
                              <td className="font-medium">{c.credential_type}</td>
                              <td className="font-mono text-xs">{c.username || '—'}</td>
                              <td className="text-[var(--text-secondary)]">{c.port ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="state-empty"><Lock className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="font-medium text-[var(--text-primary)] mb-1">No Credentials Stored</p><p className="text-sm">Add credentials using the Actions menu above</p></div>
                  )}
                </div>
              )}
            </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
