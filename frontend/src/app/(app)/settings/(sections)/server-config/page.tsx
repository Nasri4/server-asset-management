"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigTable } from "@/components/settings/config-table";
import { RbacGuard } from "@/components/auth/rbac-guard";
import { useAuth } from "@/components/auth/auth-provider";
import { isAdmin, isTeamLead } from "@/lib/rbac";

export default function ServerConfigSettingsPage() {
  const { user } = useAuth();
  const canEdit = isAdmin(user);

  return (
    <RbacGuard
      roles={["Admin", "TeamLead"]}
      deniedTitle="Not available"
      deniedDescription="This section is not available for your role."
    >
      <div className="grid gap-6">
        <Tabs defaultValue="server-types">
          <TabsList className="h-auto w-full justify-start gap-8 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="server-types"
              className="rounded-none border-b-2 border-transparent px-0 py-3 text-sm font-medium text-slate-500 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700"
            >
              Server Types
            </TabsTrigger>
            <TabsTrigger
              value="server-statuses"
              className="rounded-none border-b-2 border-transparent px-0 py-3 text-sm font-medium text-slate-500 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700"
            >
              Server Statuses
            </TabsTrigger>
            <TabsTrigger
              value="environment-types"
              className="rounded-none border-b-2 border-transparent px-0 py-3 text-sm font-medium text-slate-500 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700"
            >
              Environment Types
            </TabsTrigger>
            <TabsTrigger
              value="tags"
              className="rounded-none border-b-2 border-transparent px-0 py-3 text-sm font-medium text-slate-500 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700"
            >
              Tags
            </TabsTrigger>
          </TabsList>
          <div className="-mt-px border-b border-slate-200" />

          <TabsContent value="server-types" className="pt-6">
            <ConfigTable
              configKey="server-types"
              title="Server Types"
              description={canEdit ? "Standardize server categories." : "View-only. Contact an admin to request changes."}
              canEdit={canEdit}
              addLabel="Add Type"
              learnMoreHref="#"
            />
          </TabsContent>

          <TabsContent value="server-statuses" className="pt-6">
            <ConfigTable
              configKey="server-statuses"
              title="Server Statuses"
              description={canEdit ? "Control status options and lifecycle." : "View-only. Contact an admin to request changes."}
              canEdit={canEdit}
              addLabel="Add Status"
            />
          </TabsContent>

          <TabsContent value="environment-types" className="pt-6">
            <ConfigTable
              configKey="environment-types"
              title="Environment Types"
              description={canEdit ? "Define allowed environments." : "View-only. Contact an admin to request changes."}
              canEdit={canEdit}
              addLabel="Add Environment"
            />
          </TabsContent>

          <TabsContent value="tags" className="pt-6">
            <ConfigTable
              configKey="tags"
              title="Tags"
              description={canEdit ? "Manage global tags." : "View-only. Contact an admin to request changes."}
              canEdit={canEdit}
              addLabel="Add Tag"
            />
          </TabsContent>
        </Tabs>

        {isTeamLead(user) && !isAdmin(user) ? (
          <div className="text-sm text-muted-foreground">
            Team leads can view server configuration for consistency, but edits are restricted to admins.
          </div>
        ) : null}
      </div>
    </RbacGuard>
  );
}
