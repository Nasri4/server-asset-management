type OrgSettings = {
  name: string;
  logo_url?: string | null;
  timezone: string;
  default_theme: "system" | "light" | "dark";
};

type NotificationSettings = {
  email_enabled: boolean;
  smtp_host?: string | null;
  smtp_user?: string | null;
  from_email?: string | null;
  team_notifications_enabled?: boolean;
};

type SecuritySettings = {
  min_password_length: number;
  require_numbers: boolean;
  require_symbols: boolean;
  session_timeout_minutes: number;
  login_attempt_limit: number;
};

type MaintenancePolicySettings = {
  default_duration_minutes: number;
  approval_required: boolean;
};

type AuditSettings = {
  retention_days: number;
  auto_clean_enabled: boolean;
};

type ConfigKey = "server-types" | "server-statuses" | "environment-types" | "tags" | "maintenance-types";

type ConfigItem = {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string | null;
};

type RbacRole = { role: "Admin" | "TeamLead" | "Engineer"; label: string };

type RbacPermission = {
  key: string;
  label: string;
  description?: string | null;
  group?: string | null;
};

type PermissionMatrix = {
  roles: RbacRole[];
  permissions: RbacPermission[];
  grants: Record<string, Record<string, boolean>>;
};

type Store = {
  settings: {
    organization: OrgSettings;
    notifications: NotificationSettings;
    security: SecuritySettings;
    maintenance: MaintenancePolicySettings;
    audit: AuditSettings;
  };
  config: Record<ConfigKey, ConfigItem[]>;
  rbac: {
    matrix: PermissionMatrix;
  };
  _seq: {
    configId: number;
  };
};

function defaultMatrix(): PermissionMatrix {
  const roles: RbacRole[] = [
    { role: "Admin", label: "Admin" },
    { role: "TeamLead", label: "Team Lead" },
    { role: "Engineer", label: "Engineer" },
  ];

  const permissions: RbacPermission[] = [
    { key: "settings.manage", label: "Manage settings", group: "System", description: "Update organization and system settings." },
    { key: "teams.manage", label: "Manage teams & users", group: "Access", description: "Create users and manage team membership." },
    { key: "applications.read", label: "Read applications", group: "Applications" },
    { key: "applications.manage", label: "Manage applications", group: "Applications" },
    { key: "servers.read", label: "Read servers", group: "Servers" },
    { key: "servers.update", label: "Update servers", group: "Servers" },
    { key: "audit.read", label: "Read audit logs", group: "Governance" },
  ];

  const grants: PermissionMatrix["grants"] = {};
  for (const p of permissions) {
    grants[p.key] = {
      Admin: true,
      TeamLead: ["settings.manage"].includes(p.key) ? false : true,
      Engineer: ["servers.read", "applications.read"].includes(p.key),
    };
  }

  return { roles, permissions, grants };
}

function defaults(): Store {
  return {
    settings: {
      organization: {
        name: "",
        logo_url: null,
        timezone: "UTC",
        default_theme: "system",
      },
      notifications: {
        email_enabled: true,
        smtp_host: null,
        smtp_user: null,
        from_email: null,
        team_notifications_enabled: true,
      },
      security: {
        min_password_length: 10,
        require_numbers: true,
        require_symbols: false,
        session_timeout_minutes: 240,
        login_attempt_limit: 8,
      },
      maintenance: {
        default_duration_minutes: 60,
        approval_required: true,
      },
      audit: {
        retention_days: 180,
        auto_clean_enabled: true,
      },
    },
    config: {
      "server-types": [],
      "server-statuses": [],
      "environment-types": [],
      tags: [],
      "maintenance-types": [],
    },
    rbac: {
      matrix: defaultMatrix(),
    },
    _seq: {
      configId: 1,
    },
  };
}

export function getStore(): Store {
  const g = globalThis as unknown as { __samMemStore?: Store };
  if (!g.__samMemStore) g.__samMemStore = defaults();
  return g.__samMemStore;
}

export const CONFIG_KEYS: ConfigKey[] = [
  "server-types",
  "server-statuses",
  "environment-types",
  "tags",
  "maintenance-types",
];

export type { Store, ConfigKey, ConfigItem, PermissionMatrix, RbacPermission };
