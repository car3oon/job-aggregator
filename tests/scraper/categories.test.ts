import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadSource } from "../helpers.ts";

const engine = loadSource<typeof import("../../src/scripts/scraper/engine")>("src/scripts/scraper/engine.ts");

describe("Category filtering and saved offers", () => {
  test("Junior in the title or description overrides a matching keyword group", () => {
    const category = { keywords: ["react + developer"], excluded: ["junior"] };
    assert.equal(engine.matchesCategory("Junior Creative Developer React Frontend", category), false);
    assert.equal(engine.matchesCategory("React Developer Senior / Junior", category), false);
    assert.equal(engine.matchesCategory("React Developer JUNIOR", category), false);
    assert.equal(engine.matchesCategory("React Developer Juniority", category), true);
    assert.equal(engine.matchesCategory("React Developer", category), true);
    assert.equal(engine.matchesCategory("Python Developer", category), false);
  });

  test("editing filters removes stale links and includes existing offers that now match", async () => {
    const jobs = [
      { id: "junior-title", title: "Junior Creative Developer", description: "React Frontend" },
      { id: "junior-description", title: "React Developer", description: "Junior" },
      { id: "senior", title: "Senior React Developer", description: null },
      { id: "new-match", title: "Frontend Developer", description: "React" },
      { id: "backend", title: "React Backend Developer", description: "React" },
    ];
    let update: Record<string, unknown> | undefined;
    const paths: string[] = [];
    const transaction = {
      job: { findMany: async () => jobs },
      category: { update: async (args: Record<string, unknown>) => { update = args; } },
    };
    const actions = loadSource<typeof import("../../src/app/actions/category")>("src/app/actions/category.ts", {
      "@/lib/auth": { verifyAuth: async () => {} },
      "@/lib/prisma": { prisma: { $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction) } },
      "@/scripts/scraper/engine": engine,
      "next/cache": { revalidatePath: (path: string) => paths.push(path) },
    });
    const result = await actions.updateCategory("react-category", " React Frontend ", " REACT + DEVELOPER ", " Junior, Backend ");
    assert.equal(result.success, true);
    assert.deepEqual(JSON.parse(JSON.stringify(update)), {
      where: { id: "react-category" },
      data: {
        name: "React Frontend", slug: "react-frontend",
        keywords: ["react + developer"], excluded: ["junior", "backend"],
        jobs: { set: [{ id: "senior" }, { id: "new-match" }] },
      },
    });
    assert.deepEqual(paths, ["/settings", "/"]);
  });

  test("a failed category transaction returns an error without refreshing the dashboard", async () => {
    const actions = loadSource<typeof import("../../src/app/actions/category")>("src/app/actions/category.ts", {
      "@/lib/auth": { verifyAuth: async () => {} },
      "@/lib/prisma": { prisma: { $transaction: async () => { throw new Error("Database unavailable"); } } },
      "@/scripts/scraper/engine": engine,
      "next/cache": { revalidatePath: () => { assert.fail("Failed changes must not refresh the dashboard"); } },
    });
    const result = await actions.updateCategory("react-category", "React Frontend", "react", "junior");
    assert.match(result.error ?? "", /Failed to update category/);
  });
});
