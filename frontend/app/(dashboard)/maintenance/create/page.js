'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';

const CHECKLIST_OPTIONS = [
  'OS Update', 'Security Patch', 'Backup Verification', 'Disk Cleanup',
  'Service Restart', 'Hardware Inspection', 'Network Check', 'Custom Tasks',
];

const RECURRENCE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Yearly', label: 'Yearly' },
];

export default function MaintenanceCreatePage() {
  const router = useRouter();
  const [servers, setServers] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    server_id: '',
    maintenance_type: 'Preventive',
    title: '',
    description: '',
    scheduled_date: '',
    scheduled_end: '',
    priority: 'Medium',
    assigned_engineer_id: '',
    notify_team: true,
    notify_engineer: true,
    recurrence_type: '',
    recurrence_interval: '',
    template_name: '',
    checklist_tasks: CHECKLIST_OPTIONS.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
  });

  useEffect(() => {
    loadDropdowns();
  }, []);

  async function loadDropdowns() {
    try {
      const [s, e] = await Promise.all([
        api.get('/servers', { params: { page_size: 200 } }),
        api.get('/engineers'),
      ]);
      setServers(Array.isArray(s.data?.servers) ? s.data.servers : []);
      setEngineers(Array.isArray(e.data) ? e.data : []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load form data');
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const checklistPayload = Object.entries(form.checklist_tasks)
        .map(([task, done]) => ({ task, done }))
        .filter((item) => item.done);

      await api.post('/maintenance', {
        server_id: parseInt(form.server_id, 10),
        maintenance_type: form.maintenance_type,
        title: form.title,
        description: form.description || null,
        scheduled_date: form.scheduled_date,
        scheduled_end: form.scheduled_end || null,
        priority: form.priority,
        assigned_engineer_id: form.assigned_engineer_id ? parseInt(form.assigned_engineer_id, 10) : null,
        notify_team: form.notify_team,
        notify_engineer: form.notify_engineer,
        recurrence_type: form.recurrence_type || null,
        recurrence_interval: form.recurrence_interval ? parseInt(form.recurrence_interval, 10) : null,
        template_name: form.template_name || null,
        checklist_tasks: checklistPayload,
      });

      toast.success('Maintenance schedule created');
      router.push('/maintenance/schedules');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create maintenance schedule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create / Edit Schedule</h1>
          <p className="page-subtitle">Define maintenance schedule, recurrence, and assignment.</p>
        </div>
      </div>

      <form onSubmit={submit} className="card p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Server *</label>
            <select required className="select-field" value={form.server_id} onChange={(e) => setForm((f) => ({ ...f, server_id: e.target.value }))}>
              <option value="">Select server</option>
              {servers.map((server) => <option key={server.server_id} value={server.server_id}>{server.server_code}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Title *</label>
            <input required className="input-field" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="select-field" value={form.maintenance_type} onChange={(e) => setForm((f) => ({ ...f, maintenance_type: e.target.value }))}>
              <option>Preventive</option>
              <option>Corrective</option>
              <option>Emergency</option>
              <option>Firmware Update</option>
              <option>Hardware Replacement</option>
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="select-field" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
          <div>
            <label className="label">Assigned engineer</label>
            <select className="select-field" value={form.assigned_engineer_id} onChange={(e) => setForm((f) => ({ ...f, assigned_engineer_id: e.target.value }))}>
              <option value="">Select engineer</option>
              {engineers.map((engineer) => <option key={engineer.engineer_id} value={engineer.engineer_id}>{engineer.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Template name</label>
            <input className="input-field" value={form.template_name} onChange={(e) => setForm((f) => ({ ...f, template_name: e.target.value }))} placeholder="Optional template" />
          </div>
          <div>
            <label className="label">Recurrence</label>
            <select className="select-field" value={form.recurrence_type} onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value }))}>
              {RECURRENCE_OPTIONS.map((opt) => <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Recurrence interval (days)</label>
            <input className="input-field" type="number" min="1" value={form.recurrence_interval} onChange={(e) => setForm((f) => ({ ...f, recurrence_interval: e.target.value }))} />
          </div>
          <div>
            <label className="label">Scheduled date *</label>
            <input required type="datetime-local" className="input-field" value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Scheduled end</label>
            <input type="datetime-local" className="input-field" value={form.scheduled_end} onChange={(e) => setForm((f) => ({ ...f, scheduled_end: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input-field h-24 resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>

        <div>
          <label className="label">Checklist</label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {CHECKLIST_OPTIONS.map((task) => (
              <label key={task} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.checklist_tasks[task] || false}
                  onChange={(e) => setForm((f) => ({ ...f, checklist_tasks: { ...f.checklist_tasks, [task]: e.target.checked } }))}
                />
                {task}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.notify_team} onChange={(e) => setForm((f) => ({ ...f, notify_team: e.target.checked }))} />
            SMS team
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.notify_engineer} onChange={(e) => setForm((f) => ({ ...f, notify_engineer: e.target.checked }))} />
            SMS engineer
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => router.push('/maintenance/schedules')}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Schedule'}</button>
        </div>
      </form>
    </div>
  );
}
