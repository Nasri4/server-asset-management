'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function getFocusable(container) {
  if (!container) return [];
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return Array.from(container.querySelectorAll(selectors))
    .filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

/**
 * Modal — portal dialog (enterprise stable)
 * Fixes focus/tab issues and avoids forcing extra mouse clicks.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'default',
  danger = false,
  hideClose = false,
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);
  const lastActiveElRef = useRef(null);

  useEffect(() => setMounted(true), []);

  // Scroll lock (body only) - avoids breaking nested scroll containers
  useEffect(() => {
    if (!open) return;

    lastActiveElRef.current = document.activeElement;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // Prevent layout shift when scrollbar disappears
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;

      // Restore focus back to where user was
      const el = lastActiveElRef.current;
      if (el && typeof el.focus === 'function') {
        requestAnimationFrame(() => el.focus({ preventScroll: true }));
      }
    };
  }, [open]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus: move to first focusable input (NOT the panel)
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusable(panel);
      const first = focusables.find((el) => el.getAttribute('data-autofocus') === 'true') || focusables[0];

      if (first) first.focus({ preventScroll: true });
      else panel.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Focus trap (Tab stays inside modal)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusable(panel);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!mounted || !open) return null;

  const panelClass = [
    'dialog-panel',
    size === 'wide' ? 'dialog-panel-wide' : size === 'sm' ? 'dialog-panel-sm' : '',
    danger ? 'dialog-panel-danger' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      className="dialog-overlay"
      role="presentation"
      onMouseDown={(e) => {
        // Close only if clicking backdrop (not inside panel)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        style={{ outline: 'none' }}
      >
        <div className="dialog-header">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="dialog-title">
              {title}
            </h2>
            {description && <p className="dialog-description">{description}</p>}
          </div>

          {!hideClose && (
            <button type="button" onClick={onClose} className="dialog-close flex-shrink-0" aria-label="Close dialog">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}