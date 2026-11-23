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
  Sparkles,
  RefreshCw,
  AlertCircle,
  Briefcase,
  DollarSign,
  Building2,
  Wifi,
} from "lucide-react";
import type { GroupedJob, JobAnalysisSummary } from "@/lib/job-grouping";
import {
  updateGroupedJobStatus,
  type ApplicationStatus,
} from "@/app/actions/job";
import { analyzeJob } from "@/app/actions/jobAnalysisActions";
import { cn } from "@/lib/utils";

const STATUS_BTN_BASE =
  "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background text-muted-foreground transition-all disabled:opacity-50 cursor-pointer shadow-xs";

const STATUS_BADGE_BASE =
  "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border";

const PANEL_BTN_BASE =
  "inline-flex items-center gap-1 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors cursor-pointer";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkillChip({
  skill,
  isMissing,
}: {
  skill: string;
  isMissing?: boolean;
}) {
  if (isMissing) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full font-medium"
        title="Missing in your CVs"
      >
        <span>{skill}</span>
        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
          ✕
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs bg-primary/8 text-primary border border-primary/15 px-2 py-0.5 rounded-full font-medium">
      {skill}
    </span>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="font-medium text-foreground/80">{label}:</span>{" "}
        <span className="text-muted-foreground">{value}</span>
      </span>
    </div>
  );
}

