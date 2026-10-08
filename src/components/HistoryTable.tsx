"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  PlayCircle,
  CalendarClock,
  AlertTriangle,
  ExternalLink,
  X,
  FileText,
} from "lucide-react";
import { getTimeAgo, formatDate } from "@/lib/utils";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { Button } from "@/components/ui/button";

export interface HistoryItem {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  status: string;
  trigger: string;
  jobsAdded: number;
  jobsUpdated: number;
  logs: string | null;
  error: string | null;
}

const SCRAPER_WORKFLOW_URL = "https://github.com/car3oon/job-aggregator/actions/workflows/scraper.yml";

function getSpecificRunUrl(logs: string | null): string | null {
  if (logs) {
    const match = logs.match(/https:\/\/github\.com\/[^\s]+\/actions\/runs\/\d+(\/job\/\d+)?/);
    if (match) return match[0];
  }
  return null;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "SUCCESS":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "FAILED":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "PARTIAL":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "RUNNING":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function HistoryTable({ history }: { history: HistoryItem[] }) {
  const [selectedRun, setSelectedRun] = useState<HistoryItem | null>(null);

  // Close modal when pressing Escape key
  useEscapeKey(() => setSelectedRun(null), selectedRun !== null);

  const selectedDuration = selectedRun?.endedAt
    ? `${Math.round((new Date(selectedRun.endedAt).getTime() - new Date(selectedRun.startedAt).getTime()) / 1000)}s`
    : "-";

  const specificRunUrl = selectedRun ? getSpecificRunUrl(selectedRun.logs) : null;

  return (
    <>
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
                  const startedDate = new Date(run.startedAt);
                  const endedDate = run.endedAt ? new Date(run.endedAt) : null;
                  const durationStr = endedDate
                    ? `${Math.round((endedDate.getTime() - startedDate.getTime()) / 1000)}s`
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
                          <span className="font-medium">{formatDate(startedDate)}</span>
                          <span className="text-xs text-muted-foreground">
                            {getTimeAgo(startedDate)}
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
                        <button
                          type="button"
                          onClick={() => setSelectedRun(run)}
                          className="text-xs font-medium text-primary hover:underline cursor-pointer"
                        >
                          View logs
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Logs Modal */}
      {selectedRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedRun(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logs-modal-title"
            className="bg-card text-card-foreground border rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <h3 id="logs-modal-title" className="text-lg font-semibold">
                  Execution Logs
                </h3>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${getStatusBadgeClass(
                    selectedRun.status
                  )}`}
                >
                  {selectedRun.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {specificRunUrl && (
                  <a
                    href={specificRunUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors border"
                    title="Open this specific job execution in GitHub Actions"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View this Job</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedRun(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border">
                <div>
                  <span className="font-medium text-foreground">Trigger:</span> {selectedRun.trigger}
                </div>
                <div>
                  <span className="font-medium text-foreground">Started:</span>{" "}
                  {formatDate(new Date(selectedRun.startedAt))} ({getTimeAgo(new Date(selectedRun.startedAt))})
                </div>
                <div>
                  <span className="font-medium text-foreground">Duration:</span> {selectedDuration}
                </div>
                <div>
                  <span className="font-medium text-foreground">Added:</span> +{selectedRun.jobsAdded}
                </div>
                <div>
                  <span className="font-medium text-foreground">Updated:</span> {selectedRun.jobsUpdated}
                </div>
              </div>

              {selectedRun.error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">
                    Error Details
                  </h4>
                  <pre className="text-xs font-mono text-destructive whitespace-pre-wrap break-all">
                    {selectedRun.error}
                  </pre>
                </div>
              )}

              <div>
                <pre className="text-xs font-mono bg-muted/80 p-4 rounded-lg whitespace-pre-wrap leading-relaxed overflow-x-auto text-foreground max-h-[50vh]">
                  {selectedRun.logs || "No logs available."}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20 text-xs">
              <div>
                <a
                  href={SCRAPER_WORKFLOW_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium"
                >
                  All scraper runs on GitHub <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRun(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
