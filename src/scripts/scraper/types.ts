export interface ScrapedJob {
  title: string;
  url: string;
  source: string;
  company?: string;
  rawContent: string; // The entire HTML or text content to pass to our Smart Engine
}

export interface ScraperAdapter {
  sourceName: string;
  domain: string;
  scrape(url: string): Promise<ScrapedJob[]>;
}
