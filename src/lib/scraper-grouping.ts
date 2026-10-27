import type { ScraperUrl } from "@prisma/client";

export interface ScraperPortalGroup {
  /** Clean display name of the portal, e.g. "Pracuj.pl", "theprotocol.it", "No Fluff Jobs" */
  portal: string;
  /** Whether every URL in this group is inactive */
  allInactive: boolean;
  /** Whether at least one URL in this group is active */
  anyActive: boolean;
  urls: ScraperUrl[];
}

/**
 * Extracts a unified portal label from a scraper URL or name.
 * Combines subdomains like `it.pracuj.pl` and `pracuj.pl` under one "Pracuj.pl" portal.
 */
export function extractPortal(rawUrl: string, name?: string | null): string {
  const host = (() => {
    try {
      return new URL(rawUrl).hostname.toLowerCase();
    } catch {
      return rawUrl.toLowerCase();
    }
  })();

  if (host.includes("theprotocol.it")) return "theprotocol.it";
  if (host.includes("pracuj.pl")) return "Pracuj.pl";
  if (host.includes("nofluffjobs.com")) return "No Fluff Jobs";
  if (host.includes("justjoin.it")) return "JustJoinIT";

  // Fallback to second-level domain name
  const stripped = host.replace(/^www\./, "");
  return stripped;
}

/**
 * Strips the redundant portal prefix from the source name.
 * E.g. "Pracuj.pl - Next.js" -> "Next.js"
 *      "No Fluff Jobs - Fullstack" -> "Fullstack"
 *      "JustJoinIT - JS" -> "JS"
 */
export function extractQueryLabel(name: string | null | undefined, portal: string, rawUrl: string): string {
  if (name) {
    const prefixes = [
      portal,
      portal.toLowerCase(),
      portal.replace(/\s+/g, ""),
      "pracuj.pl",
      "it.pracuj.pl",
      "nofluffjobs.com",
      "no fluff jobs",
      "justjoin.it",
      "justjoinit",
      "theprotocol.it",
    ];

    let label = name.trim();
    for (const prefix of prefixes) {
      const regex = new RegExp(`^${prefix}\\s*[-–—:]?\\s*`, "i");
      label = label.replace(regex, "");
    }
    label = label.replace(/^[-–—:]+\s*/, "").trim();
    if (label.length > 0) return label;
  }

  // Fallback to URL path segment
  try {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\/+/g, "").replace(/\/+$/g, "");
    return path || url.hostname;
  } catch {
    return rawUrl;
  }
}

/**
 * Groups an array of ScraperUrl records by unified portal.
 */
export function groupScraperUrlsByPortal(urls: ScraperUrl[]): ScraperPortalGroup[] {
  const map = new Map<string, ScraperUrl[]>();

  for (const u of urls) {
    const portal = extractPortal(u.url, u.name);
    if (!map.has(portal)) map.set(portal, []);
    map.get(portal)!.push(u);
  }

  return Array.from(map.entries()).map(([portal, items]) => ({
    portal,
    allInactive: items.every((u) => !u.isActive),
    anyActive: items.some((u) => u.isActive),
    urls: items,
  }));
}
