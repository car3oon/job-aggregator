import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

  it("parses intercepted search response correctly", () => {
    const fixture = {
      offersCount: 2,
      offers: [
        {
          id: "01000000-5c5c-423f-f3bd-08df3372ea43",
          title: "Front-End Engineer (React / TypeScript)",
          employer: "Acme Corp Sp. z o.o.",
          offerUrlName: "front-end-engineer-react-warszawa,oferta,01000000-5c5c-423f-f3bd-08df3372ea43",
          aboutProject: ["Building modern fintech applications."],
          workplace: [{ location: "Warszawa", city: "Warszawa" }],
          positionLevels: [{ value: "mid" }],
          technologies: ["React.js", "TypeScript", "Vite"],
          workModes: ["zdalna"],
        },
      ],
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
});
