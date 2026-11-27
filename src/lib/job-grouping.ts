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
  applicationStatus?: "INBOX" | "SAVED" | "APPLIED" | "REJECTED";
  appliedAt?: Date | null;
}

export interface JobAnalysisSummary {
  id: string;
  summary: string;
  requiredSkills: string[];
  seniority: string | null;
  location: string | null;
  workMode: string | null;
  compensation: string | null;
  workPreferenceDiff: string | null;
  recommendedCvId: string | null;
  recommendedCvLabel: string | null;
  cvMatchReason: string | null;
  cvMatchStrengths: string[];
  cvMatchGaps: string[];
  descriptionHash: string;
  comparedCvHash: string | null;
  workPreferencesHash: string | null;
  analyzedAt: Date;
}

export interface InterviewPrepSummary {
  id: string;
  technicalQuestions: string[];
  behavioralQuestions: string[];
  talkingPoints: string[];
  questionsToAsk: string[];
  redFlags: string[];
  prepPriorities: string[];
  descriptionHash: string;
  comparedCvHash: string | null;
  preparedAt: Date;
}

export interface MinimalJob {
  id: string;
  title: string;
  company?: string | null;
  url: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  description?: string | null;
  categories?: { id: string; name: string; slug: string }[];
  workPreferences?: { id: string; name: string }[];
  applicationStatus?: "INBOX" | "SAVED" | "APPLIED" | "REJECTED";
  appliedAt?: Date | null;
  analysis?: JobAnalysisSummary | null;
  interviewPrep?: InterviewPrepSummary | null;
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
  applicationStatus: "INBOX" | "SAVED" | "APPLIED" | "REJECTED";
  appliedAt: Date | null;
  /** True when the primary job or a sibling has a non-empty stored description. */
  hasDescription: boolean;
  /** ID of the Job row that owns the description for this group. */
  descriptionJobId?: string;
  /** ID of the Job row that owns the analysis (or description if unanalyzed). */
  analysisJobId?: string;
  /** ID of the Job row that owns the interview prep (or description if unprepared). */
  prepJobId?: string;
  /** Cached AI analysis for the primary job, or null if none exists yet. */
  analysis: JobAnalysisSummary | null;
  /** Cached interview prep for the primary job, or null if none exists yet. */
  interviewPrep: InterviewPrepSummary | null;
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

export function normalizeJobUrl(source: string, url: string): string {
  if (source !== "Theprotocol.it" && !url.includes("theprotocol.it")) return url;

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "theprotocol.it" || parsed.hostname === "www.theprotocol.it") {
      parsed.pathname = parsed.pathname.replace(/^\/szczegoly\/oferta\//, "/praca/");
      return parsed.href;
    }
  } catch {
    return url;
  }

  return url;
}

export interface GroupIdentity {
  title: string;
  company?: string | null;
  source: string;
  url: string;
  createdAt?: Date | string;
}

export type JobApplicationStatus =
  | "INBOX"
  | "SAVED"
  | "APPLIED"
  | "REJECTED";

/**
 * Key that decides which stored rows the dashboard renders as one card.
 * Mirrors the level A grouping: normalized company + normalized title.
 * Rows without a company are never merged with anything else.
 */
export function getJobGroupKey(job: GroupIdentity): string {
  const company = normalizeCompany(job.company);
  const title = normalizeTitle(job.title);
  return company ? JSON.stringify([company, title]) : JSON.stringify([job.source, job.url]);
}

/**
 * Ids of every stored row that belongs to the same card as `target`.
 * Used to apply an application status to a whole grouped offer instead of one portal row.
 */
export function resolveGroupMemberIds<
  T extends GroupIdentity & { id: string },
  U extends GroupIdentity & { id: string },
>(jobs: T[], target: U): string[] {
  const key = getJobGroupKey(target);
  const groupedRows = jobs
    .filter(job => getJobGroupKey(job) === key)
    .sort((a, b) => {
      const getTimestamp = (job: T) =>
        job.createdAt ? new Date(job.createdAt).getTime() : 0;
      return getTimestamp(b) - getTimestamp(a);
    });
  const uniquePortals = new Map<string, T>();
  for (const job of groupedRows) {
    const identity = getJobPortalIdentity(job.source, job.url);
    if (!uniquePortals.has(identity)) uniquePortals.set(identity, job);
  }
  const uniqueRows = [...uniquePortals.values()];

  if (new Set(uniqueRows.map(job => job.source)).size < uniqueRows.length) {
    return [target.id];
  }

  const memberIds = uniqueRows.map(job => job.id);
  return memberIds.includes(target.id) ? memberIds : [target.id, ...memberIds];
}

