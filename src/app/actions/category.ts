"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyAuth } from "@/lib/auth";
import { matchesCategory } from "@/scripts/scraper/engine";

export async function addCategory(name: string, keywordsStr: string = "", excludedStr: string = "") {
  await verifyAuth();
  if (!name.trim()) return { error: "Name is required." };

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const keywords = keywordsStr.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
  const excluded = excludedStr.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

  try {
    await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        keywords,
        excluded
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { error: "This category already exists or an error occurred." };
  }
}

export async function deleteCategory(id: string) {
  await verifyAuth();
  try {
    await prisma.category.delete({
      where: { id },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Failed to delete category." };
  }
}

export async function updateCategory(id: string, name: string, keywordsStr: string = "", excludedStr: string = "") {
  await verifyAuth();
  if (!name.trim()) return { error: "Name is required." };
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  // Notice we preserve the '+' here if user inputs it, just lowercase it
  const keywords = keywordsStr.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
  const excluded = excludedStr.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

  try {
    await prisma.$transaction(async tx => {
      // Recheck every saved offer, including those outside the scraper's page limit.
      const jobs = await tx.job.findMany({
        select: { id: true, title: true, description: true },
      });
      const matchingJobs = jobs.filter(job =>
        matchesCategory(`${job.title} ${job.description ?? ""}`, { keywords, excluded })
      );
      await tx.category.update({
        where: { id },
        data: {
          name: name.trim(),
          slug,
          keywords,
          excluded,
          // Replace only this category's links; retain jobs and other categories.
          jobs: { set: matchingJobs.map(job => ({ id: job.id })) },
        },
      });
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Failed to update category. Name might conflict." };
  }
}
