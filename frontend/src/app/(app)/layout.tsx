import type { Metadata } from "next";

import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "SAM",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <AuthGuard>
          <AppShell>{children}</AppShell>
        </AuthGuard>
      </AuthProvider>
    </QueryProvider>
  );
}
