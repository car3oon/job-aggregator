import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as cheerio from "cheerio";
import { loadSource } from "../helpers.ts";
import type { ScrapedJob } from "../../src/scripts/scraper/types";

type AdapterModule = typeof import("../../src/scripts/scraper/adapters/nofluffjobs");
const { parseNoFluffJobsResponse } = loadSource<AdapterModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio });
const criteria = { category: ["frontend"], requirement: ["react"], city: ["remote"] };
const listingHtml = `<a class="posting-list-item" href="/pl/job/preview"><h3 class="posting-title__position">Preview offer</h3></a>
  <script id="serverApp-state">${JSON.stringify({
    USER_COUNTRY: { isoCode: "PL" },
    STORE_KEY: { searchResponse: { criteriaSearch: criteria } },
  })}</script>`;
const htmlResponse = () => new Response(listingHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
const posting = (url = "react-developer", reference = "reference-1") => ({
  title: "React Developer", name: "Example Company", url, reference, category: "frontend", technology: "React",
  seniority: ["Senior"], tiles: { values: [{ value: "TypeScript" }] },
  location: { fullyRemote: true, places: [{ city: "Remote" }, { city: "Warsaw" }] },
  salary: { from: 20_000, to: 25_000, currency: "PLN", period: "Month" },
});
const searchResponse = (postings = [posting()], totalPages = 1, totalCount = postings.length) =>
  Response.json({ postings, totalPages, totalCount });
function adapterWithFetch(fetchMock: typeof fetch, logs: string[] = []) {
  return loadSource<AdapterModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio }, {
    globals: { fetch: fetchMock, AbortSignal, URLSearchParams },
    console: { log: (message: string) => logs.push(message), error() {} },
  }).noFluffJobsAdapter;
}

