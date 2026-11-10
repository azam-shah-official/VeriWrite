import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  BackHandler,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import VeriWriteLogo from "../components/VeriWriteLogo";

export default function TeacherDashboard({ user, onLogout }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Prevent Android back navigation from leaving or reopening prior screens while on dashboard
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );
    return () => backSubscription.remove();
  }, []);

  const handleLogoutPress = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View className="flex-1 bg-[#0A0D1A]">
      <LinearGradient
        colors={["#161F42", "#0D1226", "#0A0D1A"]}
        locations={[0, 0.38, 0.85]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView className="flex-1 justify-center items-center px-6">
        <View
          style={styles.cardShadow}
          className="w-full max-w-[400px] bg-[#15182B] border border-[#232944] rounded-[24px] p-6 items-center"
        >
          <View className="mb-4">
            <VeriWriteLogo size="md" />
          </View>

          <View className="flex-row items-center bg-[#112236] border border-[#1B3552] rounded-full px-3.5 py-1 mb-3">
            <Ionicons
              name="school-outline"
              size={12}
              color="#38BDF8"
              style={{ marginRight: 6 }}
            />
            <Text className="text-[10px] font-bold tracking-[1.4px] text-[#38BDF8] uppercase">
              ROLE // {user?.role || "TEACHER"}
            </Text>
          </View>

          <Text className="text-[24px] font-bold text-white text-center mb-1">
            Teacher Dashboard
          </Text>
          <Text className="text-[13px] text-[#8E96B0] text-center mb-6">
            Instructor & Reviewer Workspace
          </Text>

          {/* User Info Box */}
          <View className="w-full bg-[#080A14] border border-[#1C2237] rounded-2xl p-4 mb-6">
            <View className="mb-3">
              <Text className="text-[10.5px] font-semibold tracking-[1px] text-[#64748B] uppercase mb-0.5">
                INSTRUCTOR NAME
              </Text>
              <Text className="text-[15px] font-bold text-white">
                {user?.name || "Teacher"}
              </Text>
            </View>

            <View className="mb-3">
              <Text className="text-[10.5px] font-semibold tracking-[1px] text-[#64748B] uppercase mb-0.5">
                ACADEMIC EMAIL
              </Text>
              <Text className="text-[13.5px] text-[#CBD5E1]">
                {user?.email || ""}
              </Text>
            </View>

            {user?.institution ? (
              <View className="mb-3">
                <Text className="text-[10.5px] font-semibold tracking-[1px] text-[#64748B] uppercase mb-0.5">
                  INSTITUTION
                </Text>
                <Text className="text-[13.5px] text-[#CBD5E1]">
                  {user.institution}
                </Text>
              </View>
            ) : null}

            <View>
              <Text className="text-[10.5px] font-semibold tracking-[1px] text-[#64748B] uppercase mb-0.5">
                ACCOUNT ROLE
              </Text>
              <Text className="text-[13.5px] font-semibold text-[#38BDF8]">
                {user?.role || "TEACHER"}
              </Text>
            </View>
          </View>

          {/* Logout Button */}
          <Pressable
            onPress={handleLogoutPress}
            disabled={isLoggingOut}
            className="w-full h-[48px] rounded-xl bg-[#2A121B] border border-[#EF4444]/40 flex-row items-center justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#F87171" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color="#F87171" />
                <Text className="text-[14px] font-bold text-[#FCA5A5] ml-2">
                  Logout
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
});
