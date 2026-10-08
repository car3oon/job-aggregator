# Job Aggregator

A personal job offer aggregator and dashboard.

## Features

- **Job Sources:** Supports JustJoinIT via Playwright and No Fluff Jobs via HTTP and Cheerio.
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

Add an active source in **Settings → Scraper URLs**. Supported domains are `justjoin.it` and `nofluffjobs.com`.
For No Fluff Jobs, use `https://nofluffjobs.com/pl` or a category listing such as `https://nofluffjobs.com/pl/frontend`.
The No Fluff Jobs adapter reads the offers included in the listing HTML, including promoted offers, and applies your existing category and work preference rules. It does not follow the “load more” button or fetch individual offer descriptions. Add relevant category URLs for more focused coverage.

To fetch the latest jobs based on your configured sources and rules, run the standalone scraper script:

```bash
pnpm dlx tsx src/scripts/scraper/run.ts
```

## Running Tests

Use Node.js 24 or newer to run the TypeScript regression tests with Node's built-in test runner:

```bash
pnpm test
```

Tests are grouped by feature, with named suites in the output:

| Directory | Scope | Command |
| --- | --- | --- |
| `tests/auth/` | Sessions, login and access control | `pnpm test:auth` |
| `tests/scraper/` | Scraper runner, source adapters and filtering | `pnpm test:scraper` |
| `tests/polling/` | Status monitoring, timeouts and cleanup | `pnpm test:polling` |

Shared test utilities remain in `tests/helpers.ts`, and subprocess fixtures in `tests/fixtures/`.
The regression test job in CI runs each group as a separate step. Tests use local fixtures and boundary mocks, without a database, GitHub credentials or live job board requests.

Run `pnpm typecheck` to check types in both the application and the test files.
