import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoriesManager } from "@/components/CategoriesManager";
import { ScraperUrlsManager } from "@/components/ScraperUrlsManager";
import { WorkPreferencesManager } from "@/components/WorkPreferencesManager";
import { CvLibraryTab } from "@/components/CvLibraryTab";
import { listCvVersions } from "@/app/actions/cvActions";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsTabs } from "@/components/SettingsTabs";
import { AiAssistantSettings } from "@/components/AiAssistantSettings";
import { Hash, MapPin, Globe, Sparkles, FileText } from "lucide-react";

const TAB_TRIGGER_CLASS =
  "justify-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium data-active:bg-background data-active:text-foreground data-active:shadow-sm text-muted-foreground hover:text-foreground transition-all w-full text-left";

export default async function SettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const [categories, workPreferences, scraperUrls, cvVersions] =
    await Promise.all([
      prisma.category.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.workPreference.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.scraperUrl.findMany({
        orderBy: { createdAt: "desc" },
      }),
      listCvVersions(),
    ]);

  const aiApiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const isAiConfigured = Boolean(aiApiKey && aiApiKey.trim());
  const maskedApiKey =
    aiApiKey && aiApiKey.length > 8
      ? `${aiApiKey.slice(0, 4)}...${aiApiKey.slice(-4)}`
      : null;
  const aiModel =
    process.env.GEMINI_MODEL ||
    process.env.AI_MODEL ||
    "gemini-flash-lite-latest";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your job board preferences, categorization rules, and scraper
          targets.
        </p>
      </div>

      <SettingsTabs>
        <aside className="w-full md:w-64 shrink-0">
          <TabsList className="flex flex-row md:flex-col w-full h-auto p-1 bg-muted/60 rounded-xl gap-1 overflow-x-auto md:overflow-visible">
            <TabsTrigger value="categories" className={TAB_TRIGGER_CLASS}>
              <Hash className="w-4 h-4 shrink-0" />
              <span>Categories</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className={TAB_TRIGGER_CLASS}>
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Work Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="scraper" className={TAB_TRIGGER_CLASS}>
              <Globe className="w-4 h-4 shrink-0" />
              <span>Scraper Targets</span>
            </TabsTrigger>
            <TabsTrigger value="assistant" className={TAB_TRIGGER_CLASS}>
              <Sparkles className="w-4 h-4 shrink-0 text-primary" />
              <span>AI Assistant</span>
            </TabsTrigger>
            <TabsTrigger value="cv-library" className={TAB_TRIGGER_CLASS}>
              <FileText className="w-4 h-4 shrink-0" />
              <span>CV Library</span>
            </TabsTrigger>
          </TabsList>
        </aside>

        <div className="flex-1 w-full min-w-0">
          <TabsContent
            value="categories"
            className="space-y-4 m-0 outline-none"
          >
            <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Categorization Rules</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Define matching keywords and exclusions for automated job
                  categorization.
                </p>
              </div>
              <CategoriesManager initialCategories={categories} />
            </div>
          </TabsContent>

          <TabsContent
            value="preferences"
            className="space-y-4 m-0 outline-none"
          >
            <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  Location &amp; Work Mode
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Filter offers by employment type, remote work options, or
                  location.
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

          <TabsContent value="assistant" className="space-y-4 m-0 outline-none">
            <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">AI Assistant Settings</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure the Google Gemini model and credentials for the
                  conversational assistant.
                </p>
              </div>
              <AiAssistantSettings
                isConfigured={isAiConfigured}
                maskedApiKey={maskedApiKey}
                currentModel={aiModel}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="cv-library"
            className="space-y-4 m-0 outline-none"
          >
            <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">CV Library</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload and manage CV versions (PDF or DOCX, max 5 MB each)
                    for AI-powered job match analysis.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground shrink-0">
                  {cvVersions.length} / 10
                </span>
              </div>
              <CvLibraryTab initialCvs={cvVersions} />
            </div>
          </TabsContent>
        </div>
      </SettingsTabs>
    </div>
  );
}
