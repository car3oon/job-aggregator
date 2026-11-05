"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Sparkles,
  X,
  Send,
  Square,
  RotateCcw,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { ChatMessage } from "./ChatMessage";

const STARTER_PROMPTS = [
  "Show recent React jobs",
  "What jobs did I save?",
  "Run scraper to fetch new offers",
  "Summary of scraper stats",
];

function formatModelName(model: string): string {
  if (model === "gemini-flash-lite-latest") return "Gemini Flash Lite";
  if (model === "gemini-3.5-flash") return "Gemini 3.5 Flash";
  if (model === "gemini-3.8-flash") return "Gemini 3.8 Flash";
  if (model === "gemini-3.5-flash-lite") return "Gemini 3.5 Flash Lite";
  return model;
}

export interface ChatWidgetProps {
  isConfigured?: boolean;
  modelName?: string;
}

export function ChatWidget({
  isConfigured = true,
  modelName = "gemini-flash-lite-latest",
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize AI SDK useChat with default /api/chat transport
  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom whenever messages or status updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status, isOpen]);

  // Focus textarea when chat opens (only if configured)
  useEffect(() => {
    if (isOpen && isConfigured) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isConfigured]);

  const handleSend = async (textToSend?: string) => {
    if (!isConfigured) return;
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    if (error) {
      clearError();
    }

    try {
      await sendMessage({ text });
    } catch {
      // Error handled by useChat hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    if (error) {
      clearError();
    }
  };

  return (
    <>
      {/* Floating launcher button */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
          aria-expanded={isOpen}
          className="group relative flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {isOpen ? (
            <ChevronDown className="h-6 w-6 transition-transform group-hover:translate-y-0.5" />
          ) : (
            <Sparkles className="h-6 w-6 transition-transform group-hover:scale-110" />
          )}

          {/* AI Status Badge */}
          {!isOpen && (
            <span
              className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background ${
                isConfigured ? "bg-emerald-500" : "bg-amber-500"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </span>
          )}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="AI Assistant Chat"
          className="fixed bottom-20 right-5 z-50 flex h-[580px] w-[420px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/98 shadow-2xl backdrop-blur-md transition-all duration-200 max-sm:inset-3 max-sm:bottom-20 max-sm:h-auto max-sm:w-auto"
        >
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-border/70 px-4 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span>AI Assistant</span>
                  {isConfigured ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Setup required
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isConfigured
                    ? "Job search & application assistant"
                    : "API key not configured"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  title="Clear conversation"
                  aria-label="Clear conversation"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close chat"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {!isConfigured ? (
              <div className="flex h-full flex-col items-center justify-center px-2 py-6 text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Google Gemini API Key Missing
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[300px]">
                    To enable conversational search and offer actions, add your Gemini API key to your environment.
                  </p>
                </div>

                <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-xs space-y-2">
                  <span className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                    Add to <code className="font-mono text-foreground">.env.local</code>:
                  </span>
                  <div className="rounded border border-border/60 bg-background/90 p-2 font-mono text-[11px] text-foreground select-all">
                    GOOGLE_GENERATIVE_AI_API_KEY=&quot;your-api-key&quot;
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Obtain a free API key at{" "}
                    <a
                      href="https://aistudio.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline font-medium"
                    >
                      Google AI Studio
                    </a>
                    .
                  </p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-2 py-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  How can I help you today?
                </h4>
                <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">
                  Ask about recent job postings, inspect your saved offers, or update statuses directly.
                </p>

                {/* Starter Prompt Chips */}
                <div className="mt-5 flex w-full flex-col gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground/80 text-left px-1">
                    Suggested queries:
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="group flex items-center justify-between rounded-lg border border-border/80 bg-background/60 px-3 py-2 text-left text-xs font-medium text-foreground/90 transition-all hover:border-primary/40 hover:bg-accent/40 active:scale-[0.99]"
                      >
                        <span>{prompt}</span>
                        <Send className="h-3 w-3 opacity-0 text-primary transition-opacity group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}

                {/* Streaming Indicator */}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2 py-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="animate-pulse">Assistant is thinking...</span>
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">Failed to process request</p>
                      <p className="text-[11px] text-destructive/80 mt-0.5">
                        {error.message || "An unexpected error occurred while communicating with the assistant."}
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Footer Input Area */}
          <div className="border-t border-border/70 p-3 bg-muted/20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-center rounded-xl border border-border/80 bg-background shadow-xs focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!isConfigured || isLoading}
                placeholder={
                  isConfigured
                    ? "Ask about jobs, applications, stats..."
                    : "Configure API key in .env.local to use assistant..."
                }
                rows={1}
                className="max-h-24 min-h-[42px] w-full resize-none bg-transparent px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="flex items-center pr-2">
                {isLoading ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    title="Stop generation"
                    aria-label="Stop generation"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!isConfigured || !input.trim()}
                    title="Send message"
                    aria-label="Send message"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                )}
              </div>
            </form>

            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground/70">
              <span>
                {isConfigured
                  ? "Press Enter to send, Shift+Enter for new line"
                  : "Assistant inactive"}
              </span>
              <span>
                {isConfigured ? formatModelName(modelName) : "No API key"}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
