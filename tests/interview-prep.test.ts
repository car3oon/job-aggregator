import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import type { GroupedJob, InterviewPrepSummary } from "../src/lib/job-grouping.ts";
import { loadSource } from "./helpers.ts";

const require = createRequire(import.meta.url);
const { createElement } = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { load } = require("cheerio") as typeof import("cheerio");

type PrepActionsModule = typeof import("../src/app/actions/interviewPrepActions.ts");

const baseModules = {
  react: {
    useState: (initial: unknown) => [typeof initial === "boolean" ? true : initial, () => {}],
    useTransition: () => [false, (fn: () => void) => fn()],
  },
  "@/app/actions/job": { updateGroupedJobStatus: async () => ({ success: true }) },
  "@/app/actions/jobAnalysisActions": { analyzeJob: async () => ({ ok: false, error: "mock" }) },
  "@/app/actions/interviewPrepActions": { generateInterviewPrep: async () => ({ ok: false, error: "mock" }) },
  "@/lib/utils": {
    cn: (...args: unknown[]) =>
      args
        .flat()
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .join(" "),
  },
  "react/jsx-runtime": require("react/jsx-runtime"),
  "lucide-react": require("lucide-react"),
};

const baseJob = {
  hasDescription: false as const,
  analysis: null,
  interviewPrep: null,
};

function makePrep(overrides: Partial<InterviewPrepSummary> = {}): InterviewPrepSummary {
  return {
    id: "prep-1",
    technicalQuestions: ["How would you design a rate limiter?"],
    behavioralQuestions: ["Tell me about a conflict you resolved."],
    talkingPoints: ["Your 3y React experience maps to the frontend requirement."],
    questionsToAsk: ["What does success look like in this role?"],
    redFlags: ["Compensation is not stated."],
    prepPriorities: ["Study system design first — it is core to the role."],
    descriptionHash: "abc123",
    comparedCvHash: "def456",
    preparedAt: new Date("2026-11-20T10:00:00Z"),
    ...overrides,
  };
}

describe("shouldStartPrep", () => {
  test("returns true only when no prep exists", () => {
    const { shouldStartPrep } = loadSource<{
      shouldStartPrep: (prep: InterviewPrepSummary | null) => boolean;
    }>("src/components/JobCard.tsx", baseModules);

    assert.equal(shouldStartPrep(null), true);
    assert.equal(shouldStartPrep(makePrep()), false);
  });
});

