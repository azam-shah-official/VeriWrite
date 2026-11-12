/**
 * VeriWrite - Stylometric Heuristics Analyzer
 *
 * Implements deterministic stylometric measurements:
 * 1. Sentence length variance and Coefficient of Variation (Burstiness Score).
 * 2. Moving-Average Type-Token Ratio (MATTR) with standardized 50-token sliding window.
 * 3. Transition sentence density (proportion of sentences containing formal transitions).
 * 4. Exact first-two-token repetitive sentence openers.
 * 5. Formulaic academic stock phrase matching.
 * 6. Unicode printable character ratio.
 *
 * NOTE: All measurements are exploratory stylometric heuristics and do NOT
 * constitute proof or probability of AI authorship.
 */

// Curated dictionary of academic discourse markers and transitional connectives
export const TRANSITION_PHRASES = [
  "furthermore",
  "moreover",
  "additionally",
  "in addition",
  "consequently",
  "as a result",
  "therefore",
  "thus",
  "hence",
  "accordingly",
  "on the other hand",
  "in contrast",
  "conversely",
  "nevertheless",
  "nonetheless",
  "however",
  "in conclusion",
  "in summary",
  "to summarize",
  "ultimately",
  "specifically",
  "for instance",
  "for example",
  "in particular",
  "notably",
  "significantly",
  "importantly",
  "it is important to note",
  "first and foremost",
  "in terms of",
  "subsequently",
];

// Curated dictionary of formulaic multi-word stock phrases common in template-based writing
export const FORMULAIC_PHRASES = [
  "in today's fast-paced world",
  "delve into the intricacies",
  "delve into the multifaceted",
  "a testament to the",
  "plays a pivotal role",
  "plays an indispensable role",
  "plays a crucial role",
  "plays a vital role",
  "shed light on the",
  "navigating the complexities",
  "it is important to note that",
  "it is worth noting that",
  "in the grand tapestry",
  "beacon of hope",
  "game-changer",
  "paradigmatic shift",
  "tapestry of",
];

/**
 * Calculates Unicode printable character ratio in consistent UTF-16 code units.
 * Numerator: UTF-16 code units matching Letters, Combining Marks, Numbers,
 * Punctuation, Spaces, Symbols, and whitespace (\n, \r, \t), explicitly excluding \uFFFD.
 * Denominator: Total UTF-16 code units (text.length).
 *
 * @param {string} text - Raw extracted text.
 * @returns {number} Ratio bounded in [0.0, 1.0].
 */
export function calculatePrintableRatio(text) {
  if (typeof text !== "string" || text.length === 0) {
    return 0;
  }

  // Regex matches valid printable characters:
  // \p{L}: Letters
  // \p{M}: Combining Marks (harakat, matras, accents)
  // \p{N}: Numbers
  // \p{P}: Punctuation
  // \p{Z}: Spaces/separators
  // \p{S}: Symbols (currency, math, emojis)
  // \n, \r, \t: Valid formatting whitespace
  // (?![\uFFFD]): Excludes Unicode replacement character
  const regex = /(?![\uFFFD])[\p{L}\p{M}\p{N}\p{P}\p{Z}\p{S}\n\r\t]/gu;
  const matches = text.match(regex);

  if (!matches) {
    return 0;
  }

  let validCodeUnits = 0;
  for (const m of matches) {
    validCodeUnits += m.length;
  }

  return validCodeUnits / text.length;
}

/**
 * Calculates sentence length mean, sample variance, standard deviation,
 * and unclamped Coefficient of Variation (CV).
 *
 * Formula:
 *   mean = (1 / n) * sum(w_i)
 *   variance = (1 / (n - 1)) * sum((w_i - mean)^2)
 *   stdDev = sqrt(variance)
 *   CV = stdDev / mean
 *
 * @param {Array<object>} sentences - Array of segmented sentence objects with wordCount.
 * @returns {{ mean: number, variance: number, stdDev: number, cv: number }}
 */
