import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CategoriesManager } from "@/components/CategoriesManager";
import { ScraperUrlsManager } from "@/components/ScraperUrlsManager";
import { WorkPreferencesManager } from "@/components/WorkPreferencesManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("job_auth");

  if (!token) {
    redirect("/login");
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  const workPreferences = await prisma.workPreference.findMany({
    orderBy: { name: "asc" },
  });

  const scraperUrls = await prisma.scraperUrl.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your job board preferences, categorization rules, and scraper
          targets.
        </p>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="preferences">Work Preferences</TabsTrigger>
          <TabsTrigger value="scraper">Scraper URLs</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Categorization Rules</h2>
            <CategoriesManager initialCategories={categories} />
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Location & Work Mode</h2>
            <WorkPreferencesManager initialPreferences={workPreferences} />
          </div>
        </TabsContent>

        <TabsContent value="scraper" className="space-y-4">
          <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Scraper Targets</h2>
            <ScraperUrlsManager initialUrls={scraperUrls} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
