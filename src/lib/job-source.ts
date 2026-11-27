const KNOWN_HOST_SOURCES: Array<{ domain: string; label: string }> = [
  { domain: "linkedin.com", label: "LinkedIn" },
  { domain: "bulldogjob.pl", label: "Bulldogjob" },
  { domain: "bulldogjob.com", label: "Bulldogjob" },
  { domain: "solid.jobs", label: "Solid.jobs" },
  { domain: "rocketjobs.pl", label: "RocketJobs" },
  { domain: "justjoin.it", label: "JustJoinIT" },
  { domain: "nofluffjobs.com", label: "NoFluffJobs" },
  { domain: "pracuj.pl", label: "Pracuj.pl" },
  { domain: "theprotocol.it", label: "Theprotocol.it" },
  { domain: "glassdoor.com", label: "Glassdoor" },
  { domain: "glassdoor.pl", label: "Glassdoor" },
  { domain: "indeed.com", label: "Indeed" },
  { domain: "olx.pl", label: "OLX" },
  { domain: "useme.com", label: "Useme" },
  { domain: "wellfound.com", label: "Wellfound" },
  { domain: "remoteok.com", label: "RemoteOK" },
  { domain: "weworkremotely.com", label: "WeWorkRemotely" },
];

export const MANUAL_JOB_LIMITS = {
  title: 300,
  url: 2048,
  source: 100,
  company: 200,
  description: 100_000,
} as const;

/**
 * Infers a clean display source label from a job posting URL.
 * Falls back to the stripped hostname or "Manual" if the URL cannot be parsed.
 */
export function inferJobSourceFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Manual";
    }
    const host = parsed.hostname.toLowerCase();
    for (const entry of KNOWN_HOST_SOURCES) {
      if (host === entry.domain || host.endsWith(`.${entry.domain}`)) {
        return entry.label;
      }
    }
    const stripped = host.replace(/^www\./, "");
    return stripped || "Manual";
  } catch {
    return "Manual";
  }
}
