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
  const [authMode, setAuthMode] = useState("LOGIN"); // "LOGIN" | "REGISTER"
  const [selectedRole, setSelectedRole] = useState("TEACHER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [institution, setInstitution] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [successBanner, setSuccessBanner] = useState("");
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    institution: "",
  });

  // Prevent Android hardware back button from returning to any previous dashboard after logout
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );
    return () => backSubscription.remove();
  }, []);

  const handleModeSwitch = (mode) => {
    if (isLoading || authMode === mode) {
      return;
    }
    setAuthMode(mode);
    setApiError("");
    setSuccessBanner("");
    setErrors({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      institution: "",
    });
    setConfirmPassword("");
    if (resetSuccessMessage && onClearResetMessage) {
      onClearResetMessage();
    }
  };

  const handleNameChange = (text) => {
    setName(text);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: "" }));
    }
    if (apiError) {
      setApiError("");
    }
  };

  const handleInstitutionChange = (text) => {
    setInstitution(text);
    if (errors.institution) {
      setErrors((prev) => ({ ...prev, institution: "" }));
    }
    if (apiError) {
      setApiError("");
    }
  };

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
    if (errors.password || errors.confirmPassword) {
      setErrors((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    }
    if (apiError) {
      setApiError("");
    }
    if (resetSuccessMessage && onClearResetMessage) {
      onClearResetMessage();
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

  const handleRoleSelect = (role) => {
    if (isLoading) {
      return;
    }
    setSelectedRole(role);
    if (apiError) {
      setApiError("");
    }
  };

  const validateAndRegister = async () => {
    if (isLoading) {
      return;
    }

    const newErrors = {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      institution: "",
    };
    let isValid = true;

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Full name is required.";
      isValid = false;
    } else if (trimmedName.length > 100) {
      newErrors.name = "Name cannot exceed 100 characters.";
      isValid = false;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = "Academic email is required.";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid academic email address.";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Password is required.";
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long.";
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required.";
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
      isValid = false;
    }

    const trimmedInstitution = institution.trim();
    if (trimmedInstitution.length > 200) {
      newErrors.institution = "Institute name cannot exceed 200 characters.";
      isValid = false;
    }

    setErrors(newErrors);
    setApiError("");
    setSuccessBanner("");

    if (!isValid) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(AUTH_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          role: selectedRole,
          institution: trimmedInstitution,
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
          "Unable to create account. Please check your information and try again.";
        setApiError(backendMessage);
        return;
      }

      // Automatically sign in the newly registered user
      try {
        const loginResponse = await fetch(AUTH_ENDPOINTS.LOGIN, {
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

        const loginData = await loginResponse.json().catch(() => null);

        if (
          loginResponse.ok &&
          loginData?.success &&
          loginData.token &&
          loginData.user
        ) {
          const safeUser = await saveAuthSession(
            loginData.token,
            loginData.user
          );
          setPassword("");
          setConfirmPassword("");
          if (onLoginSuccess) {
            onLoginSuccess(safeUser);
            return;
          }
        }
      } catch (_loginErr) {
        // Fall back to login mode with success banner
      }

      setAuthMode("LOGIN");
      setSuccessBanner(
        "Account created successfully! Please sign in with your credentials."
      );
      setPassword("");
      setConfirmPassword("");
    } catch (_networkError) {
      setApiError(
        "Unable to connect to the VeriWrite server. Ensure the backend is running and your device is on the same network."
      );
    } finally {
      setIsLoading(false);
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
              {/* Login / Register Mode Toggle */}
              <View className="flex-row bg-[#0B0E1B] p-1 rounded-xl mb-4 border border-[#1E2540]">
                <Pressable
                  onPress={() => handleModeSwitch("LOGIN")}
                  disabled={isLoading}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    authMode === "LOGIN"
                      ? "bg-[#1E294B] border border-[#38BDF8]/40"
                      : ""
                  }`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: authMode === "LOGIN" }}
                  accessibilityLabel="Sign In Mode"
                >
                  <Text
                    className={`text-[12.5px] font-bold ${
                      authMode === "LOGIN"
                        ? "text-[#38BDF8]"
                        : "text-[#8E96B0]"
                    }`}
                  >
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleModeSwitch("REGISTER")}
                  disabled={isLoading}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    authMode === "REGISTER"
                      ? "bg-[#1E294B] border border-[#38BDF8]/40"
                      : ""
                  }`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: authMode === "REGISTER" }}
                  accessibilityLabel="Register Mode"
                >
                  <Text
                    className={`text-[12.5px] font-bold ${
                      authMode === "REGISTER"
                        ? "text-[#38BDF8]"
                        : "text-[#8E96B0]"
                    }`}
                  >
                    Register
                  </Text>
                </Pressable>
              </View>

              {/* Password Reset / Registration Success Banner */}
              {resetSuccessMessage || successBanner ? (
                <View className="flex-row items-center bg-[#0D2824] border border-[#10B981]/40 rounded-xl px-3.5 py-2.5 mb-4">
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#34D399"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="flex-1 text-[12px] leading-[17px] text-[#A7F3D0]">
                    {resetSuccessMessage || successBanner}
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

              {authMode === "REGISTER" ? (
                <>
                  {/* Full Name Input */}
                  <CustomInput
                    label="Full Name"
                    iconName="person-outline"
                    placeholder="e.g. Dr. Alex Smith"
                    value={name}
                    onChangeText={handleNameChange}
                    autoCapitalize="words"
                    error={errors.name}
                  />

                  {/* Academic Email Input */}
                  <CustomInput
                    label="Academic Email"
                    rightLabel="REQUIRED"
                    iconName="at"
                    placeholder="name@institution.edu"
                    value={email}
                    onChangeText={handleEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.email}
                  />

                  {/* Institute Name Input */}
                  <CustomInput
                    label="Institute Name"
                    rightLabel="EDITABLE"
                    iconName="school-outline"
                    placeholder="e.g. Stanford University"
                    value={institution}
                    onChangeText={handleInstitutionChange}
                    autoCapitalize="words"
                    error={errors.institution}
                  />

                  {/* Password Input */}
                  <CustomInput
                    label="Password"
                    rightLabel="MIN 8 CHARACTERS"
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

                  {/* Confirm Password Input */}
                  <CustomInput
                    label="Confirm Password"
                    rightLabel="MATCH REQUIRED"
                    iconName="shield-checkmark-outline"
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

                  {/* Register Button */}
                  <View className="mt-2">
                    <GradientButton
                      title="Create Account"
                      onPress={validateAndRegister}
                      loading={isLoading}
                      disabled={isLoading}
                    />
                  </View>
                </>
              ) : (
                <>
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
                </>
              )}

              {/* Alternate Switcher Link */}
              <View className="flex-row items-center justify-center mt-4">
                <Text className="text-[12px] text-[#94A3B8]">
                  {authMode === "LOGIN"
                    ? "Don't have an academic account? "
                    : "Already have an account? "}
                </Text>
                <Pressable
                  onPress={() =>
                    handleModeSwitch(authMode === "LOGIN" ? "REGISTER" : "LOGIN")
                  }
                  disabled={isLoading}
                  hitSlop={8}
                  className="active:opacity-75"
                  accessibilityRole="button"
                  accessibilityLabel={
                    authMode === "LOGIN" ? "Switch to Register" : "Switch to Sign In"
                  }
                >
                  <Text className="text-[12px] font-bold text-[#38BDF8]">
                    {authMode === "LOGIN" ? "Register" : "Sign In"}
                  </Text>
                </Pressable>
              </View>
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
