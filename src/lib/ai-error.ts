/**
 * Maps raw AI SDK / API errors to user-friendly messages.
 * Detects overload, rate-limit, and quota errors so the UI can show
 * an actionable hint instead of a raw stack trace.
 */
export function friendlyAiError(error: unknown, fallback: string): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("try again later")
  ) {
    return "The AI model is busy right now (high demand). Please try again in a moment.";
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("resource exhausted")
  ) {
    return "AI rate limit reached. Please wait a few seconds and try again.";
  }

  if (lower.includes("api key") || lower.includes("401") || lower.includes("403")) {
    return "AI API key is invalid or missing. Check your GOOGLE_GENERATIVE_AI_API_KEY setting.";
  }

  if (lower.includes("context length") || lower.includes("token limit") || lower.includes("too long")) {
    return "The job description or CV is too long for the AI model. Try a shorter CV version.";
  }

  return `${fallback}: ${message}`;
}
