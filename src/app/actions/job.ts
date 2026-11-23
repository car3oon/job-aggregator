"use server";

import { revalidatePath } from "next/cache";
import { verifyAuth } from "@/lib/auth";
import { updateGroupedJobStatus as updateGroupedJobStatusInDatabase } from "@/lib/grouped-job-status";
import type { JobApplicationStatus } from "@/lib/job-grouping";

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
