import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { describe, test } from "node:test";
import * as cheerio from "cheerio";
import { loadSource } from "../helpers.ts";
import type { ScraperAdapter, ScrapedJobStatus } from "../../src/scripts/scraper/types";

type NfjModule = typeof import("../../src/scripts/scraper/adapters/nofluffjobs");
const offerUrl = "https://nofluffjobs.com/pl/job/mid-senior-frontend-developer-vue-js-euvic-remote";
const slug = offerUrl.split("/").at(-1)!;
const detail = (status: string, banner = false, keySlug = slug) => `
  <common-posting-header><h1>Mid/Senior Frontend Developer (Vue.js)</h1></common-posting-header>
  ${banner ? "<nfj-posting-expired-breadcrumbs>Oferta pracy wygasła.</nfj-posting-expired-breadcrumbs>" : ""}
  <script id="serverApp-state">${JSON.stringify({ [`/posting/${keySlug}?region=pl`]: { status } })}</script>`;

const { parseNoFluffJobStatus } = loadSource<NfjModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio });
const { refreshJobAvailability } = loadSource<typeof import("../../src/scripts/scraper/availability")>("src/scripts/scraper/availability.ts");

describe("No Fluff Jobs availability", () => {
  test("recognizes the disabled Euvic posting and a published offer", () => {
    assert.equal(parseNoFluffJobStatus(detail("DISABLED", true), offerUrl), "expired");
    assert.equal(parseNoFluffJobStatus(detail("EXPIRED", true), offerUrl), "expired");
    assert.equal(parseNoFluffJobStatus(detail("PUBLISHED"), offerUrl), "active");
  });

  for (const [name, html] of [
    ["challenge", "<h1>Verify you are human</h1>"],
    ["missing state", "<nfj-posting-expired-breadcrumbs>Oferta wygasła</nfj-posting-expired-breadcrumbs>"],
    ["invalid state", '<script id="serverApp-state">invalid</script>'],
    ["different posting", detail("DISABLED", true, "another-offer")],
    ["missing confirmation banner", detail("DISABLED")],
    ["contradictory status", detail("PUBLISHED", true)],
    ["unknown status", detail("DRAFT", true)],
    ["missing posting header", detail("PUBLISHED").replace(/<common-posting-header>.*?<\/common-posting-header>/, "")],
  ]) {
    test(`${name} retains an unknown status`, () => assert.equal(parseNoFluffJobStatus(html, offerUrl), "unknown"));
  }

  test("expired recommendations and translation strings cannot expire the requested posting", () => {
    const html = detail("PUBLISHED").replace("</script>", "</script><p>Another offer expired</p>") +
      '<script type="application/json">{"expired":"Oferta wygasła","suggestions":[{"status":"DISABLED"}]}</script>';
    assert.equal(parseNoFluffJobStatus(html, offerUrl), "active");
  });

  test("requests the detail page with a timeout and without following redirects", async () => {
    const { getNoFluffJobStatus } = loadSource<NfjModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio }, {
      globals: { AbortSignal, fetch: async (url: URL, options: RequestInit) => {
        assert.equal(url.href, offerUrl);
        assert.equal(options.redirect, "manual");
        assert.ok(options.signal);
        return new Response(detail("DISABLED", true), { headers: { "content-type": "text/html" } });
      } },
    });
    assert.equal(await getNoFluffJobStatus(`${offerUrl}?utm_source=test#details`), "expired");
  });

  for (const status of [302, 403, 404, 410, 429, 500]) {
    test(`HTTP ${status} does not prove expiry`, async () => {
      const { getNoFluffJobStatus } = loadSource<NfjModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio }, {
        globals: { AbortSignal, fetch: async () => new Response(detail("DISABLED", true), { status, headers: { "content-type": "text/html" } }) },
      });
      assert.equal(await getNoFluffJobStatus(offerUrl), "unknown");
    });
  }

  test("wrong content types and unexpected final URLs remain unknown", async () => {
    for (const [type, url] of [["application/json", offerUrl], ["text/html", "https://example.test/offer"]]) {
      const { getNoFluffJobStatus } = loadSource<NfjModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio }, {
        globals: { AbortSignal, fetch: async () => ({ status: 200, url, headers: new Headers({ "content-type": type }), text: async () => detail("DISABLED", true) }) },
      });
      assert.equal(await getNoFluffJobStatus(offerUrl), "unknown");
    }
  });

  test("invalid targets fail before any network request", async () => {
    const { getNoFluffJobStatus } = loadSource<NfjModule>("src/scripts/scraper/adapters/nofluffjobs.ts", { cheerio }, {
      globals: { fetch: () => assert.fail("Unexpected request") },
    });
    for (const url of ["https://example.test/pl/job/test", "http://nofluffjobs.com/pl/job/test", "https://nofluffjobs.com/pl/frontend", "https://nofluffjobs.com:8080/pl/job/test", "https://nofluffjobs.com.example.test/pl/job/test"]) {
      await assert.rejects(getNoFluffJobStatus(url), /No Fluff Jobs/);
    }
  });
});

