import { prisma } from "@/lib/prisma";
import { getTimeAgo, formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, PlayCircle, CalendarClock, AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const history = await prisma.scrapeHistory.findMany({
    orderBy: { startedAt: 'desc' },
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

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Trigger</th>
                <th className="px-6 py-4 font-medium">Started</th>
                <th className="px-6 py-4 font-medium">Duration</th>
                <th className="px-6 py-4 font-medium text-right">Added</th>
                <th className="px-6 py-4 font-medium text-right">Updated</th>
                <th className="px-6 py-4 font-medium text-center">Logs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No runs recorded yet. Trigger the scraper to see logs here.
                  </td>
                </tr>
              ) : (
                history.map((run) => {
                  const durationStr = run.endedAt 
                    ? `${Math.round((run.endedAt.getTime() - run.startedAt.getTime()) / 1000)}s`
                    : "-";
                  
                  return (
                    <tr key={run.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {run.status === "SUCCESS" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          {run.status === "FAILED" && <XCircle className="w-4 h-4 text-red-500" />}
                          {run.status === "PARTIAL" && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                          {run.status === "RUNNING" && <Clock className="w-4 h-4 text-blue-500 animate-pulse" />}
                          <span className="font-medium">{run.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {run.trigger === "MANUAL" ? (
                            <PlayCircle className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <CalendarClock className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span>{run.trigger}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium">{formatDate(run.startedAt)}</span>
                          <span className="text-xs text-muted-foreground">
                            {getTimeAgo(run.startedAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {durationStr}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-green-600 dark:text-green-400">
                        +{run.jobsAdded}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-muted-foreground">
                        {run.jobsUpdated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <details className="cursor-pointer group">
                          <summary className="text-xs font-medium text-primary hover:underline outline-none">
                            View
                          </summary>
                          <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-[80vw] max-w-2xl bg-popover text-popover-foreground border shadow-xl rounded-lg p-4 z-50 text-left overflow-auto max-h-[50vh] hidden group-open:block">
                            <h4 className="font-semibold mb-2">Execution Logs</h4>
                            <pre className="text-[11px] font-mono bg-muted p-4 rounded-md whitespace-pre-wrap">
                              {run.logs || "No logs available."}
                            </pre>
                            {run.error && (
                              <div className="mt-4 border-t pt-4">
                                <h4 className="font-semibold text-destructive mb-2">Error Details</h4>
                                <pre className="text-[11px] font-mono text-destructive-foreground bg-destructive p-4 rounded-md whitespace-pre-wrap">
                                  {run.error}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
