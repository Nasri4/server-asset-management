import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/axios";

export type Actor = {
  user_id: number;
  full_name: string | null;
  role_name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
};

export type ActivityEntry = {
  activity_id: number;
  created_at: string;
  message?: string | null;
  entity_type?: string | null;
  entity_id?: string | number | null;
  action?: string | null;
  server_id?: number | null;
  actor?: Actor | null;
};

export type AuditEntry = {
  audit_id: number;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  actor?: Actor | null;
  before_json?: unknown;
  after_json?: unknown;
  team_id?: number | null;
};

export async function listTeamActivity(params: { teamId?: number; limit?: number; offset?: number }) {
  const sp = new URLSearchParams();
  if (params.teamId) sp.set("teamId", String(params.teamId));
  sp.set("limit", String(params.limit ?? 50));
  sp.set("offset", String(params.offset ?? 0));

  const res = await api.get(`/api/logs/activity?${sp.toString()}`, { headers: { "x-sam-silent": "1" } });
  const data = unwrap<any>(res.data);
  return {
    items: (data?.items ?? data?.activities ?? data ?? []) as ActivityEntry[],
    total: Number(data?.pagination?.total ?? data?.total ?? 0),
  };
}

export async function listServerActivity(params: { serverId: number; limit?: number; offset?: number }) {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit ?? 25));
  sp.set("offset", String(params.offset ?? 0));

  const res = await api.get(`/api/servers/${params.serverId}/activity?${sp.toString()}`, {
    headers: { "x-sam-silent": "1" },
  });
  const data = unwrap<any>(res.data);
  const items = (data?.items ?? data?.activities ?? data ?? []) as ActivityEntry[];
  const total = Number(data?.pagination?.total ?? data?.total ?? items.length);
  const nextOffset = (params.offset ?? 0) + items.length;
  const hasMore = nextOffset < total;

  return { items, total, nextOffset, hasMore };
}

export async function listServerAudits(params: { serverId: number; limit?: number; offset?: number }) {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit ?? 25));
  sp.set("offset", String(params.offset ?? 0));

  const res = await api.get(`/api/servers/${params.serverId}/audits?${sp.toString()}`, {
    headers: { "x-sam-silent": "1" },
  });
  const data = unwrap<any>(res.data);
  const items = (data?.items ?? data?.audits ?? data ?? []) as AuditEntry[];
  const total = Number(data?.pagination?.total ?? data?.total ?? items.length);
  const nextOffset = (params.offset ?? 0) + items.length;
  const hasMore = nextOffset < total;

  return { items, total, nextOffset, hasMore };
}

export function useTeamActivity(params: { teamId?: number }) {
  return useQuery({ queryKey: ["logs", "team-activity", params], queryFn: () => listTeamActivity(params) });
}

export function useInfiniteServerActivity(serverId: number, limit = 25) {
  return useInfiniteQuery({
    queryKey: ["logs", "server-activity", serverId, limit],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listServerActivity({ serverId, offset: pageParam as number, limit }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
  });
}

export function useInfiniteServerAudits(serverId: number, limit = 25) {
  return useInfiniteQuery({
    queryKey: ["logs", "server-audits", serverId, limit],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listServerAudits({ serverId, offset: pageParam as number, limit }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
  });
}
