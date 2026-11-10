import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  BackHandler,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AssignmentCard from "../components/AssignmentCard";
import AssignmentDetailModal from "../components/AssignmentDetailModal";
import {
  SAMPLE_STUDENT_ASSIGNMENTS,
  calculateAssignmentStats,
} from "../data/studentAssignmentsData";

const TABS = {
  OVERVIEW: "OVERVIEW",
  PAPERS: "PAPERS",
  INTEGRITY: "INTEGRITY",
  ACCOUNT: "ACCOUNT",
};

const PAPER_FILTERS = {
  ALL: "ALL",
  RECENT: "RECENT",
  COMPLETED: "COMPLETED",
  PENDING: "PENDING",
};

export default function StudentDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState(TABS.OVERVIEW);
  const [paperFilter, setPaperFilter] = useState(PAPER_FILTERS.ALL);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Local sample assignments dataset (ready to be replaced by API data later)
  const assignments = SAMPLE_STUDENT_ASSIGNMENTS;

  // Dynamically calculate all statistics from the assignment dataset
  const stats = useMemo(
    () => calculateAssignmentStats(assignments),
    [assignments]
  );

  // Filtered assignments for the Papers tab
  const filteredPapers = useMemo(() => {
    if (paperFilter === PAPER_FILTERS.RECENT) {
      return stats.recentAssignments;
    }
    if (paperFilter === PAPER_FILTERS.COMPLETED) {
      return assignments.filter(
        (item) =>
          item.analysisStatus === "Completed" &&
          item.reviewStatus === "Completed"
      );
    }
    if (paperFilter === PAPER_FILTERS.PENDING) {
      return assignments.filter(
        (item) =>
          item.analysisStatus !== "Completed" ||
          item.reviewStatus !== "Completed"
      );
    }
    return assignments;
  }, [assignments, paperFilter, stats.recentAssignments]);

  // Prevent Android hardware back button from leaving the dashboard unless closing modal or returning to Overview tab
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (selectedAssignment) {
          setSelectedAssignment(null);
          return true;
        }
        if (activeTab !== TABS.OVERVIEW) {
          setActiveTab(TABS.OVERVIEW);
          return true;
        }
        return true;
      }
    );
    return () => backSubscription.remove();
  }, [activeTab, selectedAssignment]);

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

  const studentName = user?.name?.trim() ? user.name.trim() : "Student";

  const renderTopBar = () => (
    <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
      {/* Left: VeriWrite Student Portal Branding */}
      <View className="flex-row items-center">
        <View className="w-9 h-9 rounded-xl bg-[#161B33] border border-[#262F54] items-center justify-center mr-2.5">
          <Ionicons
            name="checkmark-circle-outline"
            size={19}
            color="#818CF8"
          />
        </View>
        <View>
          <Text className="text-[15px] font-bold text-white leading-[18px]">
            VeriWrite
          </Text>
          <Text className="text-[11px] text-[#8E96B0] leading-[14px]">
            Student Portal
          </Text>
        </View>
      </View>

      {/* Right: Portal Status Badge & Profile Icon Button */}
      <View className="flex-row items-center">
        <View className="flex-row items-center bg-[#0B2220] border border-[#143D37] rounded-full px-2.5 py-1 mr-2.5">
          <View className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5" />
          <Text className="text-[9.5px] font-bold tracking-[0.8px] text-[#34D399] uppercase">
            SAMPLE DATA
          </Text>
        </View>

        <Pressable
          onPress={() => setActiveTab(TABS.ACCOUNT)}
          className="w-8 h-8 rounded-full bg-[#C7D2FE] items-center justify-center active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Open Student Account tab"
        >
          <Ionicons name="person-outline" size={16} color="#1E1B4B" />
        </Pressable>
      </View>
    </View>
  );

  const renderOverviewTab = () => (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Tagline Pill */}
      <View className="flex-row items-center bg-[#112236] border border-[#1B3552] rounded-full px-3 py-1 self-start mb-3.5">
        <View
          style={styles.cyanDotGlow}
          className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] mr-2"
        />
        <Text className="text-[9.5px] font-bold tracking-[1.3px] text-[#38BDF8] uppercase">
          ANALYZE • VERIFY • TRUST
        </Text>
      </View>

      {/* Welcome Heading */}
      <Text className="text-[24px] font-bold text-white tracking-tight mb-1.5">
        Welcome back, {studentName}!
      </Text>
      <Text className="text-[13px] leading-[19px] text-[#8E96B0] mb-5">
        Track your assignments and review your writing analysis.
      </Text>

      {/* Total Assignments Submitted Card */}
      <View className="rounded-[20px] overflow-hidden border border-[#21324C] mb-3.5">
        <LinearGradient
          colors={["#141A2E", "#122438", "#0F2D42"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.totalCardGradient}
        >
          <View className="flex-1 pr-3">
            <Text className="text-[10.5px] font-bold tracking-[1px] text-[#94A3B8] uppercase mb-1">
              TOTAL ASSIGNMENTS SUBMITTED
            </Text>
            <Text className="text-[28px] font-bold text-white">
              {stats.totalSubmitted}
            </Text>
          </View>

          <View className="w-11 h-11 rounded-xl bg-[#071521] border border-[#133952] items-center justify-center">
            <Ionicons
              name="document-text-outline"
              size={20}
              color="#38BDF8"
            />
          </View>
        </LinearGradient>
      </View>

      {/* Side-by-Side Stat Cards */}
      <View className="flex-row mb-6">
        {/* Completed Analyses Card */}
        <View className="flex-1 bg-[#14192C] border border-[#222943] rounded-[20px] p-4 mr-1.5">
          <View className="flex-row items-center justify-between mb-3.5">
            <View className="w-9 h-9 rounded-xl bg-[#09191E] border border-[#123631] items-center justify-center">
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#10B981"
              />
            </View>
            <View className="bg-[#0D2824] border border-[#14433B] rounded-full px-2.5 py-0.5">
              <Text className="text-[10px] font-semibold text-[#34D399]">
                Verified
              </Text>
            </View>
          </View>

          <Text className="text-[24px] font-bold text-white mb-0.5">
            {stats.completedAnalyses}
          </Text>
          <Text className="text-[12px] text-[#8E96B0]">
            Completed Analyses
          </Text>
        </View>

        {/* Pending Reviews Card */}
        <View className="flex-1 bg-[#14192C] border border-[#222943] rounded-[20px] p-4 ml-1.5">
          <View className="flex-row items-center justify-between mb-3.5">
            <View className="w-9 h-9 rounded-xl bg-[#1A1612] border border-[#3A2D17] items-center justify-center">
              <Ionicons name="time-outline" size={18} color="#F59E0B" />
            </View>
            <View className="bg-[#2A2012] border border-[#453318] rounded-full px-2.5 py-0.5">
              <Text className="text-[10px] font-semibold text-[#FBBF24]">
                Queue
              </Text>
            </View>
          </View>

          <Text className="text-[24px] font-bold text-white mb-0.5">
            {stats.pendingReviews}
          </Text>
          <Text className="text-[12px] text-[#8E96B0]">Pending Reviews</Text>
        </View>
      </View>

      {/* Recent Assignments Section Header */}
      <View className="flex-row items-center justify-between mb-3.5">
        <Text className="text-[17px] font-bold text-white">
          Recent Assignments
        </Text>
        <Text className="text-[12px] text-[#64748B]">
          {stats.recentAssignments.length}{" "}
          {stats.recentAssignments.length === 1 ? "Record" : "Records"}
        </Text>
      </View>

      {/* Recent Assignment Cards */}
      {stats.recentAssignments.length > 0 ? (
        stats.recentAssignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onPressDetails={(item) => setSelectedAssignment(item)}
          />
        ))
      ) : (
        <View className="bg-[#14192C] border border-[#222943] rounded-[20px] p-6 items-center">
          <Ionicons
            name="document-text-outline"
            size={28}
            color="#64748B"
            style={{ marginBottom: 8 }}
          />
          <Text className="text-[14px] font-bold text-white mb-1">
            No Recent Assignments
          </Text>
          <Text className="text-[12px] text-[#8E96B0] text-center">
            Your submitted papers and writing analyses will appear here.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderPapersTab = () => (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="flex-row items-center bg-[#112236] border border-[#1B3552] rounded-full px-3 py-1 self-start mb-3">
        <Ionicons
          name="folder-open-outline"
          size={12}
          color="#38BDF8"
          style={{ marginRight: 6 }}
        />
        <Text className="text-[9.5px] font-bold tracking-[1.3px] text-[#38BDF8] uppercase">
          SUBMISSION ARCHIVE
        </Text>
      </View>

      <Text className="text-[22px] font-bold text-white mb-1">
        Submitted Papers
      </Text>
      <Text className="text-[13px] text-[#8E96B0] mb-4">
        Browse all {stats.totalSubmitted} sample academic submissions and their
        verification status.
      </Text>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
      >
        {[
          {
            key: PAPER_FILTERS.ALL,
            label: `All (${assignments.length})`,
          },
          {
            key: PAPER_FILTERS.RECENT,
            label: `Recent (${stats.recentAssignments.length})`,
          },
          {
            key: PAPER_FILTERS.COMPLETED,
            label: "Verified",
          },
          {
            key: PAPER_FILTERS.PENDING,
            label: "In Queue / Review",
          },
        ].map((filterItem) => {
          const isSelected = paperFilter === filterItem.key;
          return (
            <Pressable
              key={filterItem.key}
              onPress={() => setPaperFilter(filterItem.key)}
              className={`px-3.5 py-2 rounded-xl mr-2 border ${
                isSelected
                  ? "bg-[#1E294B] border-[#38BDF8]"
                  : "bg-[#14192C] border-[#222943]"
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                className={`text-[12px] font-semibold ${
                  isSelected ? "text-white" : "text-[#8E96B0]"
                }`}
              >
                {filterItem.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Assignment List or Empty State */}
      {filteredPapers.length > 0 ? (
        filteredPapers.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onPressDetails={(item) => setSelectedAssignment(item)}
          />
        ))
      ) : (
        <View className="bg-[#14192C] border border-[#222943] rounded-[20px] p-6 items-center mt-2">
          <View className="w-12 h-12 rounded-2xl bg-[#0C0F1D] border border-[#192036] items-center justify-center mb-3">
            <Ionicons
              name="document-text-outline"
              size={24}
              color="#38BDF8"
            />
          </View>
          <Text className="text-[15px] font-bold text-white mb-1">
            No Matching Submissions
          </Text>
          <Text className="text-[12.5px] text-[#8E96B0] text-center mb-4">
            No assignments match the selected filter criteria.
          </Text>
          <Pressable
            onPress={() => setPaperFilter(PAPER_FILTERS.ALL)}
            className="px-4 py-2 rounded-xl bg-[#1E294B] border border-[#38BDF8]"
            accessibilityRole="button"
          >
            <Text className="text-[12px] font-bold text-white">
              Show All Papers
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );

  const renderIntegrityTab = () => (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Pill Badge */}
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
        How VeriWrite Works
      </Text>
      <Text className="text-[13px] leading-[19px] text-[#8E96B0] mb-5">
        VeriWrite is built to support fair, transparent, and explainable writing
        evaluation for students and educators.
      </Text>

      {/* Principle 1: Evidence-Based Writing Analysis */}
      <View className="bg-[#14192C] border border-[#222943] rounded-[20px] p-4 mb-3.5">
        <View className="flex-row items-center mb-2.5">
          <View className="w-9 h-9 rounded-xl bg-[#071521] border border-[#133952] items-center justify-center mr-3">
            <Ionicons name="analytics-outline" size={18} color="#38BDF8" />
          </View>
          <Text className="flex-1 text-[15px] font-bold text-white">
            Evidence-Based Writing Analysis
          </Text>
        </View>
        <Text className="text-[12.5px] leading-[19px] text-[#94A3B8]">
          Rather than producing unverified single-number judgments, VeriWrite
          organizes structural writing observations, stylistic consistency, and
          document metadata so students and teachers can review clear context.
        </Text>
      </View>

      {/* Principle 2: AI Indicators Are Not Proof */}
      <View className="bg-[#14192C] border border-[#222943] rounded-[20px] p-4 mb-3.5">
        <View className="flex-row items-center mb-2.5">
          <View className="w-9 h-9 rounded-xl bg-[#1A1612] border border-[#3A2D17] items-center justify-center mr-3">
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color="#F59E0B"
            />
          </View>
          <Text className="flex-1 text-[15px] font-bold text-white">
            Indicators Are Not Definitive Proof
          </Text>
        </View>
        <Text className="text-[12.5px] leading-[19px] text-[#94A3B8]">
          Automated linguistic or statistical indicators are probabilistic
          signals and must never be treated as standalone proof of AI
          authorship. High-formality academic prose, technical terminology, and
          non-native English writing can all influence automated patterns.
        </Text>
      </View>

      {/* Principle 3: Human Review Is Essential */}
      <View className="bg-[#14192C] border border-[#222943] rounded-[20px] p-4 mb-3.5">
        <View className="flex-row items-center mb-2.5">
          <View className="w-9 h-9 rounded-xl bg-[#09191E] border border-[#123631] items-center justify-center mr-3">
            <Ionicons name="people-outline" size={18} color="#10B981" />
          </View>
          <Text className="flex-1 text-[15px] font-bold text-white">
            Human-in-the-Loop Instructor Review
          </Text>
        </View>
        <Text className="text-[12.5px] leading-[19px] text-[#94A3B8]">
          Every submission marked as{" "}
          <Text className="text-[#F59E0B] font-semibold">
            Needs Human Review
          </Text>{" "}
          is evaluated directly by your course instructor alongside your drafts,
          citations, and assignment guidelines before any academic decision is
          made.
        </Text>
      </View>
    </ScrollView>
  );

  const renderAccountTab = () => (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Pill Badge */}
      <View className="flex-row items-center bg-[#112236] border border-[#1B3552] rounded-full px-3 py-1 self-start mb-3">
        <Ionicons
          name="person-circle-outline"
          size={12}
          color="#38BDF8"
          style={{ marginRight: 6 }}
        />
        <Text className="text-[9.5px] font-bold tracking-[1.3px] text-[#38BDF8] uppercase">
          AUTHENTICATED PROFILE
        </Text>
      </View>

      <Text className="text-[22px] font-bold text-white mb-1">
        Student Account
      </Text>
      <Text className="text-[13px] text-[#8E96B0] mb-5">
        Manage your verified VeriWrite student identity and active session.
      </Text>

      {/* Profile Header Card */}
      <View className="bg-[#14192C] border border-[#222943] rounded-[20px] p-5 mb-4">
        <View className="flex-row items-center mb-5">
          <View className="w-14 h-14 rounded-full bg-[#C7D2FE] items-center justify-center mr-3.5">
            <Ionicons name="person-outline" size={26} color="#1E1B4B" />
          </View>
          <View className="flex-1">
            <Text className="text-[18px] font-bold text-white mb-0.5">
              {studentName}
            </Text>
            <Text className="text-[12.5px] text-[#94A3B8]">
              {user?.email || "No email available"}
            </Text>
          </View>
        </View>

        {/* Detailed Account Fields */}
        <View className="bg-[#0B0E1B] border border-[#192036] rounded-2xl p-4">
          <View className="mb-3.5">
            <Text className="text-[10.5px] font-semibold tracking-[1px] text-[#64748B] uppercase mb-0.5">
              STUDENT NAME
            </Text>
            <Text className="text-[14.5px] font-bold text-white">
              {studentName}
            </Text>
          </View>

          <View className="mb-3.5">
            <Text className="text-[10.5px] font-semibold tracking-[1px] text-[#64748B] uppercase mb-0.5">
              ACADEMIC EMAIL
            </Text>
            <Text className="text-[13.5px] text-[#CBD5E1]">
              {user?.email || "—"}
            </Text>
          </View>

          {user?.institution ? (
            <View className="mb-3.5">
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
            <View className="flex-row items-center mt-0.5">
              <View className="w-2 h-2 rounded-full bg-[#38BDF8] mr-2" />
              <Text className="text-[13.5px] font-bold text-[#38BDF8]">
                {user?.role || "STUDENT"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Existing Logout Implementation */}
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
    </ScrollView>
  );

  const renderBottomNav = () => {
    const navItems = [
      {
        key: TABS.OVERVIEW,
        label: "Overview",
        icon: "grid-outline",
      },
      {
        key: TABS.PAPERS,
        label: "Papers",
        icon: "document-text-outline",
      },
      {
        key: TABS.INTEGRITY,
        label: "Integrity",
        icon: "shield-checkmark-outline",
      },
      {
        key: TABS.ACCOUNT,
        label: "Account",
        icon: "person-circle-outline",
      },
    ];

    return (
      <View className="bg-[#0B0E1B] border-t border-[#1A2138] flex-row items-center justify-around py-2.5 px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setActiveTab(item.key)}
              className="flex-1 items-center justify-center py-1 active:opacity-80"
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${item.label} tab`}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={isActive ? "#818CF8" : "#64748B"}
              />
              <Text
                className={`text-[10.5px] mt-1 ${
                  isActive
                    ? "font-bold text-[#818CF8]"
                    : "font-medium text-[#64748B]"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#0A0D1A]">
      <LinearGradient
        colors={["#141C3A", "#0C1023", "#0A0D1A"]}
        locations={[0, 0.35, 0.85]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        {/* Top Branding & Portal Bar */}
        {renderTopBar()}

        {/* Active Tab Content */}
        <View className="flex-1">
          {activeTab === TABS.OVERVIEW && renderOverviewTab()}
          {activeTab === TABS.PAPERS && renderPapersTab()}
          {activeTab === TABS.INTEGRITY && renderIntegrityTab()}
          {activeTab === TABS.ACCOUNT && renderAccountTab()}
        </View>

        {/* Fixed Bottom Navigation Bar */}
        <SafeAreaView edges={["bottom"]} className="bg-[#0B0E1B]">
          {renderBottomNav()}
        </SafeAreaView>
      </SafeAreaView>

      {/* Assignment Details Modal */}
      <AssignmentDetailModal
        visible={Boolean(selectedAssignment)}
        assignment={selectedAssignment}
        onClose={() => setSelectedAssignment(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  cyanDotGlow: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  totalCardGradient: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
