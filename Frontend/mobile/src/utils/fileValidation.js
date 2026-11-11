/**
 * Frontend Assignment File Validation Utility
 *
 * Allowed file types: PDF, DOCX, TXT, JPG, JPEG, PNG
 * Maximum individual file size: 10 MB (10 * 1024 * 1024 bytes)
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const DOCUMENT_PICKER_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
];

const EXTENSION_TO_TYPE_MAP = {
  ".pdf": {
    fileType: "PDF",
    allowedMimeTypes: ["application/pdf", "application/x-pdf"],
  },
  ".docx": {
    fileType: "DOCX",
    allowedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
      "application/zip",
    ],
  },
  ".txt": {
    fileType: "TXT",
    allowedMimeTypes: ["text/plain", "application/octet-stream"],
  },
  ".jpg": {
    fileType: "JPG",
    allowedMimeTypes: ["image/jpeg", "image/jpg"],
  },
  ".jpeg": {
    fileType: "JPEG",
    allowedMimeTypes: ["image/jpeg", "image/jpg"],
  },
  ".png": {
    fileType: "PNG",
    allowedMimeTypes: ["image/png"],
  },
};

const MIME_TO_TYPE_MAP = {
  "application/pdf": "PDF",
  "application/x-pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/plain": "TXT",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/png": "PNG",
};

/**
 * Extracts the lowercase file extension (including the leading dot) from a filename.
 */
export const getFileExtension = (fileName = "") => {
  if (typeof fileName !== "string") {
    return "";
  }
  const trimmed = fileName.trim();
  const lastDotIndex = trimmed.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(lastDotIndex).toLowerCase();
};

/**
 * Formats byte count into a clean MB string (e.g., "4.2 MB" or "0.08 MB").
 */
export const formatFileSizeMB = (bytes) => {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0) {
    return "0.0 MB";
  }
  const megabytes = bytes / (1024 * 1024);
  if (megabytes > 0 && megabytes < 0.01) {
    return "< 0.01 MB";
  }
  if (megabytes < 1) {
    return `${megabytes.toFixed(2)} MB`;
  }
  return `${megabytes.toFixed(1)} MB`;
};

/**
 * Validates a picked document asset from expo-document-picker.
 * Returns { valid: true, file: { ... } } or { valid: false, error: "..." }.
 */
export const validatePickedDocument = (asset) => {
  if (!asset || !asset.uri) {
    return {
      valid: false,
      error: "Unable to read the selected file. Please choose another file.",
    };
  }

  const originalName = (asset.name || "").trim();
  if (!originalName) {
    return {
      valid: false,
      error: "The selected file does not have a valid file name.",
    };
  }

  const extension = getFileExtension(originalName);
  const normalizedMime = (asset.mimeType || "").trim().toLowerCase();
  const extensionRule = EXTENSION_TO_TYPE_MAP[extension];

  // 1. Check extension and MIME type against PDF, DOCX, TXT, JPG, JPEG, PNG
  let resolvedFileType = null;

  if (extensionRule) {
    // If Android provides a specific MIME type, ensure it does not conflict with the extension
    if (
      normalizedMime &&
      normalizedMime !== "application/octet-stream" &&
      !extensionRule.allowedMimeTypes.includes(normalizedMime)
    ) {
      return {
        valid: false,
        error: `File "${originalName}" has a mismatched content type (${normalizedMime}). Allowed formats are PDF, DOCX, TXT, JPG, JPEG, and PNG.`,
      };
    }
    resolvedFileType = extensionRule.fileType;
  } else if (!extension && MIME_TO_TYPE_MAP[normalizedMime]) {
    resolvedFileType = MIME_TO_TYPE_MAP[normalizedMime];
  } else {
    const shownType = extension || normalizedMime || "unknown format";
    return {
      valid: false,
      error: `Unsupported file type (${shownType}). Please select a PDF, DOCX, TXT, JPG, JPEG, or PNG file.`,
    };
  }

  // 2. Validate file size (must be present, non-zero, and <= 10 MB)
  if (typeof asset.size !== "number" || Number.isNaN(asset.size)) {
    return {
      valid: false,
      error: "Unable to determine the file size. Please select a valid local file.",
    };
  }

  if (asset.size <= 0) {
    return {
      valid: false,
      error: `The selected file "${originalName}" is empty (0 MB). Please choose a non-empty file.`,
    };
  }

  if (asset.size > MAX_FILE_SIZE_BYTES) {
    const actualSizeLabel = formatFileSizeMB(asset.size);
    return {
      valid: false,
      error: `"${originalName}" (${actualSizeLabel}) exceeds the 10 MB maximum file size limit.`,
    };
  }

  return {
    valid: true,
    file: {
      uri: asset.uri,
      name: originalName,
      sizeBytes: asset.size,
      sizeFormatted: formatFileSizeMB(asset.size),
      mimeType:
        normalizedMime ||
        extensionRule?.allowedMimeTypes?.[0] ||
        "application/octet-stream",
      extension,
      fileType: resolvedFileType, // "PDF" | "DOCX" | "TXT" | "JPG" | "JPEG" | "PNG"
    },
  };
};
