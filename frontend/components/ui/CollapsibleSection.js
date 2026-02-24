'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Collapsible section for reducing visual clutter.
 * Default open for key sections, collapsed for detail-heavy areas.
 */
export default function CollapsibleSection({ title, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-surface-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium',
          'text-surface-900 bg-surface-50/80 hover:bg-surface-100 transition-colors'
        )}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
          {title}
          {badge != null && <span className="text-xs font-normal text-surface-500">({badge})</span>}
        </span>
      </button>
      {open && (
        <div className="px-4 py-3 bg-white border-t border-surface-200">
          {children}
        </div>
      )}
    </div>
  );
}
