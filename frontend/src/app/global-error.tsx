"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <div className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-10">
          <div className="text-2xl font-semibold tracking-tight">Critical error</div>
          <div className="text-sm text-muted-foreground">
            A fatal error occurred.
          </div>
          <pre className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            {error?.message ?? String(error)}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