describe("Saved offer availability", () => {
  const saved = (id: string, expired = false) => ({
    id, url: `${offerUrl}-${id}`, updatedAt: new Date("2026-10-01T00:00:00Z"),
    expiredAt: expired ? new Date("2026-10-02T00:00:00Z") : null,
  });

  test("hides only confirmed expired offers, restores active ones and retains unknown statuses", async () => {
    const jobs = [saved("expired"), saved("active"), saved("unknown"), saved("failure"), saved("already-expired", true), saved("restored", true), saved("unknown-archived", true), saved("concurrent")];
    const changes: { id: string; expiredAt: Date | null }[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const adapter: ScraperAdapter = {
      domain: "nofluffjobs.com", sourceName: "NoFluffJobs", scrape: async () => [],
      getStatus: async url => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await setImmediate();
        inFlight--;
        const job = jobs.find(job => job.url === url)!;
        if (job.id === "failure") throw new Error("Network timeout");
        if (job.id.startsWith("unknown")) return "unknown";
        return ["active", "restored"].includes(job.id) ? "active" : "expired";
      },
    };
    const result = await refreshJobAvailability(adapter, {
      findMany: async ({ where }) => { assert.equal(where.source, "NoFluffJobs"); return jobs; },
      updateMany: async ({ where, data }) => {
        const original = jobs.find(job => job.id === where.id)!;
        assert.equal(where.url, original.url);
        assert.equal(where.updatedAt, original.updatedAt);
        if (where.id === "concurrent") return { count: 0 };
        changes.push({ id: where.id, expiredAt: data.expiredAt });
        return { count: 1 };
      },
    }, () => {});
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { checked: 8, expired: 1, restored: 1, unknown: 3 });
    assert.equal(maxInFlight, 3);
    assert.deepEqual(changes.map(change => change.id), ["expired", "restored"]);
    assert.ok(changes[0].expiredAt instanceof Date);
    assert.equal(changes[1].expiredAt, null);
  });

  test("unsupported portals do not read or modify saved records", async () => {
    await refreshJobAvailability({ sourceName: "Pracuj.pl", domain: "pracuj.pl", scrape: async () => [] }, {
      findMany: () => assert.fail("Unexpected read"), updateMany: () => assert.fail("Unexpected mutation"),
    }, () => {});
  });

  test("database failures propagate to the scraper instead of reporting successful verification", async () => {
    await assert.rejects(refreshJobAvailability({
      sourceName: "NoFluffJobs", domain: "nofluffjobs.com", scrape: async () => [], getStatus: async (): Promise<ScrapedJobStatus> => "expired",
    }, {
      findMany: async () => [saved("expired")], updateMany: async () => { throw new Error("Database unavailable"); },
    }, () => {}), /Database unavailable/);
  });
});
