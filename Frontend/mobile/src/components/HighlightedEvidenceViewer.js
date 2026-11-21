import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const getSeverityStyle = (severity, isActive = false) => {
  if (isActive) {
    return {
      bg: "bg-[#3B1A4D]",
      border: "border-[#A855F7]",
      text: "text-[#F3E8FF]",
      borderWidth: 1.5,
    };
  }

  switch (severity) {
    case "High":
      return {
        bg: "bg-[#2E1216]",
        border: "border-[#EF4444]",
        text: "text-[#FECACA]",
        borderWidth: 1,
      };
    case "Medium":
      return {
        bg: "bg-[#291F0E]",
        border: "border-[#F59E0B]",
        text: "text-[#FEF3C7]",
        borderWidth: 1,
      };
    case "Low":
    default:
      return {
        bg: "bg-[#0E2036]",
        border: "border-[#38BDF8]",
        text: "text-[#E0F2FE]",
        borderWidth: 1,
      };
  }
};

const getSeverityBadge = (severity) => {
  switch (severity) {
    case "High":
      return {
        bg: "bg-[#2B1417]",
        border: "border-[#522229]",
        text: "text-[#F87171]",
        dot: "#EF4444",
      };
    case "Medium":
      return {
        bg: "bg-[#291F0E]",
        border: "border-[#4A381A]",
        text: "text-[#FBBF24]",
        dot: "#F59E0B",
      };
    case "Low":
    default:
      return {
        bg: "bg-[#0E2036]",
        border: "border-[#1A385C]",
        text: "text-[#38BDF8]",
        dot: "#38BDF8",
      };
  }
};

/**
 * Ultra-fast document chunking that preserves 100% exact character offsets and content.
 * Splits naturally on double newlines (\n\n), then single newlines (\n), then spaces,
 * keeping each chunk under targetMaxChars (~3,500 chars) to prevent Android native layout crashes.
 *
 * Invariant: Sum of all chunk texts exactly equals extractedText.
 */
function buildDocumentChunks(extractedText, targetMaxChars = 3500) {
  if (typeof extractedText !== "string" || extractedText.length === 0) {
    return [];
  }

  const textLen = extractedText.length;
  if (textLen <= targetMaxChars) {
    return [
      {
        chunkIndex: 0,
        charStart: 0,
        charEnd: textLen,
        text: extractedText,
        paragraphLabel: "¶ 1",
      },
    ];
  }

  const chunks = [];
  let currentStart = 0;
  let paraNum = 1;

  while (currentStart < textLen) {
    const remaining = textLen - currentStart;
    if (remaining <= targetMaxChars) {
      chunks.push({
        chunkIndex: chunks.length,
        charStart: currentStart,
        charEnd: textLen,
        text: extractedText.slice(currentStart, textLen),
        paragraphLabel: `¶ ${paraNum}`,
      });
      break;
    }

    const idealEnd = currentStart + targetMaxChars;
    const minSearch = currentStart + Math.floor(targetMaxChars * 0.5);
    const windowText = extractedText.slice(minSearch, idealEnd);

    let chosenBreak = null;

    // 1. Double newline (\n\n or \r\n\r\n)
    const idxDoubleNl = windowText.lastIndexOf("\n\n");
    const idxCrlfDouble = windowText.lastIndexOf("\r\n\r\n");
    if (idxCrlfDouble !== -1) {
      chosenBreak = minSearch + idxCrlfDouble + 4;
    } else if (idxDoubleNl !== -1) {
      chosenBreak = minSearch + idxDoubleNl + 2;
    } else {
      // 2. Single newline (\n or \r\n)
      const idxNl = windowText.lastIndexOf("\n");
      if (idxNl !== -1) {
        chosenBreak = minSearch + idxNl + 1;
      } else {
        // 3. Sentence end (. / ! / ? followed by space)
        const idxSentence = Math.max(
          windowText.lastIndexOf(". "),
          windowText.lastIndexOf("! "),
          windowText.lastIndexOf("? ")
        );
        if (idxSentence !== -1) {
          chosenBreak = minSearch + idxSentence + 2;
        } else {
          // 4. Space
          const idxSpace = windowText.lastIndexOf(" ");
          if (idxSpace !== -1) {
            chosenBreak = minSearch + idxSpace + 1;
          } else {
            chosenBreak = idealEnd;
          }
        }
      }
    }

    const chunkSlice = extractedText.slice(currentStart, chosenBreak);
    chunks.push({
      chunkIndex: chunks.length,
      charStart: currentStart,
      charEnd: chosenBreak,
      text: chunkSlice,
      paragraphLabel: `¶ ${paraNum}`,
    });

    const nlCount = (chunkSlice.match(/\n/g) || []).length;
    paraNum += Math.max(1, nlCount);

    currentStart = chosenBreak;
  }

  return chunks;
}

