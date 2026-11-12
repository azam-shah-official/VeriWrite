/**
 * VeriWrite - Document Text Extraction Utility
 *
 * Extracts readable text from PDF, DOCX, and TXT files while preserving
 * meaningful paragraph boundaries and document structure.
 *
 * Security:
 * - Never trusts user-supplied file paths; enforces server-controlled storage boundaries.
 * - Detects scanned/image-only PDFs (no OCR).
 * - Handles corrupted, encrypted, malformed, and empty documents safely.
 * - Never leaks internal file system paths or sensitive contents in error messages.
 */

import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import {
  PDFParse,
  PasswordException,
  InvalidPDFException,
  FormatError,
} from "pdf-parse";
import { ASSIGNMENTS_STORAGE_DIR } from "../middleware/uploadMiddleware.js";
import {
  normalizeExtractedText,
  validateExtractedText,
} from "./textValidator.js";

/**
 * Custom error class for text extraction failures.
 */
export class TextExtractionError extends Error {
  constructor(message, code = "EXTRACTION_FAILED", originalError = null) {
    super(message);
    this.name = "TextExtractionError";
    this.code = code;
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Asserts that a file path is safe, points to an existing file, and
 * is constrained to the designated private storage directory.
 *
 * @param {string} filePath - Absolute or relative path to the file.
 * @param {object} [options={}] - Options.
 * @param {boolean} [options.enforceStorageDir=true] - Whether to require the path be inside ASSIGNMENTS_STORAGE_DIR.
 * @returns {Promise<string>} The safely resolved file path.
 */
export async function assertSafeStoragePath(filePath, options = {}) {
  const { enforceStorageDir = true } = options;

  if (!filePath || typeof filePath !== "string") {
    throw new TextExtractionError("Invalid or missing file path.", "INVALID_PATH");
  }

  if (filePath.includes("\0")) {
    throw new TextExtractionError("File path contains null bytes.", "INVALID_PATH");
  }

  const resolved = path.resolve(filePath);

  if (enforceStorageDir) {
    const storageRoot = path.resolve(ASSIGNMENTS_STORAGE_DIR);
    if (!resolved.startsWith(storageRoot + path.sep)) {
      throw new TextExtractionError(
        "Access denied: file path is outside the authorized storage directory.",
        "INVALID_PATH"
      );
    }
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      throw new TextExtractionError(
        "The specified path is not a regular file.",
        "INVALID_PATH"
      );
    }
  } catch (statErr) {
    if (statErr instanceof TextExtractionError) {
      throw statErr;
    }
    if (statErr?.code === "ENOENT") {
      throw new TextExtractionError(
        "The requested file does not exist on the server.",
        "FILE_NOT_FOUND"
      );
    }
    throw new TextExtractionError(
      "Unable to access the specified file.",
      "FILE_ACCESS_ERROR",
      statErr
    );
  }

  return resolved;
}

/**
 * Extracts plain text from a PDF document buffer or file path.
 * Preserves paragraph breaks and detects scanned/image-only PDFs.
 *
 * @param {string|Buffer|Uint8Array} filePathOrBuffer - Path or Buffer of the PDF.
 * @param {object} [options={}] - Parser options.
 * @returns {Promise<{ text: string, pageCount: number, fileCategory: string }>}
 */
export async function extractTextFromPdf(filePathOrBuffer, options = {}) {
  let fileBuffer;
  if (
    Buffer.isBuffer(filePathOrBuffer) ||
    filePathOrBuffer instanceof Uint8Array
  ) {
    fileBuffer = Buffer.from(filePathOrBuffer);
  } else {
    const safePath = await assertSafeStoragePath(filePathOrBuffer, options);
    fileBuffer = await fs.readFile(safePath);
  }

  if (fileBuffer.length === 0) {
    throw new TextExtractionError(
      "The PDF file is empty (0 bytes).",
      "EMPTY_DOCUMENT"
    );
  }

  const parser = new PDFParse({ data: fileBuffer });
  try {
    const textResult = await parser.getText({
      pageJoiner: "",
      lineEnforce: true,
    });

    const pageCount =
      textResult.total ||
      (Array.isArray(textResult.pages) ? textResult.pages.length : 1);

    // Collect per-page text and join with paragraph separators
    let extractedText = "";
    if (Array.isArray(textResult.pages) && textResult.pages.length > 0) {
      extractedText = textResult.pages
        .map((p) => (typeof p.text === "string" ? p.text.trim() : ""))
        .filter(Boolean)
        .join("\n\n");
    } else if (typeof textResult.text === "string") {
      extractedText = textResult.text.trim();
    }

    if (!extractedText || extractedText.length === 0) {
      // Check for embedded images to accurately classify scanned documents
      let hasImages = false;
      try {
        const imgResult = await parser.getImage();
        hasImages = Boolean(
          imgResult?.pages?.some(
            (p) => Array.isArray(p.images) && p.images.length > 0
          )
        );
      } catch (_imgErr) {
        // Fallback: image extraction check failed, proceed to empty check
      }

      if (hasImages) {
        throw new TextExtractionError(
          "This PDF appears to be a scanned document or image-only file with no selectable text. VeriWrite requires machine-readable text submissions.",
          "SCANNED_DOCUMENT"
        );
      }

      throw new TextExtractionError(
        "The PDF file contains no selectable text content.",
        "EMPTY_DOCUMENT"
      );
    }

    return {
      text: extractedText,
      pageCount,
      fileCategory: "PDF",
    };
  } catch (err) {
    if (err instanceof TextExtractionError) {
      throw err;
    }
    if (
      err instanceof PasswordException ||
      err?.name === "PasswordException" ||
      (typeof err?.message === "string" && /password|encrypt/i.test(err.message))
    ) {
      throw new TextExtractionError(
        "The PDF document is password-protected or encrypted.",
        "ENCRYPTED_DOCUMENT",
        err
      );
    }
    if (
      err instanceof InvalidPDFException ||
      err instanceof FormatError ||
      err?.name === "InvalidPDFException" ||
      err?.name === "FormatError" ||
      (typeof err?.message === "string" &&
        /invalid|corrupt|damaged|format/i.test(err.message))
    ) {
      throw new TextExtractionError(
        "The PDF file is corrupted or not a valid PDF document.",
        "CORRUPTED_DOCUMENT",
        err
      );
    }
    throw new TextExtractionError(
      "Failed to extract text from the PDF file.",
      "EXTRACTION_FAILED",
      err
    );
  } finally {
    try {
      await parser.destroy();
    } catch (_destErr) {
      // Ignore parser cleanup errors
    }
  }
}

/**
 * Extracts plain text from a DOCX document buffer or file path.
 * Preserves paragraph breaks and detects encrypted or corrupted files.
 *
 * @param {string|Buffer|Uint8Array} filePathOrBuffer - Path or Buffer of the DOCX.
 * @param {object} [options={}] - Parser options.
 * @returns {Promise<{ text: string, fileCategory: string, messages: Array }>}
 */
export async function extractTextFromDocx(filePathOrBuffer, options = {}) {
  let result;
  try {
    if (
      Buffer.isBuffer(filePathOrBuffer) ||
      filePathOrBuffer instanceof Uint8Array
    ) {
      result = await mammoth.extractRawText({
        buffer: Buffer.from(filePathOrBuffer),
      });
    } else {
      const safePath = await assertSafeStoragePath(filePathOrBuffer, options);
      result = await mammoth.extractRawText({ path: safePath });
    }
  } catch (err) {
    if (
      typeof err?.message === "string" &&
      /password|encrypt/i.test(err.message)
    ) {
      throw new TextExtractionError(
        "The DOCX document is password-protected or encrypted.",
        "ENCRYPTED_DOCUMENT",
        err
      );
    }
    if (
      typeof err?.message === "string" &&
      /zip|central directory|corrupt|invalid/i.test(err.message)
    ) {
      throw new TextExtractionError(
        "The DOCX file is corrupted or not a valid Word document.",
        "CORRUPTED_DOCUMENT",
        err
      );
    }
    throw new TextExtractionError(
      "Failed to extract text from the DOCX file.",
      "EXTRACTION_FAILED",
      err
    );
  }

  const rawText = result?.value || "";
  if (!rawText || !rawText.trim()) {
    throw new TextExtractionError(
      "The DOCX file contains no readable text content.",
      "EMPTY_DOCUMENT"
    );
  }

  return {
    text: rawText,
    fileCategory: "DOCX",
    messages: result?.messages || [],
  };
}

/**
 * Extracts plain text from a TXT document buffer or file path.
 * Enforces strict UTF-8 decoding and guards against binary contamination.
 *
 * @param {string|Buffer|Uint8Array} filePathOrBuffer - Path or Buffer of the TXT.
 * @param {object} [options={}] - Parser options.
 * @returns {Promise<{ text: string, fileCategory: string }>}
 */
export async function extractTextFromTxt(filePathOrBuffer, options = {}) {
  let fileBuffer;
  if (
    Buffer.isBuffer(filePathOrBuffer) ||
    filePathOrBuffer instanceof Uint8Array
  ) {
    fileBuffer = Buffer.from(filePathOrBuffer);
  } else {
    const safePath = await assertSafeStoragePath(filePathOrBuffer, options);
    fileBuffer = await fs.readFile(safePath);
  }

  if (fileBuffer.length === 0) {
    throw new TextExtractionError(
      "The text file is empty (0 bytes).",
      "EMPTY_DOCUMENT"
    );
  }

  let text;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    text = decoder.decode(fileBuffer);
  } catch (decodeErr) {
    throw new TextExtractionError(
      "The text file is not valid UTF-8 encoded text.",
      "CORRUPTED_DOCUMENT",
      decodeErr
    );
  }

