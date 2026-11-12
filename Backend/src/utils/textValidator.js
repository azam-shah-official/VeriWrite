/**
 * VeriWrite - Extracted Text Normalization and Validation Utility
 *
 * Normalizes Unicode, standardizes whitespace and line breaks while preserving
 * meaningful paragraph boundaries, and computes academic text statistics.
 *
 * Rejects empty, whitespace-only, corrupted, and unreadable text without
 * enforcing an artificial 50-word minimum (short submissions remain valid).
 */

export class TextValidationError extends Error {
  constructor(message, code = "VALIDATION_FAILED") {
    super(message);
    this.name = "TextValidationError";
    this.code = code;
  }
}

/**
 * Normalizes extracted text:
 * 1. Unicode NFC normalization.
 * 2. Strips BOM and invisible zero-width characters (\uFEFF, \u200B-\u200D, \u00AD).
 * 3. Normalizes Unicode space variants (\u00A0, em/en-spaces) to standard ASCII space.
 * 4. Standardizes line breaks (\r\n and \r to \n).
 * 5. Collapses multiple horizontal spaces within each line while preserving indentation/breaks.
 * 6. Preserves paragraph boundaries by limiting consecutive blank lines to at most two newlines (\n\n).
 * 7. Trims overall document boundaries.
 *
 * @param {string} rawText - Unprocessed extracted text.
 * @returns {string} Normalized text.
 */
export function normalizeExtractedText(rawText) {
  if (typeof rawText !== "string") {
    return "";
  }

  // 1. Unicode NFC normalization
  let text = rawText.normalize("NFC");

  // 2. Remove BOM and zero-width non-printing characters
  text = text.replace(/[\uFEFF\u200B-\u200D\u00AD]/g, "");

  // 3. Normalize non-breaking and special Unicode spaces to standard space
  text = text.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ");

  // 4. Standardize line endings (\r\n and \r -> \n)
  text = text.replace(/\r\n|\r/g, "\n");

  // 5. Line-by-line whitespace normalization
  const lines = text.split("\n").map((line) => {
    // Collapse consecutive tabs and horizontal spaces into a single space
    return line.replace(/[^\S\n]+/g, " ").trim();
  });

  text = lines.join("\n");

  // 6. Collapse 3 or more consecutive newlines into 2 to preserve paragraph boundaries
  text = text.replace(/\n{3,}/g, "\n\n");

  // 7. Trim leading and trailing whitespace
  return text.trim();
}

/**
 * Computes word count, character count, paragraph count, line count,
 * and estimated reading time from normalized text.
 *
 * @param {string} normalizedText - Normalized text string.
 * @returns {object} Text statistics.
 */
export function calculateTextStatistics(normalizedText) {
  if (typeof normalizedText !== "string" || normalizedText.length === 0) {
    return {
      characterCount: 0,
      characterCountWithoutSpaces: 0,
      wordCount: 0,
      paragraphCount: 0,
      lineCount: 0,
      readingTimeMinutes: 0,
    };
  }

  const characterCount = normalizedText.length;
  const characterCountWithoutSpaces = normalizedText.replace(/\s+/g, "").length;

  // Unicode-aware word tokenization: matches letter/number sequences allowing internal hyphens and apostrophes
  const words =
    normalizedText.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
  const wordCount = words.length;

  // Paragraphs separated by one or more blank lines (\n\n)
  const paragraphs = normalizedText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const paragraphCount = paragraphs.length;

  // Non-empty lines
  const lines = normalizedText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lineCount = lines.length;

  // Average reading speed: 200 words per minute
  const readingTimeMinutes =
    wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0;

  return {
    characterCount,
    characterCountWithoutSpaces,
    wordCount,
    paragraphCount,
    lineCount,
    readingTimeMinutes,
  };
}

/**
 * Validates extracted text against required constraints.
 * Rejects empty, whitespace-only, unreadable, and symbol-only text.
 * Allows short meaningful submissions (minWords defaults to 1).
 *
 * @param {string} rawOrNormalizedText - Raw or normalized text.
 * @param {object} [options={}] - Validation options.
 * @returns {object} Validation result { isValid, error, errorCode, stats, normalizedText }.
 */
