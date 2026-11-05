import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import { loadSource } from "./helpers.ts";

const require = createRequire(import.meta.url);
const react = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { load } = require("cheerio") as typeof import("cheerio");

type AssistantModule = typeof import("../src/lib/ai-assistant.ts");
type ChatRouteModule = typeof import("../src/app/api/chat/route.ts");

describe("AI Assistant Backend Library", () => {
  test("getJobsForAssistant builds proper Prisma where clauses and maps outputs", async () => {
    let capturedQuery: Record<string, unknown> | null = null;
    const fakeJobs = [
      {
        id: "job-1",
        title: "Frontend Engineer (Vue.js)",
        company: "Upvanta",
        url: "https://theprotocol.it/oferta/1",
        source: "Theprotocol.it",
        applicationStatus: "INBOX",
        appliedAt: null,
        createdAt: new Date("2026-10-27T10:00:00Z"),
        categories: [{ name: "Frontend" }],
        workPreferences: [{ name: "Remote" }],
      },
    ];

    const { getJobsForAssistant } = loadSource<AssistantModule>("src/lib/ai-assistant.ts", {
      "@/lib/prisma": {
        prisma: {
          job: {
            findMany: async (args: Record<string, unknown>) => {
              capturedQuery = args;
              return fakeJobs;
            },
          },
        },
      },
      "next/cache": { revalidatePath() {} },
    });

    const result = await getJobsForAssistant({
      query: "Vue.js",
      status: "INBOX",
      categorySlug: "frontend",
      limit: 5,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].title, "Frontend Engineer (Vue.js)");
    assert.equal(result[0].company, "Upvanta");
    assert.deepEqual(result[0].categories, ["Frontend"]);
    assert.deepEqual(result[0].workPreferences, ["Remote"]);

    assert.ok(capturedQuery);
    const where = (capturedQuery as { where: Record<string, unknown> }).where;
    assert.equal(where.applicationStatus, "INBOX");
    assert.equal(where.expiredAt, null);
    assert.equal((where.categories as { some: { slug: string } }).some.slug, "frontend");
  });

  test("updateJobStatusForAssistant updates by ID or searchQuery", async () => {
    let updateArgs: Record<string, unknown> | null = null;
    let findManyArgs: Record<string, unknown> | null = null;

    const { updateJobStatusForAssistant } = loadSource<AssistantModule>("src/lib/ai-assistant.ts", {
      "@/lib/prisma": {
        prisma: {
          job: {
            findMany: async (args: Record<string, unknown>) => {
              findManyArgs = args;
              return [{ id: "job-found-1", title: "React Developer", company: "Acme" }];
            },
            update: async (args: Record<string, unknown>) => {
              updateArgs = args;
              return {
                id: (args as { where: { id: string } }).where.id,
                title: "React Developer",
                company: "Acme",
                applicationStatus: (args as { data: { applicationStatus: string } }).data.applicationStatus,
                appliedAt: new Date("2026-10-28T12:00:00Z"),
              };
            },
          },
        },
      },
      "next/cache": { revalidatePath() {} },
    });

    // Update via unique searchQuery
    const res = await updateJobStatusForAssistant({
      searchQuery: "Acme",
      status: "APPLIED",
    });

    assert.equal(res.success, true);
    assert.ok(findManyArgs);
    assert.ok(updateArgs);
    assert.equal((updateArgs as { where: { id: string } }).where.id, "job-found-1");
    assert.equal((updateArgs as { data: { applicationStatus: string } }).data.applicationStatus, "APPLIED");
  });

  test("updateJobStatusForAssistant refuses to mutate ambiguous search matches", async () => {
    let updateCalled = false;

    const { updateJobStatusForAssistant } = loadSource<AssistantModule>("src/lib/ai-assistant.ts", {
      "@/lib/prisma": {
        prisma: {
          job: {
            findMany: async () => [
              { id: "1", title: "Frontend Developer", company: "Upvanta" },
              { id: "2", title: "Senior Fullstack Developer", company: "Upvanta" },
            ],
            update: async () => {
              updateCalled = true;
            },
          },
        },
      },
      "next/cache": { revalidatePath() {} },
    });

    const res = await updateJobStatusForAssistant({
      searchQuery: "Upvanta",
      status: "APPLIED",
    });

    assert.equal(res.success, false);
    assert.equal(updateCalled, false);
    assert.match(res.message, /Found multiple/);
  });

  test("getDashboardStatsForAssistant aggregates counts and last scrape", async () => {
    const { getDashboardStatsForAssistant } = loadSource<AssistantModule>("src/lib/ai-assistant.ts", {
      "@/lib/prisma": {
        prisma: {
          job: {
            count: async (args: { where: { applicationStatus?: string; expiredAt?: null } }) => {
              if (args.where.applicationStatus === "INBOX") return 40;
              if (args.where.applicationStatus === "SAVED") return 5;
              if (args.where.applicationStatus === "APPLIED") return 12;
              if (args.where.applicationStatus === "REJECTED") return 8;
              return 57; // total active
            },
          },
          scrapeHistory: {
            findFirst: async () => ({
              status: "SUCCESS",
              startedAt: new Date("2026-10-28T09:00:00Z"),
              endedAt: new Date("2026-10-28T09:05:00Z"),
              jobsAdded: 4,
              jobsUpdated: 15,
            }),
          },
        },
      },
      "next/cache": { revalidatePath() {} },
    });

    const stats = await getDashboardStatsForAssistant();
    assert.equal(stats.inboxJobs, 40);
    assert.equal(stats.savedJobs, 5);
    assert.equal(stats.appliedJobs, 12);
    assert.equal(stats.rejectedJobs, 8);
    assert.equal(stats.totalActiveJobs, 57);
    assert.equal(stats.lastScrape?.status, "SUCCESS");
    assert.equal(stats.lastScrape?.jobsAdded, 4);
  });

  test("triggerScraperForAssistant validates token and dispatches workflow", async () => {
    const { triggerScraperForAssistant } = loadSource<AssistantModule>("src/lib/ai-assistant.ts", {
      "@/lib/prisma": { prisma: {} },
      "next/cache": { revalidatePath() {} },
    }, { process: { env: {} } });

    const noToken = await triggerScraperForAssistant();
    assert.equal(noToken.success, false);
    assert.match(noToken.message, /GITHUB_TOKEN/);

    let fetchCalled = false;
    const { triggerScraperForAssistant: triggerWithToken } = loadSource<AssistantModule>("src/lib/ai-assistant.ts", {
      "@/lib/prisma": { prisma: {} },
      "next/cache": { revalidatePath() {} },
    }, {
      process: { env: { GITHUB_TOKEN: "fake-token" } },
      globals: {
        fetch: async () => {
          fetchCalled = true;
          return { ok: true, status: 204 };
        },
      },
    });

    const withToken = await triggerWithToken();
    assert.equal(withToken.success, true);
    assert.equal(fetchCalled, true);
    assert.match(withToken.message, /triggered on GitHub Actions/);
  });
});

