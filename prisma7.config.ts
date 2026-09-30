import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Vercel Prisma Postgres domyślnie używa zmiennej PRISMA_DATABASE_URL
    url: process.env["PRISMA_DATABASE_URL"] || process.env["DATABASE_URL"],
  },
});
