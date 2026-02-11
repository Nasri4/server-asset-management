"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { MoreHorizontal, Plus, RefreshCw, Search, Users, Server, ChevronDown, Building, Cpu } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { apiClient } from "@/lib/api/client";
import { AccessDenied } from "@/components/settings/access-denied";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FadeIn } from "@/components/motion/fade-in";

type ApplicationRow = {
  application_id: number;
  app_name: string | null;
  app_type?: string | null;
  version?: string | null;
  criticality?: string | null;
  sla_level?: string | null;
  description?: string | null;
  status?: string | null;
  owner_team_id?: number | null;
  owner_team_name?: string | null;
  server_id?: number | null;
  server_code?: string | null;
  hostname?: string | null;
  created_at?: string;
  updated_at?: string;
};

type TeamOption = {
  team_id: number;
  team_name: string;
  description?: string | null;
};

type ServerOption = {
  server_id: number;
  server_code: string;
  hostname: string;
  site_name?: string | null;
  role?: string | null;
};

const appSchema = z.object({
  app_name: z.string().trim().min(1, "Application name is required"),
  app_type: z.string().trim().optional(),
  version: z.string().trim().optional(),
  criticality: z.string().trim().optional(),
  sla_level: z.string().trim().optional(),
  description: z.string().trim().optional(),
  owner_team_id: z.number().int().positive().optional(),
  server_id: z.number().int().nonnegative().optional(),
});

type AppFormValues = z.infer<typeof appSchema>;

function formatMaybe(s: string | null | undefined) {
  const v = String(s ?? "").trim();
  return v ? v : "—";
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [delayMs, value]);

  return debounced;
}

function CriticalityBadge({ criticality }: { criticality?: string | null }) {
  if (!criticality) return null;
  
  const crit = criticality.toLowerCase();
  
  if (crit.includes("high")) {
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">
        {criticality}
      </Badge>
    );
  } else if (crit.includes("medium")) {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        {criticality}
      </Badge>
    );
  } else if (crit.includes("low")) {
    return (
      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
        {criticality}
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary">
      {criticality}
    </Badge>
  );
}

function SLABadge({ sla }: { sla?: string | null }) {
  if (!sla) return null;
  
  const slaLower = sla.toLowerCase();
  
  if (slaLower.includes("gold")) {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        {sla}
      </Badge>
    );
  } else if (slaLower.includes("silver")) {
    return (
      <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
        {sla}
      </Badge>
    );
  } else if (slaLower.includes("bronze")) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        {sla}
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary">
      {sla}
    </Badge>
  );
}

function ServerTypeIcon({ type }: { type?: string | null }) {
  if (!type) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
        <Server className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
      </div>
    );
  }
  
  const t = type.toLowerCase();
  
  if (t.includes("web") || t.includes("app")) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
        <Cpu className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
      </div>
    );
  }
  
  if (t.includes("db") || t.includes("database")) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
        <Server className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }
  
  if (t.includes("cache") || t.includes("redis") || t.includes("memcached")) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
        <Server className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      </div>
    );
  }
  
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
      <Server className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
    </div>
  );
}

