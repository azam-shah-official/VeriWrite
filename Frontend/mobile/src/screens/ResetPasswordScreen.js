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

export default function ResetPasswordScreen({
  resetToken,
  onResetSuccess,
  onNavigateForgotPassword,
  onBackToSignIn,
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [errors, setErrors] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const hasValidTokenString =
    typeof resetToken === "string" && resetToken.trim().length > 0;

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

  const handleNewPasswordChange = (text) => {
    setNewPassword(text);
    if (errors.newPassword) {
      setErrors((prev) => ({ ...prev, newPassword: "" }));
    }
    if (apiError) {
      setApiError("");
    }
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    if (errors.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
    }
    if (apiError) {
      setApiError("");
    }
  };

  const handleUpdatePassword = async () => {
    if (isLoading) {
      return;
    }

    if (!hasValidTokenString) {
      setApiError(
        "Password reset token is missing or invalid. Please request a new reset link."
      );
      return;
    }

    const validationErrors = { newPassword: "", confirmPassword: "" };
    let isValid = true;

    if (!newPassword.trim()) {
      validationErrors.newPassword = "New password is required.";
      isValid = false;
    } else if (newPassword.length < 8) {
      validationErrors.newPassword =
        "New password must be at least 8 characters long.";
      isValid = false;
    }

    if (!confirmPassword.trim()) {
      validationErrors.confirmPassword = "Confirm password is required.";
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      validationErrors.confirmPassword = "Passwords do not match.";
      isValid = false;
    }

    setErrors(validationErrors);
    setApiError("");

    if (!isValid) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        AUTH_ENDPOINTS.RESET_PASSWORD(resetToken.trim()),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ password: newPassword }),
        }
      );

      let data = null;
      try {
        data = await response.json();
      } catch (_parseErr) {
        data = null;
      }

      if (!response.ok || !data?.success) {
        setApiError(
          data?.message ||
            "Password reset token is invalid or has expired. Please request a new link."
        );
        return;
      }

      const finalMessage =
        data.message ||
        "Password has been reset successfully. You can now sign in with your new password.";

      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(finalMessage);
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
            {/* Centered Reset Password Card */}
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
                Reset Password
              </Text>

              {/* Description */}
              <Text className="text-[13px] leading-[19px] text-[#8E96B0] text-center mb-6 px-2">
                Enter and confirm your new password{"\n"}to secure your VeriWrite account
              </Text>

              {!hasValidTokenString ? (
                /* Graceful Fallback for Missing or Malformed Reset Token */
                <View>
                  <View className="flex-row items-center bg-[#2A121B] border border-[#EF4444]/40 rounded-xl px-3.5 py-3 mb-5">
                    <Ionicons
                      name="alert-circle-outline"
                      size={18}
                      color="#F87171"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="flex-1 text-[12px] leading-[17px] text-[#FCA5A5]">
                      This password reset link is missing or invalid. Please request a new verification link.
                    </Text>
                  </View>

                  <GradientButton
                    title="Request New Link"
                    onPress={onNavigateForgotPassword}
                  />

                  <Pressable
                    onPress={onBackToSignIn}
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
              ) : successMessage ? (
                /* Successful Password Reset State */
                <View>
                  <View className="flex-row items-center bg-[#0D2824] border border-[#10B981]/40 rounded-xl px-3.5 py-3 mb-5">
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color="#34D399"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="flex-1 text-[12.5px] leading-[18px] text-[#A7F3D0]">
                      {successMessage}
                    </Text>
                  </View>

                  <GradientButton
                    title="Return to Sign In"
                    onPress={() => {
                      if (onResetSuccess) {
                        onResetSuccess(successMessage);
                      } else if (onBackToSignIn) {
                        onBackToSignIn();
                      }
                    }}
                  />
                </View>
              ) : (
                /* Active Reset Password Form */
                <View>
                  {/* API Error Banner */}
                  {apiError ? (
                    <View className="mb-4">
                      <View className="flex-row items-center bg-[#2A121B] border border-[#EF4444]/40 rounded-xl px-3.5 py-2.5">
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
                      {onNavigateForgotPassword ? (
                        <Pressable
                          onPress={onNavigateForgotPassword}
                          disabled={isLoading}
                          className="items-end mt-2"
                        >
                          <Text className="text-[12px] font-semibold text-[#38BDF8]">
                            Request a new reset link →
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  {/* New Password Input */}
                  <CustomInput
                    label="New Password"
                    iconName="lock-closed-outline"
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChangeText={handleNewPasswordChange}
                    secureTextEntry={!isNewPasswordVisible}
                    showPasswordToggle={true}
                    isPasswordVisible={isNewPasswordVisible}
                    onTogglePassword={() =>
                      setIsNewPasswordVisible((prev) => !prev)
                    }
                    autoCapitalize="none"
                    error={errors.newPassword}
                  />

                  {/* Confirm Password Input */}
                  <CustomInput
                    label="Confirm Password"
                    iconName="lock-closed-outline"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    secureTextEntry={!isConfirmPasswordVisible}
                    showPasswordToggle={true}
                    isPasswordVisible={isConfirmPasswordVisible}
                    onTogglePassword={() =>
                      setIsConfirmPasswordVisible((prev) => !prev)
                    }
                    autoCapitalize="none"
                    error={errors.confirmPassword}
                  />

                  {/* Submit Reset Password Button */}
                  <View className="mt-1">
                    <GradientButton
                      title="Update Password"
                      loadingTitle="Updating Password..."
                      onPress={handleUpdatePassword}
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
              )}
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
