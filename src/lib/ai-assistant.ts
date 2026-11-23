import { prisma } from "@/lib/prisma";
import { resolveGroupMemberIds } from "@/lib/job-grouping";
import { updateGroupedJobStatus } from "@/lib/grouped-job-status";
import { revalidatePath } from "next/cache";

export interface AssistantJobItem {
  id: string;
  title: string;
  company: string | null;
  url: string;
  source: string;
  applicationStatus: "INBOX" | "SAVED" | "APPLIED" | "REJECTED";
  appliedAt: string | null;
  createdAt: string;
  categories: string[];
  workPreferences: string[];
}

export interface GetJobsOptions {
  query?: string;
  status?: "INBOX" | "SAVED" | "APPLIED" | "REJECTED" | "ALL";
  categorySlug?: string;
  limit?: number;
}

export async function getJobsForAssistant(options: GetJobsOptions = {}): Promise<AssistantJobItem[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 5), 20);

  // Build Prisma where clause
  const where: {
    expiredAt?: null;
    applicationStatus?: "INBOX" | "SAVED" | "APPLIED" | "REJECTED";
    categories?: { some: { slug: string } };
    OR?: Array<{
      title?: { contains: string; mode: "insensitive" };
      company?: { contains: string; mode: "insensitive" };
      description?: { contains: string; mode: "insensitive" };
    }>;
  } = {};

  const status = options.status ?? "INBOX";
  if (status === "SAVED") {
    where.applicationStatus = "SAVED";
  } else if (status === "APPLIED") {
    where.applicationStatus = "APPLIED";
  } else if (status === "REJECTED") {
    where.applicationStatus = "REJECTED";
  } else if (status === "ALL") {
    where.expiredAt = null;
  } else {
    // Default: INBOX (active and not expired)
    where.applicationStatus = "INBOX";
    where.expiredAt = null;
  }

  if (options.categorySlug?.trim()) {
    where.categories = { some: { slug: options.categorySlug.trim().toLowerCase() } };
  }

  if (options.query?.trim()) {
    const q = options.query.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const jobs = await prisma.job.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      categories: true,
      workPreferences: true,
    },
  });

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    url: job.url,
    source: job.source,
    applicationStatus: job.applicationStatus as "INBOX" | "SAVED" | "APPLIED" | "REJECTED",
    appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    categories: job.categories.map((c) => c.name),
    workPreferences: job.workPreferences.map((w) => w.name),
  }));
}

export interface UpdateJobStatusOptions {
  jobId?: string;
  searchQuery?: string;
  status: "INBOX" | "SAVED" | "APPLIED" | "REJECTED";
}

export async function updateJobStatusForAssistant(options: UpdateJobStatusOptions) {
  let targetId = options.jobId;

  if (!targetId && options.searchQuery?.trim()) {
    const q = options.searchQuery.trim();
    const candidates = await prisma.job.findMany({
      where: {
        expiredAt: null,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        company: true,
        source: true,
        url: true,
        createdAt: true,
      },
    });

    const candidateGroups = new Map<string, (typeof candidates)[number]>();
    for (const candidate of candidates) {
      const memberIds = resolveGroupMemberIds(candidates, candidate).sort();
      const groupKey = JSON.stringify(memberIds);
      if (!candidateGroups.has(groupKey)) {
        candidateGroups.set(groupKey, candidate);
      }
    }
    const distinctCandidates = [...candidateGroups.values()];

    if (distinctCandidates.length > 1) {
      // Check if there is an exact single title match
      const exactTitle = distinctCandidates.filter(
        (candidate) => candidate.title.toLowerCase() === q.toLowerCase()
      );
      if (exactTitle.length === 1) {
        targetId = exactTitle[0].id;
      } else {
        const matchesList = distinctCandidates
          .slice(0, 5)
          .map((c) => `"${c.title}" at ${c.company || "unknown"}`)
          .join(", ");
        return {
          success: false,
          message: `Found multiple (${distinctCandidates.length}) offers matching "${q}". Please specify the exact title or provide the job ID. Matches: ${matchesList}`,
        };
      }
    } else if (distinctCandidates.length === 1) {
      targetId = distinctCandidates[0].id;
    }
  }

  if (!targetId) {
    return {
      success: false,
      message: options.searchQuery
        ? `No offer found matching "${options.searchQuery}".`
        : "Missing job ID or search query to identify the job offer.",
    };
  }

  const updated = await updateGroupedJobStatus(targetId, options.status);
  if (!updated.success) {
    return { success: false, message: updated.message };
  }

  try {
    revalidatePath("/");
  } catch {
    // Safe to ignore outside Next.js request context (e.g. tests)
  }

  return {
    success: true,
    message: `Updated "${updated.title}"${updated.company ? ` at ${updated.company}` : ""} to status ${options.status} across ${updated.updatedCount} source listing${updated.updatedCount === 1 ? "" : "s"}.`,
    job: {
      id: targetId,
      title: updated.title,
      company: updated.company,
      status: options.status,
      appliedAt: updated.appliedAt?.toISOString() ?? null,
    },
  };
}

export async function getDashboardStatsForAssistant() {
  const [inboxCount, savedCount, appliedCount, rejectedCount, totalActive, lastScrape] = await Promise.all([
    prisma.job.count({ where: { applicationStatus: "INBOX", expiredAt: null } }),
    prisma.job.count({ where: { applicationStatus: "SAVED" } }),
    prisma.job.count({ where: { applicationStatus: "APPLIED" } }),
    prisma.job.count({ where: { applicationStatus: "REJECTED" } }),
    prisma.job.count({ where: { expiredAt: null } }),
    prisma.scrapeHistory.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return {
    inboxJobs: inboxCount,
    savedJobs: savedCount,
    appliedJobs: appliedCount,
    rejectedJobs: rejectedCount,
    totalActiveJobs: totalActive,
    lastScrape: lastScrape
      ? {
          status: lastScrape.status,
          startedAt: lastScrape.startedAt.toISOString(),
          endedAt: lastScrape.endedAt ? lastScrape.endedAt.toISOString() : null,
          jobsAdded: lastScrape.jobsAdded,
          jobsUpdated: lastScrape.jobsUpdated,
        }
      : null,
  };
}

export async function triggerScraperForAssistant() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      success: false,
      message: "Missing GITHUB_TOKEN environment variable. Cannot dispatch workflow.",
    };
  }

  try {
    const requestedAt = new Date().toISOString();
    const response = await fetch(
      "https://api.github.com/repos/car3oon/job-aggregator/actions/workflows/scraper.yml/dispatches",
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Job-Aggregator-App",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `GitHub Action dispatch failed with status ${response.status}: ${errorText}`,
      };
    }

    return {
      success: true,
      message: "Scraper run has been triggered on GitHub Actions. It will scrape configured portals and update your listings.",
      requestedAt,
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message || "Failed to trigger scraper workflow.",
    };
  }
}
