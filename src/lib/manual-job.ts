import { z } from "zod";
import { inferJobSourceFromUrl, MANUAL_JOB_LIMITS } from "@/lib/job-source";

const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "trk",
  "refid",
  "trackingid",
  "lipi",
  "lici",
]);

/**
 * Normalizes a manually entered job URL so trivial variants (tracking params,
 * trailing slash, www prefix, http vs https, hash fragments) map to one key.
 */
export function normalizeManualJobUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  parsed.hostname = host;

  if (parsed.protocol === "http:" && host !== "localhost" && !host.startsWith("127.")) {
    parsed.protocol = "https:";
  }

  parsed.hash = "";

  for (const key of Array.from(parsed.searchParams.keys())) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || TRACKING_QUERY_PARAMS.has(lower)) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  }

  return parsed.toString();
}

export const ManualJobInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Job title is required.")
    .max(
      MANUAL_JOB_LIMITS.title,
      `Job title must be at most ${MANUAL_JOB_LIMITS.title} characters.`
    ),
  url: z
    .string()
    .trim()
    .min(1, "Job URL is required.")
    .max(MANUAL_JOB_LIMITS.url, "Job URL is too long.")
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Please enter a valid http:// or https:// URL."),
  source: z
    .string()
    .trim()
    .max(
      MANUAL_JOB_LIMITS.source,
      `Source name must be at most ${MANUAL_JOB_LIMITS.source} characters.`
    )
    .optional(),
  company: z
    .string()
    .trim()
    .max(
      MANUAL_JOB_LIMITS.company,
      `Company name must be at most ${MANUAL_JOB_LIMITS.company} characters.`
    )
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, "Job description is required.")
    .max(MANUAL_JOB_LIMITS.description, "Job description is too long."),
  categoryIds: z.array(z.string().min(1)).default([]),
  workPreferenceIds: z.array(z.string().min(1)).default([]),
});

export type ManualJobInput = z.input<typeof ManualJobInputSchema>;

export interface NormalizedManualJobInput {
  title: string;
  url: string;
  source: string;
  company: string | null;
  description: string;
  categoryIds: string[];
  workPreferenceIds: string[];
}

export function validateManualJobInput(
  input: ManualJobInput
):
  | { ok: true; data: NormalizedManualJobInput }
  | { ok: false; error: string } {
  const parsed = ManualJobInputSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      error: firstIssue?.message ?? "Invalid job offer details.",
    };
  }

  const { title, url, source, company, description, categoryIds, workPreferenceIds } =
    parsed.data;

  const normalizedUrl = normalizeManualJobUrl(url);
  const resolvedSource =
    source && source.length > 0 ? source : inferJobSourceFromUrl(normalizedUrl);

  return {
    ok: true,
    data: {
      title,
      url: normalizedUrl,
      source: resolvedSource,
      company: company && company.length > 0 ? company : null,
      description,
      categoryIds: Array.from(new Set(categoryIds)),
      workPreferenceIds: Array.from(new Set(workPreferenceIds)),
    },
  };
}
