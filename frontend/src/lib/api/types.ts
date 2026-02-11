export type Role = "Admin" | "TeamLead" | "Engineer" | (string & {});

export type AuthUser = {
  userId: number;
  username: string;
  teamId: number;
  fullName?: string;
  roles: Role[];
  permissions: string[];
};

export type ServerListItem = {
  server_id: number;
  server_code: string;
  hostname: string;
  server_type?: string;
  environment?: string;
  role?: string;
  status?: string;
  team_id?: number;
  team_name?: string;
  engineer_id?: number;
  engineer_name?: string;
  location_id?: number;
  site_name?: string;
  rack_id?: number;
  rack_code?: string;
  u_position?: string;
  install_date?: string;
  created_at?: string;
  updated_at?: string;
};

export type ServerDetailsResponse = {
  server: Record<string, unknown> | null;
  hardware: Record<string, unknown> | null;
  network: Array<Record<string, unknown>>;
  monitoring: Record<string, unknown> | null;
  security: Record<string, unknown> | null;
  incidents: Array<Record<string, unknown>>;
};
