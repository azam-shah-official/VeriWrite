import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatFileSizeMB } from "../utils/fileValidation";

const getExtractionDetails = (status, wordCount) => {
  if (status === "Completed") {
    const wordCountStr =
      typeof wordCount === "number" && wordCount > 0
        ? ` (${wordCount.toLocaleString()} words)`
        : "";
    return {
      label: "Completed",
      dotColor: "#10B981",
      textColorClass: "text-[#10B981]",
      explanation: `Text extracted successfully${wordCountStr}.`,
    };
  }
  if (status === "Failed") {
    return {
      label: "Failed",
      dotColor: "#EF4444",
      textColorClass: "text-[#F87171]",
      explanation: "Text extraction could not be completed.",
    };
  }
  if (status === "NotSupported") {
    return {
      label: "Not Supported",
      dotColor: "#94A3B8",
      textColorClass: "text-[#94A3B8]",
      explanation: "This file type is not supported for text extraction.",
    };
  }
  if (status === "Processing") {
    return {
      label: "Processing",
      dotColor: "#F59E0B",
      textColorClass: "text-[#F59E0B]",
      explanation: "Document text extraction in progress...",
    };
  }
  return {
    label: "Pending",
    dotColor: "#F59E0B",
    textColorClass: "text-[#F59E0B]",
    explanation: "Queued for document text extraction.",
  };
};

const getAnalysisDetails = (status, analysisResult) => {
  if (status === "Completed") {
    const signal = analysisResult?.signalLevel
      ? ` (${analysisResult.signalLevel})`
      : "";
    return {
      label: "Completed",
      dotColor: "#10B981",
      textColorClass: "text-[#10B981]",
      explanation: `AI writing analysis completed${signal}. Evidence report ready.`,
    };
  }
  if (status === "Failed") {
    return {
      label: "Failed",
      dotColor: "#EF4444",
      textColorClass: "text-[#F87171]",
      explanation: "AI writing analysis could not be completed.",
    };
  }
  if (status === "Processing") {
    return {
      label: "Processing",
      dotColor: "#F59E0B",
      textColorClass: "text-[#F59E0B]",
      explanation: "AI writing analysis in progress...",
    };
  }
  return {
    label: "Pending",
    dotColor: "#F59E0B",
    textColorClass: "text-[#F59E0B]",
    explanation: "Queued for AI writing analysis.",
  };
};

const getReviewDetails = (status) => {
  if (status === "Completed") {
    return {
      label: "Completed",
      dotColor: "#10B981",
      textColorClass: "text-[#10B981]",
      explanation: "Instructor review is complete.",
    };
  }
  if (status === "Needs Human Review") {
    return {
      label: "Needs Review",
      dotColor: "#F59E0B",
      textColorClass: "text-[#F59E0B]",
      explanation: "Queued for instructor contextual review.",
    };
  }
  return {
    label: "Pending",
    dotColor: "#F59E0B",
    textColorClass: "text-[#F59E0B]",
    explanation: "Teacher has not reviewed the assignment yet.",
  };
};