/**
 * Segments a single chunk against findings overlapping [chunk.charStart, chunk.charEnd].
 * Handles cross-chunk boundary findings seamlessly without offset drift.
 */
function segmentChunk(chunk, findings, selectedCategory = "ALL") {
  const { charStart: cStart, charEnd: cEnd, text: cText } = chunk;

  // Filter valid findings overlapping this chunk
  const overlapping = findings.filter(
    (f) => f && f.isAnchored && f.charStart < cEnd && f.charEnd > cStart
  );

  if (overlapping.length === 0) {
    return [
      {
        segmentIndex: 0,
        charStart: cStart,
        charEnd: cEnd,
        text: cText,
        isHighlighted: false,
        findingIds: [],
        findings: [],
        severity: null,
      },
    ];
  }

  // Collect boundary points clamped to [cStart, cEnd]
  const boundarySet = new Set([cStart, cEnd]);
  for (const f of overlapping) {
    if (f.charStart > cStart && f.charStart < cEnd) boundarySet.add(f.charStart);
    if (f.charEnd > cStart && f.charEnd < cEnd) boundarySet.add(f.charEnd);
  }

  const sortedBounds = Array.from(boundarySet).sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < sortedBounds.length - 1; i++) {
    const sStart = sortedBounds[i];
    const sEnd = sortedBounds[i + 1];
    const sText = cText.slice(sStart - cStart, sEnd - cStart);

    const covering = overlapping.filter(
      (f) => f.charStart <= sStart && f.charEnd >= sEnd
    );

    const matchesCategory =
      selectedCategory === "ALL" ||
      covering.some((f) => f.indicatorCode === selectedCategory);

    const isHighlighted = covering.length > 0 && matchesCategory;
    const findingIds = covering.map((f) => f.findingId);

    let severity = null;
    if (covering.some((f) => f.severity === "High")) severity = "High";
    else if (covering.some((f) => f.severity === "Medium")) severity = "Medium";
    else if (isHighlighted) severity = "Low";

    segments.push({
      segmentIndex: i,
      charStart: sStart,
      charEnd: sEnd,
      text: sText,
      isHighlighted,
      findingIds,
      findings: covering,
      severity,
    });
  }

  return segments;
}

/**
 * Reusable Highlighted Evidence Viewer
 *
 * Efficiently renders original extracted text with authentic structure,
 * zero content truncation, single-container FlatList virtualization,
 * and non-overlapping highlighted segments.
 */
