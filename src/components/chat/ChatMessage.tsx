"use client";

import type { UIMessage } from "ai";
import {
  Sparkles,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Bookmark,
  Send,
  X,
  Inbox,
  PlayCircle,
} from "lucide-react";
import { ChatJobCard } from "./ChatJobCard";
import type { AssistantJobItem } from "@/lib/ai-assistant";

interface ToolPayload {
  toolName: string;
  state: string;
  output?: unknown;
  input?: unknown;
  errorText?: string;
}

function extractToolInfo(part: unknown): ToolPayload | null {
  if (!part || typeof part !== "object") return null;
  const p = part as Record<string, unknown>;

  if (p.type === "dynamic-tool" && typeof p.toolName === "string") {
    return {
      toolName: p.toolName,
      state: String(p.state || ""),
      output: p.output,
      input: p.input,
      errorText: typeof p.errorText === "string" ? p.errorText : undefined,
    };
  }

  if (typeof p.type === "string" && p.type.startsWith("tool-")) {
    return {
      toolName: p.type.slice(5),
      state: String(p.state || ""),
      output: p.output,
      input: p.input,
      errorText: typeof p.errorText === "string" ? p.errorText : undefined,
    };
  }

  return null;
}

/**
 * Format markdown-like text (bold, inline code, list items)
 */
function FormattedText({ content }: { content: string }) {
  if (!content) return null;

  // Split lines to properly render lists and paragraphs
  const lines = content.split("\n");

  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Bullet point
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const bulletContent = trimmed.slice(2);
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-primary mt-1 text-xs select-none">•</span>
              <span>{renderInlineMarkdown(bulletContent)}</span>
            </div>
          );
        }

        // Numbered list (e.g. "1. ")
        const matchNumber = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (matchNumber) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="font-semibold text-xs text-muted-foreground select-none mt-0.5">
                {matchNumber[1]}.
              </span>
              <span>{renderInlineMarkdown(matchNumber[2])}</span>
            </div>
          );
        }

        return <p key={idx}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Simple inline parser for **bold** and `code`
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export interface ChatMessageProps {
  message: UIMessage;
}

