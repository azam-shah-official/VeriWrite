import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const getStatusAppearance = (statusText) => {
  if (statusText === "Completed") {
    return {
      dotColor: "#10B981",
      textColorClass: "text-[#10B981]",
    };
  }
  return {
    dotColor: "#F59E0B",
    textColorClass: "text-[#F59E0B]",
  };
};

export default function AssignmentCard({ assignment, onPressDetails }) {
  const analysisAppearance = getStatusAppearance(assignment.analysisStatus);
  const reviewAppearance = getStatusAppearance(assignment.reviewStatus);

  return (
    <View className="bg-[#14192C] border border-[#222943] rounded-[20px] p-4 mb-3.5">
      {/* Assignment Title */}
      <Text className="text-[15px] font-bold text-white mb-1.5">
        {assignment.title}
      </Text>

      {/* Submission Date */}
      <View className="flex-row items-center">
        <Ionicons
          name="calendar-outline"
          size={13}
          color="#64748B"
          style={{ marginRight: 6 }}
        />
        <Text className="text-[12px] text-[#8E96B0]">
          {assignment.submittedDate}
        </Text>
      </View>

      {/* Status Box */}
      <View className="bg-[#0C0F1D] border border-[#192036] rounded-xl px-3.5 py-2.5 my-3 flex-row">
        {/* Analysis Status Column */}
        <View className="flex-1 pr-2">
          <Text className="text-[10.5px] text-[#64748B] mb-1">
            Analysis Status
          </Text>
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: analysisAppearance.dotColor }}
              className="w-1.5 h-1.5 rounded-full mr-1.5"
            />
            <Text
              className={`text-[12px] font-semibold ${analysisAppearance.textColorClass}`}
            >
              {assignment.analysisStatus}
            </Text>
          </View>
        </View>

        {/* Review Status Column */}
        <View className="flex-1 pl-2">
          <Text className="text-[10.5px] text-[#64748B] mb-1">
            Review Status
          </Text>
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: reviewAppearance.dotColor }}
              className="w-1.5 h-1.5 rounded-full mr-1.5"
            />
            <Text
              className={`text-[12px] font-semibold ${reviewAppearance.textColorClass}`}
            >
              {assignment.reviewStatus}
            </Text>
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