describe("No Fluff Jobs search and pagination", () => {
  test("API metadata includes skills, location and salary, and deduplicates regional variants across pages", () => {
    const jobs = new Map<string, ScrapedJob>();
    parseNoFluffJobsResponse({ postings: [posting(), posting("react-developer-warsaw")] }, jobs);
    const parsed = parseNoFluffJobsResponse({ postings: [posting("react-developer-krakow"), posting("another", "reference-2")] }, jobs);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].url, "https://nofluffjobs.com/pl/job/react-developer");
    assert.match(parsed[0].rawContent, /React.*TypeScript/);
    assert.match(parsed[0].rawContent, /Remote Zdalnie/);
    assert.match(parsed[0].rawContent, /20000 25000 PLN Month/);
    assert.equal(parsed[0].rawContent.split("Example Company").length, 2);
  });

  test("API requests preserve the listing's category and filters and default to newest", async () => {
    let requests = 0;
    const adapter = adapterWithFetch(async (input, options) => {
      requests++;
      assert.ok(options?.signal instanceof AbortSignal);
      if (options.method !== "POST") return htmlResponse();
      const url = new URL(String(input));
      assert.equal(url.pathname, "/api/search/posting");
      assert.equal(url.searchParams.get("sort"), "newest");
      assert.equal(url.searchParams.get("region"), "pl");
      assert.equal(url.searchParams.get("page"), "1");
      assert.equal(url.searchParams.get("limit"), "20");
      assert.deepEqual(JSON.parse(String(options.body)), { criteriaSearch: criteria, withSalaryMatch: true });
      return searchResponse();
    });
    const jobs = await adapter.scrape("https://nofluffjobs.com/pl/frontend");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, "React Developer");
    assert.equal(requests, 2);
  });

  test("subsequent search pages are fetched with the configured sort", async () => {
    const pages: number[] = [];
    const adapter = adapterWithFetch(async (input, options) => {
      if (options?.method !== "POST") return htmlResponse();
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("sort"), "salary-desc");
      const page = Number(url.searchParams.get("page"));
      pages.push(page);
      return searchResponse([posting(`offer-${page}`, `reference-${page}`)], 2, 2);
    });
    const jobs = await adapter.scrape("https://nofluffjobs.com/pl/frontend?sort=salary-desc&criteria=requirement%3Dreact");
    assert.deepEqual(pages, [1, 2]);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[1].url, "https://nofluffjobs.com/pl/job/offer-2");
  });

  test("a failed later page rejects the source instead of reporting partial data as success", async () => {
    const adapter = adapterWithFetch(async (input, options) => {
      if (options?.method !== "POST") return htmlResponse();
      return new URL(String(input)).searchParams.get("page") === "1" ? searchResponse([posting()], 2, 2) : new Response("Unavailable", { status: 503 });
    });
    await assert.rejects(adapter.scrape("https://nofluffjobs.com/pl/frontend?sort=newest"), /page 2 failed with HTTP 503/);
  });

  test("malformed API responses fail instead of returning preview offers", async () => {
    for (const data of [
      { totalCount: 1, totalPages: 1 },
      { totalCount: 1, totalPages: 1, postings: [{}] },
      { totalCount: 1, totalPages: 1, postings: [posting("https://example.test/pl/job/test")] },
      { totalCount: 1, totalPages: 1, postings: [] },
      { totalCount: 1, totalPages: "1", postings: [posting()] },
      { totalCount: 1, totalPages: 0, postings: [posting()] },
    ]) {
      const adapter = adapterWithFetch(async (_, options) => options?.method === "POST" ? Response.json(data) : htmlResponse());
      await assert.rejects(adapter.scrape("https://nofluffjobs.com/pl/frontend"), /No Fluff Jobs/);
    }
  });

  test("the current empty API result does not retain stale preview offers", async () => {
    const adapter = adapterWithFetch(async (_, options) => options?.method === "POST" ? searchResponse([], 0, 0) : htmlResponse());
    assert.equal((await adapter.scrape("https://nofluffjobs.com/pl/frontend")).length, 0);
  });

  test("an unexpectedly empty later page fails even when earlier pages contained offers", async () => {
    const adapter = adapterWithFetch(async (input, options) => {
      if (options?.method !== "POST") return htmlResponse();
      return new URL(String(input)).searchParams.get("page") === "1" ? searchResponse([posting()], 2, 2) : searchResponse([], 2, 2);
    });
    await assert.rejects(adapter.scrape("https://nofluffjobs.com/pl/frontend"), /unexpectedly empty/);
  });

  test("the page limit stops further requests and is reported in logs", async () => {
    const logs: string[] = [];
    let requests = 0;
    const adapter = adapterWithFetch(async (input, options) => {
      if (options?.method !== "POST") return htmlResponse();
      requests++;
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("page"), String(requests));
      assert.equal(url.searchParams.get("limit"), "20");
      const offers = Array.from({ length: 20 }, (_, index) => [
        posting(`offer-${requests}-${index}`, `reference-${requests}-${index}`),
        posting(`offer-${requests}-${index}-warsaw`, `reference-${requests}-${index}`),
      ]).flat();
      return searchResponse(offers, 50, 1000);
    }, logs);
    const jobs = await adapter.scrape("https://nofluffjobs.com/pl/frontend");
    assert.equal(jobs.length, 100);
    assert.equal(requests, 5);
    assert.match(logs.join(" "), /5-page limit/);
    assert.match(logs.join(" "), /100 unique offers per source/);
  });

  test("overfilled API pages are capped at 20 unique offers each, up to 100 per source", async () => {
    let requests = 0;
    const adapter = adapterWithFetch(async (_, options) => {
      if (options?.method !== "POST") return htmlResponse();
      requests++;
      const offers = Array.from({ length: 30 }, (_, index) => posting(`offer-${requests}-${index}`, `reference-${requests}-${index}`));
      return searchResponse(offers, 50, 1500);
    });
    const jobs = await adapter.scrape("https://nofluffjobs.com/pl/frontend");
    assert.equal(jobs.length, 100);
    assert.equal(requests, 5);
    for (let page = 1; page <= 5; page++) {
      assert.equal(jobs.filter(job => job.url.includes(`/offer-${page}-`)).length, 20);
      assert.equal(jobs.some(job => job.url.endsWith(`/offer-${page}-20`)), false);
    }
  });

  test("repeated offers on later pages are deduplicated without fetching beyond five pages", async () => {
    let requests = 0;
    const adapter = adapterWithFetch(async (_, options) => {
      if (options?.method !== "POST") return htmlResponse();
      requests++;
      const offers = Array.from({ length: 20 }, (_, index) => posting(`offer-${index}-page-${requests}`, `reference-${index}`));
      return searchResponse(offers, 50, 1000);
    });
    const jobs = await adapter.scrape("https://nofluffjobs.com/pl/frontend");
    assert.equal(jobs.length, 20);
    assert.equal(requests, 5);
    assert.ok(jobs.every(job => job.url.endsWith("-page-1")));
  });
});