describe("generateInterviewPrep server action", () => {
  const authMock = { verifyAuth: async () => {} };
  const aiErrorMock = { friendlyAiError: (e: unknown, fb: string) => `${fb}: ${e instanceof Error ? e.message : String(e)}` };
  const fallbackMock = (result: unknown, shouldThrow?: Error) => ({
    generateObjectWithFallback: async () => {
      if (shouldThrow) throw shouldThrow;
      return { object: result, modelUsed: "test-model" };
    },
  });
  const prismaMock = (job: Record<string, unknown> | null, cvs: unknown[] = []) => ({
    prisma: {
      job: {
        findUnique: async () => job,
      },
      cvVersion: {
        findMany: async () => cvs,
      },
      interviewPrep: {
        upsert: async (args: Record<string, unknown>) => ({
          id: "prep-upserted",
          ...(args as { create: Record<string, unknown> }).create,
        }),
      },
    },
  });

  test("returns error when job has no description", async () => {
    const { generateInterviewPrep } = loadSource<PrepActionsModule>(
      "src/app/actions/interviewPrepActions.ts",
      {
        "@/lib/auth": authMock,
        "@/lib/ai-error": aiErrorMock,
        "@/lib/prisma": prismaMock({ id: "job-1", title: "Dev", company: "Acme", description: "  ", analysis: null }),
        "@/lib/cv-parser": { sha256: (s: string) => s, computeComparedCvHash: () => null },
        "@/lib/ai-model-fallback": fallbackMock({}),
        "zod": require("zod"),
        "next/cache": { revalidatePath() {} },
      },
      { process: { env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" } } }
    );

    const result = await generateInterviewPrep("job-1");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /description/i);
  });

  test("returns error when API key is missing", async () => {
    const { generateInterviewPrep } = loadSource<PrepActionsModule>(
      "src/app/actions/interviewPrepActions.ts",
      {
        "@/lib/auth": authMock,
        "@/lib/ai-error": aiErrorMock,
        "@/lib/prisma": prismaMock({
          id: "job-1",
          title: "Dev",
          company: "Acme",
          description: "We need a React developer.",
          analysis: null,
        }),
        "@/lib/cv-parser": { sha256: (s: string) => s, computeComparedCvHash: () => null },
        "@/lib/ai-model-fallback": fallbackMock({}),
        "zod": require("zod"),
        "next/cache": { revalidatePath() {} },
      },
      { process: { env: {} } }
    );

    const result = await generateInterviewPrep("job-1");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /API key/i);
  });

  test("returns upserted prep on successful generation", async () => {
    const fakeObject = {
      technicalQuestions: ["Q1"],
      behavioralQuestions: ["B1"],
      talkingPoints: ["T1"],
      questionsToAsk: ["A1"],
      redFlags: ["R1"],
      prepPriorities: ["P1"],
    };

    const { generateInterviewPrep } = loadSource<PrepActionsModule>(
      "src/app/actions/interviewPrepActions.ts",
      {
        "@/lib/auth": authMock,
        "@/lib/ai-error": aiErrorMock,
        "@/lib/prisma": prismaMock({
          id: "job-1",
          title: "Senior React Dev",
          company: "Acme",
          description: "Looking for a senior React developer with TypeScript experience.",
          analysis: {
            summary: "Senior frontend role",
            requiredSkills: ["React", "TypeScript"],
            seniority: "Senior",
            location: "Warsaw",
            workMode: "Hybrid",
            compensation: "20k-30k PLN",
          },
        }, []),
        "@/lib/cv-parser": { sha256: (s: string) => `hash-${s.length}`, computeComparedCvHash: () => null },
        "@/lib/ai-model-fallback": fallbackMock(fakeObject),
        "zod": require("zod"),
        "next/cache": { revalidatePath() {} },
      },
      { process: { env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" } } }
    );

    const result = await generateInterviewPrep("job-1");
    assert.equal(result.ok, true);
    assert.ok(result.prep);
    assert.equal(result.prep?.technicalQuestions?.[0], "Q1");
    assert.equal(result.prep?.prepPriorities?.[0], "P1");
  });

  test("returns error when generateObject throws", async () => {
    const { generateInterviewPrep } = loadSource<PrepActionsModule>(
      "src/app/actions/interviewPrepActions.ts",
      {
        "@/lib/auth": authMock,
        "@/lib/ai-error": aiErrorMock,
        "@/lib/prisma": prismaMock({
          id: "job-1",
          title: "Dev",
          company: "Acme",
          description: "Some description here.",
          analysis: null,
        }),
        "@/lib/cv-parser": { sha256: (s: string) => s, computeComparedCvHash: () => null },
        "@/lib/ai-model-fallback": fallbackMock(null, new Error("model unavailable")),
        "zod": require("zod"),
        "next/cache": { revalidatePath() {} },
      },
      { process: { env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" } } }
    );

    const result = await generateInterviewPrep("job-1");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /Interview prep failed|busy/i);
  });

  test("maps high-demand overload errors to a friendly busy message", async () => {
    const { generateInterviewPrep } = loadSource<PrepActionsModule>(
      "src/app/actions/interviewPrepActions.ts",
      {
        "@/lib/auth": authMock,
        "@/lib/prisma": prismaMock({
          id: "job-1",
          title: "Dev",
          company: "Acme",
          description: "Some description here.",
          analysis: null,
        }),
        "@/lib/cv-parser": { sha256: (s: string) => s, computeComparedCvHash: () => null },
        "@/lib/ai-error": (await import("../src/lib/ai-error.ts")),
        "@/lib/ai-model-fallback": fallbackMock(null, new Error("AI_APICallError: This model is currently experiencing high demand. Please try again later.")),
        "zod": require("zod"),
        "next/cache": { revalidatePath() {} },
      },
      { process: { env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" } } }
    );

    const result = await generateInterviewPrep("job-1");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /busy right now/i);
  });
});

describe("friendlyAiError", () => {
  test("maps known error patterns to friendly messages", async () => {
    const { friendlyAiError } = await import("../src/lib/ai-error.ts");
    assert.match(friendlyAiError(new Error("high demand"), "fallback"), /busy right now/i);
    assert.match(friendlyAiError(new Error("429 rate limit"), "fallback"), /rate limit/i);
    assert.match(friendlyAiError(new Error("invalid API key"), "fallback"), /API key/i);
    assert.match(friendlyAiError(new Error("something unknown"), "fallback"), /fallback: something unknown/);
  });
});

const uiModules = {
  ...baseModules,
  react: {
    useState: (initial: unknown) => [initial, () => {}],
    useTransition: () => [false, (fn: () => void) => fn()],
  },
};

function makeJob(overrides: Partial<GroupedJob> = {}): GroupedJob {
  const createdAt = new Date("2026-11-20T10:00:00Z");
  return {
    id: "primary",
    title: "Senior React Developer",
    company: "Acme",
    url: "https://example.test/job",
    createdAt,
    updatedAt: createdAt,
    categories: [],
    workPreferences: [],
    sources: [],
    relatedVariants: [],
    applicationStatus: "APPLIED",
    appliedAt: new Date("2026-11-21T10:00:00Z"),
    ...baseJob,
    hasDescription: true,
    ...overrides,
  };
}

describe("JobCard Interview Prep UI", () => {
  test("renders Prep button when job has description", () => {
    const { JobCard } = loadSource<{
      JobCard: (props: {
        job: GroupedJob;
        now: number;
        currentComparedCvHash: string | null;
        currentDescriptionHash: string | null;
      }) => ReturnType<typeof createElement>;
    }>("src/components/JobCard.tsx", uiModules);

    const html = renderToStaticMarkup(
      createElement(JobCard, { job: makeJob(), now: Date.now(), currentComparedCvHash: null, currentDescriptionHash: null })
    );
    const $ = load(html);
    assert.match($.root().text(), /Prep/);
  });

  test("does not render Prep button when job has no description", () => {
    const { JobCard } = loadSource<{
      JobCard: (props: {
        job: GroupedJob;
        now: number;
        currentComparedCvHash: string | null;
        currentDescriptionHash: string | null;
      }) => ReturnType<typeof createElement>;
    }>("src/components/JobCard.tsx", uiModules);

    const job = makeJob({ hasDescription: false, applicationStatus: "INBOX", appliedAt: null });
    const html = renderToStaticMarkup(
      createElement(JobCard, { job, now: Date.now(), currentComparedCvHash: null, currentDescriptionHash: null })
    );
    const $ = load(html);
    assert.doesNotMatch($.root().text(), /Prep/);
  });

  test("renders interview prep panel with all sections when prep exists", () => {
    const { JobCard } = loadSource<{
      JobCard: (props: {
        job: GroupedJob;
        now: number;
        currentComparedCvHash: string | null;
        currentDescriptionHash: string | null;
      }) => ReturnType<typeof createElement>;
    }>("src/components/JobCard.tsx", uiModules);

    const job = makeJob({ interviewPrep: makePrep() });
    const html = renderToStaticMarkup(
      createElement(JobCard, {
        job,
        now: Date.now(),
        currentComparedCvHash: "def456",
        currentDescriptionHash: "abc123",
      })
    );
    const $ = load(html);
    const text = $.root().text();
    assert.match(text, /Interview Prep/);
    assert.match(text, /Prep Priorities/);
    assert.match(text, /Technical Questions/);
    assert.match(text, /Behavioral Questions/);
    assert.match(text, /Talking Points/);
    assert.match(text, /Questions to Ask/);
    assert.match(text, /Red Flags/);
    assert.match(text, /How would you design a rate limiter/);
  });

  test("shows stale badge when description hash differs", () => {
    const { JobCard } = loadSource<{
      JobCard: (props: {
        job: GroupedJob;
        now: number;
        currentComparedCvHash: string | null;
        currentDescriptionHash: string | null;
      }) => ReturnType<typeof createElement>;
    }>("src/components/JobCard.tsx", uiModules);

    const job = makeJob({ interviewPrep: makePrep({ descriptionHash: "old-hash" }) });
    const html = renderToStaticMarkup(
      createElement(JobCard, {
        job,
        now: Date.now(),
        currentComparedCvHash: "def456",
        currentDescriptionHash: "new-hash",
      })
    );
    const $ = load(html);
    assert.match($.root().text(), /re-generate available/i);
  });
});
