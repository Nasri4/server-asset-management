"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { GlobalSearch } from "@/components/search/global-search";

import SidebarLogo from "@/app/hlogo.png";

function initials(email?: string) {
  const e = String(email ?? "").trim();
  if (!e) return "?";
  const left = e.split("@")[0] ?? e;
  const parts = left.split(/[._\-\s]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? left[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export function Topbar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-backdrop-filter:bg-white/80">
      <div className="flex h-14 w-full items-center gap-4 pl-0 pr-4 md:pr-6">
        {/* Logo and Text - Left Corner */}
        <div className="hidden md:flex items-center gap-2 pl-3">
          <Image 
            src={SidebarLogo} 
            alt="Logo" 
            width={110} 
            height={36} 
            priority 
            className="object-contain"
          />
          <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">Servers System</span>
        </div>

        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden hover:bg-slate-100" aria-label="Open navigation">
              <Menu className="h-4 w-4 text-slate-700" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="px-4 py-3">
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                <span className="inline-flex h-9 w-9 overflow-hidden rounded-md border border-sidebar-border bg-white">
                  <Image
                    src={SidebarLogo}
                    alt="SAM"
                    width={36}
                    height={36}
                    priority
                    className="object-contain"
                  />
                </span>
                <span>Servers System</span>
              </SheetTitle>
            </SheetHeader>
            <Separator className="bg-sidebar-border" />
            <div className="px-2 py-3">
              <SidebarNav pathname={pathname ?? ""} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex hover:bg-slate-100"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 text-slate-700" />
          ) : (
            <PanelLeftClose className="h-4 w-4 text-slate-700" />
          )}
        </Button>

        <div className="flex flex-1 items-center gap-2 md:gap-3">
          <div className="ml-auto flex items-center gap-1">
            {/* Global Search Button */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search (Ctrl+K)"
              onClick={() => window.dispatchEvent(new CustomEvent("sam:open-search"))}
              title="Search (Ctrl+K)"
              className="hover:bg-slate-100"
            >
              <Search className="h-4 w-4 text-slate-700" />
            </Button>

            <ThemeToggle />

            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative hover:bg-slate-100">
              <Bell className="h-4 w-4 text-slate-700" />
              <span
                aria-hidden
                className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500 shadow-sm"
                title="Notifications"
              />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2 hover:bg-slate-100">
                  <Avatar className="size-8 border border-slate-200">
                    <AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-800">
                      {initials(user?.fullName || user?.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm text-slate-700 md:inline">
                    {user?.fullName || user?.username || ""}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 border-slate-200 bg-white">
                <DropdownMenuLabel className="text-xs text-slate-500">Signed in</DropdownMenuLabel>
                <div className="px-2 pb-2 text-sm font-medium text-slate-900">
                  {user?.fullName || user?.username}
                </div>
                <DropdownMenuSeparator className="bg-slate-200" />
                <DropdownMenuItem 
                  onClick={logout}
                  className="text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900"
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Global Search Component */}
      <GlobalSearch />
    </header>
  );
}