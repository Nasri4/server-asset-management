"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

export type EngineerOption = {
  engineer_id: number;
  full_name?: string;
  phone?: string;
  email?: string;
  team_id?: number;
  team_name?: string;
  is_active?: boolean;
};

function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };

  return maybe?.response?.data?.error?.message || maybe?.message || fallback;
}

export function EngineerSelect({
  label = "Engineer",
  teamId,
  value,
  onChange,
  disabled,
  showSearch = true,
  allowEmpty,
  emptyLabel = "Keep current",
}: {
  label?: string;
  teamId?: number;
  value: number | undefined;
  onChange: (engineerId: number | undefined) => void;
  disabled?: boolean;
  showSearch?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<EngineerOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);
        const params = teamId ? { team_id: teamId } : {};
        const res = await api.get("/api/engineers", {
          params,
          headers: { "x-sam-silent": "1" },
        });
        const rows = (res.data?.data ?? []) as EngineerOption[];
        if (!alive) return;
        setOptions(rows);
      } catch (err) {
        if (!alive) return;
        setError(getErrorMessage(err, "Failed to load engineers"));
        setOptions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [teamId]);

  const filtered = React.useMemo(() => {
    if (!showSearch) return options;
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((e) => {
      const id = String(e.engineer_id);
      const name = String(e.full_name ?? "").toLowerCase();
      const email = String(e.email ?? "").toLowerCase();
      return id.includes(q) || name.includes(q) || email.includes(q);
    });
  }, [options, search, showSearch]);

  const selectValue = value ? String(value) : "";
  const disabledSelect = disabled || (loading && options.length === 0);

  return (
    <div className="grid gap-2">
      <Label htmlFor="engineer_id">{label}</Label>

      {showSearch ? (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search engineers…"
          aria-label="Search engineers"
          disabled={disabled || loading}
        />
      ) : null}

      <select
        id="engineer_id"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={selectValue}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        disabled={disabledSelect}
      >
        {allowEmpty ? (
          <option value="">{emptyLabel}</option>
        ) : (
          <option value="" disabled>
            {loading ? "Loading engineers…" : "Select an engineer"}
          </option>
        )}

        {filtered.map((e) => (
          <option key={e.engineer_id} value={e.engineer_id}>
            {e.full_name ? `${e.full_name} (#${e.engineer_id})` : `#${e.engineer_id}`}
          </option>
        ))}
      </select>

      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
