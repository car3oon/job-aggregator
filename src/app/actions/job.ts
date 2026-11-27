"use server";

import { revalidatePath } from "next/cache";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateGroupedJobStatus as updateGroupedJobStatusInDatabase } from "@/lib/grouped-job-status";
import type { JobApplicationStatus } from "@/lib/job-grouping";
import { validateManualJobInput, type ManualJobInput } from "@/lib/manual-job";

export type ApplicationStatus = JobApplicationStatus;

async function applyGroupedJobStatus(
  jobId: string,
  status: ApplicationStatus
) {
  await verifyAuth();

  if (!jobId || !["INBOX", "SAVED", "APPLIED", "REJECTED"].includes(status)) {
    return { error: "Invalid parameters." };
  }

  try {
    const result = await updateGroupedJobStatusInDatabase(jobId, status);
    if (!result.success) {
      return { error: result.message ?? "Failed to update job application status." };
    }

    revalidatePath("/");
    return { success: true, updatedCount: result.updatedCount };
  } catch {
    return { error: "Failed to update job application status." };
  }
}

export async function updateGroupedJobStatus(
  jobId: string,
  status: ApplicationStatus
) {
  return applyGroupedJobStatus(jobId, status);
}

export async function updateJobApplicationStatus(
  jobId: string,
  status: ApplicationStatus
) {
  return applyGroupedJobStatus(jobId, status);
}

export async function addManualJob(input: ManualJobInput) {
  await verifyAuth();

  const validation = validateManualJobInput(input);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const { title, url, source, company, description, categoryIds, workPreferenceIds } =
    validation.data;

  try {
    const existing = await prisma.job.findUnique({
      where: { url },
      select: { id: true },
    });

    if (existing) {
      return { error: "A job offer with this URL already exists." };
    }

    const created = await prisma.job.create({
      data: {
        title,
        url,
        source,
        company,
        description,
        applicationStatus: "INBOX",
        appliedAt: null,
        categories:
          categoryIds.length > 0
            ? { connect: categoryIds.map((id) => ({ id })) }
            : undefined,
        workPreferences:
          workPreferenceIds.length > 0
            ? { connect: workPreferenceIds.map((id) => ({ id })) }
            : undefined,
      },
      select: { id: true },
    });

    revalidatePath("/");
    return { success: true, jobId: created.id };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : undefined;

    if (code === "P2002") {
      return { error: "A job offer with this URL already exists." };
    }
    if (code === "P2025") {
      return {
        error:
          "One or more selected categories or work preferences no longer exist. Please refresh and try again.",
      };
    }

    console.error("Failed to save manual job offer:", error);
    return { error: "Failed to save job offer." };
  }
}
