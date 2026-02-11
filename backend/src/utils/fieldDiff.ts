export type FieldChange = { from: unknown; to: unknown };

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function isEqual(a: unknown, b: unknown): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  // Simple deep-ish equality via JSON, good enough for audit/activity summaries.
  // Fallback to strict for non-serializable values.
  try {
    return JSON.stringify(na) === JSON.stringify(nb);
  } catch {
    return na === nb;
  }
}

export function diffFields(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
  fields: string[]
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  const b = before ?? {};
  const a = after ?? {};

  for (const field of fields) {
    const from = b[field];
    const to = a[field];
    if (!isEqual(from, to)) changes[field] = { from, to };
  }

  return changes;
}

export function changeKeys(changes: Record<string, FieldChange>): string[] {
  return Object.keys(changes);
}

export function summarizeChangeMessage(entityLabel: string, changes: Record<string, FieldChange>): string {
  const keys = changeKeys(changes);
  if (keys.length === 0) return `${entityLabel} updated`;
  if (keys.length === 1) {
    const k = keys[0];
    const c = changes[k];
    return `${entityLabel} updated: ${k}`;
  }
  return `${entityLabel} updated: ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""}`;
}
