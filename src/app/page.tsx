import { isAuthenticated } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { Hash, Globe, MapPin, XCircle, ChevronDown } from "lucide-react";
import { groupScraperUrlsByPortal, extractQueryLabel } from "@/lib/scraper-grouping";
import { RunScraperButton } from "@/components/RunScraperButton";
import { Suspense } from "react";
import { DashboardSkeleton, JobListSkeleton } from "@/components/DashboardSkeleton";
import { JobCard } from "@/components/JobCard";
import { groupJobs } from "@/lib/job-grouping";
import { type Job, type Category, type WorkPreference, type ScraperUrl } from "@prisma/client";

type JobWithRelations = Job & {
  categories: Category[];
  workPreferences: WorkPreference[];
  scraperUrl: ScraperUrl | null;
};

// In the latest Next.js App Router, searchParams are read asynchronously
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
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

  return (
    <Suspense key={currentCategorySlug ? `category:${currentCategorySlug}` : "all"} fallback={<DashboardSkeleton />}>
      <Dashboard currentCategorySlug={currentCategorySlug} />
    </Suspense>
  );
}

async function Dashboard({ currentCategorySlug }: { currentCategorySlug?: string }) {
  const [categories, workPreferences, scraperUrls] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { jobs: { where: { expiredAt: null } } }
        }
      }
    }),
    prisma.workPreference.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.scraperUrl.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeCategory = currentCategorySlug
    ? categories.find((c) => c.slug === currentCategorySlug)
    : null;

  // Await the lazy Prisma query inside JobList so the sidebar can stream first.
  const jobsPromise = prisma.job.findMany({
    where: {
      expiredAt: null,
      ...(activeCategory ? { categories: { some: { id: activeCategory.id } } } : {}),
    },
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

        {/* Scraping Sources grouped by portal — each portal is an expandable accordion */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Scraping Sources
          </h3>
          {scraperUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground italic px-2">No sources yet.</p>
          ) : (
            <div className="space-y-2">
              {groupScraperUrlsByPortal(scraperUrls).map((group) => (
                <details
                  key={group.portal}
                  className="group rounded-md border shadow-sm overflow-hidden"
                  open={group.urls.length === 1}
                >
                  {/* Portal header — acts as the accordion trigger */}
                  <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none list-none bg-card hover:bg-accent transition-colors">
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium truncate">{group.portal}</span>
                    {/* Badge: count of active variants */}
                    <span className="text-[10px] py-0.5 px-2 rounded-full font-bold bg-primary/10 text-primary">
                      {group.urls.filter((u) => u.isActive).length}/{group.urls.length}
                    </span>
                    {/* Status dot: green if any active, yellow if all inactive */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        group.anyActive ? "bg-green-500" : "bg-yellow-500"
                      }`}
                    />
                    {/* Chevron rotates 180° when the details element is open */}
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                  </summary>

                  {/* Variant list */}
                  <div className="divide-y border-t">
                    {group.urls.map((u) => (
                      <div
                        key={u.id}
                        className={`flex items-center gap-2 px-3 py-2 text-sm ${
                          u.isActive ? "bg-card" : "bg-muted/30"
                        }`}
                      >
                        {/* Clean query label without redundant portal prefix */}
                        <span className="flex-1 truncate text-muted-foreground">
                          {extractQueryLabel(u.name, group.portal, u.url)}
                        </span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            u.isActive ? "bg-green-500" : "bg-yellow-500"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
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

        <Suspense key={currentCategorySlug || "all"} fallback={<JobListSkeleton />}>
          <JobList jobsPromise={jobsPromise} />
        </Suspense>
      </div>
    </div>
  );
}

async function JobList({
  jobsPromise,
}: {
  jobsPromise: Promise<JobWithRelations[]>;
}) {
  const jobs = await jobsPromise;
  const groupedJobs = groupJobs(jobs);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  if (groupedJobs.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-12 text-center shadow-sm">
        <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          We couldn&apos;t find any job postings matching your current criteria. Wait for the next scraper run or adjust your categories.
        </p>
        <Link href="/settings">
          <Button variant="outline">Manage Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {groupedJobs.map((job) => (
        <JobCard key={job.id} job={job} now={now} />
      ))}
    </div>
  );
}
