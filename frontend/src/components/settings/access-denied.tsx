"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AccessDenied({
  title = "Access denied",
  description = "You don’t have permission to view this area.",
  backHref,
}: {
  title?: string;
  description?: string;
  backHref?: string;
}) {
  const router = useRouter();

  return (
    <Card className="border-muted/70 bg-card/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
            <ShieldAlert className="h-4.5 w-4.5 text-muted-foreground" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (backHref) {
                router.push(backHref);
              } else {
                router.back();
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
