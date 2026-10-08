import { load } from "cheerio";
import type { ScrapedJob, ScraperAdapter } from "../types";

const domain = "nofluffjobs.com";
const sourceName = "NoFluffJobs";
const maxPages = 5;
const pageSize = 20;
const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? normalizeText(value) : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function mergeJob(jobs: Map<string, ScrapedJob>, key: string, job: ScrapedJob): void {
  const previous = jobs.get(key);
  if (previous) {
    if (!previous.rawContent.includes(job.rawContent)) previous.rawContent += ` ${job.rawContent}`;
  } else {
    jobs.set(key, job);
  }
}

export function parseNoFluffJobsResponse(value: unknown, jobs = new Map<string, ScrapedJob>()): ScrapedJob[] {
  const response = record(value);
  if (!Array.isArray(response.postings)) throw new Error("No Fluff Jobs search response is missing postings");
  for (const item of response.postings) {
    const posting = record(item);
    const title = text(posting.title);
    const slug = text(posting.url);
    if (!title || !slug) throw new Error("No Fluff Jobs search response contains an invalid offer");
    const url = validateUrl(new URL(slug.startsWith("/") || /^https?:/.test(slug) ? slug : `/pl/job/${slug}`, `https://${domain}`).href);
    if (!/^\/(?:[a-z]{2}\/)?job\/[^/]+\/?$/.test(url.pathname)) {
      throw new Error("No Fluff Jobs search response contains an unexpected offer URL");
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    const company = text(posting.name) || undefined;
    const location = record(posting.location);
    const places = Array.isArray(location.places) ? location.places : [];
    const tiles = record(posting.tiles);
    const skills = Array.isArray(tiles.values) ? tiles.values.map(tile => text(record(tile).value)) : [];
    const salary = record(posting.salary);
    const content = normalizeText([
      title, company, text(posting.category), text(posting.technology), ...strings(posting.seniority), ...skills,
      ...places.flatMap(place => {
        const entry = record(place);
        return [text(entry.city), text(entry.province), text(record(entry.country).name)];
      }),
      posting.fullyRemote === true || location.fullyRemote === true ? "Remote Zdalnie" : "",
      typeof salary.from === "number" ? String(salary.from) : "",
      typeof salary.to === "number" ? String(salary.to) : "",
      text(salary.currency), text(salary.period), text(salary.type),
    ].filter(Boolean).join(" "));
    // The search API returns regional variants of the same offer as separate postings.
    const key = text(posting.reference) || url.href;
    mergeJob(jobs, key, { title, company, url: url.href, source: sourceName, rawContent: content });
  }
  return [...jobs.values()];
}

function validateUrl(value: string): URL {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !(url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ||
    url.username || url.password
  ) {
    throw new Error("Expected a No Fluff Jobs HTTP(S) URL");
  }
  return url;
}

export function parseNoFluffJobs(html: string): ScrapedJob[] {
  const $ = load(html);
  const jobs = new Map<string, ScrapedJob>();

  $("a.posting-list-item").each((_, element) => {
    const card = $(element);
    const href = card.attr("href");
    if (!href) throw new Error("No Fluff Jobs listing contains an offer without a URL");

    const url = validateUrl(new URL(href, `https://${domain}`).href);
    if (!/^\/(?:[a-z]{2}\/)?job\/[^/]+\/?$/.test(url.pathname)) {
      throw new Error("No Fluff Jobs listing contains an unexpected offer URL");
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");

    const titleElement = card.find("h3.posting-title__position").clone();
    titleElement.find(".title-badge, [data-cy='sup']").remove();
    const title = normalizeText(titleElement.text());
    if (!title) throw new Error("No Fluff Jobs listing contains an offer without a title");

    const content = card.clone();
    content.find("script, style").remove();
    // Preserve word boundaries between adjacent technology and location elements.
    content.find("*").append(" ");
    const rawContent = normalizeText(content.text());
    const company = normalizeText(card.find(".company-name").text()) || undefined;
    const job: ScrapedJob = { title, company, url: url.href, source: sourceName, rawContent };
    const previous = jobs.get(job.url);
    // Promoted offers can also appear in the main listing; retain both sets of metadata.
    jobs.set(job.url, previous ? { ...job, rawContent: `${previous.rawContent} ${rawContent}` } : job);
  });

  if (jobs.size > 0) return [...jobs.values()];

  // Only accept an empty result when the server explicitly confirms a zero-result listing.
  const stateText = $("script#serverApp-state").text();
  if (stateText) {
    try {
      const state = JSON.parse(stateText);
      const result = state?.STORE_KEY?.searchResponse ?? state?.STORE_KEY?.homePageResponse;
      if (result?.totalCount === 0 && Array.isArray(result.postings) && result.postings.length === 0) {
        return [];
      }
    } catch {
      // Invalid server state must not turn an unrecognized page into a successful empty run.
    }
  }

  throw new Error("No Fluff Jobs offers were not found; the page may be blocked or its layout has changed");
}

export const noFluffJobsAdapter: ScraperAdapter = {
  sourceName,
  domain,
  async scrape(value) {
    const url = validateUrl(value);
    const response = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": "JobAggregator/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`No Fluff Jobs request failed with HTTP ${response.status}`);
    if (response.url) validateUrl(response.url);
    if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
      throw new Error("No Fluff Jobs returned an unexpected content type");
    }
    const html = await response.text();
    const $ = load(html);
    let state: Record<string, unknown>;
    try {
      state = record(JSON.parse($("script#serverApp-state").text()));
    } catch {
      throw new Error("No Fluff Jobs listing is missing valid search state");
    }
    const store = record(state.STORE_KEY);
    const listing = record(store.searchResponse ?? store.homePageResponse);
    const criteria = record(listing.criteriaSearch);
    if (Object.keys(criteria).length === 0) throw new Error("No Fluff Jobs listing is missing search criteria");

    const region = text(record(state.USER_COUNTRY).isoCode).toLowerCase() || "pl";
    // Validate the preview, but return only the current API results, not stale preview offers.
    parseNoFluffJobs(html);
    const jobs = new Map<string, ScrapedJob>();
    // Fetch actual search results instead of relying on the small server-rendered preview.
    for (let page = 1; page <= maxPages; page++) {
      const endpoint = new URL(`https://${domain}/api/search/posting`);
      endpoint.search = new URLSearchParams({
        page: String(page), sort: url.searchParams.get("sort") || "newest", limit: String(pageSize),
        region, withSalaryMatch: "true", salaryCurrency: "original", salaryPeriod: "original",
      }).toString();
      const search = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/postingSearch+json", "User-Agent": "JobAggregator/1.0" },
        body: JSON.stringify({ criteriaSearch: criteria, withSalaryMatch: true }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!search.ok) throw new Error(`No Fluff Jobs search page ${page} failed with HTTP ${search.status}`);
      const data = record(await search.json());
      if (typeof data.totalPages !== "number" || !Number.isInteger(data.totalPages) || data.totalPages < 0 ||
          typeof data.totalCount !== "number" || !Number.isInteger(data.totalCount) || data.totalCount < 0 ||
          (data.totalCount > 0 && data.totalPages === 0)) {
        throw new Error("No Fluff Jobs search response contains invalid pagination");
      }
      const pageJobs = new Map<string, ScrapedJob>();
      parseNoFluffJobsResponse(data, pageJobs);
      // Apply the limit after collapsing regional variants, even if the API overfills a page.
      for (const [key, job] of [...pageJobs].slice(0, pageSize)) mergeJob(jobs, key, job);
      if (Array.isArray(data.postings) && data.postings.length === 0 && data.totalCount > 0) {
        throw new Error("No Fluff Jobs returned an unexpectedly empty search page");
      }
      if (page >= data.totalPages) return [...jobs.values()];
      if (page === maxPages) console.log(`No Fluff Jobs: reached the ${maxPages}-page limit (${data.totalPages} available), up to ${maxPages * pageSize} unique offers per source.`);
    }
    return [...jobs.values()];
  },
};