export function validateExtractedText(rawOrNormalizedText, options = {}) {
  const {
    minWords = 1,
    maxWords = 100000,
    minCharacters = 3,
    maxCharacters = 2000000,
    minPrintableRatio = 0.7,
  } = options;

  if (
    typeof rawOrNormalizedText !== "string" ||
    rawOrNormalizedText.trim().length === 0
  ) {
    return {
      isValid: false,
      error: "Extracted text is empty or contains only whitespace.",
      errorCode: "EMPTY_TEXT",
      stats: calculateTextStatistics(""),
      normalizedText: "",
    };
  }

  const normalizedText = normalizeExtractedText(rawOrNormalizedText);

  if (normalizedText.length === 0) {
    return {
      isValid: false,
      error: "Extracted text is empty or contains only whitespace.",
      errorCode: "EMPTY_TEXT",
      stats: calculateTextStatistics(""),
      normalizedText: "",
    };
  }

  const stats = calculateTextStatistics(normalizedText);

  // Minimum and maximum character checks
  if (stats.characterCount < minCharacters) {
    return {
      isValid: false,
      error: `Extracted text is too short (${stats.characterCount} character(s)). Minimum requirement is ${minCharacters} characters.`,
      errorCode: "TEXT_TOO_SHORT",
      stats,
      normalizedText,
    };
  }

  if (stats.characterCount > maxCharacters) {
    return {
      isValid: false,
      error: `Extracted text exceeds the maximum character limit (${stats.characterCount} > ${maxCharacters}).`,
      errorCode: "TEXT_TOO_LONG",
      stats,
      normalizedText,
    };
  }

  // Word count check (allows short submissions; does not hard-code 50-word minimum)
  if (stats.wordCount < minWords) {
    return {
      isValid: false,
      error: "No readable words were found in the extracted text.",
      errorCode: "INSUFFICIENT_WORDS",
      stats,
      normalizedText,
    };
  }

  if (stats.wordCount > maxWords) {
    return {
      isValid: false,
      error: `Extracted text exceeds the maximum word limit (${stats.wordCount} > ${maxWords}).`,
      errorCode: "EXCESSIVE_WORDS",
      stats,
      normalizedText,
    };
  }

  // Readable/printable character ratio check
  const printableMatches =
    normalizedText.match(/[\p{L}\p{N}\p{P}\p{Z}\p{S}\n\r\t]/gu) || [];
  const printableRatio = printableMatches.length / normalizedText.length;

  if (printableRatio < minPrintableRatio) {
    return {
      isValid: false,
      error:
        "Extracted text appears unreadable, corrupted, or contains an excessive amount of unrecognized symbols.",
      errorCode: "UNREADABLE_TEXT",
      stats,
      normalizedText,
    };
  }

  return {
    isValid: true,
    error: null,
    errorCode: null,
    stats,
    normalizedText,
  };
}

/**
 * Asserts that the extracted text is valid, throwing TextValidationError on failure.
 *
 * @param {string} rawOrNormalizedText - Raw or normalized text.
 * @param {object} [options={}] - Validation options.
 * @returns {object} Validated result with normalizedText and stats.
 */
export function assertValidText(rawOrNormalizedText, options = {}) {
  const result = validateExtractedText(rawOrNormalizedText, options);
  if (!result.isValid) {
    throw new TextValidationError(result.error, result.errorCode);
  }
  return result;
}

export class EvidenceValidationError extends Error {
  constructor(message, code = "INVALID_EVIDENCE") {
    super(message);
    this.name = "EvidenceValidationError";
    this.code = code;
  }
}

/**
 * Validates analysis evidence character offsets and snippet matching against
 * the assignment's original extractedText.
 *
 * Indexing & Offset Policy:
 * - Offsets use the 0-indexed, end-exclusive convention: extractedText.slice(charStart, charEnd).
 * - charStart must be an integer >= 0.
 * - charEnd must be an integer > charStart (end-exclusive boundary).
 * - charEnd must not exceed extractedText.length.
 * - If both charStart and charEnd are null/undefined, the evidence is treated as
 *   unanchored document-level evidence (allowed by schema policy for holistic indicators).
 * - If either charStart or charEnd is provided, BOTH must be valid integers.
 *
 * Normalization & Snippet Matching Policy:
 * 1. Exact string match: extractedText.slice(charStart, charEnd) === snippet
 * 2. Fallback normalization: normalizeExtractedText(slice) === normalizeExtractedText(snippet)
 *    (resolves minor whitespace or CRLF line ending differences without silent offset mutation).
 * If neither matches, validation fails and the evidence is rejected.
 *
 * @param {object} evidence - Evidence item containing snippet, charStart, charEnd.
 * @param {string} extractedText - Original extracted text from the assignment.
 * @returns {{ isValid: boolean, error: string | null, errorCode: string | null }} Validation result.
 */
