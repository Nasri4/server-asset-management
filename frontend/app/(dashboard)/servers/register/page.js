'use client';

import { useId, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  Network,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const toast = { error: (message) => alert(message), success: (message) => alert(message) };

const STEPS = [
  { id: 'basic', label: 'Basic Info', fullLabel: 'Basic Information', icon: Server, desc: 'Identity and location' },
  { id: 'hardware', label: 'Hardware', fullLabel: 'Hardware Specs', icon: Cpu, desc: 'Compute and storage' },
  { id: 'network', label: 'Network', fullLabel: 'Network and IP', icon: Network, desc: 'Addressing and zones' },
  { id: 'security', label: 'Security', fullLabel: 'Security and OS', icon: ShieldCheck, desc: 'OS and compliance' },
  { id: 'credentials', label: 'Vault', fullLabel: 'Secure Vault', icon: KeyRound, desc: 'Encrypted credentials' },
];

// Reduced padding (py-1.5) for tighter input fields
const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-900 outline-none transition-all shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30';

function Field({ id, label, children, required = false }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-1 text-indigo-600">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function Input({ id, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={inputCls}
    />
  );
}

function Select({ id, value, onChange, options }) {
  return (
    <select 
      id={id} 
      value={value} 
      onChange={(event) => onChange(event.target.value)} 
      className={`${inputCls} appearance-none cursor-pointer`}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
    >
      <option value="" disabled>
        Select...
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({ id, label, desc, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-3 shadow-sm cursor-pointer hover:border-slate-300 transition-colors">
      <div>
        <div className="text-[13px] font-semibold text-slate-900">{label}</div>
        {desc ? <div className="text-[11px] text-slate-500 mt-0.5">{desc}</div> : null}
      </div>
      <div className="relative inline-flex items-center">
        <input id={id} type="checkbox" className="sr-only peer" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
      </div>
    </label>
  );
}

function Textarea({ id, value, onChange, placeholder = '' }) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`${inputCls} min-h-[80px] resize-y py-2`}
    />
  );
}

