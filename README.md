# Job Aggregator

A personal job offer aggregator and dashboard. Built as a portfolio project to demonstrate full-stack capabilities, background asynchronous data processing, and modern web architecture.

## Features

- **Protected Dashboard:** The entire application is secured via a single-tenant master password.
- **Dynamic Categories:** Manage job categories (like React, Node, Vue) dynamically from the `/settings` panel.
- **Modern Stack:** Fully utilizes Next.js App Router, React Server Components, and Server Actions.
- **Database:** Relational data architecture powered by Vercel Postgres and Prisma ORM.
- **Data Normalization:** Preparing for AI integration to normalize raw job tags into strict categories.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **ORM:** Prisma ORM
- **Database:** Vercel Postgres (Serverless)
- **Validation:** Zod

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Generate Prisma Client:
   ```bash
   pnpm exec prisma generate
   ```

3. Run the development server:
   ```bash
   pnpm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
