import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Private storage directory outside src/ and never served via express.static
export const ASSIGNMENTS_STORAGE_DIR = path.resolve(
  __dirname,
  "../../storage/assignments"
);

// Ensure private storage directory exists
fs.mkdirSync(ASSIGNMENTS_STORAGE_DIR, { recursive: true });

export const MAX_ASSIGNMENT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_FILE_SPECS = {
  ".pdf": {
    canonicalMime: "application/pdf",
    fileCategory: "PDF",
    allowedClientMimes: [
      "application/pdf",
      "application/x-pdf",
      "application/octet-stream",
    ],
  },
  ".docx": {
    canonicalMime:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileCategory: "DOCX",
    allowedClientMimes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
  },
  ".txt": {
    canonicalMime: "text/plain",
    fileCategory: "TXT",
    allowedClientMimes: ["text/plain", "application/octet-stream"],
  },
  ".jpg": {
    canonicalMime: "image/jpeg",
    fileCategory: "IMAGE",
    allowedClientMimes: [
      "image/jpeg",
      "image/jpg",
      "application/octet-stream",
    ],
  },
  ".jpeg": {
    canonicalMime: "image/jpeg",
    fileCategory: "IMAGE",
    allowedClientMimes: [
      "image/jpeg",
      "image/jpg",
      "application/octet-stream",
    ],
  },
  ".png": {
    canonicalMime: "image/png",
    fileCategory: "IMAGE",
    allowedClientMimes: ["image/png", "application/octet-stream"],
  },
};

/**
 * Sanitizes a client-provided filename for safe metadata storage.
 * Strips directory paths, null bytes, control chars, and unsafe characters.
 */
export const sanitizeOriginalFilename = (rawFilename = "") => {
  if (typeof rawFilename !== "string") {
    return "";
  }

  // Strip any path components (prevents ../ or ..\ traversal in metadata)
  const base = path.basename(rawFilename.replace(/\\/g, "/"));

  // Remove null bytes, control characters, and reserved filesystem symbols
  const cleaned = base
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "..") {
    return "";
  }

  return cleaned.slice(0, 200);
};

/**
 * Safely deletes a file from private storage if it exists.
 * Verifies the path stays inside ASSIGNMENTS_STORAGE_DIR before unlinking.
 */
export const safeDeleteUploadedFile = async (filePath) => {
  if (!filePath || typeof filePath !== "string") {
    return;
  }

  try {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(ASSIGNMENTS_STORAGE_DIR + path.sep)) {
      return;
    }
    await fs.promises.unlink(resolvedPath);
  } catch (_err) {
    // Ignore if already deleted or missing
  }
};

/**
 * Inspects the saved file's actual magic bytes / container structure.
 */
