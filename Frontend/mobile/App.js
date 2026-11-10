import "./global.css";
import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoginScreen from "./src/screens/LoginScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import StudentDashboard from "./src/screens/StudentDashboard";
import TeacherDashboard from "./src/screens/TeacherDashboard";
import VeriWriteLogo from "./src/components/VeriWriteLogo";
import {
  getStoredToken,
  getStoredUserProfile,
  saveAuthSession,
  clearAuthSession,
} from "./src/utils/authStorage";
import { fetchCurrentUserProfile } from "./src/utils/apiClient";
import { parseResetPasswordDeepLink } from "./src/utils/deepLink";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("LOGIN");
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [resetToken, setResetToken] = useState(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const handleIncomingUrl = async (url) => {
      if (!url) {
        return false;
      }

      const { isResetPasswordRoute, token } = parseResetPasswordDeepLink(url);
      if (isResetPasswordRoute) {
        // Clear any active session when opening a password reset link
        await clearAuthSession();
        if (isMounted) {
          setAuthenticatedUser(null);
          setResetToken(token);
          setResetSuccessMessage("");
          setCurrentScreen("RESET_PASSWORD");
        }
        return true;
      }
      return false;
    };

    const initializeApp = async () => {
      try {
        // 1. Check if app was launched from a password-reset deep link
        const initialUrl = await Linking.getInitialURL();
        const handledDeepLink = await handleIncomingUrl(initialUrl);

        if (handledDeepLink) {
          return;
        }

        // 2. Check SecureStore for existing JWT and user profile
        const [token, storedUser] = await Promise.all([
          getStoredToken(),
          getStoredUserProfile(),
        ]);

        if (!token || !storedUser) {
          await clearAuthSession();
          if (isMounted) {
            setAuthenticatedUser(null);
          }
          return;
        }

        // 3. Verify token against GET /api/auth/me when backend is reachable
        const meResponse = await fetchCurrentUserProfile();

        if (meResponse.isUnauthorized) {
          await clearAuthSession();
          if (isMounted) {
            setAuthenticatedUser(null);
          }
          return;
        }

        if (meResponse.ok && meResponse.data?.user) {
          const verifiedUser = await saveAuthSession(
            token,
            meResponse.data.user
          );
          if (isMounted) {
            setAuthenticatedUser(verifiedUser);
          }
          return;
        }

        // Fallback to stored profile if server is temporarily unreachable offline
        if (isMounted) {
          setAuthenticatedUser(storedUser);
        }
      } catch (_error) {
        if (isMounted) {
          setAuthenticatedUser(null);
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    initializeApp();

    // 4. Listen for deep links received while the app is already open
    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      handleIncomingUrl(url);
    });

    return () => {
      isMounted = false;
      linkingSubscription.remove();
    };
  }, []);

  const handleLoginSuccess = (user) => {
    setResetSuccessMessage("");
    setResetToken(null);
    setAuthenticatedUser(user);
    setCurrentScreen("DASHBOARD");
  };

  const handleLogout = async () => {
    await clearAuthSession();
    setAuthenticatedUser(null);
    setResetToken(null);
    setResetSuccessMessage("");
    setCurrentScreen("LOGIN");
  };

  const handleResetSuccess = (message) => {
    setResetToken(null);
    setResetSuccessMessage(
      message ||
        "Password has been reset successfully. You can now sign in with your new password."
    );
    setCurrentScreen("LOGIN");
  };

  const renderContent = () => {
    if (isRestoringSession) {
      return (
        <View className="flex-1 bg-[#0A0D1A] items-center justify-center">
          <VeriWriteLogo size="lg" />
          <ActivityIndicator
            size="small"
            color="#38BDF8"
            style={{ marginTop: 20 }}
          />
          <Text className="text-[12px] font-medium tracking-[1px] text-[#94A3B8] mt-3 uppercase">
            Restoring Session...
          </Text>
        </View>
      );
    }

    if (currentScreen === "RESET_PASSWORD") {
      return (
        <ResetPasswordScreen
          resetToken={resetToken}
          onResetSuccess={handleResetSuccess}
          onNavigateForgotPassword={() => {
            setResetToken(null);
            setCurrentScreen("FORGOT_PASSWORD");
          }}
          onBackToSignIn={() => {
            setResetToken(null);
            setCurrentScreen("LOGIN");
          }}
        />
      );
    }

    if (authenticatedUser) {
      if (authenticatedUser.role === "TEACHER") {
        return (
          <TeacherDashboard
            key={`teacher-${authenticatedUser.id}`}
            user={authenticatedUser}
            onLogout={handleLogout}
          />
        );
      }

      return (
        <StudentDashboard
          key={`student-${authenticatedUser.id}`}
          user={authenticatedUser}
          onLogout={handleLogout}
        />
      );
    }

    if (currentScreen === "FORGOT_PASSWORD") {
      return (
        <ForgotPasswordScreen
          onBackToSignIn={() => setCurrentScreen("LOGIN")}
        />
      );
    }

    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        resetSuccessMessage={resetSuccessMessage}
        onClearResetMessage={() => setResetSuccessMessage("")}
        onNavigateForgotPassword={() => {
          setResetSuccessMessage("");
          setCurrentScreen("FORGOT_PASSWORD");
        }}
      />
    );
  };

  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-[#0A0D1A]">
        <StatusBar style="light" />
        {renderContent()}
      </View>
    </SafeAreaProvider>
  );
}
