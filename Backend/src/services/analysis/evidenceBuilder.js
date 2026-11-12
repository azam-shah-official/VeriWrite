/**
 * VeriWrite - Authentic Evidence Span Builder
 *
 * Constructs schema-compliant evidence objects from original extracted text.
 *
 * Invariants:
 * 1. Exact slice equality: extractedText.slice(charStart, charEnd) === snippet
 * 2. Snippet length is strictly <= 1000 characters (targets <= 950 chars).
 * 3. Never splits UTF-16 surrogate pairs.
 * 4. Offsets are strictly validated with validateEvidenceOffsets.
 */

import { validateEvidenceOffsets } from "../../utils/textValidator.js";

const MAX_SNIPPET_LENGTH = 950;

/**
 * Safely bounds an evidence span to ensure snippet length <= 950 characters
 * without splitting UTF-16 surrogate pairs or producing snippet-offset mismatches.
 *
 * @param {string} extractedText - Full extracted text.
 * @param {number} charStart - Proposed start offset.
 * @param {number} charEnd - Proposed end-exclusive offset.
 * @returns {{ charStart: number, charEnd: number, isTruncated: boolean }}
 */
export function clampEvidenceSpan(extractedText, charStart, charEnd) {
  if (charEnd - charStart <= MAX_SNIPPET_LENGTH) {
    return { charStart, charEnd, isTruncated: false };
  }

  const maxEnd = charStart + MAX_SNIPPET_LENGTH;
  const sliceToCheck = extractedText.slice(charStart, maxEnd);

  // Look for the last sentence or clause punctuation within the 950-character window
  let cutOffset = -1;
  const punctMatches = [...sliceToCheck.matchAll(/[.;,!?]/g)];
  if (punctMatches.length > 0) {
    const lastPunct = punctMatches[punctMatches.length - 1];
    if (lastPunct.index > 50) {
      cutOffset = lastPunct.index + 1; // Include punctuation mark
    }
  }

  // Fallback to last whitespace boundary if no punctuation found
  if (cutOffset === -1) {
    const lastSpace = sliceToCheck.lastIndexOf(" ");
    if (lastSpace > 50) {
      cutOffset = lastSpace;
    }
  }

  // Hard fallback: cut at 950, checking for surrogate pairs
  if (cutOffset === -1) {
    cutOffset = MAX_SNIPPET_LENGTH;
  }

  let finalEnd = charStart + cutOffset;

  // Protect against splitting UTF-16 surrogate pairs:
  // If the character immediately before cut is a high surrogate (0xD800 - 0xDBFF),
  // drop it so we don't produce an invalid half-pair.
  if (finalEnd > charStart && finalEnd < extractedText.length) {
    const code = extractedText.charCodeAt(finalEnd - 1);
    if (code >= 0xd800 && code <= 0xdbff) {
      finalEnd--; // Back off by 1 code unit
    }
  }

  return { charStart, charEnd: finalEnd, isTruncated: true };
}

/**
 * Builds and validates an evidence item against the assignment's extracted text.
 *
 * @param {string} extractedText - Original extracted text.
 * @param {object} params - Evidence parameters.
 * @returns {object} Validated evidence item { snippet, paragraphIndex, sentenceIndex, charStart, charEnd, flagReason }
 */
export function buildEvidenceItem(extractedText, params) {
  const {
    charStart,
    charEnd,
    paragraphIndex = 0,
    sentenceIndex = null,
    flagReason = "Stylometric pattern identified.",
  } = params;

  // Document-level unanchored evidence (null offsets)
  if (charStart === null && charEnd === null) {
    const snippetText =
      typeof params.snippet === "string" && params.snippet.trim().length > 0
        ? params.snippet.slice(0, MAX_SNIPPET_LENGTH)
        : "Document-level stylometric pattern identified.";

    const docEvidence = {
      snippet: snippetText,
      paragraphIndex,
      sentenceIndex: null,
      charStart: null,
      charEnd: null,
      flagReason,
    };

    const validation = validateEvidenceOffsets(docEvidence, extractedText);
    if (!validation.isValid) {
      throw new Error(`Failed to build document-level evidence: ${validation.error}`);
    }
    return docEvidence;
  }

  // Clamping for anchored evidence
  const { charStart: safeStart, charEnd: safeEnd, isTruncated } = clampEvidenceSpan(
    extractedText,
    charStart,
    charEnd
  );

  const snippet = extractedText.slice(safeStart, safeEnd);
  if (!snippet || snippet.trim().length === 0) {
    throw new Error(
      `Cannot generate empty evidence snippet at offsets [${safeStart}, ${safeEnd})`
    );
  }

  const finalFlagReason = isTruncated
    ? `${flagReason} (Excerpt bounded at clause boundary for display)`
    : flagReason;

  const evidenceItem = {
    snippet,
    paragraphIndex,
    sentenceIndex: typeof sentenceIndex === "number" ? sentenceIndex : null,
    charStart: safeStart,
    charEnd: safeEnd,
    flagReason: finalFlagReason.slice(0, 500),
  };

  const validation = validateEvidenceOffsets(evidenceItem, extractedText);
  if (!validation.isValid) {
    throw new Error(`Evidence validation failed: ${validation.error}`);
  }

  return evidenceItem;
}
