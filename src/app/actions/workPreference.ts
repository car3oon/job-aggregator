"use server";

import { verifyAuth } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addWorkPreference(name: string, keywordsStr: string) {
  await verifyAuth();
  if (!name.trim()) return { error: "Name is required." };
  if (!keywordsStr.trim()) return { error: "At least one keyword is required." };

  const keywords = keywordsStr.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

  try {
    await prisma.workPreference.create({
      data: {
        name: name.trim(),
        keywords,
        isActive: true,
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { error: "This preference already exists or an error occurred." };
  }
}

export async function deleteWorkPreference(id: string) {
  await verifyAuth();
  try {
    await prisma.workPreference.delete({
      where: { id },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Failed to delete work preference." };
  }
}

export async function updateWorkPreference(id: string, name: string, keywordsStr: string = "", isActive: boolean) {
  await verifyAuth();
  if (!name.trim()) return { error: "Name is required." };

  const keywords = keywordsStr.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

  try {
    await prisma.workPreference.update({
      where: { id },
      data: {
        name: name.trim(),
        keywords,
        isActive
      }
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Failed to update work preference." };
  }
}

export async function toggleWorkPreference(id: string, isActive: boolean) {
  await verifyAuth();
  try {
    await prisma.workPreference.update({
      where: { id },
      data: { isActive },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { error: "Failed to update status." };
  }
}
