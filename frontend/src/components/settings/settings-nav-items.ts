import {
  Building2,
  Users,
  Users2,
  Shield,
  Bell,
  Sliders,
  Wrench,
  ClipboardList,
  Lock,
  Database,
  KeyRound,
} from "lucide-react";
import type { AuthUser } from "@/lib/api/types";
import { isAdmin, isEngineer, isTeamLead } from "@/lib/rbac";

export type SettingsNavItem = {
  group:
    | "Global Settings"
    | "Team Settings"
    | "Operations"
    | "Security"
    | "Data";
  key:
    | "organization"
    | "teams"
    | "users"
    | "roles-permissions"
    | "server-config"
    | "maintenance-config"
    | "audit-activity"
    | "notifications"
    | "security"
    | "data-management";
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  teamLeadVisible?: boolean;
  teamLeadReadOnly?: boolean;
};

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    group: "Global Settings",
    key: "organization",
    title: "Organization",
    description: "Identity, defaults, and branding.",
    href: "/settings/organization",
    icon: Building2,
    teamLeadVisible: true,
    teamLeadReadOnly: true,
  },
  {
    group: "Team Settings",
    key: "teams",
    title: "Teams",
    description: "Manage teams, leads, and membership.",
    href: "/settings/teams",
    icon: Users2,
    teamLeadVisible: true,
  },
  {
    group: "Team Settings",
    key: "users",
    title: "Users",
    description: "Invite, assign roles, and manage access.",
    href: "/settings/users",
    icon: Users,
    teamLeadVisible: true,
  },
  {
    group: "Security",
    key: "roles-permissions",
    title: "Roles & Permissions",
    description: "Permission matrix and audit trail.",
    href: "/settings/roles-permissions",
    icon: KeyRound,
    adminOnly: true,
  },
  {
    group: "Global Settings",
    key: "server-config",
    title: "Server Configuration",
    description: "Manage global server types, statuses, environments, and tags across your organization.",
    href: "/settings/server-config",
    icon: Sliders,
    adminOnly: true,
  },
  {
    group: "Operations",
    key: "maintenance-config",
    title: "Maintenance Configuration",
    description: "Maintenance types and approval rules.",
    href: "/settings/maintenance-config",
    icon: Wrench,
    adminOnly: true,
  },
  {
    group: "Operations",
    key: "audit-activity",
    title: "Audit & Activity",
    description: "Retention and activity visibility.",
    href: "/settings/audit-activity",
    icon: ClipboardList,
    teamLeadVisible: true,
  },
  {
    group: "Operations",
    key: "notifications",
    title: "Notifications",
    description: "Email and team notifications.",
    href: "/settings/notifications",
    icon: Bell,
    teamLeadVisible: true,
  },
  {
    group: "Security",
    key: "security",
    title: "Security",
    description: "Password policy and session controls.",
    href: "/settings/security",
    icon: Shield,
    adminOnly: true,
    teamLeadVisible: true,
    teamLeadReadOnly: true,
  },
  {
    group: "Data",
    key: "data-management",
    title: "Data Management",
    description: "Exports and operational data resets.",
    href: "/settings/data-management",
    icon: Database,
    adminOnly: true,
  },
];

export function visibleSettingsNav(user: AuthUser | null | undefined) {
  if (!user) return [];
  if (isEngineer(user)) return [];

  if (isAdmin(user)) return SETTINGS_NAV;

  if (isTeamLead(user)) {
    return SETTINGS_NAV.filter((i) => Boolean(i.teamLeadVisible));
  }

  // Default: treat unknown roles as least-privileged.
  return [];
}

export function getSettingsMetaByPath(pathname: string) {
  const item = SETTINGS_NAV.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return (
    item ?? {
      key: "organization" as const,
      title: "Settings",
      description: "Administration and configuration.",
      href: "/settings",
      icon: Lock,
    }
  );
}
