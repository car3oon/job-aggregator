import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as cheerio from "cheerio";
import { loadSource } from "../helpers.ts";

type AdapterModule = typeof import("../../src/scripts/scraper/adapters/pracuj");
const offer = (id = "1001234567") => ({
  groupId: id, jobTitle: "React Developer", companyName: "Example Company",
  jobDescription: "Build React and TypeScript applications", aiSummary: "<b>Next.js</b><i>Node.js</i>",
  positionLevels: ["Specialist (mid / Regular)"], typesOfContract: ["B2B"],
  workModes: ["Praca zdalna"], isRemoteWorkAllowed: true, salaryDisplayText: "20000 PLN",
  offers: [{ offerAbsoluteUri: `https://www.pracuj.pl/praca/react-developer,oferta,${id}?tracking=1#details`, displayWorkplace: "Warsaw" }],
});

const state = (groups = [offer()], page = 1, total = groups.length, size = 20) => ({ props: { pageProps: {
  searchCriteria: { pn: page, rop: size, sc: 0 },
  dehydratedState: { queries: [
    { queryKey: ["positionedJobOffers"], state: { data: { groupedOffers: [offer("9999999999")] } } },
    { queryKey: ["jobOffers"], state: { data: { groupedOffers: groups, groupedOffersTotalCount: total } } },
  ] },
} } });
const html = (value: unknown) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(value)}</script>`;

function context(pages: string[], headless?: string) {
  let current = 0;
  let closed = false;
  let launched = false;
  let failure: "http" | "timeout" | "context" | "redirect" | undefined;
  const visited: string[] = [];
  const challengeWaits: number[] = [];
  const challenges = new Map<number, { resolvedHtml?: string; redirect?: string }>();
  let redirectedUrl: string | undefined;
  const page = {
    goto: async (url: string, options: { waitUntil: string; timeout: number }) => {
      assert.equal(options.waitUntil, "domcontentloaded");
      assert.equal(options.timeout, 30_000);
      current = visited.length;
      redirectedUrl = undefined;
      visited.push(url);
      if (failure === "timeout") throw new Error("Navigation timeout");
      return {
        ok: () => failure !== "http" && !challenges.has(current),
        status: () => 403,
        headers: () => challenges.has(current) ? { "cf-mitigated": "challenge" } : {},
      };
    },
    url: () => redirectedUrl ?? (failure === "redirect" ? "https://example.test/praca" : visited.at(-1)),
    locator: (selector: string) => {
      assert.equal(selector, "script#__NEXT_DATA__");
      return { waitFor: async (options: { state: string; timeout: number }) => {
        assert.equal(options.state, "attached");
        assert.equal(options.timeout, 30_000);
        challengeWaits.push(current);
        const challenge = challenges.get(current);
        if (!challenge?.resolvedHtml) throw new Error("Verification timeout");
        pages[current] = challenge.resolvedHtml;
        redirectedUrl = challenge.redirect;
      } };
    },
    content: async () => pages[current],
  };
  const adapter = loadSource<AdapterModule>("src/scripts/scraper/adapters/pracuj.ts", {
    cheerio, playwright: { chromium: { launch: async (options: { headless: boolean; channel: string }) => {
      assert.equal(options.headless, headless !== "false");
      assert.equal(options.channel, "chromium");
      launched = true;
      return {
        newPage: async () => {
          if (failure === "context") throw new Error("Browser context failed");
          return page;
        },
        close: async () => { closed = true; },
      };
    } } },
  }, { process: { env: { PRACUJ_HEADLESS: headless } } });
  return { ...adapter, visited, challengeWaits,
    setChallenge: (page: number, resolvedHtml?: string, redirect?: string) => { challenges.set(page - 1, { resolvedHtml, redirect }); },
    setFailure: (value: typeof failure) => { failure = value; },
    isClosed: () => closed, isLaunched: () => launched };
}

describe("Pracuj.pl adapter", () => {
  test("extracts main results, strips tracking and includes metadata with keyword boundaries", () => {
    const parsed = context([]).parsePracujListing(html(state()));
    assert.equal(parsed.jobs.length, 1);
    assert.equal(parsed.jobs[0].source, "Pracuj.pl");
    assert.equal(parsed.jobs[0].company, "Example Company");
    assert.equal(parsed.jobs[0].url, "https://www.pracuj.pl/praca/react-developer,oferta,1001234567");
    assert.match(parsed.jobs[0].rawContent, /Next.js Node.js/);
    assert.match(parsed.jobs[0].rawContent, /Regular.*B2B.*Praca zdalna.*Warsaw.*20000 PLN.*Remote Zdalnie/);
  });

  test("multi-location groups use a stable URL, retain locations and deduplicate repeated groups", () => {
    const group = offer();
    group.offers.push({ offerAbsoluteUri: "https://www.pracuj.pl/praca/react-developer,oferta,1001234568", displayWorkplace: "Krakow" });
    const parser = context([]).parsePracujListing;
    const first = parser(html(state([group, group]))).jobs;
    const reversed = parser(html(state([{ ...group, offers: [...group.offers].reverse() }]))).jobs;
    assert.equal(first.length, 1);
    assert.equal(first[0].url, reversed[0].url);
    assert.match(first[0].rawContent, /Warsaw Krakow/);
  });

  test("seniority metadata participates in Junior exclusions", () => {
    const junior = { ...offer(), positionLevels: ["Młodszy specjalista (junior)"] };
    const job = context([]).parsePracujListing(html(state([junior]))).jobs[0];
    const { matchesCategory } = loadSource<typeof import("../../src/scripts/scraper/engine")>("src/scripts/scraper/engine.ts");
    assert.equal(matchesCategory(job.rawContent, { keywords: ["react + developer"], excluded: ["junior"] }), false);
  });

  test("only explicitly empty main results count as a successful empty listing", async () => {
    const ctx = context([html(state([]))]);
    assert.equal((await ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw")).length, 0);
    assert.equal(ctx.isClosed(), true);
  });

  test("search URLs preserve filters and replace pagination and sort in both URL formats", () => {
    const result = new URL(context([]).getPracujPageUrl("https://www.pracuj.pl/praca/react;kw/3;pn/50;rop/2;sc?wm=2&pn=4&sc=3#offers", 1));
    assert.equal(result.pathname, "/praca/react;kw");
    assert.equal(result.searchParams.get("wm"), "2");
    assert.equal(result.searchParams.get("pn"), "1");
    assert.equal(result.searchParams.get("rop"), "20");
    assert.equal(result.searchParams.get("sc"), "0");
    assert.equal(result.hash, "");
  });

  test("fetches only the newest first page and preserves the source filters", async () => {
    const ctx = context([html(state([offer()], 1, 40)), "<html>Blocked second page</html>"]);
    const jobs = await ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw?wm=2&pn=4&sc=3");
    assert.equal(jobs.length, 1);
    assert.equal(ctx.visited.length, 1);
    const url = new URL(ctx.visited[0]);
    assert.equal(url.searchParams.get("pn"), "1");
    assert.equal(url.searchParams.get("rop"), "20");
    assert.equal(url.searchParams.get("sc"), "0");
    assert.equal(url.searchParams.get("wm"), "2");
    assert.equal(ctx.isClosed(), true);
  });

  test("caps an overfilled first page at the first 20 offers", async () => {
    const groups = Array.from({ length: 25 }, (_, index) => offer(String(1000000000 + index)));
    const ctx = context([html(state(groups, 1, 200))]);
    const jobs = await ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw");
    assert.equal(jobs.length, 20);
    assert.ok(jobs[0].url.endsWith("1000000000"));
    assert.ok(jobs[19].url.endsWith("1000000019"));
    assert.equal(ctx.visited.length, 1);
    assert.equal(ctx.isClosed(), true);
  });

  test("frontend and fullstack searches have independent 20-offer limits", async () => {
    const groups = (title: string, offset: number) => Array.from({ length: 20 }, (_, index) => ({
      ...offer(String(1000000000 + offset + index)), jobTitle: title,
    }));
    const ctx = context([
      html(state(groups("Frontend Developer", 0), 1, 200)),
      html(state(groups("Fullstack Developer", 20), 1, 200)),
    ], "false");
    const frontend = await ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/frontend;kw");
    const fullstack = await ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/fullstack;kw");
    assert.equal(frontend.length, 20);
    assert.equal(fullstack.length, 20);
    assert.ok(frontend.every(job => job.title === "Frontend Developer"));
    assert.ok(fullstack.every(job => job.title === "Fullstack Developer"));
    assert.deepEqual(ctx.visited.map(url => new URL(url).pathname), ["/praca/frontend;kw", "/praca/fullstack;kw"]);
    assert.ok(ctx.visited.every(url => new URL(url).searchParams.get("pn") === "1"));
    assert.equal(ctx.isClosed(), true);
  });

  for (const [name, value] of [
    ["missing state", "<html>Verify you are human</html>"],
    ["invalid JSON", '<script id="__NEXT_DATA__">invalid</script>'],
    ["missing main query", html({ props: { pageProps: { dehydratedState: { queries: [] } } } })],
    ["unexpected empty results", html(state([], 1, 40))],
    ["invalid count", html(state([offer()], 1, -1))],
    ["missing title", html(state([{ ...offer(), jobTitle: "" }]))],
    ["missing offer URL", html(state([{ ...offer(), offers: [{ offerAbsoluteUri: "", displayWorkplace: "Warsaw" }] }]))],
    ["external offer", html(state([{ ...offer(), offers: [{ offerAbsoluteUri: "https://example.test/praca/react,oferta,123", displayWorkplace: "Warsaw" }] }]))],
    ["search link as an offer", html(state([{ ...offer(), offers: [{ offerAbsoluteUri: "https://www.pracuj.pl/praca/react;kw", displayWorkplace: "Warsaw" }] }]))],
  ]) {
    test(`rejects ${name} and closes the browser`, async () => {
      const ctx = context([value]);
      await assert.rejects(ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw"), /Pracuj.pl/);
      assert.equal(ctx.isClosed(), true);
    });
  }

  test("rejects ignored pagination or sorting", async () => {
    const unsorted = state();
    unsorted.props.pageProps.searchCriteria.sc = 1;
    for (const document of [html(state([offer()], 2)), html(state([offer()], 1, 1, 50)), html(unsorted)]) {
      const ctx = context([document]);
      await assert.rejects(ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw"), /pagination|sorting/);
      assert.equal(ctx.isClosed(), true);
    }
  });

  for (const failure of ["http", "timeout", "context", "redirect"] as const) {
    test(`releases the browser after ${failure} failure`, async () => {
      const ctx = context([html(state())]);
      ctx.setFailure(failure);
      await assert.rejects(ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw"));
      assert.equal(ctx.isClosed(), true);
    });
  }

  test("waits for listing data after a Cloudflare 403 without issuing another request", async () => {
    const ctx = context(["<html>Just a moment...</html>"]);
    ctx.setChallenge(1, html(state()));
    const jobs = await ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw");
    assert.equal(jobs.length, 1);
    assert.equal(ctx.visited.length, 1);
    assert.deepEqual(ctx.challengeWaits, [0]);
    assert.equal(ctx.isClosed(), true);
  });

  test("persistent verification rejects the entire scrape and closes the browser", async () => {
    const ctx = context(["<html>Just a moment...</html>"]);
    ctx.setChallenge(1);
    await assert.rejects(ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw"), /page 1 is blocked by Cloudflare/);
    assert.deepEqual(ctx.challengeWaits, [0]);
    assert.equal(ctx.isClosed(), true);
  });

  test("resolved verification still requires valid listing data", async () => {
    const ctx = context(["<html>Just a moment...</html>"]);
    ctx.setChallenge(1, '<script id="__NEXT_DATA__">{}</script>');
    await assert.rejects(ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw"), /invalid results/);
    assert.equal(ctx.isClosed(), true);
  });

  test("rejects an external redirect after verification", async () => {
    const ctx = context(["<html>Just a moment...</html>"]);
    ctx.setChallenge(1, html(state()), "https://example.test/praca");
    await assert.rejects(ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw"), /Expected a Pracuj.pl/);
    assert.equal(ctx.isClosed(), true);
  });

  test("ordinary HTTP errors fail immediately without waiting for verification", async () => {
    const ctx = context(["<html>Forbidden</html>"]);
    ctx.setFailure("http");
    await assert.rejects(ctx.pracujAdapter.scrape("https://www.pracuj.pl/praca/react;kw"), /HTTP 403/);
    assert.deepEqual(ctx.challengeWaits, []);
    assert.equal(ctx.isClosed(), true);
  });

  test("invalid target URLs fail before launching a browser", async () => {
    for (const url of ["https://pracuj.pl.example.test/praca", "file://www.pracuj.pl/praca", "https://user:password@www.pracuj.pl/praca", "https://www.pracuj.pl/konto", "https://www.pracuj.pl/praca/react,oferta,123"]) {
      const ctx = context([]);
      await assert.rejects(ctx.pracujAdapter.scrape(url), /Pracuj.pl/);
      assert.equal(ctx.isLaunched(), false);
    }
  });
});
