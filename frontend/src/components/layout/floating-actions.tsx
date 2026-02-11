"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Server, TriangleAlert, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ActionItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const DEFAULT_ACTIONS: ActionItem[] = [
  { label: "New Server", href: "/servers/new", icon: <Server className="h-4 w-4" /> },
  { label: "Log Incident", href: "/incidents#create", icon: <TriangleAlert className="h-4 w-4" /> },
  { label: "Create Maintenance", href: "/maintenance#create", icon: <Wrench className="h-4 w-4" /> },
];

export function FloatingActions({ actions = DEFAULT_ACTIONS }: { actions?: ActionItem[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="premium"
            size="icon-lg"
            className="sam-hover-lift rounded-2xl shadow-md"
            aria-label="Quick actions"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Quick actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actions.map((a) => (
            <DropdownMenuItem key={a.href} asChild>
              <Link href={a.href} className="flex items-center gap-2">
                {a.icon}
                <span>{a.label}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
