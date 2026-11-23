import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatFileSizeMB } from "../utils/fileValidation";
import { fetchAssignmentEvidence } from "../utils/apiClient";
import { getStoredUserProfile } from "../utils/authStorage";
import HighlightedEvidenceViewer from "./HighlightedEvidenceViewer";
import { downloadAndShareReport, printReport } from "../utils/reportPdfGenerator";

const formatDate = (dateString) => {
  if (!dateString) return "Recently";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (_e) {
    return "Recently";
  }
};

const getSignalLevelTheme = (signalLevel) => {
  switch (signalLevel) {
    case "Natural Variation":
      return {
        badgeBg: "bg-[#0A261D]",
        badgeBorder: "border-[#144837]",
        textColor: "text-[#34D399]",
        dotColor: "#10B981",
        label: "Natural Variation",
        subtitle: "Standard Stylometric Variation",
      };
    case "Moderate Uniformity":
      return {
        badgeBg: "bg-[#291F0E]",
        badgeBorder: "border-[#4A381A]",
        textColor: "text-[#FBBF24]",
        dotColor: "#F59E0B",
        label: "Moderate Uniformity",
        subtitle: "Moderate Syntactic Uniformity",
      };
    case "High Uniformity":
      return {
        badgeBg: "bg-[#2B1417]",
        badgeBorder: "border-[#522229]",
        textColor: "text-[#F87171]",
        dotColor: "#EF4444",
        label: "High Uniformity",
        subtitle: "Atypical Syntactic Structure",
      };
    case "Inconclusive":
    default:
      return {
        badgeBg: "bg-[#141C2E]",
        badgeBorder: "border-[#212E4A]",
        textColor: "text-[#94A3B8]",
        dotColor: "#64748B",
        label: signalLevel || "Inconclusive",
        subtitle: "Advisory Sample (<150 words)",
      };
  }
};

const getSeverityTheme = (severity) => {
  switch (severity) {
    case "High":
      return {
        badgeBg: "bg-[#2E1216]",
        badgeBorder: "border-[#57222A]",
        textColor: "text-[#F87171]",
        dotColor: "#EF4444",
      };
    case "Medium":
      return {
        badgeBg: "bg-[#291F0E]",
        badgeBorder: "border-[#4A381A]",
        textColor: "text-[#FBBF24]",
        dotColor: "#F59E0B",
      };
    case "Low":
    default:
      return {
        badgeBg: "bg-[#0E2036]",
        badgeBorder: "border-[#1A385C]",
        textColor: "text-[#38BDF8]",
        dotColor: "#38BDF8",
      };
  }
};

const getStudentReviewStatusTheme = (status) => {
  switch (status) {
    case "Reviewed":
    case "Completed":
      return {
        bg: "bg-[#09221C]",
        border: "border-[#144837]",
        text: "text-[#34D399]",
        dotColor: "#10B981",
        label: "Reviewed",
        desc: "Faculty review completed.",
      };
    case "Needs Clarification":
      return {
        bg: "bg-[#291F0E]",
        border: "border-[#4A381A]",
        text: "text-[#FBBF24]",
        dotColor: "#F59E0B",
        label: "Needs Clarification",
        desc: "Clarification requested by instructor.",
      };
    case "Further Review Required":
      return {
        bg: "bg-[#2B1417]",
        border: "border-[#522229]",
        text: "text-[#F87171]",
        dotColor: "#EF4444",
        label: "Further Review",
        desc: "Escalated for departmental review.",
      };
    case "Under Review":
      return {
        bg: "bg-[#0F1E38]",
        border: "border-[#1D3B6D]",
        text: "text-[#38BDF8]",
        dotColor: "#38BDF8",
        label: "Under Review",
        desc: "Instructor is actively evaluating findings.",
      };
    case "Pending Review":
    case "Pending":
    default:
      return {
        bg: "bg-[#141C2E]",
        border: "border-[#212E4A]",
        text: "text-[#94A3B8]",
        dotColor: "#64748B",
        label: status || "Pending Review",
        desc: "Queued for faculty instructor evaluation.",
      };
  }
};

