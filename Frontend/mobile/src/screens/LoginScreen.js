import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  BackHandler,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import HeaderSection from "../components/HeaderSection";
import RoleSelectorCard from "../components/RoleSelectorCard";
import CustomInput from "../components/CustomInput";
import GradientButton from "../components/GradientButton";
import { AUTH_ENDPOINTS } from "../config/api";
import { saveAuthSession } from "../utils/authStorage";

export default function LoginScreen({
  onNavigateForgotPassword,
  onLoginSuccess,
  resetSuccessMessage,
  onClearResetMessage,
}) {
  const [selectedRole, setSelectedRole] = useState("TEACHER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });

  // Prevent Android hardware back button from returning to any previous dashboard after logout
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );
    return () => backSubscription.remove();
  }, []);

  const handleEmailChange = (text) => {
    setEmail(text);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: "" }));
    }
    if (apiError) {
      setApiError("");
    }
    if (resetSuccessMessage && onClearResetMessage) {
      onClearResetMessage();
    }
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: "" }));
    }
    if (apiError) {
      setApiError("");
    }
    if (resetSuccessMessage && onClearResetMessage) {
      onClearResetMessage();
    }
  };

  const handleRoleSelect = (role) => {
    if (isLoading) {
      return;
    }
    setSelectedRole(role);
    if (apiError) {
      setApiError("");
    }
  };

  const validateAndSignIn = async () => {
    if (isLoading) {
      return;
    }

    const newErrors = { email: "", password: "" };
    let isValid = true;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = "Academic email is required.";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid academic email address.";
      isValid = false;
    }

    if (!password.trim()) {
      newErrors.password = "Password is required.";
      isValid = false;
    }

    setErrors(newErrors);
    setApiError("");

    if (!isValid) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(AUTH_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          role: selectedRole,
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_parseErr) {
        data = null;
      }

      if (!response.ok || !data?.success) {
        const backendMessage =
          data?.message ||
          "Unable to sign in. Please check your credentials and try again.";
        setApiError(backendMessage);
        return;
      }

      if (!data.token || !data.user) {
        setApiError("Received an incomplete authentication response from server.");
        return;
      }

      // Persist JWT token and safe user profile securely in Expo SecureStore (never log token)
      const safeUser = await saveAuthSession(data.token, data.user);

      setPassword("");

      if (onLoginSuccess) {
        onLoginSuccess(safeUser);
      } else {
        Alert.alert(
          "Login Successful",
          `Welcome back, ${safeUser.name} (${safeUser.role}).`
        );
      }
    } catch (_networkError) {
      setApiError(
        "Unable to connect to the VeriWrite server. Ensure the backend is running and your device is on the same Wi-Fi network."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (isLoading) {
      return;
    }
    if (onNavigateForgotPassword) {
      onNavigateForgotPassword();
    }
  };

  return (
    <View className="flex-1 bg-[#0A0D1A]">
      {/* Subtle Top & Ambient Background Gradient Glow */}
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
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 22,
              paddingTop: 12,
              paddingBottom: 32,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Section */}
            <HeaderSection />

            {/* Role Selection Section */}
            <View className="mt-2 mb-5">
              <View className="flex-row items-center justify-between mb-3 px-0.5">
                <Text className="text-[11px] font-bold tracking-[1.2px] text-[#94A3B8] uppercase">
                  SELECT ROLE
                </Text>
                <Text className="text-[11px] font-bold tracking-[1.2px] text-[#38BDF8] uppercase">
                  ACTIVE // {selectedRole}
                </Text>
              </View>

              <View className="flex-row gap-3.5">
                <RoleSelectorCard
                  title="Teacher"
                  subtitle="Instructor & Reviewer"
                  iconName="school-outline"
                  isSelected={selectedRole === "TEACHER"}
                  onSelect={() => handleRoleSelect("TEACHER")}
                />
                <RoleSelectorCard
                  title="Student"
                  subtitle="Author & Submitter"
                  iconName="book-outline"
                  isSelected={selectedRole === "STUDENT"}
                  onSelect={() => handleRoleSelect("STUDENT")}
                />
              </View>
            </View>

            {/* Credentials Form Card */}
            <View
              style={styles.formCard}
              className="bg-[#15182B] border border-[#232944] rounded-[22px] p-5"
            >
              {/* Password Reset Success Banner */}
              {resetSuccessMessage ? (
                <View className="flex-row items-center bg-[#0D2824] border border-[#10B981]/40 rounded-xl px-3.5 py-2.5 mb-4">
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#34D399"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="flex-1 text-[12px] leading-[17px] text-[#A7F3D0]">
                    {resetSuccessMessage}
                  </Text>
                </View>
              ) : null}

              {/* Backend / Network Error Alert Banner */}
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

              {/* Academic Email Input */}
              <CustomInput
                label="Academic Email"
                rightLabel="SSO ENABLED"
                iconName="at"
                placeholder="name@institution.edu"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />

              {/* Password Input */}
              <CustomInput
                label="Password"
                iconName="lock-closed-outline"
                placeholder="••••••••••••"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!isPasswordVisible}
                showPasswordToggle={true}
                isPasswordVisible={isPasswordVisible}
                onTogglePassword={() =>
                  setIsPasswordVisible((prev) => !prev)
                }
                autoCapitalize="none"
                error={errors.password}
              />

              {/* Forgot Password Link */}
              <View className="items-end mt-0.5 mb-5">
                <Pressable
                  onPress={handleForgotPassword}
                  disabled={isLoading}
                  hitSlop={8}
                  className="active:opacity-75"
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password"
                >
                  <Text className="text-[12px] font-semibold text-[#38BDF8]">
                    Forgot Password?
                  </Text>
                </Pressable>
              </View>

              {/* Sign In Button */}
              <GradientButton
                title="Sign In"
                onPress={validateAndSignIn}
                loading={isLoading}
                disabled={isLoading}
              />
            </View>

            {/* Footer */}
            <View className="flex-row items-center justify-center mt-6">
              <View
                style={styles.greenDotGlow}
                className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-2.5"
              />
              <Text className="text-[10.5px] font-semibold tracking-[1.4px] text-[#64748B] uppercase">
                256-BIT FORENSIC INTEGRITY GUARANTEED
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  greenDotGlow: {
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
});
