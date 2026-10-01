import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { Hash, Globe } from "lucide-react";

export default async function Home() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.has("job_auth");

  // If not logged in, show the landing page
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
          Job Aggregator automatically collects, filters, and categorizes job
          postings from popular portals, creating your personalized dashboard.
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

  // If logged in, fetch data for the dashboard sidebar
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  const scraperUrls = await prisma.scraperUrl.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-500">
      {/* Sidebar Navigation */}
      <aside className="space-y-8 lg:col-span-1">
        {/* Categories Section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Categories
          </h3>
          <div className="space-y-1">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground italic px-2">
                No categories yet.
              </p>
            ) : (
              categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/?category=${cat.slug}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary text-secondary-foreground transition-colors"
                >
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  {cat.name}
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Scraping Sources Section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Scraping Sources
          </h3>
          <div className="space-y-2">
            {scraperUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground italic px-2">
                No sources yet.
              </p>
            ) : (
              scraperUrls.map((url) => (
                <div
                  key={url.id}
                  className="flex items-start gap-3 px-3 py-2.5 text-sm rounded-md border bg-card shadow-sm"
                >
                  <Globe className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="overflow-hidden">
                    <p className="font-medium truncate">
                      {url.name || "Unnamed Source"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          url.isActive ? "bg-green-500" : "bg-yellow-500"
                        }`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {url.isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:col-span-3 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Job Board</h1>
        </div>

        <div className="bg-card border rounded-xl p-12 text-center shadow-sm">
          <h3 className="text-xl font-semibold mb-2">Ready for Jobs!</h3>
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
