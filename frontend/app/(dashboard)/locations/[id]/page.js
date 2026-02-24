'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';
import { MapPin, Loader2, ArrowLeft, HardDrive, Server, Zap, Wind, Pencil, Building2, Phone, User, Grid, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LocationDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/locations/${id}`)
      .then(r => setData(r.data))
      .catch(err => {
        toast.error(err.response?.data?.error || 'Failed to load location');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  if (!data?.location) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-3" />
        <p className="text-[var(--text-secondary)]">Location not found</p>
        <Link href="/locations" className="text-[var(--primary)] text-sm mt-2 inline-block">
          ← Back to Locations
        </Link>
      </div>
    );
  }

  const loc = data.location;
  const racks = data.racks ?? [];

  // Stats data for clean display
  const stats = [
    {
      label: 'Total Racks',
      value: racks.length,
      icon: HardDrive,
      color: 'text-[var(--primary)]',
      bg: 'bg-[var(--primary-soft)]'
    },
    {
      label: 'Total Servers',
      value: loc.server_count ?? 0,
      icon: Server,
      color: 'text-[var(--success)]',
      bg: 'bg-[var(--success-soft)]'
    },
    ...(loc.power_source ? [{
      label: 'Power Source',
      value: loc.power_source,
      icon: Zap,
      color: 'text-[var(--warning)]',
      bg: 'bg-[var(--warning-soft)]'
    }] : []),
    ...(loc.cooling_type ? [{
      label: 'Cooling Type',
      value: loc.cooling_type,
      icon: Wind,
      color: 'text-[var(--info)]',
      bg: 'bg-[var(--info-soft)]'
    }] : [])
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/locations" className="btn-ghost flex-shrink-0 p-2 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="min-w-0">
            <h1 className="page-title">{loc.site_name}</h1>
            <p className="page-subtitle">{loc.city || 'Mogadishu'}, {loc.country || 'Somalia'}</p>
          </div>
        </div>
        <Link href={`/locations?edit=${loc.location_id}`} className="btn-primary flex-shrink-0"><Pencil className="w-4 h-4" /> Edit</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loc.address && (
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[var(--primary)] flex-shrink-0" />
              <div>
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">ADDRESS</p>
                <p className="text-sm text-[var(--text-primary)]">{loc.address}</p>
              </div>
            </div>
          </div>
        )}

        {loc.contact_phone && (
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-[var(--primary)] flex-shrink-0" />
              <div>
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">CONTACT</p>
                <p className="text-sm text-[var(--text-primary)]">{loc.contact_name || 'Contact Person'}</p>
                <p className="text-sm text-[var(--text-secondary)]">{loc.contact_phone}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards - Clean Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{stat.label}</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Racks Section - Simple List/Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Racks</h2>
          <span className="text-sm bg-[var(--primary-soft)] text-[var(--primary)] px-3 py-1 rounded-full">
            {racks.length} total
          </span>
        </div>

        {racks.length === 0 ? (
          <div className="card p-8 text-center state-empty">
            <HardDrive className="w-8 h-8 text-[var(--text-muted)] mb-2" />
            <p>No racks in this location</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {racks.map((rack) => (
              <Link key={rack.rack_id} href={`/racks/${rack.rack_id}`} className="card p-4 hover:shadow-md transition-shadow block border border-[var(--border)] hover:border-[var(--primary)]/30">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[var(--primary)]" />
                    <span className="font-mono font-medium text-[var(--text-primary)]">{rack.rack_code}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-[var(--background-soft)] px-2 py-1 rounded">
                    <Server className="w-3 h-3 text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">{rack.server_count ?? 0}</span>
                  </div>
                </div>
                
                {rack.rack_name && (
                  <p className="text-xs text-[var(--text-secondary)] ml-6 mb-2">{rack.rack_name}</p>
                )}
                
                <div className="ml-6 text-xs">
                  <span className="text-[var(--text-secondary)]">Capacity: </span>
                  <span className="text-[var(--text-primary)] font-medium">{rack.total_u ?? 42}U</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}