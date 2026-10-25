import type { ScraperAdapter } from "./types";

type SavedJob = { id: string; url: string; updatedAt: Date; expiredAt: Date | null };
type JobStore = {
  findMany(args: {
    where: { source: string };
    select: { id: true; url: true; updatedAt: true; expiredAt: true };
  }): Promise<SavedJob[]>;
  updateMany(args: {
    where: { id: string; url: string; updatedAt: Date };
    data: { expiredAt: Date | null };
  }): Promise<{ count: number }>;
};

export async function refreshJobAvailability(adapter: ScraperAdapter, store: JobStore, log: (message: string) => void) {
  const getStatus = adapter.getStatus;
  const result = { checked: 0, expired: 0, restored: 0, unknown: 0 };
  if (!getStatus) return result;
  const savedJobs = await store.findMany({
    where: { source: adapter.sourceName },
    select: { id: true, url: true, updatedAt: true, expiredAt: true },
  });

  // Include saved variants outside listing limits, with at most three portal requests at once.
  for (let offset = 0; offset < savedJobs.length; offset += 3) {
    const checks = await Promise.all(savedJobs.slice(offset, offset + 3).map(async job => {
      try {
        return { job, status: await getStatus.call(adapter, job.url) };
      } catch {
        log(`⚠️ [${adapter.sourceName}] Could not verify ${job.url}; retaining its current status.`);
        return { job, status: "unknown" as const };
      }
    }));
    for (const { job, status } of checks) {
      result.checked++;
      if (status === "unknown") { result.unknown++; continue; }
      const expired = status === "expired";
      if (expired === (job.expiredAt !== null)) continue;
      // Preserve every record and avoid overwriting concurrent scraper updates.
      const updated = await store.updateMany({
        where: { id: job.id, url: job.url, updatedAt: job.updatedAt },
        data: { expiredAt: expired ? new Date() : null },
      });
      if (expired) result.expired += updated.count;
      else result.restored += updated.count;
    }
  }
  return result;
}
