'use client';

import { useCallback, useMemo } from 'react';

const PREFIX_CLEAN = '+252';

/**
 * Phone input for Somalia format. Shows "(+252 )" as fixed hint; stores full number e.g. +252612666888.
 * Placeholder is "(+252 )"; user types digits after the prefix.
 */
export default function PhoneInput({ value = '', onChange, onBlur, className = '', id, ...rest }) {
  const displayValue = useMemo(() => {
    if (!value) return '';
    const s = String(value).trim();
    if (s.startsWith(PREFIX_CLEAN)) {
      const after = s.slice(PREFIX_CLEAN.length).replace(/\D/g, '');
      return after;
    }
    return s.replace(/\D/g, '');
  }, [value]);

  const handleChange = useCallback(
    (e) => {
      const raw = e.target.value;
      const digits = raw.replace(/\D/g, '');
      const next = digits ? PREFIX_CLEAN + digits : '';
      onChange(next);
    },
    [onChange]
  );

  const handleBlur = useCallback(
    (e) => {
      const digits = displayValue.replace(/\D/g, '');
      if (digits && !String(value).trim().startsWith(PREFIX_CLEAN)) {
        onChange(PREFIX_CLEAN + digits);
      }
      onBlur?.(e);
    },
    [displayValue, value, onChange, onBlur]
  );

  return (
    <div className={`flex items-stretch rounded-xl border border-[var(--border-soft)] bg-[var(--background-card)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-[var(--primary)] ${className}`}>
      <span className="flex items-center px-4 py-2.5 text-sm text-[var(--text-secondary)] bg-[var(--background-soft)] border-r border-[var(--border-soft)] whitespace-nowrap">
        (+252 )
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder=" "
        className="input-field border-0 rounded-none focus:ring-0 focus:shadow-none flex-1 min-w-0"
        {...rest}
      />
    </div>
  );
}
