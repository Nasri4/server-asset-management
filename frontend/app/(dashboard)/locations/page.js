'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { 
  Loader2, Plus, Eye, Pencil, X, Trash2, AlertCircle,
  Building2, Server, Zap, ThermometerSun, Phone,
  Mail, User, Globe, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import RowActions from '../../../components/ui/RowActions';
import Modal from '../../../components/ui/Modal';

// Default values for new location
const emptyForm = { 
  site_name: '', 
  city: 'Mogadishu', 
  country: 'Somalia', 
  site_type: '', 
  address: '', 
  power_source: '', 
  cooling_type: '', 
  contact_name: '', 
  contact_phone: '+252',
  contact_email: '',
  emergency_contact: '',
  emergency_phone: '+252',
  notes: ''
};

export default function LocationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingName, setDeletingName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [searchSubmit, setSearchSubmit] = useState('');

  // Dropdown options
  const siteTypeOptions = [
    { value: '', label: 'Select Site Type' },
    { value: 'Data Center', label: 'Data Center' },
    { value: 'Colocation', label: 'Colocation' },
    { value: 'Office', label: 'Office' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'Telecom Site', label: 'Telecom Site' },
    { value: 'Remote Site', label: 'Remote Site' },
    { value: 'Cloud', label: 'Cloud' },
  ];

  const powerSourceOptions = [
    { value: '', label: 'Select Power Source' },
    { value: 'Grid', label: 'Grid' },
    { value: 'Generator', label: 'Generator' },
    { value: 'Solar', label: 'Solar' },
    { value: 'Hybrid', label: 'Hybrid' },
    { value: 'Battery', label: 'Battery' },
    { value: 'UPS', label: 'UPS' },
    { value: 'Dual Supply', label: 'Dual Supply' },
  ];

  const coolingTypeOptions = [
    { value: '', label: 'Select Cooling Type' },
    { value: 'Air Conditioned', label: 'Air Conditioned' },
    { value: 'Fan Only', label: 'Fan Only' },
    { value: 'Liquid Cooling', label: 'Liquid Cooling' },
    { value: 'Free Cooling', label: 'Free Cooling' },
    { value: 'CRAC', label: 'CRAC' },
    { value: 'None', label: 'None' },
  ];

  // Handle contact phone change with +252 prefix protection
  const handleContactPhoneChange = (e, setForm) => {
    let value = e.target.value;
    const prefix = '+252';
    
    if (value.length < prefix.length) {
      setForm(prev => ({ ...prev, contact_phone: prefix }));
      return;
    }
    
    if (!value.startsWith(prefix)) {
      const numberPart = value.replace(/^\+?2?5?2?/, '');
      value = prefix + numberPart;
    }
    
    const afterPrefix = value.slice(prefix.length);
    const cleanAfterPrefix = afterPrefix.replace(/\+/g, '');
    value = prefix + cleanAfterPrefix;
    
    setForm(prev => ({ ...prev, contact_phone: value }));
  };

  const handleContactPhoneKeyDown = (e, currentValue) => {
    const prefix = '+252';
    const cursorPosition = e.target.selectionStart;
    
    if ((e.key === 'Backspace' || e.key === 'Delete') && cursorPosition <= prefix.length) {
      e.preventDefault();
    }
    
    if (e.key === 'ArrowLeft' && cursorPosition <= prefix.length) {
      e.preventDefault();
    }
  };

  function load() {
    setLoading(true);
    api.get('/locations')
      .then((r) => {
        const raw = Array.isArray(r.data) ? r.data : [];
        if (!searchSubmit.trim()) {
          setList(raw);
        } else {
          const q = searchSubmit.toLowerCase().trim();
          setList(raw.filter((l) =>
            (l.site_name && l.site_name.toLowerCase().includes(q)) ||
            (l.city && l.city.toLowerCase().includes(q)) ||
            (l.site_type && l.site_type.toLowerCase().includes(q))
          ));
        }
      })
      .catch((err) => { 
        toast.error(err.response?.data?.error || 'Failed to load locations'); 
        setList([]); 
      })
      .finally(() => setLoading(false));
  }
  
  useEffect(() => { load(); }, [searchSubmit]);
  
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam && list.length > 0) {
      const id = parseInt(editParam, 10);
      const loc = list.find((l) => l.location_id === id);
      if (loc) {
        setEditId(id);
        setEditForm({ 
          site_name: loc.site_name || '', 
          city: loc.city || 'Mogadishu', 
          country: loc.country || 'Somalia', 
          site_type: loc.site_type || '', 
          address: loc.address || '', 
          power_source: loc.power_source || '', 
          cooling_type: loc.cooling_type || '', 
          contact_name: loc.contact_name || '', 
          contact_phone: loc.contact_phone ? (loc.contact_phone.startsWith('+252') ? loc.contact_phone : '+252' + loc.contact_phone) : '+252',
          contact_email: loc.contact_email || '',
          emergency_contact: loc.emergency_contact || '',
          emergency_phone: loc.emergency_phone ? (loc.emergency_phone.startsWith('+252') ? loc.emergency_phone : '+252' + loc.emergency_phone) : '+252',
          notes: loc.notes || ''
        });
      }
    }
  }, [searchParams, list]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/locations', createForm);
      toast.success('Location created successfully');
      setShowCreate(false);
      setCreateForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create location');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(loc) {
    setEditId(loc.location_id);
    setEditForm({ 
      site_name: loc.site_name || '', 
      city: loc.city || 'Mogadishu', 
      country: loc.country || 'Somalia', 
      site_type: loc.site_type || '', 
      address: loc.address || '', 
      power_source: loc.power_source || '', 
      cooling_type: loc.cooling_type || '', 
      contact_name: loc.contact_name || '', 
      contact_phone: loc.contact_phone ? (loc.contact_phone.startsWith('+252') ? loc.contact_phone : '+252' + loc.contact_phone) : '+252',
      contact_email: loc.contact_email || '',
      emergency_contact: loc.emergency_contact || '',
      emergency_phone: loc.emergency_phone ? (loc.emergency_phone.startsWith('+252') ? loc.emergency_phone : '+252' + loc.emergency_phone) : '+252',
      notes: loc.notes || ''
    });
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      await api.put('/locations/' + editId, editForm);
      toast.success('Location updated successfully');
      setEditId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update location');
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal(loc) {
    setDeletingId(loc.location_id);
    setDeletingName(loc.site_name);
    setShowDelete(true);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await api.delete('/locations/' + deletingId);
      toast.success('Location deleted successfully');
      setShowDelete(false);
      setDeletingId(null);
      setDeletingName('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete location');
    } finally {
      setDeleting(false);
    }
  }

  function viewLocationDetails(id) {
    router.push(`/locations/${id}`);
  }

  // Calculate stats
  const totalLocations = list.length;
  const totalRacks = list.reduce((acc, loc) => acc + (loc.rack_count || 0), 0);
  const totalServers = list.reduce((acc, loc) => acc + (loc.server_count || 0), 0);
  const dataCenters = list.filter(loc => loc.site_type === 'Data Center').length;

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="page-subtitle">Manage sites, data centers, and facilities</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" /> New Location
        </button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Location" description="Add a site, data center, or facility." size="wide">
        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section"><span className="dialog-section-title">Basic information</span><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Site Name *</label><input required className="input-field" placeholder="Mogadishu Data Center" value={createForm.site_name} onChange={(e) => setCreateForm((f) => ({ ...f, site_name: e.target.value }))} /></div><div><label className="label">Site Type</label><select className="select-field" value={createForm.site_type} onChange={(e) => setCreateForm((f) => ({ ...f, site_type: e.target.value }))}>{siteTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div><div><label className="label">City</label><input className="input-field" placeholder="Mogadishu" value={createForm.city} onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))} /></div><div><label className="label">Country</label><input className="input-field" placeholder="Somalia" value={createForm.country} onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))} /></div><div className="md:col-span-2"><label className="label">Address</label><input className="input-field" placeholder="Street address" value={createForm.address} onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))} /></div></div></div>
            <div className="dialog-section"><span className="dialog-section-title">Infrastructure</span><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Power Source</label><select className="select-field" value={createForm.power_source} onChange={(e) => setCreateForm((f) => ({ ...f, power_source: e.target.value }))}>{powerSourceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div><div><label className="label">Cooling Type</label><select className="select-field" value={createForm.cooling_type} onChange={(e) => setCreateForm((f) => ({ ...f, cooling_type: e.target.value }))}>{coolingTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div></div></div>
            <div className="dialog-section"><span className="dialog-section-title">Contact information</span><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Contact Name</label><input className="input-field" placeholder="Site manager" value={createForm.contact_name} onChange={(e) => setCreateForm((f) => ({ ...f, contact_name: e.target.value }))} /></div><div><label className="label">Contact Phone</label><input className="input-field" value={createForm.contact_phone} onChange={(e) => handleContactPhoneChange(e, setCreateForm)} onKeyDown={(e) => handleContactPhoneKeyDown(e, createForm.contact_phone)} placeholder="+252 61 234 5678" /></div><div className="md:col-span-2"><label className="label">Contact Email</label><input type="email" className="input-field" placeholder="manager@example.com" value={createForm.contact_email} onChange={(e) => setCreateForm((f) => ({ ...f, contact_email: e.target.value }))} /></div></div></div>
            <div className="dialog-section"><span className="dialog-section-title">Emergency contact</span><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Name</label><input className="input-field" placeholder="24/7 contact" value={createForm.emergency_contact} onChange={(e) => setCreateForm((f) => ({ ...f, emergency_contact: e.target.value }))} /></div><div><label className="label">Phone</label><input className="input-field" value={createForm.emergency_phone} onChange={(e) => handleContactPhoneChange(e, setCreateForm)} onKeyDown={(e) => handleContactPhoneKeyDown(e, createForm.emergency_phone)} placeholder="+252" /></div></div></div>
            <div className="dialog-section"><span className="dialog-section-title">Notes</span><textarea rows={3} className="input-field resize-none" placeholder="Additional information..." value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setShowCreate(false)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" disabled={creating} className="dialog-btn-primary">{creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Location'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editId} onClose={() => setEditId(null)} title="Edit Location" description="Update site details and contacts." size="wide">
        <form onSubmit={handleEdit} className="flex flex-col flex-1 min-h-0">
          <div className="dialog-body">
            <div className="dialog-section"><span className="dialog-section-title">Basic information</span><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Site Name *</label><input required className="input-field" value={editForm.site_name} onChange={(e) => setEditForm((f) => ({ ...f, site_name: e.target.value }))} /></div><div><label className="label">Site Type</label><select className="select-field" value={editForm.site_type} onChange={(e) => setEditForm((f) => ({ ...f, site_type: e.target.value }))}>{siteTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div><div><label className="label">City</label><input className="input-field" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} /></div><div><label className="label">Country</label><input className="input-field" value={editForm.country} onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))} /></div><div className="md:col-span-2"><label className="label">Address</label><input className="input-field" value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} /></div></div></div>
            <div className="dialog-section"><span className="dialog-section-title">Infrastructure</span><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Power Source</label><select className="select-field" value={editForm.power_source} onChange={(e) => setEditForm((f) => ({ ...f, power_source: e.target.value }))}>{powerSourceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div><div><label className="label">Cooling Type</label><select className="select-field" value={editForm.cooling_type} onChange={(e) => setEditForm((f) => ({ ...f, cooling_type: e.target.value }))}>{coolingTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div></div></div>
            <div className="dialog-section"><span className="dialog-section-title">Contact information</span><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Contact Name</label><input className="input-field" value={editForm.contact_name} onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))} /></div><div><label className="label">Contact Phone</label><input className="input-field" value={editForm.contact_phone} onChange={(e) => handleContactPhoneChange(e, setEditForm)} onKeyDown={(e) => handleContactPhoneKeyDown(e, editForm.contact_phone)} /></div><div className="md:col-span-2"><label className="label">Contact Email</label><input type="email" className="input-field" value={editForm.contact_email} onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))} /></div></div></div>
            <div className="dialog-section"><span className="dialog-section-title">Emergency contact</span><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Name</label><input className="input-field" value={editForm.emergency_contact} onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact: e.target.value }))} /></div><div><label className="label">Phone</label><input className="input-field" value={editForm.emergency_phone} onChange={(e) => handleContactPhoneChange(e, setEditForm)} onKeyDown={(e) => handleContactPhoneKeyDown(e, editForm.emergency_phone)} /></div></div></div>
            <div className="dialog-section"><span className="dialog-section-title">Notes</span><textarea rows={3} className="input-field resize-none" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="dialog-footer">
            <button type="button" onClick={() => setEditId(null)} className="dialog-btn-cancel">Cancel</button>
            <button type="submit" disabled={saving} className="dialog-btn-primary">{saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete location" description="This action cannot be undone." danger>
        <div className="dialog-body">
          <p className="text-sm text-[var(--text-secondary)]">Are you sure you want to delete <span className="font-semibold text-[var(--text-primary)]">{deletingName}</span>? All racks and servers in this location will be affected.</p>
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={() => setShowDelete(false)} className="dialog-btn-cancel">Cancel</button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="dialog-btn-danger">{deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Delete location'}</button>
        </div>
      </Modal>

      {/* Locations Table */}
      <div className="table-wrapper">
        <div className="table-toolbar">
          <form onSubmit={(e) => { e.preventDefault(); setSearchSubmit(search); }} className="flex gap-2 flex-1 max-w-sm">
            <input type="text" placeholder="Search by site, city, type..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field flex-1 py-2 text-sm" />
            <button type="submit" className="btn-secondary">Search</button>
          </form>
          <span className="text-sm text-[var(--text-muted)]">{list.length} location{list.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr>
                  <th>Location</th><th>City/Country</th><th>Type</th><th>Power/Cooling</th><th>Racks</th><th>Servers</th><th className="text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!list.length ? (
                  <tr><td colSpan={7} className="text-center py-12"><div className="state-empty">No locations found. Create your first location to get started.</div></td></tr>
                ) : list.map((loc) => (
                  <tr key={loc.location_id}>
                    <td>
                      <button type="button" onClick={() => viewLocationDetails(loc.location_id)} className="text-sm font-medium text-[var(--primary)] hover:underline text-left">{loc.site_name}</button>
                      {loc.address && <p className="text-xs text-[var(--text-muted)]">{loc.address}</p>}
                    </td>
                    <td><div className="text-sm text-[var(--text-primary)]">{loc.city || 'Mogadishu'}</div><div className="text-xs text-[var(--text-muted)]">{loc.country || 'Somalia'}</div></td>
                    <td><span className="badge-blue">{loc.site_type || '—'}</span></td>
                    <td className="text-sm text-[var(--text-secondary)]">{loc.power_source || '—'} / {loc.cooling_type || '—'}</td>
                    <td className="text-sm">{loc.rack_count ?? 0}</td>
                    <td className="text-sm">{loc.server_count ?? 0}</td>
                    <td className="text-right">
                      <RowActions items={[
                        { label: 'View Details', icon: <Eye className="w-4 h-4" />, onClick: () => viewLocationDetails(loc.location_id) },
                        { label: 'Edit Location', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(loc) },
                        { type: 'divider' },
                        { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => openDeleteModal(loc) },
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