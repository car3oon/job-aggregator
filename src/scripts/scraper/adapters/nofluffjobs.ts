import { load } from "cheerio";
import type { ScrapedJob, ScraperAdapter } from "../types";

const domain = "nofluffjobs.com";
const sourceName = "NoFluffJobs";
const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();

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
    return parseNoFluffJobs(await response.text());
  },
};
