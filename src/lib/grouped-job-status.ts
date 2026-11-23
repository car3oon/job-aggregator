import { prisma } from "@/lib/prisma";
import {
  resolveGroupMemberIds,
  type JobApplicationStatus,
} from "@/lib/job-grouping";

export type GroupedJobStatusResult =
  | { success: false; message: string }
  | {
      success: true;
      updatedCount: number;
      title: string;
      company: string | null;
      applicationStatus: JobApplicationStatus;
      appliedAt: Date | null;
    };

export async function updateGroupedJobStatus(
  jobId: string,
  status: JobApplicationStatus
): Promise<GroupedJobStatusResult> {
  if (!jobId) {
    return { success: false, message: "Missing job ID." };
  }

  const validStatuses: JobApplicationStatus[] = [
    "INBOX",
    "SAVED",
    "APPLIED",
    "REJECTED",
  ];
  if (!validStatuses.includes(status)) {
    return { success: false, message: "Invalid application status." };
  }

  const appliedAt = status === "APPLIED" ? new Date() : null;

  return prisma.$transaction(async (transaction): Promise<GroupedJobStatusResult> => {
    if (typeof transaction.job.findUnique === "function") {
      const target = await transaction.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          title: true,
          company: true,
          source: true,
          url: true,
          createdAt: true,
          expiredAt: true,
        },
      });

      if (!target || target.expiredAt !== null) {
        return {
          success: false as const,
          message: "The active job offer could not be found.",
        };
      }

      // Offers without a company are never grouped with other portal listings
      if (!target.company) {
        const updated = await transaction.job.updateMany({
          where: { id: target.id, expiredAt: null },
          data: { applicationStatus: status, appliedAt },
        });

        if (updated.count === 0) {
          return {
            success: false as const,
            message: "No active job offers were updated.",
          };
        }

        return {
          success: true as const,
          updatedCount: updated.count,
          title: target.title,
          company: target.company,
          applicationStatus: status,
          appliedAt,
        };
      }
    }

    const activeJobs = await transaction.job.findMany({
      where: { expiredAt: null },
      select: {
        id: true,
        title: true,
        company: true,
        source: true,
        url: true,
        createdAt: true,
        applicationStatus: true,
        appliedAt: true,
      },
    });
    const target = activeJobs.find((job) => job.id === jobId);

    if (!target) {
      return {
        success: false as const,
        message: "The active job offer could not be found.",
      };
    }

    const memberIds = resolveGroupMemberIds(activeJobs, target);
    const updated = await transaction.job.updateMany({
      where: { id: { in: memberIds }, expiredAt: null },
      data: { applicationStatus: status, appliedAt },
    });

    if (updated.count === 0) {
      return {
        success: false as const,
        message: "No active job offers were updated.",
      };
    }

    return {
      success: true as const,
      updatedCount: updated.count,
      title: target.title,
      company: target.company,
      applicationStatus: status,
      appliedAt,
    };
  });
}
