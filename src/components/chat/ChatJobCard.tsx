"use client";

import { useState, useTransition } from "react";
import {
  Globe,
  ExternalLink,
  Check,
  X,
  Bookmark,
  Send,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { updateJobApplicationStatus, type ApplicationStatus } from "@/app/actions/job";
import { toast } from "@/components/ui/toast";
import type { AssistantJobItem } from "@/lib/ai-assistant";

export interface ChatJobCardProps {
  job: AssistantJobItem;
}

export function ChatJobCard({ job }: ChatJobCardProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ApplicationStatus>(job.applicationStatus || "INBOX");
  const [appliedAt, setAppliedAt] = useState<string | null>(job.appliedAt || null);

  const handleStatusChange = (newStatus: ApplicationStatus) => {
    const prevStatus = status;
    const prevAppliedAt = appliedAt;
    const nowIso = new Date().toISOString();

    setStatus(newStatus);
    setAppliedAt(newStatus === "APPLIED" ? nowIso : null);

    startTransition(async () => {
      const res = await updateJobApplicationStatus(job.id, newStatus);
      if (res?.error) {
        setStatus(prevStatus);
        setAppliedAt(prevAppliedAt);
        toast.add({
          type: "error",
          title: "Update failed",
          description: res.error,
        });
      } else {
        toast.add({
          type: "success",
          title: "Status updated",
          description: `Offer marked as ${newStatus.toLowerCase()}.`,
        });
      }
    });
  };

  const appliedDateStr = appliedAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Warsaw",
      }).format(new Date(appliedAt))
    : null;

  return (
    <div className="group rounded-lg border border-border/80 bg-background/90 p-3 shadow-xs transition-colors hover:border-primary/50 hover:bg-background">
      {/* Header: Title and Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary hover:underline line-clamp-2"
          title={job.title}
        >
          <span>{job.title}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
        </a>

        {/* Status Badge */}
        <div className="shrink-0">
          {status === "APPLIED" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-2.5 w-2.5" />
              Applied{appliedDateStr ? ` (${appliedDateStr})` : ""}
            </span>
          )}
          {status === "SAVED" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <Bookmark className="h-2.5 w-2.5 fill-amber-500/30" />
              Saved
            </span>
          )}
          {status === "REJECTED" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
              <X className="h-2.5 w-2.5" />
              Rejected
            </span>
          )}
          {status === "INBOX" && (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Inbox
            </span>
          )}
        </div>
      </div>

      {/* Company, Source, and Metadata */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {job.company && <span className="font-medium text-foreground/80">{job.company}</span>}
        {job.company && <span>•</span>}
        <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
          <Globe className="h-2.5 w-2.5" />
          {job.source}
        </span>
        {job.categories && job.categories.length > 0 && (
          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {job.categories[0]}
          </span>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-border/50 pt-2">
        {status !== "SAVED" && status !== "APPLIED" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStatusChange("SAVED")}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-400"
            title="Save offer for later"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Bookmark className="h-3 w-3 fill-amber-500/30" />
            )}
            <span>Save</span>
          </button>
        )}

        {status !== "APPLIED" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStatusChange("APPLIED")}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
            title="Mark offer as applied"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            <span>Apply</span>
          </button>
        )}

        {status !== "REJECTED" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStatusChange("REJECTED")}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
            title="Mark offer as rejected"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            <span>Reject</span>
          </button>
        )}

        {(status === "SAVED" || status === "APPLIED" || status === "REJECTED") && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStatusChange("INBOX")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/80 px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            title="Restore back to inbox"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
