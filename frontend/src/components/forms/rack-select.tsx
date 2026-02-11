"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

export type RackOption = {
  rack_id: number;
  rack_code?: string;
  location_id?: number | null;
};

function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };

  return maybe?.response?.data?.error?.message || maybe?.message || fallback;
}

export function RackSelect({
  label = "Rack",
  value,
  onChange,
  disabled,
  allowEmpty = true,
  emptyLabel = "No rack",
}: {
  label?: string;
  value: number | undefined;
  onChange: (rackId: number | undefined) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [options, setOptions] = React.useState<RackOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);
        const res = await api.get("/api/racks", { headers: { "x-sam-silent": "1" } });
        const rows = (res.data?.data ?? []) as RackOption[];
        if (!alive) return;
        setOptions(rows);
      } catch (err) {
        if (!alive) return;
        setError(getErrorMessage(err, "Failed to load racks"));
        setOptions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const selectValue = value ? String(value) : "";

  return (
    <div className="grid gap-2">
      <Label htmlFor="rack_id">{label}</Label>

      <select
        id="rack_id"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={selectValue}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        disabled={disabled || (loading && options.length === 0)}
      >
        {allowEmpty ? (
          <option value="">{emptyLabel}</option>
        ) : (
          <option value="" disabled>
            {loading ? "Loading racks…" : "Select a rack"}
          </option>
        )}

        {options.map((r) => (
          <option key={r.rack_id} value={r.rack_id}>
            {r.rack_code ? `${r.rack_code} (#${r.rack_id})` : `#${r.rack_id}`}
          </option>
        ))}
      </select>

      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
