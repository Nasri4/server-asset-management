"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

export type TeamOption = {
  team_id: number;
  team_name?: string;
};

function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };

  return maybe?.response?.data?.error?.message || maybe?.message || fallback;
}

export function TeamSelect({
  label = "Team",
  value,
  onChange,
  disabled,
  showSearch = true,
  allowEmpty,
  emptyLabel = "Keep current",
}: {
  label?: string;
  value: number | undefined;
  onChange: (teamId: number | undefined) => void;
  disabled?: boolean;
  showSearch?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<TeamOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);
        const res = await api.get("/api/teams", { headers: { "x-sam-silent": "1" } });
        const rows = (res.data?.data ?? []) as TeamOption[];
        if (!alive) return;
        setOptions(rows);
      } catch (err) {
        if (!alive) return;
        setError(getErrorMessage(err, "Failed to load teams"));
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
    return options.filter((t) => {
      const id = String(t.team_id);
      const name = String(t.team_name ?? "").toLowerCase();
      return id.includes(q) || name.includes(q);
    });
  }, [options, search, showSearch]);

  const selectValue = value ? String(value) : "";

  return (
    <div className="grid gap-2">
      <Label htmlFor="team_id">{label}</Label>

      {showSearch ? (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams…"
          aria-label="Search teams"
          disabled={disabled || loading}
        />
      ) : null}

      <select
        id="team_id"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={selectValue}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        disabled={disabled || (loading && options.length === 0)}
      >
        {allowEmpty ? (
          <option value="">{emptyLabel}</option>
        ) : (
          <option value="" disabled>
            {loading ? "Loading teams…" : "Select a team"}
          </option>
        )}

        {filtered.map((t) => (
          <option key={t.team_id} value={t.team_id}>
            {t.team_name ? `${t.team_name} (#${t.team_id})` : `#${t.team_id}`}
          </option>
        ))}
      </select>

      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
