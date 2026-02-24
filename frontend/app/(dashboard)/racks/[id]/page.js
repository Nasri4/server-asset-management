'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';
import { HardDrive, Loader2, ArrowLeft, Printer, Server, Zap, ZapOff, Pencil } from 'lucide-react';

export default function RackViewPage() {
  const { id } = useParams();
  const [rack, setRack] = useState(null);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/racks/${id}/view`)
      .then(r => {
        setRack(r.data?.rack ?? null);
        setServers(r.data?.servers ?? []);
      })
      .catch(err => {
        toast.error(err.response?.data?.error || 'Failed to load rack');
        setRack(null);
        setServers([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>;
  if (!rack) return <div className="text-[var(--text-secondary)]">Rack not found.</div>;

  const totalU = rack.total_u || 42;
  const uSlots = Array.from({ length: totalU }, (_, i) => totalU - i);

  function getServerAtU(u) {
    return servers.find(s => s.u_position_start <= u && s.u_position_end >= u);
  }

  function getServerColor(status) {
    if (status === 'Active') return 'bg-[var(--primary-soft)] border-[var(--primary)]/40 text-[var(--primary)]';
    if (status === 'Under Maintenance') return 'bg-[var(--warning)]/15 border-[var(--warning)]/50 text-[var(--warning)]';
    if (status === 'Inactive') return 'bg-[var(--background-soft)] border-[var(--border-soft)] text-[var(--text-secondary)]';
    return 'bg-[var(--danger)]/15 border-[var(--danger)]/40 text-[var(--danger)]';
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Link href="/racks" className="btn-ghost"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="page-title font-mono">{rack.rack_code} — Rack View</h1>
            <p className="page-subtitle">{rack.rack_name} &bull; {rack.site_name}, {rack.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href={`/racks?edit=${rack.rack_id}`} className="btn-secondary">
            <Pencil className="w-4 h-4" /> Edit Rack
          </Link>
          <button onClick={handlePrint} className="btn-secondary">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Rack info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{totalU}U</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Capacity</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--primary)]">{servers.length}</div>
          <div className="text-xs text-[var(--text-secondary)]">Servers Installed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-xs text-[var(--text-muted)] mb-1">Power A</div>
          <div className="text-sm font-mono text-[var(--text-primary)]">{rack.power_circuit_a || '—'}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-xs text-[var(--text-muted)] mb-1">Power B</div>
          <div className="text-sm font-mono text-[var(--text-primary)]">{rack.power_circuit_b || '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rack visual grid */}
        <div className="lg:col-span-2 card overflow-x-auto">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Rack Layout</h3>
            <div className="border border-[var(--border-soft)] rounded-lg overflow-hidden">
            {uSlots.map(u => {
              const server = getServerAtU(u);
              const isStart = server && server.u_position_start === u;
              const isMiddle = server && server.u_position_start !== u && server.u_position_end !== u;

              if (server && !isStart) return null;

              const uSpan = server ? (server.u_position_end - server.u_position_start + 1) : 1;

              return (
                <div key={u} className="flex border-b border-[var(--border-soft)] last:border-b-0"
                     style={server ? { height: `${uSpan * 40}px` } : { height: '40px' }}>
                  {/* U number */}
                  <div className="w-12 flex-shrink-0 flex items-center justify-center text-xs font-mono text-[var(--text-muted)] border-r border-[var(--border-soft)] bg-[var(--background-soft)]">
                    U{u}
                  </div>
                  {/* Slot content */}
                  {server ? (
                    <Link href={`/servers/${server.server_id}`}
                          className={`flex-1 flex items-center gap-3 px-4 border ${getServerColor(server.status)} hover:opacity-90 transition-opacity cursor-pointer`}>
                      <Server className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono font-medium truncate">{server.server_code}</div>
                        <div className="text-xs opacity-70 truncate">{server.hostname} &bull; {server.vendor} {server.model}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {server.power_type === 'Double' ? (
                          <Zap className="w-3.5 h-3.5 text-[var(--warning)]" title="Dual Power" />
                        ) : (
                          <ZapOff className="w-3.5 h-3.5 text-[var(--text-muted)]" title="Single Power" />
                        )}
                        <span className="text-[10px] font-mono opacity-60">{server.serial_number}</span>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex-1 flex items-center px-4 text-xs text-[var(--text-secondary)]">
                      Empty
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Server list panel */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Installed Servers</h3>
          {servers.length > 0 ? (
            <div className="space-y-3">
              {servers.map(s => (
                <Link key={s.server_id} href={`/servers/${s.server_id}`}
                      className="block p-3 bg-[var(--background-soft)] rounded-lg hover:bg-[var(--border-soft)]/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono font-medium text-[var(--primary)]">{s.server_code}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">U{s.u_position_start}–U{s.u_position_end}</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">{s.hostname}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-[var(--text-muted)]">{s.serial_number}</span>
                    <span className="text-[10px] flex items-center gap-1">
                      {s.power_type === 'Double' ? (
                        <><Zap className="w-3 h-3 text-[var(--warning)]" /> Dual</>
                      ) : (
                        <><ZapOff className="w-3 h-3 text-[var(--text-muted)]" /> Single</>
                      )}
                    </span>
                  </div>
                  {s.notes && <div className="text-[10px] text-[var(--text-muted)] mt-1 italic">{s.notes}</div>}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm">No servers installed in this rack.</p>
          )}
        </div>
      </div>
    </div>
  );
}