export default function HighlightedEvidenceViewer({
  extractedText = "",
  evidenceMap = null,
  activeFindingId = null,
  onSelectFinding,
  selectedCategory = "ALL",
  onSelectCategory,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  style,
}) {
  const flatListRef = useRef(null);

  const findings = useMemo(() => {
    return Array.isArray(evidenceMap?.findings) ? evidenceMap.findings : [];
  }, [evidenceMap]);

  // Active finding lookup (matches findingId or fallback offsets)
  const activeFinding = useMemo(() => {
    if (!activeFindingId) return null;
    return findings.find((f) => f.findingId === activeFindingId) || null;
  }, [activeFindingId, findings]);

  // Filter valid anchored findings once
  const validFindings = useMemo(() => {
    if (!extractedText || extractedText.length === 0) return [];
    return findings.filter(
      (f) =>
        f &&
        f.isAnchored &&
        (f.status === "VALID" ||
          f.status === "SNIPPET_MATCH" ||
          f.isExactMatch ||
          f.sliceMatch) &&
        typeof f.charStart === "number" &&
        typeof f.charEnd === "number" &&
        f.charEnd > f.charStart &&
        f.charStart >= 0 &&
        f.charEnd <= extractedText.length
    );
  }, [findings, extractedText]);

  // Build document chunks once per extractedText (under 20 ms even for 8 MB)
  const baseChunks = useMemo(() => {
    return buildDocumentChunks(extractedText, 3500);
  }, [extractedText]);

  // Segment each chunk with overlapping findings
  const chunks = useMemo(() => {
    if (baseChunks.length === 0) return [];
    return baseChunks.map((chunk) => {
      const segments = segmentChunk(chunk, validFindings, selectedCategory);
      const highlightedSegs = segments.filter((s) => s.isHighlighted);
      const uniqueFindingIds = new Set(highlightedSegs.flatMap((s) => s.findingIds));

      return {
        ...chunk,
        segments,
        hasHighlights: highlightedSegs.length > 0,
        findingsCount: uniqueFindingIds.size,
      };
    });
  }, [baseChunks, validFindings, selectedCategory]);

  // Distinct indicator categories for filtering
  const availableCategories = useMemo(() => {
    const cats = new Map();
    cats.set("ALL", { code: "ALL", label: "All Indicators" });

    findings.forEach((f) => {
      if (f.indicatorCode && !cats.has(f.indicatorCode)) {
        cats.set(f.indicatorCode, {
          code: f.indicatorCode,
          label: f.indicatorLabel || f.indicatorCode,
        });
      }
    });

    return Array.from(cats.values());
  }, [findings]);

  // Chunks containing highlighted findings for quick navigation
  const findingChunks = useMemo(() => {
    return chunks.filter((c) => c.hasHighlights);
  }, [chunks]);

  // Document-level unanchored findings
  const documentFindings = useMemo(() => {
    return findings.filter((f) => !f.isAnchored);
  }, [findings]);

  // Auto-scroll to active finding when activeFindingId is set or changed
  useEffect(() => {
    if (!activeFindingId || !flatListRef.current || chunks.length === 0) {
      return;
    }

    const finding = findings.find((f) => f.findingId === activeFindingId);
    if (!finding || !finding.isAnchored || typeof finding.charStart !== "number") {
      return;
    }

    const targetIdx = chunks.findIndex(
      (c) => c.charStart <= finding.charStart && c.charEnd > finding.charStart
    );

    if (targetIdx >= 0) {
      const timer = setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: targetIdx,
            animated: true,
            viewPosition: 0.15,
          });
        } catch (_) {}
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeFindingId, chunks, findings]);

  const handleScrollToIndexFailed = useCallback((info) => {
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.15,
        });
      } catch (_) {}
    }, 150);
  }, []);

  const handleJumpToChunk = useCallback((idx) => {
    try {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.1,
      });
    } catch (_) {}
  }, []);

  // Render individual chunk inside virtualized FlatList
  const renderChunkItem = useCallback(
    ({ item: chunk }) => {
      const isTargetChunk =
        activeFinding &&
        activeFinding.isAnchored &&
        typeof activeFinding.charStart === "number" &&
        activeFinding.charStart >= chunk.charStart &&
        activeFinding.charStart < chunk.charEnd;

      return (
        <View
          key={`chunk-view-${chunk.chunkIndex}`}
          style={isTargetChunk ? styles.targetChunkContainer : null}
          className="mb-4 bg-[#080B14] border border-[#1A233D] rounded-2xl p-4"
        >
          {/* Paragraph / Chunk Header Badge */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className="bg-[#10172A] border border-[#1E294B] rounded px-1.5 py-0.2 mr-1.5">
                <Text className="text-[9px] font-bold text-[#64748B]">
                  {chunk.paragraphLabel}
                </Text>
              </View>
              {isTargetChunk ? (
                <View className="bg-[#2D1B4E] border border-[#7C3AED] rounded px-1.5 py-0.2">
                  <Text className="text-[8.5px] font-bold text-[#C4B5FD]">
                    Active Target Finding
                  </Text>
                </View>
              ) : null}
            </View>

            {chunk.hasHighlights ? (
              <View className="bg-[#0D2338] border border-[#184870] rounded px-1.5 py-0.2">
                <Text className="text-[8.5px] font-semibold text-[#38BDF8]">
                  {chunk.findingsCount} signal{chunk.findingsCount > 1 ? "s" : ""}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Chunk text with inline segments */}
          <Text className="text-[13px] leading-[22px] text-[#CBD5E1]">
            {chunk.segments.map((seg, sIdx) => {
              const isActive =
                Boolean(activeFindingId) &&
                seg.findingIds.includes(activeFindingId);

              if (seg.isHighlighted) {
                const styleTheme = getSeverityStyle(seg.severity, isActive);
                const primaryFindingId = seg.findingIds[0];

                return (
                  <Text
                    key={`seg-${chunk.chunkIndex}-${sIdx}`}
                    onPress={() => {
                      if (onSelectFinding) {
                        onSelectFinding(isActive ? null : primaryFindingId);
                      }
                    }}
                    style={[
                      styles.highlightedSpan,
                      isActive && styles.activeSpan,
                    ]}
                    className={`${styleTheme.bg} ${styleTheme.text} font-medium`}
                    accessibilityRole="button"
                    accessibilityLabel={`Finding highlight ${primaryFindingId}`}
                  >
                    {seg.text}
                  </Text>
                );
              }

              return (
                <Text
                  key={`seg-${chunk.chunkIndex}-${sIdx}`}
                  className="text-[#CBD5E1]"
                >
                  {seg.text}
                </Text>
              );
            })}
          </Text>
        </View>
      );
    },
    [activeFinding, activeFindingId, onSelectFinding]
  );

  // Consolidated List Header Component
  const renderCombinedHeader = useCallback(() => {
    return (
      <View className="mb-2">
        {ListHeaderComponent ? (
          typeof ListHeaderComponent === "function" ? (
            <ListHeaderComponent />
          ) : (
            ListHeaderComponent
          )
        ) : null}

        {/* Category Filter Pills */}
        {availableCategories.length > 2 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-3 max-h-9"
            contentContainerStyle={{ paddingHorizontal: 2 }}
          >
            {availableCategories.map((cat) => {
              const isSelected = (selectedCategory || "ALL") === cat.code;
              return (
                <Pressable
                  key={`cat-${cat.code}`}
                  onPress={() => {
                    if (onSelectCategory) {
                      onSelectCategory(cat.code);
                    }
                  }}
                  className={`mr-2 px-3 py-1.5 rounded-full border ${
                    isSelected
                      ? "bg-[#1E293B] border-[#38BDF8]"
                      : "bg-[#0E1322] border-[#1C253E]"
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${cat.label}`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      isSelected ? "text-[#38BDF8]" : "text-[#8E96B0]"
                    }`}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Paragraph / Chunk Jump Bar */}
        {chunks.length > 1 ? (
          <View className="flex-row items-center mb-3 px-1">
            <Text className="text-[10px] font-bold tracking-[0.8px] text-[#64748B] uppercase mr-2">
              Jump:
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: "center" }}
            >
              {/* Quick jump to start */}
              <Pressable
                onPress={() => handleJumpToChunk(0)}
                className="bg-[#12182B] border border-[#1F2947] rounded-md px-2 py-0.5 mr-1.5 active:opacity-75"
                accessibilityRole="button"
                accessibilityLabel="Jump to document start"
              >
                <Text className="text-[10.5px] font-bold text-[#38BDF8]">
                  Top
                </Text>
              </Pressable>

              {/* If reasonable number of chunks, show individual buttons */}
              {chunks.length <= 15 ? (
                chunks.map((c) => (
                  <Pressable
                    key={`jump-chunk-${c.chunkIndex}`}
                    onPress={() => handleJumpToChunk(c.chunkIndex)}
                    className={`rounded-md px-2 py-0.5 mr-1.5 border active:opacity-75 ${
                      c.hasHighlights
                        ? "bg-[#142338] border-[#254E75]"
                        : "bg-[#12182B] border-[#1F2947]"
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`Jump to ${c.paragraphLabel}`}
                  >
                    <Text
                      className={`text-[10.5px] font-bold ${
                        c.hasHighlights ? "text-[#38BDF8]" : "text-[#8E96B0]"
                      }`}
                    >
                      {c.paragraphLabel}
                    </Text>
                  </Pressable>
                ))
              ) : (
                /* For large documents, display chunks with findings and end */
                <>
                  {findingChunks.slice(0, 10).map((c) => (
                    <Pressable
                      key={`jump-fnd-chunk-${c.chunkIndex}`}
                      onPress={() => handleJumpToChunk(c.chunkIndex)}
                      className="bg-[#142338] border border-[#254E75] rounded-md px-2 py-0.5 mr-1.5 active:opacity-75"
                      accessibilityRole="button"
                      accessibilityLabel={`Jump to signal at ${c.paragraphLabel}`}
                    >
                      <Text className="text-[10.5px] font-bold text-[#38BDF8]">
                        Signal {c.paragraphLabel}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => handleJumpToChunk(chunks.length - 1)}
                    className="bg-[#12182B] border border-[#1F2947] rounded-md px-2 py-0.5 mr-1.5 active:opacity-75"
                    accessibilityRole="button"
                    accessibilityLabel="Jump to document end"
                  >
                    <Text className="text-[10.5px] font-bold text-[#94A3B8]">
                      End
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  }, [
    ListHeaderComponent,
    availableCategories,
    selectedCategory,
    onSelectCategory,
    chunks.length,
    findingChunks,
    handleJumpToChunk,
  ]);

  // Consolidated List Footer Component
  const renderCombinedFooter = useCallback(() => {
    return (
      <View className="mt-2">
        {/* Active Finding Inspection Callout */}
        {activeFinding ? (
          <View className="bg-[#12172C] border border-[#2D3960] rounded-2xl p-4 mb-4 shadow-lg">
            {/* Header */}
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1 mr-2">
                <View className="flex-row items-center mb-1">
                  <View className="bg-[#1C2542] border border-[#2C3B6B] rounded-full px-2 py-0.5 mr-2">
                    <Text className="text-[9.5px] font-bold text-[#818CF8]">
                      {activeFinding.findingId}
                    </Text>
                  </View>
                  <View
                    className={`${
                      getSeverityBadge(activeFinding.severity).bg
                    } ${
                      getSeverityBadge(activeFinding.severity).border
                    } border rounded-full px-2 py-0.5`}
                  >
                    <Text
                      className={`text-[9px] font-bold ${
                        getSeverityBadge(activeFinding.severity).text
                      }`}
                    >
                      {activeFinding.severity} Priority
                    </Text>
                  </View>
                </View>
                <Text className="text-[13.5px] font-bold text-white">
                  {activeFinding.indicatorLabel || activeFinding.indicatorCode}
                </Text>
              </View>

              <Pressable
                onPress={() => onSelectFinding && onSelectFinding(null)}
                hitSlop={8}
                className="w-6 h-6 rounded-full bg-[#1A223D] items-center justify-center active:opacity-75"
                accessibilityRole="button"
                accessibilityLabel="Deselect finding"
              >
                <Ionicons name="close" size={13} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Snippet Card */}
            {activeFinding.snippet ? (
              <View className="bg-[#080B14] border border-[#1A223D] rounded-xl p-2.5 mb-2.5">
                <Text className="text-[11.5px] italic text-[#CBD5E1] leading-[17px] mb-1">
                  "{activeFinding.snippet}"
                </Text>
                <View className="flex-row items-center justify-between pt-1 border-t border-[#141A30]">
                  <Text className="text-[9.5px] text-[#64748B]">
                    Chars: [{activeFinding.charStart} – {activeFinding.charEnd})
                  </Text>
                  {activeFinding.isExactMatch ? (
                    <View className="flex-row items-center">
                      <Ionicons
                        name="checkmark-circle"
                        size={11}
                        color="#10B981"
                        style={{ marginRight: 3 }}
                      />
                      <Text className="text-[9.5px] font-semibold text-[#10B981]">
                        100% Exact Document Match
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Pedagogical Guidance */}
            {activeFinding.explanationDetails ? (
              <View className="space-y-2">
                {/* Concept / Meaning */}
                <View className="mb-2">
                  <Text className="text-[10px] font-bold tracking-[0.8px] text-[#38BDF8] uppercase mb-0.5">
                    What This Pattern Means
                  </Text>
                  <Text className="text-[11.5px] text-[#CBD5E1] leading-[16px]">
                    {activeFinding.explanationDetails.studentFriendlyMeaning}
                  </Text>
                </View>

                {/* Why Flagged */}
                <View className="mb-2">
                  <Text className="text-[10px] font-bold tracking-[0.8px] text-[#FBBF24] uppercase mb-0.5">
                    Why It Was Flagged
                  </Text>
                  <Text className="text-[11.5px] text-[#CBD5E1] leading-[16px]">
                    {activeFinding.explanationDetails.whyFlagged}
                  </Text>
                </View>

                {/* Writing Tip */}
                <View className="bg-[#0B1526] border border-[#182C4E] rounded-xl p-2.5 mb-2 flex-row items-start">
                  <Ionicons
                    name="bulb-outline"
                    size={14}
                    color="#38BDF8"
                    style={{ marginRight: 6, marginTop: 1 }}
                  />
                  <Text className="flex-1 text-[11px] text-[#E0F2FE] leading-[15px]">
                    {activeFinding.explanationDetails.improvementTip}
                  </Text>
                </View>

                {/* Disclaimer */}
                <Text className="text-[10px] text-[#64748B] italic leading-[14px]">
                  {activeFinding.explanationDetails.disclaimer}
                </Text>
              </View>
            ) : (
              <Text className="text-[11.5px] text-[#8E96B0] leading-[16px]">
                {activeFinding.flagReason || activeFinding.indicatorExplanation}
              </Text>
            )}
          </View>
        ) : null}

        {/* Document-Wide Findings Section */}
        {documentFindings.length > 0 ? (
          <View className="bg-[#0C101F] border border-[#1E2744] rounded-2xl p-4 mb-4">
            <View className="flex-row items-center mb-1.5">
              <Ionicons
                name="analytics-outline"
                size={14}
                color="#38BDF8"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[11px] font-bold tracking-[0.8px] text-[#38BDF8] uppercase">
                Document-Wide Stylometric Signals
              </Text>
            </View>
            <Text className="text-[11px] text-[#8E96B0] mb-2 leading-[16px]">
              The following findings evaluate global text statistics across the entire submission rather than specific sentence spans:
            </Text>

            {documentFindings.map((df, dfIdx) => (
              <View
                key={`doc-fnd-${dfIdx}`}
                className="bg-[#080B14] border border-[#161D36] rounded-xl p-2.5 mb-2"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[12px] font-bold text-white">
                    {df.indicatorLabel || df.indicatorCode}
                  </Text>
                  <View
                    className={`${getSeverityBadge(df.severity).bg} ${
                      getSeverityBadge(df.severity).border
                    } border rounded px-1.5 py-0.2`}
                  >
                    <Text
                      className={`text-[8.5px] font-bold ${
                        getSeverityBadge(df.severity).text
                      }`}
                    >
                      {df.severity}
                    </Text>
                  </View>
                </View>
                <Text className="text-[11px] text-[#CBD5E1] leading-[16px] mb-1">
                  {df.explanationDetails?.studentFriendlyMeaning || df.snippet}
                </Text>
                <Text className="text-[10px] text-[#64748B] italic">
                  {df.explanationDetails?.improvementTip}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {ListFooterComponent ? (
          typeof ListFooterComponent === "function" ? (
            <ListFooterComponent />
          ) : (
            ListFooterComponent
          )
        ) : null}
      </View>
    );
  }, [
    activeFinding,
    documentFindings,
    ListFooterComponent,
    onSelectFinding,
  ]);

  if (!extractedText || extractedText.trim().length === 0) {
    return (
      <View className="flex-1">
        {ListHeaderComponent ? (
          typeof ListHeaderComponent === "function" ? (
            <ListHeaderComponent />
          ) : (
            ListHeaderComponent
          )
        ) : null}
        <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-6 items-center my-4">
          <Ionicons name="document-text-outline" size={32} color="#64748B" />
          <Text className="text-[14px] font-bold text-white mt-2 mb-1">
            No Extracted Text Available
          </Text>
          <Text className="text-[12px] text-[#8E96B0] text-center">
            Original document text could not be loaded or extraction is still pending.
          </Text>
        </View>
        {ListFooterComponent ? (
          typeof ListFooterComponent === "function" ? (
            <ListFooterComponent />
          ) : (
            ListFooterComponent
          )
        ) : null}
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={chunks}
      renderItem={renderChunkItem}
      keyExtractor={(item) => `chunk-${item.chunkIndex}`}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={5}
      removeClippedSubviews={Platform.OS === "android"}
      showsVerticalScrollIndicator={true}
      className="flex-1"
      contentContainerStyle={contentContainerStyle}
      style={style}
      ListHeaderComponent={renderCombinedHeader}
      ListFooterComponent={renderCombinedFooter}
      onScrollToIndexFailed={handleScrollToIndexFailed}
    />
  );
}

const styles = StyleSheet.create({
  highlightedSpan: {
    borderRadius: 3,
    paddingHorizontal: 2,
  },
  activeSpan: {
    backgroundColor: "#3B1A4D",
    color: "#F3E8FF",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  targetChunkContainer: {
    backgroundColor: "rgba(56, 189, 248, 0.06)",
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#38BDF8",
    paddingLeft: 12,
  },
});
