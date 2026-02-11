import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/axios";

export type UserStatus = "Active" | "Disabled" | (string & {});
export type UserRole = "Admin" | "TeamLead" | "Engineer";

export type UserRow = {
  user_id: number;
  full_name: string | null;
  email: string;
  role: UserRole;
  team_id: number | null;
  team_name?: string | null;
  status: UserStatus;
  created_at: string;
  created_by?: string | null;
};

export type ListUsersParams = {
  teamId?: number;
  role?: UserRole;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listUsers(params: ListUsersParams = {}): Promise<Paged<UserRow>> {
  const sp = new URLSearchParams();
  if (params.teamId) sp.set("teamId", String(params.teamId));
  if (params.role) sp.set("role", String(params.role));
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));

  const res = await api.get(`/api/users${sp.size ? `?${sp.toString()}` : ""}`, {
    headers: { "x-sam-silent": "1" },
  });
  const data = unwrap<any>(res.data);

  if (data?.items && data?.total !== undefined) return data as Paged<UserRow>;
  if (Array.isArray(data)) {
    return { items: data as UserRow[], total: data.length, page: 1, pageSize: data.length };
  }

  return { items: [], total: 0, page: 1, pageSize: params.pageSize ?? 20 };
}

export type CreateUserInput = {
  full_name: string;
  email: string;
  role: Exclude<UserRole, "Admin"> | "Admin";
  team_id: number;
};

export async function createUser(input: CreateUserInput) {
  const res = await api.post("/api/users", input);
  return unwrap(res.data) as { user_id: number };
}

export async function disableUser(userId: number) {
  const res = await api.post(`/api/users/${userId}/disable`, {});
  return unwrap(res.data) as { ok: true };
}

export async function resetUserPassword(userId: number) {
  const res = await api.post(`/api/users/${userId}/reset-password`, {});
  return unwrap(res.data) as { ok: true };
}

export function useUsers(params: ListUsersParams) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => listUsers(params),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDisableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => disableUser(userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({ mutationFn: (userId: number) => resetUserPassword(userId) });
}
