"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

export type LocationOption = {
  location_id: number;
  site_name?: string;
};

function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };

  return maybe?.response?.data?.error?.message || maybe?.message || fallback;
}

export function LocationSelect({
  label = "Location",
  value,
  onChange,
  disabled,
  showSearch = true,
  allowEmpty,
  emptyLabel = "Keep current",
}: {
  label?: string;
  value: number | undefined;
  onChange: (locationId: number | undefined) => void;
  disabled?: boolean;
  showSearch?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<LocationOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);
        const res = await api.get("/api/locations", { headers: { "x-sam-silent": "1" } });
        const rows = (res.data?.data ?? []) as LocationOption[];
        if (!alive) return;
        setOptions(rows);
      } catch (err) {
        if (!alive) return;
        setError(getErrorMessage(err, "Failed to load locations"));
        setOptions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = React.useMemo(() => {
    if (!showSearch) return options;
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((l) => {
      const id = String(l.location_id);
      const name = String(l.site_name ?? "").toLowerCase();
      return id.includes(q) || name.includes(q);
    });
  }, [options, search, showSearch]);

  const selectValue = value ? String(value) : "";

  return (
    <div className="grid gap-2">
      <Label htmlFor="location_id">{label}</Label>

      {showSearch ? (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search locations…"
          aria-label="Search locations"
          disabled={disabled || loading}
        />
      ) : null}

      <select
        id="location_id"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={selectValue}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        disabled={disabled || (loading && options.length === 0)}
      >
        {allowEmpty ? (
          <option value="">{emptyLabel}</option>
        ) : (
          <option value="" disabled>
            {loading ? "Loading locations…" : "Select a location"}
          </option>
        )}

        {filtered.map((l) => (
          <option key={l.location_id} value={l.location_id}>
            {l.site_name ? `${l.site_name} (#${l.location_id})` : `#${l.location_id}`}
          </option>
        ))}
      </select>

      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
