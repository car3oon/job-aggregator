import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkPreferencesManager } from "@/components/WorkPreferencesManager";

export default async function WorkPreferencesSettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const workPreferences = await prisma.workPreference.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Location &amp; Work Mode</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Filter offers by employment type, remote work options, or location.
        </p>
      </div>
      <WorkPreferencesManager initialPreferences={workPreferences} />
    </div>
  );
}
