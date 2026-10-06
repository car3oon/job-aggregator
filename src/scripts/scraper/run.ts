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

  const targets = await prisma.scraperUrl.findMany({ where: { isActive: true } });
  const categories = await prisma.category.findMany();
  const preferences = await prisma.workPreference.findMany({ where: { isActive: true } });

  if (targets.length === 0) {
    console.log("⚠️ No active scraper targets found. Add them in Settings.");
    return;
  }

  console.log(`📋 Loaded ${targets.length} targets, ${categories.length} categories, ${preferences.length} work preferences.`);

  for (const target of targets) {
    try {
      const urlObj = new URL(target.url);
      const adapter = adapters.find(a => urlObj.hostname.includes(a.domain));

      if (!adapter) {
        console.log(`⏭️  No adapter for ${urlObj.hostname}. Skipping...`);
        continue;
      }

      console.log(`\n⚙️  Running [${adapter.sourceName}] on: ${target.url}`);
      const scrapedJobs = await adapter.scrape(target.url);

      


      console.log(`✅ Extracted ${scrapedJobs.length} raw jobs. Running through Smart Engine...`);

      const processedJobs = scrapedJobs.map(job => processJob(job, categories, preferences));

      // Save results to the database
      let savedCount = 0;
      for (const job of processedJobs) {
        // Skip jobs that didn't match any category (optional, but keeps DB clean)
        if (job.matchedCategories.length === 0) continue;

        try {
          await prisma.job.upsert({
            where: { url: job.url },
            update: {
              title: job.title,
              categories: {
                set: job.matchedCategories.map(name => ({ name }))
              },
              workPreferences: {
                set: job.matchedPreferences.map(name => ({ name }))
              },
              description: job.rawContent,
            },
            create: {
              title: job.title,
              url: job.url,
              source: job.source,
              description: job.rawContent,
              scraperUrl: {
                connect: { id: target.id }
              },
              categories: {
                connect: job.matchedCategories.map(name => ({ name }))
              },
              workPreferences: {
                connect: job.matchedPreferences.map(name => ({ name }))
              }
            }
          });
          savedCount++;
        } catch (dbErr) {
          console.error(`⚠️ Failed to save job: ${job.title}`, dbErr);
        }
      }

      console.log(`✅ Saved/Updated ${savedCount} relevant jobs to the database.`);

    } catch (err) {
      console.error(`❌ Error scraping ${target.url}`, err);
    }
  }

  console.log("\n🏁 Scraping finished.");
  await prisma.$disconnect();
}

run().catch(console.error);
