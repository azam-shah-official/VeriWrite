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

export default function AssignmentDetailModal({
  visible,
  assignment,
  onClose,
}) {
  if (!assignment) {
    return null;
  }

  const isAnalysisCompleted = assignment.analysisStatus === "Completed";
  const isReviewCompleted = assignment.reviewStatus === "Completed";

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

            {/* Status Grid */}
            <View className="bg-[#0B0E1B] border border-[#1A2138] rounded-2xl p-3.5 mb-4 flex-row">
              <View className="flex-1 pr-2">
                <Text className="text-[10.5px] text-[#64748B] uppercase tracking-[0.8px] mb-1">
                  Analysis Status
                </Text>
                <View className="flex-row items-center">
                  <View
                    style={{
                      backgroundColor: isAnalysisCompleted
                        ? "#10B981"
                        : "#F59E0B",
                    }}
                    className="w-2 h-2 rounded-full mr-1.5"
                  />
                  <Text
                    className={`text-[13px] font-bold ${
                      isAnalysisCompleted
                        ? "text-[#10B981]"
                        : "text-[#F59E0B]"
                    }`}
                  >
                    {assignment.analysisStatus}
                  </Text>
                </View>
              </View>

              <View className="flex-1 pl-2 border-l border-[#1A2138]">
                <Text className="text-[10.5px] text-[#64748B] uppercase tracking-[0.8px] mb-1">
                  Review Status
                </Text>
                <View className="flex-row items-center">
                  <View
                    style={{
                      backgroundColor: isReviewCompleted
                        ? "#10B981"
                        : "#F59E0B",
                    }}
                    className="w-2 h-2 rounded-full mr-1.5"
                  />
                  <Text
                    className={`text-[13px] font-bold ${
                      isReviewCompleted ? "text-[#10B981]" : "text-[#F59E0B]"
                    }`}
                  >
                    {assignment.reviewStatus}
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
                <Text className="text-[12px] font-semibold text-[#E2E8F0]">
                  {assignment.id}
                </Text>
              </View>

              <View className="flex-row justify-between py-1.5 border-b border-[#161C30]">
                <Text className="text-[12px] text-[#64748B]">
                  Submitted Date
                </Text>
                <Text className="text-[12px] font-semibold text-[#E2E8F0]">
                  {assignment.submittedDate}
                </Text>
              </View>

              {assignment.fileName ? (
                <View className="flex-row justify-between py-1.5 border-b border-[#161C30]">
                  <Text className="text-[12px] text-[#64748B]">File Name</Text>
                  <Text
                    className="text-[12px] font-semibold text-[#38BDF8] max-w-[60%]"
                    numberOfLines={1}
                  >
                    {assignment.fileName}
                  </Text>
                </View>
              ) : null}

              {assignment.wordCount ? (
                <View className="flex-row justify-between py-1.5">
                  <Text className="text-[12px] text-[#64748B]">Word Count</Text>
                  <Text className="text-[12px] font-semibold text-[#E2E8F0]">
                    {assignment.wordCount.toLocaleString()} words
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Summary Note */}
            <View className="bg-[#0B0E1B] border border-[#1A2138] rounded-2xl p-4 mb-4">
              <Text className="text-[11px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase mb-1.5">
                Review Summary Note
              </Text>
              <Text className="text-[12.5px] leading-[19px] text-[#CBD5E1]">
                {assignment.summaryNote ||
                  "This submission is recorded in your assignment history."}
              </Text>
            </View>

            {/* Honest Sample Data & Integrity Note */}
            <View className="bg-[#101C2E] border border-[#1E3A5F] rounded-xl p-3 mb-4 flex-row items-start">
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#38BDF8"
                style={{ marginTop: 1, marginRight: 8 }}
              />
              <Text className="flex-1 text-[11.5px] leading-[17px] text-[#94A3B8]">
                Displayed from the local sample assignment dataset. Detailed
                sentence-level writing evidence and instructor feedback will
                appear here once the Submissions API is connected.
              </Text>
            </View>
          </ScrollView>

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
