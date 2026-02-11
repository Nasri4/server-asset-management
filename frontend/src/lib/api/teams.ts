import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/axios";

export type TeamRow = {
  team_id: number;
  name: string;
  team_lead_user_id?: number | null;
  team_lead_name?: string | null;
  created_at?: string | null;
};

export async function listTeams() {
  const res = await api.get("/api/teams", { headers: { "x-sam-silent": "1" } });
  const data = unwrap<any>(res.data);
  return (Array.isArray(data) ? data : data?.items ?? []) as TeamRow[];
}

export type CreateTeamInput = {
  name: string;
  team_lead_user_id?: number | null;
};

export async function createTeam(input: CreateTeamInput) {
  const res = await api.post("/api/teams", input);
  return unwrap(res.data) as { team_id: number };
}

export async function updateTeam(teamId: number, input: CreateTeamInput) {
  const res = await api.patch(`/api/teams/${teamId}`, input);
  return unwrap(res.data) as { ok: true };
}

export async function deleteTeam(teamId: number) {
  const res = await api.delete(`/api/teams/${teamId}`);
  return unwrap(res.data) as { ok: true };
}

export function useTeams() {
  return useQuery({ queryKey: ["teams"], queryFn: listTeams });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTeam,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, input }: { teamId: number; input: CreateTeamInput }) => updateTeam(teamId, input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => deleteTeam(teamId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
