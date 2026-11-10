import React from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function RoleSelectorCard({
  title,
  subtitle,
  iconName,
  isSelected,
  onSelect,
}) {
  return (
    <Pressable
      onPress={onSelect}
      className="flex-1 active:opacity-90"
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${title} role, ${subtitle}`}
    >
      <LinearGradient
        colors={
          isSelected
            ? ["#2B3358", "#1F2642"]
            : ["#15192B", "#131726"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          isSelected ? styles.activeCardBorder : styles.inactiveCardBorder,
        ]}
      >
        {/* Active Cyan Checkmark Badge */}
        {isSelected && (
          <View
            style={styles.checkBadge}
            className="absolute top-2.5 right-2.5 w-[18px] h-[18px] rounded-full bg-[#38BDF8] items-center justify-center"
          >
            <Ionicons name="checkmark" size={12} color="#090D1A" />
          </View>
        )}

        {/* Icon Container */}
        <View
          className={`w-10 h-10 rounded-xl items-center justify-center mb-3 ${
            isSelected
              ? "bg-[#0B1021] border border-[#1E2B4A]"
              : "bg-[#0D1120] border border-[#1A2035]"
          }`}
        >
          <Ionicons
            name={iconName}
            size={20}
            color={isSelected ? "#38BDF8" : "#64748B"}
          />
        </View>

        {/* Role Title */}
        <Text
          className={`text-[15px] font-bold mb-0.5 ${
            isSelected ? "text-white" : "text-[#E2E8F0]"
          }`}
        >
          {title}
        </Text>

        {/* Role Subtitle */}
        <Text
          className={`text-[11px] text-center ${
            isSelected ? "text-[#94A3B8]" : "text-[#64748B]"
          }`}
        >
          {subtitle}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    minHeight: 118,
  },
  activeCardBorder: {
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  inactiveCardBorder: {
    borderWidth: 1,
    borderColor: "#20263E",
  },
  checkBadge: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
});
