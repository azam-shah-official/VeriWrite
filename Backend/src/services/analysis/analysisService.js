/**
 * VeriWrite - AI Writing Analysis Orchestrator Service
 *
 * Coordinates:
 * - Text validation and minimum-text policy enforcement.
 * - UTF-16 offset-preserving sentence segmentation.
 * - Stylometric heuristic calculations (sentence variation, MATTR, transitions, starters, phrases).
 * - Printable character ratio quality check.
 * - Indicator and evidence generation.
 * - Conservative measurement-quality confidence scoring.
 * - Overall signal level assignment and educational limitations.
 */

import { segmentSentences } from "./sentenceSegmenter.js";
import {
  calculatePrintableRatio,
  calculateSentenceLengthVariation,
  calculateMATTR,
  calculateTransitionDensity,
  detectRepetitiveStarters,
  findFormulaicPhrases,
} from "./stylometricAnalyzer.js";
import { buildIndicators } from "./indicatorBuilder.js";

const ENGINE_VERSION = "1.0.0-stylometrics";

export class AnalysisServiceError extends Error {
  constructor(message, code = "ANALYSIS_ERROR") {
    super(message);
    this.name = "AnalysisServiceError";
    this.code = code;
  }
}

/**
 * Executes the complete stylometric analysis pipeline on extracted text.
 *
 * @param {string} extractedText - Original unmutated extracted text.
 * @param {number} [currentRunCount=0] - Existing run count for the assignment.
 * @returns {object} Finalized analysisResult subdocument.
 */
export function runAnalysisPipeline(extractedText, currentRunCount = 0) {
  const startTime = Date.now();

  if (typeof extractedText !== "string" || extractedText.trim().length === 0) {
    throw new AnalysisServiceError(
      "Cannot analyze empty or whitespace-only text.",
      "EMPTY_TEXT"
    );
  }

  // 1. Unicode-aware word tokenization
  const words =
    extractedText.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
  const wordCount = words.length;

  // 2. Minimum Text Policy Enforcement
  if (wordCount < 100) {
    throw new AnalysisServiceError(
      `Assignment text is insufficient for stylometric analysis (found ${wordCount} words; minimum 100 words required).`,
      "INSUFFICIENT_TEXT_FOR_ANALYSIS"
    );
  }

  const is100To149Words = wordCount >= 100 && wordCount < 150;

  // 3. Sentence segmentation with UTF-16 offsets
  const sentences = segmentSentences(extractedText);

  // 4. Stylometric Measurements
  const printableRatio = calculatePrintableRatio(extractedText);
  const sentenceMetrics = calculateSentenceLengthVariation(sentences);

  const lowerTokens = words.map((w) => w.toLowerCase());
  const mattr = calculateMATTR(lowerTokens, 50);

  const transitionData = calculateTransitionDensity(sentences);
  const starterPatterns = detectRepetitiveStarters(sentences);
  const formulaicMatches = findFormulaicPhrases(extractedText);

  // Paragraph counting
  const paragraphs = extractedText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const totalParagraphs = paragraphs.length;

  // 5. Indicator Generation
  const indicators = buildIndicators(
    {
      extractedText,
      sentences,
      wordCount,
      sentenceMetrics,
      mattr,
      transitionData,
      starterPatterns,
      formulaicMatches,
    },
    { isAdvisoryOnly: is100To149Words }
  );

  // 6. Signal Level Determination
  let signalLevel = "Inconclusive";
  if (is100To149Words) {
    signalLevel = "Inconclusive";
  } else {
    const highSeverityCount = indicators.filter(
      (ind) => ind.severity === "High"
    ).length;
    const totalIndicatorCount = indicators.length;

    if (highSeverityCount >= 2 || totalIndicatorCount >= 3) {
      signalLevel = "High Uniformity";
    } else if (totalIndicatorCount >= 1) {
      signalLevel = "Moderate Uniformity";
    } else {
      signalLevel = "Natural Variation";
    }
  }

  // 7. Measurement-Quality Confidence Scoring
  // High confidence is disabled in MVP until empirical academic dataset calibration
  let analysisConfidence = "Low";
  if (!is100To149Words) {
    const hasAdequateLength = wordCount >= 200 && sentences.length >= 12;
    const hasCleanProse = printableRatio >= 0.95;
    const hasStableMATTR = typeof mattr === "number" && lowerTokens.length >= 200;

    if (hasAdequateLength && hasCleanProse && hasStableMATTR) {
      analysisConfidence = "Medium";
    } else {
      analysisConfidence = "Low";
    }
  }

  // 8. Limitations Compilation
  const limitations = [
    "Stylometric indicators are probabilistic heuristics and do not constitute proof of AI generation.",
    "Non-native English (ESL) and technical academic writing naturally exhibit elevated cadence uniformity and constrained vocabulary.",
    "Teacher contextual review is required before drawing academic conclusions.",
  ];

  if (is100To149Words) {
    limitations.unshift(
      "This submission contains 100–149 words. Stylometric indicators are advisory only and statistically inconclusive on short text samples."
    );
  }

  if (mattr === null) {
    limitations.push(
      "Lexical diversity (MATTR) requires at least 50 word tokens; sample size was insufficient to calculate 50-word moving-average type-token ratio."
    );
  }

  if (printableRatio < 0.95) {
    limitations.push(
      `Text contains an elevated proportion of unrecognized or control characters (printable ratio: ${printableRatio.toFixed(2)}), which may affect tokenization accuracy.`
    );
  }

  const executionTimeMs = Date.now() - startTime;

  // 9. Assembled analysisResult subdocument
  return {
    engineVersion: ENGINE_VERSION,
    analyzedAt: new Date(),
    executionTimeMs,
    signalLevel,
    analysisConfidence,
    metrics: {
      burstinessScore: sentenceMetrics.cv, // Unclamped mathematical CV
      lexicalDiversity: typeof mattr === "number" ? mattr : 0,
      sentenceLengthVariance: sentenceMetrics.variance,
      transitionDensityScore: transitionData.score,
      totalSentencesAnalyzed: sentences.length,
      totalParagraphsAnalyzed: totalParagraphs,
    },
    indicators,
    limitations,
    runCount: currentRunCount + 1,
  };
}
