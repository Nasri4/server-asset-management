"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Server as ServerIcon, Users, MapPin } from "lucide-react";

import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamSelect } from "@/components/forms/team-select";
import { EngineerSelect } from "@/components/forms/engineer-select";
import { LocationSelect } from "@/components/forms/location-select";
import { optionalText } from "@/lib/validation";

const ENVIRONMENT_OPTIONS = ["Production", "Engineering"] as const;

const STATUS_OPTIONS = ["Active", "Maintenance", "Offline", "Decommissioned"] as const;

const schema = z.object({
  hostname: optionalText(),
  server_type: optionalText(),
  environment: optionalText(),
  role: optionalText(),
  status: optionalText(),
  team_id: z.number().int().optional(),
  engineer_id: z.number().int().optional(),
  location_id: z.number().int().optional(),
  rack_id: z.number().int().optional(),
  u_position: optionalText(),
  install_date: optionalText(),
});

type FormValues = z.infer<typeof schema>;

export function EditServerDialog({
  id,
  server,
  disabled,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  onUpdated,
}: {
  id?: number;
  server: Record<string, unknown> | null;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUpdated: () => Promise<void>;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  
  // Use external control if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange !== undefined ? externalOnOpenChange : setInternalOpen;
  
  // Get id from server if not provided
  const serverId = id ?? (server?.server_id as number | undefined);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const teamId = watch("team_id");
  const engineerId = watch("engineer_id");
  const locationId = watch("location_id");
  const environment = watch("environment") ?? "";
  const status = watch("status") ?? "";

  React.useEffect(() => {
    if (!open || !server) return;

    reset({
      hostname: (server.hostname as string | undefined) ?? undefined,
      server_type: (server.server_type as string | undefined) ?? undefined,
      environment: (server.environment as string | undefined) ?? undefined,
      role: (server.role as string | undefined) ?? undefined,
      status: (server.status as string | undefined) ?? undefined,
      team_id: typeof server.team_id === "number" ? (server.team_id as number) : undefined,
      engineer_id: typeof server.engineer_id === "number" ? (server.engineer_id as number) : undefined,
      location_id: typeof server.location_id === "number" ? (server.location_id as number) : undefined,
      rack_id: typeof server.rack_id === "number" ? (server.rack_id as number) : undefined,
      u_position: (server.u_position as string | undefined) ?? undefined,
      install_date: (server.install_date as string | undefined) ?? undefined,
    });
  }, [open, server, reset]);

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      if (!serverId) {
        toast.error("Server ID is missing");
        return;
      }

      // Only send fields that are defined.
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== undefined && v !== "")
      );

      await api.patch(`/api/servers/${serverId}`, payload);
      toast.success("Server updated");
      await onUpdated();
      setOpen(false);
    },
    [serverId, onUpdated, setOpen]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">Edit Server</DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
            Update server metadata. Changes are audited.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {/* Basic Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <ServerIcon className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Basic Information</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hostname" className="text-sm font-medium text-slate-700 dark:text-slate-300">Hostname</Label>
                <Input 
                  id="hostname" 
                  {...register("hostname")} 
                  placeholder="srv-0001.hormuud.com"
                  className="h-10"
                />
                {errors.hostname && <p className="text-xs text-rose-600">{errors.hostname.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="server_type" className="text-sm font-medium text-slate-700 dark:text-slate-300">Server Type</Label>
                <Input 
                  id="server_type" 
                  {...register("server_type")} 
                  placeholder="Physical, Virtual, Cloud"
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="environment" className="text-sm font-medium text-slate-700 dark:text-slate-300">Environment</Label>
                <select
                  id="environment"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                  {...register("environment")}
                >
                  {environment && !ENVIRONMENT_OPTIONS.includes(environment as any) && (
                    <option value={environment}>{environment}</option>
                  )}
                  <option value="">Keep current</option>
                  {ENVIRONMENT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</Label>
                <select
                  id="status"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                  {...register("status")}
                >
                  {status && !STATUS_OPTIONS.includes(status as any) && (
                    <option value={status}>{status}</option>
                  )}
                  <option value="">Keep current</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</Label>
              <Input 
                id="role" 
                {...register("role")} 
                placeholder="DNS, Web Server, Database"
                className="h-10"
              />
            </div>
          </div>

          {/* Assignment Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <Users className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Assignment</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <TeamSelect
                  allowEmpty
                  emptyLabel="Keep current"
                  value={teamId}
                  onChange={(id) => {
                    setValue("team_id", id, { shouldDirty: true });
                    setValue("engineer_id", undefined, { shouldDirty: true });
                  }}
                  showSearch={false}
                />
                <input type="hidden" {...register("team_id", { valueAsNumber: true })} />
              </div>

              <div className="space-y-2">
                <EngineerSelect
                  allowEmpty
                  emptyLabel="Keep current"
                  teamId={teamId}
                  value={engineerId}
                  onChange={(id) => setValue("engineer_id", id, { shouldDirty: true })}
                  showSearch={false}
                />
                <input type="hidden" {...register("engineer_id", { valueAsNumber: true })} />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <MapPin className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Location & Placement</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <LocationSelect
                  allowEmpty
                  emptyLabel="Keep current"
                  value={locationId}
                  onChange={(id) => setValue("location_id", id, { shouldDirty: true })}
                  showSearch={false}
                />
                <input type="hidden" {...register("location_id", { valueAsNumber: true })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="u_position" className="text-sm font-medium text-slate-700 dark:text-slate-300">U Position</Label>
                <Input 
                  id="u_position" 
                  {...register("u_position")} 
                  placeholder="U1, U2, U3..."
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="install_date" className="text-sm font-medium text-slate-700 dark:text-slate-300">Install Date</Label>
              <Input 
                id="install_date" 
                type="date"
                {...register("install_date")} 
                className="h-10"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="min-w-[100px]">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
