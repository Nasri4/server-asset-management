'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { formatDateTime, getStatusColor } from '../../../../lib/utils';

function toInputDate(value) {
  return value.toISOString().slice(0, 10);
}

export default function MaintenanceCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [start, setStart] = useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return toInputDate(first);
  });
  const [end, setEnd] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return toInputDate(last);
  });

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    setLoading(true);
    try {
      const res = await api.get('/maintenance/calendar', {
        params: {
          start: `${start}T00:00:00`,
          end: `${end}T23:59:59`,
        },
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map = {};
    for (const item of items) {
      const key = new Date(item.scheduled_date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Maintenance schedule by date range.</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Start</label>
          <input type="date" className="input-field" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">End</label>
          <input type="date" className="input-field" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <button type="button" className="btn-primary" onClick={loadCalendar}>Apply</button>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" /></div>
        ) : grouped.length === 0 ? (
          <div className="py-12 text-center"><span className="state-empty inline-flex">No maintenance in selected range</span></div>
        ) : (
          <div className="space-y-3 p-4">
            {grouped.map(([date, dateItems]) => (
              <div key={date} className="card p-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{date}</h3>
                <div className="space-y-2">
                  {dateItems.map((item) => (
                    <div key={item.maintenance_id} className="flex flex-wrap items-center justify-between gap-2 border border-[var(--border-soft)] rounded-lg p-2">
                      <div>
                        <Link href={`/maintenance/${item.maintenance_id}`} className="text-sm font-medium text-[var(--text-primary)] hover:underline">{item.title}</Link>
                        <p className="text-xs text-[var(--text-secondary)]">{item.server_code} • {formatDateTime(item.scheduled_date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={getStatusColor(item.priority)}>{item.priority}</span>
                        <span className={getStatusColor(item.status)}>{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
