import { isAuthenticated } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { Hash, Globe, MapPin, XCircle, Clock } from "lucide-react";
import { RunScraperButton } from "@/components/RunScraperButton";

// In the latest Next.js App Router, searchParams are read asynchronously
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const isLoggedIn = await isAuthenticated();

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-6">
          Preview Release 1.0
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-8">
          Your job offers, <br />
          <span className="text-primary">in one place.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed">
          Job Aggregator automatically collects, filters, and categorizes
          job postings from popular portals, creating your personalized dashboard.
        </p>
        <Link href="/login">
          <Button
            size="lg"
            className="text-lg px-8 h-14 rounded-xl shadow-lg hover:shadow-primary/25 transition-all"
          >
            Go to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // Unwrapping searchParams (required in newer Next.js versions)
  const params = await searchParams;
  const currentCategorySlug = params.category;

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { jobs: true }
      }
    }
  });

  const workPreferences = await prisma.workPreference.findMany({
    orderBy: { name: "asc" },
  });

  const scraperUrls = await prisma.scraperUrl.findMany({
    orderBy: { createdAt: "desc" },
  });

  const activeCategory = currentCategorySlug
    ? categories.find((c) => c.slug === currentCategorySlug)
    : null;

  // Fetch jobs for the active category (or all if none selected)
  const jobs = await prisma.job.findMany({
    where: activeCategory ? {
      categories: { some: { id: activeCategory.id } }
    } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      categories: true,
      workPreferences: true,
      scraperUrl: true,
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-500">
      <aside className="space-y-8 lg:col-span-1">
        
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <RunScraperButton />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Categories
          </h3>
          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground italic px-2">
                No categories yet.
              </p>
            ) : (
              categories.map((cat) => {
                const isActive = cat.slug === currentCategorySlug;
                return (
                  <Link
                    key={cat.id}
                    href={`/?category=${cat.slug}`}
                    className={`flex flex-col gap-1 px-3 py-2.5 rounded-md transition-colors border shadow-sm ${
                      isActive 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-card hover:bg-accent hover:text-accent-foreground border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <Hash className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`} />
                      <span className="truncate flex-1">{cat.name}</span>
                      <span className={`ml-auto text-[10px] py-0.5 px-2 rounded-full font-bold ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                        {cat._count.jobs}
                      </span>
                    </div>
                    {cat.keywords.length > 0 && (
                      <div className={`text-[10px] pl-6 truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground opacity-70"}`}>
                        Inc: {cat.keywords.join(", ")}
                      </div>
                    )}
                    {cat.excluded.length > 0 && (
                      <div className={`text-[10px] pl-6 truncate ${isActive ? "text-primary-foreground/70" : "text-destructive/80"}`}>
                        Exc: {cat.excluded.join(", ")}
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Work Preferences
          </h3>
          <div className="space-y-2">
            {workPreferences.map((pref) => (
              <div key={pref.id} className={`flex flex-col gap-1 px-3 py-2.5 rounded-md border shadow-sm transition-colors ${pref.isActive ? "bg-card" : "bg-muted/30"}`}>
                <div className="flex items-center gap-2 font-medium text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{pref.name}</span>
                </div>
                <div className="flex items-center justify-between pl-6 mt-0.5">
                  <div className="text-[10px] text-muted-foreground truncate opacity-70 pr-2">
                    {pref.keywords.join(", ")}
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pref.isActive ? "bg-green-500" : "bg-yellow-500"}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Scraping Sources
          </h3>
          <div className="space-y-2">
            {scraperUrls.map((url) => (
              <div key={url.id} className={`flex items-start gap-3 px-3 py-2.5 text-sm rounded-md border shadow-sm transition-colors ${url.isActive ? "bg-card" : "bg-muted/30"}`}>
                <Globe className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="overflow-hidden w-full">
                  <p className="font-medium truncate">{url.name || "Unnamed Source"}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground truncate pr-2">
                      {new URL(url.url).hostname.replace('www.', '')}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${url.isActive ? "bg-green-500" : "bg-yellow-500"}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </aside>

      <div className="lg:col-span-3 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            {activeCategory ? `Job Board: ${activeCategory.name}` : "Job Board: All"}
          </h1>
          {activeCategory && (
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <XCircle className="h-4 w-4 mr-2" />
                Clear filter
              </Button>
            </Link>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center shadow-sm">
            <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              We couldn&apos;t find any job postings matching your current criteria. Wait for the next scraper run or adjust your categories.
            </p>
            <Link href="/settings">
              <Button variant="outline">Manage Settings</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {jobs.map((job) => {
              const isNew = now - new Date(job.createdAt).getTime() < 14 * 60 * 60 * 1000; // 14 hours
              return (
              <a 
                key={job.id} 
                href={job.url} 
                target="_blank" 
                rel="noreferrer"
                className="block bg-card hover:bg-accent/50 border rounded-xl p-5 shadow-sm transition-all hover:shadow-md group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{job.title}</h3>
                      {isNew && (
                        <span className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                          New
                        </span>
                      )}
                    </div>
                    {job.company && <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="inline-flex items-center text-xs font-medium bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                        <Globe className="w-3 h-3 mr-1" />
                        {job.source}
                      </span>
                      <span className="inline-flex items-center text-xs font-medium bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(job.createdAt))}
                      </span>
                      {job.workPreferences.map(pref => (
                        <span key={pref.id} className="inline-flex items-center text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-md">
                          <MapPin className="w-3 h-3 mr-1" />
                          {pref.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 max-w-[50%]">
                    {job.categories.map(cat => (
                      <span key={cat.id} className="text-[10px] uppercase font-bold tracking-wider bg-muted text-muted-foreground px-2.5 py-1 rounded-full whitespace-nowrap">
                        {cat.name}
                      </span>
                    ))}
                  </div>
                </div>
              </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
