"use client";

import { Sparkles, Check, AlertCircle, ExternalLink, Bot, Cpu, Key } from "lucide-react";

export interface AiAssistantSettingsProps {
  isConfigured: boolean;
  maskedApiKey: string | null;
  currentModel: string;
}

const RECOMMENDED_MODELS = [
  {
    id: "gemini-flash-lite-latest",
    name: "Gemini Flash Lite (Latest)",
    badge: "Recommended",
    badgeVariant: "emerald",
    description: "Ultra-fast, lowest latency, high throughput. Perfect for interactive job search and immediate status updates.",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    badge: "Balanced",
    badgeVariant: "primary",
    description: "Strong reasoning, reliable tool execution, and rich conversational summaries.",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    badge: "Advanced",
    badgeVariant: "secondary",
    description: "Latest generation Gemini 3 flash model with advanced reasoning (subject to occasional provider load spikes).",
  },
];

export function AiAssistantSettings({
  isConfigured,
  maskedApiKey,
  currentModel,
}: AiAssistantSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* API Key Status */}
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Key className="h-3.5 w-3.5" />
              API Key Status
            </span>
            {isConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-2.5 w-2.5" />
                Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-2.5 w-2.5" />
                Missing
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-foreground">
            {isConfigured ? maskedApiKey : "No API key found"}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isConfigured
              ? "Key loaded from environment (.env.local)."
              : "Set GOOGLE_GENERATIVE_AI_API_KEY to activate."}
          </p>
        </div>

        {/* Active Model Status */}
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              Active Model
            </span>
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Active
            </span>
          </div>
          <div className="text-sm font-semibold text-foreground font-mono">
            {currentModel}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Configured via <code className="font-mono text-foreground">GEMINI_MODEL</code> or default.
          </p>
        </div>
      </div>

      {/* Model Selection Guide */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span>Recommended Gemini Models</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          You can select any compatible Gemini model by adding <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">GEMINI_MODEL=&quot;model-name&quot;</code> to your <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">.env.local</code> file:
        </p>

        <div className="grid grid-cols-1 gap-2.5 pt-1">
          {RECOMMENDED_MODELS.map((model) => {
            const isCurrent = currentModel === model.id;
            return (
              <div
                key={model.id}
                className={`rounded-lg border p-3.5 transition-colors ${
                  isCurrent
                    ? "border-primary/60 bg-primary/5 shadow-xs"
                    : "border-border/80 bg-card hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{model.name}</span>
                    <code className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                      {model.id}
                    </code>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <Check className="h-3 w-3" />
                        Current
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        model.badgeVariant === "emerald"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : model.badgeVariant === "primary"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-secondary text-secondary-foreground border-border"
                      }`}
                    >
                      {model.badge}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {model.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Environment Configuration Snippet */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2.5">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Quick Environment Setup (.env.local)</span>
        </h4>
        <pre className="rounded-lg border border-border/60 bg-background/90 p-3 font-mono text-xs text-foreground overflow-x-auto select-all">
{`# Google Gemini API Key
GOOGLE_GENERATIVE_AI_API_KEY="AIzaSy..."

# Model Selection (optional, defaults to gemini-flash-lite-latest)
GEMINI_MODEL="gemini-flash-lite-latest"`}
        </pre>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <span>Restart your dev server after modifying .env.local</span>
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
          >
            <span>Get Gemini API Key</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
