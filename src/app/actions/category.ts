"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyAuth } from "@/lib/auth";

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
    await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        slug,
        keywords,
        excluded
      }
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Failed to update category. Name might conflict." };
  }
}
