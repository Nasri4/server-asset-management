"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-muted-foreground">
            An unexpected error occurred while loading this page.
          </div>
          <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            {error?.message ?? String(error)}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
