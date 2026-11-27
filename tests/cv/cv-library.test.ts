import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import type { ReactNode } from "react";
import { loadSource } from "../helpers.ts";
import {
  computeComparedCvHash,
  computeWorkPreferencesHash,
  sha256,
} from "../../src/lib/cv-hash.ts";

const require = createRequire(import.meta.url);
const react = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { load } = require("cheerio") as typeof import("cheerio");

describe("CV Library alphabetical sorting and hashing", () => {
  test("CvLibraryTab renders CV items sorted alphabetically by label", () => {
    const { CvLibraryTab } = loadSource<typeof import("../../src/components/CvLibraryTab")>(
      "src/components/CvLibraryTab.tsx",
      {
        react,
        "@/app/actions/cvActions": {
          uploadCvVersion: async () => ({ ok: true }),
          renameCvVersion: async () => ({ ok: true }),
          replaceCvVersion: async () => ({ ok: true }),
          deleteCvVersion: async () => ({ ok: true }),
        },
        "@/components/ui/button": {
          Button: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
            react.createElement("button", props, children),
        },
        "@/components/ui/input": {
          Input: (props: Record<string, unknown>) => react.createElement("input", props),
        },
        "lucide-react": require("lucide-react"),
        "react/jsx-runtime": require("react/jsx-runtime"),
      }
    );

    // Unsorted list matching the user's example
    const cvs = [
      { id: "1", label: "Vue Django AI", originalFilename: "v_d_ai.pdf", wordCount: 684, updatedAt: new Date() },
      { id: "2", label: "React Django AI", originalFilename: "r_d_ai.pdf", wordCount: 688, updatedAt: new Date() },
      { id: "3", label: "Ecomm Django", originalFilename: "ed.pdf", wordCount: 652, updatedAt: new Date() },
      { id: "4", label: "Master", originalFilename: "m.pdf", wordCount: 632, updatedAt: new Date() },
      { id: "5", label: "Vue Django", originalFilename: "vd.pdf", wordCount: 673, updatedAt: new Date() },
      { id: "6", label: "Ecomm Django AI", originalFilename: "edai.pdf", wordCount: 663, updatedAt: new Date() },
      { id: "7", label: "React Django", originalFilename: "rd.pdf", wordCount: 677, updatedAt: new Date() },
    ];

    const html = renderToStaticMarkup(react.createElement(CvLibraryTab, { initialCvs: cvs }));
    const $ = load(html);
    const renderedLabels = $("p.font-semibold.text-sm")
      .map((_, el) => $(el).text().trim())
      .get();

    assert.deepEqual(renderedLabels, [
      "Ecomm Django",
      "Ecomm Django AI",
      "Master",
      "React Django",
      "React Django AI",
      "Vue Django",
      "Vue Django AI",
    ]);
  });

  test("listCvVersions queries with label asc and returns sorted items", async () => {
    let capturedOrderBy: unknown;
    const dbRows = [
      { id: "2", label: "React Django", originalFilename: "rd.pdf", extractedText: "hello world", updatedAt: new Date() },
      { id: "1", label: "Ecomm Django", originalFilename: "ed.pdf", extractedText: "hello world test", updatedAt: new Date() },
    ];

    const { listCvVersions } = loadSource<typeof import("../../src/app/actions/cvActions")>(
      "src/app/actions/cvActions.ts",
      {
        next: { cache: { revalidatePath: () => {} } },
        "next/cache": { revalidatePath: () => {} },
        zod: require("zod"),
        "@/lib/auth": { verifyAuth: async () => {} },
        "@/lib/ai-error": { friendlyAiError: (e: unknown, fb: string) => `${fb}: ${e instanceof Error ? e.message : String(e)}` },
        "@/lib/cv-parser": {
          parseCvFile: async () => ({ extractedText: "", contentHash: "", wordCount: 0 }),
          countWords: (text: string) => text.trim().split(/\s+/).length,
          CvParseError: class extends Error {},
        },
        "@/lib/prisma": {
          prisma: {
            cvVersion: {
              findMany: async (args: { orderBy?: unknown }) => {
                capturedOrderBy = args.orderBy;
                return dbRows;
              },
            },
          },
        },
      }
    );

    const result = await listCvVersions();
    assert.equal(JSON.stringify(capturedOrderBy), JSON.stringify({ label: "asc" }));
    assert.equal(result[0].label, "Ecomm Django");
    assert.equal(result[1].label, "React Django");
  });

  test("concurrent CV uploads cannot exceed the version limit", async () => {
    let versionCount = 9;
    let lockCount = 0;
    let transactionTail = Promise.resolve();
    const tx = {
      $queryRaw: async () => {
        lockCount += 1;
        return [];
      },
      cvVersion: {
        count: async () => versionCount,
        create: async () => {
          versionCount += 1;
        },
      },
    };

    const { uploadCvVersion } = loadSource<typeof import("../../src/app/actions/cvActions")>(
      "src/app/actions/cvActions.ts",
      {
        "next/cache": { revalidatePath: () => {} },
        "@/lib/auth": { verifyAuth: async () => {} },
        "@/lib/ai-error": { friendlyAiError: (e: unknown, fb: string) => `${fb}: ${e instanceof Error ? e.message : String(e)}` },
        "@/lib/cv-parser": {
          parseCvFile: async () => ({
            extractedText: "Parsed CV content",
            contentHash: "content-hash",
            wordCount: 3,
          }),
          countWords: () => 0,
          CvParseError: class extends Error {},
        },
        "@/lib/prisma": {
          prisma: {
            $transaction: async (callback: (client: typeof tx) => Promise<boolean>) => {
              let release!: () => void;
              const previous = transactionTail;
              transactionTail = new Promise<void>((resolve) => {
                release = resolve;
              });
              await previous;
              try {
                return await callback(tx);
              } finally {
                release();
              }
            },
          },
        },
      },
    );

    const makeUpload = (label: string) => {
      const formData = new FormData();
      formData.set("label", label);
      formData.set("file", new Blob(["cv"]), `${label}.pdf`);
      return uploadCvVersion(formData);
    };

    const results = await Promise.all([makeUpload("First"), makeUpload("Second")]);
    assert.equal(versionCount, 10);
    assert.equal(lockCount, 2);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.match(
      results.find((result) => !result.ok)?.error ?? "",
      /at most 10 CV versions/,
    );
  });

  test("computeComparedCvHash produces deterministic hash irrespective of input order", () => {
    const listA = [
      { id: "b-id", contentHash: "hash-b" },
      { id: "a-id", contentHash: "hash-a" },
    ];
    const listB = [
      { id: "a-id", contentHash: "hash-a" },
      { id: "b-id", contentHash: "hash-b" },
    ];

    const hashA = computeComparedCvHash(listA);
    const hashB = computeComparedCvHash(listB);

    assert.equal(hashA, hashB);
    assert.equal(computeComparedCvHash([]), null);
    assert.equal(typeof hashA, "string");
    assert.equal(hashA, sha256("a-id:hash-a|b-id:hash-b"));
  });

  test("computeWorkPreferencesHash is stable across preference ordering", () => {
    assert.equal(
      computeWorkPreferencesHash(["Remote", "Hybrid, Wrocław"]),
      computeWorkPreferencesHash(["Hybrid, Wrocław", "Remote"])
    );
    assert.equal(computeWorkPreferencesHash([]), sha256("[]"));
  });

  test("analyzeJob returns error when job has no description", async () => {
    const { analyzeJob } = loadSource<typeof import("../../src/app/actions/jobAnalysisActions")>(
      "src/app/actions/jobAnalysisActions.ts",
      {
        next: { cache: { revalidatePath: () => {} } },
        "next/cache": { revalidatePath: () => {} },
        zod: require("zod"),
        "@/lib/auth": { verifyAuth: async () => {} },
        "@/lib/ai-error": { friendlyAiError: (e: unknown, fb: string) => `${fb}: ${e instanceof Error ? e.message : String(e)}` },
        "@/lib/cv-parser": { sha256: (s: string) => s, computeComparedCvHash: () => "hash" },
        "@/lib/cv-hash": { computeWorkPreferencesHash: () => "pref-hash" },
        "@/lib/ai-model-fallback": { generateObjectWithFallback: async () => ({ object: {}, modelUsed: "test" }) },
        "@/lib/prisma": {
          prisma: {
            job: {
              findUnique: async () => ({ id: "1", title: "Test", company: "Test", description: "" }),
            },
          },
        },
      }
    );

    const res = await analyzeJob("1");
    assert.equal(res.ok, false);
    assert.match(res.error ?? "", /does not have a description/);
  });

  test("analyzeJob uses configured model, validates CV UUID and upserts analysis", async () => {
    let capturedModel: string | undefined;
    let upsertedData: unknown;

    const { analyzeJob } = loadSource<typeof import("../../src/app/actions/jobAnalysisActions")>(
      "src/app/actions/jobAnalysisActions.ts",
      {
        next: { cache: { revalidatePath: () => {} } },
        "next/cache": { revalidatePath: () => {} },
        zod: require("zod"),
        "@/lib/auth": { verifyAuth: async () => {} },
        "@/lib/ai-error": { friendlyAiError: (e: unknown, fb: string) => `${fb}: ${e instanceof Error ? e.message : String(e)}` },
        "@/lib/cv-parser": { sha256: (s: string) => `hash(${s})`, computeComparedCvHash: () => "comp-hash" },
        "@/lib/cv-hash": { computeWorkPreferencesHash: () => "pref-hash" },
        "@/lib/ai-model-fallback": {
          generateObjectWithFallback: async (options: { modelName: string }) => {
            capturedModel = options.modelName;
            return {
              object: {
                summary: "Great React role",
                requiredSkills: ["React", "TypeScript"],
                seniority: "Senior",
                location: "Warsaw",
                workMode: "Remote",
                compensation: "20k PLN",
                workPreferenceDiff: null,
                recommendedCvId: "valid-cv-id",
                cvMatchReason: "Matches strong React background",
                cvMatchStrengths: ["React expertise"],
                cvMatchGaps: [],
              },
              modelUsed: options.modelName,
            };
          },
        },
        "@/lib/prisma": {
          prisma: {
            job: {
              findUnique: async () => ({
                id: "job-1",
                title: "Senior React Developer",
                company: "Tech Corp",
                description: "We are hiring a Senior React Developer.",
              }),
            },
            cvVersion: {
              findMany: async () => [
                { id: "valid-cv-id", label: "React CV", extractedText: "React developer", contentHash: "cvhash" },
              ],
            },
            workPreference: { findMany: async () => [] },
            jobAnalysis: {
              upsert: async (args: { create: Record<string, unknown> }) => {
                upsertedData = args.create;
                return { id: "analysis-1", ...args.create, recommendedCv: { id: "valid-cv-id", label: "React CV" } };
              },
            },
          },
        },
      },
      {
        process: {
          env: {
            GOOGLE_GENERATIVE_AI_API_KEY: "test-key",
            GEMINI_MODEL: "gemini-3.5-flash",
          },
        },
      }
    );

    const res = await analyzeJob("job-1");
    assert.equal(res.ok, true);
    assert.equal(capturedModel, "gemini-3.5-flash");
    assert.equal((upsertedData as Record<string, unknown>).recommendedCvId, "valid-cv-id");
    assert.equal((upsertedData as Record<string, unknown>).seniority, "Senior");
  });

  test("analyzeJob includes active work preferences and keeps them out of CV gaps", async () => {
    let capturedPrompt = "";
    let capturedSystem = "";
    let upsertedData: Record<string, unknown> | undefined;

    const { analyzeJob } = loadSource<typeof import("../../src/app/actions/jobAnalysisActions")>(
      "src/app/actions/jobAnalysisActions.ts",
      {
        next: { cache: { revalidatePath: () => {} } },
        "next/cache": { revalidatePath: () => {} },
        zod: require("zod"),
        "@/lib/auth": { verifyAuth: async () => {} },
        "@/lib/ai-error": { friendlyAiError: (e: unknown, fb: string) => `${fb}: ${e instanceof Error ? e.message : String(e)}` },
        "@/lib/cv-parser": { sha256: (s: string) => `hash(${s})`, computeComparedCvHash: () => null },
        "@/lib/cv-hash": {
          computeWorkPreferencesHash: () => "pref-hash",
        },
        "@/lib/ai-model-fallback": {
          generateObjectWithFallback: async (options: { prompt: string; system: string }) => {
            capturedPrompt = options.prompt;
            capturedSystem = options.system;
            return {
              object: {
                summary: "Hybrid role based in Warsaw",
                requiredSkills: [],
                seniority: null,
                location: "Warsaw",
                workMode: "Hybrid",
                compensation: null,
                workPreferenceDiff:
                  "The listing is hybrid in Warsaw, while your preference is hybrid in Wrocław.",
                recommendedCvId: null,
                cvMatchReason: null,
                cvMatchStrengths: [],
                cvMatchGaps: [],
              },
              modelUsed: "test",
            };
          },
        },
        "@/lib/prisma": {
          prisma: {
            job: {
              findUnique: async () => ({
                id: "job-1",
                title: "Senior Frontend Specialist",
                company: "Example Corp",
                description: "Hybrid role based in Warsaw.",
                workPreferences: [],
              }),
            },
            workPreference: {
              findMany: async (args: unknown) => {
                assert.equal(
                  JSON.stringify(args),
                  JSON.stringify({
                    where: { isActive: true },
                    orderBy: { name: "asc" },
                    select: { name: true },
                  })
                );
                return [{ name: "Hybrid, Wrocław" }];
              },
            },
            cvVersion: { findMany: async () => [] },
            jobAnalysis: {
              upsert: async (args: { create: Record<string, unknown> }) => {
                upsertedData = args.create;
                return {
                  id: "analysis-1",
                  ...args.create,
                  recommendedCv: null,
                };
              },
            },
          },
        },
      },
      {
        process: {
          env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" },
        },
      }
    );

    const res = await analyzeJob("job-1");

    assert.equal(res.ok, true);
    assert.match(
      capturedPrompt,
      /<candidate_work_preferences>\s*Hybrid, Wrocław\s*<\/candidate_work_preferences>/
    );
    assert.match(capturedSystem, /Never include work-preference differences in summary or cvMatchGaps/);
    assert.match(
      capturedSystem,
      /cvMatchGaps must contain only professional qualifications, skills, or experience explicitly required by the job/
    );
    assert.equal(
      upsertedData?.workPreferenceDiff,
      "The listing is hybrid in Warsaw, while your preference is hybrid in Wrocław."
    );
    assert.equal(upsertedData?.workPreferencesHash, "pref-hash");
  });
});
