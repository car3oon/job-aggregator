import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";

type Scenario = [mode: string, exitCode: number, status?: "SUCCESS" | "PARTIAL" | "FAILED", jobsAdded?: number];
type ScraperEvent = {
  disconnected?: boolean;
  browserClosed?: boolean;
  deleted?: boolean;
  url?: string;
  cleanup?: boolean;
  availabilityRead?: string;
  availabilityChanged?: string;
  expired?: boolean;
  adapter?: string;
  saved?: boolean;
  source?: string;
  history?: { status: Scenario[2]; jobsAdded: number; logs: string };
};

const cases: Scenario[] = [
  ["success", 0, "SUCCESS", 1],
  ["nofluff-success", 0, "SUCCESS", 1],
  ["nofluff-availability", 0, "SUCCESS", 1],
  ["nofluff-status-error", 0, "SUCCESS", 1],
  ["nofluff-source-failure", 1, "FAILED", 0],
  ["pracuj-success", 0, "SUCCESS", 1],
  ["pracuj-id-prefix-collision", 0, "SUCCESS", 0],
  ["pracuj-lookalike-domain", 0, "SUCCESS", 0],
  ["lookalike-domain", 0, "SUCCESS", 0],
  ["empty", 0, "SUCCESS", 0],
  ["no-targets", 0, "SUCCESS"],
  ["source-failure", 1, "FAILED", 0],
  ["write-failure", 1, "FAILED", 0],
  ["partial", 1, "PARTIAL", 1],
  ["nonmatching-existing", 0, "SUCCESS", 0],
  ["timeout", 1, "FAILED", 0],
  ["http-error", 1, "FAILED", 0],
  ["context-failure", 1, "FAILED", 0],
  ["initial-history-failure", 1],
  ["fatal-lookup", 1, "FAILED"],
  ["history-update-failure", 1],
  ["disconnect-failure", 1, "SUCCESS", 1],
];

describe("Scraper runner", () => {
  for (const [mode, code, status, added] of cases) {
    test(`scraper ${mode}: reports status, exits correctly and releases resources`, () => {
      const child = spawnSync(process.execPath, [fileURLToPath(new URL("../fixtures/scraper.ts", import.meta.url)), mode], {
        encoding: "utf8", timeout: 15_000,
      });
      assert.ifError(child.error);
      assert.equal(child.status, code, child.stderr);
      const events: ScraperEvent[] = child.stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
      assert.equal(events.at(-1)?.disconnected, true);
      assert.equal(events.some(event => event.cleanup), false, "Limited listings and source failures must not trigger age-based deletion");
      const availabilityChanges = events.filter(event => event.availabilityChanged);
      if (mode === "nofluff-availability") {
        assert.deepEqual(availabilityChanges, [{ availabilityChanged: "expired", expired: true }]);
        assert.equal(events.find(event => event.availabilityRead)?.availabilityRead, "NoFluffJobs");
      } else {
        assert.equal(availabilityChanges.length, 0);
      }
      if (mode === "nofluff-source-failure") assert.equal(events.some(event => event.availabilityRead), false);
      const history = events.filter((event) => event.history).at(-1)?.history;
      assert.equal(history?.status, status);
      if (added !== undefined) {
        assert.ok(history);
        assert.equal(history.jobsAdded, added);
      }
      if (["timeout", "http-error", "context-failure"].includes(mode)) {
        assert.equal(events.some((event) => event.browserClosed), true);
      }
      if (mode === "nonmatching-existing") {
        assert.equal(events.some((event) => event.deleted), true);
        assert.match(history!.logs, /Category filters: 0 matched, 1 rejected/);
      }
      if (mode === "pracuj-id-prefix-collision") {
        assert.equal(events.find(event => event.deleted)?.url, "https://www.pracuj.pl/praca/old-slug,oferta,1001234567");
      }
      if (mode === "success") {
        assert.match(history!.logs, /Category filters: 1 matched, 0 rejected/);
      }
      if (mode === "nofluff-success") {
        assert.equal(events.some(event => event.adapter === "NoFluffJobs"), true);
        assert.equal(events.find(event => event.saved)?.source, "NoFluffJobs");
        assert.equal(events.find(event => event.saved)?.url, "https://nofluffjobs.com/pl/job/react-developer");
      }
      if (mode === "nofluff-status-error") assert.match(history!.logs, /retained 2 with unknown status/);
      if (mode === "pracuj-success") {
        assert.equal(events.some(event => event.adapter === "Pracuj.pl"), true);
        assert.equal(events.find(event => event.saved)?.source, "Pracuj.pl");
        assert.equal(events.find(event => event.saved)?.url, "https://www.pracuj.pl/praca/react-developer,oferta,1001234567");
      }
      if (["lookalike-domain", "pracuj-lookalike-domain"].includes(mode)) {
        assert.equal(events.some(event => event.adapter || event.saved), false);
      }
    });
  }
});