export function resolveGroupApplicationState(
  jobs: Array<{
    applicationStatus?: JobApplicationStatus;
    appliedAt?: Date | null;
    createdAt?: Date | string;
  }>
): { applicationStatus: JobApplicationStatus; appliedAt: Date | null } {
  const getTimestamp = (job: { createdAt?: Date | string }) =>
    job.createdAt ? new Date(job.createdAt).getTime() : 0;

  const newestFirst = [...jobs].sort(
    (a, b) => getTimestamp(b) - getTimestamp(a)
  );
  const appliedItem = newestFirst.find(
    job => job.applicationStatus === "APPLIED"
  );
  const rejectedItem = newestFirst.find(
    job => job.applicationStatus === "REJECTED"
  );
  const savedItem = newestFirst.find(
    job => job.applicationStatus === "SAVED"
  );
  const primary = newestFirst[0];

  return {
    applicationStatus:
      appliedItem?.applicationStatus ??
      rejectedItem?.applicationStatus ??
      savedItem?.applicationStatus ??
      primary?.applicationStatus ??
      "INBOX",
    appliedAt: appliedItem?.appliedAt
      ? new Date(appliedItem.appliedAt)
      : primary?.appliedAt
        ? new Date(primary.appliedAt)
        : null,
  };
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
      const url = normalizeJobUrl(item.source, item.url);
      const key = JSON.stringify([item.source, url]);
      if (!sourcesMap.has(key)) {
        sourcesMap.set(key, {
          source: item.source,
          url,
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

    const { applicationStatus, appliedAt } =
      resolveGroupApplicationState(items);

    // Analysis and interview prep are 1:1 on individual Job rows, but a group
    // may span multiple portal listings. Use the primary's data when present,
    // otherwise fall back to any sibling that has it (e.g. the Saved tab
    // includes expired listings that can become the newest primary).
    const analysisSource = items.find((item) => item.analysis) ?? primary;
    const prepSource = items.find((item) => item.interviewPrep) ?? primary;
    const descriptionSource = items.find(
      (item) => item.description && item.description.trim().length > 0,
    ) ?? primary;

    levelAJobs.push({
      id: primary.id,
      title: primary.title,
      company: primary.company || null,
      url: normalizeJobUrl(primary.source, primary.url),
      createdAt: new Date(primary.createdAt),
      updatedAt: new Date(primary.updatedAt),
      categories: Array.from(categoryMap.values()),
      workPreferences: Array.from(prefMap.values()),
      sources: Array.from(sourcesMap.values()),
      relatedVariants: [],
      applicationStatus,
      appliedAt,
      hasDescription: Boolean(
        descriptionSource.description && descriptionSource.description.trim().length > 0,
      ),
      descriptionJobId: descriptionSource.id,
      analysisJobId: analysisSource.analysis ? analysisSource.id : descriptionSource.id,
      prepJobId: prepSource.interviewPrep ? prepSource.id : descriptionSource.id,
      analysis: analysisSource.analysis
        ? {
            id: analysisSource.analysis.id,
            summary: analysisSource.analysis.summary,
            requiredSkills: analysisSource.analysis.requiredSkills,
            seniority: analysisSource.analysis.seniority,
            location: analysisSource.analysis.location,
            workMode: analysisSource.analysis.workMode,
            compensation: analysisSource.analysis.compensation,
            workPreferenceDiff: analysisSource.analysis.workPreferenceDiff,
            recommendedCvId: analysisSource.analysis.recommendedCvId,
            recommendedCvLabel: analysisSource.analysis.recommendedCvLabel ?? null,
            cvMatchReason: analysisSource.analysis.cvMatchReason,
            cvMatchStrengths: analysisSource.analysis.cvMatchStrengths,
            cvMatchGaps: analysisSource.analysis.cvMatchGaps,
            descriptionHash: analysisSource.analysis.descriptionHash,
            comparedCvHash: analysisSource.analysis.comparedCvHash,
            workPreferencesHash: analysisSource.analysis.workPreferencesHash,
            analyzedAt: new Date(analysisSource.analysis.analyzedAt),
          }
        : null,
      interviewPrep: prepSource.interviewPrep
        ? {
            id: prepSource.interviewPrep.id,
            technicalQuestions: prepSource.interviewPrep.technicalQuestions,
            behavioralQuestions: prepSource.interviewPrep.behavioralQuestions,
            talkingPoints: prepSource.interviewPrep.talkingPoints,
            questionsToAsk: prepSource.interviewPrep.questionsToAsk,
            redFlags: prepSource.interviewPrep.redFlags,
            prepPriorities: prepSource.interviewPrep.prepPriorities,
            descriptionHash: prepSource.interviewPrep.descriptionHash,
            comparedCvHash: prepSource.interviewPrep.comparedCvHash,
            preparedAt: new Date(prepSource.interviewPrep.preparedAt),
          }
        : null,
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
