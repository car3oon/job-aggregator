import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoriesManager } from "@/components/CategoriesManager";
import { ScraperUrlsManager } from "@/components/ScraperUrlsManager";
import { WorkPreferencesManager } from "@/components/WorkPreferencesManager";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsTabs } from "@/components/SettingsTabs";
import { Hash, MapPin, Globe } from "lucide-react";

export default async function SettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const [categories, workPreferences, scraperUrls] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.workPreference.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.scraperUrl.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your job board preferences, categorization rules, and scraper targets.
        </p>
      </div>

      <SettingsTabs>
        <aside className="w-full md:w-64 shrink-0">
          <TabsList className="flex flex-row md:flex-col w-full h-auto p-1 bg-muted/60 rounded-xl gap-1 overflow-x-auto md:overflow-visible">
            <TabsTrigger
              value="categories"
              className="justify-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium data-active:bg-background data-active:text-foreground data-active:shadow-sm text-muted-foreground hover:text-foreground transition-all w-full text-left"
            >
              <Hash className="w-4 h-4 shrink-0" />
              <span>Categories</span>
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className="justify-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium data-active:bg-background data-active:text-foreground data-active:shadow-sm text-muted-foreground hover:text-foreground transition-all w-full text-left"
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Work Preferences</span>
            </TabsTrigger>
            <TabsTrigger
              value="scraper"
              className="justify-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium data-active:bg-background data-active:text-foreground data-active:shadow-sm text-muted-foreground hover:text-foreground transition-all w-full text-left"
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Scraper Targets</span>
            </TabsTrigger>
          </TabsList>
        </aside>

        <div className="flex-1 w-full min-w-0">
          <TabsContent value="categories" className="space-y-4 m-0 outline-none">
            <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Categorization Rules</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Define matching keywords and exclusions for automated job categorization.
                </p>
              </div>
              <CategoriesManager initialCategories={categories} />
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4 m-0 outline-none">
            <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Location & Work Mode</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Filter offers by employment type, remote work options, or location.
                </p>
              </div>
              <WorkPreferencesManager initialPreferences={workPreferences} />
            </div>
          </TabsContent>

          <TabsContent value="scraper" className="space-y-4 m-0 outline-none">
            <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Scraper Targets</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure target portal URLs to scrape during scheduled runs.
                </p>
              </div>
              <ScraperUrlsManager initialUrls={scraperUrls} />
            </div>
          </TabsContent>
        </div>
      </SettingsTabs>
    </div>
  );
}
