import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import { loadSource } from "./helpers.ts";

type JobSourceModule = typeof import("../src/lib/job-source.ts");
type ManualJobModule = typeof import("../src/lib/manual-job.ts");
type JobActionsModule = typeof import("../src/app/actions/job.ts");

const jobSourceLib = loadSource<JobSourceModule>("src/lib/job-source.ts", {});
const manualJobLib = loadSource<ManualJobModule>("src/lib/manual-job.ts", {
  zod: { z },
  "@/lib/job-source": jobSourceLib,
});

describe("Manual Job Entry", () => {
  test("inferJobSourceFromUrl detects known portals and falls back to domain or Manual", () => {
    const { inferJobSourceFromUrl } = jobSourceLib;
    assert.equal(
      inferJobSourceFromUrl("https://www.linkedin.com/jobs/view/12345"),
      "LinkedIn"
    );
    assert.equal(
      inferJobSourceFromUrl("https://bulldogjob.pl/companies/jobs/123"),
      "Bulldogjob"
    );
    assert.equal(
      inferJobSourceFromUrl("https://solid.jobs/offer/123"),
      "Solid.jobs"
    );
    assert.equal(
      inferJobSourceFromUrl("https://www.careers.acme.com/jobs/1"),
      "careers.acme.com"
    );
    assert.equal(inferJobSourceFromUrl("not-a-url"), "Manual");
    assert.equal(inferJobSourceFromUrl("javascript:alert(1)"), "Manual");
  });

  test("normalizeManualJobUrl normalizes scheme, www, tracking params, hash and trailing slash", () => {
    const { normalizeManualJobUrl } = manualJobLib;
    const canonical = "https://linkedin.com/jobs/view/12345?currentJobId=99";

    assert.equal(
      normalizeManualJobUrl(
        "http://www.LinkedIn.com/jobs/view/12345/?utm_source=feed&currentJobId=99&trk=abc#details"
      ),
      canonical
    );
    assert.equal(
      normalizeManualJobUrl("https://linkedin.com/jobs/view/12345?currentJobId=99"),
      canonical
    );
  });

  test("validateManualJobInput validates required fields, normalizes values and deduplicates IDs", () => {
    const { validateManualJobInput } = manualJobLib;

    const badUrl = validateManualJobInput({
      title: "Frontend Dev",
      url: "ftp://example.com/job",
      description: "React & TypeScript",
      categoryIds: [],
      workPreferenceIds: [],
    });
    assert.equal(badUrl.ok, false);

    const emptyDesc = validateManualJobInput({
      title: "Frontend Dev",
      url: "https://linkedin.com/jobs/view/1",
      description: "   ",
      categoryIds: [],
      workPreferenceIds: [],
    });
    assert.equal(emptyDesc.ok, false);

    const valid = validateManualJobInput({
      title: "  Senior Frontend Dev  ",
      url: "http://www.linkedin.com/jobs/view/99/?utm_medium=social",
      company: "   ",
      description: "  Build React apps  ",
      categoryIds: ["cat-1", "cat-1", "cat-2"],
      workPreferenceIds: ["pref-1", "pref-1"],
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.data.title, "Senior Frontend Dev");
      assert.equal(valid.data.url, "https://linkedin.com/jobs/view/99");
      assert.equal(valid.data.source, "LinkedIn");
      assert.equal(valid.data.company, null);
      assert.equal(valid.data.description, "Build React apps");
      assert.deepEqual([...valid.data.categoryIds], ["cat-1", "cat-2"]);
      assert.deepEqual([...valid.data.workPreferenceIds], ["pref-1"]);
    }
  });

  test("addManualJob creates job in INBOX with connected categories/preferences and revalidates /", async () => {
    let createdData: Record<string, unknown> | null = null;
    const revalidated: string[] = [];

    const { addManualJob } = loadSource<JobActionsModule>(
      "src/app/actions/job.ts",
      {
        "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
        "@/lib/auth": { verifyAuth: async () => {} },
        "@/lib/grouped-job-status": {
          updateGroupedJobStatus: async () => ({ success: true, updatedCount: 1 }),
        },
        "@/lib/manual-job": manualJobLib,
        "@/lib/prisma": {
          prisma: {
            job: {
              findUnique: async () => null,
              create: async (args: { data: Record<string, unknown> }) => {
                createdData = args.data;
                return { id: "manual-job-1" };
              },
            },
          },
        },
      }
    );

    const res = await addManualJob({
      title: "Staff React Engineer",
      url: "https://www.linkedin.com/jobs/view/555",
      company: "Acme",
      description: "Full description for AI analysis",
      categoryIds: ["cat-react"],
      workPreferenceIds: ["pref-remote"],
    });

    assert.equal(res.success, true);
    assert.equal(res.jobId, "manual-job-1");
    assert.ok(createdData);
    assert.equal((createdData as Record<string, unknown>).applicationStatus, "INBOX");
    assert.equal((createdData as Record<string, unknown>).appliedAt, null);
    assert.equal((createdData as Record<string, unknown>).source, "LinkedIn");
    assert.equal(
      (createdData as Record<string, unknown>).url,
      "https://linkedin.com/jobs/view/555"
    );
    assert.equal(
      JSON.stringify((createdData as Record<string, unknown>).categories),
      JSON.stringify({ connect: [{ id: "cat-react" }] })
    );
    assert.equal(
      JSON.stringify((createdData as Record<string, unknown>).workPreferences),
      JSON.stringify({ connect: [{ id: "pref-remote" }] })
    );
    assert.deepEqual(revalidated, ["/"]);
  });

  test("addManualJob rejects duplicate URLs cleanly on pre-check", async () => {
    const { addManualJob } = loadSource<JobActionsModule>(
      "src/app/actions/job.ts",
      {
        "next/cache": { revalidatePath: () => {} },
        "@/lib/auth": { verifyAuth: async () => {} },
        "@/lib/grouped-job-status": {
          updateGroupedJobStatus: async () => ({ success: true, updatedCount: 1 }),
        },
        "@/lib/manual-job": manualJobLib,
        "@/lib/prisma": {
          prisma: {
            job: {
              findUnique: async () => ({ id: "existing-1" }),
              create: async () => {
                throw new Error("Should not create duplicate");
              },
            },
          },
        },
      }
    );

    const res = await addManualJob({
      title: "Staff React Engineer",
      url: "https://www.linkedin.com/jobs/view/555",
      description: "Full description",
      categoryIds: [],
      workPreferenceIds: [],
    });

    assert.match(res.error ?? "", /already exists/i);
  });

  test("addManualJob handles P2002 race condition and P2025 missing relation errors", async () => {
    const makeAction = (errorCode: string) =>
      loadSource<JobActionsModule>("src/app/actions/job.ts", {
        "next/cache": { revalidatePath: () => {} },
        "@/lib/auth": { verifyAuth: async () => {} },
        "@/lib/grouped-job-status": {
          updateGroupedJobStatus: async () => ({ success: true, updatedCount: 1 }),
        },
        "@/lib/manual-job": manualJobLib,
        "@/lib/prisma": {
          prisma: {
            job: {
              findUnique: async () => null,
              create: async () => {
                const err = new Error("Prisma error") as Error & { code: string };
                err.code = errorCode;
                throw err;
              },
            },
          },
        },
      }).addManualJob;

    const p2002Res = await makeAction("P2002")({
      title: "Staff React Engineer",
      url: "https://linkedin.com/jobs/view/555",
      description: "Full description",
      categoryIds: [],
      workPreferenceIds: [],
    });
    assert.match(p2002Res.error ?? "", /already exists/i);

    const p2025Res = await makeAction("P2025")({
      title: "Staff React Engineer",
      url: "https://linkedin.com/jobs/view/556",
      description: "Full description",
      categoryIds: ["deleted-cat"],
      workPreferenceIds: [],
    });
    assert.match(p2025Res.error ?? "", /no longer exist/i);
  });
});
