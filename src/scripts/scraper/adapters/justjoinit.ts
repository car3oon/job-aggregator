import { chromium } from "playwright";
import { ScraperAdapter, ScrapedJob } from "../types";

export const justJoinItAdapter: ScraperAdapter = {
  sourceName: "JustJoinIT",
  domain: "justjoin.it",
  async scrape(url: string): Promise<ScrapedJob[]> {
    console.log(`[JustJoinIT] Launching Playwright browser for: ${url}`);
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();
    const jobs: ScrapedJob[] = [];

    try {
      // Approach 1: Intercept network traffic (API/GraphQL)
      page.on("response", async (response) => {
        const reqUrl = response.url();
        // JustJoinIT loads job offers via JSON
        if (reqUrl.includes("api/v2") || reqUrl.includes("graphql") || reqUrl.includes("offers")) {
          const type = response.headers()["content-type"];
          if (type && type.includes("application/json")) {
            try {
              const data = await response.json();
              // Search for an array that looks like job offers (contains 'title' and 'slug')
              const findOffers = (obj: any): any[] => {
                if (Array.isArray(obj)) return obj;
                if (typeof obj === 'object' && obj !== null) {
                  for (const key of Object.keys(obj)) {
                    if (Array.isArray(obj[key]) && obj[key].length > 0 && (obj[key][0].title || obj[key][0].slug)) {
                      return obj[key];
                    }
                  }
                }
                return [];
              };
              
              const potentialOffers = findOffers(data);
              if (potentialOffers.length > 0) {
                potentialOffers.forEach((offer: any) => {
                  const title = offer.title || offer.name || "";
                  const company = offer.companyName || offer.company?.name || "Unknown";
                  const slug = offer.slug || offer.id || "";
                  const jobUrl = slug ? `https://justjoin.it/offers/${slug}` : url;
                  const rawContent = JSON.stringify(offer).toLowerCase();
                  
                  if (title && !jobs.find(j => j.url === jobUrl)) {
                    jobs.push({
                      title,
                      company,
                      url: jobUrl,
                      source: "JustJoinIT",
                      rawContent
                    });
                  }
                });
              }
            } catch (e) {
              // Ignore parsing errors for irrelevant JSONs
            }
          }
        }
      });

      console.log(`[JustJoinIT] Navigating to page and listening for JSON API...`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      
      // Additional wait to let SPA scripts process data
      await page.waitForTimeout(3000);

      // Approach 2 (Fallback): If API was encoded differently, scrape the DOM
      if (jobs.length === 0) {
        console.log(`[JustJoinIT] Clean API interception failed. Scraping from DOM...`);
        const domJobs = await page.evaluate(() => {
          const results: any[] = [];
          // Search for 'a' elements linking to offers (currently /job-offer/)
          const links = Array.from(document.querySelectorAll('a[href*="/job-offer/"]'));
          
          links.forEach(a => {
            const href = (a as HTMLAnchorElement).href;
            const textContent = (a as HTMLElement).innerText.trim();
            if (textContent.length > 10) { // Only rich text blocks
              const lines = textContent.split('\n').filter(Boolean);
              
              // Usually: 0 is company name or empty, 1 is title, etc., this varies
              // In raw Playwright text, the structure can differ.
              // Let's find the longest line as title, or just concatenate everything as rawContent for the Smart Engine.
              
              // In the new JustJoinIT UI, the title is often in the middle, it's better to assign raw text
              // and let the Smart Engine extract info from keywords anyway.
              // Let's take the first reasonable line as 'title', and the second as 'company'.
              let title = lines.find(l => l.length > 5 && !l.includes("New") && !l.includes("PLN")) || lines[0];
              let company = lines.find(l => lines.indexOf(l) > lines.indexOf(title) && l.length > 2) || "Unknown";
              
              // Hard fallbacks:
              if (title === "Live status" || title === "Super offer") {
                 title = lines[2] || lines[0];
                 company = lines[0] || "Unknown";
              }

              results.push({
                title: title,
                company: company,
                url: href,
                source: "JustJoinIT",
                rawContent: textContent.toLowerCase()
              });
            }
          });
          return results;
        });
        
        // Deduplicate by URL
        const unique = new Map();
        domJobs.forEach(job => unique.set(job.url, job));
        jobs.push(...Array.from(unique.values()));
      }

      return jobs;

    } catch (error) {
      console.error(`[JustJoinIT] Scraping error:`, error);
      return [];
    } finally {
      await browser.close();
    }
  }
};