function AiSummaryPanel({
  analysis,
  isStale,
  isAnalyzing,
  onReanalyze,
  onClose,
}: {
  analysis: JobAnalysisSummary;
  isStale: boolean;
  isAnalyzing: boolean;
  onReanalyze: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Job Analysis</span>
          </div>
          {isStale && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Job, CV, or work preference data changed — re-analyze available
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReanalyze}
            disabled={isAnalyzing}
            className={cn(PANEL_BTN_BASE, "px-2 font-medium disabled:opacity-50")}
            title="Re-run AI analysis with current CVs"
          >
            <RefreshCw
              className={cn("w-3 h-3", isAnalyzing && "animate-spin")}
            />
            <span>Re-analyze</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(PANEL_BTN_BASE, "px-1.5")}
            title="Hide AI analysis"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Hide</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-foreground/90 leading-relaxed">
        {analysis.summary}
      </p>

      {/* Meta grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <MetaRow
          icon={<Briefcase className="w-3.5 h-3.5" />}
          label="Seniority"
          value={analysis.seniority ?? "Not stated in the description"}
        />
        <MetaRow
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Location"
          value={analysis.location ?? "Not stated in the description"}
        />
        <MetaRow
          icon={<Wifi className="w-3.5 h-3.5" />}
          label="Work mode"
          value={analysis.workMode ?? "Not stated in the description"}
        />
        <MetaRow
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="Compensation"
          value={analysis.compensation ?? "Not stated in the description"}
        />
      </div>

      {analysis.workPreferenceDiff && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
            Work preference difference
          </p>
          <p className="text-sm text-foreground/90">
            {analysis.workPreferenceDiff}
          </p>
        </div>
      )}

      {/* Required skills */}
      {analysis.requiredSkills.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Required Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.requiredSkills.map((skill) => {
              const s = skill.toLowerCase().trim();
              const isMissing =
                s.length > 0 &&
                analysis.cvMatchGaps.some((gap) => {
                  const g = gap.toLowerCase();
                  return g.includes(s) || s.includes(g);
                });
              return (
                <SkillChip key={skill} skill={skill} isMissing={isMissing} />
              );
            })}
          </div>
        </div>
      )}

      {/* CV recommendation or Gap feedback */}
      {(analysis.recommendedCvLabel ||
        analysis.cvMatchReason ||
        analysis.cvMatchGaps.length > 0) && (
        <div
          className={cn(
            "rounded-lg p-3 space-y-2 border",
            analysis.recommendedCvLabel
              ? "bg-emerald-500/8 border-emerald-500/20"
              : "bg-amber-500/8 border-amber-500/25"
          )}
        >
          {analysis.recommendedCvLabel ? (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Best CV match:{" "}
              <span className="font-bold">{analysis.recommendedCvLabel}</span>
            </p>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>No matching CV recommended</span>
            </div>
          )}

          {analysis.cvMatchReason && (
            <p className="text-xs text-foreground/80 leading-relaxed">
              {analysis.cvMatchReason}
            </p>
          )}

          {analysis.cvMatchGaps.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                Gaps / Missing requirements
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {analysis.cvMatchGaps.map((g) => (
                  <li key={g} className="text-xs text-foreground/80 font-medium">
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.cvMatchStrengths.length > 0 && (
            <div>
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider mb-1",
                  analysis.recommendedCvLabel
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-muted-foreground"
                )}
              >
                {analysis.recommendedCvLabel
                  ? "Strengths"
                  : "Matching skills found"}
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {analysis.cvMatchStrengths.map((s) => (
                  <li key={s} className="text-xs text-foreground/80">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60">
        Analyzed{" "}
        {new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Warsaw",
        }).format(analysis.analyzedAt)}
      </p>
    </div>
  );
}

function AiAnalysisSkeleton() {
  return (
    <div className="mt-4 pt-4 border-t border-border/60 space-y-4 animate-pulse">
      {/* Summary skeleton */}
      <div className="space-y-2">
        <div className="h-4 bg-muted/80 rounded w-full" />
        <div className="h-4 bg-muted/70 rounded w-5/6" />
        <div className="h-4 bg-muted/60 rounded w-2/3" />
      </div>

      {/* Meta grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="h-4 bg-muted/60 rounded w-36" />
        <div className="h-4 bg-muted/60 rounded w-32" />
        <div className="h-4 bg-muted/60 rounded w-28" />
        <div className="h-4 bg-muted/60 rounded w-30" />
      </div>

      {/* Required skills chips skeleton */}
      <div className="space-y-2">
        <div className="h-3 bg-muted/50 rounded w-24" />
        <div className="flex flex-wrap gap-1.5">
          <div className="h-5 w-16 bg-primary/10 rounded-full" />
          <div className="h-5 w-20 bg-primary/10 rounded-full" />
          <div className="h-5 w-14 bg-primary/10 rounded-full" />
          <div className="h-5 w-24 bg-primary/10 rounded-full" />
        </div>
      </div>

      {/* CV recommendation skeleton */}
      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 space-y-2">
        <div className="h-4 bg-emerald-500/20 rounded w-44" />
        <div className="h-3 bg-muted/60 rounded w-3/4" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * The header button toggles an existing analysis instead of re-running it, so a
 * stale result still collapses and expands normally. A new analysis only starts
 * when the job has no analysis yet; re-running is explicit inside the panel.
 */
export function shouldStartAnalysis(
  analysis: JobAnalysisSummary | null,
): boolean {
  return analysis === null;
}

export function JobCard({
  job,
  now,
  currentComparedCvHash,
  currentWorkPreferencesHash = null,
  currentDescriptionHash,
}: {
  job: GroupedJob;
  now: number;
  /** Composite hash of active CV versions — passed from the server so the
   *  card can determine staleness without an extra round-trip. */
  currentComparedCvHash: string | null;
  currentWorkPreferencesHash?: string | null;
  currentDescriptionHash: string | null;
}) {
  const [showVariants, setShowVariants] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ApplicationStatus>(
    job.applicationStatus || "INBOX",
  );
  const [appliedAt, setAppliedAt] = useState<Date | string | null>(
    job.appliedAt || null,
  );

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(
    job.analysis !== null,
  );
  const [currentAnalysis, setCurrentAnalysis] =
    useState<JobAnalysisSummary | null>(job.analysis);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const isNew = now - new Date(job.createdAt).getTime() < 14 * 60 * 60 * 1000;
  const hasMultipleSources = job.sources.length > 1;

  const isStale =
    currentAnalysis !== null &&
    (currentAnalysis.comparedCvHash !== currentComparedCvHash ||
      currentAnalysis.descriptionHash !== currentDescriptionHash ||
      currentAnalysis.workPreferencesHash !== currentWorkPreferencesHash);

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
      const res = await updateGroupedJobStatus(job.id, newStatus);
      if (res?.error) {
        setStatus(prevStatus);
        setAppliedAt(prevAppliedAt);
      }
    });
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    startTransition(async () => {
      try {
        const res = await analyzeJob(job.id);
        if (!res.ok) {
          setAnalysisError(res.error ?? "Analysis failed. Please try again.");
        } else if (res.analysis) {
          const a = res.analysis;
          setCurrentAnalysis({
            id: a.id,
            summary: a.summary,
            requiredSkills: a.requiredSkills,
            seniority: a.seniority,
            location: a.location,
            workMode: a.workMode,
            compensation: a.compensation,
            workPreferenceDiff: a.workPreferenceDiff,
            recommendedCvId: a.recommendedCvId,
            recommendedCvLabel: a.recommendedCv?.label ?? null,
            cvMatchReason: a.cvMatchReason,
            cvMatchStrengths: a.cvMatchStrengths,
            cvMatchGaps: a.cvMatchGaps,
            descriptionHash: a.descriptionHash,
            comparedCvHash: a.comparedCvHash,
            workPreferencesHash: a.workPreferencesHash,
            analyzedAt: a.analyzedAt,
          });
          setAnalysisPanelOpen(true);
          setAnalysisError(null);
        }
      } finally {
        setIsAnalyzing(false);
      }
    });
  };

  return (
    <div className="bg-card hover:bg-accent/40 border rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {hasMultipleSources ? (
              <span className="text-lg font-semibold">{job.title}</span>
            ) : (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="text-lg font-semibold hover:text-primary transition-colors hover:underline inline-flex items-center gap-1.5"
              >
                {job.title}
                <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </a>
            )}
            {isNew && (
              <span className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                New
              </span>
            )}
            {status === "SAVED" && (
              <span
                className={cn(
                  STATUS_BADGE_BASE,
                  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                )}
              >
                <Bookmark className="w-3 h-3 fill-amber-500/30" />
                Saved
              </span>
            )}
            {status === "APPLIED" && (
              <span
                className={cn(
                  STATUS_BADGE_BASE,
                  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                )}
              >
                <Check className="w-3 h-3" />
                Applied{appliedDateStr ? ` • ${appliedDateStr}` : ""}
              </span>
            )}
            {status === "REJECTED" && (
              <span
                className={cn(
                  STATUS_BADGE_BASE,
                  "bg-destructive/10 text-destructive border-destructive/20"
                )}
              >
                <X className="w-3 h-3" />
                Rejected
              </span>
            )}
          </div>

          {job.company && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {job.company}
            </p>
          )}

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

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* AI Analyze Action */}
            {job.hasDescription && (
              <>
                <button
                  type="button"
                  disabled={isPending || isAnalyzing}
                  onClick={() => {
                    // An existing analysis is only hidden or shown here. Stale
                    // results still toggle the panel; re-running is an explicit
                    // action inside the panel so the button never silently
                    // starts a new (paid) analysis.
                    if (shouldStartAnalysis(currentAnalysis)) {
                      handleAnalyze();
                    } else {
                      setAnalysisPanelOpen((v) => !v);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-all disabled:opacity-50 cursor-pointer shadow-xs",
                    isAnalyzing
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : analysisPanelOpen && currentAnalysis !== null
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : currentAnalysis !== null
                      ? "border-primary/25 bg-primary/5 text-primary hover:bg-primary/15"
                      : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                  )}
                  title={
                    currentAnalysis
                      ? analysisPanelOpen
                        ? "Hide AI Analysis"
                        : "Show AI Analysis"
                      : "Analyze job description with AI"
                  }
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Analyzing…</span>
                    </>
                  ) : currentAnalysis ? (
                    <>
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span>AI Analysis</span>
                      {analysisPanelOpen ? (
                        <ChevronUp className="w-3 h-3 opacity-70" />
                      ) : (
                        <ChevronDown className="w-3 h-3 opacity-70" />
                      )}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span>Analyze</span>
                    </>
                  )}
                </button>

                <div className="h-3.5 w-px bg-border/60 mx-0.5 hidden sm:block" />
              </>
            )}

            {/* Status Actions */}
            {status !== "SAVED" && status !== "APPLIED" && (
              <button
                type="button"
                disabled={isPending || isAnalyzing}
                onClick={() => handleStatusChange("SAVED")}
                className={cn(
                  STATUS_BTN_BASE,
                  "hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30"
                )}
                title="Save for later"
              >
                <Bookmark className="w-3 h-3" />
                <span>Save</span>
              </button>
            )}
            {status !== "APPLIED" && (
              <button
                type="button"
                disabled={isPending || isAnalyzing}
                onClick={() => handleStatusChange("APPLIED")}
                className={cn(
                  STATUS_BTN_BASE,
                  "hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
                )}
                title="Mark as Applied"
              >
                <Send className="w-3 h-3" />
                <span>Applied</span>
              </button>
            )}
            {status !== "REJECTED" && (
              <button
                type="button"
                disabled={isPending || isAnalyzing}
                onClick={() => handleStatusChange("REJECTED")}
                className={cn(
                  STATUS_BTN_BASE,
                  "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                )}
                title="Reject offer"
              >
                <X className="w-3 h-3" />
                <span>Reject</span>
              </button>
            )}
            {status !== "INBOX" && (
              <button
                type="button"
                disabled={isPending || isAnalyzing}
                onClick={() => handleStatusChange("INBOX")}
                className={cn(STATUS_BTN_BASE, "hover:bg-secondary")}
                title="Move back to Inbox"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Inbox</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Analysis Drawer (only rendered when active) */}
      {job.hasDescription && (
        <>
          {/* Error message */}
          {analysisError && (
            <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{analysisError}</span>
            </div>
          )}

          {/* In-progress analysis skeleton */}
          {isAnalyzing && <AiAnalysisSkeleton />}

          {/* Results panel */}
          {!isAnalyzing && analysisPanelOpen && currentAnalysis !== null && (
            <AiSummaryPanel
              analysis={currentAnalysis}
              isStale={isStale}
              isAnalyzing={isAnalyzing}
              onReanalyze={handleAnalyze}
              onClose={() => setAnalysisPanelOpen(false)}
            />
          )}
        </>
      )}

      {/* Similar Variants (Level B) */}
      {job.relatedVariants.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowVariants(!showVariants)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
          >
            {showVariants ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            <span>
              {job.relatedVariants.length}{" "}
              {job.relatedVariants.length === 1
                ? "related role"
                : "related roles"}{" "}
              at {job.company || "this company"}
            </span>
          </button>

          {showVariants && (
            <div className="mt-3 space-y-2 pl-2 border-l-2 border-primary/30">
              {job.relatedVariants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs py-1"
                >
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
                      <span
                        key={pref.id}
                        className="text-[10px] text-muted-foreground"
                      >
                        {pref.name}
                      </span>
                    ))}
                    <span className="text-[10px] text-muted-foreground">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Warsaw",
                      }).format(new Date(variant.createdAt))}
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
