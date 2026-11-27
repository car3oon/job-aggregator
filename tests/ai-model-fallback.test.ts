import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import { loadSource } from "./helpers.ts";

type FallbackModule = typeof import("../src/lib/ai-model-fallback.ts");

describe("generateObjectWithFallback", () => {
  test("falls back to secondary model on 503/high-demand and caps retries", async () => {
    const calls: Array<{ model: string; maxRetries: number | undefined }> = [];

    const { generateObjectWithFallback } = loadSource<FallbackModule>(
      "src/lib/ai-model-fallback.ts",
      {
        "@ai-sdk/google": {
          createGoogleGenerativeAI: () => (model: string) => ({ model }),
        },
        ai: {
          generateObject: async (opts: {
            model: { model: string };
            maxRetries?: number;
          }) => {
            calls.push({ model: opts.model.model, maxRetries: opts.maxRetries });
            if (opts.model.model === "primary-model") {
              throw new Error("503 Service Unavailable: high demand");
            }
            return { object: { ok: true } };
          },
        },
        zod: { z },
      },
      { console: { log: () => {}, warn: () => {}, error: () => {} } as unknown as Console }
    );

    const res = await generateObjectWithFallback({
      apiKey: "test-key",
      modelName: "primary-model",
      schema: z.object({ ok: z.boolean() }),
      system: "sys",
      prompt: "prompt",
      maxRetries: 3,
    });

    assert.equal(res.modelUsed, "gemini-flash-lite-latest");
    assert.deepEqual(res.object, { ok: true });
    assert.deepEqual(calls, [
      { model: "primary-model", maxRetries: 1 },
      { model: "gemini-flash-lite-latest", maxRetries: 0 },
    ]);
  });

  test("throws immediately on non-transient errors without trying fallback models", async () => {
    const calls: string[] = [];

    const { generateObjectWithFallback } = loadSource<FallbackModule>(
      "src/lib/ai-model-fallback.ts",
      {
        "@ai-sdk/google": {
          createGoogleGenerativeAI: () => (model: string) => ({ model }),
        },
        ai: {
          generateObject: async (opts: { model: { model: string } }) => {
            calls.push(opts.model.model);
            throw new Error("401 Invalid API key");
          },
        },
        zod: { z },
      },
      { console: { log: () => {}, warn: () => {}, error: () => {} } as unknown as Console }
    );

    await assert.rejects(
      generateObjectWithFallback({
        apiKey: "bad-key",
        modelName: "primary-model",
        schema: z.object({ ok: z.boolean() }),
        system: "sys",
        prompt: "prompt",
      }),
      /401 Invalid API key/
    );

    assert.deepEqual(calls, ["primary-model"]);
  });
});
