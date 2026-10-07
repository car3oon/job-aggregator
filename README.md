# Job Aggregator

A personal job offer aggregator and dashboard.

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

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers (Required for the scraper):
   ```bash
   pnpm exec playwright install chromium
   ```

3. Setup Environment Variables:
   Create a `.env.local` file with your database URL and master password:
   ```env
   DATABASE_URL="postgres://..."
   ADMIN_PASSWORD="your-password"
   SESSION_SECRET="replace-with-a-random-secret-of-at-least-32-bytes"
   ```

   Generate a session secret with `pnpm exec node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Set `SESSION_SECRET` in your deployment environment as well. Keep it private and stable across deployments.
   Sessions expire after 30 days. Changing `SESSION_SECRET` or `ADMIN_PASSWORD` invalidates existing sessions.
   Cookies from older versions are rejected; sign in again after upgrading.

4. Prepare the Database:
   ```bash
   pnpm exec prisma generate
   pnpm exec prisma db push
   ```

5. Run the web dashboard:
   ```bash
   pnpm dev
   ```

## Running the Scraper

To fetch the latest jobs based on your configured sources and rules, run the standalone scraper script:

```bash
pnpm dlx tsx src/scripts/scraper/run.ts
```

## Running Tests

Use Node.js 24 or newer to run the TypeScript regression tests with Node's built-in test runner:

```bash
pnpm test
```

Run `pnpm typecheck` to check types in both the application and the test files.
