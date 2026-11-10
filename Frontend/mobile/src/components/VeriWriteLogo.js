import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function VeriWriteLogo({ size = "lg" }) {
  const isLarge = size === "lg";
  const boxSizeClass = isLarge
    ? "w-20 h-20 rounded-[20px]"
    : "w-14 h-14 rounded-[16px]";
  const innerSizeClass = isLarge
    ? "w-12 h-12 rounded-[14px]"
    : "w-9 h-9 rounded-[11px]";
  const iconSize = isLarge ? 28 : 20;

  return (
    <View
      style={isLarge ? styles.logoGlowLarge : styles.logoGlowMedium}
      className="items-center justify-center"
    >
      <LinearGradient
        colors={["#181F38", "#101426"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.outerBox}
        className={`${boxSizeClass} border border-[#283254] items-center justify-center`}
      >
        <View
          className={`${innerSizeClass} bg-[#0B1020] border border-[#1E2D4F] items-center justify-center`}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={iconSize}
            color="#38BDF8"
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  logoGlowLarge: {
    shadowColor: "#4F6BFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 14,
  },
  logoGlowMedium: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  outerBox: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
});