export default function RegisterServerPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({
    server_code: '',
    hostname: '',
    role: '',
    server_type: 'Physical',
    environment: 'Production',
    status: 'Active',
    notes: '',
    hardware: {
      vendor: '',
      model: '',
      serial_number: '',
      cpu_model: '',
      cpu_cores: '',
      ram_gb: '',
      storage_tb: '',
    },
    network: {
      ip_address: '',
      subnet: '',
      gateway: '',
      dns_primary: '',
      firewall_enabled: false,
      nat_enabled: false,
    },
    security: {
      os_name: '',
      os_version: '',
      hardening_status: 'Pending',
      ssh_key_only: false,
      antivirus_installed: false,
      backup_enabled: false,
      log_retention_days: 90,
    },
    credentials: {
      credential_type: 'SSH',
      username: '',
      password: '',
      port: 22,
      notes: '',
    },
  });

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateNested(section, field, value) {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }

  async function handleSubmit() {
    if (!form.server_code?.trim()) {
      toast.error('Server code is required');
      return;
    }
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      toast.success('Server provisioned successfully');
    } catch {
      toast.error('Failed to provision');
    } finally {
      setLoading(false);
    }
  }

  const baseId = useId().replace(/:/g, '');
  const fid = (suffix) => `${baseId}-${suffix}`;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  // Soft background applied to main wrapper
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        
        {/* Premium Compact Header */}
        <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2">
              <Server className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight">Provision Server</h1>
              <p className="text-xs text-slate-500">CMDB Asset Registry</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="text-xs font-semibold text-slate-500">{progress}%</span>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-6">
          
          {/* Left Sidebar */}
          <aside className="md:w-56 shrink-0">
            <div className="sticky top-6 rounded-xl border border-slate-200 bg-white p-2 shadow-sm space-y-1">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const active = index === step;
                const done = index < step;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStep(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all ${
                      active ? 'bg-indigo-50/50 ring-1 ring-indigo-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className={`rounded-md p-1.5 ${active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className={`truncate text-[13px] font-semibold ${active ? 'text-indigo-900' : 'text-slate-700'}`}>{item.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Form Content */}
          <main className="flex-1 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800">{STEPS[step].fullLabel}</h2>
              <p className="text-[13px] text-slate-500 mt-1">{STEPS[step].desc}</p>
            </div>

            <div className="space-y-5">
              
              {/* STEP 0: BASIC */}
              {step === 0 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('code')} label="Server Code" required>
                      <Input id={fid('code')} value={form.server_code} onChange={(value) => updateForm('server_code', value)} placeholder="SRV-APP-01" />
                    </Field>
                    <Field id={fid('hostname')} label="Hostname">
                      <Input id={fid('hostname')} value={form.hostname} onChange={(value) => updateForm('hostname', value)} placeholder="app01.internal" />
                    </Field>
                  </div>
                  
                  <Field id={fid('role')} label="Primary Role">
                    <Input id={fid('role')} value={form.role} onChange={(value) => updateForm('role', value)} placeholder="e.g. Web Server, Database" />
                  </Field>
                  
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('type')} label="Server Type">
                      <Select
                        id={fid('type')}
                        value={form.server_type}
                        onChange={(value) => updateForm('server_type', value)}
                        options={[
                          { value: 'Physical', label: 'Physical Bare-metal' },
                          { value: 'Virtual', label: 'Virtual Machine' },
                          { value: 'Cloud', label: 'Cloud Instance' },
                        ]}
                      />
                    </Field>
                    <Field id={fid('env')} label="Environment">
                      <Select
                        id={fid('env')}
                        value={form.environment}
                        onChange={(value) => updateForm('environment', value)}
                        options={[
                          { value: 'Production', label: 'Production' },
                          { value: 'Staging', label: 'Staging' },
                          { value: 'Development', label: 'Development' },
                        ]}
                      />
                    </Field>
                  </div>
                  
                  <Field id={fid('notes')} label="Context Notes">
                    <Textarea id={fid('notes')} value={form.notes} onChange={(value) => updateForm('notes', value)} placeholder="Deployment instructions..." />
                  </Field>
                </div>
              )}

              {/* STEP 1: HARDWARE */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('vendor')} label="Vendor">
                      <Input id={fid('vendor')} value={form.hardware.vendor} onChange={(value) => updateNested('hardware', 'vendor', value)} placeholder="Dell, HP..." />
                    </Field>
                    <Field id={fid('model')} label="Model">
                      <Input id={fid('model')} value={form.hardware.model} onChange={(value) => updateNested('hardware', 'model', value)} placeholder="PowerEdge R740" />
                    </Field>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('serial')} label="Serial Number">
                      <Input id={fid('serial')} value={form.hardware.serial_number} onChange={(value) => updateNested('hardware', 'serial_number', value)} />
                    </Field>
                    <Field id={fid('cpu')} label="CPU Model">
                      <Input id={fid('cpu')} value={form.hardware.cpu_model} onChange={(value) => updateNested('hardware', 'cpu_model', value)} placeholder="Intel Xeon" />
                    </Field>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <Field id={fid('cores')} label="Cores">
                      <Input id={fid('cores')} type="number" value={form.hardware.cpu_cores} onChange={(value) => updateNested('hardware', 'cpu_cores', value)} placeholder="16" />
                    </Field>
                    <Field id={fid('ram')} label="RAM (GB)">
                      <Input id={fid('ram')} type="number" value={form.hardware.ram_gb} onChange={(value) => updateNested('hardware', 'ram_gb', value)} placeholder="64" />
                    </Field>
                    <Field id={fid('storage')} label="Storage (TB)">
                      <Input id={fid('storage')} type="number" value={form.hardware.storage_tb} onChange={(value) => updateNested('hardware', 'storage_tb', value)} placeholder="2" />
                    </Field>
                  </div>
                </div>
              )}

              {/* STEP 2: NETWORK */}
              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('ip')} label="Primary IPv4">
                      <Input id={fid('ip')} value={form.network.ip_address} onChange={(value) => updateNested('network', 'ip_address', value)} placeholder="10.0.1.100" />
                    </Field>
                    <Field id={fid('dns')} label="Primary DNS">
                      <Input id={fid('dns')} value={form.network.dns_primary} onChange={(value) => updateNested('network', 'dns_primary', value)} placeholder="8.8.8.8" />
                    </Field>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('subnet')} label="Subnet Mask">
                      <Input id={fid('subnet')} value={form.network.subnet} onChange={(value) => updateNested('network', 'subnet', value)} placeholder="255.255.255.0" />
                    </Field>
                    <Field id={fid('gateway')} label="Gateway">
                      <Input id={fid('gateway')} value={form.network.gateway} onChange={(value) => updateNested('network', 'gateway', value)} placeholder="10.0.1.1" />
                    </Field>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                    <Toggle id={fid('firewall')} label="Host Firewall" desc="Enable OS-level rules" checked={form.network.firewall_enabled} onChange={(value) => updateNested('network', 'firewall_enabled', value)} />
                    <Toggle id={fid('nat')} label="NAT Translation" desc="Requires network translation" checked={form.network.nat_enabled} onChange={(value) => updateNested('network', 'nat_enabled', value)} />
                  </div>
                </div>
              )}

              {/* STEP 3: SECURITY */}
              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('os')} label="OS Distribution">
                      <Input id={fid('os')} value={form.security.os_name} onChange={(value) => updateNested('security', 'os_name', value)} placeholder="Ubuntu, Windows" />
                    </Field>
                    <Field id={fid('osv')} label="Version">
                      <Input id={fid('osv')} value={form.security.os_version} onChange={(value) => updateNested('security', 'os_version', value)} placeholder="22.04 LTS" />
                    </Field>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('hardening')} label="Hardening Status">
                      <Select
                        id={fid('hardening')}
                        value={form.security.hardening_status}
                        onChange={(value) => updateNested('security', 'hardening_status', value)}
                        options={[
                          { value: 'Pending', label: 'Pending Audit' },
                          { value: 'Hardened', label: 'Hardened' },
                          { value: 'Partially Hardened', label: 'Partially Hardened' },
                        ]}
                      />
                    </Field>
                    <Field id={fid('logs')} label="Log Retention (days)">
                      <Input id={fid('logs')} type="number" value={form.security.log_retention_days} onChange={(value) => updateNested('security', 'log_retention_days', value)} />
                    </Field>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
                    <Toggle id={fid('ssh')} label="Key-Only Auth" checked={form.security.ssh_key_only} onChange={(value) => updateNested('security', 'ssh_key_only', value)} />
                    <Toggle id={fid('av')} label="Antivirus" checked={form.security.antivirus_installed} onChange={(value) => updateNested('security', 'antivirus_installed', value)} />
                    <Toggle id={fid('backup')} label="Backups" checked={form.security.backup_enabled} onChange={(value) => updateNested('security', 'backup_enabled', value)} />
                  </div>
                </div>
              )}

              {/* STEP 4: CREDENTIALS */}
              {step === 4 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-[13px]">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                    <div className="text-amber-900">Credentials are AES-256 encrypted at rest.</div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('ctype')} label="Protocol">
                      <Select
                        id={fid('ctype')}
                        value={form.credentials.credential_type}
                        onChange={(value) => updateNested('credentials', 'credential_type', value)}
                        options={[
                          { value: 'SSH', label: 'SSH' },
                          { value: 'RDP', label: 'RDP' },
                          { value: 'iLO', label: 'iLO / iDRAC' },
                          { value: 'Console', label: 'Console' },
                        ]}
                      />
                    </Field>
                    <Field id={fid('port')} label="Port">
                      <Input id={fid('port')} type="number" value={form.credentials.port} onChange={(value) => updateNested('credentials', 'port', value)} placeholder="22" />
                    </Field>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id={fid('user')} label="Username">
                      <Input id={fid('user')} value={form.credentials.username} onChange={(value) => updateNested('credentials', 'username', value)} placeholder="root" />
                    </Field>
                    
                    <Field id={fid('pass')} label="Password / Secret">
                      <div className="relative">
                        <input
                          id={fid('pass')}
                          type={showPass ? 'text' : 'password'}
                          value={form.credentials.password}
                          onChange={(e) => updateNested('credentials', 'password', e.target.value)}
                          placeholder="Enter secure password"
                          className={`${inputCls} pr-9`}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 focus:outline-none"
                        >
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>
                  </div>
                  
                  <Field id={fid('cnotes')} label="Access Instructions">
                    <Textarea id={fid('cnotes')} value={form.credentials.notes} onChange={(value) => updateNested('credentials', 'notes', value)} placeholder="VPN required..." />
                  </Field>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
                className="rounded-md px-4 py-1.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-0"
              >
                Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800 transition-all active:scale-95"
                >
                  Next Step
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-6 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {loading ? 'Saving...' : 'Save Server'}
                </button>
              )}
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}