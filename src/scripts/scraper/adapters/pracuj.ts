import { chromium } from "playwright";
import { load } from "cheerio";
import type { ScrapedJob, ScraperAdapter } from "../types";

const domain = "pracuj.pl";
const sourceName = "Pracuj.pl";
const pageSize = 20;
const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();
const text = (value: unknown) => typeof value === "string" ? normalizeText(value) : "";
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const integer = (value: unknown, minimum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;

function validateUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) ||
      !(url.hostname === domain || url.hostname === `www.${domain}` || url.hostname === `it.${domain}`) ||
      url.username || url.password || url.port) {
    throw new Error("Expected a Pracuj.pl HTTP(S) URL");
  }
  return url;
}

export function getPracujPageUrl(value: string, page: number): string {
  const url = validateUrl(value);
  if (!/^\/praca(?:\/|$)/.test(url.pathname) || url.pathname.includes(",oferta,") || !integer(page, 1)) {
    throw new Error("Expected a Pracuj.pl search URL and a positive page number");
  }
  // Search links may encode pagination and sorting as path segments instead of a query.
  url.pathname = url.pathname.replace(/\/[^/]+(?:;|%3B)(?:pn|rop|sc)(?=\/|$)/gi, "");
  url.searchParams.set("sc", "0"); // Newest, verified against the portal's sort control.
  url.searchParams.set("pn", String(page));
  url.searchParams.set("rop", String(pageSize));
  url.hash = "";
  return url.href;
}

function plainText(value: unknown): string {
  const $ = load(text(value));
  $("script, style").remove();
  $("*").append(" ");
  return normalizeText($.root().text());
}

export function parsePracujListing(html: string) {
  const $ = load(html);
  let props: Record<string, unknown>;
  try {
    props = record(record(record(JSON.parse($("script#__NEXT_DATA__").text())).props).pageProps);
  } catch {
    throw new Error("Pracuj.pl listing is missing valid search state; the page may be blocked or its layout has changed");
  }
  const criteria = record(props.searchCriteria);
  const queries = record(props.dehydratedState).queries;
  // Promoted and positioned offers have separate queries and must not replace the sorted results.
  const query = Array.isArray(queries) ? queries.find(item => {
    const key = record(item).queryKey;
    return Array.isArray(key) && key[0] === "jobOffers";
  }) : undefined;
  const data = record(record(record(query).state).data);
  const groups = data.groupedOffers;
  const total = data.groupedOffersTotalCount;
  if (!Array.isArray(groups) || !integer(total, 0) || !integer(criteria.pn, 1) || !integer(criteria.rop, 1) ||
      criteria.sc !== 0 || (groups.length === 0) !== (total === 0)) {
    throw new Error("Pracuj.pl listing contains invalid results, pagination or newest sorting");
  }

  const jobs = new Map<string, ScrapedJob>();
  for (const item of groups) {
    const group = record(item);
    const title = text(group.jobTitle);
    if (!title || !Array.isArray(group.offers) || group.offers.length === 0) {
      throw new Error("Pracuj.pl listing contains an invalid offer");
    }
    const locations: string[] = [];
    const urls = group.offers.map(offer => {
      const entry = record(offer);
      const href = text(entry.offerAbsoluteUri);
      if (!href) throw new Error("Pracuj.pl offer is missing its URL");
      const url = validateUrl(new URL(href, `https://www.${domain}`).href);
      if (!/^\/praca\/[^/]+,oferta,\d+\/?$/.test(url.pathname)) {
        throw new Error("Pracuj.pl listing contains an unexpected offer URL");
      }
      url.protocol = "https:";
      url.hostname = `www.${domain}`;
      url.search = "";
      url.hash = "";
      url.pathname = url.pathname.replace(/\/$/, "");
      locations.push(text(entry.displayWorkplace));
      return url.href;
    });
    // Use a stable URL for a multi-location group regardless of location order.
    const url = urls.sort()[0];
    const key = text(group.groupId) || url;
    const company = text(group.companyName) || undefined;
    const rawContent = normalizeText([
      title, company, plainText(group.jobDescription), plainText(group.aiSummary),
      ...strings(group.positionLevels), ...strings(group.typesOfContract),
      ...strings(group.workSchedules), ...strings(group.workModes), ...locations,
      text(group.salaryDisplayText), group.isRemoteWorkAllowed === true ? "Remote Zdalnie" : "",
    ].filter(Boolean).join(" "));
    const previous = jobs.get(key);
    jobs.set(key, previous ? { ...previous, rawContent: `${previous.rawContent} ${rawContent}` } :
      { title, company, url, source: sourceName, rawContent });
  }
  return {
    jobs: [...jobs.values()], page: criteria.pn, pageSize: criteria.rop,
    totalPages: Math.ceil(total / criteria.rop),
  };
}

export const pracujAdapter: ScraperAdapter = {
  sourceName,
  domain,
  async scrape(value) {
    // Only the newest page is collected, independently for each configured search URL.
    const url = getPracujPageUrl(value, 1);
    // GitHub Actions runs headed Chromium under Xvfb for Pracuj.pl.
    const browser = await chromium.launch({
      headless: process.env.PRACUJ_HEADLESS !== "false", channel: "chromium",
    });
    try {
      const page = await browser.newPage({ locale: "pl-PL" });
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      validateUrl(page.url());
      if (response?.headers()["cf-mitigated"] === "challenge") {
        console.log("Pracuj.pl: page 1 received a Cloudflare verification page; waiting for listing data.");
        // A challenge response may navigate to the listing after running its JavaScript.
        try {
          await page.locator("script#__NEXT_DATA__").waitFor({ state: "attached", timeout: 30_000 });
        } catch (cause) {
          throw new Error("Pracuj.pl page 1 is blocked by Cloudflare; listing data did not appear within 30 seconds", { cause });
        }
        validateUrl(page.url());
      } else if (!response?.ok()) {
        throw new Error(`Pracuj.pl page 1 failed with HTTP ${response?.status() ?? "no response"}`);
      }
      const listing = parsePracujListing(await page.content());
      if (listing.page !== 1 || listing.pageSize !== pageSize) {
        throw new Error("Pracuj.pl did not honor the requested pagination");
      }
      const jobs = new Map<string, ScrapedJob>();
      for (const job of listing.jobs.slice(0, pageSize)) {
        const previous = jobs.get(job.url);
        jobs.set(job.url, previous ? { ...previous, rawContent: `${previous.rawContent} ${job.rawContent}` } : job);
      }
      console.log(`Pracuj.pl: newest page, ${jobs.size} unique offers collected (limit: ${pageSize} per source).`);
      return [...jobs.values()];
    } finally {
      await browser.close();
    }
  },
};
