import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env

import { justJoinItAdapter } from "./adapters/justjoinit";
import { noFluffJobsAdapter } from "./adapters/nofluffjobs";
import { pracujAdapter } from "./adapters/pracuj";
import { theProtocolAdapter } from "./adapters/theprotocol";
import { ScraperAdapter } from "./types";
import { processJob } from "./engine";
import { refreshJobAvailability } from "./availability";

const adapters: ScraperAdapter[] = [
  justJoinItAdapter,
  noFluffJobsAdapter,
  pracujAdapter,
  theProtocolAdapter,
];

function getPracujOfferId(url: string): string | null {
  try {
    return new URL(url).pathname.match(/,oferta,(\d+)\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function run() {
  const { prisma } = await import("../../lib/prisma");
  console.log("🚀 Starting Job Aggregator Scraper...");

  // Determine trigger source
  const triggerEnv = process.env.TRIGGER_SOURCE || "MANUAL";
  const trigger = triggerEnv === "schedule" ? "CRON" : "MANUAL";

  let historyId: string | undefined;
  let totalAdded = 0;
  let totalUpdated = 0;
  let logsAccumulator = `Trigger: ${trigger}\n`;

  const githubServer = process.env.GITHUB_SERVER_URL || "https://github.com";
  const githubRepo = process.env.GITHUB_REPOSITORY;
  const githubRunId = process.env.GITHUB_RUN_ID;
  if (githubRepo && githubRunId) {
    logsAccumulator += `GitHub Action: ${githubServer}/${githubRepo}/actions/runs/${githubRunId}\n`;
  }

  function appendLog(msg: string) {
    console.log(msg);
    logsAccumulator += `${new Date().toISOString()} - ${msg}\n`;
  }

  let hasErrors = false;
  try {
    const history = await prisma.scrapeHistory.create({
      data: {
        status: "RUNNING",
        trigger,
        logs: "Scraper started...\n",
      }
    });
    historyId = history.id;

    const targets = await prisma.scraperUrl.findMany({ where: { isActive: true } });
    const categories = await prisma.category.findMany();
    const preferences = await prisma.workPreference.findMany({ where: { isActive: true } });

    if (targets.length === 0) {
      appendLog("⚠️ No active scraper targets found. Add them in Settings.");
      await prisma.scrapeHistory.update({
        where: { id: history.id },
        data: { status: "SUCCESS", endedAt: new Date(), logs: logsAccumulator }
      });
      return;
    }

    appendLog(`📋 Loaded ${targets.length} targets, ${categories.length} categories, ${preferences.length} work preferences.`);

    const successfulAdapters = new Set<ScraperAdapter>();
    for (const target of targets) {
      try {
        const urlObj = new URL(target.url);
        const adapter = adapters.find(a => urlObj.hostname === a.domain || urlObj.hostname.endsWith(`.${a.domain}`));

        if (!adapter) {
          appendLog(`⏭️ No adapter for ${urlObj.hostname}. Skipping...`);
          continue;
        }

        appendLog(`\n⚙️ Running [${adapter.sourceName}] on: ${target.url}`);
        const scrapedJobs = await adapter.scrape(target.url);
        successfulAdapters.add(adapter);

        appendLog(`✅ Extracted ${scrapedJobs.length} raw jobs. Running through Smart Engine...`);

        const processedJobs = scrapedJobs.map(job => processJob(job, categories, preferences));
        const matchedCount = processedJobs.filter(job => job.matchedCategories.length > 0).length;
        appendLog(`🔎 Category filters: ${matchedCount} matched, ${processedJobs.length - matchedCount} rejected.`);

        let savedCount = 0;
        let updateCount = 0;

        for (const job of processedJobs) {
          try {
            let existing = await prisma.job.findUnique({ where: { url: job.url } });

            // If not found by exact URL, check if a Pracuj.pl offer exists with the same offer ID.
            // Note: Offer ID is treated as the stable identity for a single posting on Pracuj.pl.
            // If an employer publishes a repost or new vacancy with a new offer ID, it is intentionally
            // stored as a new record to avoid clobbering concurrent openings for similar roles.
            // Duplicate/variant titles are unified in the UI via job-grouping, and stale postings
            // naturally expire via the 14-day retention cycle.
            const pracujOfferId = job.source === "Pracuj.pl" ? getPracujOfferId(job.url) : null;
            if (!existing && pracujOfferId && typeof prisma.job.findMany === "function") {
              const pracujCandidates = await prisma.job.findMany({
                where: {
                  source: "Pracuj.pl",
                  url: { contains: `,oferta,${pracujOfferId}` }
                }
              });
              existing = pracujCandidates.find(candidate => getPracujOfferId(candidate.url) === pracujOfferId) ?? null;
            }

            if (job.matchedCategories.length === 0) {
              if (existing) {
                // Job no longer matches any category, remove it to keep DB clean
                await prisma.job.delete({ where: { url: existing.url } });
              }
              continue;
            }

            if (existing && existing.url !== job.url) {
              // Update existing offer with the newly changed URL/title
              await prisma.job.update({
                where: { id: existing.id },
                data: {
                  title: job.title,
                  company: job.company,
                  url: job.url,
                  categories: { set: job.matchedCategories.map(name => ({ name })) },
                  workPreferences: { set: job.matchedPreferences.map(name => ({ name })) },
                  description: job.rawContent,
                  expiredAt: null,
                }
              });
              updateCount++;
            } else {
              await prisma.job.upsert({
                where: { url: job.url },
                update: {
                  title: job.title,
                  company: job.company,
                  categories: { set: job.matchedCategories.map(name => ({ name })) },
                  workPreferences: { set: job.matchedPreferences.map(name => ({ name })) },
                  description: job.rawContent,
                  expiredAt: null,
                },
                create: {
                  title: job.title,
                  company: job.company,
                  url: job.url,
                  source: job.source,
                  description: job.rawContent,
                  scraperUrl: { connect: { id: target.id } },
                  categories: { connect: job.matchedCategories.map(name => ({ name })) },
                  workPreferences: { connect: job.matchedPreferences.map(name => ({ name })) }
                }
              });

              if (existing) {
                updateCount++;
              } else {
                savedCount++;
              }
            }
          } catch (dbErr: unknown) {
            hasErrors = true;
            appendLog(`⚠️ Failed to save job: ${job.title} - ${(dbErr as Error)?.message}`);
          }
        }

        totalAdded += savedCount;
        totalUpdated += updateCount;
        appendLog(`✅ Source [${adapter.sourceName}]: Saved ${savedCount} new, Updated ${updateCount} existing jobs.`);

      } catch (err: unknown) {
        hasErrors = true;
        appendLog(`❌ Error scraping ${target.url}: ${(err as Error)?.message}`);
      }
    }

    // Only successful sources with an explicit offer-status checker can change availability.
    for (const adapter of successfulAdapters) {
      if (!adapter.getStatus) continue;
      try {
        const result = await refreshJobAvailability(adapter, prisma.job, appendLog);
        appendLog(`🔎 [${adapter.sourceName}] Verified ${result.checked} saved offers; marked ${result.expired} expired; restored ${result.restored}; retained ${result.unknown} with unknown status.`);
      } catch (error: unknown) {
        hasErrors = true;
        appendLog(`⚠️ [${adapter.sourceName}] Availability verification failed: ${(error as Error)?.message}`);
      }
    }

    appendLog(`\n🏁 Scraping finished with ${hasErrors ? "errors" : "success"}.`);

    // Determine final status
    let finalStatus = "SUCCESS";
    if (hasErrors) {
      finalStatus = (totalAdded + totalUpdated > 0) ? "PARTIAL" : "FAILED";
    }

    await prisma.scrapeHistory.update({
      where: { id: history.id },
      data: {
        status: finalStatus,
        endedAt: new Date(),
        jobsAdded: totalAdded,
        jobsUpdated: totalUpdated,
        logs: logsAccumulator
      }
    });

  } catch (globalErr: unknown) {
    hasErrors = true;
    appendLog(`🚨 CRITICAL FATAL ERROR: ${(globalErr as Error)?.message}`);
    if (historyId) {
      await prisma.scrapeHistory.update({
        where: { id: historyId },
        data: {
          status: "FAILED",
          endedAt: new Date(),
          error: (globalErr as Error)?.message,
          logs: logsAccumulator
        }
      });
    }
  } finally {
    if (hasErrors) {
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error("Scraper failed:", error);
  process.exitCode = 1;
});
