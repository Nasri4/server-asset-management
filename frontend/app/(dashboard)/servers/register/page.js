'use client';
import { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import { isValidServerCode } from '../../../../lib/validation';
import { Server, Eye, EyeOff, Loader2, Save, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = ['Basic Info', 'Hardware', 'Network', 'Security', 'Credentials'];

function InputField({ id, label, value, onChange, type = 'text', placeholder = '', className = '' }) {
  return (
    <div className={`${className} relative`}>
      <label htmlFor={id} className="label cursor-pointer">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
        autoComplete="off"
      />
    </div>
  );
}

function SelectField({ id, label, value, onChange, options, className = '' }) {
  return (
    <div className={`${className} relative`}>
      <label htmlFor={id} className="label cursor-pointer">{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className="select-field">
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function RegisterServerPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [locations, setLocations] = useState([]);
  const [racks, setRacks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [engineers, setEngineers] = useState([]);

  const [form, setForm] = useState({
    server_code: '', hostname: '', server_type: 'Physical', environment: 'Production',
    role: '', status: 'Active', power_type: 'Single', team_id: '', department_id: '',
    location_id: '', rack_id: '', u_position_start: '', u_position_end: '',
    install_date: '', notes: '', engineer_id: '',
    hardware: {
      vendor: '', model: '', serial_number: '', asset_tag: '', cpu_model: '',
      cpu_cores: '', ram_gb: '', storage_tb: '', raid_level: '', nic_count: '',
      power_supply: '', warranty_start: '', warranty_expiry: '',
    },
    network: {
      ip_address: '', secondary_ip: '', ipv6: '', subnet: '', vlan: '', gateway: '',
      dns_primary: '', dns_secondary: '', network_type: '', bandwidth: '',
      firewall_enabled: false, nat_enabled: false,
    },
    security: {
      os_name: '', os_version: '', hardening_status: 'Pending', ssh_key_only: false,
      antivirus_installed: false, backup_enabled: false, backup_frequency: '', log_retention_days: 90,
    },
    credentials: { credential_type: 'SSH', username: '', password: '', port: 22, notes: '' },
  });

  useEffect(() => {
    async function loadDropdowns() {
      try {
        const [loc, team, dept] = await Promise.all([
          api.get('/locations'), api.get('/teams'), api.get('/departments'),
        ]);
        setLocations(loc.data ?? []);
        setTeams(team.data ?? []);
        setDepartments(dept.data ?? []);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load dropdowns');
      }
    }
    loadDropdowns();
  }, []);

  useEffect(() => {
    if (form.location_id) {
      api.get(`/racks?location_id=${form.location_id}`)
        .then(r => setRacks(r.data ?? []))
        .catch(() => setRacks([]));
    } else {
      setRacks([]);
    }
  }, [form.location_id]);

  // Load engineers filtered by selected team
  useEffect(() => {
    if (form.team_id) {
      api.get('/engineers', { params: { team_id: form.team_id } })
        .then(r => setEngineers(r.data ?? []))
        .catch(() => setEngineers([]));
    } else {
      setEngineers([]);
      updateForm('engineer_id', '');
    }
  }, [form.team_id]);

  function updateForm(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }
  function updateNested(section, field, value) {
    setForm(f => ({ ...f, [section]: { ...f[section], [field]: value } }));
  }

  async function handleSubmit() {
    if (!form.server_code?.trim()) return toast.error('Server code is required');
    if (!isValidServerCode(form.server_code)) {
      return toast.error('Server code may only contain letters, numbers, hyphens, and underscores');
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        team_id: form.team_id || null,
        department_id: form.department_id || null,
        location_id: form.location_id || null,
        rack_id: form.rack_id || null,
        engineer_id: form.engineer_id || null,
        u_position_start: form.u_position_start ? parseInt(form.u_position_start) : null,
        u_position_end: form.u_position_end ? parseInt(form.u_position_end) : null,
      };
      const res = await api.post('/servers', payload);
      toast.success('Server registered successfully');
      router.push(`/servers/${res.data.id}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to register server';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const baseId = useId().replace(/:/g, '');
  const fieldId = (suffix) => `${baseId}-${suffix}`;

  return (
    <div className="animate-in">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Register New Server</h1>
          <p className="page-subtitle">Add a new server to the asset inventory</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all border
              ${i === step ? 'bg-[var(--primary)] text-white font-medium border-[var(--primary)]'
                : i < step ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30'
                : 'text-[var(--text-secondary)] border-[var(--border-soft)] bg-[var(--background-card)]'}`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs border border-current">{i < step ? '✓' : i + 1}</span>
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
            <InputField id={fieldId('server-code')} label="Server Code *" value={form.server_code}
                       onChange={v => updateForm('server_code', v)} placeholder="SRV-MOG-001" />
            <InputField id={fieldId('hostname')} label="Hostname" value={form.hostname}
                       onChange={v => updateForm('hostname', v)} placeholder="web-prod-01" />
            <SelectField id={fieldId('server-type')} label="Server Type" value={form.server_type}
                        onChange={v => updateForm('server_type', v)}
                        options={[{value:'Physical',label:'Physical'},{value:'Virtual',label:'Virtual'},{value:'Cloud',label:'Cloud'}]} />
            <SelectField id={fieldId('environment')} label="Environment" value={form.environment}
                        onChange={v => updateForm('environment', v)}
                        options={[{value:'Production',label:'Production'},{value:'Staging',label:'Staging'},{value:'Development',label:'Development'},{value:'DR',label:'DR'}]} />
            <InputField id={fieldId('role')} label="Role" value={form.role}
                       onChange={v => updateForm('role', v)} placeholder="Web Server, DB Server..." />
            <SelectField id={fieldId('status')} label="Status" value={form.status}
                        onChange={v => updateForm('status', v)}
                        options={[{value:'Active',label:'Active'},{value:'Inactive',label:'Inactive'},{value:'Under Maintenance',label:'Under Maintenance'}]} />
            <SelectField id={fieldId('power-type')} label="Power Type" value={form.power_type}
                        onChange={v => updateForm('power_type', v)}
                        options={[{value:'Single',label:'Single'},{value:'Double',label:'Double (Redundant)'}]} />
            <SelectField id={fieldId('department')} label="Department" value={form.department_id}
                        onChange={v => updateForm('department_id', v)}
                        options={departments.map(d => ({value: d.department_id, label: d.department_name}))} />
            <SelectField id={fieldId('team')} label="Team" value={form.team_id}
                        onChange={v => { updateForm('team_id', v); updateForm('engineer_id', ''); }}
                        options={teams.map(t => ({value: t.team_id, label: `${t.team_name} (${t.department_name})`}))} />
            <SelectField id={fieldId('engineer')} label="Assign Engineer" value={form.engineer_id}
                        onChange={v => updateForm('engineer_id', v)}
                        options={engineers.map(e => ({value: e.engineer_id, label: e.full_name + (e.specialization ? ` — ${e.specialization}` : '')}))} />
            <SelectField id={fieldId('location')} label="Location" value={form.location_id}
                        onChange={v => updateForm('location_id', v)}
                        options={locations.map(l => ({value: l.location_id, label: `${l.site_name} - ${l.city}`}))} />
            <SelectField id={fieldId('rack')} label="Rack" value={form.rack_id}
                        onChange={v => updateForm('rack_id', v)}
                        options={racks.map(r => ({value: r.rack_id, label: `${r.rack_code} - ${r.rack_name}`}))} />
            <InputField id={fieldId('u-start')} label="U Position Start" value={form.u_position_start} type="number"
                       onChange={v => updateForm('u_position_start', v)} placeholder="1" />
            <InputField id={fieldId('u-end')} label="U Position End" value={form.u_position_end} type="number"
                       onChange={v => updateForm('u_position_end', v)} placeholder="2" />
            <InputField id={fieldId('install-date')} label="Install Date" value={form.install_date} type="date"
                       onChange={v => updateForm('install_date', v)} />
            <div className="md:col-span-2 lg:col-span-3">
              <label htmlFor={fieldId('notes')} className="label cursor-pointer">Notes</label>
              <textarea id={fieldId('notes')} value={form.notes} onChange={e => updateForm('notes', e.target.value)}
                        className="input-field h-20 resize-none" placeholder="Additional notes..." />
            </div>
          </div>
        )}

        {/* Step 1: Hardware */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputField id={fieldId('hw-vendor')} label="Vendor" value={form.hardware.vendor}
                       onChange={v => updateNested('hardware', 'vendor', v)} placeholder="Dell, HP, Lenovo..." />
            <InputField id={fieldId('hw-model')} label="Model" value={form.hardware.model}
                       onChange={v => updateNested('hardware', 'model', v)} placeholder="PowerEdge R740" />
            <InputField id={fieldId('hw-serial')} label="Serial Number" value={form.hardware.serial_number}
                       onChange={v => updateNested('hardware', 'serial_number', v)} />
            <InputField id={fieldId('hw-asset')} label="Asset Tag" value={form.hardware.asset_tag}
                       onChange={v => updateNested('hardware', 'asset_tag', v)} />
            <InputField id={fieldId('hw-cpu')} label="CPU Model" value={form.hardware.cpu_model}
                       onChange={v => updateNested('hardware', 'cpu_model', v)} placeholder="Intel Xeon Gold 6248" />
            <InputField id={fieldId('hw-cores')} label="CPU Cores" value={form.hardware.cpu_cores} type="number"
                       onChange={v => updateNested('hardware', 'cpu_cores', v)} />
            <InputField id={fieldId('hw-ram')} label="RAM (GB)" value={form.hardware.ram_gb} type="number"
                       onChange={v => updateNested('hardware', 'ram_gb', v)} />
            <InputField id={fieldId('hw-storage')} label="Storage (TB)" value={form.hardware.storage_tb} type="number"
                       onChange={v => updateNested('hardware', 'storage_tb', v)} />
            <InputField id={fieldId('hw-raid')} label="RAID Level" value={form.hardware.raid_level}
                       onChange={v => updateNested('hardware', 'raid_level', v)} placeholder="RAID 5, RAID 10..." />
            <InputField id={fieldId('hw-nic')} label="NIC Count" value={form.hardware.nic_count} type="number"
                       onChange={v => updateNested('hardware', 'nic_count', v)} />
            <InputField id={fieldId('hw-psu')} label="Power Supply" value={form.hardware.power_supply}
                       onChange={v => updateNested('hardware', 'power_supply', v)} placeholder="Redundant 750W" />
            <InputField id={fieldId('hw-warr-start')} label="Warranty Start" value={form.hardware.warranty_start} type="date"
                       onChange={v => updateNested('hardware', 'warranty_start', v)} />
            <InputField id={fieldId('hw-warr-end')} label="Warranty Expiry" value={form.hardware.warranty_expiry} type="date"
                       onChange={v => updateNested('hardware', 'warranty_expiry', v)} />
          </div>
        )}

        {/* Step 2: Network */}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputField id={fieldId('net-ip')} label="Primary IP" value={form.network.ip_address}
                       onChange={v => updateNested('network', 'ip_address', v)} placeholder="10.0.1.100" />
            <InputField id={fieldId('net-ip2')} label="Secondary IP" value={form.network.secondary_ip}
                       onChange={v => updateNested('network', 'secondary_ip', v)} />
            <InputField id={fieldId('net-ipv6')} label="IPv6" value={form.network.ipv6}
                       onChange={v => updateNested('network', 'ipv6', v)} />
            <InputField id={fieldId('net-subnet')} label="Subnet" value={form.network.subnet}
                       onChange={v => updateNested('network', 'subnet', v)} placeholder="255.255.255.0" />
            <InputField id={fieldId('net-vlan')} label="VLAN" value={form.network.vlan}
                       onChange={v => updateNested('network', 'vlan', v)} placeholder="VLAN 100" />
            <InputField id={fieldId('net-gw')} label="Gateway" value={form.network.gateway}
                       onChange={v => updateNested('network', 'gateway', v)} placeholder="10.0.1.1" />
            <InputField id={fieldId('net-dns1')} label="Primary DNS" value={form.network.dns_primary}
                       onChange={v => updateNested('network', 'dns_primary', v)} />
            <InputField id={fieldId('net-dns2')} label="Secondary DNS" value={form.network.dns_secondary}
                       onChange={v => updateNested('network', 'dns_secondary', v)} />
            <InputField id={fieldId('net-type')} label="Network Type" value={form.network.network_type}
                       onChange={v => updateNested('network', 'network_type', v)} placeholder="Management, Data..." />
            <InputField id={fieldId('net-bw')} label="Bandwidth" value={form.network.bandwidth}
                       onChange={v => updateNested('network', 'bandwidth', v)} placeholder="1Gbps, 10Gbps..." />
            <div className="flex items-center gap-6 md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.network.firewall_enabled}
                       onChange={e => updateNested('network', 'firewall_enabled', e.target.checked)}
                       className="w-4 h-4 rounded border-[var(--border-soft)] text-[var(--primary)] focus:ring-[var(--primary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Firewall Enabled</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.network.nat_enabled}
                       onChange={e => updateNested('network', 'nat_enabled', e.target.checked)}
                       className="w-4 h-4 rounded border-[var(--border-soft)] text-[var(--primary)] focus:ring-[var(--primary)]" />
                <span className="text-sm text-[var(--text-secondary)]">NAT Enabled</span>
              </label>
            </div>
          </div>
        )}

        {/* Step 3: Security */}
        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputField id={fieldId('sec-os')} label="OS Name" value={form.security.os_name}
                       onChange={v => updateNested('security', 'os_name', v)} placeholder="Ubuntu, RHEL, Windows..." />
            <InputField id={fieldId('sec-ver')} label="OS Version" value={form.security.os_version}
                       onChange={v => updateNested('security', 'os_version', v)} placeholder="22.04 LTS" />
            <SelectField id={fieldId('sec-hard')} label="Hardening Status" value={form.security.hardening_status}
                        onChange={v => updateNested('security', 'hardening_status', v)}
                        options={[{value:'Pending',label:'Pending'},{value:'Hardened',label:'Hardened'},
                                  {value:'Partially Hardened',label:'Partially Hardened'},{value:'Not Hardened',label:'Not Hardened'}]} />
            <InputField id={fieldId('sec-backup-freq')} label="Backup Frequency" value={form.security.backup_frequency}
                       onChange={v => updateNested('security', 'backup_frequency', v)} placeholder="Daily, Weekly..." />
            <InputField id={fieldId('sec-log')} label="Log Retention (days)" value={form.security.log_retention_days} type="number"
                       onChange={v => updateNested('security', 'log_retention_days', v)} />
            <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.security.ssh_key_only}
                       onChange={e => updateNested('security', 'ssh_key_only', e.target.checked)}
                       className="w-4 h-4 rounded border-[var(--border-soft)] text-[var(--primary)] focus:ring-[var(--primary)]" />
                <span className="text-sm text-[var(--text-secondary)]">SSH Key Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.security.antivirus_installed}
                       onChange={e => updateNested('security', 'antivirus_installed', e.target.checked)}
                       className="w-4 h-4 rounded border-[var(--border-soft)] text-[var(--primary)] focus:ring-[var(--primary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Antivirus Installed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.security.backup_enabled}
                       onChange={e => updateNested('security', 'backup_enabled', e.target.checked)}
                       className="w-4 h-4 rounded border-[var(--border-soft)] text-[var(--primary)] focus:ring-[var(--primary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Backup Enabled</span>
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Credentials */}
        {step === 4 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField id={fieldId('cred-type')} label="Credential Type" value={form.credentials.credential_type}
                        onChange={v => updateNested('credentials', 'credential_type', v)}
                        options={[{value:'SSH',label:'SSH'},{value:'RDP',label:'RDP'},{value:'iLO',label:'iLO/iDRAC'},{value:'Console',label:'Console'}]} />
            <InputField id={fieldId('cred-user')} label="Username" value={form.credentials.username}
                       onChange={v => updateNested('credentials', 'username', v)} placeholder="root, admin..." />
            <div>
              <label htmlFor={fieldId('cred-pass')} className="label cursor-pointer">Password</label>
              <div className="relative">
                <input
                  id={fieldId('cred-pass')}
                  type={showPass ? 'text' : 'password'}
                  value={form.credentials.password}
                  onChange={e => updateNested('credentials', 'password', e.target.value)}
                  placeholder="Server password"
                  className="input-field pr-11"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--primary)]">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <InputField id={fieldId('cred-port')} label="Port" value={form.credentials.port} type="number"
                       onChange={v => updateNested('credentials', 'port', v)} />
            <div className="md:col-span-2">
              <label htmlFor={fieldId('cred-notes')} className="label cursor-pointer">Credential Notes</label>
              <textarea id={fieldId('cred-notes')} value={form.credentials.notes}
                        onChange={e => updateNested('credentials', 'notes', e.target.value)}
                        className="input-field h-20 resize-none" placeholder="Access notes..." />
            </div>
            <div className="md:col-span-2 rounded-xl p-4 text-sm border bg-[var(--warning-soft)] border-[var(--warning)]/30 text-[var(--warning)]">
              Credentials are encrypted at rest. Viewing them later requires OTP verification via SMS.
            </div>
          </div>
        )}

        <div className="form-actions">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="btn-cancel disabled:opacity-30">
            Back
          </button>
          <div className="flex items-center gap-3">
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn-save">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="btn-save">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loading ? 'Registering...' : 'Save'}
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
