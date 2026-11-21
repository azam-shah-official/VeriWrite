/**
 * VeriWrite - Evidence Extraction & Traceability Mapper
 *
 * Extracts, indexes, and validates evidence from Feature 1 stylometric analysis results.
 * Connects supported findings to their corresponding evidence records with stable identifiers,
 * preserving exact original text passages, offsets, paragraph/sentence coordinates, and explanations.
 *
 * Guarantees:
 * 1. Exact slice verification: verifies extractedText.slice(charStart, charEnd) === snippet.
 * 2. Safe error tolerance: gracefully tags invalid or out-of-range offsets without throwing or corrupting valid findings.
 * 3. Deduplication: skips duplicate evidence records within the same indicator.
 * 4. Zero invention: never synthesizes or fabricates evidence, scores, confidence values, or reasons.
 * 5. Full backward compatibility with existing saved analysis results.
 */

import { normalizeExtractedText } from "../../utils/textValidator.js";

/**
 * Generates clear, student-friendly pedagogical guidance for a stylometric finding.
 *
 * Requirements:
 * - Understandable language without statistical jargon overload.
 * - Explain why the evidence was flagged based on empirical data.
 * - Practical writing improvement suggestions.
 * - Never claims AI generation with certainty; frames signals objectively as stylometric patterns.
 *
 * @param {string} indicatorCode - Stylometric indicator code.
 * @param {string} flagReason - Technical reason recorded for this evidence item.
 * @returns {object} Pedagogical explanation object.
 */
export function getPedagogicalExplanation(indicatorCode, flagReason = "") {
  switch (indicatorCode) {
    case "UNIFORM_SENTENCE_CADENCE":
      return {
        concept: "Sentence Length Variety",
        studentFriendlyMeaning:
          "Sentences in this section have very consistent lengths and pacing.",
        whyFlagged:
          flagReason ||
          "This sentence matches the document average length closely, reflecting uniform rhythmic cadence.",
        improvementTip:
          "Vary your sentence structure. Mix short, direct statements with longer compound or complex sentences to create a more dynamic, natural flow.",
        disclaimer:
          "Consistent sentence length is common in technical or expository writing and does not prove AI generation.",
      };

    case "LOW_LEXICAL_DIVERSITY":
      return {
        concept: "Vocabulary Variety",
        studentFriendlyMeaning:
          "A constrained range of vocabulary words was used across consecutive paragraphs.",
        whyFlagged:
          flagReason ||
          "Word variety across 50-word text windows falls below expected academic diversity ranges.",
        improvementTip:
          "Broaden your vocabulary with precise domain terms and synonyms. Avoid repeating the same descriptive verbs, nouns, or transitional markers in close succession.",
        disclaimer:
          "Specialized or scientific topics naturally repeat domain-specific terms. This metric is advisory and does not confirm automated drafting.",
      };

    case "ELEVATED_TRANSITION_DENSITY":
      return {
        concept: "Discourse Connectors",
        studentFriendlyMeaning:
          "A high proportion of sentences open with or include formal transitional words.",
        whyFlagged:
          flagReason ||
          "Contains formal discourse markers (such as 'Furthermore', 'Moreover', or 'In addition') that appear with high frequency.",
        improvementTip:
          "Allow ideas to connect organically through conceptual flow and sentence order rather than relying on explicit transitional connectors at every sentence start.",
        disclaimer:
          "Transitional words are standard academic tools; frequent usage reflects structured organization and does not prove artificial generation.",
      };

    case "REPETITIVE_SYNTACTIC_STARTERS":
      return {
        concept: "Sentence Openings",
        studentFriendlyMeaning:
          "Multiple sentences begin with the identical opening words or grammatical structures.",
        whyFlagged:
          flagReason ||
          "Repeated sentence opening pattern detected across consecutive sentences or frequent document occurrences.",
        improvementTip:
          "Vary how you begin your sentences. Try opening with an introductory prepositional phrase, a dependent clause, an adverb, or rearranging the subject and predicate.",
        disclaimer:
          "Repetitive openings can be an intentional rhetorical device for emphasis or parallel structure; this pattern does not prove AI generation.",
      };

    case "FORMULAIC_PHRASE_USAGE":
      return {
        concept: "Idiomatic Phrasing",
        studentFriendlyMeaning:
          "Common stock academic idioms or template essay expressions were identified.",
        whyFlagged:
          flagReason ||
          "Contains familiar stock phrases that frequently appear in generic essay templates.",
        improvementTip:
          "Replace stock idioms with direct, original phrasing. Express your specific point directly instead of using boilerplate filler expressions.",
        disclaimer:
          "Stock phrases are common idioms used by human writers; presence of clichés does not prove automated generation.",
      };

    default:
      return {
        concept: "Writing Pattern",
        studentFriendlyMeaning:
          "Stylometric pattern identified during statistical text analysis.",
        whyFlagged:
          flagReason ||
          "Empirical text measurements deviated from standard baseline ranges.",
        improvementTip:
          "Review this passage for natural phrasing, syntactic variety, and original expression.",
        disclaimer:
          "Stylometric indicators are probabilistic signals designed to support human review, not definitive proof of AI generation.",
      };
  }
}

