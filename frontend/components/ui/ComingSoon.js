'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

/**
 * ComingSoon — Premium placeholder for modules under development.
 *
 * Props:
 *   icon       – Lucide icon component for the module
 *   title      – Module name (e.g. "Workstations & PCs")
 *   subtitle   – Description text
 *   accentColor – CSS color for the icon ring (default: var(--primary))
 */
export default function ComingSoon({
  icon: Icon,
  title = 'New Module',
  subtitle = 'This module is currently under development.',
  accentColor,
}) {
  const accent = accentColor || 'var(--primary)';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">

        {/* ── Decorative icon ring ── */}
        <div className="relative mx-auto mb-8 w-28 h-28">
          {/* Outer animated ring */}
          <div
            className="absolute inset-0 rounded-3xl opacity-20 animate-pulse"
            style={{ border: `2px dashed ${accent}` }}
          />
          {/* Inner solid circle */}
          <div
            className="absolute inset-2 rounded-2xl flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${accent} 8%, transparent)` }}
          >
            {Icon && <Icon className="w-12 h-12" style={{ color: accent, strokeWidth: 1.4 }} />}
          </div>
          {/* Sparkle badge */}
          <div
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
            style={{ background: accent }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* ── Title ── */}
        <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>

        {/* ── Badge ── */}
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] px-3 py-1 rounded-full mb-4"
          style={{
            background: `color-mix(in srgb, ${accent} 10%, transparent)`,
            color: accent,
            border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
          Coming Soon
        </span>

        {/* ── Subtitle ── */}
        <p className="text-sm leading-relaxed max-w-md mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>

        {/* ── Decorative feature pills ── */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {['Asset Tracking', 'Analytics', 'Automation', 'Alerts'].map((f) => (
            <span
              key={f}
              className="text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{
                background: 'var(--section-bg)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* ── CTA ── */}
        <Link
          href="/dashboard"
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
