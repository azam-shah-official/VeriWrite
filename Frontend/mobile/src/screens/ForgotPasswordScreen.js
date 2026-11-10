import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  BackHandler,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import VeriWriteLogo from "../components/VeriWriteLogo";
import CustomInput from "../components/CustomInput";
import GradientButton from "../components/GradientButton";
import { AUTH_ENDPOINTS } from "../config/api";

export default function ForgotPasswordScreen({ onBackToSignIn }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isLoading && onBackToSignIn) {
          onBackToSignIn();
          return true;
        }
        return false;
      }
    );

    return () => backSubscription.remove();
  }, [isLoading, onBackToSignIn]);

  const handleEmailChange = (text) => {
    setEmail(text);
    if (error) {
      setError("");
    }
    if (apiError) {
      setApiError("");
    }
    if (successMessage) {
      setSuccessMessage("");
    }
  };

  const handleResetPassword = async () => {
    if (isLoading) {
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Registered email is required.");
      setApiError("");
      setSuccessMessage("");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setError("Please enter a valid registered email address.");
      setApiError("");
      setSuccessMessage("");
      return;
    }

    setError("");
    setApiError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(AUTH_ENDPOINTS.FORGOT_PASSWORD, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_parseErr) {
        data = null;
      }

      if (!response.ok || !data?.success) {
        setApiError(
          data?.message ||
            "Unable to process password reset request. Please try again."
        );
        return;
      }

      setSuccessMessage(
        data.message ||
          "If an account with that email exists, a password reset link has been sent."
      );
    } catch (_networkError) {
      setApiError(
        "Unable to connect to the VeriWrite server. Ensure the backend is running and your device is on the same Wi-Fi network."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#0A0D1A]">
      {/* Subtle Ambient Background Gradient Glow */}
      <LinearGradient
        colors={["#161F42", "#0D1226", "#0A0D1A"]}
        locations={[0, 0.38, 0.85]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Centered Forgot Password Card */}
            <View
              style={styles.cardShadow}
              className="w-full max-w-[400px] bg-[#15182B] border border-[#232944] rounded-[24px] p-6"
            >
              {/* VeriWrite Logo */}
              <View className="items-center mb-5">
                <VeriWriteLogo size="md" />
              </View>

              {/* Heading */}
              <Text className="text-[24px] font-bold text-white text-center tracking-tight mb-2">
                Forgot Password
              </Text>

              {/* Description */}
              <Text className="text-[13px] leading-[19px] text-[#8E96B0] text-center mb-6 px-2">
                Enter your registered email to receive an{"\n"}instant verification link
              </Text>

              {/* API Error Banner */}
              {apiError ? (
                <View className="flex-row items-center bg-[#2A121B] border border-[#EF4444]/40 rounded-xl px-3.5 py-2.5 mb-4">
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#F87171"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="flex-1 text-[12px] leading-[17px] text-[#FCA5A5]">
                    {apiError}
                  </Text>
                </View>
              ) : null}

              {/* API Success Banner */}
              {successMessage ? (
                <View className="flex-row items-center bg-[#0D2824] border border-[#10B981]/40 rounded-xl px-3.5 py-2.5 mb-4">
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#34D399"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="flex-1 text-[12px] leading-[17px] text-[#A7F3D0]">
                    {successMessage}
                  </Text>
                </View>
              ) : null}

              {/* Registered Email Input */}
              <CustomInput
                label="Registered Email"
                iconName="mail-outline"
                placeholder="Enter your registered email address"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                error={error}
              />

              {/* Reset Password Gradient Button */}
              <View className="mt-1">
                <GradientButton
                  title="Reset Password"
                  loadingTitle="Sending Link..."
                  onPress={handleResetPassword}
                  loading={isLoading}
                  disabled={isLoading}
                />
              </View>

              {/* Back to Sign In Secondary Button */}
              <Pressable
                onPress={onBackToSignIn}
                disabled={isLoading}
                className="w-full h-[48px] rounded-xl bg-[#101323] border border-[#1E243D] flex-row items-center justify-center mt-3.5 active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel="Back to Sign In"
              >
                <Ionicons name="arrow-back" size={16} color="#E2E8F0" />
                <Text className="text-[14px] font-semibold text-[#E2E8F0] ml-2">
                  Back to Sign In
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  cardShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
});
