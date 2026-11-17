import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { sha256, computeComparedCvHash } from "@/lib/cv-hash";

export { sha256, computeComparedCvHash };

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TEXT_LENGTH = 50_000; // 50,000 characters

export class CvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CvParseError";
  }
}

export interface ParsedCvResult {
  extractedText: string;
  contentHash: string;
  wordCount: number;
}

function detectFileTypeByMagicBytes(
  buffer: Buffer,
  filename: string,
): "pdf" | "docx" {
  const ext = filename.split(".").pop()?.toLowerCase();

  // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  const isPdfMagic =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d;

  // DOCX (ZIP container) magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  const isZipMagic =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (ext === "pdf" && isPdfMagic) return "pdf";
  if (ext === "docx" && isZipMagic) return "docx";

  throw new CvParseError(
    "Unsupported or corrupted file. Please upload a valid PDF or DOCX document.",
  );
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export async function parseCvFile(file: File): Promise<ParsedCvResult> {
  if (!file || file.size === 0) {
    throw new CvParseError("The uploaded file is empty.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new CvParseError("File exceeds the maximum allowed size of 5 MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileType = detectFileTypeByMagicBytes(buffer, file.name);

  let rawText = "";

  try {
    if (fileType === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      try {
        const { text } = await extractText(pdf, { mergePages: true });
        rawText = text;
      } finally {
        await pdf.loadingTask.destroy();
      }
    } else {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    }
  } catch {
    throw new CvParseError(
      "Could not extract text from the file. Ensure it is not password-protected or corrupted.",
    );
  }

  // Normalize whitespace and line breaks
  const normalizedText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalizedText.length < 30) {
    throw new CvParseError(
      "No extractable text found. Scanned or image-only CVs are not supported.",
    );
  }

  if (normalizedText.length > MAX_TEXT_LENGTH) {
    throw new CvParseError(
      `Extracted CV text is too long (${normalizedText.length.toLocaleString()} chars). Maximum allowed is ${MAX_TEXT_LENGTH.toLocaleString()} characters.`,
    );
  }

  return {
    extractedText: normalizedText,
    contentHash: sha256(normalizedText),
    wordCount: countWords(normalizedText),
  };
}