describe("AI Assistant API Route Handler (/api/chat)", () => {
  test("rejects unauthenticated requests with 401", async () => {
    const { POST } = loadSource<ChatRouteModule>(
      "src/app/api/chat/route.ts",
      {
        "@/lib/auth": { isAuthenticated: async () => false },
        "ai": { streamText: () => {}, tool: (t: unknown) => t, convertToModelMessages: async (m: unknown) => m, isStepCount: () => () => false },
        "@ai-sdk/google": { createGoogleGenerativeAI: () => () => ({}) },
        "zod": { z: { object: () => ({}), string: () => ({ optional: () => ({ describe: () => ({}) }) }), enum: () => ({ optional: () => ({ describe: () => ({}) }), describe: () => ({}) }), number: () => ({ min: () => ({ max: () => ({ optional: () => ({ describe: () => ({}) }) }) }) }) } },
        "@/lib/ai-assistant": { getJobsForAssistant() {}, updateJobStatusForAssistant() {}, getDashboardStatsForAssistant() {}, triggerScraperForAssistant() {} },
      },
      { globals: { Request, Response } }
    );

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Unauthorized/i);
  });

  test("rejects missing Gemini API key with 400", async () => {
    const { POST } = loadSource<ChatRouteModule>(
      "src/app/api/chat/route.ts",
      {
        "@/lib/auth": { isAuthenticated: async () => true },
        "ai": { streamText: () => {}, tool: (t: unknown) => t, convertToModelMessages: async (m: unknown) => m, isStepCount: () => () => false },
        "@ai-sdk/google": { createGoogleGenerativeAI: () => () => ({}) },
        "zod": { z: { object: () => ({}), string: () => ({ optional: () => ({ describe: () => ({}) }) }), enum: () => ({ optional: () => ({ describe: () => ({}) }), describe: () => ({}) }), number: () => ({ min: () => ({ max: () => ({ optional: () => ({ describe: () => ({}) }) }) }) }) } },
        "@/lib/ai-assistant": { getJobsForAssistant() {}, updateJobStatusForAssistant() {}, getDashboardStatsForAssistant() {}, triggerScraperForAssistant() {} },
      },
      {
        process: { env: {} },
        globals: { Request, Response },
      }
    );

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", text: "hi" }] }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /API key is missing/i);
  });

  test("rejects malformed or empty messages with 400", async () => {
    const { POST } = loadSource<ChatRouteModule>(
      "src/app/api/chat/route.ts",
      {
        "@/lib/auth": { isAuthenticated: async () => true },
        "ai": { streamText: () => {}, tool: (t: unknown) => t, convertToModelMessages: async (m: unknown) => m, isStepCount: () => () => false },
        "@ai-sdk/google": { createGoogleGenerativeAI: () => () => ({}) },
        "zod": { z: { object: () => ({}), string: () => ({ optional: () => ({ describe: () => ({}) }) }), enum: () => ({ optional: () => ({ describe: () => ({}) }), describe: () => ({}) }), number: () => ({ min: () => ({ max: () => ({ optional: () => ({ describe: () => ({}) }) }) }) }) } },
        "@/lib/ai-assistant": { getJobsForAssistant() {}, updateJobStatusForAssistant() {}, getDashboardStatsForAssistant() {}, triggerScraperForAssistant() {} },
      },
      {
        process: { env: { GOOGLE_GENERATIVE_AI_API_KEY: "key" } },
        globals: { Request, Response },
      }
    );

    const emptyReq = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });
    const emptyRes = await POST(emptyReq);
    assert.equal(emptyRes.status, 400);
    assert.match((await emptyRes.json()).error, /non-empty array/i);

    const badJsonReq = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: "{ bad json",
    });
    const badJsonRes = await POST(badJsonReq);
    assert.equal(badJsonRes.status, 400);
    assert.match((await badJsonRes.json()).error, /Invalid JSON/i);
  });

  test("streams response when authenticated and API key is present", async () => {
    let streamTextCalledWith: Record<string, unknown> | null = null;

    const { POST } = loadSource<ChatRouteModule>(
      "src/app/api/chat/route.ts",
      {
        "@/lib/auth": { isAuthenticated: async () => true },
        "ai": {
          streamText: (opts: Record<string, unknown>) => {
            streamTextCalledWith = opts;
            return {
              toUIMessageStreamResponse: () =>
                new Response("stream-content", {
                  headers: { "Content-Type": "text/event-stream" },
                }),
            };
          },
          tool: (t: unknown) => t,
          convertToModelMessages: async (m: unknown) => m,
          isStepCount: () => () => false,
        },
        "@ai-sdk/google": {
          createGoogleGenerativeAI: (opts: { apiKey: string }) => {
            return (modelName: string) => ({ modelName, apiKey: opts.apiKey });
          },
        },
        "zod": {
          z: {
            object: () => ({}),
            string: () => ({ optional: () => ({ describe: () => ({}) }), describe: () => ({}) }),
            enum: () => ({ optional: () => ({ describe: () => ({}) }), describe: () => ({}) }),
            number: () => ({ min: () => ({ max: () => ({ optional: () => ({ describe: () => ({}) }) }) }) }),
          },
        },
        "@/lib/ai-assistant": { getJobsForAssistant() {}, updateJobStatusForAssistant() {}, getDashboardStatsForAssistant() {}, triggerScraperForAssistant() {} },
      },
      {
        process: { env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-gemini-key" } },
        globals: { Request, Response },
      }
    );

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "React jobs" }] }],
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/event-stream");
    assert.ok(streamTextCalledWith);
    assert.ok((streamTextCalledWith as { tools: unknown }).tools);
  });

  test("uses GEMINI_MODEL environment variable when specified", async () => {
    let requestedModel: string | null = null;

    const { POST } = loadSource<ChatRouteModule>(
      "src/app/api/chat/route.ts",
      {
        "@/lib/auth": { isAuthenticated: async () => true },
        "ai": {
          streamText: () => ({
            toUIMessageStreamResponse: () => new Response("ok"),
          }),
          tool: (t: unknown) => t,
          convertToModelMessages: async (m: unknown) => m,
          isStepCount: () => () => false,
        },
        "@ai-sdk/google": {
          createGoogleGenerativeAI: () => (modelName: string) => {
            requestedModel = modelName;
            return { modelName };
          },
        },
        "zod": {
          z: {
            object: () => ({}),
            string: () => ({ optional: () => ({ describe: () => ({}) }), describe: () => ({}) }),
            enum: () => ({ optional: () => ({ describe: () => ({}) }), describe: () => ({}) }),
            number: () => ({ min: () => ({ max: () => ({ optional: () => ({ describe: () => ({}) }) }) }) }),
          },
        },
        "@/lib/ai-assistant": { getJobsForAssistant() {}, updateJobStatusForAssistant() {}, getDashboardStatsForAssistant() {}, triggerScraperForAssistant() {} },
      },
      {
        process: {
          env: {
            GOOGLE_GENERATIVE_AI_API_KEY: "test-key",
            GEMINI_MODEL: "gemini-3.5-flash",
          },
        },
        globals: { Request, Response },
      }
    );

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      }),
    });

    await POST(req);
    assert.equal(requestedModel, "gemini-3.5-flash");
  });
});

