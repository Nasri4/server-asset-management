'use client';

import { useCallback } from 'react';

const DEFAULT_DOMAIN = '@gmail.com';

/**
 * Email input with smart autocomplete: on blur, if the value has no '@', append @gmail.com.
 * User can edit or remove the domain to use a different provider.
 */
export default function EmailInput({ value = '', onChange, onBlur, className = '', ...rest }) {
  const handleBlur = useCallback(
    (e) => {
      const v = (value || '').trim();
      if (v && !v.includes('@')) {
        const suggested = v + DEFAULT_DOMAIN;
        onChange(suggested);
      }
      onBlur?.(e);
    },
    [value, onChange, onBlur]
  );

  return (
    <input
      type="email"
      autoComplete="email"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleBlur}
      className={className || 'input-field'}
      placeholder="e.g. name@gmail.com"
      {...rest}
    />
  );
}
