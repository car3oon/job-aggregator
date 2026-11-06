# Job Aggregator

A personal tech job offer aggregator, deduplicator, and management dashboard with an AI Assistant.

## Features

- **Job Sources:** Collects and parses tech job listings from **JustJoinIT**, **Pracuj.pl**, **No Fluff Jobs**, and **Theprotocol.it**.
- **Smart Grouping & Deduplication:** Merges identical postings across multiple portals (Level A) and groups related title variants from the same employer (Level B).
- **Rule-Based Categorization:** Automatically categorizes jobs against user-defined keyword rules with strict AND (`+`), OR (`,`), and exclusion filters.
- **Application Tracking:** Track offer progress with statuses (`INBOX`, `SAVED`, `APPLIED`, `REJECTED`) and timestamps.
- **AI Assistant:** In-app conversational assistant powered by the **Vercel AI SDK** and **Google Gemini**:
  - Natural language search (e.g. *"Show recent React jobs"*, *"What jobs did I save?"*).
  - One-click mutations directly inside the chat (Save, Apply, Reject, Reset).
  - Scraper run details and platform statistics.
  - Interactive job cards with optimistic updates.
- **Dynamic Settings:** Manage job categories, work preferences, scraper target URLs, and AI model settings directly from `/settings`.
- **Protected Dashboard:** Single-tenant authentication secured with cryptographic session cookies and a master password.
- **Database Architecture:** Relational data storage powered by PostgreSQL and Prisma ORM 7.

## Tech Stack

- **Framework:** Next.js (App Router, Turbopack, React Server Components)
- **AI Engine:** Vercel AI SDK (`ai` v7 + `@ai-sdk/react` + `@ai-sdk/google`)
- **Scraper Engine:** Playwright (Pracuj.pl, Theprotocol.it) + native fetch & Cheerio (No Fluff Jobs)
- **Styling:** Tailwind CSS + Base UI primitives + `lucide-react`
- **ORM:** Prisma ORM 7 with PostgreSQL adapter (`@prisma/adapter-pg`)
- **Database:** PostgreSQL

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers (required for Pracuj.pl and Theprotocol.it scrapers):
   ```bash
   pnpm exec playwright install chromium
   ```

3. Setup Environment Variables:
   Create a `.env.local` file with your database URL, master password, session secret, and Google Gemini API key:
   ```env
   DATABASE_URL="postgres://..."
   ADMIN_PASSWORD="your-password"
   SESSION_SECRET="replace-with-a-random-secret-of-at-least-32-bytes"

   # AI Assistant (Google Gemini)
   GOOGLE_GENERATIVE_AI_API_KEY="AIzaSy..."
   # Optional: defaults to gemini-flash-lite-latest (or gemini-3.5-flash)
   GEMINI_MODEL="gemini-flash-lite-latest"
   ```

   Generate a session secret with:
   ```bash
   pnpm exec node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
   Set `SESSION_SECRET` in your deployment environment as well. Keep it private and stable across deployments.
   Sessions expire after 30 days. Changing `SESSION_SECRET` or `ADMIN_PASSWORD` invalidates existing sessions.
   Cookies from older versions are rejected; sign in again after upgrading.

4. Prepare the Database:
   ```bash
   pnpm exec prisma generate
   pnpm exec prisma db push
   ```

5. Run the development server:
   ```bash
   pnpm dev
   ```

## Running the Scraper

Add active scraper targets in **Settings → Scraper Targets**. Supported domains:
- `justjoin.it`
- `pracuj.pl`
- `nofluffjobs.com`
- `theprotocol.it`

Trigger a manual scrape directly from the dashboard button, or execute locally via CLI:
```bash
pnpm dlx tsx src/scripts/scraper/run.ts
```

To run only selected sources, set `SCRAPER_SOURCES` to a comma-separated list of adapter domains. For example, run only Theprotocol.it locally with:
```bash
SCRAPER_SOURCES=theprotocol.it THEPROTOCOL_HEADLESS=false pnpm dlx tsx src/scripts/scraper/run.ts
```

The GitHub Actions schedule explicitly selects `justjoin.it`, `nofluffjobs.com`, and `pracuj.pl`; schedule the Theprotocol.it command on the local machine separately. Both environments should use the same database connection if they are expected to update the same dashboard data.

## Running Tests

Run the full TypeScript test suite using Node.js built-in test runner:
```bash
pnpm test
```

Tests can also be executed by scope:

| Scope | Command | Description |
| --- | --- | --- |
| Full Suite | `pnpm test` | Runs all unit and integration tests |
| AI Assistant | `pnpm exec node --test "tests/ai-assistant.test.ts"` | Backend tools, API route handler, and UI components |
| Auth | `pnpm test:auth` | Sessions, login verification, and route proxies |
| Scraper | `pnpm test:scraper` | Adapters, pagination, grouping, and filtering |
| Polling | `pnpm test:polling` | Scraper monitoring, timeouts, and status updates |

Run `pnpm check` to execute TypeScript type checking (`tsc --noEmit`) and ESLint:
```bash
pnpm check
```
