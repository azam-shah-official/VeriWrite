import React from "react";
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function GradientButton({
  title,
  loadingTitle = "Signing In...",
  onPress,
  loading = false,
  disabled = false,
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.glowContainer, isDisabled && styles.disabledContainer]}
      className="w-full active:opacity-90"
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <LinearGradient
        colors={["#5B50EB", "#4B7BF5", "#38BDF8"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      >
        {loading ? (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text className="text-white font-bold text-[15px] ml-2.5">
              {loadingTitle}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center justify-center">
            <Text className="text-white font-bold text-[15px] mr-2">
              {title}
            </Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glowContainer: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  disabledContainer: {
    opacity: 0.75,
  },
  gradient: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
});
