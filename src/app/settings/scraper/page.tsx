import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ScraperUrlsManager } from "@/components/ScraperUrlsManager";

export default async function ScraperSettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const scraperUrls = await prisma.scraperUrl.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Scraper Targets</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure target portal URLs to scrape during scheduled runs.
        </p>
      </div>
      <ScraperUrlsManager initialUrls={scraperUrls} />
    </div>
  );
}
