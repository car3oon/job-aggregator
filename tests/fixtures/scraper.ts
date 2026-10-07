import { loadSource } from "../helpers.ts";

const mode = process.argv[2] ?? "";
const record = (event: Record<string, unknown>) => console.log(JSON.stringify(event));
const job = { title: "React developer", url: "https://justjoin.it/job-offer/test", source: "JustJoinIT", rawContent: "React" };
let writes = 0;
const prisma = {
  scrapeHistory: {
    create: async () => {
      if (mode === "initial-history-failure") throw new Error("Initial history failed");
      return { id: "history" };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      if (mode === "history-update-failure") throw new Error("History update failed");
      record({ history: data });
    },
  },
  scraperUrl: { findMany: async () => mode === "no-targets" ? [] : [{ id: "target", url: "https://justjoin.it/all-offers" }] },
  category: { findMany: async () => {
    if (mode === "fatal-lookup" || mode === "history-update-failure") throw new Error("Lookup failed");
    return [];
  } },
  workPreference: { findMany: async () => [] },
  job: {
    findUnique: async () => mode === "nonmatching-existing" ? { id: "job" } : null,
    delete: async () => record({ deleted: true }),
    upsert: async () => {
      writes++;
      if (mode === "write-failure" || (mode === "partial" && writes === 2)) throw new Error("Write failed");
      record({ saved: true });
    },
  },
  $disconnect: async () => {
    record({ disconnected: true });
    if (mode === "disconnect-failure") throw new Error("Disconnect failed");
  },
};

const page = {
  on() {},
  goto: async () => {
    if (mode === "timeout") throw new Error("Navigation timeout");
    return { ok: () => false, status: () => 503 };
  },
};
const realAdapter = loadSource<typeof import("../../src/scripts/scraper/adapters/justjoinit")>("src/scripts/scraper/adapters/justjoinit.ts", {
  playwright: { chromium: { launch: async () => ({
    newContext: async () => {
      if (mode === "context-failure") throw new Error("Browser context failed");
      return { newPage: async () => page };
    },
    close: async () => record({ browserClosed: true }),
  }) } },
}).justJoinItAdapter;

loadSource("src/scripts/scraper/run.ts", {
  dotenv: { config() {} },
  "../../lib/prisma": { prisma },
  "./engine": { processJob: (raw: typeof job) => ({ ...raw, matchedCategories: mode === "nonmatching-existing" ? [] : ["Frontend"], matchedPreferences: [] }) },
  "./adapters/justjoinit": { justJoinItAdapter: ["timeout", "http-error", "context-failure"].includes(mode) ? realAdapter : {
    domain: "justjoin.it", sourceName: "JustJoinIT", scrape: async () => {
      if (mode === "source-failure") throw new Error("Source failed");
      if (mode === "empty") return [];
      return mode === "partial" ? [job, { ...job, url: job.url + "-2" }] : [job];
    },
  } },
}, { process });
