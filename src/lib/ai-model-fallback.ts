import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { z } from "zod";

export interface GenerateWithFallbackOptions<T> {
  apiKey: string;
  /** Primary model from env config. */
  modelName: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  maxRetries?: number;
}

/**
 * Calls generateObject with the primary model, then falls back through a list
 * of alternative models when the primary returns overload / 503 / high-demand
 * errors. Non-overload errors (bad key, invalid schema, etc.) are thrown
 * immediately — retrying those with a different model won't help.
 */
export async function generateObjectWithFallback<T>(
  options: GenerateWithFallbackOptions<T>,
): Promise<{ object: T; modelUsed: string }> {
  const google = createGoogleGenerativeAI({ apiKey: options.apiKey });

  // Fallback chain: primary first, then known-good alternatives.
  const candidates = [
    options.modelName,
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ].filter((v, i, arr) => v && arr.indexOf(v) === i); // dedupe, drop empties

  let lastError: unknown;

  for (const [index, model] of candidates.entries()) {
    try {
      // Cap retries when falling back across multiple models to avoid
      // multiplying backoff delays inside a single Server Action request.
      const perModelRetries =
        index === 0 ? Math.min(options.maxRetries ?? 1, 1) : 0;
      const { object } = await generateObject({
        model: google(model),
        schema: options.schema,
        system: options.system,
        prompt: options.prompt,
        maxRetries: perModelRetries,
      });
      return { object, modelUsed: model };
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isOverload =
        msg.includes("high demand") ||
        msg.includes("overloaded") ||
        msg.includes("503") ||
        msg.includes("service unavailable") ||
        msg.includes("try again later") ||
        msg.includes("429") ||
        msg.includes("resource exhausted");

      if (!isOverload) {
        // Non-transient error — don't waste time on other models.
        throw error;
      }
      // Try next model in the chain.
      console.warn(`Model "${model}" overloaded, trying next fallback...`);
    }
  }

  throw lastError;
}
