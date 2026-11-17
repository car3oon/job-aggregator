"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseCvFile, countWords, CvParseError } from "@/lib/cv-parser";
import { verifyAuth } from "@/lib/auth";

const MAX_CV_VERSIONS = 10;
const CV_VERSION_UPLOAD_LOCK_ID = 8675309;

export interface CvVersionMetadata {
  id: string;
  label: string;
  originalFilename: string;
  wordCount: number;
  updatedAt: Date;
}

export async function listCvVersions(): Promise<CvVersionMetadata[]> {
  await verifyAuth();

  const versions = await prisma.cvVersion.findMany({
    orderBy: { label: "asc" },
    select: {
      id: true,
      label: true,
      originalFilename: true,
      extractedText: true,
      updatedAt: true,
    },
  });

  // Return metadata without exposing raw extractedText to the client, sorted alphabetically by label
  return versions
    .map((v) => ({
      id: v.id,
      label: v.label,
      originalFilename: v.originalFilename,
      wordCount: countWords(v.extractedText),
      updatedAt: v.updatedAt,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export async function uploadCvVersion(formData: FormData) {
  await verifyAuth();

  const label = (formData.get("label") as string | null)?.trim();
  const file = formData.get("file") as File | null;

  if (!label) {
    return { ok: false, error: "Please provide a label for this CV version." };
  }
  if (!file) {
    return { ok: false, error: "Please select a PDF or DOCX file to upload." };
  }

  try {
    const { extractedText, contentHash } = await parseCvFile(file);

    const uploaded = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CV_VERSION_UPLOAD_LOCK_ID})`;

      const currentCount = await tx.cvVersion.count();
      if (currentCount >= MAX_CV_VERSIONS) {
        return false;
      }

      await tx.cvVersion.create({
        data: {
          label,
          originalFilename: file.name,
          extractedText,
          contentHash,
        },
      });
      return true;
    });

    if (!uploaded) {
      return {
        ok: false,
        error: `You can store at most ${MAX_CV_VERSIONS} CV versions. Delete or replace an existing version first.`,
      };
    }

    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    if (error instanceof CvParseError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Failed to upload CV. Please try again." };
  }
}

export async function renameCvVersion(id: string, newLabel: string) {
  await verifyAuth();
  const trimmed = newLabel.trim();
  if (!trimmed) {
    return { ok: false, error: "Label cannot be empty." };
  }

  await prisma.cvVersion.update({
    where: { id },
    data: { label: trimmed },
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function replaceCvVersion(id: string, formData: FormData) {
  await verifyAuth();
  const file = formData.get("file") as File | null;

  if (!file) {
    return { ok: false, error: "Please select a replacement file." };
  }

  try {
    const { extractedText, contentHash } = await parseCvFile(file);

    await prisma.cvVersion.update({
      where: { id },
      data: {
        originalFilename: file.name,
        extractedText,
        contentHash,
      },
    });

    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    if (error instanceof CvParseError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Failed to replace CV file." };
  }
}

export async function deleteCvVersion(id: string) {
  await verifyAuth();

  await prisma.cvVersion.delete({
    where: { id },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}