/**
 * Partitions extracted text into paragraphs and contiguous, non-overlapping segments
 * with precise highlight coordinates for safe, faithful document rendering.
 *
 * Guarantees:
 * 1. Exact string identity: paragraph text and segment concatenation matches extractedText identically.
 * 2. Safe overlap resolution: overlapping findings are merged onto the shared character range without duplication.
 * 3. Zero unanchored bleed: unanchored/document-level evidence is excluded from text highlights.
 *
 * @param {string} extractedText - Original extracted text.
 * @param {Array<object>} findings - Array of finding objects (from extractEvidenceMap).
 * @returns {Array<object>} Array of paragraph objects with segmented text.
 */
export function partitionTextIntoParagraphsAndSegments(extractedText = "", findings = []) {
  if (typeof extractedText !== "string" || extractedText.length === 0) {
    return [];
  }

  // Filter valid anchored findings
  const validFindings = findings.filter(
    (f) =>
      f &&
      f.isAnchored &&
      (f.status === "VALID" || f.status === "SNIPPET_MATCH" || f.isExactMatch || f.sliceMatch) &&
      typeof f.charStart === "number" &&
      typeof f.charEnd === "number" &&
      f.charEnd > f.charStart &&
      f.charStart >= 0 &&
      f.charEnd <= extractedText.length
  );

  // Find all double newline paragraph breaks (\n\s*\n)
  const paraRegex = /\n\s*\n/g;
  const breaks = [];
  let match;
  while ((match = paraRegex.exec(extractedText)) !== null) {
    breaks.push({ start: match.index, end: match.index + match[0].length });
  }

  // Define paragraph slice boundaries
  const paragraphRanges = [];
  let currentStart = 0;
  for (let i = 0; i < breaks.length; i++) {
    paragraphRanges.push({
      paragraphIndex: i,
      charStart: currentStart,
      charEnd: breaks[i].start,
      separator: extractedText.slice(breaks[i].start, breaks[i].end),
    });
    currentStart = breaks[i].end;
  }
  paragraphRanges.push({
    paragraphIndex: breaks.length,
    charStart: currentStart,
    charEnd: extractedText.length,
    separator: "",
  });

  // Build partitioned segments for each paragraph
  return paragraphRanges.map((para) => {
    const { paragraphIndex, charStart: pStart, charEnd: pEnd, separator } = para;
    const paraText = extractedText.slice(pStart, pEnd);

    if (pEnd <= pStart) {
      return {
        paragraphIndex,
        charStart: pStart,
        charEnd: pEnd,
        text: paraText,
        separator,
        hasHighlights: false,
        segments: [],
      };
    }

    // Collect all unique boundary points within [pStart, pEnd]
    const boundarySet = new Set([pStart, pEnd]);
    for (const f of validFindings) {
      if (f.charStart > pStart && f.charStart < pEnd) {
        boundarySet.add(f.charStart);
      }
      if (f.charEnd > pStart && f.charEnd < pEnd) {
        boundarySet.add(f.charEnd);
      }
    }

    const sortedBounds = Array.from(boundarySet).sort((a, b) => a - b);
    const segments = [];
    let hasHighlights = false;

    for (let sIdx = 0; sIdx < sortedBounds.length - 1; sIdx++) {
      const segStart = sortedBounds[sIdx];
      const segEnd = sortedBounds[sIdx + 1];
      const segText = extractedText.slice(segStart, segEnd);

      const coveringFindings = validFindings.filter(
        (f) => f.charStart <= segStart && f.charEnd >= segEnd
      );
      const isHighlighted = coveringFindings.length > 0;
      if (isHighlighted) hasHighlights = true;

      const findingIds = coveringFindings.map((f) => f.findingId);

      let severity = null;
      if (coveringFindings.some((f) => f.severity === "High")) {
        severity = "High";
      } else if (coveringFindings.some((f) => f.severity === "Medium")) {
        severity = "Medium";
      } else if (isHighlighted) {
        severity = "Low";
      }

      segments.push({
        segmentIndex: sIdx,
        charStart: segStart,
        charEnd: segEnd,
        text: segText,
        isHighlighted,
        findingIds,
        findings: coveringFindings,
        severity,
      });
    }

    return {
      paragraphIndex,
      charStart: pStart,
      charEnd: pEnd,
      text: paraText,
      separator,
      hasHighlights,
      segments,
    };
  });
}

