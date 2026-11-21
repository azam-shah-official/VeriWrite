import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  BackHandler,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import VeriWriteLogo from "../components/VeriWriteLogo";
import {
  fetchTeacherDashboardStats,
  fetchTeacherSubmissions,
  updateCurrentUserProfile,
} from "../utils/apiClient";
import { getStoredToken, saveAuthSession } from "../utils/authStorage";
import TeacherEvidenceReviewScreen from "./TeacherEvidenceReviewScreen";
import TeacherAssignmentListScreen from "./TeacherAssignmentListScreen";

const getInitials = (name) => {
  if (!name || typeof name !== "string") return "ST";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return "Recently";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Recently";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch (_e) {
    return "Recently";
  }
};

export default function TeacherDashboard({ user, onLogout }) {
  // Navigation tabs: "OVERVIEW" | "PAPERS" | "INTEGRITY" | "ACCOUNT"
  const [activeTab, setActiveTab] = useState("OVERVIEW");

  // Filter chips in Overview: "all" | "pending" | "reviewed"
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Review Modal state
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] =
    useState(null);

  // Account / Profile states
  const [currentUser, setCurrentUser] = useState(user);
  const [isEditingInstitution, setIsEditingInstitution] = useState(false);
  const [institutionInput, setInstitutionInput] = useState(
    user?.institution || ""
  );
  const [isSavingInstitution, setIsSavingInstitution] = useState(false);
  const [institutionError, setInstitutionError] = useState("");
  const [institutionSuccess, setInstitutionSuccess] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setCurrentUser(user);
    setInstitutionInput(user?.institution || "");
  }, [user]);

  // Prevent back navigation from leaving dashboard
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (selectedSubmissionForReview) {
          setSelectedSubmissionForReview(null);
          return true;
        }
        if (activeTab !== "OVERVIEW") {
          setActiveTab("OVERVIEW");
          return true;
        }
        return true;
      }
    );
    return () => backSubscription.remove();
  }, [selectedSubmissionForReview, activeTab]);

  const loadDashboardData = useCallback(async () => {
    setLoadError(null);
    try {
      const [statsRes, subsRes] = await Promise.all([
        fetchTeacherDashboardStats(),
        fetchTeacherSubmissions(),
      ]);

      if (statsRes.ok && statsRes.data?.stats) {
        setStats(statsRes.data.stats);
      }
      if (subsRes.ok && Array.isArray(subsRes.data?.submissions)) {
        setSubmissions(subsRes.data.submissions);
      }
    } catch (_err) {
      setLoadError("Network error while connecting to VeriWrite server.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDashboardData();
  };

  // Filtered submissions based on search and status (for Overview tab)
  const filteredSubmissions = useMemo(() => {
    let list = submissions;

    if (statusFilter === "pending") {
      list = list.filter((s) => s.reviewStatus !== "Completed");
    } else if (statusFilter === "reviewed") {
      list = list.filter((s) => s.reviewStatus === "Completed");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.studentName?.toLowerCase().includes(q) ||
          s.title?.toLowerCase().includes(q) ||
          s.course?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [submissions, statusFilter, searchQuery]);

  // Submissions awaiting integrity review (for Integrity tab)
  const pendingSubmissions = useMemo(() => {
    return submissions.filter((s) => s.reviewStatus !== "Completed");
  }, [submissions]);

  const totalCount = stats?.totalSubmissions ?? submissions.length;
  const pendingCount =
    stats?.pendingReviews ??
    submissions.filter((s) => s.reviewStatus !== "Completed").length;
  const reviewedCount =
    stats?.reviewedCount ??
    submissions.filter((s) => s.reviewStatus === "Completed").length;
  const newThisWeek = stats?.newThisWeekCount ?? 0;

  const handleSaveInstitution = async () => {
    const trimmed = institutionInput.trim();
    if (trimmed.length > 200) {
      setInstitutionError("Institution cannot exceed 200 characters.");
      return;
    }

    setIsSavingInstitution(true);
    setInstitutionError("");
    setInstitutionSuccess("");

    try {
      const response = await updateCurrentUserProfile({ institution: trimmed });

      if (response.ok && response.data?.user) {
        const updatedUser = response.data.user;
        setCurrentUser(updatedUser);
        try {
          const token = await getStoredToken();
          if (token) {
            await saveAuthSession(token, updatedUser);
          }
        } catch (_storageErr) {
          // non-blocking
        }
        setInstitutionSuccess("Institution updated successfully.");
        setIsEditingInstitution(false);
      } else {
        setInstitutionError(
          response.data?.message || "Failed to update institution."
        );
      }
    } catch (_err) {
      setInstitutionError("Unable to connect to server. Please try again.");
    } finally {
      setIsSavingInstitution(false);
    }
  };

  const handleLogoutPress = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const renderOverviewTab = () => (
    <ScrollView
      className="flex-1 px-5 pt-3"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#38BDF8"
        />
      }
    >
      {/* Slogan Badge */}
      <View className="self-start bg-[#0C1226] border border-[#19244D] rounded-full px-3 py-1 mb-2">
        <Text className="text-[9.5px] font-bold tracking-[1.5px] text-[#38BDF8] uppercase">
          • ANALYZE • VERIFY • TRUST
        </Text>
      </View>

      {/* Title & Greeting */}
      <Text className="text-[22px] font-bold text-white mb-0.5">
        Teacher Dashboard
      </Text>
      <Text className="text-[13px] font-bold text-[#38BDF8] mb-0.5">
        Welcome back, {currentUser?.name || "Professor"}!
      </Text>
      <Text className="text-[11.5px] text-[#8E96B0] mb-4">
        Manage student submissions and review stylometric analysis.
      </Text>

      {/* 1. Large Card: TOTAL SUBMISSIONS */}
      <View className="bg-[#101426] border border-[#202948] rounded-[22px] p-4 mb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[10px] font-bold tracking-[0.8px] text-[#8E96B0] uppercase mb-1">
              TOTAL SUBMISSIONS
            </Text>
            <Text className="text-[32px] font-extrabold text-white mb-1 leading-[36px]">
              {totalCount}
            </Text>
            <View className="flex-row items-center">
              <Ionicons name="arrow-up" size={12} color="#10B981" style={{ marginRight: 2 }} />
              <Text className="text-[11px] font-bold text-[#10B981]">
                +{newThisWeek} New this week
              </Text>
            </View>
          </View>

          <View className="w-12 h-12 rounded-2xl bg-[#141C34] border border-[#202E54] items-center justify-center">
            <Ionicons name="document-text-outline" size={24} color="#38BDF8" />
          </View>
        </View>
      </View>

      {/* 2. Split 2-Column Row: PENDING & REVIEWED */}
      <View className="flex-row mb-4">
        {/* Pending Card */}
        <Pressable
          onPress={() => setStatusFilter("pending")}
          className="flex-1 bg-[#101426] border border-[#202948] rounded-[20px] p-3.5 mr-1.5 active:opacity-85"
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-[10px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase">
              PENDING
            </Text>
            <View className="w-6 h-6 rounded-lg bg-[#291F0E] border border-[#4A381A] items-center justify-center">
              <Ionicons name="time-outline" size={13} color="#FBBF24" />
            </View>
          </View>
          <Text className="text-[22px] font-extrabold text-white mb-1">
            {pendingCount}
          </Text>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mr-1.5" />
            <Text className="text-[10px] font-bold text-[#FBBF24]">
              Action Needed
            </Text>
          </View>
        </Pressable>

        {/* Reviewed Card */}
        <Pressable
          onPress={() => setStatusFilter("reviewed")}
          className="flex-1 bg-[#101426] border border-[#202948] rounded-[20px] p-3.5 ml-1.5 active:opacity-85"
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-[10px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase">
              REVIEWED
            </Text>
            <View className="w-6 h-6 rounded-lg bg-[#09221C] border border-[#14433B] items-center justify-center">
              <Ionicons name="checkmark-done" size={13} color="#10B981" />
            </View>
          </View>
          <Text className="text-[22px] font-extrabold text-white mb-1">
            {reviewedCount}
          </Text>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5" />
            <Text className="text-[10px] font-bold text-[#34D399]">
              Verified In Accord
            </Text>
          </View>
        </Pressable>
      </View>

      {/* 3. Search Bar */}
      <View className="bg-[#101426] border border-[#202948] rounded-2xl px-3.5 py-2 flex-row items-center mb-3">
        <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search student or assignment..."
          placeholderTextColor="#475569"
          className="flex-1 text-[12.5px] text-white py-0.5"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#64748B" />
          </Pressable>
        ) : null}
      </View>

      {/* 4. Filter Chips */}
      <View className="flex-row mb-4">
        <Pressable
          onPress={() => setStatusFilter("all")}
          className={`mr-2 px-3 py-1.5 rounded-full border ${
            statusFilter === "all"
              ? "bg-[#1E294B] border-[#38BDF8]"
              : "bg-[#0E1322] border-[#1C253E]"
          }`}
        >
          <Text
            className={`text-[11px] font-bold ${
              statusFilter === "all" ? "text-[#38BDF8]" : "text-[#8E96B0]"
            }`}
          >
            All Submissions ({totalCount})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setStatusFilter("pending")}
          className={`mr-2 px-3 py-1.5 rounded-full border ${
            statusFilter === "pending"
              ? "bg-[#1E294B] border-[#38BDF8]"
              : "bg-[#0E1322] border-[#1C253E]"
          }`}
        >
          <Text
            className={`text-[11px] font-bold ${
              statusFilter === "pending" ? "text-[#38BDF8]" : "text-[#8E96B0]"
            }`}
          >
            Pending ({pendingCount})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setStatusFilter("reviewed")}
          className={`px-3 py-1.5 rounded-full border ${
            statusFilter === "reviewed"
              ? "bg-[#1E294B] border-[#38BDF8]"
              : "bg-[#0E1322] border-[#1C253E]"
          }`}
        >
          <Text
            className={`text-[11px] font-bold ${
              statusFilter === "reviewed" ? "text-[#38BDF8]" : "text-[#8E96B0]"
            }`}
          >
            Reviewed ({reviewedCount})
          </Text>
        </Pressable>
      </View>

      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[15px] font-bold text-white">
          Recent Student Submissions
        </Text>
        <Text className="text-[11.5px] text-[#64748B]">
          Showing {filteredSubmissions.length} items
        </Text>
      </View>

      {/* Submissions List */}
      {isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text className="text-[12px] text-[#8E96B0] mt-2">
            Loading student submissions...
          </Text>
        </View>
      ) : loadError ? (
        <View className="bg-[#2B1417] border border-[#522229] rounded-2xl p-4 my-2">
          <Text className="text-[12px] text-[#F87171]">{loadError}</Text>
          <Pressable
            onPress={loadDashboardData}
            className="mt-2 bg-[#3D1A1F] rounded-lg py-1 px-3 self-start"
          >
            <Text className="text-[11px] font-bold text-white">Retry</Text>
          </Pressable>
        </View>
      ) : filteredSubmissions.length === 0 ? (
        <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-8 items-center my-2 mb-6">
          <Ionicons name="folder-open-outline" size={32} color="#64748B" />
          <Text className="text-[14px] font-bold text-white mt-2 mb-1">
            No Submissions Found
          </Text>
          <Text className="text-[12px] text-[#8E96B0] text-center">
            {searchQuery
              ? "No student submissions matched your search criteria."
              : statusFilter === "pending"
              ? "Great job! No pending submissions requiring review."
              : "No student submissions have been assigned to your profile yet."}
          </Text>
        </View>
      ) : (
        filteredSubmissions.map((item) => {
          const isReviewed = item.reviewStatus === "Completed";
          const initials = getInitials(item.studentName);

          return (
            <View
              key={`submission-${item.id}`}
              className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3"
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-row items-center flex-1 mr-2">
                  <View className="w-10 h-10 rounded-full bg-[#182346] border border-[#2B3B6B] items-center justify-center mr-3">
                    <Text className="text-[13px] font-extrabold text-[#38BDF8]">
                      {initials}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <Text
                      className="text-[13.5px] font-bold text-white mb-0.5"
                      numberOfLines={1}
                    >
                      {item.studentName}
                    </Text>
                    <Text
                      className="text-[11.5px] text-[#8E96B0]"
                      numberOfLines={1}
                    >
                      {item.title} • {item.course || "General"}
                    </Text>
                  </View>
                </View>

                {/* Status Pill Badge */}
                <View
                  className={`px-2.5 py-0.5 rounded-full border ${
                    isReviewed
                      ? "bg-[#09221C] border-[#144837]"
                      : "bg-[#291F0E] border-[#4A381A]"
                  }`}
                >
                  <Text
                    className={`text-[9.5px] font-bold ${
                      isReviewed ? "text-[#34D399]" : "text-[#FBBF24]"
                    }`}
                  >
                    • {isReviewed ? "Reviewed" : "Pending"}
                  </Text>
                </View>
              </View>

              {/* Bottom Row: Date & Action Button */}
              <View className="flex-row items-center justify-between pt-2 border-t border-[#182038]">
                <View className="flex-row items-center">
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color="#64748B"
                    style={{ marginRight: 4 }}
                  />
                  <Text className="text-[11px] text-[#64748B]">
                    {formatRelativeTime(item.submittedDate)}
                  </Text>
                </View>

                {/* Review Button */}
                <Pressable
                  onPress={() => setSelectedSubmissionForReview(item)}
                  className={`rounded-xl px-3 py-1.5 flex-row items-center active:opacity-85 ${
                    isReviewed
                      ? "bg-[#141C34] border border-[#222E54]"
                      : "bg-[#0284C7]"
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={`Review submission by ${item.studentName}`}
                >
                  <Text
                    className={`text-[11.5px] font-bold mr-1 ${
                      isReviewed ? "text-[#CBD5E1]" : "text-white"
                    }`}
                  >
                    {isReviewed ? "View Evidence" : "Review"}
                  </Text>
                  <Ionicons
                    name={isReviewed ? "eye-outline" : "chevron-forward"}
                    size={13}
                    color={isReviewed ? "#94A3B8" : "#FFFFFF"}
                  />
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <View className="h-6" />
    </ScrollView>
  );

  const renderIntegrityTab = () => (
    <ScrollView
      className="flex-1 px-5 pt-3"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#38BDF8"
        />
      }
    >
      {/* Slogan Pill Badge */}
      <View className="flex-row items-center bg-[#112236] border border-[#1B3552] rounded-full px-3 py-1 self-start mb-3">
        <Ionicons
          name="shield-checkmark-outline"
          size={12}
          color="#38BDF8"
          style={{ marginRight: 6 }}
        />
        <Text className="text-[9.5px] font-bold tracking-[1.3px] text-[#38BDF8] uppercase">
          ACADEMIC INTEGRITY FRAMEWORK
        </Text>
      </View>

      <Text className="text-[22px] font-bold text-white mb-1.5">
        Integrity Review Hub
      </Text>
      <Text className="text-[13px] leading-[19px] text-[#8E96B0] mb-5">
        Faculty standards, forensic evaluation principles, and integrity verification queue.
      </Text>

      {/* Principle 1: Evidence-Based Writing Analysis */}
      <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3.5">
        <View className="flex-row items-center mb-2.5">
          <View className="w-9 h-9 rounded-xl bg-[#071521] border border-[#133952] items-center justify-center mr-3">
            <Ionicons name="analytics-outline" size={18} color="#38BDF8" />
          </View>
          <Text className="flex-1 text-[15px] font-bold text-white">
            Evidence-Based Writing Analysis
          </Text>
        </View>
        <Text className="text-[12.5px] leading-[19px] text-[#94A3B8]">
          Rather than unverified black-box percentages, VeriWrite breaks down stylistic consistency, syntax cadence, and highlighted passage context so faculty can review factual, traceable evidence.
        </Text>
      </View>

      {/* Principle 2: Advisory Indicators */}
      <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3.5">
        <View className="flex-row items-center mb-2.5">
          <View className="w-9 h-9 rounded-xl bg-[#1A1612] border border-[#3A2D17] items-center justify-center mr-3">
            <Ionicons name="alert-circle-outline" size={18} color="#F59E0B" />
          </View>
          <Text className="flex-1 text-[15px] font-bold text-white">
            Advisory Indicators, Not Proof
          </Text>
        </View>
        <Text className="text-[12.5px] leading-[19px] text-[#94A3B8]">
          Automated stylometric and linguistic flags are probabilistic advisory signals. Technical jargon, ESL writing patterns, and formal academic conventions can alter stylistic markers and must be evaluated in context.
        </Text>
      </View>

      {/* Principle 3: Human-in-the-Loop Authority */}
      <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3.5">
        <View className="flex-row items-center mb-2.5">
          <View className="w-9 h-9 rounded-xl bg-[#09191E] border border-[#123631] items-center justify-center mr-3">
            <Ionicons name="people-outline" size={18} color="#10B981" />
          </View>
          <Text className="flex-1 text-[15px] font-bold text-white">
            Human-in-the-Loop Faculty Authority
          </Text>
        </View>
        <Text className="text-[12.5px] leading-[19px] text-[#94A3B8]">
          Final determinations rest solely with the course instructor. Teachers review specific highlighted evidence in the document, consider assignment parameters, and render the final integrity verdict.
        </Text>
      </View>

      {/* Principle 4: Procedural Transparency & Audit Logging */}
      <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-5">
        <View className="flex-row items-center mb-2.5">
          <View className="w-9 h-9 rounded-xl bg-[#141C34] border border-[#222E54] items-center justify-center mr-3">
            <Ionicons name="shield-outline" size={18} color="#818CF8" />
          </View>
          <Text className="flex-1 text-[15px] font-bold text-white">
            Procedural Transparency & Audit Logging
          </Text>
        </View>
        <Text className="text-[12.5px] leading-[19px] text-[#94A3B8]">
          Every review decision, accepted finding, and instructor rationale is recorded with an immutable audit trail, providing defensible, accountable, and transparent records for institutional accreditation.
        </Text>
      </View>

      {/* Stylometric Verification Queue */}
      <View className="bg-[#0C1B2E] border border-[#194D7C] rounded-2xl p-3.5 mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center">
            <Ionicons name="shield-checkmark" size={16} color="#38BDF8" style={{ marginRight: 6 }} />
            <Text className="text-[13px] font-bold text-[#38BDF8]">
              Stylometric Verification Queue
            </Text>
          </View>
          <View className="bg-[#082038] border border-[#194D7C] rounded-full px-2.5 py-0.5">
            <Text className="text-[10px] font-bold text-[#38BDF8]">
              {pendingSubmissions.length} Pending
            </Text>
          </View>
        </View>
        <Text className="text-[11.5px] text-[#94A3B8] leading-[16px]">
          Submissions below require faculty review. Examine flagged indicators, accept or reject forensic findings, and record audit-logged review verdicts.
        </Text>
      </View>

      {/* Verification Queue List */}
      {isLoading ? (
        <View className="py-8 items-center">
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text className="text-[12px] text-[#8E96B0] mt-2">
            Loading verification queue...
          </Text>
        </View>
      ) : pendingSubmissions.length === 0 ? (
        <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-6 items-center my-2 mb-6">
          <View className="w-12 h-12 rounded-full bg-[#09221C] border border-[#14433B] items-center justify-center mb-2">
            <Ionicons name="checkmark-circle" size={26} color="#10B981" />
          </View>
          <Text className="text-[14px] font-bold text-white mb-1">
            Verification Queue Clean
          </Text>
          <Text className="text-[12px] text-[#8E96B0] text-center">
            Great job! All student submissions have undergone integrity verification. No pending reviews at this time.
          </Text>
        </View>
      ) : (
        pendingSubmissions.map((item) => {
          const initials = getInitials(item.studentName);

          return (
            <View
              key={`integrity-queue-${item.id}`}
              className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3"
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-row items-center flex-1 mr-2">
                  <View className="w-10 h-10 rounded-full bg-[#182346] border border-[#2B3B6B] items-center justify-center mr-3">
                    <Text className="text-[13px] font-extrabold text-[#38BDF8]">
                      {initials}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <Text
                      className="text-[13.5px] font-bold text-white mb-0.5"
                      numberOfLines={1}
                    >
                      {item.studentName}
                    </Text>
                    <Text
                      className="text-[11.5px] text-[#8E96B0]"
                      numberOfLines={1}
                    >
                      {item.title} • {item.course || "General"}
                    </Text>
                  </View>
                </View>

                {/* Pending Pill */}
                <View className="bg-[#291F0E] border border-[#4A381A] px-2.5 py-0.5 rounded-full">
                  <Text className="text-[9.5px] font-bold text-[#FBBF24]">
                    • Awaiting Review
                  </Text>
                </View>
              </View>

              {/* Bottom Row */}
              <View className="flex-row items-center justify-between pt-2 border-t border-[#182038]">
                <View className="flex-row items-center">
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color="#64748B"
                    style={{ marginRight: 4 }}
                  />
                  <Text className="text-[11px] text-[#64748B]">
                    Submitted {formatRelativeTime(item.submittedDate)}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setSelectedSubmissionForReview(item)}
                  className="bg-[#0284C7] rounded-xl px-3 py-1.5 flex-row items-center active:opacity-85"
                  accessibilityRole="button"
                  accessibilityLabel={`Review evidence for ${item.studentName}`}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={12}
                    color="#FFFFFF"
                    style={{ marginRight: 4 }}
                  />
                  <Text className="text-[11.5px] font-bold text-white mr-1">
                    Review Evidence
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <View className="h-6" />
    </ScrollView>
  );

  const renderAccountTab = () => (
    <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
      <Text className="text-[20px] font-bold text-white mb-1">
        Teacher Profile & Account
      </Text>
      <Text className="text-[12px] text-[#8E96B0] mb-5">
        Manage your faculty account details and university affiliation.
      </Text>

      <View className="bg-[#101426] border border-[#202948] rounded-[24px] p-5 mb-5 items-center">
        <View className="w-16 h-16 rounded-full bg-[#182346] border border-[#2B3B6B] items-center justify-center mb-3">
          <Text className="text-[22px] font-bold text-[#38BDF8]">
            {getInitials(currentUser?.name)}
          </Text>
        </View>
        <Text className="text-[17px] font-bold text-white mb-0.5">
          {currentUser?.name || "Teacher"}
        </Text>
        <Text className="text-[12px] text-[#8E96B0] mb-3">
          {currentUser?.email || ""}
        </Text>

        <View className="bg-[#0C243B] border border-[#194D7C] rounded-full px-3 py-1">
          <Text className="text-[10px] font-bold tracking-[1px] text-[#38BDF8] uppercase">
            Faculty Member • VeriWrite
          </Text>
        </View>
      </View>

      {/* Academic Institution Card */}
      <View className="bg-[#101426] border border-[#202948] rounded-[24px] p-5 mb-5">
        <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-[#182038]">
          <View className="flex-row items-center">
            <Ionicons name="business-outline" size={17} color="#38BDF8" style={{ marginRight: 8 }} />
            <Text className="text-[14px] font-bold text-white">
              Academic Institution
            </Text>
          </View>

          {!isEditingInstitution ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit Institution"
              onPress={() => {
                setIsEditingInstitution(true);
                setInstitutionError("");
                setInstitutionSuccess("");
              }}
              className="bg-[#141C34] border border-[#24335E] rounded-lg px-2.5 py-1"
            >
              <Text className="text-[11px] font-bold text-[#38BDF8]">Edit</Text>
            </Pressable>
          ) : null}
        </View>

        {isEditingInstitution ? (
          <View>
            <TextInput
              value={institutionInput}
              onChangeText={setInstitutionInput}
              placeholder="Enter your university or institution..."
              placeholderTextColor="#475569"
              className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-3"
            />

            {institutionError ? (
              <Text className="text-[11px] text-[#F87171] mb-2">{institutionError}</Text>
            ) : null}

            <View className="flex-row items-center justify-end space-x-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => {
                  setIsEditingInstitution(false);
                  setInstitutionInput(currentUser?.institution || "");
                  setInstitutionError("");
                }}
                className="px-3 py-2 mr-2"
              >
                <Text className="text-[12px] font-semibold text-[#8E96B0]">Cancel</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save Institution"
                disabled={isSavingInstitution}
                onPress={handleSaveInstitution}
                className="bg-[#0284C7] rounded-xl px-4 py-2"
              >
                {isSavingInstitution ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-[12px] font-bold text-white">Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <Text className="text-[13px] font-bold text-[#CBD5E1] mb-1">
              {currentUser?.institution || "Not Set"}
            </Text>
            <Text className="text-[11px] text-[#64748B]">
              Students at your institution can select you during assignment submission.
            </Text>
          </View>
        )}

        {institutionSuccess ? (
          <Text className="text-[11px] text-[#34D399] mt-2">{institutionSuccess}</Text>
        ) : null}
      </View>

      {/* Logout Action */}
      <Pressable
        disabled={isLoggingOut}
        onPress={handleLogoutPress}
        className="w-full h-[46px] bg-[#2B1417] border border-[#522229] rounded-xl flex-row items-center justify-center mb-8 active:opacity-85"
      >
        {isLoggingOut ? (
          <ActivityIndicator size="small" color="#F87171" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={17} color="#F87171" style={{ marginRight: 6 }} />
            <Text className="text-[13px] font-bold text-[#F87171]">Sign Out of Portal</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#080B14]">
      {/* Top Header Bar */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3 border-b border-[#14192C]">
        <View className="flex-row items-center">
          <View className="w-9 h-9 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center mr-2.5">
            <Ionicons name="shield-checkmark" size={19} color="#38BDF8" />
          </View>
          <View>
            <Text className="text-[15px] font-bold text-white leading-[18px]">
              VeriWrite
            </Text>
            <Text className="text-[11px] text-[#8E96B0] leading-[14px]">
              Teacher Portal
            </Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <View className="flex-row items-center bg-[#0B2220] border border-[#143D37] rounded-full px-2.5 py-1 mr-2.5">
            <View className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5" />
            <Text className="text-[9.5px] font-bold tracking-[0.8px] text-[#34D399] uppercase">
              LIVE SYNC
            </Text>
          </View>

          <Pressable
            onPress={() => setActiveTab("ACCOUNT")}
            className="w-8 h-8 rounded-full bg-[#16213D] border border-[#253560] items-center justify-center active:opacity-80"
          >
            <Ionicons name="person" size={15} color="#38BDF8" />
          </Pressable>
        </View>
      </View>

      {/* Main Tab Content */}
      {activeTab === "OVERVIEW" ? (
        renderOverviewTab()
      ) : activeTab === "PAPERS" ? (
        <TeacherAssignmentListScreen onBack={() => setActiveTab("OVERVIEW")} />
      ) : activeTab === "INTEGRITY" ? (
        renderIntegrityTab()
      ) : activeTab === "ACCOUNT" ? (
        renderAccountTab()
      ) : null}

      {/* Bottom Navigation Bar */}
      <View className="flex-row items-center justify-around bg-[#080B14] border-t border-[#14192C] py-2 px-2">
        {/* Overview Tab */}
        <Pressable
          onPress={() => setActiveTab("OVERVIEW")}
          className="items-center py-1 px-3"
          accessibilityRole="button"
          accessibilityLabel="Overview Tab"
        >
          <Ionicons
            name={activeTab === "OVERVIEW" ? "grid" : "grid-outline"}
            size={19}
            color={activeTab === "OVERVIEW" ? "#38BDF8" : "#64748B"}
          />
          <Text
            className={`text-[10px] font-bold mt-1 ${
              activeTab === "OVERVIEW" ? "text-[#38BDF8]" : "text-[#64748B]"
            }`}
          >
            Overview
          </Text>
        </Pressable>

        {/* Papers Tab */}
        <Pressable
          onPress={() => setActiveTab("PAPERS")}
          className="items-center py-1 px-3"
          accessibilityRole="button"
          accessibilityLabel="Papers Tab"
        >
          <Ionicons
            name={activeTab === "PAPERS" ? "document-text" : "document-text-outline"}
            size={19}
            color={activeTab === "PAPERS" ? "#38BDF8" : "#64748B"}
          />
          <Text
            className={`text-[10px] font-bold mt-1 ${
              activeTab === "PAPERS" ? "text-[#38BDF8]" : "text-[#64748B]"
            }`}
          >
            Papers
          </Text>
        </Pressable>

        {/* Integrity Tab */}
        <Pressable
          onPress={() => setActiveTab("INTEGRITY")}
          className="items-center py-1 px-3"
          accessibilityRole="button"
          accessibilityLabel="Integrity Tab"
        >
          <Ionicons
            name={activeTab === "INTEGRITY" ? "shield-checkmark" : "shield-checkmark-outline"}
            size={19}
            color={activeTab === "INTEGRITY" ? "#38BDF8" : "#64748B"}
          />
          <Text
            className={`text-[10px] font-bold mt-1 ${
              activeTab === "INTEGRITY" ? "text-[#38BDF8]" : "text-[#64748B]"
            }`}
          >
            Integrity
          </Text>
        </Pressable>

        {/* Account Tab */}
        <Pressable
          onPress={() => setActiveTab("ACCOUNT")}
          className="items-center py-1 px-3"
          accessibilityRole="button"
          accessibilityLabel="Account Tab"
        >
          <Ionicons
            name={activeTab === "ACCOUNT" ? "person" : "person-outline"}
            size={19}
            color={activeTab === "ACCOUNT" ? "#38BDF8" : "#64748B"}
          />
          <Text
            className={`text-[10px] font-bold mt-1 ${
              activeTab === "ACCOUNT" ? "text-[#38BDF8]" : "text-[#64748B]"
            }`}
          >
            Account
          </Text>
        </Pressable>
      </View>

      {/* Modal: Teacher Evidence Review Screen */}
      <Modal
        visible={Boolean(selectedSubmissionForReview)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedSubmissionForReview(null)}
      >
        {selectedSubmissionForReview ? (
          <TeacherEvidenceReviewScreen
            submission={selectedSubmissionForReview}
            onClose={() => setSelectedSubmissionForReview(null)}
            onReviewSubmitted={(updatedSubmission) => {
              setSubmissions((prev) =>
                prev.map((s) =>
                  s.id === updatedSubmission.id
                    ? { ...s, ...updatedSubmission }
                    : s
                )
              );
              loadDashboardData();
            }}
          />
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});
