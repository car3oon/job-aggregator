"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addCategory(name: string, keywordsStr: string = "", excludedStr: string = "") {
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
  } catch (error) {
    return { error: "This category already exists or an error occurred." };
  }
}

export async function deleteCategory(id: string) {
  try {
    await prisma.category.delete({
      where: { id },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete category." };
  }
}
