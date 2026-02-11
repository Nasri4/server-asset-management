"use client";

import * as React from "react";

import type { AuthUser, Role } from "@/lib/api/types";
import { useAuth } from "@/components/auth/auth-provider";
import { can, hasRole } from "@/lib/rbac";
import { AccessDenied } from "@/components/settings/access-denied";

export function requireRole(user: AuthUser | null | undefined, roles: Role | Role[]) {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((r) => hasRole(user, r));
}

export function requirePermission(user: AuthUser | null | undefined, permission: string) {
  return can(user, permission);
}

export function RbacGuard({
  roles,
  permission,
  children,
  deniedTitle,
  deniedDescription,
}: {
  roles?: Role | Role[];
  permission?: string;
  children: React.ReactNode;
  deniedTitle?: string;
  deniedDescription?: string;
}) {
  const { user, loading } = useAuth();

  if (loading) return null;

  const okRole = roles ? requireRole(user, roles) : true;
  const okPerm = permission ? requirePermission(user, permission) : true;

  if (!okRole || !okPerm) {
    return (
      <AccessDenied
        title={deniedTitle ?? "Access denied"}
        description={
          deniedDescription ??
          "You don’t have permission to view this settings section. If you think this is a mistake, contact an administrator."
        }
      />
    );
  }

  return <>{children}</>;
}
