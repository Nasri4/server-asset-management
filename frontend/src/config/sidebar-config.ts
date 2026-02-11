/**
 * SIDEBAR NAVIGATION CONFIGURATION
 * Role-based navigation for Hormuud Telecom
 */

import {
  LayoutDashboard,
  Server,
  Network,
  HardDrive,
  Shield,
  MapPin,
  Archive,
  Wrench,
  AlertTriangle,
  Users,
  UserCog,
  UsersRound,
  UserPlus,
  FileText,
  BarChart,
  Settings,
  Activity,
  Package
} from "lucide-react";

export interface SidebarItem {
  title: string;
  href: string;
  icon: any;
  roles: string[]; // Roles that can see this item
  badge?: string; // Optional badge (e.g., "New", "Beta")
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export const sidebarConfig: SidebarSection[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["Admin", "TeamLead", "Engineer"]
      }
    ]
  },
  {
    title: "Infrastructure",
    items: [
      {
        title: "Servers",
        href: "/servers",
        icon: Server,
        roles: ["Admin", "TeamLead", "Engineer"]
      },
      {
        title: "Network",
        href: "/network",
        icon: Network,
        roles: ["Admin", "TeamLead"]
      },
      {
        title: "Hardware",
        href: "/hardware",
        icon: HardDrive,
        roles: ["Admin", "TeamLead"]
      },
      {
        title: "Security",
        href: "/security",
        icon: Shield,
        roles: ["Admin", "TeamLead"]
      },
      {
        title: "Locations",
        href: "/locations",
        icon: MapPin,
        roles: ["Admin", "TeamLead"]
      },
      {
        title: "Racks",
        href: "/racks",
        icon: Archive,
        roles: ["Admin", "TeamLead"]
      },
      {
        title: "Applications",
        href: "/applications",
        icon: Package,
        roles: ["Admin", "TeamLead"]
      }
    ]
  },
  {
    title: "Operations",
    items: [
      {
        title: "Maintenance",
        href: "/maintenance",
        icon: Wrench,
        roles: ["Admin", "TeamLead", "Engineer"]
      },
      {
        title: "Incidents",
        href: "/incidents",
        icon: AlertTriangle,
        roles: ["Admin", "TeamLead", "Engineer"]
      },
      {
        title: "Visits",
        href: "/visits",
        icon: Activity,
        roles: ["Admin", "TeamLead", "Engineer"]
      }
    ]
  },
  {
    title: "People",
    items: [
      {
        title: "Engineers",
        href: "/engineers",
        icon: UserCog,
        roles: ["Admin", "TeamLead"]
      },
      {
        title: "Teams",
        href: "/teams",
        icon: UsersRound,
        roles: ["Admin"]
      },
      {
        title: "User Management",
        href: "/users",
        icon: UserPlus,
        roles: ["Admin", "TeamLead"]
      }
    ]
  },
  {
    title: "System",
    items: [
      {
        title: "Audit Logs",
        href: "/audit",
        icon: FileText,
        roles: ["Admin"]
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart,
        roles: ["Admin", "TeamLead", "Engineer"]
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["Admin"]
      }
    ]
  }
];

/**
 * Filter sidebar sections based on user role
 */
export function getFilteredSidebar(userRole: string): SidebarSection[] {
  return sidebarConfig
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(userRole))
    }))
    .filter(section => section.items.length > 0); // Remove empty sections
}
