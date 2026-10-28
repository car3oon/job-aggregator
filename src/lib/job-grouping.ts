export interface JobSourceLink {
  source: string;
  url: string;
  createdAt: Date;
}

export interface RelatedJobVariant {
  id: string;
  title: string;
  url: string;
  sources: JobSourceLink[];
  createdAt: Date;
  workPreferences: { id: string; name: string }[];
  categories: { id: string; name: string; slug: string }[];
  applicationStatus?: "INBOX" | "APPLIED" | "REJECTED";
  appliedAt?: Date | null;
}

export interface MinimalJob {
  id: string;
  title: string;
  company?: string | null;
  url: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  categories?: { id: string; name: string; slug: string }[];
  workPreferences?: { id: string; name: string }[];
  applicationStatus?: "INBOX" | "APPLIED" | "REJECTED";
  appliedAt?: Date | null;
}

export interface GroupedJob {
  id: string;
  title: string;
  company: string | null;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  categories: { id: string; name: string; slug: string }[];
  workPreferences: { id: string; name: string }[];
  sources: JobSourceLink[];
  relatedVariants: RelatedJobVariant[];
  applicationStatus: "INBOX" | "APPLIED" | "REJECTED";
  appliedAt: Date | null;
}

export function normalizeCompany(company?: string | null): string {
  if (!company) return "";
  return company
    .toLowerCase()
    .replace(/[łŁ]/g, "l")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(spolka\s+z\s+ograniczona\s+odpowiedzialnoscia|spolka\s+akcyjna|prosta\s+spolka\s+akcyjna|spolka\s+komandytowa|spolka\s+jawna|spolka\s+partnerska|sp\.?\s*z\s*o\.?\s*o\.?|spolka\s+z\s+o\.?o\.?|sp\.?\s*k\.?|s\.?a\.?|p\.?s\.?a\.?|inc\.?|llc|gmbh|ltd\.?|limited)\b/gi, "")
    .replace(/[^a-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[łŁ]/g, "l")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\bfull-stack\b/g, "fullstack")
    .replace(/\bfront-end\b/g, "frontend")
    .replace(/\bback-end\b/g, "backend")
    .replace(/\bnode\.?js\b/g, "nodejs")
    .replace(/\bvue\.?js\b/g, "vuejs")
    .replace(/\breact\.?js\b/g, "reactjs")
    .replace(/[^a-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function areSimilarTitles(t1: string, t2: string): boolean {
  const norm1 = normalizeTitle(t1);
  const norm2 = normalizeTitle(t2);
  if (norm1 === norm2) return true;

  const aliases: Record<string, string> = { reactjs: "react", vuejs: "vue", nodejs: "node", net: "dotnet" };
  const words = (title: string) => new Set(title.split(" ").filter(w => w.length > 1).map(w => aliases[w] ?? w));
  const words1 = words(norm1);
  const words2 = words(norm2);

  // Conflicting tech must not be merged
  const techs = ["react", "vue", "angular", "node", "python", "java", "php", "ruby", "dotnet", "ios", "android", "flutter", "golang", "rust"];
  const stack1 = techs.filter(tech => words1.has(tech));
  const stack2 = techs.filter(tech => words2.has(tech));
  if (stack1.length > 0 && stack2.length > 0 &&
      (stack1.length !== stack2.length || stack1.some(tech => !stack2.includes(tech)))) {
    return false;
  }

  // Conflicting primary domains must not be merged
  if ((words1.has("frontend") && words2.has("backend")) || (words1.has("backend") && words2.has("frontend"))) {
    return false;
  }

  let common = 0;
  for (const w of words1) {
    if (words2.has(w)) common++;
  }

  // Prevent merging distinct multi-word titles that only share a single word (e.g. "Developer" and "Frontend Developer")
  if (common < 2 && Math.max(words1.size, words2.size) > 1) {
    return false;
  }

  const minLen = Math.min(words1.size, words2.size);
  if (minLen === 0) return false;
  return common / minLen >= 0.6;
}

export function getJobPortalIdentity(source: string, url: string): string {
  if (source === "Pracuj.pl") {
    const pracujId = url.match(/,oferta,(\d+)(?:[/?#]|$)/)?.[1];
    if (pracujId) return `Pracuj.pl:${pracujId}`;
  }
  if (source === "Theprotocol.it" || url.includes("theprotocol.it")) {
    const theProtocolId = url.match(/,oferta,([0-9a-fA-F-]+)(?:[/?#]|$)/)?.[1];
    if (theProtocolId) return `Theprotocol.it:${theProtocolId}`;
  }
  return `${source}:${url}`;
}

export function groupJobs<T extends MinimalJob>(jobs: T[]): GroupedJob[] {
  // Keep the newest version of each portal identity, including changed Pracuj.pl or Theprotocol.it slugs.
  const identities = new Map<string, T>();
  const newestFirst = [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const job of newestFirst) {
    const identity = getJobPortalIdentity(job.source, job.url);
    if (!identities.has(identity)) identities.set(identity, job);
  }

  const titleGroups = new Map<string, T[]>();
  for (const job of identities.values()) {
    const c = normalizeCompany(job.company);
    const t = normalizeTitle(job.title);
    const key = c ? JSON.stringify([c, t]) : JSON.stringify([job.source, job.url]);
    if (!titleGroups.has(key)) titleGroups.set(key, []);
    titleGroups.get(key)!.push(job);
  }

  const exactGroups: T[][] = [];
  for (const items of titleGroups.values()) {
    // Multiple identities on one portal make title-only cross-portal matching ambiguous.
    if (new Set(items.map(item => item.source)).size < items.length) {
      exactGroups.push(...items.map(item => [item]));
    } else {
      exactGroups.push(items);
    }
  }

  // Intermediate list of Level A grouped jobs
  const levelAJobs: GroupedJob[] = [];
  for (const items of exactGroups) {
    // Sort items by createdAt descending (newest first)
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const primary = items[0];

    const sourcesMap = new Map<string, JobSourceLink>();
    for (const item of items) {
      const key = JSON.stringify([item.source, item.url]);
      if (!sourcesMap.has(key)) {
        sourcesMap.set(key, {
          source: item.source,
          url: item.url,
          createdAt: new Date(item.createdAt),
        });
      }
    }

    // Merge categories & preferences
    const categoryMap = new Map<string, { id: string; name: string; slug: string }>();
    const prefMap = new Map<string, { id: string; name: string }>();

    for (const item of items) {
      for (const cat of item.categories || []) {
        categoryMap.set(cat.id, cat);
      }
      for (const pref of item.workPreferences || []) {
        prefMap.set(pref.id, pref);
      }
    }

    const appliedItem = items.find(item => item.applicationStatus === "APPLIED");
    const rejectedItem = items.find(item => item.applicationStatus === "REJECTED");
    const applicationStatus = appliedItem?.applicationStatus || rejectedItem?.applicationStatus || primary.applicationStatus || "INBOX";
    const appliedAt = appliedItem?.appliedAt ? new Date(appliedItem.appliedAt) : primary.appliedAt ? new Date(primary.appliedAt) : null;

    levelAJobs.push({
      id: primary.id,
      title: primary.title,
      company: primary.company || null,
      url: primary.url,
      createdAt: new Date(primary.createdAt),
      updatedAt: new Date(primary.updatedAt),
      categories: Array.from(categoryMap.values()),
      workPreferences: Array.from(prefMap.values()),
      sources: Array.from(sourcesMap.values()),
      relatedVariants: [],
      applicationStatus,
      appliedAt,
    });
  }

  // Step 2: Merge company-level similar variants (Level B)
  const finalGrouped: GroupedJob[] = [];

  for (const job of levelAJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const comp = normalizeCompany(job.company);
    let matchedParent: GroupedJob | undefined;

    if (comp) {
      matchedParent = finalGrouped.find(parent => {
        const parentComp = normalizeCompany(parent.company);
        return parentComp === comp && areSimilarTitles(parent.title, job.title);
      });
    }

    if (matchedParent) {
      // Attach as variant to parent
      matchedParent.relatedVariants.push({
        id: job.id,
        title: job.title,
        url: job.url,
        sources: job.sources,
        createdAt: job.createdAt,
        workPreferences: job.workPreferences,
        categories: job.categories,
        applicationStatus: job.applicationStatus,
        appliedAt: job.appliedAt,
      });
    } else {
      finalGrouped.push(job);
    }
  }

  return finalGrouped;
}
