"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Play, Check, AlertCircle, Loader2, ExternalLink, Activity } from "lucide-react";
import { triggerScraperAction, getScraperStatusAction } from "@/app/actions/scraper";
import { isScraperActive, watchScraperStatus, type ScraperDispatch } from "@/lib/scraper-polling";

export function RunScraperButton() {
  const [isPending, startTransition] = useTransition();
  const [triggerStatus, setTriggerStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  
  const [ghStatus, setGhStatus] = useState<string>("unknown");
  const [ghConclusion, setGhConclusion] = useState<string | null>(null);
  const [ghUrl, setGhUrl] = useState<string | null>(null);

  const [hideCompleted, setHideCompleted] = useState(false);
  const [dispatch, setDispatch] = useState<ScraperDispatch>();
  const lastRunId = useRef<number | undefined>(undefined);

  // Check once on mount, then poll only while a run is pending or active.
  useEffect(() => {
    return watchScraperStatus(getScraperStatusAction, (res) => {
      lastRunId.current = res.runId;
      setGhStatus(res.status || "unknown");
      setGhConclusion(res.conclusion || null);
      setGhUrl(res.url || null);

      // If it's already completed and older than 15 seconds, hide it instantly
      if (res.status === "completed" && res.updatedAt) {
        const finishedAt = new Date(res.updatedAt).getTime();
        const now = new Date().getTime();
        if (now - finishedAt > 15000) {
          setHideCompleted(true);
        }
      }
    }, dispatch);
  }, [dispatch]);

  // Delay hiding the completed status when it changes live
  useEffect(() => {
    if (ghStatus === "completed") {
      const timer = setTimeout(() => {
        setHideCompleted(true);
      }, 15000); // Wait 15 seconds before hiding
      return () => clearTimeout(timer);
    }
  }, [ghStatus]);

  const handleTrigger = () => {
    startTransition(async () => {
      setTriggerStatus("idle");
      const result = await triggerScraperAction();
      if (result.success) {
        setTriggerStatus("success");
        setGhStatus("queued");
        setGhConclusion(null);
        setGhUrl(null);
        setHideCompleted(false);
        setDispatch({ requestedAt: result.requestedAt ?? new Date().toISOString(), previousRunId: lastRunId.current });
        setTimeout(() => setTriggerStatus("idle"), 5000);
      } else {
        setTriggerStatus("error");
        setErrorMsg(result.error || "Unknown error");
        setTimeout(() => setTriggerStatus("idle"), 8000);
      }
    });
  };

  const isRunning = isScraperActive(ghStatus);
  const buttonDisabled = isPending || isRunning;
  
  const showDetailedStatus = ghStatus !== "unknown" && (!hideCompleted || isRunning);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleTrigger}
        disabled={buttonDisabled}
        className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-4 rounded-md transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isRunning ? (
          <Activity className="w-4 h-4 animate-pulse" />
        ) : triggerStatus === "success" ? (
          <Check className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        
        {isPending 
          ? "Starting..." 
          : isRunning 
            ? "Scraping in progress..." 
            : "Run Scraper Now"}
      </button>

      {triggerStatus === "error" && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-all">{errorMsg}</span>
        </div>
      )}
      
      {/* Status indicator */}
      {showDetailedStatus ? (
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Status:</span>
            {isRunning && ghStatus !== "in_progress" && <span className="text-yellow-500 font-medium">Queued</span>}
            {ghStatus === "in_progress" && <span className="text-blue-500 font-medium animate-pulse">Running...</span>}
            {ghStatus === "completed" && (
              <span className={ghConclusion === "success" ? "text-green-500 font-medium" : "text-destructive font-medium"}>
                {ghConclusion === "success" ? "Success" : "Failed"}
              </span>
            )}
          </div>
          {ghUrl && isRunning ? (
            <a href={ghUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors font-medium">
              Live Logs <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <a href="/history" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors font-medium">
              View History <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : (
        <div className="flex justify-end text-xs px-1">
          <a href="/history" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors font-medium">
            View History <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