export default function AnalysisReportModal({
  visible,
  assignment,
  currentUser,
  onClose,
  onReanalyze,
}) {
  const [activeTab, setActiveTab] = useState("summary"); // "summary" | "viewer"
  const [expandedEvidenceIndex, setExpandedEvidenceIndex] = useState(0);
  const [evidenceData, setEvidenceData] = useState(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState(null);
  const [activeFindingId, setActiveFindingId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintingReport, setIsPrintingReport] = useState(false);
  const [studentProfile, setStudentProfile] = useState(currentUser || null);

  useEffect(() => {
    if (currentUser) {
      setStudentProfile(currentUser);
      return;
    }
    let isMounted = true;
    getStoredUserProfile().then((profile) => {
      if (isMounted && profile) {
        setStudentProfile(profile);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const isPrintOrShareCancelled = (err) => {
    const msg = String(err?.message || err || "").toLowerCase();
    return (
      msg.includes("cancel") ||
      msg.includes("dismiss") ||
      msg.includes("abort") ||
      err?.code === "CANCELLED" ||
      err?.name === "AbortError"
    );
  };

  const resolvedAssignment = useMemo(() => {
    if (!assignment) return null;
    return {
      ...assignment,
      studentName:
        assignment.studentName ||
        studentProfile?.name ||
        "",
      studentEmail:
        assignment.studentEmail ||
        studentProfile?.email ||
        "",
      institution:
        assignment.institution ||
        studentProfile?.institution ||
        "",
    };
  }, [assignment, studentProfile]);

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf || isPrintingReport) return;
    setIsDownloadingPdf(true);
    try {
      await downloadAndShareReport({
        assignment: resolvedAssignment,
        evidenceData,
        role: "STUDENT",
      });
    } catch (err) {
      if (!isPrintOrShareCancelled(err)) {
        Alert.alert(
          "Download Report Failed",
          err?.message || "Could not generate PDF report."
        );
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintReport = async () => {
    if (isDownloadingPdf || isPrintingReport) return;
    setIsPrintingReport(true);
    try {
      await printReport({
        assignment: resolvedAssignment,
        evidenceData,
        role: "STUDENT",
      });
    } catch (err) {
      if (!isPrintOrShareCancelled(err)) {
        Alert.alert(
          "Print Report Failed",
          err?.message || "Could not open print spooler."
        );
      }
    } finally {
      setIsPrintingReport(false);
    }
  };

  const loadEvidence = useCallback(async () => {
    if (!assignment?.id || assignment.analysisStatus !== "Completed") {
      return;
    }
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const response = await fetchAssignmentEvidence(assignment.id);
      if (response.ok && response.data?.success) {
        setEvidenceData(response.data);
      } else {
        setEvidenceError(
          response.data?.message || "Failed to load document evidence."
        );
      }
    } catch (_err) {
      setEvidenceError("Network error while connecting to evidence service.");
    } finally {
      setEvidenceLoading(false);
    }
  }, [assignment?.id, assignment?.analysisStatus]);

  useEffect(() => {
    if (!visible || !assignment?.id) {
      setEvidenceData(null);
      setEvidenceLoading(false);
      setEvidenceError(null);
      setActiveFindingId(null);
      setSelectedCategory("ALL");
      setActiveTab("summary");
      return;
    }

    loadEvidence();
  }, [visible, assignment?.id, loadEvidence]);

  const teacherCommentsList = useMemo(() => {
    if (
      Array.isArray(evidenceData?.teacherComments) &&
      evidenceData.teacherComments.length > 0
    ) {
      return evidenceData.teacherComments;
    }
    if (Array.isArray(assignment?.teacherComments)) {
      return assignment.teacherComments;
    }
    return [];
  }, [evidenceData, assignment]);

  const findingReviewsMap = useMemo(() => {
    const map = {};
    const reviews =
      evidenceData?.findingReviews || assignment?.findingReviews || [];
    if (Array.isArray(reviews)) {
      reviews.forEach((r) => {
        if (r?.findingId) map[r.findingId] = r;
      });
    }
    return map;
  }, [evidenceData, assignment]);

  if (!visible || !assignment) {
    return null;
  }

  const analysisResult = assignment.analysisResult || {};
  const metrics = analysisResult.metrics || {};
  const indicators = Array.isArray(analysisResult.indicators)
    ? analysisResult.indicators
    : [];

  const mattrValue =
    typeof metrics.mattr === "number"
      ? metrics.mattr
      : typeof metrics.lexicalDiversity === "number"
        ? metrics.lexicalDiversity
        : null;

  const cadenceCVValue =
    typeof metrics.burstinessScore === "number"
      ? metrics.burstinessScore
      : typeof metrics.sentenceLengthVariation === "number"
        ? metrics.sentenceLengthVariation
        : null;

  const transitionDensityValue =
    typeof metrics.transitionDensityScore === "number"
      ? metrics.transitionDensityScore
      : typeof metrics.transitionDensity === "number"
        ? (metrics.transitionDensity > 1
            ? metrics.transitionDensity / 100
            : metrics.transitionDensity)
        : null;

  const fileName =
    assignment.originalFileName ||
    assignment.fileName ||
    assignment.title ||
    "Document.pdf";

  const fileSizeStr = formatFileSizeMB(assignment.fileSize);
  const analyzedDateStr = formatDate(
    analysisResult.analyzedAt || assignment.submittedDate
  );
  const idShort = assignment.id ? assignment.id.slice(-5).toUpperCase() : "17247";

  const signalTheme = getSignalLevelTheme(analysisResult.signalLevel);

  const effectiveReviewStatus =
    evidenceData?.reviewStatus || assignment.reviewStatus || "Pending Review";
  const effectiveLastReviewedAt =
    evidenceData?.lastReviewedAt || assignment.lastReviewedAt || null;
  const teacherReview =
    evidenceData?.teacherReview || assignment.teacherReview || null;
  const teacherFeedbackNotes =
    teacherReview?.feedbackNotes ||
    assignment.teacherReview?.feedbackNotes ||
    "";

  const studentStatusTheme = getStudentReviewStatusTheme(effectiveReviewStatus);

  // Indicator counts by severity
  const highCount = indicators.filter((i) => i.severity === "High").length;
  const mediumCount = indicators.filter((i) => i.severity === "Medium").length;
  const lowCount = indicators.filter((i) => i.severity === "Low").length;

  const handleReanalyzePress = () => {
    Alert.alert(
      "Re-analyze Assignment",
      "Would you like to run a fresh stylometric writing analysis on this assignment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Re-analyze",
          onPress: () => {
            if (onReanalyze) {
              onReanalyze(assignment);
            }
          },
        },
      ]
    );
  };

  const renderModalHeader = () => (
    <View className="mb-2">
      {/* Subheader & Back Button */}
      <View className="flex-row items-center justify-between mb-2">
        <Pressable
          onPress={onClose}
          hitSlop={10}
          className="w-8 h-8 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
        >
          <Ionicons name="arrow-back" size={16} color="#94A3B8" />
        </Pressable>

        <View className="flex-row items-center">
          <Pressable
            disabled={isDownloadingPdf || isPrintingReport}
            onPress={handlePrintReport}
            hitSlop={8}
            className="w-8 h-8 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center mr-1.5 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Print report"
          >
            {isPrintingReport ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Ionicons name="print-outline" size={15} color="#38BDF8" />
            )}
          </Pressable>

          <Pressable
            disabled={isDownloadingPdf || isPrintingReport}
            onPress={handleDownloadPdf}
            hitSlop={8}
            className="w-8 h-8 rounded-xl bg-[#0C243B] border border-[#194D7C] items-center justify-center mr-2 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Download PDF report"
          >
            {isDownloadingPdf ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Ionicons name="cloud-download-outline" size={15} color="#38BDF8" />
            )}
          </Pressable>

          <View className="bg-[#0C1226] border border-[#19244D] rounded-full px-3 py-1 mr-2">
            <Text className="text-[10px] font-bold tracking-[1.5px] text-[#38BDF8] uppercase">
              • ANALYZE • VERIFY • TRUST
            </Text>
          </View>
          <Text className="text-[11px] font-bold tracking-[0.5px] text-[#64748B]">
            # VR-{idShort}
          </Text>
        </View>
      </View>

      {/* Title & Metadata */}
      <Text className="text-[22px] font-bold text-white mb-1">
        Analysis Report
      </Text>
      <View className="flex-row items-center mb-1">
        <Ionicons
          name="document-text"
          size={14}
          color="#38BDF8"
          style={{ marginRight: 6 }}
        />
        <Text
          className="text-[13px] font-semibold text-[#CBD5E1] flex-1"
          numberOfLines={1}
        >
          {fileName}
        </Text>
      </View>
      <Text className="text-[11.5px] text-[#8E96B0] mb-4">
        {fileSizeStr} • Analyzed {analyzedDateStr}
      </Text>

      {/* View Mode Switcher Tabs */}
      <View className="flex-row bg-[#101426] border border-[#202948] rounded-xl p-1 mb-2">
        <Pressable
          onPress={() => setActiveTab("summary")}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
            activeTab === "summary"
              ? "bg-[#1E2746] border border-[#3B4870]"
              : "opacity-80"
          }`}
          accessibilityRole="button"
          accessibilityLabel="Findings Summary View"
        >
          <Ionicons
            name="bar-chart-outline"
            size={14}
            color={activeTab === "summary" ? "#38BDF8" : "#94A3B8"}
            style={{ marginRight: 6 }}
          />
          <Text
            className={`text-[12px] font-bold ${
              activeTab === "summary" ? "text-white" : "text-[#94A3B8]"
            }`}
          >
            Findings Summary
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("viewer")}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
            activeTab === "viewer"
              ? "bg-[#1E2746] border border-[#3B4870]"
              : "opacity-80"
          }`}
          accessibilityRole="button"
          accessibilityLabel="Interactive Document Viewer"
        >
          <Ionicons
            name="document-text-outline"
            size={14}
            color={activeTab === "viewer" ? "#38BDF8" : "#94A3B8"}
            style={{ marginRight: 6 }}
          />
          <Text
            className={`text-[12px] font-bold ${
              activeTab === "viewer" ? "text-white" : "text-[#94A3B8]"
            }`}
          >
            Document Viewer
          </Text>
          {evidenceData?.evidenceMap?.anchoredFindings ? (
            <View className="bg-[#0C243B] border border-[#194D7C] rounded-full px-1.5 py-0.2 ml-1.5">
              <Text className="text-[9px] font-bold text-[#38BDF8]">
                {evidenceData.evidenceMap.anchoredFindings}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );

  const renderActionButtons = () => (
    <View className="mt-4 mb-8">
      {/* Download and Print Actions */}
      <View className="flex-row mb-3">
        <Pressable
          disabled={isDownloadingPdf || isPrintingReport}
          onPress={handleDownloadPdf}
          className="flex-1 h-[46px] bg-[#0284C7] rounded-xl flex-row items-center justify-center mr-1.5 active:opacity-85"
          accessibilityRole="button"
          accessibilityLabel="Download PDF report"
        >
          {isDownloadingPdf ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="cloud-download-outline"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[12.5px] font-bold text-white">
                Download PDF
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          disabled={isDownloadingPdf || isPrintingReport}
          onPress={handlePrintReport}
          className="flex-1 h-[46px] bg-[#141C34] border border-[#222E54] rounded-xl flex-row items-center justify-center ml-1.5 active:opacity-85"
          accessibilityRole="button"
          accessibilityLabel="Print report"
        >
          {isPrintingReport ? (
            <ActivityIndicator size="small" color="#38BDF8" />
          ) : (
            <>
              <Ionicons
                name="print-outline"
                size={16}
                color="#38BDF8"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[12.5px] font-bold text-white">
                Print Report
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Action Buttons */}
      <Pressable
        onPress={handleReanalyzePress}
        className="w-full h-[46px] bg-[#16203D] border border-[#293B6B] rounded-xl flex-row items-center justify-center mb-3 active:opacity-85"
        accessibilityRole="button"
        accessibilityLabel="Re-analyze writing"
      >
        <Ionicons
          name="refresh-outline"
          size={16}
          color="#38BDF8"
          style={{ marginRight: 6 }}
        />
        <Text className="text-[13px] font-bold text-white">
          Re-analyze Writing
        </Text>
      </Pressable>

      <Pressable
        onPress={onClose}
        className="w-full h-[44px] bg-[#121626] border border-[#1E2540] rounded-xl items-center justify-center mb-6 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel="Close report"
      >
        <Text className="text-[13px] font-bold text-[#CBD5E1]">
          Close Report
        </Text>
      </Pressable>

      {/* Important Limitations Banner */}
      <View className="bg-[#0B1020] border border-[#162244] rounded-2xl p-4 flex-row items-start">
        <Ionicons
          name="shield-outline"
          size={17}
          color="#38BDF8"
          style={{ marginTop: 2, marginRight: 10 }}
        />
        <View className="flex-1">
          <Text className="text-[11px] font-bold tracking-[0.8px] text-[#38BDF8] uppercase mb-1">
            Important Limitations
          </Text>
          <Text className="text-[11.5px] text-[#8E96B0] leading-[17px]">
            All writing indicators and stylometric scores are not conclusive
            proof of AI usage or plagiarism. These signals are intended to
            support human investigation and contextual review. Faculty
            decisions should always consider the complete academic context
            and evidence.
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-[#080B14]">
        {/* Top Header Bar */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3 border-b border-[#14192C]">
          <View className="flex-row items-center">
            <View className="w-9 h-9 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center mr-2.5">
              <Ionicons name="checkmark-circle-outline" size={19} color="#818CF8" />
            </View>
            <View>
              <Text className="text-[15px] font-bold text-white leading-[18px]">
                VeriWrite
              </Text>
              <Text className="text-[11px] text-[#8E96B0] leading-[14px]">
                Student Portal
              </Text>
            </View>
          </View>

          <View className="flex-row items-center bg-[#0B2220] border border-[#143D37] rounded-full px-2.5 py-1">
            <View className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5" />
            <Text className="text-[9.5px] font-bold tracking-[0.8px] text-[#34D399] uppercase">
              LIVE SYNC
            </Text>
          </View>
        </View>

        {activeTab === "summary" ? (
          <ScrollView
            className="flex-1 px-5 pt-4"
            showsVerticalScrollIndicator={false}
          >
            {renderModalHeader()}
              {/* 4-Card Overview Metric Grid (2x2) */}
          <View className="flex-row mb-3">
            {/* Card 1: AI Writing Indicators (Signal Level) */}
            <View className="flex-1 bg-[#101426] border border-[#202948] rounded-[20px] p-3.5 mr-1.5">
              <View className="flex-row items-center justify-between mb-2">
                <Ionicons name="analytics-outline" size={16} color="#38BDF8" />
                <View
                  style={{ backgroundColor: signalTheme.dotColor }}
                  className="w-2 h-2 rounded-full"
                />
              </View>
              <Text
                className={`text-[15px] font-extrabold ${signalTheme.textColor} mb-0.5`}
                numberOfLines={1}
              >
                {signalTheme.label}
              </Text>
              <Text className="text-[10px] text-[#8E96B0]" numberOfLines={2}>
                {signalTheme.subtitle}
              </Text>
            </View>

            {/* Card 2: Lexical Diversity MATTR */}
            <View className="flex-1 bg-[#101426] border border-[#202948] rounded-[20px] p-3.5 ml-1.5">
              <View className="flex-row items-center justify-between mb-2">
                <Ionicons name="book-outline" size={16} color="#34D399" />
                <View className="bg-[#09221C] border border-[#14433B] rounded-full px-2 py-0.5">
                  <Text className="text-[8.5px] font-bold text-[#10B981]">
                    MATTR
                  </Text>
                </View>
              </View>
              <Text className="text-[17px] font-extrabold text-white mb-0.5">
                {typeof mattrValue === "number"
                  ? `${(mattrValue * 100).toFixed(0)}%`
                  : "N/A"}
              </Text>
              <Text className="text-[10px] text-[#8E96B0]">
                50-Word Window TTR
              </Text>
            </View>
          </View>

          <View className="flex-row mb-5">
            {/* Card 3: Flagged Indicators */}
            <View className="flex-1 bg-[#101426] border border-[#202948] rounded-[20px] p-3.5 mr-1.5">
              <View className="flex-row items-center justify-between mb-2">
                <Ionicons name="flag-outline" size={16} color="#FBBF24" />
                <Text className="text-[10.5px] font-bold text-[#94A3B8]">
                  Sec
                </Text>
              </View>
              <Text className="text-[17px] font-extrabold text-white mb-0.5">
                {indicators.length}{" "}
                <Text className="text-[12px] font-normal text-[#8E96B0]">
                  {indicators.length === 1 ? "Block" : "Blocks"}
                </Text>
              </Text>
              <Text className="text-[10px] text-[#8E96B0]">
                {highCount} High • {mediumCount} Mod • {lowCount} Low
              </Text>
            </View>

            {/* Card 4: Review Status */}
            <View className="flex-1 bg-[#101426] border border-[#202948] rounded-[20px] p-3.5 ml-1.5">
              <View className="flex-row items-center justify-between mb-2">
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={studentStatusTheme.dotColor}
                />
                <View
                  style={{ backgroundColor: studentStatusTheme.dotColor }}
                  className="w-2 h-2 rounded-full"
                />
              </View>
              <Text
                className={`text-[15px] font-extrabold ${studentStatusTheme.text} mb-0.5`}
                numberOfLines={1}
              >
                {effectiveReviewStatus}
              </Text>
              <Text className="text-[10px] text-[#8E96B0]" numberOfLines={2}>
                {studentStatusTheme.desc}
              </Text>
            </View>
          </View>

          {/* Task 14 & Task 12: Faculty Review Status & Feedback Banner */}
          <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-5">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Ionicons
                  name="shield-checkmark"
                  size={16}
                  color={studentStatusTheme.dotColor}
                  style={{ marginRight: 6 }}
                />
                <Text className="text-[13.5px] font-bold text-white">
                  Faculty Review Status
                </Text>
              </View>
              <View
                className={`px-2.5 py-0.5 rounded-full border ${studentStatusTheme.bg} ${studentStatusTheme.border}`}
              >
                <Text
                  className={`text-[10px] font-bold ${studentStatusTheme.text}`}
                >
                  • {effectiveReviewStatus}
                </Text>
              </View>
            </View>

            {effectiveLastReviewedAt ? (
              <Text className="text-[10.5px] text-[#64748B] mb-2.5">
                Last reviewed: {formatDate(effectiveLastReviewedAt)}
              </Text>
            ) : null}

            {teacherFeedbackNotes ? (
              <View className="bg-[#080B14] border border-[#182038] rounded-xl p-3 mb-2.5">
                <Text className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#38BDF8] mb-1">
                  Instructor Final Feedback
                </Text>
                <Text className="text-[12px] text-[#CBD5E1] leading-[17px]">
                  {teacherFeedbackNotes}
                </Text>
              </View>
            ) : null}

            {teacherCommentsList.length > 0 ? (
              <View className="mt-1">
                <Text className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#8E96B0] mb-1.5">
                  Instructor Feedback Thread ({teacherCommentsList.length})
                </Text>
                {teacherCommentsList.map((c, cIdx) => (
                  <View
                    key={`tc-${c.commentId || cIdx}`}
                    className="bg-[#080B14] border border-[#182038] rounded-xl p-2.5 mb-2"
                  >
                    <View className="flex-row items-center justify-between mb-0.5">
                      <Text className="text-[11px] font-bold text-[#A5B4FC]">
                        {c.teacherName || "Instructor"}
                      </Text>
                      <Text className="text-[9.5px] text-[#64748B]">
                        {formatDate(c.createdAt)}
                      </Text>
                    </View>
                    <Text className="text-[11.5px] text-[#CBD5E1] leading-[16px]">
                      {c.text}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* AI Writing Indicators Section */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[16px] font-bold text-white">
              AI Writing Indicators
            </Text>
            <View className="bg-[#141C30] border border-[#222E50] rounded-full px-2.5 py-0.5">
              <Text className="text-[10px] font-bold text-[#38BDF8]">
                {indicators.length}{" "}
                {indicators.length === 1 ? "Pattern" : "Patterns"} Detected
              </Text>
            </View>
          </View>

          {/* Educational Callout Banner */}
          <View className="bg-[#0C1224] border border-[#182348] rounded-xl p-3 mb-4 flex-row items-start">
            <Ionicons
              name="information-circle-outline"
              size={15}
              color="#38BDF8"
              style={{ marginTop: 1, marginRight: 8 }}
            />
            <Text className="flex-1 text-[11.5px] leading-[17px] text-[#94A3B8]">
              Elevated or uniform stylometric patterns reflect empirical writing
              metrics and do not prove or confirm AI generation.
            </Text>
          </View>

          {/* Indicators List */}
          {indicators.length > 0 ? (
            indicators.map((indicator, idx) => {
              const sev = getSeverityTheme(indicator.severity);
              const firstEvidence =
                Array.isArray(indicator.evidence) && indicator.evidence.length > 0
                  ? indicator.evidence[0]
                  : null;
              const indicatorKey =
                indicator.code || indicator.indicatorCode || `idx-${idx}`;
              const indicatorTitle =
                indicator.label || indicator.name || "Stylometric Indicator";

              return (
                <View
                  key={`indicator-${indicatorKey}-${idx}`}
                  className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3.5"
                >
                  {/* Indicator Header */}
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-start flex-1 mr-2">
                      <View
                        style={{ backgroundColor: sev.dotColor, marginTop: 5 }}
                        className="w-2 h-2 rounded-full mr-2"
                      />
                      <Text
                        className="text-[13.5px] font-bold text-white flex-1 mr-1"
                        numberOfLines={2}
                      >
                        {indicatorTitle}
                      </Text>
                    </View>
                    <View
                      className={`${sev.badgeBg} ${sev.badgeBorder} border rounded-full px-2.5 py-0.5`}
                    >
                      <Text
                        className={`text-[9.5px] font-bold ${sev.textColor}`}
                      >
                        {indicator.severity}
                      </Text>
                    </View>
                  </View>

                  {/* Indicator Snippet / Explanation */}
                  {firstEvidence?.snippet ? (
                    <View className="bg-[#080B14] border border-[#182038] rounded-xl p-3 mb-2.5">
                      <Text className="text-[12px] italic text-[#CBD5E1] leading-[18px]">
                        "{firstEvidence.snippet}"
                      </Text>
                    </View>
                  ) : null}

                  {/* Explanation text */}
                  <Text className="text-[11.5px] text-[#8E96B0] leading-[16px] mb-2">
                    {indicator.explanation}
                  </Text>

                  {/* Footer metadata */}
                  <View className="flex-row items-center justify-between pt-2 border-t border-[#182038]">
                    <Text className="text-[10px] text-[#64748B]">
                      {firstEvidence
                        ? `Paragraph ${firstEvidence.paragraphIndex + 1} • Sentence ${
                            firstEvidence.sentenceIndex + 1
                          }`
                        : "Document-wide"}
                    </Text>
                    <Text className="text-[10.5px] font-semibold text-[#38BDF8]">
                      Metric: {indicator.metricValue ?? "Elevated"}
                    </Text>
                  </View>

                  {/* View Highlight in Document Button */}
                  {firstEvidence ? (
                    <Pressable
                      onPress={() => {
                        const targetFindingId =
                          firstEvidence.findingId ||
                          evidenceData?.evidenceMap?.findings?.find(
                            (f) => f.indicatorCode === indicator.code
                          )?.findingId ||
                          null;
                        if (targetFindingId) {
                          setActiveFindingId(targetFindingId);
                        }
                        if (indicator.code) {
                          setSelectedCategory(indicator.code);
                        }
                        setActiveTab("viewer");
                      }}
                      className="bg-[#141C34] border border-[#222E54] rounded-xl py-2 px-3 flex-row items-center justify-center mt-2.5 active:opacity-75"
                      accessibilityRole="button"
                      accessibilityLabel={`View ${indicatorTitle} in document viewer`}
                    >
                      <Ionicons
                        name="eye-outline"
                        size={13}
                        color="#38BDF8"
                        style={{ marginRight: 6 }}
                      />
                      <Text className="text-[11.5px] font-bold text-[#38BDF8]">
                        View Highlight in Document
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-5 items-center mb-4">
              <Ionicons
                name="checkmark-circle-outline"
                size={28}
                color="#10B981"
                style={{ marginBottom: 6 }}
              />
              <Text className="text-[14px] font-bold text-white mb-1">
                No Stylometric Anomalies Detected
              </Text>
              <Text className="text-[12px] text-[#8E96B0] text-center">
                Sentence variation, vocabulary diversity, and syntax patterns
                fall within normal academic ranges.
              </Text>
            </View>
          )}

          {/* Similarity Results Card */}
          <View className="flex-row items-center justify-between mb-2 mt-2">
            <Text className="text-[16px] font-bold text-white">
              Similarity Results
            </Text>
            <View className="bg-[#181E34] border border-[#263356] rounded-full px-2.5 py-0.5">
              <Text className="text-[10px] font-bold text-[#94A3B8]">
                Not Available Yet
              </Text>
            </View>
          </View>
          <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-5">
            <View className="flex-row items-start">
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#94A3B8"
                style={{ marginTop: 1, marginRight: 8 }}
              />
              <View className="flex-1">
                <Text className="text-[12.5px] font-bold text-white mb-1">
                  Text Similarity Checking
                </Text>
                <Text className="text-[11.5px] text-[#8E96B0] leading-[17px]">
                  Cross-submission and repository similarity checking is planned for a future feature. This report currently reflects AI writing and stylometric analysis only.
                </Text>
              </View>
            </View>
          </View>

          {/* Evidence Inspection: Flagged Section (Accordion) */}
          {indicators.some((ind) => ind.evidence && ind.evidence.length > 0) ? (
            <View className="mb-5">
              <Text className="text-[16px] font-bold text-white mb-3">
                Evidence Inspection
              </Text>

              {indicators
                .filter((ind) => ind.evidence && ind.evidence.length > 0)
                .map((ind, indIdx) => {
                  const ev = ind.evidence[0];
                  const isExpanded = expandedEvidenceIndex === indIdx;

                  return (
                    <View
                      key={`ev-inspection-${indIdx}`}
                      className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3"
                    >
                      {/* Accordion Toggle Header */}
                      <Pressable
                        onPress={() =>
                          setExpandedEvidenceIndex(isExpanded ? -1 : indIdx)
                        }
                        className="flex-row items-center justify-between"
                        accessibilityRole="button"
                        accessibilityLabel={`Toggle inspection for ${
                          ind.label || ind.name || "flagged section"
                        }`}
                      >
                        <View className="flex-row items-start flex-1 mr-2">
                          <View className="w-6 h-6 rounded-lg bg-[#141C34] border border-[#222E54] items-center justify-center mr-2.5 mt-0.5">
                            <Ionicons name="search" size={12} color="#38BDF8" />
                          </View>
                          <Text
                            className="text-[13px] font-bold text-white flex-1 mr-2"
                            numberOfLines={2}
                          >
                            Flagged Section #{indIdx + 1}:{" "}
                            {ind.label || ind.name || "Stylometric Indicator"}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color="#94A3B8"
                        />
                      </Pressable>

                      {isExpanded ? (
                        <View className="mt-3 pt-3 border-t border-[#182038]">
                          {/* Part A: Original Assignment Text */}
                          <Text className="text-[11px] font-bold tracking-[0.8px] text-[#38BDF8] uppercase mb-1.5">
                            A. Original Assignment Text (
                            {typeof ev.sentenceIndex === "number"
                              ? `Paragraph ${(typeof ev.paragraphIndex === "number" ? ev.paragraphIndex : 0) + 1}, Sentence ${ev.sentenceIndex + 1}`
                              : "Document Overview"}
                            )
                          </Text>
                          <View className="bg-[#080B14] border border-[#182038] rounded-xl p-3 mb-3">
                            <Text className="text-[12px] font-mono text-[#CBD5E1] leading-[18px]">
                              "{ev.snippet}"
                            </Text>
                          </View>

                          {/* Part B: Why Section Was Flagged */}
                          <Text className="text-[11px] font-bold tracking-[0.8px] text-[#FBBF24] uppercase mb-1.5">
                            B. Why Section Was Flagged
                          </Text>
                          <Text className="text-[12px] text-[#CBD5E1] leading-[18px] mb-3">
                            {ev.flagReason || ind.explanation}
                          </Text>

                          {/* Part C: Forensic Telemetry Matrix */}
                          <Text className="text-[11px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase mb-1.5">
                            C. Forensic Telemetry Matrix
                          </Text>
                          <View className="bg-[#0B0F1F] border border-[#16213D] rounded-xl p-3">
                            <View className="flex-row justify-between py-1 border-b border-[#14192C]">
                              <Text className="text-[11px] text-[#64748B]">
                                Sentence Cadence (CV)
                              </Text>
                              <Text className="text-[11px] font-bold text-white">
                                {typeof cadenceCVValue === "number"
                                  ? cadenceCVValue.toFixed(3)
                                  : "N/A"}
                              </Text>
                            </View>
                            <View className="flex-row justify-between py-1 border-b border-[#14192C]">
                              <Text className="text-[11px] text-[#64748B]">
                                MATTR Lexical Index
                              </Text>
                              <Text className="text-[11px] font-bold text-white">
                                {typeof mattrValue === "number"
                                  ? mattrValue.toFixed(3)
                                  : "N/A"}
                              </Text>
                            </View>
                            <View className="flex-row justify-between py-1 border-b border-[#14192C]">
                              <Text className="text-[11px] text-[#64748B]">
                                Transition Density
                              </Text>
                              <Text className="text-[11px] font-bold text-white">
                                {typeof transitionDensityValue === "number"
                                  ? `${(transitionDensityValue * 100).toFixed(1)} / 100 words`
                                  : "N/A"}
                              </Text>
                            </View>
                            <View className="flex-row justify-between py-1">
                              <Text className="text-[11px] text-[#64748B]">
                                Evidence Quality Confidence
                              </Text>
                              <Text className="text-[11px] font-bold text-[#38BDF8]">
                                {analysisResult.analysisConfidence || "Medium"}
                              </Text>
                            </View>
                          </View>

                          {/* Part D: Faculty Review Decision on Finding */}
                          {ev.findingId && findingReviewsMap[ev.findingId] ? (
                            <View className="bg-[#0C1224] border border-[#1A264D] rounded-xl p-3 my-2.5 flex-row items-center justify-between">
                              <View className="flex-1 mr-2">
                                <Text className="text-[10px] font-bold tracking-[0.5px] uppercase text-[#8E96B0] mb-0.5">
                                  Faculty Review Decision
                                </Text>
                                <Text className="text-[11.5px] text-[#CBD5E1]">
                                  {findingReviewsMap[ev.findingId].decision === "Accepted"
                                    ? "Faculty agreed with this indicator flag."
                                    : findingReviewsMap[ev.findingId].decision === "Rejected"
                                    ? "Faculty dismissed this flag as natural variation / false positive."
                                    : "Faculty review is pending."}
                                </Text>
                              </View>
                              <View
                                className={`px-2 py-0.5 rounded-full border ${
                                  findingReviewsMap[ev.findingId].decision === "Accepted"
                                    ? "bg-[#09221C] border-[#144837]"
                                    : findingReviewsMap[ev.findingId].decision === "Rejected"
                                    ? "bg-[#2B1417] border-[#522229]"
                                    : "bg-[#181F38] border-[#25325C]"
                                }`}
                              >
                                <Text
                                  className={`text-[9.5px] font-bold ${
                                    findingReviewsMap[ev.findingId].decision === "Accepted"
                                      ? "text-[#34D399]"
                                      : findingReviewsMap[ev.findingId].decision === "Rejected"
                                      ? "text-[#F87171]"
                                      : "text-[#94A3B8]"
                                  }`}
                                >
                                  {findingReviewsMap[ev.findingId].decision === "Accepted"
                                    ? "✓ Flag Accepted"
                                    : findingReviewsMap[ev.findingId].decision === "Rejected"
                                    ? "✗ Flag Dismissed"
                                    : "Decision Pending"}
                                </Text>
                              </View>
                            </View>
                          ) : null}

                          {/* Part E: View in Document Viewer Button */}
                          {ev.charStart !== null && ev.charStart !== undefined ? (
                            <Pressable
                              onPress={() => {
                                const targetFindingId =
                                  ev.findingId ||
                                  evidenceData?.evidenceMap?.findings?.find(
                                    (f) =>
                                      (f.charStart === ev.charStart && f.charEnd === ev.charEnd) ||
                                      f.indicatorCode === ind.code
                                  )?.findingId ||
                                  null;
                                if (targetFindingId) {
                                  setActiveFindingId(targetFindingId);
                                }
                                if (ind.code) {
                                  setSelectedCategory(ind.code);
                                }
                                setActiveTab("viewer");
                              }}
                              className="bg-[#141C34] border border-[#222E54] rounded-xl py-2 px-3 flex-row items-center justify-center mt-3 active:opacity-75"
                              accessibilityRole="button"
                              accessibilityLabel={`View section ${indIdx + 1} in document viewer`}
                            >
                              <Ionicons
                                name="eye-outline"
                                size={13}
                                color="#38BDF8"
                                style={{ marginRight: 6 }}
                              />
                              <Text className="text-[11.5px] font-bold text-[#38BDF8]">
                                View Highlight in Document Viewer
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
            </View>
          ) : null}
              {renderActionButtons()}
          </ScrollView>
        ) : (
          <View className="flex-1 px-5 pt-4">
            {evidenceLoading ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {renderModalHeader()}
                <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-8 items-center my-2">
                  <ActivityIndicator size="large" color="#38BDF8" />
                  <Text className="text-[13.5px] font-bold text-white mt-3 mb-1">
                    Loading Document Evidence...
                  </Text>
                  <Text className="text-[11.5px] text-[#8E96B0] text-center">
                    Retrieving original extracted text and synchronizing finding offsets.
                  </Text>
                </View>
                {renderActionButtons()}
              </ScrollView>
            ) : evidenceError ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {renderModalHeader()}
                <View className="bg-[#2B1417] border border-[#522229] rounded-[20px] p-5 my-2">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="alert-circle"
                      size={18}
                      color="#F87171"
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-[13.5px] font-bold text-[#F87171]">
                      Evidence Unavailable
                    </Text>
                  </View>
                  <Text className="text-[12px] text-[#CBD5E1] mb-3">
                    {evidenceError}
                  </Text>
                  <Pressable
                    onPress={loadEvidence}
                    className="bg-[#3D1A1F] border border-[#6B242C] rounded-xl py-2 px-4 self-start active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading evidence"
                  >
                    <Text className="text-[11.5px] font-bold text-white">
                      Retry Loading
                    </Text>
                  </Pressable>
                </View>
                {renderActionButtons()}
              </ScrollView>
            ) : (
              <HighlightedEvidenceViewer
                extractedText={evidenceData?.extractedText || ""}
                evidenceMap={evidenceData?.evidenceMap || null}
                activeFindingId={activeFindingId}
                onSelectFinding={setActiveFindingId}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                ListHeaderComponent={renderModalHeader}
                ListFooterComponent={renderActionButtons}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({});
