import assert from "node:assert/strict";
import { test } from "node:test";
import * as jobGrouping from "../src/lib/job-grouping.ts";
import { loadSource } from "./helpers.ts";

type Status = "INBOX" | "SAVED" | "APPLIED" | "REJECTED";

test("updates every active exact-group row atomically with a shared appliedAt", async () => {
  const activeJobs = [
    {
      id: "justjoin",
      title: "Senior Frontend Engineer",
      company: "Acme",
      source: "JustJoinIT",
      url: "https://justjoin.it/job-offer/acme-frontend",
      createdAt: new Date("2026-11-18T12:00:00Z"),
      applicationStatus: "INBOX" as Status,
      appliedAt: null,
    },
    {
      id: "nofluff",
      title: "Senior Frontend Engineer",
      company: "Acme LLC",
      source: "NoFluffJobs",
      url: "https://nofluffjobs.com/pl/job/acme-frontend",
      createdAt: new Date("2026-11-18T11:00:00Z"),
      applicationStatus: "SAVED" as Status,
      appliedAt: null,
    },
    {
      id: "related",
      title: "Senior Backend Engineer",
      company: "Acme",
      source: "Pracuj.pl",
      url: "https://www.pracuj.pl/praca/acme-backend,oferta,1234567",
      createdAt: new Date("2026-11-18T10:00:00Z"),
      applicationStatus: "INBOX" as Status,
      appliedAt: null,
    },
  ];
  const calls: Array<{
    ids: string[];
    data: { applicationStatus: Status; appliedAt: Date | null };
  }> = [];
  let transactionCount = 0;
  const transaction = {
    job: {
      findMany: async ({ where }: { where: { expiredAt: null } }) => {
        assert.equal(JSON.stringify(where), JSON.stringify({ expiredAt: null }));
        return activeJobs;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: { in: string[] }; expiredAt: null };
        data: { applicationStatus: Status; appliedAt: Date | null };
      }) => {
        assert.deepEqual(where.expiredAt, null);
        calls.push({ ids: where.id.in, data });
        return { count: where.id.in.length };
      },
    },
  };
  const { updateGroupedJobStatus } = loadSource<
    typeof import("../src/lib/grouped-job-status.ts")
  >(
    "src/lib/grouped-job-status.ts",
    {
      "@/lib/prisma": {
        prisma: {
          $transaction: async <T>(
            callback: (client: typeof transaction) => Promise<T>
          ) => {
            transactionCount++;
            return callback(transaction);
          },
        },
      },
      "@/lib/job-grouping": jobGrouping,
    }
  );

  for (const status of ["REJECTED", "APPLIED", "SAVED", "INBOX"] as const) {
    const result = await updateGroupedJobStatus("justjoin", status);
    assert.equal(result.success, true);
    assert.equal(result.updatedCount, 2);
  }

  assert.equal(transactionCount, 4);
  assert.deepEqual(calls.map(call => call.ids), [
    ["justjoin", "nofluff"],
    ["justjoin", "nofluff"],
    ["justjoin", "nofluff"],
    ["justjoin", "nofluff"],
  ]);
  assert.deepEqual(
    calls.map(call => call.data.applicationStatus),
    ["REJECTED", "APPLIED", "SAVED", "INBOX"]
  );
  assert.ok(calls[1].data.appliedAt instanceof Date);
  assert.equal(calls[0].data.appliedAt, null);
  assert.equal(calls[2].data.appliedAt, null);
  assert.equal(calls[3].data.appliedAt, null);
});
