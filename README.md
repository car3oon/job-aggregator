# Job Aggregator

A personal job offer aggregator and dashboard. Built as a portfolio project to demonstrate full-stack capabilities, web scraping with Headless Browsers, background asynchronous data processing, and modern web architecture.

## Features

- **Automated Scraping:** Uses Playwright to navigate SPA-heavy job boards (like JustJoinIT) and intercept real-time API JSON responses, bypassing bot protections.
- **Smart Filtering Engine:** Parses raw job text against keyword rules (using strict AND `+` or OR `,` operators) and exclusions to automatically categorize jobs.
- **Protected Dashboard:** The entire application is secured via a single-tenant master password.
- **Dynamic Settings:** Manage job categories, work preferences, and scraper URLs directly from the `/settings` UI with inline editing.
- **Database:** Relational data architecture powered by Postgres and Prisma ORM.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Scraper Engine:** Playwright + Cheerio
- **Styling:** Tailwind CSS + shadcn/ui + lucide-react
- **ORM:** Prisma ORM
- **Database:** Postgres
- **Validation:** Zod

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers (Required for the scraper):
   ```bash
   npx playwright install chromium
   ```

3. Setup Environment Variables:
   Create a `.env.local` file with your database URL and master password:
   ```env
   DATABASE_URL="postgres://..."
   ADMIN_PASSWORD="your-password"
   ```

4. Prepare the Database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Run the web dashboard:
   ```bash
   pnpm run dev
   ```

## Running the Scraper

To fetch the latest jobs based on your configured sources and rules, run the standalone scraper script:

```bash
npx tsx src/scripts/scraper/run.ts
```
