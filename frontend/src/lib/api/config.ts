import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/axios";

export type ConfigItem = {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string | null;
};

type ConfigKey =
  | "server-types"
  | "server-statuses"
  | "environment-types"
  | "tags"
  | "maintenance-types";

export const CONFIG_KEYS: Array<{ key: ConfigKey; title: string; description: string }> = [
  { key: "server-types", title: "Server Types", description: "Canonical hardware/virtual/cloud categories." },
  { key: "server-statuses", title: "Server Statuses", description: "Operational status options and lifecycle." },
  { key: "environment-types", title: "Environment Types", description: "Production, Engineering, Lab, etc." },
  { key: "tags", title: "Tags", description: "Global tags used for search and grouping." },
  { key: "maintenance-types", title: "Maintenance Types", description: "Planned work categories." },
];

function endpointFor(key: ConfigKey) {
  switch (key) {
    case "server-types":
      return "/api/config/server-types";
    case "server-statuses":
      return "/api/config/server-statuses";
    case "environment-types":
      return "/api/config/environment-types";
    case "tags":
      return "/api/config/tags";
    case "maintenance-types":
      return "/api/config/maintenance-types";
  }
}

export async function listConfig(key: ConfigKey): Promise<ConfigItem[]> {
  const res = await api.get(endpointFor(key), { headers: { "x-sam-silent": "1" } });
  const data = unwrap<any>(res.data);
  return (Array.isArray(data) ? data : data?.items ?? []) as ConfigItem[];
}

export async function createConfig(key: ConfigKey, input: { name: string; description?: string | null }) {
  const res = await api.post(endpointFor(key), input);
  return unwrap(res.data) as { id: number };
}

export async function updateConfig(key: ConfigKey, id: number, input: { name: string; description?: string | null }) {
  const res = await api.patch(`${endpointFor(key)}/${id}`, input);
  return unwrap(res.data) as { ok: true };
}

export async function deleteConfig(key: ConfigKey, id: number) {
  const res = await api.delete(`${endpointFor(key)}/${id}`);
  return unwrap(res.data) as { ok: true };
}

export function useConfigList(key: ConfigKey) {
  return useQuery({ queryKey: ["config", key], queryFn: () => listConfig(key) });
}

export function useCreateConfig(key: ConfigKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string | null }) => createConfig(key, input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["config", key] });
    },
  });
}

export function useUpdateConfig(key: ConfigKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: { name: string; description?: string | null } }) =>
      updateConfig(key, vars.id, vars.input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["config", key] });
    },
  });
}

export function useDeleteConfig(key: ConfigKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteConfig(key, id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["config", key] });
    },
  });
}
