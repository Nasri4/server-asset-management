"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const maybe = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return maybe?.response?.data?.error?.message || maybe?.message || fallback;
}

export function EngineerMultiSelect({
  label = "Engineers",
  teamId,
  value,
  onChange,
  disabled,
}: {
  label?: string;
  teamId?: number;
  value: number[];
  onChange: (engineerIds: number[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<EngineerOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      if (!teamId) {
        if (alive) {
          setOptions([]);
          setError(null);
          setLoading(false);
        }
        return;
      }

      try {
        setError(null);
        setLoading(true);
        const res = await api.get("/api/engineers", {
          params: { team_id: teamId },
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
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((e) => {
      const id = String(e.engineer_id);
      const name = String(e.full_name ?? "").toLowerCase();
      const email = String(e.email ?? "").toLowerCase();
      return id.includes(q) || name.includes(q) || email.includes(q);
    });
  }, [options, search]);

  const selectedSet = React.useMemo(() => new Set((value ?? []).map((n) => Number(n))), [value]);

  const toggle = React.useCallback(
    (engineerId: number) => {
      const next = new Set(selectedSet);
      if (next.has(engineerId)) next.delete(engineerId);
      else next.add(engineerId);
      onChange(Array.from(next).sort((a, b) => a - b));
    },
    [onChange, selectedSet]
  );

  const selectedBadges = React.useMemo(() => {
    const byId = new Map(options.map((o) => [o.engineer_id, o] as const));
    return (value ?? []).map((id) => {
      const e = byId.get(id);
      const labelText = e?.full_name ? `${e.full_name}` : `#${id}`;
      return { id, label: labelText };
    });
  }, [options, value]);

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={teamId ? "Search engineers…" : "Select server first"}
        aria-label="Search engineers"
        disabled={disabled || loading || !teamId}
      />

      {selectedBadges.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedBadges.map((b) => (
            <Badge key={b.id} variant="secondary">
              {b.label}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="max-h-56 overflow-auto rounded-md border bg-background">
        {!teamId ? (
          <div className="p-3 text-sm text-muted-foreground">Select a server to load its team engineers.</div>
        ) : loading ? (
          <div className="p-3 text-sm text-muted-foreground">Loading engineers…</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No engineers found.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((e) => {
              const checked = selectedSet.has(e.engineer_id);
              return (
                <li key={e.engineer_id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{e.full_name ?? `Engineer #${e.engineer_id}`}</div>
                    <div className="truncate text-xs text-muted-foreground">{e.email ?? ""}</div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(e.engineer_id)}
                      disabled={disabled}
                      className="h-4 w-4"
                    />
                    <span className="select-none">Assign</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
