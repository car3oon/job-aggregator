import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env

import { justJoinItAdapter } from "./adapters/justjoinit";
import { ScraperAdapter } from "./types";
import { processJob } from "./engine";

const adapters: ScraperAdapter[] = [
  justJoinItAdapter,
];

async function run() {
  const { prisma } = await import("../../lib/prisma");
  console.log("🚀 Starting Job Aggregator Scraper...");
  
  // Determine trigger source
  const triggerEnv = process.env.TRIGGER_SOURCE || "MANUAL";
  const trigger = triggerEnv === "schedule" ? "CRON" : "MANUAL";

  // Create initial log entry
  const history = await prisma.scrapeHistory.create({
    data: {
      status: "RUNNING",
      trigger: trigger,
      logs: "Scraper started...\n",
    }
  });

  let totalAdded = 0;
  let totalUpdated = 0;
  let logsAccumulator = `Trigger: ${trigger}\n`;

  function appendLog(msg: string) {
    console.log(msg);
    logsAccumulator += `${new Date().toISOString()} - ${msg}\n`;
  }

  try {
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

    for (const target of targets) {
      try {
        const urlObj = new URL(target.url);
        const adapter = adapters.find(a => urlObj.hostname.includes(a.domain));

        if (!adapter) {
          appendLog(`⏭️ No adapter for ${urlObj.hostname}. Skipping...`);
          continue;
        }

        appendLog(`\n⚙️ Running [${adapter.sourceName}] on: ${target.url}`);
        const scrapedJobs = await adapter.scrape(target.url);

        appendLog(`✅ Extracted ${scrapedJobs.length} raw jobs. Running through Smart Engine...`);

        const processedJobs = scrapedJobs.map(job => processJob(job, categories, preferences));

        let savedCount = 0;
        let updateCount = 0;

        for (const job of processedJobs) {
          if (job.matchedCategories.length === 0) continue;

          try {
            // We use upsert but we want to count new vs updated, so we can do a quick check
            const existing = await prisma.job.findUnique({ where: { url: job.url } });
            if (existing) {
              updateCount++;
            } else {
              savedCount++;
            }

            await prisma.job.upsert({
              where: { url: job.url },
              update: {
                title: job.title,
                company: job.company,
                categories: { set: job.matchedCategories.map(name => ({ name })) },
                workPreferences: { set: job.matchedPreferences.map(name => ({ name })) },
                description: job.rawContent,
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
          } catch (dbErr: unknown) {
            appendLog(`⚠️ Failed to save job: ${job.title} - ${(dbErr as Error)?.message}`);
          }
        }

        totalAdded += savedCount;
        totalUpdated += updateCount;
        appendLog(`✅ Source [${adapter.sourceName}]: Saved ${savedCount} new, Updated ${updateCount} existing jobs.`);

      } catch (err: unknown) {
        appendLog(`❌ Error scraping ${target.url}: ${(err as Error)?.message}`);
      }
    }

    appendLog("\n🏁 Scraping finished successfully.");
    await prisma.scrapeHistory.update({
      where: { id: history.id },
      data: {
        status: "SUCCESS",
        endedAt: new Date(),
        jobsAdded: totalAdded,
        jobsUpdated: totalUpdated,
        logs: logsAccumulator
      }
    });

  } catch (globalErr: unknown) {
    appendLog(`🚨 CRITICAL FATAL ERROR: ${(globalErr as Error)?.message}`);
    await prisma.scrapeHistory.update({
      where: { id: history.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
        error: (globalErr as Error)?.message,
        logs: logsAccumulator
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(console.error);
