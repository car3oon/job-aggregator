import crypto from "crypto";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function computeComparedCvHash(
  cvs: Array<{ id: string; contentHash: string }>,
): string | null {
  if (cvs.length === 0) return null;
  const composite = [...cvs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((cv) => `${cv.id}:${cv.contentHash}`)
    .join("|");
  return sha256(composite);
}
