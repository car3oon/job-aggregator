import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { groupJobs, normalizeCompany, normalizeTitle, areSimilarTitles, type MinimalJob } from "../src/lib/job-grouping.ts";

describe("Job Grouping & Deduplication", () => {
  test("normalizeCompany strips legal forms, accents and whitespace", () => {
    assert.equal(normalizeCompany("Wazdan Services Limited Sp. z o.o."), "wazdan services");
    assert.equal(normalizeCompany("CLOUDFIDE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ"), "cloudfide");
    assert.equal(normalizeCompany("EUVIC S.A."), "euvic");
    assert.equal(normalizeCompany("IT CONNECT Sp. z o.o. Sp. k."), "it connect");
  });

  test("normalizeTitle normalizes terms and diacritics", () => {
    assert.equal(normalizeTitle("Senior Full-Stack Developer"), "senior fullstack developer");
    assert.equal(normalizeTitle("Front-End Developer (Vue.js)"), "frontend developer vuejs");
    assert.equal(normalizeTitle("Node.JS Engineer"), "nodejs engineer");
  });

  test("areSimilarTitles correctly identifies role variants without mixing stacks or domains", () => {
    assert.equal(areSimilarTitles("Frontend Web Developer", "Frontend Developer"), true);
    assert.equal(areSimilarTitles("Frontend Developer (Vue.js)", "Mid/Senior Frontend Developer (Vue.js)"), true);
    assert.equal(areSimilarTitles("Frontend Developer", "Backend Developer"), false);
    assert.equal(areSimilarTitles("React Developer", "Vue Developer"), false);
    assert.equal(areSimilarTitles("Fullstack Developer", "Senior Fullstack Developer"), true);
    assert.equal(areSimilarTitles("Developer", "Senior Frontend Developer"), false);
    assert.equal(areSimilarTitles("Developer", "Frontend Developer"), false);
  });

  test("technology aliases match each other but conflicting normalized stacks remain separate", () => {
    assert.equal(areSimilarTitles("Frontend Developer (Vue.js)", "Frontend Developer (Angular)"), false);
    assert.equal(areSimilarTitles("Senior Node.js Developer", "Senior Python Developer"), false);
    assert.equal(areSimilarTitles("React.js Developer", "Vue.js Developer"), false);
    assert.equal(areSimilarTitles("React Developer", "React.js Developer"), true);
    assert.equal(areSimilarTitles("Node Developer", "Node.js Developer"), true);
    assert.equal(areSimilarTitles("Senior React Node.js Developer", "Senior React Python Developer"), false);
  });

  const makeJob = (id: string, changes: Partial<MinimalJob> = {}): MinimalJob => ({
    id, title: "React Developer", company: "Example Company", source: "NoFluffJobs",
    url: `https://nofluffjobs.com/pl/job/project-${id}`,
    createdAt: new Date("2026-10-22T10:00:00Z"), updatedAt: new Date("2026-10-22T10:00:00Z"),
    workPreferences: [], ...changes,
  });

  test("different offers from one portal remain accessible as separate roles", () => {
    const jobs = [makeJob("one"), makeJob("two")];
    const grouped = groupJobs(jobs);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].sources.length, 1);
    assert.equal(grouped[0].relatedVariants.length, 1);
    assert.equal(grouped[0].url, jobs[0].url);
    assert.equal(grouped[0].relatedVariants[0].url, jobs[1].url);
  });

  test("ambiguous cross-portal titles preserve every offer and its preferences", () => {
    const jobs = [
      makeJob("one", { workPreferences: [{ id: "remote", name: "Remote" }] }),
      makeJob("two", { workPreferences: [{ id: "hybrid", name: "Hybrid, Wrocław" }] }),
      makeJob("three", { source: "JustJoinIT", url: "https://justjoin.it/job-offer/three" }),
    ];
    const grouped = groupJobs(jobs);
    const [primary] = grouped;
    const links = [...primary.sources, ...primary.relatedVariants.flatMap(variant => variant.sources)];
    assert.deepEqual(new Set(links.map(link => link.url)), new Set(jobs.map(job => job.url)));
    assert.deepEqual(primary.workPreferences.map(pref => pref.name), ["Remote"]);
    assert.deepEqual(primary.relatedVariants[0].workPreferences.map(pref => pref.name), ["Hybrid, Wrocław"]);
  });

  test("related roles retain their own tags and all cross-portal links", () => {
    const grouped = groupJobs([
      makeJob("senior", { title: "Senior React Developer", categories: [{ id: "c1", name: "React", slug: "react" }], workPreferences: [{ id: "remote", name: "Remote" }] }),
      makeJob("mid", { title: "Mid React Developer", categories: [{ id: "c2", name: "Frontend", slug: "frontend" }], workPreferences: [{ id: "hybrid", name: "Hybrid, Wrocław" }] }),
      makeJob("mid-other", { title: "Mid React Developer", source: "JustJoinIT", url: "https://justjoin.it/job-offer/mid" }),
    ]);
    assert.equal(grouped.length, 1);
    assert.deepEqual(grouped[0].workPreferences.map(pref => pref.name), ["Remote"]);
    assert.deepEqual(grouped[0].categories.map(cat => cat.name), ["React"]);
    assert.deepEqual(grouped[0].relatedVariants[0].workPreferences.map(pref => pref.name), ["Hybrid, Wrocław"]);
    assert.deepEqual(grouped[0].relatedVariants[0].categories.map(cat => cat.name), ["Frontend"]);
    assert.equal(grouped[0].relatedVariants[0].sources.length, 2);
  });

  test("matching Pracuj.pl and NoFluffJobs titles share source badges regardless of input order", () => {
    const older = makeJob("nfj", { createdAt: new Date("2026-10-20T10:00:00Z") });
    const newer = makeJob("pracuj", { source: "Pracuj.pl", url: "https://www.pracuj.pl/praca/react,oferta,1001234567" });
    const grouped = groupJobs([older, newer]);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].id, newer.id);
    assert.equal(grouped[0].sources.length, 2);
    assert.equal(grouped[0].relatedVariants.length, 0);
  });

  test("groupJobs merges exact duplicates across sources (Level A)", () => {
    const jobs: MinimalJob[] = [
      {
        id: "1",
        title: "React Developer",
        company: "Scalo",
        url: "https://justjoin.it/job-offer/scalo-react-developer",
        source: "JustJoinIT",
        createdAt: new Date("2026-10-21T10:00:00Z"),
        updatedAt: new Date("2026-10-21T10:00:00Z"),
        workPreferences: [{ id: "wp1", name: "Remote" }],
      },
      {
        id: "2",
        title: "React Developer",
        company: "Scalo Sp. z o.o.",
        url: "https://nofluffjobs.com/pl/job/scalo-react-developer",
        source: "NoFluffJobs",
        createdAt: new Date("2026-10-20T10:00:00Z"),
        updatedAt: new Date("2026-10-20T10:00:00Z"),
        workPreferences: [{ id: "wp2", name: "Hybrid" }],
      },
    ];

    const grouped = groupJobs(jobs);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].title, "React Developer");
    assert.equal(grouped[0].sources.length, 2);
    const sourceNames = grouped[0].sources.map(s => s.source);
    assert.ok(sourceNames.includes("JustJoinIT"));
    assert.ok(sourceNames.includes("NoFluffJobs"));
    assert.equal(grouped[0].workPreferences.length, 2);
    assert.equal(grouped[0].relatedVariants.length, 0);
  });

  test("groupJobs groups similar titles in the same company as related variants (Level B)", () => {
    const jobs: MinimalJob[] = [
      {
        id: "1",
        title: "Frontend Developer (Vue.js)",
        company: "EUVIC S.A.",
        url: "https://www.pracuj.pl/praca/frontend-developer-vue-js,oferta,1001",
        source: "Pracuj.pl",
        createdAt: new Date("2026-10-22T10:00:00Z"),
        updatedAt: new Date("2026-10-22T10:00:00Z"),
        workPreferences: [{ id: "wp1", name: "Remote" }],
      },
      {
        id: "2",
        title: "Mid/Senior Frontend Developer (Vue.js)",
        company: "Euvic",
        url: "https://nofluffjobs.com/pl/job/mid-senior-frontend-developer-vue-js-euvic",
        source: "NoFluffJobs",
        createdAt: new Date("2026-10-21T10:00:00Z"),
        updatedAt: new Date("2026-10-21T10:00:00Z"),
        workPreferences: [{ id: "wp1", name: "Remote" }],
      },
    ];

    const grouped = groupJobs(jobs);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].title, "Frontend Developer (Vue.js)");
    assert.equal(grouped[0].relatedVariants.length, 1);
    assert.equal(grouped[0].relatedVariants[0].title, "Mid/Senior Frontend Developer (Vue.js)");
  });

  test("groupJobs merges Pracuj.pl offers with the same offer ID even if slug/title changed", () => {
    const jobs: MinimalJob[] = [
      {
        id: "1",
        title: "Frontend Web Developer",
        company: "Wazdan",
        url: "https://www.pracuj.pl/praca/frontend-web-developer,oferta,1005165360",
        source: "Pracuj.pl",
        createdAt: new Date("2026-10-21T11:51:00Z"),
        updatedAt: new Date("2026-10-21T11:51:00Z"),
      },
      {
        id: "2",
        title: "Frontend Developer",
        company: "Wazdan",
        url: "https://www.pracuj.pl/praca/frontend-developer,oferta,1005165360",
        source: "Pracuj.pl",
        createdAt: new Date("2026-10-19T08:37:00Z"),
        updatedAt: new Date("2026-10-19T08:37:00Z"),
      },
    ];

    const grouped = groupJobs(jobs);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].title, "Frontend Web Developer");
    assert.equal(grouped[0].url, "https://www.pracuj.pl/praca/frontend-web-developer,oferta,1005165360");
  });

  test("groupJobs merges Theprotocol.it offers with the same UUID even if slug changed", () => {
    const jobs: MinimalJob[] = [
      {
        id: "tp-new",
        title: "Frontend Engineer (React)",
        company: "Upvanta",
        url: "https://theprotocol.it/szczegoly/oferta/front-end-engineer-react-warszawa,oferta,01000000-5c5c-423f-f3bd-08df3372ea43",
        source: "Theprotocol.it",
        createdAt: new Date("2026-10-26T15:00:00Z"),
        updatedAt: new Date("2026-10-26T15:00:00Z"),
      },
      {
        id: "tp-old",
        title: "Frontend Engineer",
        company: "Upvanta",
        url: "https://theprotocol.it/szczegoly/oferta/front-end-engineer-zdalnie,oferta,01000000-5c5c-423f-f3bd-08df3372ea43",
        source: "Theprotocol.it",
        createdAt: new Date("2026-10-25T10:00:00Z"),
        updatedAt: new Date("2026-10-25T10:00:00Z"),
      },
    ];

    const grouped = groupJobs(jobs);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].id, "tp-new");
    assert.equal(grouped[0].title, "Frontend Engineer (React)");
    assert.equal(grouped[0].url, "https://theprotocol.it/szczegoly/oferta/front-end-engineer-react-warszawa,oferta,01000000-5c5c-423f-f3bd-08df3372ea43");
  });

  test("groupJobs merges cross-portal offers between Theprotocol.it, Pracuj.pl and NoFluffJobs", () => {
    const jobs: MinimalJob[] = [
      {
        id: "tp-1",
        title: "Front-End Engineer (React / TypeScript)",
        company: "UPVANTA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
        url: "https://theprotocol.it/szczegoly/oferta/front-end-engineer,oferta,01000000-5c5c-423f-f3bd-08df3372ea43",
        source: "Theprotocol.it",
        createdAt: new Date("2026-10-26T14:00:00Z"),
        updatedAt: new Date("2026-10-26T14:00:00Z"),
        workPreferences: [{ id: "wp-remote", name: "Remote" }],
      },
      {
        id: "pracuj-1",
        title: "Front-End Engineer (React / TypeScript)",
        company: "Upvanta Sp. z o.o.",
        url: "https://www.pracuj.pl/praca/front-end-engineer,oferta,1009988776",
        source: "Pracuj.pl",
        createdAt: new Date("2026-10-26T13:00:00Z"),
        updatedAt: new Date("2026-10-26T13:00:00Z"),
        workPreferences: [{ id: "wp-warszawa", name: "Warszawa" }],
      },
    ];

    const grouped = groupJobs(jobs);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].sources.length, 2);
    const sourceNames = grouped[0].sources.map(s => s.source);
    assert.ok(sourceNames.includes("Theprotocol.it"));
    assert.ok(sourceNames.includes("Pracuj.pl"));
    assert.equal(grouped[0].workPreferences.length, 2);
  });
});