describe("AI Assistant UI Components", () => {
  test("ChatJobCard renders offer title, company, source badge and action buttons", () => {
    const { ChatJobCard } = loadSource<typeof import("../src/components/chat/ChatJobCard.tsx")>(
      "src/components/chat/ChatJobCard.tsx",
      {
        react,
        "lucide-react": require("lucide-react"),
        "@/app/actions/job": {
          updateJobApplicationStatus: async () => ({ success: true }),
        },
        "@/components/ui/toast": { toast: { add: () => {} } },
        "react/jsx-runtime": require("react/jsx-runtime"),
      }
    );

    const job = {
      id: "job-101",
      title: "Senior React Engineer",
      company: "Vercel Partner",
      url: "https://example.com/job/101",
      source: "NoFluffJobs",
      applicationStatus: "INBOX" as const,
      appliedAt: null,
      createdAt: "2026-10-28T12:00:00Z",
      categories: ["Frontend"],
      workPreferences: ["Remote"],
    };

    const html = renderToStaticMarkup(react.createElement(ChatJobCard, { job }));
    const $ = load(html);

    assert.equal($("a[href='https://example.com/job/101']").text().trim(), "Senior React Engineer");
    assert.ok(html.includes("Vercel Partner"));
    assert.ok(html.includes("NoFluffJobs"));
    assert.ok(html.includes("Inbox"));
    assert.ok($("button[title='Save offer for later']").length > 0);
    assert.ok($("button[title='Mark offer as applied']").length > 0);
    assert.ok($("button[title='Mark offer as rejected']").length > 0);
  });

  test("ChatMessage renders user messages and assistant tool calls", () => {
    const { ChatMessage } = loadSource<typeof import("../src/components/chat/ChatMessage.tsx")>(
      "src/components/chat/ChatMessage.tsx",
      {
        react,
        "lucide-react": require("lucide-react"),
        "./ChatJobCard": {
          ChatJobCard: ({ job }: { job: { title: string } }) =>
            react.createElement("div", { "data-testid": "chat-job-card" }, job.title),
        },
        "react/jsx-runtime": require("react/jsx-runtime"),
      }
    );

    // 1. User message
    const userMsg = {
      id: "u-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Show recent React jobs" }],
    };
    const userHtml = renderToStaticMarkup(react.createElement(ChatMessage, { message: userMsg }));
    assert.ok(userHtml.includes("Show recent React jobs"));

    // 2. Assistant message with getJobs tool output
    const assistantMsg = {
      id: "a-1",
      role: "assistant" as const,
      parts: [
        { type: "text" as const, text: "Here is what I found:" },
        {
          type: "tool-getJobs" as const,
          toolCallId: "call-1",
          state: "output-available" as const,
          output: [
            {
              id: "job-1",
              title: "Staff React Engineer",
              company: "Tech Corp",
              url: "https://example.com/1",
              source: "Pracuj.pl",
              applicationStatus: "INBOX",
              appliedAt: null,
              createdAt: "2026-10-28T10:00:00Z",
              categories: [],
              workPreferences: [],
            },
          ],
        },
      ],
    };
    const assistantHtml = renderToStaticMarkup(
      react.createElement(ChatMessage, { message: assistantMsg as unknown as import("ai").UIMessage })
    );
    assert.ok(assistantHtml.includes("Here is what I found:"));
    assert.ok(assistantHtml.includes("Staff React Engineer"));

    // 3. Assistant message with dashboard stats
    const statsMsg = {
      id: "a-2",
      role: "assistant" as const,
      parts: [
        {
          type: "tool-getDashboardStats" as const,
          toolCallId: "call-2",
          state: "output-available" as const,
          output: {
            inboxJobs: 15,
            savedJobs: 3,
            appliedJobs: 7,
            rejectedJobs: 2,
            totalActiveJobs: 20,
            lastScrape: { status: "SUCCESS", jobsAdded: 4 },
          },
        },
      ],
    };
    const statsHtml = renderToStaticMarkup(
      react.createElement(ChatMessage, { message: statsMsg as unknown as import("ai").UIMessage })
    );
    assert.ok(statsHtml.includes("Platform Overview"));
    assert.ok(statsHtml.includes("15"));
    assert.ok(statsHtml.includes("3"));
    assert.ok(statsHtml.includes("7"));
  });

  test("AiAssistantSettings renders key status and current model", () => {
    const { AiAssistantSettings } = loadSource<typeof import("../src/components/AiAssistantSettings.tsx")>(
      "src/components/AiAssistantSettings.tsx",
      {
        react,
        "lucide-react": require("lucide-react"),
        "react/jsx-runtime": require("react/jsx-runtime"),
      }
    );

    const html = renderToStaticMarkup(
      react.createElement(AiAssistantSettings, {
        isConfigured: true,
        maskedApiKey: "AIza...1234",
        currentModel: "gemini-flash-lite-latest",
      })
    );

    assert.ok(html.includes("AIza...1234"));
    assert.ok(html.includes("Configured"));
    assert.ok(html.includes("gemini-flash-lite-latest"));
  });
});
