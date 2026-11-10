import React from "react";
import { View, Text, StyleSheet } from "react-native";
import VeriWriteLogo from "./VeriWriteLogo";

export default function HeaderSection() {
  return (
    <View className="items-center pt-4 pb-6">
      {/* Centered Rounded-Square VeriWrite Logo with Ambient Glow */}
      <View className="mb-4 items-center justify-center">
        <VeriWriteLogo size="lg" />
      </View>

      {/* App Name */}
      <Text className="text-[28px] font-bold text-white tracking-tight mb-2.5">
        VeriWrite
      </Text>

      {/* Tagline Pill */}
      <View className="flex-row items-center bg-[#112236] border border-[#1B3552] rounded-full px-3.5 py-1 mb-3.5">
        <View
          style={styles.cyanDotGlow}
          className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] mr-2"
        />
        <Text className="text-[10px] font-bold tracking-[1.6px] text-[#38BDF8] uppercase">
          ANALYZE • VERIFY • TRUST
        </Text>
      </View>

      {/* Description */}
      <Text className="text-center text-[13px] leading-[19px] text-[#8E96B0] px-4">
        An Evidence-Based and Explainable AI Writing{"\n"}Review System for Academic Submissions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cyanDotGlow: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
});
