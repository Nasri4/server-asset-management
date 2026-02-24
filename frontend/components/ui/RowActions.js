'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

/**
 * RowActions – 3-dot dropdown for table rows.
 * Uses React portal + position:fixed to escape overflow-clipping parent containers.
 * items: Array of { label, icon?, onClick, danger?, disabled? } | { type: 'divider' }
 */
export default function RowActions({ items = [], label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuW = 184;
    // Place left-aligned to right edge of button, but stay in viewport
    const left = Math.max(8, Math.min(r.right - menuW, window.innerWidth - menuW - 8));
    const top = r.bottom + 6;
    setPos({ top, left });
  }, []);

  // Close + reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (!open) calcPos();
    setOpen((o) => !o);
  };

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}
      className="row-actions-menu"
    >
      {items.map((item, i) =>
        !item || item.type === 'divider' ? (
          <div key={i} className="row-actions-divider" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              item.onClick?.();
            }}
            className={`row-action-item${item.danger ? ' row-action-item-danger' : ''}`}
          >
            {item.icon && (
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-75">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 ${
          open
            ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
            : 'text-[var(--text-muted)] hover:bg-[var(--section-bg)] hover:text-[var(--text-primary)]'
        }`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && mounted && createPortal(menu, document.body)}
    </div>
  );
}
