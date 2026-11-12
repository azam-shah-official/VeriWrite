/**
 * VeriWrite - UTF-16 Offset-Preserving Sentence Segmenter
 *
 * Scans raw extracted text and splits it into sentences while preserving exact
 * start and end-exclusive UTF-16 code-unit offsets.
 *
 * Suppresses false terminal splits on:
 * - Abbreviations (Dr., Mr., Ms., Prof., e.g., i.e., et al., vs., etc., Fig.)
 * - Single-letter initials (e.g. J. K. Rowling, C. S. Lewis)
 * - Numeric decimals (e.g. $12.50, 3.1415)
 * - Trailing punctuation, parentheses, brackets, and quotation marks
 *
 * Invariant: For every sentence s:
 *   extractedText.slice(s.charStart, s.charEnd) === s.text
 */

const KNOWN_ABBREVIATIONS = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "e.g",
  "i.e",
  "et al",
  "vs",
  "etc",
  "fig",
  "vol",
  "no",
  "dept",
  "univ",
  "st",
  "rev",
  "gen",
  "gov",
  "jr",
  "sr",
]);

/**
 * Checks if the token immediately preceding a period is an abbreviation or initial.
 *
 * @param {string} text - Full text.
 * @param {number} periodIndex - Index of the period in text.
 * @param {number} sentenceStart - Start index of current sentence candidate.
 * @returns {boolean} True if the period is part of an abbreviation or initial.
 */