/**
 * Extracts a normalized, traceable evidence map from an analysis result.
 *
 * @param {object} analysisResult - Analysis result object (from Assignment document).
 * @param {string} [extractedText=""] - Original extracted text of the assignment (for slice verification).
 * @param {object} [options={}] - Options (e.g. deduplicate = true).
 * @returns {object} Structured evidence map containing findings, byIndicator, and byParagraph lookups.
 */
export function extractEvidenceMap(analysisResult, extractedText = "", options = {}) {
  const { deduplicate = true } = options;

  if (!analysisResult || typeof analysisResult !== "object") {
    return {
      totalFindings: 0,
      anchoredFindings: 0,
      documentFindings: 0,
      validFindings: 0,
      invalidFindings: 0,
      findings: [],
      byIndicator: {},
      byParagraph: {},
    };
  }

  const indicators = Array.isArray(analysisResult.indicators)
    ? analysisResult.indicators
    : [];

  const findings = [];
  const byIndicator = {};
  const byParagraph = {};
  const seenSignatures = new Set();

  const textLength = typeof extractedText === "string" ? extractedText.length : 0;

  for (let indIdx = 0; indIdx < indicators.length; indIdx++) {
    const ind = indicators[indIdx];
    if (!ind || typeof ind !== "object") continue;

    const indicatorCode = ind.code || "UNKNOWN_INDICATOR";
    const indicatorLabel = ind.label || indicatorCode;
    const severity = ind.severity || "Low";
    const indicatorExplanation = ind.explanation || "";

    if (!byIndicator[indicatorCode]) {
      byIndicator[indicatorCode] = [];
    }

    const evidenceList = Array.isArray(ind.evidence) ? ind.evidence : [];

    for (let evIdx = 0; evIdx < evidenceList.length; evIdx++) {
      const ev = evidenceList[evIdx];
      if (!ev || typeof ev !== "object") continue;

      const snippet = typeof ev.snippet === "string" ? ev.snippet : "";
      const rawStart = ev.charStart;
      const rawEnd = ev.charEnd;
      const paragraphIndex =
        typeof ev.paragraphIndex === "number" && ev.paragraphIndex >= 0
          ? ev.paragraphIndex
          : 0;
      const sentenceIndex =
        typeof ev.sentenceIndex === "number" && ev.sentenceIndex >= 0
          ? ev.sentenceIndex
          : null;
      const flagReason =
        typeof ev.flagReason === "string" && ev.flagReason.trim().length > 0
          ? ev.flagReason.trim()
          : "Stylometric pattern identified.";

      // Deduplication check
      const signature = `${indicatorCode}|${rawStart}|${rawEnd}|${snippet}|${paragraphIndex}`;
      if (deduplicate && seenSignatures.has(signature)) {
        continue;
      }
      seenSignatures.add(signature);

      // Stable finding ID
      const findingId =
        typeof ev.findingId === "string" && ev.findingId.trim().length > 0
          ? ev.findingId.trim()
          : `FND-${indicatorCode}-${evIdx + 1}`;

      // Check offset presence
      const hasStart = rawStart !== null && rawStart !== undefined;
      const hasEnd = rawEnd !== null && rawEnd !== undefined;

      let isAnchored = false;
      let status = "VALID";
      let validationError = null;
      let sliceMatch = null;
      let isExactMatch = null;
      let charStart = null;
      let charEnd = null;

      if (!hasStart && !hasEnd) {
        // Document-level unanchored evidence
        isAnchored = false;
        status = "UNANCHORED";
        sliceMatch = null;
      } else if (!hasStart || !hasEnd) {
        // Incomplete offsets
        isAnchored = false;
        status = "INCOMPLETE_OFFSETS";
        validationError = "Both charStart and charEnd must be provided together.";
      } else if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd)) {
        // Non-integer offsets
        isAnchored = false;
        status = "INVALID_OFFSETS";
        validationError = "Offsets must be valid integers.";
      } else if (rawStart < 0) {
        // Negative start
        isAnchored = false;
        status = "NEGATIVE_CHAR_START";
        validationError = `charStart must be non-negative, received: ${rawStart}.`;
      } else if (rawEnd <= rawStart) {
        // Inverted or zero-length range
        isAnchored = false;
        status = "INVALID_OFFSET_RANGE";
        validationError = `charEnd (${rawEnd}) must be strictly greater than charStart (${rawStart}).`;
      } else if (textLength > 0 && rawEnd > textLength) {
        // Out of bounds against extracted text
        isAnchored = true;
        charStart = rawStart;
        charEnd = rawEnd;
        status = "OFFSET_OUT_OF_BOUNDS";
        validationError = `charEnd (${rawEnd}) exceeds document length (${textLength}).`;
      } else {
        // Offsets are syntactically valid and in bounds
        isAnchored = true;
        charStart = rawStart;
        charEnd = rawEnd;

        if (textLength > 0) {
          const actualSlice = extractedText.slice(charStart, charEnd);
          const isExact = actualSlice === snippet;
          const isNormalized =
            !isExact &&
            normalizeExtractedText(actualSlice) === normalizeExtractedText(snippet);

          sliceMatch = isExact || isNormalized;
          isExactMatch = isExact;

          if (!sliceMatch) {
            status = "SNIPPET_MISMATCH";
            validationError = `Evidence snippet does not match document text at slice [${charStart}, ${charEnd}).`;
          } else {
            status = "VALID";
          }
        } else {
          // No extractedText supplied to verify against, mark as valid anchored
          status = "VALID";
          sliceMatch = null;
          isExactMatch = null;
        }
      }

      const explanationDetails = getPedagogicalExplanation(
        indicatorCode,
        flagReason
      );

      const finding = {
        findingId,
        indicatorCode,
        indicatorLabel,
        severity,
        indicatorExplanation,
        explanationDetails,
        snippet,
        flagReason,
        paragraphIndex,
        sentenceIndex,
        charStart,
        charEnd,
        isAnchored,
        sliceMatch,
        isExactMatch,
        status,
        validationError,
      };

      findings.push(finding);
      byIndicator[indicatorCode].push(finding);

      if (!byParagraph[paragraphIndex]) {
        byParagraph[paragraphIndex] = [];
      }
      byParagraph[paragraphIndex].push(finding);
    }
  }

  // Sort findings in document order: anchored findings sorted by charStart ascending, unanchored at end
  findings.sort((a, b) => {
    if (a.isAnchored && b.isAnchored) {
      return a.charStart - b.charStart;
    }
    if (a.isAnchored && !b.isAnchored) return -1;
    if (!a.isAnchored && b.isAnchored) return 1;
    return a.paragraphIndex - b.paragraphIndex;
  });

  const anchoredCount = findings.filter((f) => f.isAnchored).length;
  const documentCount = findings.filter((f) => !f.isAnchored).length;
  const validCount = findings.filter(
    (f) => f.status === "VALID" || f.status === "UNANCHORED"
  ).length;
  const invalidCount = findings.length - validCount;

  const paragraphSegments =
    textLength > 0
      ? partitionTextIntoParagraphsAndSegments(extractedText, findings)
      : [];

  return {
    totalFindings: findings.length,
    anchoredFindings: anchoredCount,
    documentFindings: documentCount,
    validFindings: validCount,
    invalidFindings: invalidCount,
    findings,
    byIndicator,
    byParagraph,
    paragraphSegments,
  };
}

/**
 * Retrieves a single finding by its unique findingId.
 *
 * @param {object} evidenceMap - Evidence map returned by extractEvidenceMap.
 * @param {string} findingId - Unique finding identifier (e.g. "FND-UNIFORM_SENTENCE_CADENCE-1").
 * @returns {object|null} Matching finding or null.
 */
export function getFindingById(evidenceMap, findingId) {
  if (!evidenceMap || !Array.isArray(evidenceMap.findings) || !findingId) {
    return null;
  }
  return evidenceMap.findings.find((f) => f.findingId === findingId) || null;
}

/**
 * Retrieves all findings that intersect a specific paragraph.
 *
 * @param {object} evidenceMap - Evidence map returned by extractEvidenceMap.
 * @param {number} paragraphIndex - Zero-based paragraph index.
 * @returns {Array<object>} Array of findings in the paragraph.
 */
export function getFindingsByParagraph(evidenceMap, paragraphIndex) {
  if (!evidenceMap || !evidenceMap.byParagraph || typeof paragraphIndex !== "number") {
    return [];
  }
  return evidenceMap.byParagraph[paragraphIndex] || [];
}
