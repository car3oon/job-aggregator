import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { SettingsNav } from "@/components/SettingsNav";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your job board preferences, categorization rules, and scraper
          targets.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start w-full">
        <aside className="w-full md:w-64 shrink-0">
          <SettingsNav />
        </aside>

        <div className="flex-1 w-full min-w-0">{children}</div>
      </div>
    </div>
  );
}
