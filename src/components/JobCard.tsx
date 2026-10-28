"use client";

import { useState, useTransition } from "react";
import {
  Globe,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Send,
  Check,
  X,
  RotateCcw,
  Bookmark,
} from "lucide-react";
import type { GroupedJob } from "@/lib/job-grouping";
import { updateJobApplicationStatus, type ApplicationStatus } from "@/app/actions/job";

export function JobCard({ job, now }: { job: GroupedJob; now: number }) {
  const [showVariants, setShowVariants] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ApplicationStatus>(
    job.applicationStatus || "INBOX"
  );
  const [appliedAt, setAppliedAt] = useState<Date | string | null>(
    job.appliedAt || null
  );

  const isNew = now - new Date(job.createdAt).getTime() < 14 * 60 * 60 * 1000;

  const appliedDateStr = appliedAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Warsaw",
      }).format(new Date(appliedAt))
    : null;

  const handleStatusChange = (newStatus: ApplicationStatus) => {
    const prevStatus = status;
    const prevAppliedAt = appliedAt;
    const newAppliedAt = newStatus === "APPLIED" ? new Date() : null;

    setStatus(newStatus);
    setAppliedAt(newAppliedAt);

    startTransition(async () => {
      const res = await updateJobApplicationStatus(job.id, newStatus);
      if (res?.error) {
        setStatus(prevStatus);
        setAppliedAt(prevAppliedAt);
      }
    });
  };

  return (
    <div className="bg-card hover:bg-accent/40 border rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="text-lg font-semibold hover:text-primary transition-colors hover:underline inline-flex items-center gap-1.5"
            >
              {job.title}
              <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </a>
            {isNew && (
              <span className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                New
              </span>
            )}
            {status === "SAVED" && (
              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                <Bookmark className="w-3 h-3 fill-amber-500/30" />
                Saved
              </span>
            )}
            {status === "APPLIED" && (
              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                <Check className="w-3 h-3" />
                Applied{appliedDateStr ? ` • ${appliedDateStr}` : ""}
              </span>
            )}
            {status === "REJECTED" && (
              <span className="inline-flex items-center gap-1 bg-destructive/10 text-destructive border border-destructive/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                <X className="w-3 h-3" />
                Rejected
              </span>
            )}
          </div>

          {job.company && <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Multi-source Badges (Level A) */}
            {job.sources.map((s) => (
              <a
                key={`${s.source}:${s.url}`}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2 py-1 rounded-md transition-colors gap-1"
                title={`Open on ${s.source}`}
              >
                <Globe className="w-3 h-3" />
                <span>{s.source}</span>
              </a>
            ))}

            <span className="inline-flex items-center text-xs font-medium bg-secondary/60 text-secondary-foreground px-2 py-1 rounded-md">
              <Clock className="w-3 h-3 mr-1" />
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Warsaw",
              }).format(new Date(job.createdAt))}
            </span>

            {job.workPreferences.map((pref) => (
              <span
                key={pref.id}
                className="inline-flex items-center text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-md"
              >
                <MapPin className="w-3 h-3 mr-1" />
                {pref.name}
              </span>
            ))}
          </div>
        </div>

        {/* Categories & Actions */}
        <div className="flex flex-col items-end gap-2.5 shrink-0 max-w-[45%]">
          {/* Categories */}
          {job.categories.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {job.categories.map((cat) => (
                <span
                  key={cat.id}
                  className="text-[10px] uppercase font-bold tracking-wider bg-muted text-muted-foreground px-2.5 py-1 rounded-full whitespace-nowrap"
                >
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          {/* Status Actions */}
          <div className="flex items-center gap-1.5">
            {status !== "SAVED" && status !== "APPLIED" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange("SAVED")}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 text-muted-foreground transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                title="Save for later"
              >
                <Bookmark className="w-3 h-3" />
                <span>Save</span>
              </button>
            )}
            {status !== "APPLIED" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange("APPLIED")}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 text-muted-foreground transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                title="Mark as Applied"
              >
                <Send className="w-3 h-3" />
                <span>Applied</span>
              </button>
            )}
            {status !== "REJECTED" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange("REJECTED")}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-muted-foreground transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                title="Reject offer"
              >
                <X className="w-3 h-3" />
                <span>Reject</span>
              </button>
            )}
            {status !== "INBOX" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange("INBOX")}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                title="Move back to Inbox"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Inbox</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Similar Variants (Level B) */}
      {job.relatedVariants.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowVariants(!showVariants)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
          >
            {showVariants ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>
              {job.relatedVariants.length}{" "}
              {job.relatedVariants.length === 1 ? "related role" : "related roles"} at {job.company || "this company"}
            </span>
          </button>

          {showVariants && (
            <div className="mt-3 space-y-2 pl-2 border-l-2 border-primary/30">
              {job.relatedVariants.map((variant) => (
                <div key={variant.id} className="flex flex-wrap items-center justify-between gap-2 text-xs py-1">
                  <a
                    href={variant.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:text-primary transition-colors hover:underline inline-flex items-center gap-1"
                  >
                    {variant.title}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>

                  <div className="flex flex-wrap items-center gap-2">
                    {variant.categories?.map((cat) => (
                      <span
                        key={cat.id}
                        className="text-[9px] uppercase font-bold tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
                      >
                        {cat.name}
                      </span>
                    ))}
                    {variant.sources.map((source) => (
                      <a
                        key={`${source.source}:${source.url}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open on ${source.source}`}
                        className="inline-flex items-center text-[10px] bg-secondary hover:bg-secondary/80 text-secondary-foreground px-1.5 py-0.5 rounded"
                      >
                        {source.source}
                      </a>
                    ))}
                    {variant.workPreferences.map((pref) => (
                      <span key={pref.id} className="text-[10px] text-muted-foreground">
                        {pref.name}
                      </span>
                    ))}
                    <span className="text-[10px] text-muted-foreground">
                      {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Warsaw" }).format(
                        new Date(variant.createdAt)
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