function cleanAssistantIntroText(text: string, hasJobCards: boolean): string {
  if (!hasJobCards) return text;

  // If the model generated an intro followed by a redundant list of jobs (e.g. "1. Title \n - Company..."):
  const lines = text.split("\n");
  const filtered: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+\.\s+/.test(trimmed)) {
      inList = true;
      continue;
    }
    if (inList) {
      if (
        trimmed.startsWith("•") ||
        trimmed.startsWith("-") ||
        trimmed.startsWith("*") ||
        /^company:/i.test(trimmed) ||
        /^work preference:/i.test(trimmed) ||
        /^status:/i.test(trimmed) ||
        trimmed === ""
      ) {
        continue;
      }
      inList = false;
    }
    filtered.push(line);
  }

  const cleaned = filtered.join("\n").trim();
  return cleaned || text;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Normalize parts array
  const rawParts = (message as { parts?: unknown[] }).parts;
  const parts = Array.isArray(rawParts) && rawParts.length > 0
    ? rawParts
    : [{ type: "text", text: (message as { content?: string }).content || "" }];

  // Check if this message contains interactive job cards
  const hasJobCards = parts.some((p) => {
    const tool = extractToolInfo(p);
    return tool?.toolName === "getJobs" && tool.state === "output-available" && Array.isArray(tool.output) && tool.output.length > 0;
  });

  // Reorder assistant parts so that introductory text appears on top, followed by interactive cards/tools
  const orderedParts = isUser
    ? parts
    : [
        ...parts.filter((p) => (p as Record<string, unknown>).type === "text"),
        ...parts.filter((p) => (p as Record<string, unknown>).type !== "text"),
      ];

  return (
    <div className={`flex w-full gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Message Bubble Container */}
      <div
        className={`flex flex-col gap-2 rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? "max-w-[85%] rounded-tr-xs bg-primary text-primary-foreground shadow-xs"
            : "max-w-[95%] rounded-tl-xs border border-border/70 bg-card text-foreground shadow-xs sm:max-w-[90%]"
        }`}
      >
        {orderedParts.map((part, index) => {
          const partObj = part as Record<string, unknown>;

          // Text part
          if (partObj.type === "text" && typeof partObj.text === "string") {
            const rawText = partObj.text;
            if (!rawText.trim()) return null;
            const textToRender = isUser ? rawText : cleanAssistantIntroText(rawText, hasJobCards);
            if (!textToRender.trim()) return null;
            return (
              <div key={index} className="break-words">
                <FormattedText content={textToRender} />
              </div>
            );
          }

          // Tool calls
          const tool = extractToolInfo(part);
          if (tool) {
            return (
              <div key={index} className="w-full">
                {renderToolPart(tool)}
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground border border-border">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

function renderToolPart(tool: ToolPayload) {
  const { toolName, state, output, errorText } = tool;

  // 1. getJobs tool
  if (toolName === "getJobs") {
    if (state === "input-streaming" || state === "input-available") {
      return (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Searching job offers...</span>
        </div>
      );
    }

    if (state === "output-error") {
      return (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Failed to load offers: {errorText || "Unknown error"}</span>
        </div>
      );
    }

    if (state === "output-available") {
      const jobs = Array.isArray(output) ? (output as AssistantJobItem[]) : [];
      if (jobs.length === 0) {
        return (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs italic text-muted-foreground">
            No matching job offers found in the database.
          </div>
        );
      }

      return (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground px-0.5">
            <span>Offers found ({jobs.length})</span>
          </div>
          <div className="space-y-2">
            {jobs.map((job) => (
              <ChatJobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      );
    }
  }

  // 2. updateJobStatus tool
  if (toolName === "updateJobStatus") {
    if (state === "input-streaming" || state === "input-available") {
      return (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Updating application status...</span>
        </div>
      );
    }

    if (state === "output-error") {
      return (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Failed to update status: {errorText || "Unknown error"}</span>
        </div>
      );
    }

    if (state === "output-available") {
      const res = output as { success?: boolean; message?: string } | undefined;
      const isSuccess = res?.success !== false;

      return (
        <div
          className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
            isSuccess
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          )}
          <span>{res?.message || (isSuccess ? "Job status updated." : "Update failed.")}</span>
        </div>
      );
    }
  }

  // 3. getDashboardStats tool
  if (toolName === "getDashboardStats") {
    if (state === "input-streaming" || state === "input-available") {
      return (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Retrieving dashboard statistics...</span>
        </div>
      );
    }

    if (state === "output-error") {
      return (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Failed to retrieve stats: {errorText || "Unknown error"}</span>
        </div>
      );
    }

    if (state === "output-available") {
      const stats = output as {
        inboxJobs?: number;
        savedJobs?: number;
        appliedJobs?: number;
        rejectedJobs?: number;
        totalActiveJobs?: number;
        lastScrape?: {
          status?: string;
          startedAt?: string;
          jobsAdded?: number;
          jobsUpdated?: number;
        } | null;
      };

      return (
        <div className="rounded-lg border border-border/70 bg-card p-3 shadow-xs space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>Platform Overview</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between rounded-md bg-secondary/60 p-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Inbox className="h-3 w-3" />
                Inbox
              </span>
              <span className="font-semibold text-foreground">{stats.inboxJobs ?? 0}</span>
            </div>

            <div className="flex items-center justify-between rounded-md bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-1">
                <Bookmark className="h-3 w-3" />
                Saved
              </span>
              <span className="font-semibold">{stats.savedJobs ?? 0}</span>
            </div>

            <div className="flex items-center justify-between rounded-md bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <Send className="h-3 w-3" />
                Applied
              </span>
              <span className="font-semibold">{stats.appliedJobs ?? 0}</span>
            </div>

            <div className="flex items-center justify-between rounded-md bg-destructive/10 p-2 text-destructive">
              <span className="flex items-center gap-1">
                <X className="h-3 w-3" />
                Rejected
              </span>
              <span className="font-semibold">{stats.rejectedJobs ?? 0}</span>
            </div>
          </div>

          {stats.lastScrape && (
            <div className="border-t border-border/50 pt-2 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Last Scrape:</span>
              <span className="font-medium text-foreground">
                {stats.lastScrape.status} ({stats.lastScrape.jobsAdded ?? 0} new)
              </span>
            </div>
          )}
        </div>
      );
    }
  }

  // 4. triggerScraper tool
  if (toolName === "triggerScraper") {
    if (state === "input-streaming" || state === "input-available") {
      return (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Dispatching scraper workflow...</span>
        </div>
      );
    }

    if (state === "output-error") {
      return (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Failed to dispatch scraper: {errorText || "Unknown error"}</span>
        </div>
      );
    }

    if (state === "output-available") {
      const res = output as { success?: boolean; message?: string } | undefined;
      const isSuccess = res?.success !== false;

      return (
        <div
          className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
            isSuccess
              ? "border-primary/20 bg-primary/5 text-foreground"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {isSuccess ? (
            <PlayCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-medium text-foreground">{res?.message || (isSuccess ? "Scraper triggered." : "Failed.")}</p>
            {isSuccess && (
              <a
                href="/history"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary underline hover:opacity-80"
              >
                <span>Track live progress in Scraper History →</span>
              </a>
            )}
          </div>
        </div>
      );
    }
  }

  return null;
}
