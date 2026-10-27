import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { loadSource } from "../helpers.ts";

type TheProtocolModule = typeof import("../../src/scripts/scraper/adapters/theprotocol");

describe("Theprotocol.it adapter", () => {
  const { validateTheProtocolUrl, parseTheProtocolOffersResponse } =
    loadSource<TheProtocolModule>("src/scripts/scraper/adapters/theprotocol.ts", {
      playwright: { chromium: {} },
    });

  it("validates valid and rejects invalid URLs", () => {
    assert.equal(
      validateTheProtocolUrl("https://theprotocol.it/filtry/frontend;sp").hostname,
      "theprotocol.it"
    );
    assert.equal(
      validateTheProtocolUrl("https://www.theprotocol.it/filtry/backend;sp").hostname,
      "www.theprotocol.it"
    );

    assert.throws(() => validateTheProtocolUrl("http://evil-theprotocol.it"), /Expected a theprotocol.it/);
    assert.throws(() => validateTheProtocolUrl("https://theprotocol.it:8080/"), /Expected a theprotocol.it/);
  });

  const offerFixture = {
    id: "01000000-5c5c-423f-f3bd-08df3372ea43",
    title: "Front-End Engineer (React / TypeScript)",
    employer: "Acme Corp Sp. z o.o.",
    offerUrlName: "front-end-engineer-react-warszawa,oferta,01000000-5c5c-423f-f3bd-08df3372ea43",
    aboutProject: ["Building modern fintech applications."],
    workplace: [{ location: "Warszawa", city: "Warszawa" }],
    positionLevels: [{ value: "mid" }],
    technologies: ["React.js", "TypeScript", "Vite"],
    workModes: ["zdalna"],
  };

  it("parses intercepted search response correctly", () => {
    const fixture = {
      offersCount: 2,
      offers: [offerFixture],
    };

    const jobs = parseTheProtocolOffersResponse(fixture);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, "Front-End Engineer (React / TypeScript)");
    assert.equal(jobs[0].company, "Acme Corp Sp. z o.o.");
    assert.equal(
      jobs[0].url,
      "https://theprotocol.it/szczegoly/oferta/front-end-engineer-react-warszawa,oferta,01000000-5c5c-423f-f3bd-08df3372ea43"
    );
    assert.equal(jobs[0].source, "Theprotocol.it");
    assert.ok(jobs[0].rawContent.includes("React.js"));
    assert.ok(jobs[0].rawContent.includes("TypeScript"));
    assert.ok(jobs[0].rawContent.includes("zdalna"));
    assert.ok(jobs[0].rawContent.includes("Building modern fintech applications."));
  });

  it("handles empty or malformed offers gracefully", () => {
    assert.equal(parseTheProtocolOffersResponse({}).length, 0);
    assert.equal(parseTheProtocolOffersResponse({ offers: [] }).length, 0);
    assert.equal(
      parseTheProtocolOffersResponse({
        offers: [{ title: "" }, { offerUrlName: "" }],
      }).length,
      0
    );
  });

  function createScrapeContext(options: {
    isChallenge?: boolean;
    challengeTimeout?: boolean;
    httpStatus?: number;
    offersResponse?: unknown;
    stateShell?: boolean;
    hydrationAfterPolls?: number;
    apiResponse?: unknown;
    apiBodyAfterPolls?: number;
    navigationError?: boolean;
    domLinks?: Array<{ href: string; title: string; textContent: string }>;
    env?: Record<string, string>;
  }) {
    let closed = false;
    let newPageLocale: string | undefined;
    let challengeWaitCalled = false;
    let newContextCalled = false;

    let polls = 0;
    let elapsed = 0;
    let responseListener: ((response: unknown) => Promise<void>) | undefined;
    let releaseBody: (() => void) | undefined;
    let responseTask: Promise<void> | undefined;
    let navigationErrors = 0;
    const hydrated = () =>
      !(options.isChallenge && options.challengeTimeout) &&
      polls >= (options.hydrationAfterPolls ?? (options.isChallenge ? 1 : 0));

    const document = {
      getElementById: (id: string) => {
        assert.equal(id, "__NEXT_DATA__");
        if (!hydrated()) return options.stateShell ? { textContent: '{"props":{"pageProps":{}}}' } : null;
        return options.offersResponse !== undefined
          ? { textContent: JSON.stringify({ props: { pageProps: { offersResponse: options.offersResponse } } }) }
          : options.stateShell ? { textContent: '{"props":{"pageProps":{}}}' } : null;
      },
      querySelectorAll: (selector: string) => {
        assert.equal(selector, 'a[href*=",oferta,"]');
        return hydrated() ? (options.domLinks ?? []).map(link => ({
          href: link.href,
          textContent: link.title,
          closest: () => ({ textContent: link.textContent }),
          querySelector: () => ({ textContent: link.title }),
        })) : [];
      },
    };

    const mockPage = {
      on: (event: string, listener: (response: unknown) => Promise<void>) => {
        assert.equal(event, "response");
        responseListener = listener;
      },
      url: () => "https://theprotocol.it/filtry/frontend;sp",
      goto: async () => {
        if (options.apiResponse !== undefined) {
          responseTask = responseListener?.({
            url: () => "https://theprotocol.it/offers/_search/rangeBox",
            status: () => 200,
            json: async () => {
              if ((options.apiBodyAfterPolls ?? 0) > 0) {
                await new Promise<void>(resolve => { releaseBody = resolve; });
              }
              return options.apiResponse;
            },
          });
        }
        return {
          ok: () => options.httpStatus !== undefined
            ? options.httpStatus >= 200 && options.httpStatus < 300 : !options.isChallenge,
          status: () => options.httpStatus ?? (options.isChallenge ? 403 : 200),
          headers: () => options.isChallenge ? { "cf-mitigated": "challenge" } : {},
        };
      },
      evaluate: async (fn: () => unknown) => {
        if (options.navigationError && navigationErrors < 2) {
          navigationErrors += 1;
          throw new Error("Execution context was destroyed, most likely because of a navigation.");
        }
        // Run the actual extraction function against the current simulated document.
        return vm.runInNewContext(`(${fn.toString()})()`, { document, URL });
      },
    };

    const adapterModule = loadSource<TheProtocolModule>(
      "src/scripts/scraper/adapters/theprotocol.ts",
      {
        playwright: {
          chromium: {
            launch: async () => ({
              newContext: async () => {
                newContextCalled = true;
                throw new Error("browser.newContext should not be called");
              },
              newPage: async (pageOpts?: { locale?: string }) => {
                newPageLocale = pageOpts?.locale;
                return mockPage;
              },
              close: async () => {
                closed = true;
              },
            }),
          },
        },
      },
      {
        process: { env: options.env ?? {} },
        globals: {
          Date: class extends Date { static now() { return elapsed; } },
          setTimeout: (callback: () => void, delay: number) => {
            void Promise.resolve().then(async () => {
              polls += 1;
              elapsed += delay;
              if (options.isChallenge) challengeWaitCalled = true;
              if (releaseBody && polls >= (options.apiBodyAfterPolls ?? 0)) {
                releaseBody();
                await responseTask;
              }
              callback();
            });
          },
        },
      }
    );

    return {
      adapter: adapterModule.theProtocolAdapter,
      getPolls: () => polls,
      isClosed: () => closed,
      getLocale: () => newPageLocale,
      isChallengeWaitCalled: () => challengeWaitCalled,
      isNewContextCalled: () => newContextCalled,
    };
  }

  it("creates page directly on browser with pl-PL locale and extracts offers via __NEXT_DATA__", async () => {
    const ctx = createScrapeContext({
      offersResponse: { offers: [offerFixture] },
    });

    const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, "Front-End Engineer (React / TypeScript)");
    assert.equal(ctx.getLocale(), "pl-PL");
    assert.equal(ctx.isNewContextCalled(), false);
    assert.equal(ctx.isClosed(), true);
  });

  it("waits for Cloudflare challenge resolution and returns offers", async () => {
    const ctx = createScrapeContext({
      isChallenge: true,
      offersResponse: { offers: [offerFixture] },
    });

    const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
    assert.equal(jobs.length, 1);
    assert.equal(ctx.isChallengeWaitCalled(), true);
    assert.equal(ctx.isClosed(), true);
  });

  it("rejects when Cloudflare challenge does not resolve within timeout", async () => {
    const ctx = createScrapeContext({
      isChallenge: true,
      challengeTimeout: true,
      stateShell: true,
    });

    await assert.rejects(
      () => ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp"),
      /blocked by Cloudflare/
    );
    assert.equal(ctx.isClosed(), true);
  });

  it("rejects immediately on ordinary HTTP error", async () => {
    const ctx = createScrapeContext({
      httpStatus: 500,
    });

    await assert.rejects(
      () => ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp"),
      /HTTP 500/
    );
    assert.equal(ctx.isClosed(), true);
  });

  it("extracts offers via DOM fallback if __NEXT_DATA__ is unavailable", async () => {
    const ctx = createScrapeContext({
      domLinks: [
        {
          title: "Frontend Dev",
          href: "https://theprotocol.it/szczegoly/oferta/frontend-dev,oferta,123",
          textContent: "Frontend Dev React TypeScript",
        },
      ],
    });

    const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, "Frontend Dev");
    assert.equal(ctx.isClosed(), true);
  });

  it("handles empty listing from __NEXT_DATA__ gracefully", async () => {
    const ctx = createScrapeContext({
      offersResponse: { offers: [] },
    });

    const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
    assert.equal(jobs.length, 0);
    assert.equal(ctx.isClosed(), true);
  });
  for (const isChallenge of [false, true]) {
    it(`waits through a state shell for hydrated cards (challenge: ${isChallenge})`, async () => {
      const ctx = createScrapeContext({
        isChallenge,
        stateShell: true,
        hydrationAfterPolls: 3,
        domLinks: [{ title: "Hydrated offer", href: "https://theprotocol.it/hydrated,oferta,123", textContent: "React" }],
      });
      const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
      assert.equal(jobs[0].title, "Hydrated offer");
      assert.equal(ctx.getPolls(), 3);
      assert.equal(ctx.isClosed(), true);
    });

    it(`waits for usable hydrated state (challenge: ${isChallenge})`, async () => {
      const ctx = createScrapeContext({
        isChallenge,
        stateShell: true,
        hydrationAfterPolls: 3,
        offersResponse: { offers: [offerFixture] },
      });
      const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
      assert.equal(jobs[0].company, offerFixture.employer);
      assert.equal(ctx.getPolls(), 3);
      assert.equal(ctx.isClosed(), true);
    });

    it(`waits for a delayed API body without cards (challenge: ${isChallenge})`, async () => {
      const ctx = createScrapeContext({
        isChallenge,
        stateShell: true,
        apiResponse: { offers: [offerFixture] },
        apiBodyAfterPolls: 3,
      });
      const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
      assert.equal(jobs[0].company, offerFixture.employer);
      assert.equal(ctx.getPolls(), 3);
      assert.equal(ctx.isClosed(), true);
    });
  }

  it("falls back to valid DOM cards when nonempty state contains no valid offers", async () => {
    const ctx = createScrapeContext({
      offersResponse: { offers: [{ title: "Missing slug" }] },
      domLinks: [{ title: "Valid DOM offer", href: "https://theprotocol.it/valid,oferta,123", textContent: "React" }],
    });
    const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
    assert.equal(jobs[0].title, "Valid DOM offer");
    assert.equal(ctx.isClosed(), true);
  });

  it("rejects malformed nonempty state without a fallback instead of returning empty success", async () => {
    const ctx = createScrapeContext({ offersResponse: { offers: [{ title: "Missing slug" }] } });
    await assert.rejects(() => ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp"), /could not be extracted/);
    assert.equal(ctx.getPolls(), 250);
    assert.equal(ctx.isClosed(), true);
  });

  it("accepts an explicitly empty API response without waiting for cards", async () => {
    const ctx = createScrapeContext({ stateShell: true, apiResponse: { offers: [] }, apiBodyAfterPolls: 2 });
    const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
    assert.equal(jobs.length, 0);
    assert.equal(ctx.getPolls(), 2);
    assert.equal(ctx.isClosed(), true);
  });

  it("retries extraction after the execution context changes during challenge navigation", async () => {
    const ctx = createScrapeContext({ isChallenge: true, navigationError: true, offersResponse: { offers: [offerFixture] } });
    const jobs = await ctx.adapter.scrape("https://theprotocol.it/filtry/frontend;sp");
    assert.equal(jobs.length, 1);
    assert.equal(ctx.isClosed(), true);
  });

});
