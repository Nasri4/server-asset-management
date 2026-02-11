"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { isEngineer } from "@/lib/rbac";
import { visibleSettingsNav } from "@/components/settings/settings-nav-items";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const nav = React.useMemo(() => visibleSettingsNav(user), [user]);

  React.useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (isEngineer(user)) {
      router.replace("/dashboard");
      return;
    }

    // If user can access settings but navigated to a section they can't see,
    // bounce them to the first visible section.
    const currentVisible = nav.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
    if (!currentVisible && nav.length > 0) {
      router.replace(nav[0].href);
    }
  }, [loading, nav, pathname, router, user]);

  if (loading) {
    return <div className="min-h-[60vh]" />;
  }

  // If auth guard hasn't redirected yet, fail closed.
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid w-full max-w-310 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen border-r bg-white/80 backdrop-blur md:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="px-6 py-6">
              <div className="text-base font-semibold tracking-tight text-slate-900">Elite Console</div>
            </div>
            <div className="flex-1 overflow-auto px-4 pb-6">
              <SettingsNav />
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-6 md:px-10 md:py-8">
          <div className="mb-5 flex items-center justify-between gap-3 md:hidden">
            <div className="text-sm font-semibold tracking-tight text-slate-900">Settings</div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-9">
                  <Menu className="mr-2 h-4 w-4" />
                  Sections
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <SheetHeader className="border-b px-4 py-3">
                  <SheetTitle>Settings</SheetTitle>
                </SheetHeader>
                <div className="p-4">
                  <SettingsNav variant="mobile" onNavigate={() => {}} />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="max-w-5xl">
            <SettingsSectionHeader />
            <div className="mt-7 animate-in fade-in slide-in-from-bottom-1 duration-200">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
