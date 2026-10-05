import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { Hash, Globe, MapPin, XCircle } from "lucide-react";

// In the latest Next.js App Router, searchParams are read asynchronously
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.has("job_auth");

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
  });

  const workPreferences = await prisma.workPreference.findMany({
    orderBy: { name: "asc" },
  });

  const scraperUrls = await prisma.scraperUrl.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Find the active category (if the URL contains ?category=...)
  const activeCategory = currentCategorySlug
    ? categories.find((c) => c.slug === currentCategorySlug)
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-500">
      <aside className="space-y-8 lg:col-span-1">
        
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
                      <span className="truncate">{cat.name}</span>
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

        <div className="bg-card border rounded-xl p-12 text-center shadow-sm">
          <h3 className="text-xl font-semibold mb-2">
            {activeCategory ? `Curating the best offers for ${activeCategory.name}...` : "Ready for Jobs!"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Your dashboard structure is fully set up. Once the scraper starts
            running, matching job postings will appear right here.
          </p>
          <Link href="/settings">
            <Button variant="outline">Manage Settings</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
