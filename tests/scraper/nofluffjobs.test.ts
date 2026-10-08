import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as cheerio from "cheerio";
import { loadSource } from "../helpers.ts";
import type { ScrapedJob } from "../../src/scripts/scraper/types";

type AdapterModule = typeof import("../../src/scripts/scraper/adapters/nofluffjobs");
const { parseNoFluffJobs } = loadSource<AdapterModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio });

const card = (href = "/pl/job/react-developer", title = "React Developer") => `
  <a class="posting-list-item" href="${href}">
    <h3 class="posting-title__position">${title}<span class="title-badge" data-cy="sup">NEW</span></h3>
    <span data-cy="salary ranges on the job offer listing">20 000 – 25 000 PLN/month</span>
    <span>React</span><span>TypeScript</span><span>JavaScript</span>
    <h4 class="company-name"> Example &amp; Company </h4>
    <nfj-posting-item-city><span>Zdalnie</span><span>Warsaw</span></nfj-posting-item-city>
  </a>`;

describe("No Fluff Jobs adapter", () => {
  test("No Fluff Jobs extracts offer metadata and preserves adjacent keyword boundaries", () => {
    const jobs = parseNoFluffJobs(card());
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, "React Developer");
    assert.equal(jobs[0].company, "Example & Company");
    assert.equal(jobs[0].url, "https://nofluffjobs.com/pl/job/react-developer");
    assert.equal(jobs[0].source, "NoFluffJobs");
    assert.match(jobs[0].rawContent, /React TypeScript JavaScript/);
    assert.match(jobs[0].rawContent, /Zdalnie Warsaw/);
    assert.match(jobs[0].rawContent, /20 000/);
  });

  test("No Fluff Jobs listing text works with category AND rules, exclusions and work preferences", () => {
    const { processJob } = loadSource<{
      processJob: (job: ScrapedJob, categories: unknown[], preferences: unknown[]) => {
        matchedCategories: string[]; matchedPreferences: string[];
      };
    }>("src/scripts/scraper/engine.ts");
    const job = processJob(parseNoFluffJobs(card())[0], [
      { name: "Frontend", keywords: ["react + typescript"], excluded: ["java"] },
      { name: "Excluded", keywords: ["react"], excluded: ["javascript"] },
      { name: "Backend", keywords: ["react + python"], excluded: [] },
    ], [
      { name: "Remote", keywords: ["zdalnie"], isActive: true },
      { name: "Inactive", keywords: ["zdalnie"], isActive: false },
    ]);
    assert.deepEqual(Array.from(job.matchedCategories), ["Frontend"]);
    assert.deepEqual(Array.from(job.matchedPreferences), ["Remote"]);
  });

  test("No Fluff Jobs deduplicates promoted offers, removes tracking and retains metadata", () => {
    const jobs = parseNoFluffJobs(
      card("/pl/job/react-developer/?utm_source=promotion#details") +
      card("https://nofluffjobs.com/pl/job/react-developer").replace("Warsaw", "Krakow") +
      card("/pl/job/another-developer", "Another Developer"),
    );
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].url, "https://nofluffjobs.com/pl/job/react-developer");
    assert.match(jobs[0].rawContent, /Warsaw/);
    assert.match(jobs[0].rawContent, /Krakow/);
  });

  test("No Fluff Jobs tolerates an absent company", () => {
    const jobs = parseNoFluffJobs(card().replace(/<h4.*?<\/h4>/, ""));
    assert.equal(jobs[0].company, undefined);
  });

  for (const [name, html, error] of [
    ["missing title", card("/pl/job/react-developer", ""), /without a title/],
    ["missing URL", card().replace('href="/pl/job/react-developer"', ""), /without a URL/],
    ["external offer", card("https://example.test/pl/job/offer"), /Expected a No Fluff Jobs/],
    ["listing link instead of offer", card("/pl/frontend"), /unexpected offer URL/],
    ["changed layout", "<html><body>Job listing moved</body></html>", /offers were not found/],
    ["access challenge", "<html><body>Verify you are human</body></html>", /offers were not found/],
    ["invalid server state", '<script id="serverApp-state">invalid JSON</script>', /offers were not found/],
    ["nonempty server state without cards", '<script id="serverApp-state">{"STORE_KEY":{"searchResponse":{"totalCount":1,"postings":[]}}}</script>', /offers were not found/],
  ] as const) {
    test(`No Fluff Jobs rejects ${name}`, () => assert.throws(() => parseNoFluffJobs(html), error));
  }

  for (const key of ["searchResponse", "homePageResponse"]) {
    test(`No Fluff Jobs accepts explicitly empty ${key}`, () => {
      const state = JSON.stringify({ STORE_KEY: { [key]: { totalCount: 0, postings: [] } } });
      assert.equal(parseNoFluffJobs(`<script id="serverApp-state">${state}</script>`).length, 0);
    });
  }

  function adapterWithFetch(fetchMock: typeof fetch) {
    return loadSource<AdapterModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio }, {
      globals: { fetch: fetchMock, AbortSignal },
    }).noFluffJobsAdapter;
  }

  test("No Fluff Jobs fetches configured listing with a timeout and parses the response", async () => {
    const adapter = adapterWithFetch(async (input, options) => {
      assert.equal(String(input), "https://nofluffjobs.com/pl/frontend");
      assert.ok(options?.signal instanceof AbortSignal);
      assert.equal(options.signal.aborted, false);
      return new Response(card(), { headers: { "content-type": "text/html; charset=utf-8" } });
    });
    const jobs = await adapter.scrape("https://nofluffjobs.com/pl/frontend");
    assert.equal(jobs[0].title, "React Developer");
  });

  test("No Fluff Jobs propagates HTTP, content type, network and timeout failures", async () => {
    const scenarios: [typeof fetch, RegExp][] = [
      [async () => new Response("Blocked", { status: 403 }), /HTTP 403/],
      [async () => new Response("Unavailable", { status: 503 }), /HTTP 503/],
      [async () => new Response("{}", { headers: { "content-type": "application/json" } }), /content type/],
      [async () => { throw new Error("Network failure"); }, /Network failure/],
      [async () => { throw new DOMException("Request timed out", "TimeoutError"); }, /timed out/],
      [async () => new Response("<html>Challenge</html>", { headers: { "content-type": "text/html" } }), /offers were not found/],
    ];
    for (const [fetchMock, error] of scenarios) {
      await assert.rejects(adapterWithFetch(fetchMock).scrape("https://nofluffjobs.com/pl"), error);
    }
  });

  test("No Fluff Jobs rejects invalid targets before making a request", async () => {
    let requested = false;
    const adapter = adapterWithFetch(async () => { requested = true; return new Response(card()); });
    for (const url of ["https://nofluffjobs.com.example.test/pl", "file://nofluffjobs.com/pl", "https://user:password@nofluffjobs.com/pl"]) {
      await assert.rejects(adapter.scrape(url), /Expected a No Fluff Jobs/);
    }
    assert.equal(requested, false);
  });
});
