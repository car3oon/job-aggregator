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

  test("React Native is rejected by the combined exclusion shown in React Frontend settings", () => {
    const category = {
      keywords: ["react + frontend", "react + developer", "react.js + developer", "react.js + frontend", "next.js + frontend"],
      excluded: ["fullstack", "backend", "full stack", "junior", "react + native"],
    };
    assert.equal(engine.matchesCategory("Mobile React Native Developer (m/k/n)", category), false);
    assert.equal(engine.matchesCategory("Senior React Frontend Developer", category), true);
    assert.equal(engine.matchesCategory("React Developer NativeScript", category), true);
    assert.equal(engine.matchesCategory("React Developer for web and native mobile applications", category), false);
  });

  test("exclusion groups require all their terms and remain OR alternatives", () => {
    const category = { keywords: ["developer"], excluded: ["react + native", "junior"] };
    assert.equal(engine.matchesCategory("React Native Developer", category), false);
    assert.equal(engine.matchesCategory("NATIVE mobile Developer using REACT", category), false);
    assert.equal(engine.matchesCategory("Junior Python Developer", category), false);
    assert.equal(engine.matchesCategory("React Developer", category), true);
    assert.equal(engine.matchesCategory("Native Android Developer", category), true);
    assert.equal(engine.matchesCategory("Reactor Native Developer", category), true);
  });

  test("empty terms do not create matching inclusion or exclusion groups", () => {
    assert.equal(engine.matchesCategory("React Developer", { keywords: ["", "react + "], excluded: [] }), false);
    assert.equal(engine.matchesCategory("React Developer", { keywords: ["react"], excluded: ["", " + ", "react + "] }), true);
  });

  test("editing filters removes stale links and includes existing offers that now match", async () => {
    const jobs = [
      { id: "junior-title", title: "Junior Creative Developer", description: "React Frontend" },
      { id: "junior-description", title: "React Developer", description: "Junior" },
      { id: "senior", title: "Senior React Developer", description: null },
      { id: "new-match", title: "Frontend Developer", description: "React" },
      { id: "backend", title: "React Backend Developer", description: "React" },
      { id: "native-title", title: "Mobile React Native Developer (m/k/n)", description: null },
      { id: "native-description", title: "React Developer", description: "Build native mobile applications with React" },
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
    const result = await actions.updateCategory("react-category", " React Frontend ", " REACT + DEVELOPER ", " Junior, Backend, React + Native ");
    assert.equal(result.success, true);
    assert.deepEqual(JSON.parse(JSON.stringify(update)), {
      where: { id: "react-category" },
      data: {
        name: "React Frontend", slug: "react-frontend",
        keywords: ["react + developer"], excluded: ["junior", "backend", "react + native"],
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