  if (text.includes("\u0000")) {
    throw new TextExtractionError(
      "The text file contains null bytes or binary characters.",
      "CORRUPTED_DOCUMENT"
    );
  }

  if (!text || !text.trim()) {
    throw new TextExtractionError(
      "The text file contains only whitespace.",
      "EMPTY_DOCUMENT"
    );
  }

  return {
    text,
    fileCategory: "TXT",
  };
}

/**
 * Primary text extraction function for any supported assignment file.
 * Infers or verifies format, safely extracts raw text, normalizes Unicode and
 * paragraph spacing, and validates that the text meets submission requirements.
 *
 * @param {string} filePath - Path to the file in private assignment storage.
 * @param {object} [options={}] - Options.
 * @param {string} [options.fileCategory] - Explicit category: 'PDF' | 'DOCX' | 'TXT'.
 * @param {boolean} [options.enforceStorageDir=true] - Constrain to private assignment storage.
 * @param {object} [options.validationOptions={}] - Options passed to validateExtractedText.
 * @returns {Promise<object>} Extraction result with normalizedText and stats.
 */
export async function extractTextFromFile(filePath, options = {}) {
  const safePath = await assertSafeStoragePath(filePath, options);
  const ext = path.extname(safePath).toLowerCase();

  const category = (
    options.fileCategory ||
    (ext === ".pdf"
      ? "PDF"
      : ext === ".docx"
        ? "DOCX"
        : ext === ".txt"
          ? "TXT"
          : ext === ".jpg" || ext === ".jpeg" || ext === ".png"
            ? "IMAGE"
            : "UNKNOWN")
  ).toUpperCase();

  if (category === "IMAGE") {
    throw new TextExtractionError(
      "Image files (JPEG/PNG) do not support direct text extraction. Machine-readable text submissions (PDF, DOCX, TXT) are required.",
      "UNSUPPORTED_FORMAT"
    );
  }

  let extraction;
  switch (category) {
    case "PDF":
      extraction = await extractTextFromPdf(safePath, options);
      break;
    case "DOCX":
      extraction = await extractTextFromDocx(safePath, options);
      break;
    case "TXT":
      extraction = await extractTextFromTxt(safePath, options);
      break;
    default:
      throw new TextExtractionError(
        `Unsupported document format (${ext || "unknown"}). Allowed formats are PDF, DOCX, and TXT.`,
        "UNSUPPORTED_FORMAT"
      );
  }

  const normalizedText = normalizeExtractedText(extraction.text);
  const validation = validateExtractedText(
    normalizedText,
    options.validationOptions
  );

  return {
    success: true,
    fileCategory: extraction.fileCategory,
    pageCount: extraction.pageCount || null,
    rawText: extraction.text,
    normalizedText,
    validation,
    stats: validation.stats,
  };
}
