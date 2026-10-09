import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { describe, test } from "node:test";
import { loadSource } from "../helpers.ts";

type Element = {
  type: unknown;
  props: { children?: unknown; fallback?: Element; [key: string]: unknown };
  key?: string;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function render(element: Element): Promise<Element> {
  const component = element.type as (props: Element["props"]) => Element | Promise<Element>;
  return Promise.resolve(component(element.props));
}

function findBoundary(node: unknown, suspense: symbol): Element | undefined {
  if (Array.isArray(node)) return node.map(child => findBoundary(child, suspense)).find(Boolean);
  if (!node || typeof node !== "object") return;
  const element = node as Element;
  return element.type === suspense ? element : findBoundary(element.props?.children, suspense);
}

function fixture() {
  const metadata = deferred<{ id: string; slug: string; name: string; keywords: string[]; excluded: string[]; _count: { jobs: number } }[]>();
  const jobs = deferred<unknown[]>();
  const reads: string[] = [];
  let jobQuery: unknown;
  const suspense = Symbol("Suspense");
  const jsx = (type: unknown, props: Element["props"], key?: string) => ({ type, props, key });
  const home = loadSource<{ default: (input: { searchParams: Promise<{ category?: string }> }) => Promise<Element> }>("src/app/page.tsx", {
    "@/lib/auth": { isAuthenticated: async () => true },
    "@/lib/prisma": { prisma: {
      category: { findMany: () => { reads.push("categories"); return metadata.promise; } },
      workPreference: { findMany: async () => { reads.push("preferences"); return []; } },
      scraperUrl: { findMany: async () => { reads.push("sources"); return []; } },
      job: { findMany: (query: unknown) => { reads.push("jobs"); jobQuery = query; return jobs.promise; } },
    } },
    react: { Suspense: suspense },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": () => {}, "lucide-react": {},
    "@/components/ui/button": {}, "@/components/RunScraperButton": {},
    "@/components/DashboardSkeleton": { DashboardSkeleton: () => null, JobListSkeleton: () => null },
  }).default;
  return { home, metadata, jobs, reads, suspense, jobQuery: () => jobQuery };
}

describe("Dashboard loading", () => {
  test("loading covers pending sidebar data, then keeps the sidebar available while offers load", async (t) => {
    const context = fixture();
    t.after(() => { context.metadata.resolve([]); context.jobs.resolve([]); });
    let shell: Element | undefined;
    const response = context.home({ searchParams: Promise.resolve({ category: "react" }) });
    void response.then(result => { shell = result; });
    await setImmediate();
    assert.ok(shell, "Home must return a loading boundary before sidebar data resolves");
    assert.equal(shell.type, context.suspense);
    assert.ok(shell.props.fallback);
    assert.deepEqual(context.reads, []);

    let dashboardReady = false;
    const pendingDashboard = render(shell.props.children as Element).then(result => { dashboardReady = true; return result; });
    await setImmediate();
    assert.equal(dashboardReady, false);
    assert.deepEqual(context.reads, ["categories", "preferences", "sources"]);
    context.metadata.resolve([{ id: "react-id", slug: "react", name: "React", keywords: [], excluded: [], _count: { jobs: 1 } }]);
    const dashboard = await pendingDashboard;
    assert.equal(dashboard.type, "div");
    assert.deepEqual(JSON.parse(JSON.stringify(context.jobQuery())).where, { categories: { some: { id: "react-id" } } });
    const offersBoundary = findBoundary(dashboard, context.suspense);
    assert.ok(offersBoundary?.props.fallback);

    let offersReady = false;
    const pendingOffers = render(offersBoundary.props.children as Element).then(result => { offersReady = true; return result; });
    await setImmediate();
    assert.equal(offersReady, false);
    context.jobs.resolve([]);
    const emptyList = await pendingOffers;
    assert.equal(offersReady, true);
    assert.equal((emptyList.props.children as Element[])[0].props.children, "No jobs found");
  });

  test("category navigation resets the dashboard boundary, including a category named all", async () => {
    const { home, reads } = fixture();
    const all = await home({ searchParams: Promise.resolve({}) });
    const react = await home({ searchParams: Promise.resolve({ category: "react" }) });
    const vue = await home({ searchParams: Promise.resolve({ category: "vue" }) });
    const categoryAll = await home({ searchParams: Promise.resolve({ category: "all" }) });
    assert.notEqual(react.key, vue.key);
    assert.notEqual(all.key, react.key);
    assert.notEqual(all.key, categoryAll.key);
    assert.deepEqual(reads, []);
  });
});