export function calculateSentenceLengthVariation(sentences) {
  if (!Array.isArray(sentences) || sentences.length === 0) {
    return { mean: 0, variance: 0, stdDev: 0, cv: 0 };
  }

  const wordCounts = sentences.map((s) => s.wordCount || 0);
  const n = wordCounts.length;

  if (n === 1) {
    return { mean: wordCounts[0], variance: 0, stdDev: 0, cv: 0 };
  }

  const sum = wordCounts.reduce((acc, c) => acc + c, 0);
  const mean = sum / n;

  if (mean === 0) {
    return { mean: 0, variance: 0, stdDev: 0, cv: 0 };
  }

  const sumSquaredDiffs = wordCounts.reduce(
    (acc, c) => acc + Math.pow(c - mean, 2),
    0
  );
  const variance = sumSquaredDiffs / (n - 1);
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // Unclamped true mathematical CV

  return {
    mean: Number(mean.toFixed(2)),
    variance: Number(variance.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    cv: Number(cv.toFixed(3)),
  };
}

/**
 * Calculates Moving-Average Type-Token Ratio (MATTR) using overlapping 50-token windows.
 *
 * Formula:
 *   For tokens T = [t_1, ..., t_N], with window W = 50:
 *   If N < 50, MATTR cannot be computed and returns null (does not substitute simple TTR).
 *   If N >= 50, K = N - 49.
 *   MATTR = (1 / K) * sum_{i=1}^K (|unique(W_i)| / 50)
 *
 * @param {Array<string>} tokens - Array of lowercased word tokens.
 * @param {number} [windowSize=50] - Standard sliding window size.
 * @returns {number|null} MATTR bounded in [0.02, 1.0], or null if tokens < windowSize.
 */
export function calculateMATTR(tokens, windowSize = 50) {
  if (!Array.isArray(tokens) || tokens.length < windowSize) {
    return null;
  }

  const N = tokens.length;
  const K = N - windowSize + 1;
  let totalTTR = 0;

  for (let i = 0; i < K; i++) {
    const windowSlice = tokens.slice(i, i + windowSize);
    const uniqueTypes = new Set(windowSlice).size;
    totalTTR += uniqueTypes / windowSize;
  }

  const mattr = totalTTR / K;
  return Number(mattr.toFixed(3));
}

/**
 * Calculates the proportion of sentences containing at least one transition marker.
 * Multiple transition markers within a single sentence are counted only once toward M.
 *
 * Formula:
 *   Density = M / totalSentences
 *   where M is the count of sentences with >= 1 transition phrase.
 *
 * @param {Array<object>} sentences - Array of sentence objects with text property.
 * @param {Array<string>} [dictionary=TRANSITION_PHRASES] - Transition phrases list.
 * @returns {{ score: number, matchingSentences: Array<object> }}
 */
export function calculateTransitionDensity(
  sentences,
  dictionary = TRANSITION_PHRASES
) {
  if (!Array.isArray(sentences) || sentences.length === 0) {
    return { score: 0, matchingSentences: [] };
  }

  const regexList = dictionary.map((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      phrase,
      regex: new RegExp(`\\b${escaped}\\b`, "i"),
    };
  });

  const matchingSentences = [];

  for (const sentence of sentences) {
    const text = sentence.text || "";
    const matchedPhrases = [];

    for (const item of regexList) {
      if (item.regex.test(text)) {
        matchedPhrases.push(item.phrase);
      }
    }

    if (matchedPhrases.length > 0) {
      matchingSentences.push({
        sentence,
        matchedPhrases,
      });
    }
  }

  const M = matchingSentences.length; // Count of sentences with >= 1 transition
  const score = Number((M / sentences.length).toFixed(3));

  return { score, matchingSentences };
}

/**
 * Detects exact first-two-token repetitive sentence openers.
 *
 * Rules:
 * - Extracts first two lowercased alphanumeric word tokens from each sentence.
 * - Detects contiguous clusters of >= 3 consecutive sentences with identical bigram.
 * - Detects any single bigram opening >= 25% of all sentences (minimum 8 sentences).
 *
 * @param {Array<object>} sentences - Array of sentence objects.
 * @returns {Array<object>} Detected repetitive starter patterns.
 */
