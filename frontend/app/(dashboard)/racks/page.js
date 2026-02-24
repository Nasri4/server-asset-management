'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { Loader2, Plus, Eye, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

const emptyForm = { location_id: '', rack_code: '', rack_name: '', total_u: 42, power_circuit_a: '', power_circuit_b: '', description: '' };

export default function RacksPage() {
  const searchParams = useSearchParams();
  const [list, setList] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get('/racks'), api.get('/locations')])
      .then(([rR, rL]) => {
        setList(Array.isArray(rR.data) ? rR.data : []);
        setLocations(Array.isArray(rL.data) ? rL.data : []);
      })
      .catch((err) => { toast.error(err.response?.data?.error || 'Failed to load'); setList([]); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam && list.length > 0) {
      const id = parseInt(editParam, 10);
      const r = list.find((x) => x.rack_id === id);
      if (r) {
        setEditId(id);
        setEditForm({ location_id: r.location_id, rack_code: r.rack_code || '', rack_name: r.rack_name || '', total_u: r.total_u ?? 42, power_circuit_a: r.power_circuit_a || '', power_circuit_b: r.power_circuit_b || '', description: r.description || '' });
      }
    }
  }, [searchParams, list]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/racks', { ...createForm, location_id: parseInt(createForm.location_id) });
      toast.success('Rack created.');
      setShowCreate(false);
      setCreateForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create rack.');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(r) {
    setEditId(r.rack_id);
    setEditForm({
      location_id: r.location_id,
      rack_code: r.rack_code || '',
      rack_name: r.rack_name || '',
      total_u: r.total_u ?? 42,
      power_circuit_a: r.power_circuit_a || '',
      power_circuit_b: r.power_circuit_b || '',
      description: r.description || '',
    });
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      await api.put('/racks/' + editId, editForm);
      toast.success('Rack updated.');
      setEditId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update rack.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Racks</h1>
          <p className="page-subtitle">Rack inventory by location</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" /> Create Rack
        </button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create rack" description="Add a new rack to a location." size="wide">
        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section">
              <span className="dialog-section-title">Placement &amp; identity</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Location *</label><select required className="select-field" value={createForm.location_id} onChange={(e) => setCreateForm((f) => ({ ...f, location_id: e.target.value }))}><option value="">Select location</option>{locations.map((loc) => <option key={loc.location_id} value={loc.location_id}>{loc.site_name}{loc.city ? `, ${loc.city}` : ''}</option>)}</select></div>
                <div><label className="label">Rack code *</label><input required className="input-field font-mono" placeholder="e.g. RACK-01" value={createForm.rack_code} onChange={(e) => setCreateForm((f) => ({ ...f, rack_code: e.target.value }))} /></div>
                <div><label className="label">Rack name</label><input className="input-field" placeholder="Optional display name" value={createForm.rack_name} onChange={(e) => setCreateForm((f) => ({ ...f, rack_name: e.target.value }))} /></div>
                <div><label className="label">Total U</label><input type="number" min={1} className="input-field" value={createForm.total_u} onChange={(e) => setCreateForm((f) => ({ ...f, total_u: parseInt(e.target.value) || 42 }))} /></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Power</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Power circuit A</label><input className="input-field" placeholder="Circuit identifier" value={createForm.power_circuit_a} onChange={(e) => setCreateForm((f) => ({ ...f, power_circuit_a: e.target.value }))} /></div>
                <div><label className="label">Power circuit B</label><input className="input-field" placeholder="Circuit identifier" value={createForm.power_circuit_b} onChange={(e) => setCreateForm((f) => ({ ...f, power_circuit_b: e.target.value }))} /></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Description</span>
              <textarea className="input-field h-20 resize-none" placeholder="Optional notes" value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setShowCreate(false)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" disabled={creating} className="dialog-btn-primary">{creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create rack'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editId} onClose={() => setEditId(null)} title="Edit rack" description="Update rack details and power circuits." size="wide">
        <form onSubmit={handleEdit} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section">
              <span className="dialog-section-title">Identity</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Rack code *</label><input required className="input-field font-mono" value={editForm.rack_code} onChange={(e) => setEditForm((f) => ({ ...f, rack_code: e.target.value }))} /></div>
                <div><label className="label">Rack name</label><input className="input-field" placeholder="Optional display name" value={editForm.rack_name} onChange={(e) => setEditForm((f) => ({ ...f, rack_name: e.target.value }))} /></div>
                <div><label className="label">Total U</label><input type="number" min={1} className="input-field" value={editForm.total_u} onChange={(e) => setEditForm((f) => ({ ...f, total_u: parseInt(e.target.value) || 42 }))} /></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Power</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Power circuit A</label><input className="input-field" value={editForm.power_circuit_a} onChange={(e) => setEditForm((f) => ({ ...f, power_circuit_a: e.target.value }))} /></div>
                <div><label className="label">Power circuit B</label><input className="input-field" value={editForm.power_circuit_b} onChange={(e) => setEditForm((f) => ({ ...f, power_circuit_b: e.target.value }))} /></div>
              </div>
            </div>
            <div className="dialog-section">
              <span className="dialog-section-title">Description</span>
              <textarea className="input-field h-20 resize-none" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setEditId(null)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" disabled={saving} className="dialog-btn-primary">{saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}</button>
          </div>
        </form>
      </Modal>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <span className="text-sm text-[var(--text-muted)]">{list.length} rack{list.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Rack</th><th>Location</th><th>City</th><th>U slots</th><th>Servers</th><th className="text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!list.length ? (
                  <tr><td colSpan={6} className="text-center py-12"><div className="state-empty">No racks found. Create one to get started.</div></td></tr>
                ) : list.map((r) => (
                  <tr key={r.rack_id} className="hover:bg-[var(--background-soft)]">
                    <td><Link href={`/racks/${r.rack_id}`} className="font-mono font-medium text-[var(--primary)] hover:underline">{r.rack_code}</Link></td>
                    <td className="text-sm text-[var(--text-primary)]">{r.site_name || '—'}</td>
                    <td className="text-sm">{r.city || '—'}</td>
                    <td className="text-sm">{r.total_u ?? '—'}</td>
                    <td className="text-sm">{r.server_count ?? 0}</td>
                    <td className="text-right">
                      <RowActions items={[
                        { label: 'View Rack', icon: <Eye className="w-4 h-4" />, onClick: () => { window.location.href = `/racks/${r.rack_id}`; } },
                        { label: 'Edit Rack', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(r) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
