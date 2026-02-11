import {
  Activity,
  AlertTriangle,
  Database,
  FileText,
  HardDrive,
  Layers2,
  Layers,
  Network,
  Pin,
  Shield,
  Settings,
  User,
  Users,
  Wrench,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AuthUser } from "@/lib/api/types";
import { can, isAdmin } from "@/lib/rbac";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section?: string;
  adminOnly?: boolean;
  permission?: string | string[];
};

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: Activity, section: "Overview" },

  // Required primary sections (enterprise ordering)
  { key: "servers", label: "Servers", href: "/servers", icon: Database, section: "Infrastructure", permission: "servers.read" },
  { key: "maintenance", label: "Maintenance", href: "/maintenance", icon: Wrench, section: "Operations", permission: "maintenance.read" },
  { key: "incidents", label: "Incidents", href: "/incidents", icon: AlertTriangle, section: "Operations", permission: "incidents.read" },
  { key: "monitoring", label: "Monitoring", href: "/monitoring", icon: Activity, section: "Operations", permission: "monitoring.read" },
  { key: "network", label: "Network", href: "/network", icon: Network, section: "Infrastructure", permission: "network.read" },
  { key: "locations", label: "Locations", href: "/locations", icon: Pin, section: "Infrastructure", permission: "locations.read" },
  { key: "racks", label: "Racks", href: "/racks", icon: Layers, section: "Infrastructure", permission: "racks.read" },
  { key: "engineers", label: "Engineers", href: "/engineers", icon: User, section: "Infrastructure", permission: "teams.read" },
  { key: "teams", label: "Teams", href: "/teams", icon: Users, section: "Infrastructure", permission: "teams.read" },
  { key: "user-management", label: "User Management", href: "/users", icon: UserPlus, section: "Admin", adminOnly: true },
  { key: "applications", label: "Applications", href: "/applications", icon: Layers2, section: "Operations", permission: "applications.read" },
  { key: "reports", label: "Reports", href: "/reports", icon: FileText, section: "Governance" },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings, section: "Admin", adminOnly: true },

  // Additional system areas
  { key: "hardware", label: "Hardware", href: "/hardware", icon: HardDrive, section: "Infrastructure", permission: "hardware.read" },
  { key: "security", label: "Security", href: "/security", icon: Shield, section: "Governance", permission: "security.read" },
  { key: "audit", label: "Audit Logs", href: "/audit", icon: FileText, section: "Governance", adminOnly: true },
  { key: "visits", label: "Visits", href: "/visits", icon: Users, section: "Operations", permission: "visits.read" },
];

export function navForUser(user: AuthUser | null | undefined) {
  return NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return isAdmin(user);
    if (item.permission) {
      const required = Array.isArray(item.permission) ? item.permission : [item.permission];
      return required.some((p) => can(user, p));
    }
    return true;
  });
}
