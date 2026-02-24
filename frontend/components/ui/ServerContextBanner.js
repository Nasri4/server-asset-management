'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '../../lib/api';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';

function ServerContextBannerInner() {
  const searchParams = useSearchParams();
  const serverId = searchParams.get('server_id');
  const [server, setServer] = useState(null);

  useEffect(() => {
    if (!serverId) return;
    api.get('/servers/' + serverId)
      .then((r) => setServer(r.data?.server || null))
      .catch(() => setServer(null));
  }, [serverId]);

  if (!serverId || !server) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 text-sm flex-wrap">
      <Link
        href={`/servers/${serverId}`}
        className="flex items-center gap-1.5 text-[var(--primary)] font-medium hover:underline flex-shrink-0"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Server
      </Link>
      <span className="text-[var(--text-muted)]">|</span>
      <span className="text-[var(--text-secondary)]">
        Server context:{' '}
        <span className="font-mono font-semibold text-[var(--text-primary)]">{server.server_code}</span>
        {server.hostname && (
          <span className="text-[var(--text-muted)]"> ({server.hostname})</span>
        )}
        {server.status && (
          <span className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded-md ${
            server.status === 'Active' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--section-bg)] text-[var(--text-muted)]'
          }`}>{server.status}</span>
        )}
      </span>
      <Link
        href={`/servers/${serverId}`}
        className="ml-auto flex items-center gap-1 text-[var(--primary)] hover:underline flex-shrink-0 text-xs font-medium"
      >
        <ExternalLink className="w-3.5 h-3.5" /> View Details
      </Link>
    </div>
  );
}

export default function ServerContextBanner() {
  return (
    <Suspense fallback={null}>
      <ServerContextBannerInner />
    </Suspense>
  );
}
