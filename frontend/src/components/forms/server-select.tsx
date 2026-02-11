"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

export type ServerOption = { server_id: number; label: string };

export function ServerSelect({
  label = "Server",
  value,
  onChange,
  error,
  disabled,
  showSearch = true,
  allowEmpty,
  emptyLabel = "All servers",
}: {
  label?: string;
  value?: number | null;
  onChange: (serverId: number) => void;
  error?: string;
  disabled?: boolean;
  showSearch?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<ServerOption[]>([]);
  const [selected, setSelected] = React.useState<ServerOption | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const selectedId = Number(value || 0);

  React.useEffect(() => {
    let alive = true;
    const t = window.setTimeout(async () => {
      try {
        setLoadError(null);
        setLoading(true);

        const q = showSearch ? search.trim() : "";

        const res = await api.get("/api/servers", {
          params: q ? { search: q } : undefined,
          headers: { "x-sam-silent": "1" },
        });

        const rows = (res.data?.data ?? []) as any[];
        const mapped = rows
          .map((r) => {
            const id = Number(r.server_id);
            if (!Number.isFinite(id)) return null;
            const code = String(r.server_code ?? "").trim();
            const host = String(r.hostname ?? "").trim();
            const status = String(r.status ?? "").trim();
            const labelText = [code || `#${id}`, host, status ? `(${status})` : ""].filter(Boolean).join(" ");
            return { server_id: id, label: labelText } as ServerOption;
          })
          .filter(Boolean) as ServerOption[];

        if (!alive) return;
        // Keep the currently selected server visible even if it isn't in the fetched list.
        if (selected && !mapped.some((o) => o.server_id === selected.server_id)) {
          setOptions([selected, ...mapped]);
        } else {
          setOptions(mapped);
        }
      } catch (err: any) {
        if (!alive) return;
        const msg =
          (err?.response?.data?.error?.message as string | undefined) ||
          (err?.message as string | undefined) ||
          "Failed to load servers";
        setLoadError(msg);
        setOptions(selected ? [selected] : []);
      } finally {
        if (alive) setLoading(false);
      }
    }, showSearch ? 300 : 0);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [search, showSearch, selected]);

  React.useEffect(() => {
    let alive = true;

    if (!selectedId) {
      setSelected(null);
      return;
    }

    // If we already have it in options, lock it as the selected option.
    const inOptions = options.find((o) => o.server_id === selectedId) ?? null;
    if (inOptions) {
      if (!selected || selected.server_id !== inOptions.server_id || selected.label !== inOptions.label) {
        setSelected(inOptions);
      }
      return;
    }

    // Otherwise, fetch the server by ID so the select can still display it.
    void (async () => {
      try {
        const res = await api.get(`/api/servers/${selectedId}`, { headers: { "x-sam-silent": "1" } });
        const server = (res.data?.data?.server ?? null) as any;
        if (!alive || !server) return;

        const id = Number(server.server_id);
        if (!Number.isFinite(id)) return;

        const code = String(server.server_code ?? "").trim();
        const host = String(server.hostname ?? "").trim();
        const status = String(server.status ?? "").trim();
        const labelText = [code || `#${id}`, host, status ? `(${status})` : ""].filter(Boolean).join(" ");
        const opt = { server_id: id, label: labelText } as ServerOption;

        setSelected(opt);
        setOptions((prev) => {
          if (prev.some((p) => p.server_id === opt.server_id)) return prev;
          return [opt, ...prev];
        });
      } catch {
        // ignore; user can still submit via server_id, but label may not display.
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedId, options, selected]);

  return (
    <div className="grid gap-2">
      <Label htmlFor="server_id">{label}</Label>

      {showSearch ? (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search server code or hostname…"
          aria-label="Search servers"
          disabled={disabled}
        />
      ) : null}

      <select
        id="server_id"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={String(selectedId || 0)}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled || (loading && options.length === 0)}
      >
        {allowEmpty ? (
          <option value="0">{emptyLabel}</option>
        ) : (
          <option value="0" disabled>
            {loading ? "Loading servers…" : "Select a server"}
          </option>
        )}
        {options.map((s) => (
          <option key={s.server_id} value={s.server_id}>
            {s.label}
          </option>
        ))}
      </select>

      {loadError ? <div className="text-xs text-destructive">{loadError}</div> : null}
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
