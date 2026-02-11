import type { Metadata } from "next";

import { FadeIn } from "@/components/motion/fade-in";
import { SettingsShell } from "@/components/settings/settings-shell";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your organization settings, team permissions, and system configurations.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FadeIn>
      <SettingsShell>{children}</SettingsShell>
    </FadeIn>
  );
}