export default function AssignmentDetailModal({
  visible,
  assignment,
  onClose,
  onAnalyze,
  onViewReport,
}) {
  if (!assignment) {
    return null;
  }

  const extractionDetails = getExtractionDetails(
    assignment.extractionStatus,
    assignment.wordCount
  );
  const analysisDetails = getAnalysisDetails(
    assignment.analysisStatus,
    assignment.analysisResult
  );
  const reviewDetails = getReviewDetails(assignment.reviewStatus);

  const displayFileName =
    assignment.originalFileName || assignment.fileName || "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={styles.backdrop}
        className="flex-1 justify-center items-center px-5"
      >
        <View className="w-full max-w-[420px] bg-[#13182B] border border-[#242C4A] rounded-[24px] p-5 max-h-[85%]">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center bg-[#112236] border border-[#1B3552] rounded-full px-3 py-1">
              <Ionicons
                name="document-text-outline"
                size={12}
                color="#38BDF8"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[10px] font-bold tracking-[1.2px] text-[#38BDF8] uppercase">
                SUBMISSION DETAILS
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="w-8 h-8 rounded-full bg-[#0B0F1D] border border-[#1E2640] items-center justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Close assignment details"
            >
              <Ionicons name="close" size={16} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Title & Course */}
            <Text className="text-[18px] font-bold text-white mb-1">
              {assignment.title}
            </Text>
            <Text className="text-[12.5px] text-[#8E96B0] mb-4">
              {assignment.course || "Academic Submission"}
            </Text>

            {/* 4-Stage Status Pipeline */}
            <View className="bg-[#0B0E1B] border border-[#1A2138] rounded-2xl p-4 mb-4">
              <Text className="text-[11px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase mb-3">
                Submission Pipeline Status
              </Text>

              {/* 1. Submission Status */}
              <View className="flex-row items-start mb-3">
                <View className="w-2 h-2 rounded-full bg-[#10B981] mt-1.5 mr-2.5" />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[12.5px] font-semibold text-white">
                      Submission Status
                    </Text>
                    <Text className="text-[11px] font-bold text-[#10B981]">
                      Submitted
                    </Text>
                  </View>
                  <Text className="text-[11.5px] text-[#8E96B0] mt-0.5">
                    Assignment uploaded successfully.
                  </Text>
                </View>
              </View>

              {/* 2. Text Extraction Status */}
              <View className="flex-row items-start mb-3 pt-2.5 border-t border-[#161C30]">
                <View
                  style={{ backgroundColor: extractionDetails.dotColor }}
                  className="w-2 h-2 rounded-full mt-1.5 mr-2.5"
                />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[12.5px] font-semibold text-white">
                      Text Extraction
                    </Text>
                    <Text
                      className={`text-[11px] font-bold ${extractionDetails.textColorClass}`}
                    >
                      {extractionDetails.label}
                    </Text>
                  </View>
                  <Text className="text-[11.5px] text-[#8E96B0] mt-0.5">
                    {extractionDetails.explanation}
                  </Text>
                </View>
              </View>

              {/* 3. AI Writing Analysis */}
              <View className="flex-row items-start mb-3 pt-2.5 border-t border-[#161C30]">
                <View
                  style={{ backgroundColor: analysisDetails.dotColor }}
                  className="w-2 h-2 rounded-full mt-1.5 mr-2.5"
                />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[12.5px] font-semibold text-white">
                      Analysis Status
                    </Text>
                    <Text
                      className={`text-[11px] font-bold ${analysisDetails.textColorClass}`}
                    >
                      {analysisDetails.label}
                    </Text>
                  </View>
                  <Text className="text-[11.5px] text-[#8E96B0] mt-0.5">
                    {analysisDetails.explanation}
                  </Text>
                </View>
              </View>

              {/* 4. Faculty Review */}
              <View className="flex-row items-start pt-2.5 border-t border-[#161C30]">
                <View
                  style={{ backgroundColor: reviewDetails.dotColor }}
                  className="w-2 h-2 rounded-full mt-1.5 mr-2.5"
                />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[12.5px] font-semibold text-white">
                      Review Status
                    </Text>
                    <Text
                      className={`text-[11px] font-bold ${reviewDetails.textColorClass}`}
                    >
                      {reviewDetails.label}
                    </Text>
                  </View>
                  <Text className="text-[11.5px] text-[#8E96B0] mt-0.5">
                    {reviewDetails.explanation}
                  </Text>
                </View>
              </View>
            </View>

            {/* Metadata Rows */}
            <View className="bg-[#0B0E1B] border border-[#1A2138] rounded-2xl p-4 mb-4">
              <View className="flex-row justify-between py-1.5 border-b border-[#161C30]">
                <Text className="text-[12px] text-[#64748B]">
                  Submission ID
                </Text>
                <Text
                  className="text-[12px] font-semibold text-[#E2E8F0] max-w-[65%]"
                  numberOfLines={1}
                >
                  {assignment.id}
                </Text>
              </View>

              <View className="flex-row justify-between py-1.5 border-b border-[#161C30]">
                <Text className="text-[12px] text-[#64748B]">
                  Submitted Date
                </Text>
                <Text className="text-[12px] font-semibold text-[#E2E8F0]">
                  {assignment.submittedDate || "—"}
                </Text>
              </View>

              {displayFileName ? (
                <View className="flex-row justify-between py-1.5 border-b border-[#161C30]">
                  <Text className="text-[12px] text-[#64748B]">File Name</Text>
                  <Text
                    className="text-[12px] font-semibold text-[#38BDF8] max-w-[60%]"
                    numberOfLines={1}
                  >
                    {displayFileName}
                  </Text>
                </View>
              ) : null}

              {assignment.fileCategory ? (
                <View className="flex-row justify-between py-1.5 border-b border-[#161C30]">
                  <Text className="text-[12px] text-[#64748B]">
                    File Format
                  </Text>
                  <Text className="text-[12px] font-semibold text-[#E2E8F0]">
                    {assignment.fileCategory}
                    {assignment.fileExtension
                      ? ` (${assignment.fileExtension})`
                      : ""}
                  </Text>
                </View>
              ) : null}

              {typeof assignment.wordCount === "number" && assignment.wordCount > 0 ? (
                <View className="flex-row justify-between py-1.5 border-b border-[#161C30]">
                  <Text className="text-[12px] text-[#64748B]">Word Count</Text>
                  <Text className="text-[12px] font-semibold text-[#E2E8F0]">
                    {assignment.wordCount.toLocaleString()} words
                  </Text>
                </View>
              ) : null}

              {typeof assignment.fileSize === "number" ? (
                <View className="flex-row justify-between py-1.5">
                  <Text className="text-[12px] text-[#64748B]">File Size</Text>
                  <Text className="text-[12px] font-semibold text-[#E2E8F0]">
                    {formatFileSizeMB(assignment.fileSize)}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Student Submission Notes (if provided) */}
            {assignment.notes ? (
              <View className="bg-[#0B0E1B] border border-[#1A2138] rounded-2xl p-4 mb-4">
                <Text className="text-[11px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase mb-1.5">
                  Student Notes
                </Text>
                <Text className="text-[12.5px] leading-[19px] text-[#CBD5E1]">
                  {assignment.notes}
                </Text>
              </View>
            ) : null}

            {/* Summary Note */}
            <View className="bg-[#0B0E1B] border border-[#1A2138] rounded-2xl p-4 mb-4">
              <Text className="text-[11px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase mb-1.5">
                Review Summary Note
              </Text>
              <Text className="text-[12.5px] leading-[19px] text-[#CBD5E1]">
                {assignment.summaryNote ||
                  "Submission received and queued for writing analysis."}
              </Text>
            </View>

            {/* Integrity Note */}
            <View className="bg-[#101C2E] border border-[#1E3A5F] rounded-xl p-3 mb-4 flex-row items-start">
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color="#38BDF8"
                style={{ marginTop: 1, marginRight: 8 }}
              />
              <Text className="flex-1 text-[11.5px] leading-[17px] text-[#94A3B8]">
                Verified record from your VeriWrite student account. Writing
                analysis indicators are always reviewed in academic context by
                your instructor.
              </Text>
            </View>
          </ScrollView>

          {/* Action Button: View Report or Analyze Writing */}
          {assignment.analysisStatus === "Completed" && typeof onViewReport === "function" ? (
            <Pressable
              onPress={() => {
                onClose();
                onViewReport(assignment);
              }}
              className="w-full h-[44px] bg-[#16203D] border border-[#293B6B] rounded-xl flex-row items-center justify-center mb-2.5 active:opacity-85"
              accessibilityRole="button"
              accessibilityLabel="View full analysis report"
            >
              <Ionicons
                name="analytics-outline"
                size={16}
                color="#38BDF8"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[13.5px] font-bold text-white">
                View Full Analysis Report
              </Text>
            </Pressable>
          ) : assignment.extractionStatus === "Completed" && typeof onAnalyze === "function" ? (
            <Pressable
              onPress={() => {
                onClose();
                onAnalyze(assignment);
              }}
              className="w-full h-[44px] bg-[#16203D] border border-[#293B6B] rounded-xl flex-row items-center justify-center mb-2.5 active:opacity-85"
              accessibilityRole="button"
              accessibilityLabel="Analyze writing now"
            >
              <Ionicons
                name="sparkles-outline"
                size={16}
                color="#38BDF8"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[13.5px] font-bold text-white">
                {assignment.analysisStatus === "Failed"
                  ? "Retry Writing Analysis"
                  : "Analyze Writing Now"}
              </Text>
            </Pressable>
          ) : null}

          {/* Close Button */}
          <Pressable
            onPress={onClose}
            className="w-full h-[44px] bg-[#1E2642] border border-[#2E3A63] rounded-xl items-center justify-center mt-1 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Close modal"
          >
            <Text className="text-[13.5px] font-bold text-white">
              Close Details
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(5, 7, 15, 0.78)",
  },
});
