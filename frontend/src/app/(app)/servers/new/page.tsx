"use client";

import * as React from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { TeamSelect } from "@/components/forms/team-select";
import { EngineerSelect } from "@/components/forms/engineer-select";
import { LocationSelect } from "@/components/forms/location-select";
import { RackSelect } from "@/components/forms/rack-select";
import { optionalText, requiredText } from "@/lib/validation";
import { PostCreateWizard } from "@/app/(app)/servers/new/ui/post-create-wizard";

const schema = z.object({
  server_code: requiredText("Server code is required"),
  hostname: requiredText("Hostname is required"),
  server_type: requiredText("Server type is required"),
  environment: requiredText("Environment is required"),
  role: requiredText("Role is required"),
  team_id: z.number().int().positive("Team is required"),
  engineer_id: z.number().int().positive("Engineer is required"),
  location_id: z.number().int().positive("Location is required"),
  rack_id: z.number().int().positive("Rack is required"),

  // Optional server login credentials
  login_username: optionalText(),
  login_password: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterServerPage() {
  const { user } = useAuth();

  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [createdServerId, setCreatedServerId] = React.useState<number | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      server_code: "",
      hostname: "",
      server_type: "",
      environment: "",
      role: "",
      team_id: 0,
      engineer_id: 0,
      location_id: 0,
      rack_id: 0,
      login_username: "",
      login_password: "",
    },
  });

  const teamId = watch("team_id");
  const engineerId = watch("engineer_id");
  const locationId = watch("location_id");
  const rackId = watch("rack_id");

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      const payload = {
        ...values,
        login_username: values.login_username?.trim() ? values.login_username.trim() : null,
        login_password: values.login_password?.trim() ? values.login_password : null,
      };

      let id: number | undefined;
      try {
        const res = await api.post("/api/servers", payload, { headers: { "x-sam-silent": "1" } });
        id = res.data?.data?.server_id as number | undefined;
      } catch (err: any) {
        const code = err?.response?.data?.error?.code as string | undefined;
        const message =
          (err?.response?.data?.error?.message as string | undefined) ||
          (err?.message as string | undefined) ||
          "Failed to register server";

        if (code === "CREDENTIALS_ENCRYPTION_NOT_CONFIGURED") {
          toast.error(
            `${message} If you don\'t need credentials, leave the password blank. Otherwise configure CREDENTIALS_ENCRYPTION_KEY in the backend.`
          );
          return;
        }

        toast.error(message);
        return;
      }

      toast.success("Server registered");
      if (!id) {
        window.location.href = "/servers";
        return;
      }

      setCreatedServerId(id);
      setWizardOpen(true);
    },
    []
  );

  if (!can(user, "servers.create")) {
    return (
      <FadeIn>
        <EmptyState title="Access denied" description="You do not have permission to register servers." />
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Register Server</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new server record (audited). <span className="text-destructive">*</span> indicates required fields.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Server Details</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              All fields marked with <span className="text-destructive">*</span> are required
            </p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="server_code">
                    Server Code <span className="text-destructive">*</span>
                  </Label>
                  <Input id="server_code" placeholder="e.g. SAM-DC1-001" {...register("server_code")} />
                  {errors.server_code ? <div className="text-xs text-destructive">{errors.server_code.message}</div> : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hostname">
                    Hostname <span className="text-destructive">*</span>
                  </Label>
                  <Input id="hostname" placeholder="e.g. dc1-esx01" {...register("hostname")} />
                  {errors.hostname ? <div className="text-xs text-destructive">{errors.hostname.message}</div> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="server_type">
                    Server Type <span className="text-destructive">*</span>
                  </Label>
                  <Input id="server_type" placeholder="e.g. Physical" {...register("server_type")} />
                  {errors.server_type ? <div className="text-xs text-destructive">{errors.server_type.message}</div> : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="environment">
                    Environment <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="environment"
                    className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    {...register("environment")}
                  >
                    <option value="" disabled>
                      Select environment
                    </option>
                    <option value="Production">Production</option>
                    <option value="Engineering">Engineering</option>
                  </select>
                  {errors.environment ? <div className="text-xs text-destructive">{errors.environment.message}</div> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="role">
                    Role <span className="text-destructive">*</span>
                  </Label>
                  <Input id="role" placeholder="e.g. Application" {...register("role")} />
                  {errors.role ? <div className="text-xs text-destructive">{errors.role.message}</div> : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <TeamSelect
                      value={teamId || undefined}
                      onChange={(id) => {
                        if (id === undefined) return;
                        setValue("team_id", id, { shouldValidate: true });
                        setValue("engineer_id", 0, { shouldValidate: true });
                      }}
                      showSearch={false}
                      
                    />
                    <input type="hidden" {...register("team_id", { valueAsNumber: true })} />
                    {errors.team_id ? <div className="text-xs text-destructive">{errors.team_id.message}</div> : null}
                  </div>
                  <div className="grid gap-2">
                    <LocationSelect
                      value={locationId || undefined}
                      onChange={(id) => {
                        if (id === undefined) return;
                        setValue("location_id", id, { shouldValidate: true });
                      }}
                      showSearch={false}
                      
                    />
                    <input type="hidden" {...register("location_id", { valueAsNumber: true })} />
                    {errors.location_id ? <div className="text-xs text-destructive">{errors.location_id.message}</div> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <RackSelect
                    value={rackId || undefined}
                    onChange={(id) => {
                      if (id === undefined) return;
                      setValue("rack_id", id, { shouldValidate: true });
                    }}
                    allowEmpty={false}
                  />
                  <input
                    type="  hidden"
                    {...register("rack_id", {
                      setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                    })}
                  />
                  {errors.rack_id ? <div className="text-xs text-destructive">{errors.rack_id.message}</div> : null}
                </div>
                <div className="grid gap-2">
                  <EngineerSelect
                    teamId={teamId || undefined}
                    value={engineerId || undefined}
                    onChange={(id) => {
                      if (id === undefined) return;
                      setValue("engineer_id", id, { shouldValidate: true });
                    }}
                    showSearch={false}
                  />
                  <input type="hidden" {...register("engineer_id", { valueAsNumber: true })} />
                  {errors.engineer_id ? <div className="text-xs text-destructive">{errors.engineer_id.message}</div> : null}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="text-sm font-medium">Login credentials (optional)</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Stored securely (encrypted). Leave blank if not needed.
                </div>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="login_username">Username</Label>
                    <Input id="login_username" autoComplete="off" placeholder="e.g. administrator" {...register("login_username")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="login_password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login_password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="pr-10"
                        {...register("login_password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
  type="submit" 
  disabled={isSubmitting}
  className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-md hover:shadow-lg transition-shadow duration-200 font-medium px-4 py-2 rounded-lg w-fit"
>
  {isSubmitting ? "Creating…" : "Create"}
</Button>
            </form>
          </CardContent>
        </Card>

        {createdServerId ? (
          <PostCreateWizard
            serverId={createdServerId}
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            onDone={() => {
              setWizardOpen(false);
              window.location.href = `/servers/${createdServerId}`;
            }}
          />
        ) : null}
      </div>
    </FadeIn>
  );
}
