import { streamText, tool, convertToModelMessages, isStepCount } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import {
  getJobsForAssistant,
  updateJobStatusForAssistant,
  getDashboardStatsForAssistant,
  triggerScraperForAssistant,
} from "@/lib/ai-assistant";

export const maxDuration = 60;

export async function POST(req: Request) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized access. Please log in." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "Google Gemini API key is missing. Please set GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY in your environment or .env.local file.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const modelName =
    process.env.GEMINI_MODEL ||
    process.env.AI_MODEL ||
    "gemini-flash-lite-latest";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawMessages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return new Response(JSON.stringify({ error: "Expected 'messages' to be a non-empty array." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Bound message history to last 20 messages to prevent unbounded context growth
  const boundedMessages = rawMessages.slice(-20);

  const google = createGoogleGenerativeAI({ apiKey });

  const modelMessages =
    "parts" in (boundedMessages[0] as Record<string, unknown>)
      ? await convertToModelMessages(boundedMessages)
      : boundedMessages;

  const result = streamText({
    model: google(modelName),
    system: `You are an AI Assistant for Job Aggregator, an application that collects, deduplicates, and filters tech job listings.
You help the user:
1. Search and inspect job offers (by technology, keyword, seniority, company, or status like INBOX, SAVED, APPLIED, REJECTED).
2. Update application statuses (e.g. marking offers as APPLIED when they sent a CV, SAVED to apply later, or REJECTED).
3. Check platform statistics (how many jobs are in inbox, how many saved or applied, when was the last scraper run).
4. Trigger the scraper to fetch new job offers on demand.

Tool usage guidelines:
- When the user asks for offers (e.g. "show recent 5 React jobs", "what jobs did I save?"), call the 'getJobs' tool.
- CRITICAL RENDERING RULE: When calling 'getJobs', the frontend automatically displays interactive, clickable job cards containing the title, company, portal link, tech stack, and action buttons (Save, Apply, Reject). Therefore, you must NEVER output a list, numbered list, or bullet points repeating the job details in your text! Only provide a brief, single-sentence introduction (e.g. "Here are the recent React job offers found in your inbox:" or "Found 5 matching offers:") without repeating the contents of the cards.
- When the user asks to mark or reject an offer (e.g. "mark offer at Upvanta as applied", "save the Senior Vue job for later"), call 'updateJobStatus'.
- When the user asks about stats or scraper runs, call 'getDashboardStats'.
- When the user asks to run, trigger, or launch the scraper (e.g. "odpal scrapera", "run scraper", "fetch new offers"), call 'triggerScraper'.
- Keep your answers concise, clear, and informative. Reply in the same language the user uses (Polish or English).`,
    messages: modelMessages,
    stopWhen: isStepCount(3),
    tools: {
      getJobs: tool({
        description: "Fetch and filter job offers from the database based on query, technology, category, or application status.",
        inputSchema: z.object({
          query: z.string().optional().describe("Keywords to match in title, company, or tech stack (e.g. 'React', 'Vue', 'AWS', 'Upvanta')"),
          status: z.enum(["INBOX", "SAVED", "APPLIED", "REJECTED", "ALL"]).optional().describe("Application status filter. Defaults to INBOX (active unhandled offers)."),
          categorySlug: z.string().optional().describe("Category slug if filtering by a specific category (e.g. 'frontend', 'fullstack')."),
          limit: z.number().min(1).max(20).optional().describe("Number of offers to return (default 5, max 20)."),
        }),
        execute: async (args) => {
          return await getJobsForAssistant(args);
        },
      }),

      updateJobStatus: tool({
        description: "Update the application status of a job offer (INBOX, SAVED, APPLIED, REJECTED).",
        inputSchema: z.object({
          jobId: z.string().optional().describe("Unique job ID if known."),
          searchQuery: z.string().optional().describe("Company name or job title to find the offer if ID is unknown."),
          status: z.enum(["INBOX", "SAVED", "APPLIED", "REJECTED"]).describe("New status to set."),
        }),
        execute: async (args) => {
          return await updateJobStatusForAssistant(args);
        },
      }),

      getDashboardStats: tool({
        description: "Retrieve dashboard counts (inbox, saved, applied, rejected) and details of the latest scraper run.",
        inputSchema: z.object({}),
        execute: async () => {
          return await getDashboardStatsForAssistant();
        },
      }),

      triggerScraper: tool({
        description: "Trigger a new scraper workflow run on GitHub Actions to fetch fresh job offers from all configured portals.",
        inputSchema: z.object({}),
        execute: async () => {
          return await triggerScraperForAssistant();
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      if (error instanceof Error) {
        return error.message;
      }
      return "An unexpected error occurred while communicating with the AI model.";
    },
  });
}
