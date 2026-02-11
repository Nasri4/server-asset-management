"use client";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Operational reporting for servers, incidents, maintenance, and compliance.
          </p>
        </div>

        <Card className="enterprise-card">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base font-semibold">Coming Soon</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              This area will host exportable dashboards, SLA summaries, maintenance performance,
              and incident analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
