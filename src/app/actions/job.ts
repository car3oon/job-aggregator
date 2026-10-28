"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyAuth } from "@/lib/auth";

export type ApplicationStatus = "INBOX" | "APPLIED" | "REJECTED";

export async function updateJobApplicationStatus(
  jobId: string,
  status: ApplicationStatus
) {
  await verifyAuth();

  if (!jobId || !["INBOX", "APPLIED", "REJECTED"].includes(status)) {
    return { error: "Invalid parameters." };
  }

  try {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        applicationStatus: status,
        appliedAt: status === "APPLIED" ? new Date() : null,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Failed to update job application status." };
  }
}