export default function ApplicationsPage() {
  const { user, loading: authLoading } = useAuth();
  const canRead = can(user, "applications.read");
  const canManage = can(user, "applications.manage");

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const [rows, setRows] = React.useState<ApplicationRow[]>([]);
  const [teams, setTeams] = React.useState<TeamOption[]>([]);
  const [servers, setServers] = React.useState<ServerOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ApplicationRow | null>(null);

  const createForm = useForm<AppFormValues>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      app_name: "",
      app_type: "",
      version: "",
      criticality: "",
      sla_level: "",
      description: "",
      owner_team_id: undefined,
      server_id: undefined,
    },
  });

  const editForm = useForm<AppFormValues>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      app_name: "",
      app_type: "",
      version: "",
      criticality: "",
      sla_level: "",
      description: "",
      owner_team_id: undefined,
      server_id: undefined,
    },
  });

  const loadTeams = React.useCallback(async () => {
    try {
      const res = await apiClient.get<TeamOption[]>("/api/teams", {
        headers: { "x-sam-silent": "1" },
      });
      setTeams(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTeams([]);
    }
  }, []);

  const loadServers = React.useCallback(async () => {
    try {
      const res = await apiClient.get<ServerOption[]>("/api/servers", {
        headers: { "x-sam-silent": "1" },
      });
      setServers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setServers([]);
    }
  }, []);

  const load = React.useCallback(
    async (opts?: { refreshing?: boolean }) => {
      if (!canRead) return;
      try {
        if (opts?.refreshing) setRefreshing(true);
        else setLoading(true);

        const res = await apiClient.get<ApplicationRow[]>("/api/applications", {
          params: { search: debouncedSearch.trim() || undefined },
          headers: { "x-sam-silent": "1" },
        });

        setRows(Array.isArray(res.data) ? res.data : []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canRead, debouncedSearch]
  );

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!canRead) return;
    
    void load();
    void loadTeams();
    void loadServers();
  }, [authLoading, canRead, load, loadTeams, loadServers, user]);

  const openEdit = (row: ApplicationRow) => {
    setEditing(row);
    editForm.reset({
      app_name: row.app_name ?? "",
      app_type: row.app_type ?? "",
      version: row.version ?? "",
      criticality: row.criticality ?? "",
      sla_level: row.sla_level ?? "",
      description: row.description ?? "",
      owner_team_id: row.owner_team_id ?? undefined,
      server_id: row.server_id ?? undefined,
    });
    setEditOpen(true);
  };

  const createApp = async (v: AppFormValues) => {
    if (!canManage) return;
    try {
      await apiClient.post("/api/applications", {
        ...v,
        app_type: v.app_type || undefined,
        version: v.version || undefined,
        criticality: v.criticality || undefined,
        sla_level: v.sla_level || undefined,
        description: v.description || undefined,
        owner_team_id: v.owner_team_id || undefined,
        server_id: v.server_id ? v.server_id : undefined,
      });
      toast.success("Application created successfully");
      setCreateOpen(false);
      createForm.reset();
      await load({ refreshing: true });
    } catch {
      // handled by interceptor toast
    }
  };

  const updateApp = async (v: AppFormValues) => {
    if (!canManage || !editing) return;
    try {
      await apiClient.patch(`/api/applications/${editing.application_id}`, {
        ...v,
        app_type: v.app_type || undefined,
        version: v.version || undefined,
        criticality: v.criticality || undefined,
        sla_level: v.sla_level || undefined,
        description: v.description || undefined,
        owner_team_id: v.owner_team_id || undefined,
        server_id: v.server_id === undefined ? undefined : v.server_id,
      });
      toast.success("Application updated successfully");
      setEditOpen(false);
      setEditing(null);
      await load({ refreshing: true });
    } catch {
      // handled by interceptor toast
    }
  };

  const deleteApp = async (row: ApplicationRow) => {
    if (!canManage) return;
    try {
      await apiClient.delete(`/api/applications/${row.application_id}`);
      toast.success("Application deleted successfully");
      await load({ refreshing: true });
    } catch {
      // handled by interceptor toast
    }
  };

  if (authLoading) return null;
  if (!user) return null;

  if (!canRead) {
    return (
      <AccessDenied
        title="Access denied"
        description="You don't have permission to view Applications."
        backHref="/dashboard"
      />
    );
  }

  return (
    <FadeIn>
      <div className="space-y-6">
        <PageHeader
          title="Applications"
          description="Manage software applications, assign ownership teams, and link to primary servers"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void load({ refreshing: true })} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>

              {canManage && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500 text-white shadow-sm hover:shadow">
                      <Plus className="mr-2 h-4 w-4" />
                      New Application
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-green-100 to-emerald-100 flex items-center justify-center">
                          <Plus className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <DialogTitle className="text-lg font-semibold text-slate-900">
                            Create Application
                          </DialogTitle>
                          <DialogDescription className="text-slate-500">
                            Add a new application to the system
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>

                    <form onSubmit={createForm.handleSubmit((v) => void createApp(v))} className="space-y-5 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="c_name" className="text-slate-700 font-medium">
                          Application Name <span className="text-red-500">*</span>
                        </Label>
                        <Input 
                          id="c_name" 
                          {...createForm.register("app_name")} 
                          placeholder="e.g. Customer Portal API"
                          className="focus:ring-green-500 border-slate-300"
                        />
                        {createForm.formState.errors.app_name && (
                          <p className="text-xs text-red-600 mt-1">{createForm.formState.errors.app_name.message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="c_type" className="text-slate-700 font-medium">Type</Label>
                          <Input 
                            id="c_type" 
                            {...createForm.register("app_type")} 
                            placeholder="Web, API, etc"
                            className="focus:ring-green-500 border-slate-300"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="c_version" className="text-slate-700 font-medium">Version</Label>
                          <Input 
                            id="c_version" 
                            {...createForm.register("version")} 
                            placeholder="e.g. 1.2.3"
                            className="focus:ring-green-500 border-slate-300"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="c_crit" className="text-slate-700 font-medium">Criticality</Label>
                          <Select 
                            onValueChange={(value) => createForm.setValue("criticality", value)}
                            defaultValue={createForm.getValues("criticality")}
                          >
                            <SelectTrigger className="focus:ring-green-500 border-slate-300">
                              <SelectValue placeholder="Select criticality" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="High">High</SelectItem>
                              <SelectItem value="Medium">Medium</SelectItem>
                              <SelectItem value="Low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="c_sla" className="text-slate-700 font-medium">SLA Level</Label>
                          <Select 
                            onValueChange={(value) => createForm.setValue("sla_level", value)}
                            defaultValue={createForm.getValues("sla_level")}
                          >
                            <SelectTrigger className="focus:ring-green-500 border-slate-300">
                              <SelectValue placeholder="Select SLA level" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Gold">Gold</SelectItem>
                              <SelectItem value="Silver">Silver</SelectItem>
                              <SelectItem value="Bronze">Bronze</SelectItem>
                              <SelectItem value="None">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="c_desc" className="text-slate-700 font-medium">Description</Label>
                        <textarea
                          id="c_desc"
                          rows={3}
                          className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500 resize-none"
                          placeholder="Optional description about this application..."
                          {...createForm.register("description")}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="c_team" className="text-slate-700 font-medium">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-500" />
                              Owner Team
                            </div>
                          </Label>
                          <Select 
                            onValueChange={(value) => createForm.setValue("owner_team_id", value === "none" ? undefined : parseInt(value))}
                            defaultValue={createForm.getValues("owner_team_id")?.toString() || "none"}
                          >
                            <SelectTrigger className="focus:ring-green-500 border-slate-300">
                              <SelectValue placeholder="Select team" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No team assigned</SelectItem>
                              {teams.map((team) => (
                                <SelectItem key={team.team_id} value={team.team_id.toString()}>
                                  {team.team_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="c_server" className="text-slate-700 font-medium">
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4 text-slate-500" />
                              Primary Server
                            </div>
                          </Label>
                          <Select 
                            onValueChange={(value) => createForm.setValue("server_id", value === "none" ? undefined : parseInt(value))}
                            defaultValue={createForm.getValues("server_id")?.toString() || "none"}
                          >
                            <SelectTrigger className="focus:ring-green-500 border-slate-300">
                              <SelectValue placeholder="Select server" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No server assigned</SelectItem>
                              {servers.map((server) => (
                                <SelectItem key={server.server_id} value={server.server_id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <ServerTypeIcon type={server.role} />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{server.server_code}</span>
                                      <span className="text-xs text-slate-500">{server.hostname}</span>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <DialogFooter className="pt-4 border-t border-slate-200">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setCreateOpen(false)}
                          className="border-slate-300"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createForm.formState.isSubmitting}
                          className="bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500 text-white shadow-sm hover:shadow"
                        >
                          {createForm.formState.isSubmitting ? (
                            <span className="flex items-center gap-2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Creating...
                            </span>
                          ) : "Create Application"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        />

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applications by name, type, or description..."
            className="pl-9 border-slate-300 focus:border-green-500 focus:ring-green-500"
          />
        </div>

        {/* Results Count */}
        <div className="text-sm text-slate-500">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Loading applications...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              {rows.length} {rows.length === 1 ? 'application' : 'applications'} found
            </div>
          )}
        </div>

        {/* Applications Table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-r from-green-50 to-emerald-50 flex items-center justify-center">
                <div className="text-2xl">📱</div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  No applications found
                </h3>
                <p className="text-sm text-slate-500 max-w-md">
                  {search ? "Try adjusting your search query" : "Get started by creating your first application"}
                </p>
              </div>
              {canManage && !search && (
                <Button 
                  onClick={() => setCreateOpen(true)} 
                  size="sm"
                  className="bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Application
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                    APPLICATION
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                    TYPE
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                    VERSION
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                    CRITICALITY
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                    SLA
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                    OWNER TEAM
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                    SERVER
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.application_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-green-50 to-emerald-50">
                          <div className="text-sm">📱</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {formatMaybe(r.app_name)}
                          </div>
                          {r.description && (
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              {r.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-700">
                        {formatMaybe(r.app_type)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {r.version ? (
                        <span className="font-mono text-sm bg-slate-50 px-2 py-1 rounded text-slate-700">
                          {r.version}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <CriticalityBadge criticality={r.criticality} />
                    </td>
                    <td className="py-3 px-4">
                      <SLABadge sla={r.sla_level} />
                    </td>
                    <td className="py-3 px-4">
                      {r.owner_team_name ? (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-700">
                            {r.owner_team_name}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.server_id ? (
                        <div className="flex items-center gap-2">
                          <ServerTypeIcon type={r.app_type} />
                          <Link 
                            className="text-sm text-green-600 hover:text-green-800 hover:underline font-medium"
                            href={`/servers/${r.server_id}`}
                          >
                            {r.server_code || r.hostname || `Server #${r.server_id}`}
                          </Link>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 border-slate-200">
                              <DropdownMenuLabel className="text-slate-700">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEdit(r)} className="cursor-pointer">
                                Edit application
                              </DropdownMenuItem>
                              <ConfirmDialog
                                title="Delete Application"
                                description={`Are you sure you want to delete "${r.app_name || 'this application'}"? This action cannot be undone.`}
                                confirmText="Delete"
                                confirmVariant="destructive"
                                onConfirm={() => deleteApp(r)}
                                trigger={
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 cursor-pointer">
                                    Delete
                                  </DropdownMenuItem>
                                }
                              />
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Dialog */}
        {canManage && (
          <Dialog open={editOpen} onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditing(null);
          }}>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-green-100 to-emerald-100 flex items-center justify-center">
                    <div className="h-5 w-5 text-green-600">✏️</div>
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-semibold text-slate-900">
                      Edit Application
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                      Update application details and assignments
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <form onSubmit={editForm.handleSubmit((v) => void updateApp(v))} className="space-y-5 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="e_name" className="text-slate-700 font-medium">
                    Application Name <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="e_name" 
                    {...editForm.register("app_name")} 
                    className="focus:ring-green-500 border-slate-300"
                  />
                  {editForm.formState.errors.app_name && (
                    <p className="text-xs text-red-600 mt-1">{editForm.formState.errors.app_name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="e_type" className="text-slate-700 font-medium">Type</Label>
                    <Input 
                      id="e_type" 
                      {...editForm.register("app_type")} 
                      className="focus:ring-green-500 border-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e_version" className="text-slate-700 font-medium">Version</Label>
                    <Input 
                      id="e_version" 
                      {...editForm.register("version")} 
                      className="focus:ring-green-500 border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="e_crit" className="text-slate-700 font-medium">Criticality</Label>
                    <Select 
                      onValueChange={(value) => editForm.setValue("criticality", value)}
                      value={editForm.getValues("criticality") || ""}
                    >
                      <SelectTrigger className="focus:ring-green-500 border-slate-300">
                        <SelectValue placeholder="Select criticality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No criticality</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e_sla" className="text-slate-700 font-medium">SLA Level</Label>
                    <Select 
                      onValueChange={(value) => editForm.setValue("sla_level", value)}
                      value={editForm.getValues("sla_level") || ""}
                    >
                      <SelectTrigger className="focus:ring-green-500 border-slate-300">
                        <SelectValue placeholder="Select SLA level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No SLA</SelectItem>
                        <SelectItem value="Gold">Gold</SelectItem>
                        <SelectItem value="Silver">Silver</SelectItem>
                        <SelectItem value="Bronze">Bronze</SelectItem>
                        <SelectItem value="None">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="e_desc" className="text-slate-700 font-medium">Description</Label>
                  <textarea
                    id="e_desc"
                    rows={3}
                    className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500 resize-none"
                    placeholder="Optional description about this application..."
                    {...editForm.register("description")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="e_team" className="text-slate-700 font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500" />
                        Owner Team
                      </div>
                    </Label>
                    <Select 
                      onValueChange={(value) => editForm.setValue("owner_team_id", value === "none" ? undefined : parseInt(value))}
                      value={editForm.getValues("owner_team_id")?.toString() || "none"}
                    >
                      <SelectTrigger className="focus:ring-green-500 border-slate-300">
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No team assigned</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.team_id} value={team.team_id.toString()}>
                            {team.team_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e_server" className="text-slate-700 font-medium">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-slate-500" />
                        Primary Server
                      </div>
                    </Label>
                    <Select 
                      onValueChange={(value) => editForm.setValue("server_id", value === "none" ? undefined : parseInt(value))}
                      value={editForm.getValues("server_id")?.toString() || "none"}
                    >
                      <SelectTrigger className="focus:ring-green-500 border-slate-300">
                        <SelectValue placeholder="Select server" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No server (unlink)</SelectItem>
                        {servers.map((server) => (
                          <SelectItem key={server.server_id} value={server.server_id.toString()}>
                            <div className="flex items-center gap-2">
                              <ServerTypeIcon type={server.role} />
                              <div className="flex flex-col">
                                <span className="font-medium">{server.server_code}</span>
                                <span className="text-xs text-slate-500">{server.hostname}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">
                      Current: {editing?.server_code || editing?.hostname || (editing?.server_id ? `Server #${editing.server_id}` : "No server assigned")}
                    </p>
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t border-slate-200">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditOpen(false)}
                    className="border-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={editForm.formState.isSubmitting}
                    className="bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500 text-white shadow-sm hover:shadow"
                  >
                    {editForm.formState.isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving...
                      </span>
                    ) : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </FadeIn>
  );
}