export function validateEvidenceOffsets(evidence, extractedText) {
  if (!evidence || typeof evidence !== "object") {
    return {
      isValid: false,
      error: "Evidence item must be an object.",
      errorCode: "INVALID_EVIDENCE_OBJECT",
    };
  }

  if (typeof extractedText !== "string") {
    return {
      isValid: false,
      error: "Original extractedText must be a string for offset verification.",
      errorCode: "MISSING_EXTRACTED_TEXT",
    };
  }

  const { charStart, charEnd, snippet } = evidence;

  // Schema policy for unanchored/document-level evidence:
  // When both charStart and charEnd are null or undefined
  const hasStart = charStart !== null && charStart !== undefined;
  const hasEnd = charEnd !== null && charEnd !== undefined;

  if (!hasStart && !hasEnd) {
    if (typeof snippet !== "string" || snippet.trim().length === 0) {
      return {
        isValid: false,
        error: "Evidence snippet must be a non-empty string.",
        errorCode: "INVALID_SNIPPET",
      };
    }
    return { isValid: true, error: null, errorCode: null };
  }

  // If one offset is provided, both must be provided
  if (!hasStart || !hasEnd) {
    return {
      isValid: false,
      error:
        "Both charStart and charEnd must be provided together when specifying character offsets.",
      errorCode: "INCOMPLETE_OFFSETS",
    };
  }

  // Both offsets must be valid integers
  if (!Number.isInteger(charStart)) {
    return {
      isValid: false,
      error: `charStart must be a valid integer, received: ${charStart}.`,
      errorCode: "INVALID_CHAR_START",
    };
  }

  if (!Number.isInteger(charEnd)) {
    return {
      isValid: false,
      error: `charEnd must be a valid integer, received: ${charEnd}.`,
      errorCode: "INVALID_CHAR_END",
    };
  }

  // charStart must be non-negative
  if (charStart < 0) {
    return {
      isValid: false,
      error: `charStart must be non-negative (>= 0), received: ${charStart}.`,
      errorCode: "NEGATIVE_CHAR_START",
    };
  }

  // charEnd must be strictly greater than charStart (end-exclusive slice)
  if (charEnd <= charStart) {
    return {
      isValid: false,
      error: `charEnd (${charEnd}) must be strictly greater than charStart (${charStart}) under end-exclusive slicing.`,
      errorCode: "INVALID_OFFSET_RANGE",
    };
  }

  // charEnd must not exceed extractedText length
  if (charEnd > extractedText.length) {
    return {
      isValid: false,
      error: `charEnd (${charEnd}) exceeds extractedText length (${extractedText.length}).`,
      errorCode: "OFFSET_OUT_OF_BOUNDS",
    };
  }

  if (typeof snippet !== "string" || snippet.trim().length === 0) {
    return {
      isValid: false,
      error: "Evidence snippet must be a non-empty string.",
      errorCode: "INVALID_SNIPPET",
    };
  }

  // Sliced text comparison using end-exclusive range: extractedText.slice(charStart, charEnd)
  const slicedText = extractedText.slice(charStart, charEnd);

  const isExactMatch = slicedText === snippet;
  const isNormalizedMatch =
    !isExactMatch &&
    normalizeExtractedText(slicedText) === normalizeExtractedText(snippet);

  if (!isExactMatch && !isNormalizedMatch) {
    return {
      isValid: false,
      error: `Evidence snippet does not match extractedText at slice [${charStart}, ${charEnd}).`,
      errorCode: "SNIPPET_MISMATCH",
    };
  }

  return { isValid: true, error: null, errorCode: null };
}

/**
 * Asserts that evidence offsets are valid against extractedText, throwing EvidenceValidationError on failure.
 *
 * @param {object} evidence - Evidence item.
 * @param {string} extractedText - Original extracted text.
 * @returns {object} Validation result.
 */
export function assertValidEvidenceOffsets(evidence, extractedText) {
  const result = validateEvidenceOffsets(evidence, extractedText);
  if (!result.isValid) {
    throw new EvidenceValidationError(result.error, result.errorCode);
  }
  return result;
}

/**
 * Validates all indicators and evidence items in an analysisResult against the assignment's extractedText.
 *
 * @param {object} analysisResult - Analysis result subdocument.
 * @param {string} extractedText - Original extracted text.
 * @returns {{ isValid: boolean, error: string | null, errorCode: string | null }} Validation result.
 */
export function validateAnalysisResultEvidence(analysisResult, extractedText) {
  if (!analysisResult || typeof analysisResult !== "object") {
    return { isValid: true, error: null, errorCode: null };
  }

  if (!Array.isArray(analysisResult.indicators)) {
    return { isValid: true, error: null, errorCode: null };
  }

  for (let indIdx = 0; indIdx < analysisResult.indicators.length; indIdx++) {
    const indicator = analysisResult.indicators[indIdx];
    if (Array.isArray(indicator?.evidence)) {
      for (let evIdx = 0; evIdx < indicator.evidence.length; evIdx++) {
        const ev = indicator.evidence[evIdx];
        const res = validateEvidenceOffsets(ev, extractedText);
        if (!res.isValid) {
          return {
            isValid: false,
            indicatorIndex: indIdx,
            evidenceIndex: evIdx,
            indicatorCode: indicator.code,
            error: `Indicator [${indicator.code}] evidence #${evIdx}: ${res.error}`,
            errorCode: res.errorCode,
          };
        }
      }
    }
  }

  return { isValid: true, error: null, errorCode: null };
}
