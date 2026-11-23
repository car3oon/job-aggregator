import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import type { GroupedJob, JobAnalysisSummary } from "../../src/lib/job-grouping.ts";
import { loadSource } from "../helpers.ts";

const require = createRequire(import.meta.url);
const { createElement } = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { load } = require("cheerio") as typeof import("cheerio");

const mockJobActions = { updateGroupedJobStatus: async () => ({ success: true }) };
const mockAnalysisActions = {
  analyzeJob: async () => ({ ok: false, error: "mock" }),
};
const baseModules = {
  react: {
    useState: (initial: unknown) => [typeof initial === "boolean" ? true : initial, () => {}],
    useTransition: () => [false, (fn: () => void) => fn()],
  },
  "@/app/actions/job": mockJobActions,
  "@/app/actions/jobAnalysisActions": mockAnalysisActions,
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
};

test("job cards render identical dates and New badges across time zones and hydration delays", () => {
  const originalZone = process.env.TZ;
  const now = Date.parse("2026-10-23T00:59:59Z");
  let clock = now;
  class RenderDate extends Date {
    static now() { return clock; }
  }
  const { JobCard } = loadSource<{ JobCard: (props: { job: GroupedJob; now: number; currentComparedCvHash: string | null; currentDescriptionHash: string | null }) => ReturnType<typeof createElement> }>("src/components/JobCard.tsx", {
    ...baseModules,
  }, { globals: { Date: RenderDate } });
  const createdAt = new Date("2026-10-22T11:00:00Z");
  const job: GroupedJob = {
    id: "primary", title: "Senior React Developer", company: "Example", url: "https://example.test/senior",
    createdAt, updatedAt: createdAt, categories: [], workPreferences: [], sources: [],
    applicationStatus: "INBOX", appliedAt: null,
    ...baseJob,
    relatedVariants: [{
      id: "mid", title: "Mid React Developer", url: "https://example.test/mid", createdAt, workPreferences: [], categories: [],
      sources: [{ source: "NoFluffJobs", url: "https://example.test/mid", createdAt },
        { source: "JustJoinIT", url: "https://example.test/mid-other", createdAt }],
    }],
  };
  try {
    process.env.TZ = "UTC";
    const serverHtml = renderToStaticMarkup(createElement(JobCard, { job, now, currentComparedCvHash: null, currentDescriptionHash: null }));
    process.env.TZ = "America/Los_Angeles";
    clock += 5000;
    const browserHtml = renderToStaticMarkup(createElement(JobCard, { job, now, currentComparedCvHash: null, currentDescriptionHash: null }));
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
  const { JobCard } = loadSource<{ JobCard: (props: { job: GroupedJob; now: number; currentComparedCvHash: string | null; currentDescriptionHash: string | null }) => ReturnType<typeof createElement> }>("src/components/JobCard.tsx", {
    ...baseModules,
  });
  const createdAt = new Date("2026-10-20T10:00:00Z");
  const appliedAt = new Date("2026-10-21T14:30:00Z");
  const job: GroupedJob = {
    id: "primary", title: "Fullstack Engineer", company: "Acme", url: "https://example.test/job",
    createdAt, updatedAt: createdAt, categories: [], workPreferences: [], sources: [],
    relatedVariants: [], applicationStatus: "APPLIED", appliedAt,
    ...baseJob,
  };
  const html = renderToStaticMarkup(createElement(JobCard, { job, now, currentComparedCvHash: null, currentDescriptionHash: null }));
  const $ = load(html);
  assert.match($.root().text(), /Applied • 21 Oct/);
});

test("multi-source job cards use provider badges instead of a single title link", () => {
  const now = Date.parse("2026-10-23T00:59:59Z");
  const { JobCard } = loadSource<{ JobCard: (props: { job: GroupedJob; now: number; currentComparedCvHash: string | null; currentDescriptionHash: string | null }) => ReturnType<typeof createElement> }>("src/components/JobCard.tsx", {
    ...baseModules,
  });
  const createdAt = new Date("2026-10-20T10:00:00Z");
  const job: GroupedJob = {
    id: "primary", title: "Fullstack Engineer", company: "Acme", url: "https://example.test/primary",
    createdAt, updatedAt: createdAt, categories: [], workPreferences: [],
    sources: [
      { source: "JustJoinIT", url: "https://justjoin.it/job-offer/primary", createdAt },
      { source: "Pracuj.pl", url: "https://www.pracuj.pl/praca/primary,oferta,123", createdAt },
    ],
    relatedVariants: [], applicationStatus: "INBOX", appliedAt: null,
    ...baseJob,
  };

  const $ = load(renderToStaticMarkup(createElement(JobCard, { job, now, currentComparedCvHash: null, currentDescriptionHash: null })));
  assert.equal($("a[href='https://example.test/primary']").length, 0);
  assert.equal($("a[href='https://justjoin.it/job-offer/primary']").length, 1);
  assert.equal($("a[href='https://www.pracuj.pl/praca/primary,oferta,123']").length, 1);
});

test("job cards mark analysis stale when the description changes", () => {
  const now = Date.parse("2026-10-23T00:59:59Z");
  const { JobCard } = loadSource<{ JobCard: (props: { job: GroupedJob; now: number; currentComparedCvHash: string | null; currentDescriptionHash: string | null }) => ReturnType<typeof createElement> }>("src/components/JobCard.tsx", {
    ...baseModules,
    react: {
      useState: (initial: unknown) => [initial, () => {}],
      useTransition: () => [false, (fn: () => void) => fn()],
    },
  });
  const createdAt = new Date("2026-10-20T10:00:00Z");
  const job: GroupedJob = {
    id: "primary", title: "Fullstack Engineer", company: "Acme", url: "https://example.test/job",
    createdAt, updatedAt: createdAt, categories: [], workPreferences: [], sources: [],
    relatedVariants: [], applicationStatus: "INBOX", appliedAt: null, hasDescription: true,
    analysis: {
      id: "analysis-1",
      summary: "A role summary",
      requiredSkills: [],
      seniority: null,
      location: null,
      workMode: null,
      compensation: null,
      workPreferenceDiff: null,
      recommendedCvId: null,
      recommendedCvLabel: null,
      cvMatchReason: null,
      cvMatchStrengths: [],
      cvMatchGaps: [],
      descriptionHash: "old-description-hash",
      comparedCvHash: null,
      workPreferencesHash: null,
      analyzedAt: createdAt,
    },
  };

  const $ = load(renderToStaticMarkup(createElement(JobCard, {
    job,
    now,
    currentComparedCvHash: null,
    currentDescriptionHash: "new-description-hash",
  })));
  assert.match($.root().text(), /Job, CV, or work preference data changed — re-analyze available/);
  // The header button must stay a hide/show toggle even when the result is stale.
  assert.equal($("button[title='Hide AI Analysis']").length, 1);
});

test("job cards mark analysis stale when active work preferences change", () => {
  const now = Date.parse("2026-10-23T00:59:59Z");
  const { JobCard } = loadSource<{
    JobCard: (props: {
      job: GroupedJob;
      now: number;
      currentComparedCvHash: string | null;
      currentDescriptionHash: string | null;
      currentWorkPreferencesHash?: string | null;
    }) => ReturnType<typeof createElement>;
  }>("src/components/JobCard.tsx", {
    ...baseModules,
    react: {
      useState: (initial: unknown) => [initial, () => {}],
      useTransition: () => [false, (fn: () => void) => fn()],
    },
  });
  const createdAt = new Date("2026-10-20T10:00:00Z");
  const job: GroupedJob = {
    id: "primary",
    title: "Fullstack Engineer",
    company: "Acme",
    url: "https://example.test/job",
    createdAt,
    updatedAt: createdAt,
    categories: [],
    workPreferences: [],
    sources: [],
    relatedVariants: [],
    applicationStatus: "INBOX",
    appliedAt: null,
    hasDescription: true,
    analysis: {
      id: "analysis-1",
      summary: "A role summary",
      requiredSkills: [],
      seniority: null,
      location: null,
      workMode: null,
      compensation: null,
      workPreferenceDiff: null,
      recommendedCvId: null,
      recommendedCvLabel: null,
      cvMatchReason: null,
      cvMatchStrengths: [],
      cvMatchGaps: [],
      descriptionHash: "description-hash",
      comparedCvHash: null,
      workPreferencesHash: "old-preferences-hash",
      analyzedAt: createdAt,
    },
  };

  const $ = load(
    renderToStaticMarkup(
      createElement(JobCard, {
        job,
        now,
        currentComparedCvHash: null,
        currentDescriptionHash: "description-hash",
        currentWorkPreferencesHash: "new-preferences-hash",
      })
    )
  );
  assert.match($.root().text(), /Job, CV, or work preference data changed — re-analyze available/);
});

test("the header AI button never re-runs an existing analysis", () => {
  const { shouldStartAnalysis } = loadSource<{
    shouldStartAnalysis: (analysis: JobAnalysisSummary | null) => boolean;
  }>("src/components/JobCard.tsx", baseModules);

  assert.equal(shouldStartAnalysis(null), true);

  const staleAnalysis: JobAnalysisSummary = {
    id: "analysis-1",
    summary: "A role summary",
    requiredSkills: [],
    seniority: null,
    location: null,
    workMode: null,
    compensation: null,
    workPreferenceDiff: null,
    recommendedCvId: null,
    recommendedCvLabel: null,
    cvMatchReason: null,
    cvMatchStrengths: [],
    cvMatchGaps: [],
    descriptionHash: "old-description-hash",
    comparedCvHash: null,
    workPreferencesHash: null,
    analyzedAt: new Date("2026-10-20T10:00:00Z"),
  };

  assert.equal(shouldStartAnalysis(staleAnalysis), false);
});

test("job cards display gap feedback and missing skill badges when no CV matches", () => {
  const now = Date.parse("2026-10-23T00:59:59Z");
  const { JobCard } = loadSource<{
    JobCard: (props: {
      job: GroupedJob;
      now: number;
      currentComparedCvHash: string | null;
      currentDescriptionHash: string | null;
      currentWorkPreferencesHash?: string | null;
    }) => ReturnType<typeof createElement>;
  }>("src/components/JobCard.tsx", {
    ...baseModules,
    react: {
      useState: (initial: unknown) => [initial, () => {}],
      useTransition: () => [false, (fn: () => void) => fn()],
    },
  });
  const createdAt = new Date("2026-10-20T10:00:00Z");
  const job: GroupedJob = {
    id: "primary",
    title: "Frontend Developer (with German)",
    company: "Innowise",
    url: "https://example.test/job",
    createdAt,
    updatedAt: createdAt,
    categories: [],
    workPreferences: [],
    sources: [],
    relatedVariants: [],
    applicationStatus: "INBOX",
    appliedAt: null,
    hasDescription: true,
    analysis: {
      id: "analysis-german",
      summary: "Frontend role requiring German language.",
      requiredSkills: ["React", "TypeScript", "German language"],
      seniority: "Mid",
      location: "Warszawa",
      workMode: null,
      compensation: null,
      workPreferenceDiff:
        "The listing is hybrid in Warsaw, while your preference is hybrid in Wrocław.",
      recommendedCvId: null,
      recommendedCvLabel: null,
      cvMatchReason:
        "None of the provided CVs mention German language proficiency.",
      cvMatchStrengths: ["React", "TypeScript"],
      cvMatchGaps: ["German language proficiency"],
      descriptionHash: "desc-hash",
      comparedCvHash: "cv-hash",
      workPreferencesHash: "pref-hash",
      analyzedAt: createdAt,
    },
  };

  const $ = load(
    renderToStaticMarkup(
      createElement(JobCard, {
        job,
        now,
        currentComparedCvHash: "cv-hash",
        currentDescriptionHash: "desc-hash",
        currentWorkPreferencesHash: "pref-hash",
      })
    )
  );

  assert.match($.root().text(), /No matching CV recommended/);
  assert.match(
    $.root().text(),
    /None of the provided CVs mention German language proficiency/
  );
  assert.match($.root().text(), /Gaps \/ Missing requirements/);
  assert.match($.root().text(), /German language proficiency/);
  assert.match($.root().text(), /Work preference difference/);
  assert.match(
    $.root().text(),
    /The listing is hybrid in Warsaw, while your preference is hybrid in Wrocław/
  );
  // Missing skill badge check
  const missingBadge = $("[title='Missing in your CVs']");
  assert.equal(missingBadge.length, 1);
  assert.match(missingBadge.text(), /German language/);
});

