/**
 * USER MANAGEMENT PAGE
 * Admin: Manage all users across all teams
 * TeamLead: Manage engineers in their team only
 */

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { apiClient } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Edit, Trash2, Shield, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

interface User {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role_name: string;
  team_id: number | null;
  team_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface Team {
  team_id: number;
  team_name: string;
}

interface Role {
  role_id: number;
  role_name: string;
  description: string;
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const isAdmin = Boolean(currentUser?.roles?.includes("Admin"));
  const isTeamLead = Boolean(currentUser?.roles?.includes("TeamLead"));
  
  useEffect(() => {
    fetchData();
  }, []);
  
  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, teamsRes, rolesRes] = await Promise.allSettled([
        apiClient.get("/api/users"),
        apiClient.get("/api/teams"),
        apiClient.get("/api/users/roles"),
      ]);

      if (usersRes.status === "fulfilled") {
        setUsers(usersRes.value.data?.data?.users || []);
      } else {
        console.error("Failed to fetch users:", usersRes.reason);
        toast.error(
          usersRes.reason?.response?.data?.error?.message ||
            usersRes.reason?.response?.data?.message ||
            usersRes.reason?.message ||
            "Failed to load users"
        );
      }

      if (teamsRes.status === "fulfilled") {
        // Backend returns: { ok: true, data: Team[] }
        const teamsPayload = teamsRes.value.data;
        const teamsList =
          teamsPayload?.data?.teams ||
          teamsPayload?.data ||
          teamsPayload?.teams ||
          [];
        setTeams(Array.isArray(teamsList) ? teamsList : []);
      } else {
        console.error("Failed to fetch teams:", teamsRes.reason);
        toast.error(
          teamsRes.reason?.response?.data?.error?.message ||
            teamsRes.reason?.response?.data?.message ||
            teamsRes.reason?.message ||
            "Failed to load teams"
        );
      }

      if (rolesRes.status === "fulfilled") {
        setRoles(rolesRes.value.data?.data?.roles || []);
      } else {
        console.error("Failed to fetch roles:", rolesRes.reason);
      }
    } finally {
      setLoading(false);
    }
  }
  
  async function handleCreateUser(formData: any) {
    try {
      await apiClient.post("/api/users", formData);
      toast.success("User created successfully");
      setCreateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to create user"
      );
    }
  }
  
  async function handleToggleActive(userId: number, currentActive: boolean) {
    try {
      await apiClient.patch(`/api/users/${userId}`, {
        is_active: !currentActive
      });
      toast.success(currentActive ? "User deactivated" : "User activated");
      fetchData();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to update user"
      );
    }
  }
  
  async function handleDeleteUser(userId: number) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    try {
      await apiClient.delete(`/api/users/${userId}`);
      toast.success("User deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to delete user"
      );
    }
  }
  
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User Management"
          description="Loading users..."
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description={
          isAdmin
            ? "Manage all users and roles"
            : "Manage engineers in your team"
        }
        actions={
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user to the system</DialogDescription>
              </DialogHeader>
              <CreateUserForm
                teams={teams}
                roles={roles}
                isAdmin={isAdmin}
                currentUserTeamId={currentUser?.teamId ?? null}
                onSubmit={handleCreateUser}
                onCancel={() => setCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        }
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {isAdmin
              ? `${users.length} total users`
              : `${users.length} users in your team`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role_name)}>
                        {user.role_name}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.team_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(user.user_id, user.is_active)}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.user_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function getRoleBadgeVariant(roleName: string): "default" | "secondary" | "destructive" {
  switch (roleName) {
    case "Admin":
      return "destructive";
    case "TeamLead":
      return "default";
    case "Engineer":
      return "secondary";
    default:
      return "secondary";
  }
}

function CreateUserForm({
  teams,
  roles,
  isAdmin,
  currentUserTeamId,
  onSubmit,
  onCancel
}: {
  teams: Team[];
  roles: Role[];
  isAdmin: boolean;
  currentUserTeamId: number | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const NO_TEAM_VALUE = "__no_team__";
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    role_id: "",
    team_id: currentUserTeamId?.toString() || ""
  });

  const selectedRoleId = Number.parseInt(formData.role_id, 10);
  const selectedRole = roles.find((r) => r.role_id === selectedRoleId);
  const selectedRoleName = String(selectedRole?.role_name ?? "").trim().toLowerCase();

  // For Admins who don't have a team preselected, default to the first available team.
  // This prevents the "Please select a team" loop when teams are loaded but not chosen yet.
  useEffect(() => {
    if (!isAdmin) return;
    if (formData.team_id) return;
    if (!Array.isArray(teams) || teams.length === 0) return;
    setFormData((prev) => ({ ...prev, team_id: String(teams[0]!.team_id) }));
  }, [isAdmin, teams, formData.team_id]);
  
  const availableRoles = isAdmin
    ? roles // Admin can assign any role
    : roles.filter(r => r.role_name === "Engineer"); // TeamLead can only create Engineers
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const roleId = Number.parseInt(formData.role_id, 10);
    if (!formData.role_id || Number.isNaN(roleId)) {
      toast.error("Please select a role");
      return;
    }

    let teamId: number | null = null;
    if (formData.team_id && formData.team_id !== NO_TEAM_VALUE) {
      const parsedTeamId = Number.parseInt(formData.team_id, 10);
      if (Number.isNaN(parsedTeamId)) {
        toast.error("Invalid team selected");
        return;
      }
      teamId = parsedTeamId;
    }

    const selectedRole = roles.find((r) => r.role_id === roleId);
    const roleName = String(selectedRole?.role_name ?? "").trim().toLowerCase();

    // Backend rule: Engineer users must belong to a team.
    if (roleName === "engineer" && teamId === null) {
      toast.error("Please select a team for Engineer users");
      return;
    }

    const email = formData.email.trim();
    const payload: any = {
      username: formData.username.trim(),
      password: formData.password,
      full_name: formData.full_name.trim(),
      role_id: roleId,
      team_id: teamId,
    };

    // Important: do not send empty string for optional email.
    if (email) payload.email = email;

    onSubmit(payload);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username *</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="full_name">Full Name *</Label>
        <Input
          id="full_name"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="role_id">Role *</Label>
        <Select
          value={formData.role_id}
          onValueChange={(value) => setFormData({ ...formData, role_id: value })}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((role) => (
              <SelectItem key={role.role_id} value={role.role_id.toString()}>
                {role.role_name} - {role.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="team_id">
          Team {(selectedRoleName === "engineer" || !isAdmin) && "*"}
        </Label>
        <Select
          value={formData.team_id}
          onValueChange={(value) => setFormData({ ...formData, team_id: value })}
          disabled={!isAdmin && currentUserTeamId !== null}
          required={!isAdmin}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            {isAdmin && (
              <SelectItem value={NO_TEAM_VALUE}>No Team (Admin only)</SelectItem>
            )}
            {teams.length === 0 ? (
              <SelectItem value="__no_teams__" disabled>
                No teams available
              </SelectItem>
            ) : (
              teams.map((team) => (
                <SelectItem key={team.team_id} value={team.team_id.toString()}>
                  {team.team_name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create User</Button>
      </DialogFooter>
    </form>
  );
}
