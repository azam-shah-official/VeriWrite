import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const getStatusAppearance = (statusText) => {
  if (statusText === "Completed" || statusText === "Submitted") {
    return {
      dotColor: "#10B981",
      textColorClass: "text-[#10B981]",
    };
  }
  if (statusText === "Failed") {
    return {
      dotColor: "#EF4444",
      textColorClass: "text-[#F87171]",
    };
  }
  if (statusText === "NotSupported") {
    return {
      dotColor: "#94A3B8",
      textColorClass: "text-[#94A3B8]",
    };
  }
  return {
    dotColor: "#F59E0B",
    textColorClass: "text-[#F59E0B]",
  };
};

const formatExtractionLabel = (status) => {
  if (status === "NotSupported") {
    return "Not Supported";
  }
  return status || "Pending";
};

export default function AssignmentCard({ assignment, onPressDetails }) {
  const extractionStatus = assignment.extractionStatus || "Pending";
  const analysisStatus = assignment.analysisStatus || "Pending";
  const reviewStatus = assignment.reviewStatus || "Pending";

  const extractionAppearance = getStatusAppearance(extractionStatus);
  const analysisAppearance = getStatusAppearance(analysisStatus);
  const reviewAppearance = getStatusAppearance(reviewStatus);

  return (
    <View className="bg-[#14192C] border border-[#222943] rounded-[20px] p-4 mb-3.5">
      {/* Assignment Title */}
      <Text className="text-[15px] font-bold text-white mb-1.5" numberOfLines={2}>
        {assignment.title}
      </Text>

      {/* Submission Date & Word Count */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons
            name="calendar-outline"
            size={13}
            color="#64748B"
            style={{ marginRight: 6 }}
          />
          <Text className="text-[12px] text-[#8E96B0]">
            {assignment.submittedDate || "—"}
          </Text>
        </View>

        {typeof assignment.wordCount === "number" && assignment.wordCount > 0 ? (
          <Text className="text-[11.5px] text-[#64748B]">
            {assignment.wordCount.toLocaleString()} words
          </Text>
        ) : null}
      </View>

      {/* Status Box (2x2 Grid) */}
      <View className="bg-[#0C0F1D] border border-[#192036] rounded-xl p-3 my-3">
        {/* Row 1: Submission & Extraction */}
        <View className="flex-row justify-between mb-2.5">
          {/* Submission Status */}
          <View className="flex-1 pr-2">
            <Text className="text-[10px] uppercase tracking-[0.5px] text-[#64748B] mb-0.5">
              Submission Status
            </Text>
            <View className="flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5" />
              <Text className="text-[12px] font-semibold text-[#10B981]">
                Submitted
              </Text>
            </View>
          </View>

          {/* Text Extraction */}
          <View className="flex-1 pl-2 border-l border-[#192036]">
            <Text className="text-[10px] uppercase tracking-[0.5px] text-[#64748B] mb-0.5">
              Text Extraction
            </Text>
            <View className="flex-row items-center">
              <View
                style={{ backgroundColor: extractionAppearance.dotColor }}
                className="w-1.5 h-1.5 rounded-full mr-1.5"
              />
              <Text
                className={`text-[12px] font-semibold ${extractionAppearance.textColorClass}`}
                numberOfLines={1}
              >
                {formatExtractionLabel(extractionStatus)}
              </Text>
            </View>
          </View>
        </View>

        {/* Row 2: Analysis & Review */}
        <View className="flex-row justify-between pt-2.5 border-t border-[#192036]">
          {/* Analysis Status */}
          <View className="flex-1 pr-2">
            <Text className="text-[10px] uppercase tracking-[0.5px] text-[#64748B] mb-0.5">
              Analysis Status
            </Text>
            <View className="flex-row items-center">
              <View
                style={{ backgroundColor: analysisAppearance.dotColor }}
                className="w-1.5 h-1.5 rounded-full mr-1.5"
              />
              <Text
                className={`text-[12px] font-semibold ${analysisAppearance.textColorClass}`}
                numberOfLines={1}
              >
                {analysisStatus}
              </Text>
            </View>
          </View>

          {/* Review Status */}
          <View className="flex-1 pl-2 border-l border-[#192036]">
            <Text className="text-[10px] uppercase tracking-[0.5px] text-[#64748B] mb-0.5">
              Review Status
            </Text>
            <View className="flex-row items-center">
              <View
                style={{ backgroundColor: reviewAppearance.dotColor }}
                className="w-1.5 h-1.5 rounded-full mr-1.5"
              />
              <Text
                className={`text-[12px] font-semibold ${reviewAppearance.textColorClass}`}
                numberOfLines={1}
              >
                {reviewStatus}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* View Details Button */}
      <Pressable
        onPress={() => onPressDetails && onPressDetails(assignment)}
        className="w-full h-[42px] bg-[#080B14] border border-[#1A2138] rounded-xl flex-row items-center justify-center active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`View details for ${assignment.title}`}
      >
        <Text className="text-[13px] font-bold text-white mr-1.5">
          View Details
        </Text>
        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