export function detectRepetitiveStarters(sentences) {
  if (!Array.isArray(sentences) || sentences.length < 3) {
    return [];
  }

  const sentenceStarters = sentences.map((s) => {
    const words =
      (s.text || "").match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
    const bigram =
      words.length >= 2
        ? `${words[0].toLowerCase()} ${words[1].toLowerCase()}`
        : null;
    return { sentence: s, bigram };
  });

  const patterns = [];

  // 1. Detect contiguous runs of >= 3 identical bigrams
  let currentRun = [];
  for (let i = 0; i < sentenceStarters.length; i++) {
    const item = sentenceStarters[i];
    if (!item.bigram) {
      if (currentRun.length >= 3) {
        patterns.push({
          type: "CONTIGUOUS_RUN",
          bigram: currentRun[0].bigram,
          sentences: currentRun.map((r) => r.sentence),
        });
      }
      currentRun = [];
      continue;
    }

    if (
      currentRun.length === 0 ||
      currentRun[currentRun.length - 1].bigram === item.bigram
    ) {
      currentRun.push(item);
    } else {
      if (currentRun.length >= 3) {
        patterns.push({
          type: "CONTIGUOUS_RUN",
          bigram: currentRun[0].bigram,
          sentences: currentRun.map((r) => r.sentence),
        });
      }
      currentRun = [item];
    }
  }

  if (currentRun.length >= 3) {
    patterns.push({
      type: "CONTIGUOUS_RUN",
      bigram: currentRun[0].bigram,
      sentences: currentRun.map((r) => r.sentence),
    });
  }

  // 2. Detect high document-wide frequency (>= 25% of sentences, min 8 sentences)
  if (sentences.length >= 8) {
    const frequencyMap = new Map();
    for (const item of sentenceStarters) {
      if (!item.bigram) continue;
      const list = frequencyMap.get(item.bigram) || [];
      list.push(item.sentence);
      frequencyMap.set(item.bigram, list);
    }

    for (const [bigram, matchedSentences] of frequencyMap.entries()) {
      const ratio = matchedSentences.length / sentences.length;
      if (ratio >= 0.25) {
        // Avoid duplicate reporting if already covered by contiguous run
        const alreadyCovered = patterns.some((p) => p.bigram === bigram);
        if (!alreadyCovered) {
          patterns.push({
            type: "HIGH_FREQUENCY",
            bigram,
            sentences: matchedSentences,
            frequencyRatio: Number(ratio.toFixed(2)),
          });
        }
      }
    }
  }

  return patterns;
}

/**
 * Matches formulaic stock academic phrases in extractedText.
 *
 * Rules:
 * - Case-insensitive with word boundaries (\b).
 * - Overlap resolution: If matching spans overlap, retains the longer match.
 * - Counts distinct non-overlapping occurrences across the document.
 *
 * @param {string} extractedText - Original extracted text.
 * @param {Array<string>} [dictionary=FORMULAIC_PHRASES] - Phrase list.
 * @returns {Array<object>} Non-overlapping matches: { phrase, charStart, charEnd }
 */
export function findFormulaicPhrases(
  extractedText,
  dictionary = FORMULAIC_PHRASES
) {
  if (typeof extractedText !== "string" || extractedText.length === 0) {
    return [];
  }

  const rawMatches = [];

  for (const phrase of dictionary) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let match;
    while ((match = regex.exec(extractedText)) !== null) {
      rawMatches.push({
        phrase: match[0],
        charStart: match.index,
        charEnd: match.index + match[0].length,
      });
    }
  }

  if (rawMatches.length === 0) {
    return [];
  }

  // Sort matches by start index, then by descending length to prefer longer phrases on overlap
  rawMatches.sort((a, b) => {
    if (a.charStart !== b.charStart) return a.charStart - b.charStart;
    return b.charEnd - a.charEnd;
  });

  // Filter overlapping matches
  const nonOverlapping = [];
  let lastEnd = -1;

  for (const m of rawMatches) {
    if (m.charStart >= lastEnd) {
      nonOverlapping.push(m);
      lastEnd = m.charEnd;
    }
  }

  return nonOverlapping;
}
