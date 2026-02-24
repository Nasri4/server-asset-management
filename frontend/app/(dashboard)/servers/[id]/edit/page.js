'use client';
import { useState, useEffect, useId, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../../lib/api';
import { ArrowLeft, Loader2, Save, ChevronRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = ['Basic Info', 'Hardware', 'Network', 'Security', 'Credentials'];

function InputField({ id, label, value, onChange, type = 'text', placeholder = '', className = '', disabled = false }) {
  return (
    <div className={`${className} relative`}>
      <label htmlFor={id} className="label cursor-pointer">{label}</label>
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="input-field" autoComplete="off" disabled={disabled} />
    </div>
  );
}

function SelectField({ id, label, value, onChange, options, className = '', disabled = false }) {
  return (
    <div className={`${className} relative`}>
      <label htmlFor={id} className="label cursor-pointer">{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className="select-field" disabled={disabled}>
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CheckboxField({ id, label, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border-soft)] text-[var(--primary)] focus:ring-[var(--primary)]" />
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
    </label>
  );
}

export default function EditServerPage() {
  const { id } = useParams();
  const router = useRouter();
  const baseId = useId().replace(/:/g, '');
  const fid = (s) => `${baseId}-${s}`;

  const [step, setStep] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [server, setServer] = useState(null);

  // Dropdown data
  const [locations, setLocations] = useState([]);
  const [racks, setRacks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [engineers, setEngineers] = useState([]);

  // Form state
  const [basic, setBasic] = useState({
    hostname: '', server_type: 'Physical', environment: 'Production', role: '',
    status: 'Active', power_type: 'Single', team_id: '', department_id: '',
    location_id: '', rack_id: '', u_position_start: '', u_position_end: '',
    install_date: '', notes: '', engineer_id: '',
  });
  const [hardware, setHardware] = useState({
    vendor: '', model: '', serial_number: '', asset_tag: '', cpu_model: '',
    cpu_cores: '', ram_gb: '', storage_tb: '', raid_level: '', nic_count: '',
    power_supply: '', warranty_start: '', warranty_expiry: '',
  });
  const [network, setNetwork] = useState({
    ip_address: '', secondary_ip: '', ipv6: '', subnet: '', vlan: '', gateway: '',
    dns_primary: '', dns_secondary: '', network_type: '', bandwidth: '',
    firewall_enabled: false, nat_enabled: false,
  });
  const [security, setSecurity] = useState({
    os_name: '', os_version: '', hardening_status: 'Pending', ssh_key_only: false,
    antivirus_installed: false, backup_enabled: false, backup_frequency: '', log_retention_days: 90,
    compliance_status: '', backup_destination: '', last_audit_date: '', next_audit_date: '',
  });
  const [credentials, setCredentials] = useState([]);

  const setB = (f, v) => setBasic(b => ({ ...b, [f]: v }));
  const setHw = (f, v) => setHardware(h => ({ ...h, [f]: v }));
  const setNet = (f, v) => setNetwork(n => ({ ...n, [f]: v }));
  const setSec = (f, v) => setSecurity(s => ({ ...s, [f]: v }));

  // Load dropdowns + server data
  useEffect(() => {
    async function load() {
      try {
        const [serverRes, locRes, teamRes, deptRes] = await Promise.all([
          api.get('/servers/' + id),
          api.get('/locations'),
          api.get('/teams'),
          api.get('/departments'),
        ]);
        const d = serverRes.data;
        const s = d.server;
        setServer(s);
        setLocations(locRes.data ?? []);
        setTeams(teamRes.data ?? []);
        setDepartments(deptRes.data ?? []);

        // Populate basic form
        const assignedEng = d.assignments?.[0]?.engineer_id ?? '';
        setBasic({
          hostname: s.hostname || '',
          server_type: s.server_type || 'Physical',
          environment: s.environment || 'Production',
          role: s.role || '',
          status: s.status || 'Active',
          power_type: s.power_type || 'Single',
          team_id: s.team_id ?? '',
          department_id: s.department_id ?? '',
          location_id: s.location_id ?? '',
          rack_id: s.rack_id ?? '',
          u_position_start: s.u_position_start ?? '',
          u_position_end: s.u_position_end ?? '',
          install_date: s.install_date ? new Date(s.install_date).toISOString().slice(0, 10) : '',
          notes: s.notes || '',
          engineer_id: String(assignedEng),
        });

        // Hardware
        const hw = d.hardware;
        if (hw) {
          setHardware({
            vendor: hw.vendor || '', model: hw.model || '', serial_number: hw.serial_number || '',
            asset_tag: hw.asset_tag || '', cpu_model: hw.cpu_model || '', cpu_cores: hw.cpu_cores ?? '',
            ram_gb: hw.ram_gb ?? '', storage_tb: hw.storage_tb ?? '', raid_level: hw.raid_level || '',
            nic_count: hw.nic_count ?? '', power_supply: hw.power_supply || '',
            warranty_start: hw.warranty_start ? new Date(hw.warranty_start).toISOString().slice(0, 10) : '',
            warranty_expiry: hw.warranty_expiry ? new Date(hw.warranty_expiry).toISOString().slice(0, 10) : '',
          });
        }

        // Network
        const net = d.network;
        if (net) {
          setNetwork({
            ip_address: net.ip_address || '', secondary_ip: net.secondary_ip || '', ipv6: net.ipv6 || '',
            subnet: net.subnet || '', vlan: net.vlan || '', gateway: net.gateway || '',
            dns_primary: net.dns_primary || '', dns_secondary: net.dns_secondary || '',
            network_type: net.network_type || '', bandwidth: net.bandwidth || '',
            firewall_enabled: !!net.firewall_enabled, nat_enabled: !!net.nat_enabled,
          });
        }

        // Security
        const sec = d.security;
        if (sec) {
          setSecurity({
            os_name: sec.os_name || '', os_version: sec.os_version || '',
            hardening_status: sec.hardening_status || 'Pending',
            ssh_key_only: !!sec.ssh_key_only, antivirus_installed: !!sec.antivirus_installed,
            backup_enabled: !!sec.backup_enabled, backup_frequency: sec.backup_frequency || '',
            log_retention_days: sec.log_retention_days ?? 90,
            compliance_status: sec.compliance_status || '',
            backup_destination: sec.backup_destination || '',
            last_audit_date: sec.last_audit_date ? new Date(sec.last_audit_date).toISOString().slice(0, 10) : '',
            next_audit_date: sec.next_audit_date ? new Date(sec.next_audit_date).toISOString().slice(0, 10) : '',
          });
        }

        // Credentials (read-only display)
        setCredentials(d.credentials || []);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load server');
        router.push('/servers');
      } finally {
        setPageLoading(false);
      }
    }
    load();
  }, [id, router]);

  // Load racks when location changes
  useEffect(() => {
    if (basic.location_id) {
      api.get('/racks', { params: { location_id: basic.location_id } })
        .then(r => setRacks(r.data ?? []))
        .catch(() => setRacks([]));
    } else {
      setRacks([]);
    }
  }, [basic.location_id]);

  // Load engineers when team changes
  useEffect(() => {
    if (basic.team_id) {
      api.get('/engineers', { params: { team_id: basic.team_id } })
        .then(r => setEngineers(r.data ?? []))
        .catch(() => setEngineers([]));
    } else {
      setEngineers([]);
    }
  }, [basic.team_id]);

  // ── Save handlers ────────────────────────────────────────────────────────────
  async function saveBasic() {
    await api.put('/servers/' + id, {
      hostname: basic.hostname || null,
      server_type: basic.server_type,
      environment: basic.environment || null,
      role: basic.role || null,
      status: basic.status,
      power_type: basic.power_type || null,
      team_id: basic.team_id ? parseInt(basic.team_id, 10) : null,
      department_id: basic.department_id ? parseInt(basic.department_id, 10) : null,
      location_id: basic.location_id ? parseInt(basic.location_id, 10) : null,
      rack_id: basic.rack_id ? parseInt(basic.rack_id, 10) : null,
      u_position_start: basic.u_position_start !== '' ? parseInt(basic.u_position_start, 10) : null,
      u_position_end: basic.u_position_end !== '' ? parseInt(basic.u_position_end, 10) : null,
      install_date: basic.install_date || null,
      notes: basic.notes || null,
    });
  }

  async function saveHardware() {
    await api.put('/servers/' + id + '/hardware', hardware);
  }

  async function saveNetwork() {
    await api.put('/servers/' + id + '/network', network);
  }

  async function saveSecurity() {
    await api.put('/security/' + id, security);
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      await saveBasic();
      await saveHardware();
      await saveNetwork();
      await saveSecurity();
      toast.success('Server updated successfully');
      router.push('/servers/' + id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save server');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStep() {
    setSaving(true);
    try {
      if (step === 0) await saveBasic();
      else if (step === 1) await saveHardware();
      else if (step === 2) await saveNetwork();
      else if (step === 3) await saveSecurity();
      toast.success(STEPS[step] + ' saved');
      if (step < STEPS.length - 1) setStep(s => s + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
    </div>
  );
  if (!server) return null;

  return (
    <div className="animate-in">
      <div className="page-header mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <Link href={'/servers/' + id} className="btn-ghost flex-shrink-0" aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="page-title">Edit Server</h1>
            <p className="page-subtitle font-mono">{server.server_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href={'/servers/' + id} className="btn-secondary">View Server</Link>
          <button type="button" onClick={handleSaveAll} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save All</>}
          </button>
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all border
              ${i === step ? 'bg-[var(--primary)] text-white font-medium border-[var(--primary)]'
                : i < step ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30'
                : 'text-[var(--text-secondary)] border-[var(--border-soft)] bg-[var(--background-card)]'}`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs border border-current">
              {i < step ? '✓' : i + 1}
            </span>
            {s}
          </button>
        ))}
      </div>

      <div className="form-section">
        <div className="form-section-header">
          <span>{STEPS[step]}</span>
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
        </div>
        <div className="form-section-body">

          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField id={fid('hostname')} label="Hostname" value={basic.hostname} onChange={v => setB('hostname', v)} placeholder="web-prod-01" />
              <SelectField id={fid('type')} label="Server Type" value={basic.server_type} onChange={v => setB('server_type', v)}
                options={[{value:'Physical',label:'Physical'},{value:'Virtual',label:'Virtual'},{value:'Cloud',label:'Cloud'}]} />
              <SelectField id={fid('env')} label="Environment" value={basic.environment} onChange={v => setB('environment', v)}
                options={[{value:'Production',label:'Production'},{value:'Staging',label:'Staging'},{value:'Development',label:'Development'},{value:'DR',label:'DR'}]} />
              <InputField id={fid('role')} label="Role" value={basic.role} onChange={v => setB('role', v)} placeholder="Web Server, DB Server…" />
              <SelectField id={fid('status')} label="Status" value={basic.status} onChange={v => setB('status', v)}
                options={[{value:'Active',label:'Active'},{value:'Inactive',label:'Inactive'},{value:'Under Maintenance',label:'Under Maintenance'},{value:'Decommissioned',label:'Decommissioned'}]} />
              <SelectField id={fid('power')} label="Power Type" value={basic.power_type} onChange={v => setB('power_type', v)}
                options={[{value:'Single',label:'Single'},{value:'Double',label:'Double (Redundant)'}]} />
              <SelectField id={fid('dept')} label="Department" value={basic.department_id} onChange={v => setB('department_id', v)}
                options={departments.map(d => ({value: d.department_id, label: d.department_name}))} />
              <SelectField id={fid('team')} label="Team" value={basic.team_id}
                onChange={v => { setB('team_id', v); setB('engineer_id', ''); }}
                options={teams.map(t => ({value: t.team_id, label: `${t.team_name} (${t.department_name})`}))} />
              <SelectField id={fid('eng')} label="Assign Engineer" value={basic.engineer_id} onChange={v => setB('engineer_id', v)}
                options={engineers.map(e => ({value: e.engineer_id, label: e.full_name + (e.specialization ? ` — ${e.specialization}` : '')}))} />
              <SelectField id={fid('loc')} label="Location" value={basic.location_id} onChange={v => { setB('location_id', v); setB('rack_id', ''); }}
                options={locations.map(l => ({value: l.location_id, label: `${l.site_name} - ${l.city}`}))} />
              <SelectField id={fid('rack')} label="Rack" value={basic.rack_id} onChange={v => setB('rack_id', v)}
                options={racks.map(r => ({value: r.rack_id, label: `${r.rack_code} - ${r.rack_name}`}))} />
              <InputField id={fid('u-start')} label="U Position Start" type="number" value={basic.u_position_start} onChange={v => setB('u_position_start', v)} placeholder="1" />
              <InputField id={fid('u-end')} label="U Position End" type="number" value={basic.u_position_end} onChange={v => setB('u_position_end', v)} placeholder="2" />
              <InputField id={fid('install')} label="Install Date" type="date" value={basic.install_date} onChange={v => setB('install_date', v)} />
              <div className="md:col-span-2 lg:col-span-3">
                <label htmlFor={fid('notes')} className="label cursor-pointer">Notes</label>
                <textarea id={fid('notes')} value={basic.notes} onChange={e => setB('notes', e.target.value)}
                  className="input-field h-20 resize-none" placeholder="Additional notes…" />
              </div>
            </div>
          )}

          {/* Step 1: Hardware */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField id={fid('hw-vendor')} label="Vendor" value={hardware.vendor} onChange={v => setHw('vendor', v)} placeholder="Dell, HP, Lenovo…" />
              <InputField id={fid('hw-model')} label="Model" value={hardware.model} onChange={v => setHw('model', v)} placeholder="PowerEdge R740" />
              <InputField id={fid('hw-serial')} label="Serial Number" value={hardware.serial_number} onChange={v => setHw('serial_number', v)} />
              <InputField id={fid('hw-asset')} label="Asset Tag" value={hardware.asset_tag} onChange={v => setHw('asset_tag', v)} />
              <InputField id={fid('hw-cpu')} label="CPU Model" value={hardware.cpu_model} onChange={v => setHw('cpu_model', v)} placeholder="Intel Xeon Gold 6248" />
              <InputField id={fid('hw-cores')} label="CPU Cores" type="number" value={hardware.cpu_cores} onChange={v => setHw('cpu_cores', v)} />
              <InputField id={fid('hw-ram')} label="RAM (GB)" type="number" value={hardware.ram_gb} onChange={v => setHw('ram_gb', v)} />
              <InputField id={fid('hw-storage')} label="Storage (TB)" type="number" value={hardware.storage_tb} onChange={v => setHw('storage_tb', v)} />
              <InputField id={fid('hw-raid')} label="RAID Level" value={hardware.raid_level} onChange={v => setHw('raid_level', v)} placeholder="RAID 5, RAID 10…" />
              <InputField id={fid('hw-nic')} label="NIC Count" type="number" value={hardware.nic_count} onChange={v => setHw('nic_count', v)} />
              <InputField id={fid('hw-psu')} label="Power Supply" value={hardware.power_supply} onChange={v => setHw('power_supply', v)} placeholder="Redundant 750W" />
              <InputField id={fid('hw-ws')} label="Warranty Start" type="date" value={hardware.warranty_start} onChange={v => setHw('warranty_start', v)} />
              <InputField id={fid('hw-we')} label="Warranty Expiry" type="date" value={hardware.warranty_expiry} onChange={v => setHw('warranty_expiry', v)} />
            </div>
          )}

          {/* Step 2: Network */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField id={fid('net-ip')} label="Primary IP" value={network.ip_address} onChange={v => setNet('ip_address', v)} placeholder="10.0.1.100" />
              <InputField id={fid('net-ip2')} label="Secondary IP" value={network.secondary_ip} onChange={v => setNet('secondary_ip', v)} />
              <InputField id={fid('net-ipv6')} label="IPv6" value={network.ipv6} onChange={v => setNet('ipv6', v)} />
              <InputField id={fid('net-subnet')} label="Subnet" value={network.subnet} onChange={v => setNet('subnet', v)} placeholder="255.255.255.0" />
              <InputField id={fid('net-vlan')} label="VLAN" value={network.vlan} onChange={v => setNet('vlan', v)} placeholder="VLAN 100" />
              <InputField id={fid('net-gw')} label="Gateway" value={network.gateway} onChange={v => setNet('gateway', v)} placeholder="10.0.1.1" />
              <InputField id={fid('net-dns1')} label="Primary DNS" value={network.dns_primary} onChange={v => setNet('dns_primary', v)} />
              <InputField id={fid('net-dns2')} label="Secondary DNS" value={network.dns_secondary} onChange={v => setNet('dns_secondary', v)} />
              <InputField id={fid('net-type')} label="Network Type" value={network.network_type} onChange={v => setNet('network_type', v)} placeholder="Management, Data…" />
              <InputField id={fid('net-bw')} label="Bandwidth" value={network.bandwidth} onChange={v => setNet('bandwidth', v)} placeholder="1Gbps, 10Gbps…" />
              <div className="flex items-center gap-6 md:col-span-2">
                <CheckboxField id={fid('fw')} label="Firewall Enabled" checked={network.firewall_enabled} onChange={v => setNet('firewall_enabled', v)} />
                <CheckboxField id={fid('nat')} label="NAT Enabled" checked={network.nat_enabled} onChange={v => setNet('nat_enabled', v)} />
              </div>
            </div>
          )}

          {/* Step 3: Security */}
          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField id={fid('sec-os')} label="OS Name" value={security.os_name} onChange={v => setSec('os_name', v)} placeholder="Ubuntu, RHEL, Windows…" />
              <InputField id={fid('sec-ver')} label="OS Version" value={security.os_version} onChange={v => setSec('os_version', v)} placeholder="22.04 LTS" />
              <SelectField id={fid('sec-hard')} label="Hardening Status" value={security.hardening_status} onChange={v => setSec('hardening_status', v)}
                options={[{value:'Pending',label:'Pending'},{value:'Hardened',label:'Hardened'},{value:'Partially Hardened',label:'Partially Hardened'},{value:'Not Hardened',label:'Not Hardened'}]} />
              <SelectField id={fid('sec-comp')} label="Compliance Status" value={security.compliance_status} onChange={v => setSec('compliance_status', v)}
                options={[{value:'',label:'Not set'},{value:'Compliant',label:'Compliant'},{value:'Non-Compliant',label:'Non-Compliant'},{value:'In Review',label:'In Review'}]} />
              <InputField id={fid('sec-bkfreq')} label="Backup Frequency" value={security.backup_frequency} onChange={v => setSec('backup_frequency', v)} placeholder="Daily, Weekly…" />
              <InputField id={fid('sec-bkdest')} label="Backup Destination" value={security.backup_destination} onChange={v => setSec('backup_destination', v)} placeholder="NAS, S3…" />
              <InputField id={fid('sec-log')} label="Log Retention (days)" type="number" value={security.log_retention_days} onChange={v => setSec('log_retention_days', v)} />
              <InputField id={fid('sec-last-audit')} label="Last Audit Date" type="date" value={security.last_audit_date} onChange={v => setSec('last_audit_date', v)} />
              <InputField id={fid('sec-next-audit')} label="Next Audit Date" type="date" value={security.next_audit_date} onChange={v => setSec('next_audit_date', v)} />
              <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-3">
                <CheckboxField id={fid('ssh')} label="SSH Key Only" checked={security.ssh_key_only} onChange={v => setSec('ssh_key_only', v)} />
                <CheckboxField id={fid('av')} label="Antivirus Installed" checked={security.antivirus_installed} onChange={v => setSec('antivirus_installed', v)} />
                <CheckboxField id={fid('bk')} label="Backup Enabled" checked={security.backup_enabled} onChange={v => setSec('backup_enabled', v)} />
              </div>
            </div>
          )}

          {/* Step 4: Credentials (read-only — access via OTP from server list) */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary-soft)] p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--primary)]">Credentials are OTP-protected</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    To view or copy credentials, use the <span className="font-medium">key icon</span> in the server list.
                    Access requires OTP verification and is logged in the activity log.
                  </p>
                </div>
              </div>
              {credentials.length > 0 ? (
                <div className="space-y-3">
                  {credentials.map((cred, i) => (
                    <div key={cred.credential_id ?? i} className="card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{cred.credential_type || 'Credential'}</span>
                        {cred.port && <span className="text-xs text-[var(--text-secondary)] font-mono">Port {cred.port}</span>}
                      </div>
                      {cred.username && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-muted)] w-20">Username</span>
                          <span className="text-sm font-mono text-[var(--text-primary)]">{cred.username}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)] w-20">Password</span>
                        <span className="text-sm font-mono text-[var(--text-muted)]">••••••••  (unlock via server list)</span>
                      </div>
                      {cred.notes && <p className="text-xs text-[var(--text-muted)]">{cred.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">No credentials stored for this server.</p>
              )}
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || saving} className="btn-cancel disabled:opacity-30">
              Back
            </button>
            <div className="flex items-center gap-3">
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={handleSaveStep} disabled={saving} className="btn-save">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Save &amp; Next <ChevronRight className="w-4 h-4" /></>}
                </button>
              ) : (
                <button type="button" onClick={handleSaveAll} disabled={saving} className="btn-save">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save All</>}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
