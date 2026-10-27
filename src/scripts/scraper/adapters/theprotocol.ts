import { chromium } from "playwright";
import type { ScrapedJob, ScraperAdapter } from "../types";

const domain = "theprotocol.it";
const sourceName = "Theprotocol.it";
const pageSize = 20;

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();
const text = (value: unknown) => (typeof value === "string" ? normalizeText(value) : "");
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const strings = (value: unknown) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

export function validateTheProtocolUrl(value: string): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !(url.hostname === domain || url.hostname === `www.${domain}`) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Expected a theprotocol.it HTTP(S) URL");
  }
  return url;
}

export interface TheProtocolOfferRaw {
  id: string;
  groupId?: string;
  title: string;
  employer: string;
  offerUrlName: string;
  aboutProject?: string[];
  workplace?: Array<{ location?: string; city?: string; region?: string }>;
  positionLevels?: Array<{ value?: string }>;
  typesOfContracts?: Array<{ id?: number; salary?: unknown }>;
  technologies?: string[];
  publicationDateUtc?: string;
  salary?: unknown;
  workModes?: string[];
}

export function parseTheProtocolOffersResponse(data: unknown): ScrapedJob[] {
  const res = record(data);
  const rawOffers = Array.isArray(res.offers) ? res.offers : [];
  const jobs: ScrapedJob[] = [];

  for (const item of rawOffers) {
    const offer = record(item) as unknown as TheProtocolOfferRaw;
    const title = text(offer.title);
    const offerSlug = text(offer.offerUrlName);

    if (!title || !offerSlug) {
      continue;
    }

    const offerUrl = `https://${domain}/szczegoly/oferta/${offerSlug}`;
    const company = text(offer.employer) || undefined;

    const locations: string[] = [];
    if (Array.isArray(offer.workplace)) {
      for (const loc of offer.workplace) {
        if (loc.location) locations.push(text(loc.location));
        if (loc.city && loc.city !== loc.location) locations.push(text(loc.city));
      }
    }

    const positionLevels = Array.isArray(offer.positionLevels)
      ? offer.positionLevels.map((p) => text(p.value)).filter(Boolean)
      : [];

    const workModes = strings(offer.workModes);
    const technologies = strings(offer.technologies);
    const aboutProject = strings(offer.aboutProject);

    const rawContent = normalizeText(
      [
        title,
        company,
        ...technologies,
        ...positionLevels,
        ...workModes,
        ...locations,
        ...aboutProject,
      ]
        .filter(Boolean)
        .join(" ")
    );

    jobs.push({
      title,
      company,
      url: offerUrl,
      source: sourceName,
      rawContent,
    });

    if (jobs.length >= pageSize) {
      break;
    }
  }

  return jobs;
}

export const theProtocolAdapter: ScraperAdapter = {
  sourceName,
  domain,
  async scrape(value) {
    const targetUrl = validateTheProtocolUrl(value).href;

    const isHeadless =
      process.env.THEPROTOCOL_HEADLESS !== undefined
        ? process.env.THEPROTOCOL_HEADLESS !== "false"
        : process.env.PRACUJ_HEADLESS !== undefined
        ? process.env.PRACUJ_HEADLESS !== "false"
        : true;

    const browser = await chromium.launch({
      headless: isHeadless,
      channel: "chromium",
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();
    let interceptedOffers: unknown = null;

    page.on("response", async (res) => {
      if (res.url().includes("offers/_search/rangeBox") && res.status() === 200) {
        try {
          interceptedOffers = await res.json();
        } catch {
          // ignore parsing error from non-json responses
        }
      }
    });

    try {
      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // If Cloudflare challenge is served, wait for the listing to stabilize
      if (response?.headers()["cf-mitigated"] === "challenge") {
        console.log(`${sourceName}: Cloudflare verification page detected, waiting for search data...`);
        try {
          await page.waitForTimeout(5000);
        } catch {}
      }

      // Wait up to 15s for the rangeBox API response to arrive
      const startTime = Date.now();
      while (!interceptedOffers && Date.now() - startTime < 15000) {
        await page.waitForTimeout(500);
      }

      // Fallback: check __NEXT_DATA__ if rangeBox response was not intercepted directly
      if (!interceptedOffers) {
        const nextDataOffers = await page.evaluate(() => {
          const el = document.getElementById("__NEXT_DATA__");
          if (!el) return null;
          try {
            const data = JSON.parse(el.textContent || "{}");
            return data.props?.pageProps?.offersResponse || null;
          } catch {
            return null;
          }
        });
        if (nextDataOffers) {
          interceptedOffers = nextDataOffers;
        }
      }

      if (!interceptedOffers) {
        throw new Error(
          "theprotocol.it search response was not intercepted; Cloudflare challenge or API change suspected"
        );
      }

      const jobs = parseTheProtocolOffersResponse(interceptedOffers);
      console.log(`${sourceName}: ${jobs.length} offers collected (limit: ${pageSize} per source).`);
      return jobs;
    } finally {
      await browser.close().catch(() => {});
    }
  },
};
