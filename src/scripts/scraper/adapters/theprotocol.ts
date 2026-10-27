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

    try {
      const page = await browser.newPage({ locale: "pl-PL" });
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

      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      validateTheProtocolUrl(page.url());

      const isChallenge = response?.headers()["cf-mitigated"] === "challenge";
      if (isChallenge) {
        console.log(`${sourceName}: received a Cloudflare verification page; waiting for listing data.`);
      } else if (!response?.ok()) {
        throw new Error(`${sourceName}: page failed with HTTP ${response?.status() ?? "no response"}`);
      }

      const readListing = async (): Promise<ScrapedJob[] | null> => {
        // If rangeBox response was intercepted, use it (highest data fidelity)
        if (interceptedOffers) {
          const jobs = parseTheProtocolOffersResponse(interceptedOffers);
          const offers = record(interceptedOffers).offers;
          if (jobs.length > 0 || (Array.isArray(offers) && offers.length === 0)) {
            console.log(`${sourceName}: ${jobs.length} offers collected via API (limit: ${pageSize} per source).`);
            return jobs;
          }
        }

        // Check __NEXT_DATA__ from page state
        try {
          const nextData = await page.evaluate(() => {
            const el = document.getElementById("__NEXT_DATA__");
            return el ? JSON.parse(el.textContent || "{}") : null;
          });
          const offersResponse = nextData?.props?.pageProps?.offersResponse;
          if (offersResponse) {
            const jobs = parseTheProtocolOffersResponse(offersResponse);
            if (jobs.length > 0 || (Array.isArray(offersResponse.offers) && offersResponse.offers.length === 0)) {
              console.log(
                `${sourceName}: ${jobs.length} offers collected via __NEXT_DATA__ (limit: ${pageSize} per source).`
              );
              return jobs;
            }
          }
        } catch {
          // State may be missing, malformed, or replaced during challenge navigation.
        }

        // Fall back to rendered cards when state is unavailable or malformed.
        const domOffers = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*=\",oferta,\"]"));
          const seen = new Set<string>();
          const results: Array<{ title: string; url: string; rawContent: string }> = [];

          for (const a of links) {
            const rawHref = a.href;
            if (!rawHref || seen.has(rawHref)) continue;
            seen.add(rawHref);

            // Clean URL of tracking parameters
            let cleanUrl = rawHref;
            try {
              const u = new URL(rawHref);
              u.search = "";
              u.hash = "";
              cleanUrl = u.href;
            } catch {}

            const container =
              a.closest("[data-test*=\"offer\"], [class*=\"offer\"], article") || a.parentElement;
            const rawContent = container ? container.textContent || "" : a.textContent || "";
            const title =
              a.querySelector("h2, h3, [class*=\"title\"]")?.textContent ||
              (a.textContent || "").split("\n")[0];

            results.push({
              title: title.trim(),
              url: cleanUrl,
              rawContent: rawContent.replace(/\s+/g, " ").trim(),
            });
          }
          return results;
        });

        if (domOffers.length > 0) {
          const jobs: ScrapedJob[] = domOffers.slice(0, pageSize).map((item) => ({
            title: item.title,
            url: item.url,
            source: sourceName,
            rawContent: item.rawContent,
          }));
          console.log(`${sourceName}: ${jobs.length} offers collected via DOM fallback (limit: ${pageSize} per source).`);
          return jobs;
        }

        return null;
      };

      const timeout = isChallenge ? 30_000 : 25_000;
      const deadline = Date.now() + timeout;
      let navigationError: unknown;
      // Poll extracted data rather than the presence of a Next.js state shell.
      do {
        validateTheProtocolUrl(page.url());
        try {
          const jobs = await readListing();
          validateTheProtocolUrl(page.url());
          if (jobs !== null) return jobs;
        } catch (error) {
          if (!/Execution context was destroyed|Cannot find context/.test(String(error))) throw error;
          navigationError = error;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await new Promise(resolve => setTimeout(resolve, Math.min(100, remaining)));
      } while (Date.now() <= deadline);

      if (isChallenge) {
        throw new Error(
          `${sourceName}: page is blocked by Cloudflare; listing data did not appear within 30 seconds`,
          { cause: navigationError }
        );
      }
      throw new Error("theprotocol.it listing data could not be extracted via API or DOM");
    } finally {
      await browser.close().catch(() => {});
    }
  },
};
