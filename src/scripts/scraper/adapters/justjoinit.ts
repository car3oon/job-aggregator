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
              const findOffers = (obj: unknown): Record<string, unknown>[] => {
                if (Array.isArray(obj)) return obj as Record<string, unknown>[];
                if (typeof obj === 'object' && obj !== null) {
                  for (const key of Object.keys(obj)) {
                    const val = (obj as Record<string, unknown>)[key];
                    if (Array.isArray(val) && val.length > 0 && (val[0].title || val[0].slug)) {
                      return val as Record<string, unknown>[];
                    }
                  }
                }
                return [];
              };
              
              const potentialOffers = findOffers(data);
              if (potentialOffers.length > 0) {
                potentialOffers.forEach((offer: Record<string, unknown>) => {
                  const title = (offer.title || offer.name || "") as string;
                  const companyObj = offer.company as Record<string, unknown> | undefined;
                  const company = (offer.companyName || companyObj?.name || "Unknown") as string;
                  const slug = (offer.slug || offer.id || "") as string;
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
            } catch {
              // Ignore parsing errors for irrelevant JSONs
            }
          }
        }
      });

      console.log(`[JustJoinIT] Navigating to page and listening for JSON API...`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      
      // Try to click Sort -> Latest to ensure we get freshest jobs
      try {
        console.log(`[JustJoinIT] Changing sort order to Latest...`);
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sort by'));
          if (btn) btn.click();
        });
        await page.waitForTimeout(1000); // wait for dropdown animation
        await page.evaluate(() => {
          const latestOpt = Array.from(document.querySelectorAll('li, div[role="option"], button, p, span')).find(el => (el as HTMLElement).innerText.trim() === 'Latest' || (el as HTMLElement).innerText.trim() === 'Najnowsze');
          if (latestOpt) (latestOpt as HTMLElement).click();
        });
        // Additional wait to let SPA scripts process data and fetch new JSON
        await page.waitForTimeout(4000);
      } catch {
        console.log(`[JustJoinIT] Could not change sort order. Proceeding with default.`);
      }

      // Approach 2 (Fallback): If API was encoded differently, scrape the DOM
      if (jobs.length === 0) {
        console.log(`[JustJoinIT] Clean API interception failed. Scraping from DOM...`);
        const domJobs = await page.evaluate(() => {
          const map = new Map<string, { title: string, company: string, url: string, source: string, rawContent: string }>();
          const links = Array.from(document.querySelectorAll('a[href*="/job-offer/"]'));
          
          links.forEach(a => {
            const href = (a as HTMLAnchorElement).href;
            if (!map.has(href)) {
               map.set(href, { title: "", company: "Unknown", url: href, source: "JustJoinIT", rawContent: "" });
            }
            const item = map.get(href)!;
            
            const directText = (a as HTMLElement).innerText.trim();
            if (directText.length > 5 && directText !== "Show profile" && !directText.includes("New")) {
               item.title = directText;
            }
            
            let parent = a.parentElement;
            while(parent && parent.innerText.length < 40) {
               parent = parent.parentElement;
            }
            
            if (parent) {
               const fullText = parent.innerText.trim();
               item.rawContent = (item.rawContent + " " + fullText).toLowerCase();
               const lines = fullText.split('\n').filter(Boolean).map(l => l.trim());
               if (lines.length > 3) {
                 let comp = lines[0];
                 if (comp === "Super offer" || comp === "Live status" || comp.includes("Promoted")) {
                     comp = lines[1] || "Unknown";
                 }
                 if (comp !== item.title && comp.length > 1) {
                    item.company = comp;
                 }
               }
            }
          });
          return Array.from(map.values()).filter(j => j.title.length > 0);
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