export const verifyFileSignature = async (filePath, extension) => {
  const stats = await fs.promises.stat(filePath);

  if (!stats.isFile() || stats.size <= 0) {
    return {
      valid: false,
      message: "Uploaded file is empty (0 bytes).",
    };
  }

  if (stats.size > MAX_ASSIGNMENT_FILE_SIZE) {
    return {
      valid: false,
      message: "Uploaded file exceeds the maximum allowed size of 10 MB.",
    };
  }

  const fileBuffer = await fs.promises.readFile(filePath);

  // 1. PDF signature: "%PDF-" (25 50 44 46 2D)
  if (extension === ".pdf") {
    if (fileBuffer.length < 5) {
      return {
        valid: false,
        message: "Invalid PDF file: file is truncated or corrupted.",
      };
    }
    const header = fileBuffer.subarray(0, 5).toString("ascii");
    if (header !== "%PDF-") {
      return {
        valid: false,
        message:
          "File signature mismatch: uploaded file is not a valid PDF document.",
      };
    }
    return { valid: true, actualSize: stats.size };
  }

  // 2. DOCX signature: ZIP header (50 4B 03 04) + OpenXML DOCX container markers
  if (extension === ".docx") {
    if (
      fileBuffer.length < 4 ||
      fileBuffer[0] !== 0x50 ||
      fileBuffer[1] !== 0x4b ||
      fileBuffer[2] !== 0x03 ||
      fileBuffer[3] !== 0x04
    ) {
      return {
        valid: false,
        message:
          "File signature mismatch: uploaded file is not a valid DOCX archive.",
      };
    }

    // Verify DOCX OpenXML internal structure entries exist inside the ZIP container
    const hasContentTypes = fileBuffer.includes(
      Buffer.from("[Content_Types].xml", "utf8")
    );
    const hasWordDocument = fileBuffer.includes(
      Buffer.from("word/document.xml", "utf8")
    );

    if (!hasContentTypes || !hasWordDocument) {
      return {
        valid: false,
        message:
          "Invalid DOCX container: file does not contain required Word OpenXML structure.",
      };
    }

    return { valid: true, actualSize: stats.size };
  }

  // 3. JPEG signature: FF D8 FF
  if (extension === ".jpg" || extension === ".jpeg") {
    if (
      fileBuffer.length < 3 ||
      fileBuffer[0] !== 0xff ||
      fileBuffer[1] !== 0xd8 ||
      fileBuffer[2] !== 0xff
    ) {
      return {
        valid: false,
        message:
          "File signature mismatch: uploaded file is not a valid JPEG image.",
      };
    }
    return { valid: true, actualSize: stats.size };
  }

  // 4. PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (extension === ".png") {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (fileBuffer.length < 8) {
      return {
        valid: false,
        message: "Invalid PNG file: file is truncated or corrupted.",
      };
    }
    const matchesPng = pngSignature.every(
      (byte, idx) => fileBuffer[idx] === byte
    );
    if (!matchesPng) {
      return {
        valid: false,
        message:
          "File signature mismatch: uploaded file is not a valid PNG image.",
      };
    }
    return { valid: true, actualSize: stats.size };
  }

  // 5. TXT validation: ensure reasonable text content and reject disguised binaries
  if (extension === ".txt") {
    // Reject known binary magic headers disguised as .txt
    const startsWithPdf =
      fileBuffer.length >= 5 &&
      fileBuffer.subarray(0, 5).toString("ascii") === "%PDF-";
    const startsWithZip =
      fileBuffer.length >= 4 &&
      fileBuffer[0] === 0x50 &&
      fileBuffer[1] === 0x4b &&
      fileBuffer[2] === 0x03 &&
      fileBuffer[3] === 0x04;
    const startsWithPng =
      fileBuffer.length >= 4 &&
      fileBuffer[0] === 0x89 &&
      fileBuffer[1] === 0x50 &&
      fileBuffer[2] === 0x4e &&
      fileBuffer[3] === 0x47;
    const startsWithJpeg =
      fileBuffer.length >= 3 &&
      fileBuffer[0] === 0xff &&
      fileBuffer[1] === 0xd8 &&
      fileBuffer[2] === 0xff;
    const startsWithMzExe =
      fileBuffer.length >= 2 &&
      fileBuffer[0] === 0x4d &&
      fileBuffer[1] === 0x5a;
    const startsWithElf =
      fileBuffer.length >= 4 &&
      fileBuffer[0] === 0x7f &&
      fileBuffer[1] === 0x45 &&
      fileBuffer[2] === 0x4c &&
      fileBuffer[3] === 0x46;

    if (
      startsWithPdf ||
      startsWithZip ||
      startsWithPng ||
      startsWithJpeg ||
      startsWithMzExe ||
      startsWithElf
    ) {
      return {
        valid: false,
        message:
          "File signature mismatch: binary file disguised as a plain text (.txt) file.",
      };
    }

    // Inspect up to first 64 KB for null bytes or binary control characters
    const sampleLength = Math.min(fileBuffer.length, 65536);
    for (let i = 0; i < sampleLength; i += 1) {
      const byte = fileBuffer[i];
      // Disallow null byte (0x00) and non-whitespace control characters
      const isForbiddenControl =
        byte === 0x00 ||
        (byte >= 0x01 && byte <= 0x08) ||
        byte === 0x0b ||
        byte === 0x0c ||
        (byte >= 0x0e && byte <= 0x1f);

      if (isForbiddenControl) {
        return {
          valid: false,
          message:
            "Invalid TXT file: contains binary or non-text control characters.",
        };
      }
    }

    // Validate strict UTF-8 decoding
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      decoder.decode(fileBuffer.subarray(0, sampleLength));
    } catch (_decodeErr) {
      return {
        valid: false,
        message: "Invalid TXT file: text must be valid UTF-8 encoded content.",
      };
    }

    return { valid: true, actualSize: stats.size };
  }

  return {
    valid: false,
    message: "Unsupported file format.",
  };
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(ASSIGNMENTS_STORAGE_DIR, { recursive: true });
    cb(null, ASSIGNMENTS_STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const extension =
      req.validatedFileMeta?.extension ||
      path.extname(file.originalname || "").toLowerCase();
    // Cryptographically random 40-char hex identifier; never uses original filename
    const randomId = crypto.randomBytes(20).toString("hex");
    const generatedFileName = `${randomId}${extension}`;
    cb(null, generatedFileName);
  },
});

