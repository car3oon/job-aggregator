"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addScraperUrl(url: string, name?: string) {
  if (!url || url.trim() === "") {
    return { error: "URL cannot be empty." };
  }

  const trimmedUrl = url.trim();

  try {
    new URL(trimmedUrl);
  } catch (error) {
    return { error: "Please enter a valid URL (including http:// or https://)." };
  }

  try {
    await prisma.scraperUrl.create({
      data: {
        url: trimmedUrl,
        name: name?.trim() || null,
        isActive: true,
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { error: "This URL is already in your scraper list or an error occurred." };
  }
}

export async function deleteScraperUrl(id: string) {
  try {
    await prisma.scraperUrl.delete({
      where: { id },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete URL." };
  }
}

export async function toggleScraperUrl(id: string, isActive: boolean) {
  try {
    await prisma.scraperUrl.update({
      where: { id },
      data: { isActive },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { error: "Failed to update URL status." };
  }
}
