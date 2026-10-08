import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HistoryTable } from "@/components/HistoryTable";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const history = await prisma.scrapeHistory.findMany({
    orderBy: { startedAt: "desc" },
    take: 50, // Limit to last 50 runs to keep UI fast
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scraper History</h1>
          <p className="text-muted-foreground">Audit log of recent scraper executions.</p>
        </div>
      </div>

      <HistoryTable history={history} />
    </div>
  );
}
