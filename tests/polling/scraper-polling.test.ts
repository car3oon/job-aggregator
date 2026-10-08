import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ScraperStatus } from "../../src/lib/scraper-polling";
import { loadSource } from "../helpers.ts";

const start = Date.parse("2026-10-07T12:00:00Z");
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function context() {
  let now = start;
  let nextId = 0;
  const timers = new Map<number, () => void>();
  const { watchScraperStatus } = loadSource<typeof import("../../src/lib/scraper-polling")>("src/lib/scraper-polling.ts", {}, {
    globals: {
      Date: { now: () => now, parse: Date.parse },
      setTimeout: (callback: () => void) => {
        const id = ++nextId;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: (id: number) => timers.delete(id),
    },
  });
  return {
    watchScraperStatus,
    timers,
    async tick(elapsed = 5000) {
      now += elapsed;
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
      await flush();
    },
  };
}

describe("Scraper status polling", () => {
  for (const status of ["completed", "unknown"]) {
    test(`idle page stops polling after ${status}`, async () => {
      const clock = context();
      let calls = 0;
      clock.watchScraperStatus(async () => { calls++; return { status }; }, () => {});
      await flush();
      await clock.tick(60_000);
      assert.equal(calls, 1);
      assert.equal(clock.timers.size, 0);
    });
  }

  test("active run is monitored until completion, then stops", async () => {
    const clock = context();
    const results = ["queued", "in_progress", "completed"];
    const seen: string[] = [];
    let calls = 0;
    clock.watchScraperStatus(async () => ({ status: results[calls++] }), (result) => seen.push(result.status));
    await flush();
    await clock.tick();
    await clock.tick();
    await clock.tick();
    assert.deepEqual(seen, results);
    assert.equal(calls, 3);
    assert.equal(clock.timers.size, 0);
  });

  test("manual dispatch ignores the previous completed run and discovers the new run", async () => {
    const clock = context();
    const seen: number[] = [];
    const results: ScraperStatus[] = [
      { runId: 10, status: "completed" },
      { runId: 10, status: "completed" },
      { runId: 11, status: "queued" },
      { runId: 11, status: "completed" },
    ];
    clock.watchScraperStatus(async () => results.shift()!, (result) => seen.push(result.runId!), {
      previousRunId: 10, requestedAt: new Date(start).toISOString(),
    });
    await flush();
    assert.equal(seen.length, 0);
    await clock.tick();
    assert.equal(seen.length, 0);
    await clock.tick();
    await clock.tick();
    assert.deepEqual(seen, [11, 11]);
    assert.equal(clock.timers.size, 0);
  });

  test("dispatch without a previous ID uses creation time to ignore old runs", async () => {
    const clock = context();
    const seen: string[] = [];
    let createdAt = new Date(start - 60_000).toISOString();
    clock.watchScraperStatus(async () => ({ runId: 12, status: "completed", createdAt }), (result) => seen.push(result.status), {
      requestedAt: new Date(start + 500).toISOString(),
    });
    await flush();
    assert.equal(seen.length, 0);
    createdAt = new Date(start).toISOString();
    await clock.tick();
    assert.deepEqual(seen, ["completed"]);
    assert.equal(clock.timers.size, 0);
  });

  test("missing dispatched run stops retrying after one minute", async () => {
    const clock = context();
    const seen: string[] = [];
    clock.watchScraperStatus(async () => ({ runId: 10, status: "completed" }), (result) => seen.push(result.status), {
      previousRunId: 10, requestedAt: new Date(start).toISOString(),
    });
    await flush();
    await clock.tick(60_000);
    assert.deepEqual(seen, ["unknown"]);
    assert.equal(clock.timers.size, 0);
  });

  test("monitoring has a time limit even if GitHub keeps reporting an active run", async () => {
    const clock = context();
    const seen: string[] = [];
    clock.watchScraperStatus(async () => ({ status: "in_progress" }), (result) => seen.push(result.status));
    await flush();
    await clock.tick(10 * 60_000);
    assert.deepEqual(seen, ["in_progress", "unknown"]);
    assert.equal(clock.timers.size, 0);
  });

  test("cleanup clears timers and prevents further requests", async () => {
    const clock = context();
    let calls = 0;
    const stop = clock.watchScraperStatus(async () => { calls++; return { status: "queued" }; }, () => {});
    await flush();
    stop();
    await clock.tick();
    assert.equal(calls, 1);
    assert.equal(clock.timers.size, 0);
  });

  test("cleanup ignores late responses and slow requests never overlap", async () => {
    const clock = context();
    const seen: string[] = [];
    let resolve!: (status: ScraperStatus) => void;
    const stop = clock.watchScraperStatus(() => new Promise((done) => { resolve = done; }), (result) => seen.push(result.status));
    await clock.tick(30_000);
    assert.equal(clock.timers.size, 0);
    stop();
    resolve({ status: "queued" });
    await flush();
    assert.equal(seen.length, 0);
    assert.equal(clock.timers.size, 0);
  });

  test("temporary API errors recover, persistent errors stop polling", async () => {
    const clock = context();
    const seen: string[] = [];
    let status = "queued";
    clock.watchScraperStatus(async () => {
      if (status === "error") throw new Error("API unavailable");
      return { status };
    }, (result) => seen.push(result.status));
    await flush();
    status = "error";
    await clock.tick();
    status = "in_progress";
    await clock.tick();
    status = "error";
    await clock.tick();
    await clock.tick();
    await clock.tick();
    assert.deepEqual(seen, ["queued", "in_progress", "unknown"]);
    assert.equal(clock.timers.size, 0);
  });
});
