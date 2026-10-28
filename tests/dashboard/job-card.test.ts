import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import type { GroupedJob } from "../../src/lib/job-grouping.ts";
import { loadSource } from "../helpers.ts";

const require = createRequire(import.meta.url);
const { createElement } = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { load } = require("cheerio") as typeof import("cheerio");

test("job cards render identical dates and New badges across time zones and hydration delays", () => {
  const originalZone = process.env.TZ;
  const now = Date.parse("2026-10-23T00:59:59Z");
  let clock = now;
  class RenderDate extends Date {
    static now() { return clock; }
  }
  const { JobCard } = loadSource<{ JobCard: (props: { job: GroupedJob; now: number }) => ReturnType<typeof createElement> }>("src/components/JobCard.tsx", {
    react: {
      useState: (initial: unknown) => [typeof initial === "boolean" ? true : initial, () => {}],
      useTransition: () => [false, (fn: () => void) => fn()],
    },
    "@/app/actions/job": { updateJobApplicationStatus: async () => ({ success: true }) },
    "react/jsx-runtime": require("react/jsx-runtime"), "lucide-react": require("lucide-react"),
  }, { globals: { Date: RenderDate } });
  const createdAt = new Date("2026-10-22T11:00:00Z");
  const job: GroupedJob = {
    id: "primary", title: "Senior React Developer", company: "Example", url: "https://example.test/senior",
    createdAt, updatedAt: createdAt, categories: [], workPreferences: [], sources: [],
    applicationStatus: "INBOX", appliedAt: null,
    relatedVariants: [{
      id: "mid", title: "Mid React Developer", url: "https://example.test/mid", createdAt, workPreferences: [], categories: [],
      sources: [{ source: "NoFluffJobs", url: "https://example.test/mid", createdAt },
        { source: "JustJoinIT", url: "https://example.test/mid-other", createdAt }],
    }],
  };
  try {
    process.env.TZ = "UTC";
    const serverHtml = renderToStaticMarkup(createElement(JobCard, { job, now }));
    process.env.TZ = "America/Los_Angeles";
    clock += 5000;
    const browserHtml = renderToStaticMarkup(createElement(JobCard, { job, now }));
    assert.equal(browserHtml, serverHtml);
    const $ = load(browserHtml);
    assert.match($.root().text(), /New/);
    assert.match($.root().text(), /22 Oct, 13:00/);
    assert.equal($("a[href='https://example.test/mid-other']").length, 1);
  } finally {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  }
});

test("job cards render Applied badge with application date when marked as APPLIED", () => {
  const now = Date.parse("2026-10-23T00:59:59Z");
  const { JobCard } = loadSource<{ JobCard: (props: { job: GroupedJob; now: number }) => ReturnType<typeof createElement> }>("src/components/JobCard.tsx", {
    react: {
      useState: (initial: unknown) => [typeof initial === "boolean" ? true : initial, () => {}],
      useTransition: () => [false, (fn: () => void) => fn()],
    },
    "@/app/actions/job": { updateJobApplicationStatus: async () => ({ success: true }) },
    "react/jsx-runtime": require("react/jsx-runtime"), "lucide-react": require("lucide-react"),
  });
  const createdAt = new Date("2026-10-20T10:00:00Z");
  const appliedAt = new Date("2026-10-21T14:30:00Z");
  const job: GroupedJob = {
    id: "primary", title: "Fullstack Engineer", company: "Acme", url: "https://example.test/job",
    createdAt, updatedAt: createdAt, categories: [], workPreferences: [], sources: [],
    relatedVariants: [], applicationStatus: "APPLIED", appliedAt,
  };
  const html = renderToStaticMarkup(createElement(JobCard, { job, now }));
  const $ = load(html);
  assert.match($.root().text(), /Applied • 21 Oct/);
});