function isAbbreviationOrInitial(text, periodIndex, sentenceStart) {
  // 1. Look back for the word preceding the period
  let wordStart = periodIndex - 1;
  while (wordStart >= sentenceStart && /[a-zA-Z0-9_.]/.test(text[wordStart])) {
    wordStart--;
  }
  wordStart++; // First char of the preceding word token

  const word = text.slice(wordStart, periodIndex).toLowerCase();

  // Single-letter initial check: e.g. "J." in "J. K. Rowling" or "C." in "C. S. Lewis"
  if (/^[a-z]$/i.test(word)) {
    return true;
  }

  // Multi-period Latin abbreviations (e.g., "e.g", "i.e")
  if (KNOWN_ABBREVIATIONS.has(word)) {
    return true;
  }

  // Look back further if this is the second period of an abbreviation like "e.g."
  if (wordStart > sentenceStart && text[wordStart - 1] === " ") {
    let prevWordStart = wordStart - 2;
    while (
      prevWordStart >= sentenceStart &&
      /[a-zA-Z0-9_.]/.test(text[prevWordStart])
    ) {
      prevWordStart--;
    }
    prevWordStart++;
    const multiToken = text.slice(prevWordStart, periodIndex).toLowerCase();
    if (KNOWN_ABBREVIATIONS.has(multiToken)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a period is part of a decimal number (e.g. 12.50 or 3.14).
 *
 * @param {string} text - Full text.
 * @param {number} periodIndex - Index of the period.
 * @returns {boolean} True if period is between digits.
 */
function isDecimalNumber(text, periodIndex) {
  const prevChar = periodIndex > 0 ? text[periodIndex - 1] : "";
  const nextChar =
    periodIndex + 1 < text.length ? text[periodIndex + 1] : "";
  return /\d/.test(prevChar) && /\d/.test(nextChar);
}

/**
 * Segments extracted text into sentences with precise UTF-16 code-unit offsets.
 *
 * @param {string} extractedText - Original extracted text.
 * @returns {Array<object>} Array of sentence objects:
 *   { sentenceIndex, paragraphIndex, charStart, charEnd, text, wordCount }
 */
export function segmentSentences(extractedText) {
  if (typeof extractedText !== "string" || extractedText.trim().length === 0) {
    return [];
  }

  const sentences = [];
  const textLength = extractedText.length;

  let currentStart = -1;
  let paragraphIndex = 0;
  let sentenceIndex = 0;
  let i = 0;

  // Track double-newline paragraph breaks
  const paragraphBreaks = [];
  const paraRegex = /\n\s*\n/g;
  let match;
  while ((match = paraRegex.exec(extractedText)) !== null) {
    paragraphBreaks.push({ start: match.index, end: match.index + match[0].length });
  }

  const getParagraphIndexAt = (offset) => {
    let pIdx = 0;
    for (const b of paragraphBreaks) {
      if (offset >= b.end) {
        pIdx++;
      } else {
        break;
      }
    }
    return pIdx;
  };

  while (i < textLength) {
    // Skip leading whitespace when not currently inside a sentence
    if (currentStart === -1) {
      if (/\s/.test(extractedText[i])) {
        i++;
        continue;
      }
      currentStart = i;
    }

    const char = extractedText[i];

    // Check for potential terminal punctuation: '.', '!', '?'
    if (char === "." || char === "!" || char === "?") {
      // Check for decimal numbers: e.g. $12.50
      if (char === "." && isDecimalNumber(extractedText, i)) {
        i++;
        continue;
      }

      // Check for abbreviations & initials: e.g. Dr., e.g., J. K.
      if (char === "." && isAbbreviationOrInitial(extractedText, i, currentStart)) {
        i++;
        continue;
      }

      // Consume repeated punctuation: e.g. "...", "?!", "???"
      let endPunct = i;
      while (
        endPunct + 1 < textLength &&
        (extractedText[endPunct + 1] === "." ||
          extractedText[endPunct + 1] === "!" ||
          extractedText[endPunct + 1] === "?")
      ) {
        endPunct++;
      }

      // Consume closing quotation marks, parentheses, or brackets
      let endOffset = endPunct + 1;
      while (
        endOffset < textLength &&
        /['"”’\)\]}]/.test(extractedText[endOffset])
      ) {
        endOffset++;
      }

      // Check next non-whitespace character
      let nextNonWs = endOffset;
      while (nextNonWs < textLength && /\s/.test(extractedText[nextNonWs])) {
        nextNonWs++;
      }
      const isEndOfString = nextNonWs >= textLength;
      const nextChar = !isEndOfString ? extractedText[nextNonWs] : "";

      // If punctuation was an ellipsis ("...") and followed by a lowercase letter,
      // it is a mid-sentence suspension/pause, not a sentence boundary
      const punctSpan = extractedText.slice(i, endPunct + 1);
      const isEllipsis = punctSpan.length >= 2 && punctSpan.includes(".");
      if (isEllipsis && /[a-z]/.test(nextChar)) {
        i = endOffset;
        continue;
      }

      // Boundary condition: must be followed by whitespace, newline, or end of string
      const isFollowedByWhitespace =
        endOffset < textLength && /\s/.test(extractedText[endOffset]);

      if (isEndOfString || isFollowedByWhitespace) {
        const sentenceText = extractedText.slice(currentStart, endOffset);
        const words =
          sentenceText.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];

        sentences.push({
          sentenceIndex,
          paragraphIndex: getParagraphIndexAt(currentStart),
          charStart: currentStart,
          charEnd: endOffset,
          text: sentenceText,
          wordCount: words.length,
        });

        sentenceIndex++;
        currentStart = -1;
        i = endOffset;
        continue;
      }
    }

    i++;
  }

  // If text remains after the last punctuation without trailing terminal mark
  if (currentStart !== -1 && currentStart < textLength) {
    // Trim trailing whitespace while keeping exact end offset
    let endOffset = textLength;
    while (endOffset > currentStart && /\s/.test(extractedText[endOffset - 1])) {
      endOffset--;
    }

    if (endOffset > currentStart) {
      const sentenceText = extractedText.slice(currentStart, endOffset);
      const words =
        sentenceText.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];

      sentences.push({
        sentenceIndex,
        paragraphIndex: getParagraphIndexAt(currentStart),
        charStart: currentStart,
        charEnd: endOffset,
        text: sentenceText,
        wordCount: words.length,
      });
    }
  }

  return sentences;
}
