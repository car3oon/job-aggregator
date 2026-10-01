"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addCategory(name: string) {
  if (!name || name.trim() === "") {
    return { error: "Category name cannot be empty." };
  }

  const trimmedName = name.trim();

  // Generate a URL-friendly slug (e.g. "React Developer" -> "react-developer")
  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  try {
    await prisma.category.create({
      data: {
        name: trimmedName,
        slug: slug,
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { error: "Category might already exist or an error occurred." };
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