const fileFilter = (req, file, cb) => {
  const sanitizedOriginalName = sanitizeOriginalFilename(
    file.originalname || ""
  );
  if (!sanitizedOriginalName) {
    const err = new Error("Uploaded file must have a valid filename.");
    err.statusCode = 400;
    return cb(err, false);
  }

  const extension = path.extname(sanitizedOriginalName).toLowerCase();
  const spec = ALLOWED_FILE_SPECS[extension];

  if (!spec) {
    const err = new Error(
      `Unsupported file format (${extension || "unknown"}). Allowed formats are PDF, DOCX, TXT, JPG, JPEG, and PNG.`
    );
    err.statusCode = 400;
    return cb(err, false);
  }

  const clientMime = String(file.mimetype || "")
    .trim()
    .toLowerCase();

  if (!spec.allowedClientMimes.includes(clientMime)) {
    const err = new Error(
      `Invalid MIME type (${clientMime || "unknown"}) for ${extension} file. Allowed formats are PDF, DOCX, TXT, JPG, JPEG, and PNG.`
    );
    err.statusCode = 400;
    return cb(err, false);
  }

  req.validatedFileMeta = {
    originalFileName: sanitizedOriginalName,
    extension,
    canonicalMime: spec.canonicalMime,
    fileCategory: spec.fileCategory,
  };

  return cb(null, true);
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_ASSIGNMENT_FILE_SIZE,
    files: 1,
    fields: 10,
  },
});

/**
 * Middleware that parses a single file upload (`file`), handles Multer errors cleanly,
 * verifies magic bytes after disk write, and deletes rejected files immediately.
 */
export const uploadSingleAssignmentFile = (req, res, next) => {
  const singleUpload = multerUpload.single("file");

  singleUpload(req, res, async (err) => {
    if (err) {
      if (req.file?.path) {
        await safeDeleteUploadedFile(req.file.path);
      }

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message:
              "File size exceeds the maximum limit of 10 MB per submission.",
          });
        }

        if (
          err.code === "LIMIT_FILE_COUNT" ||
          err.code === "LIMIT_UNEXPECTED_FILE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid file upload field. Provide exactly one file in the 'file' field.",
          });
        }

        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`,
        });
      }

      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message || "Invalid file upload.",
      });
    }

    if (!req.file || !req.file.path) {
      return res.status(400).json({
        success: false,
        message: "Assignment file is required in the 'file' field.",
      });
    }

    const meta = req.validatedFileMeta;
    if (!meta) {
      await safeDeleteUploadedFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "File validation metadata missing.",
      });
    }

    try {
      const signatureCheck = await verifyFileSignature(
        req.file.path,
        meta.extension
      );

      if (!signatureCheck.valid) {
        await safeDeleteUploadedFile(req.file.path);
        return res.status(400).json({
          success: false,
          message: signatureCheck.message,
        });
      }

      req.verifiedUpload = {
        originalFileName: meta.originalFileName,
        storageKey: req.file.filename,
        internalFilePath: req.file.path,
        mimeType: meta.canonicalMime,
        fileExtension: meta.extension,
        fileSize: signatureCheck.actualSize,
        fileCategory: meta.fileCategory,
      };

      return next();
    } catch (_verifyError) {
      await safeDeleteUploadedFile(req.file.path);
      return res.status(500).json({
        success: false,
        message: "Internal server error while verifying uploaded file.",
      });
    }
  });
};
