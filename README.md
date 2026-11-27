# Job Aggregator

A personal tech job offer aggregator, deduplicator, and management dashboard with an AI Assistant, per-offer analysis, and CV matching.

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
- **AI Job Analysis:** Per-offer structured analysis with **Google Gemini** — role summary, required skills, seniority, location, work mode, and compensation. Results are cached in the database and rendered in a collapsible panel on each job card.
- **AI Interview Prep:** Per-offer interview preparation guide generated with **Google Gemini** — ranked study priorities, technical and behavioral questions, CV-backed talking points, questions to ask the interviewer, and potential red flags. Cached in the database and marked stale when the job description or active CV set changes.
- **CV Matching:** Recommends the best CV version for an offer, including reasoning, strengths, and gaps. When critical requirements are missing, an alert panel highlights the gaps and flags missing skills directly on the required skills chips. Results are marked stale automatically when the job description or the active CV set changes; re-analysis is always an explicit action.
- **CV Library:** Upload and manage up to 10 CV versions (PDF or DOCX, 5 MB max each) from `/settings`. Files are parsed server-side, hashed with SHA-256, and only metadata (label, filename, word count) is sent to the browser.
- **Dynamic Settings:** Manage job categories, work preferences, scraper target URLs, AI model settings, and the CV library directly from `/settings`.
- **Protected Dashboard:** Single-tenant authentication secured with cryptographic session cookies and a master password.
- **Database Architecture:** Relational data storage powered by PostgreSQL and Prisma ORM 7.

## Tech Stack

- **Framework:** Next.js (App Router, Turbopack, React Server Components)
- **AI Engine:** Vercel AI SDK (`ai` v7 + `@ai-sdk/react` + `@ai-sdk/google`)
- **Document Parsing:** `unpdf` (PDF) and `mammoth` (DOCX) for CV text extraction
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

   # AI Assistant and job analysis (Google Gemini)
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
   pnpm exec prisma migrate deploy
   ```
   Apply the committed migrations on any environment that should keep migration history. For a scratch local database you can instead sync the schema directly with `pnpm exec prisma db push`.

   When you change `prisma/schema.prisma`, create a migration and commit it together with the schema:
   ```bash
   pnpm exec prisma migrate dev --name <change-name>
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
pnpm scrape:local
```

`scrape:local` runs all four adapters against the targets stored in the database. Pracuj.pl and Theprotocol.it open a real browser window, because Cloudflare challenges headless browsers on those portals; the run therefore needs a desktop session (on Linux CI it runs headed under `xvfb-run`).

To run only selected sources, set `SCRAPER_SOURCES` to a comma-separated list of adapter domains:
```bash
SCRAPER_SOURCES=theprotocol.it pnpm scrape:local
```

For a headless run without a display, use the bare command and accept that Cloudflare-protected portals may fail:
```bash
pnpm exec tsx src/scripts/scraper/run.ts
```

The GitHub Actions schedule explicitly selects `justjoin.it`, `nofluffjobs.com`, and `pracuj.pl`; run Theprotocol.it locally with `pnpm scrape:theprotocol`. Both environments should use the same database connection if they are expected to update the same dashboard data.

## AI Job Analysis, Interview Prep & CV Library

The dashboard can analyze any job and generate interview preparation notes for any offer that has a stored description. Both features use the same Google Gemini key as the assistant (`GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`) and the same model setting (`GEMINI_MODEL` or `AI_MODEL`, default `gemini-flash-lite-latest`), with automatic fallback across alternative Gemini flash models (`gemini-flash-lite-latest`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`) on transient `503`/`429` overload errors.

1. Open **Settings → CV Library** and upload up to 10 CV versions as PDF or DOCX (5 MB max each). Text extraction happens on the server; labels can be renamed, files replaced, and versions deleted. Analysis and interview prep work without CVs, while CV matching and CV-backed talking points are populated when at least one version exists.
2. On the dashboard, click **Analyze** on a job card. The result appears in a collapsible panel with the summary, required skills, seniority, location, work mode, compensation, and — when CVs are available — the recommended CV with reasoning, strengths, and gaps. If no CV satisfies the requirements, a dedicated alert panel details the missing qualifications, and missing skills are highlighted with a `✕` badge on the required skills list.
3. Click **Prep** on a job card to generate a structured interview preparation drawer containing prep priorities, technical questions, behavioral questions, CV-backed talking points, questions to ask, and red flags.

The header **AI Analysis** and **Prep** buttons only expand or collapse their respective panels once cached; re-running the model is always an explicit **Re-analyze** or **Re-generate** action inside the panel.

Cached results are shown as stale ("Job or CV data changed — re-analyze available" / "re-generate available") when the stored job description hash or the composite hash of the active CV versions no longer matches the values captured at generation time. Replacing or deleting a CV therefore invalidates previous matches and talking points. Re-running updates the cached record for that job in place.

Uploads use a server action body limit of 6 MB (`next.config.ts`), so no extra configuration is required beyond the default setup.

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
| CV Library | `pnpm test:cv` | CV parsing, hashing, upload limits, and library actions |
| Scraper | `pnpm test:scraper` | Adapters, pagination, grouping, and filtering |
| Polling | `pnpm test:polling` | Scraper monitoring, timeouts, and status updates |

Run `pnpm check` to execute TypeScript type checking (`tsc --noEmit`) and ESLint:
```bash
pnpm check
```
