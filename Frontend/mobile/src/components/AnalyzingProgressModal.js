import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatFileSizeMB } from "../utils/fileValidation";
import { triggerWritingAnalysis } from "../utils/apiClient";

export default function AnalyzingProgressModal({
  visible,
  assignment,
  forceReanalysis = false,
  onClose,
  onAnalysisComplete,
  onUnauthorized,
}) {
  const [currentStage, setCurrentStage] = useState(3); // 1: Upload, 2: Extract, 3: Indicators, 4: Similarity, 5: Report
  const [progressPercent, setProgressPercent] = useState(45);
  const [activeTelemetryStep, setActiveTelemetryStep] = useState(
    "Syntactic Entropy Check"
  );
  const [isApiExecuting, setIsApiExecuting] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisSuccessResult, setAnalysisSuccessResult] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef(null);
  const stepIntervalRef = useRef(null);
  const hasTriggeredRef = useRef(false);

  // Reset and trigger analysis when modal opens
  useEffect(() => {
    if (!visible || !assignment) {
      setCurrentStage(3);
      setProgressPercent(45);
      setActiveTelemetryStep("Syntactic Entropy Check");
      setIsApiExecuting(false);
      setAnalysisError(null);
      setAnalysisSuccessResult(null);
      setElapsedSeconds(0);
      hasTriggeredRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      return;
    }

    if (hasTriggeredRef.current) {
      return;
    }
    hasTriggeredRef.current = true;

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Dynamic telemetry step progression for realistic feedback
    const telemetrySteps = [
      "Syntactic Entropy Check",
      "Calculating Sentence Cadence Variation",
      "Evaluating Lexical Diversity (MATTR)",
      "Scanning Formulaic Stock Phrases",
      "Validating Evidence Boundaries",
    ];
    let stepIndex = 0;
    stepIntervalRef.current = setInterval(() => {
      stepIndex = (stepIndex + 1) % telemetrySteps.length;
      setActiveTelemetryStep(telemetrySteps[stepIndex]);
      setProgressPercent((prev) => {
        if (prev < 88) return prev + 6;
        return prev;
      });
    }, 1200);

    // Trigger backend analysis
    const executeAnalysis = async () => {
      setIsApiExecuting(true);
      setAnalysisError(null);

      try {
        const response = await triggerWritingAnalysis(assignment.id, {
          forceReanalysis,
          onUnauthorized: () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
            if (onUnauthorized) {
              onUnauthorized();
            }
          },
        });

        if (response.isUnauthorized) {
          return;
        }

        if (response.ok && response.data?.success) {
          // Progress to final stage
          setCurrentStage(5);
          setProgressPercent(100);
          setActiveTelemetryStep("Verification Report Finalized");
          setAnalysisSuccessResult(response.data);

          // Small delay so student sees the 100% completion state
          setTimeout(() => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
            if (onAnalysisComplete) {
              onAnalysisComplete(response.data.assignment);
            }
          }, 700);
        } else {
          if (timerRef.current) clearInterval(timerRef.current);
          if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);

          const errCode = response.data?.code || "";
          const errMsg =
            response.data?.message ||
            "Unable to complete writing analysis. Please try again.";

          setAnalysisError({
            code: errCode,
            status: response.status,
            message: errMsg,
            isInsufficientText:
              errCode === "INSUFFICIENT_TEXT_FOR_ANALYSIS" ||
              errMsg.includes("at least 100 words"),
            isConflict: response.status === 409,
            isNetwork: Boolean(response.isNetworkError),
          });
        }
      } catch (err) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
        setAnalysisError({
          code: "CLIENT_ERROR",
          status: 0,
          message:
            err.message ||
            "A network or processing error occurred while analyzing the assignment.",
          isInsufficientText: false,
          isConflict: false,
          isNetwork: true,
        });
      } finally {
        setIsApiExecuting(false);
      }
    };

    executeAnalysis();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, [visible, assignment, forceReanalysis, onAnalysisComplete, onUnauthorized]);

  if (!visible || !assignment) {
    return null;
  }

  const fileName =
    assignment.originalFileName ||
    assignment.fileName ||
    assignment.title ||
    "Document.pdf";

  const wordCount =
    typeof assignment.wordCount === "number" && assignment.wordCount > 0
      ? assignment.wordCount.toLocaleString()
      : "Parsed";

  const fileSizeStr = formatFileSizeMB(assignment.fileSize);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-[#080B14]">
        {/* Top Header Bar */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3 border-b border-[#14192C]">
          <View className="flex-row items-center">
            <View className="w-9 h-9 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center mr-2.5">
              <Ionicons name="checkmark-circle-outline" size={19} color="#818CF8" />
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

          <View className="flex-row items-center bg-[#0B2220] border border-[#143D37] rounded-full px-2.5 py-1">
            <View className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5" />
            <Text className="text-[9.5px] font-bold tracking-[0.8px] text-[#34D399] uppercase">
              LIVE SYNC
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {/* Subheader & Back Button */}
          <View className="flex-row items-center justify-between mb-2">
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="w-8 h-8 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Back to dashboard"
            >
              <Ionicons name="arrow-back" size={16} color="#94A3B8" />
            </Pressable>

            <View className="bg-[#0C1226] border border-[#19244D] rounded-full px-3 py-1">
              <Text className="text-[10px] font-bold tracking-[1.5px] text-[#38BDF8] uppercase">
                • ANALYZE • VERIFY • TRUST
              </Text>
            </View>
          </View>

          {/* Screen Title */}
          <Text className="text-[22px] font-bold text-white mb-1">
            Analyzing Your Assignment
          </Text>
          <Text className="text-[13px] text-[#8E96B0] leading-[19px] mb-5">
            VeriWrite is processing your assignment and preparing an
            evidence-based analysis report.
          </Text>

          {/* Active Processing Pipeline Card */}
          <View className="bg-[#101426] border border-[#202948] rounded-[22px] p-4 mb-6">
            {/* Header pill & countdown */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center bg-[#132338] border border-[#1D3C63] rounded-full px-2.5 py-1">
                <View className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] mr-1.5" />
                <Text className="text-[10px] font-bold tracking-[0.8px] text-[#38BDF8] uppercase">
                  PROCESSING PIPELINE ACTIVE
                </Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons
                  name="time-outline"
                  size={13}
                  color="#67E8F9"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-[11.5px] font-semibold text-[#67E8F9]">
                  {elapsedSeconds > 0
                    ? `${elapsedSeconds}s elapsed`
                    : "Est. ~18s"}
                </Text>
              </View>
            </View>

            {/* Diagnostic Radial/Pill & File Ingest Info */}
            <View className="flex-row items-center mb-4">
              {/* Circular Diagnostic Meter */}
              <View className="w-20 h-20 rounded-full border-4 border-[#38BDF8] bg-[#0A1020] items-center justify-center mr-4 shadow-sm shadow-[#38BDF8]">
                <Text className="text-[18px] font-extrabold text-white">
                  {progressPercent}%
                </Text>
                <Text className="text-[8px] font-bold tracking-[0.8px] text-[#38BDF8] uppercase">
                  DIAGNOSTIC
                </Text>
              </View>

              {/* Secured Ingest Details */}
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Ionicons
                    name="shield-checkmark"
                    size={13}
                    color="#10B981"
                    style={{ marginRight: 5 }}
                  />
                  <Text className="text-[10px] font-bold tracking-[1px] text-[#10B981] uppercase">
                    SECURED INGEST
                  </Text>
                </View>
                <Text
                  className="text-[14px] font-bold text-white mb-0.5"
                  numberOfLines={1}
                >
                  {fileName}
                </Text>
                <Text className="text-[11.5px] text-[#8E96B0]">
                  {fileSizeStr} • SHA-256 Verified
                </Text>
              </View>
            </View>

            {/* Overall Phase Completion & Progress Bar */}
            <View className="pt-2 border-t border-[#182038]">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-[11px] text-[#8E96B0]">
                  Overall Phase Completion
                </Text>
                <Text className="text-[11px] font-bold text-white">
                  Stage {currentStage} of 5
                </Text>
              </View>
              <View className="w-full h-1.5 bg-[#182038] rounded-full overflow-hidden">
                <View
                  style={{ width: `${progressPercent}%` }}
                  className="h-full bg-[#38BDF8] rounded-full"
                />
              </View>
            </View>
          </View>

          {/* Pipeline Progression Section Header */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[11px] font-bold tracking-[1px] text-[#94A3B8] uppercase">
              PIPELINE PROGRESSION
            </Text>
            <Text className="text-[11px] font-bold tracking-[0.8px] text-[#38BDF8]">
              Live Telemetry
            </Text>
          </View>

          {/* Stage 1: File Uploaded */}
          <View className="flex-row items-start mb-3">
            <View className="items-center mr-3">
              <View className="w-6 h-6 rounded-full bg-[#0D2824] border border-[#14433B] items-center justify-center">
                <Ionicons name="checkmark" size={13} color="#10B981" />
              </View>
              <View className="w-0.5 h-10 bg-[#14433B] my-1" />
            </View>
            <View className="flex-1 bg-[#0F1426] border border-[#1D2544] rounded-2xl p-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-[13px] font-bold text-white">
                  File Uploaded Successfully
                </Text>
                <View className="bg-[#09221C] border border-[#14433B] rounded-full px-2 py-0.5">
                  <Text className="text-[9.5px] font-bold text-[#10B981]">
                    Done
                  </Text>
                </View>
              </View>
              <Text className="text-[11.5px] text-[#8E96B0] mb-1.5">
                Your assignment file has been uploaded securely.
              </Text>
              <View className="flex-row items-center">
                <Ionicons
                  name="time-outline"
                  size={11}
                  color="#64748B"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-[10.5px] text-[#64748B]">
                  Completed • {assignment.submittedDate || "Verified"}
                </Text>
              </View>
            </View>
          </View>

          {/* Stage 2: Extracting Text */}
          <View className="flex-row items-start mb-3">
            <View className="items-center mr-3">
              <View className="w-6 h-6 rounded-full bg-[#0D2824] border border-[#14433B] items-center justify-center">
                <Ionicons name="checkmark" size={13} color="#10B981" />
              </View>
              <View className="w-0.5 h-10 bg-[#1D2544] my-1" />
            </View>
            <View className="flex-1 bg-[#0F1426] border border-[#1D2544] rounded-2xl p-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-[13px] font-bold text-white">
                  Extracting Assignment Text
                </Text>
                <View className="bg-[#09221C] border border-[#14433B] rounded-full px-2 py-0.5">
                  <Text className="text-[9.5px] font-bold text-[#10B981]">
                    Parsed
                  </Text>
                </View>
              </View>
              <Text className="text-[11.5px] text-[#8E96B0] mb-1.5">
                Extracting and normalizing text content from your submission.
              </Text>
              <View className="flex-row items-center">
                <Ionicons
                  name="document-text-outline"
                  size={11}
                  color="#10B981"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-[10.5px] text-[#10B981] font-medium">
                  {wordCount} words parsed • Clean UTF-8 verified
                </Text>
              </View>
            </View>
          </View>

          {/* Stage 3: Checking AI Writing Indicators */}
          <View className="flex-row items-start mb-3">
            <View className="items-center mr-3">
              <View className="w-6 h-6 rounded-full bg-[#182846] border border-[#2F4D82] items-center justify-center">
                {currentStage >= 5 ? (
                  <Ionicons name="checkmark" size={13} color="#38BDF8" />
                ) : (
                  <ActivityIndicator size="small" color="#38BDF8" />
                )}
              </View>
              <View className="w-0.5 h-10 bg-[#1D2544] my-1" />
            </View>
            <View className="flex-1 bg-[#10172F] border border-[#2A3B6B] rounded-2xl p-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-[13px] font-bold text-white">
                  Checking AI Writing Indicators
                </Text>
                <View className="bg-[#142340] border border-[#2B4780] rounded-full px-2 py-0.5">
                  <Text className="text-[9.5px] font-bold text-[#38BDF8]">
                    {currentStage >= 5 ? "Completed" : "In Progress"}
                  </Text>
                </View>
              </View>
              <Text className="text-[11.5px] text-[#8E96B0] mb-2">
                Examining writing patterns and potential AI-related indicators.
              </Text>
              <View className="bg-[#090F1F] border border-[#1E2E54] rounded-xl px-2.5 py-1.5 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons
                    name="bar-chart-outline"
                    size={12}
                    color="#38BDF8"
                    style={{ marginRight: 5 }}
                  />
                  <Text className="text-[11px] font-semibold text-white">
                    {activeTelemetryStep}
                  </Text>
                </View>
                <Text className="text-[10px] font-bold text-[#38BDF8] uppercase">
                  {currentStage >= 5 ? "DONE" : "ACTIVE"}
                </Text>
              </View>
            </View>
          </View>

          {/* Stage 4: Checking Text Similarity */}
          <View className="flex-row items-start mb-3">
            <View className="items-center mr-3">
              <View className="w-6 h-6 rounded-full bg-[#121626] border border-[#1E253E] items-center justify-center">
                <Ionicons name="albums-outline" size={11} color="#64748B" />
              </View>
              <View className="w-0.5 h-10 bg-[#1D2544] my-1" />
            </View>
            <View className="flex-1 bg-[#0F1426] border border-[#1D2544] rounded-2xl p-3 opacity-90">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-[13px] font-bold text-[#CBD5E1]">
                  Checking Text Similarity
                </Text>
                <View className="bg-[#141A2D] border border-[#1E2640] rounded-full px-2 py-0.5">
                  <Text className="text-[9.5px] font-semibold text-[#8E96B0]">
                    Queued
                  </Text>
                </View>
              </View>
              <Text className="text-[11.5px] text-[#64748B] mb-1.5">
                Checking text for potential similarity with existing content.
              </Text>
              <View className="flex-row items-center">
                <Ionicons
                  name="hourglass-outline"
                  size={11}
                  color="#64748B"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-[10.5px] text-[#64748B]">
                  Similarity engine planned for future release
                </Text>
              </View>
            </View>
          </View>

          {/* Stage 5: Preparing Analysis Report */}
          <View className="flex-row items-start mb-6">
            <View className="items-center mr-3">
              <View
                className={`w-6 h-6 rounded-full ${
                  currentStage >= 5
                    ? "bg-[#0D2824] border border-[#14433B]"
                    : "bg-[#121626] border border-[#1E253E]"
                } items-center justify-center`}
              >
                <Ionicons
                  name={currentStage >= 5 ? "checkmark" : "lock-closed-outline"}
                  size={11}
                  color={currentStage >= 5 ? "#10B981" : "#64748B"}
                />
              </View>
            </View>
            <View className="flex-1 bg-[#0F1426] border border-[#1D2544] rounded-2xl p-3 opacity-90">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-[13px] font-bold text-[#CBD5E1]">
                  Preparing Analysis Report
                </Text>
                <View className="bg-[#141A2D] border border-[#1E2640] rounded-full px-2 py-0.5">
                  <Text className="text-[9.5px] font-semibold text-[#8E96B0]">
                    {currentStage >= 5 ? "Ready" : "Final phase"}
                  </Text>
                </View>
              </View>
              <Text className="text-[11.5px] text-[#64748B]">
                Organizing analysis findings and preparing your report.
              </Text>
            </View>
          </View>

          {/* Error Banner (if analysis fails) */}
          {analysisError ? (
            <View className="bg-[#241113] border border-[#522026] rounded-2xl p-4 mb-6">
              <View className="flex-row items-start mb-2">
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color="#EF4444"
                  style={{ marginTop: 1, marginRight: 8 }}
                />
                <View className="flex-1">
                  <Text className="text-[13.5px] font-bold text-[#FCA5A5] mb-1">
                    {analysisError.isInsufficientText
                      ? "Insufficient Word Count for Analysis"
                      : analysisError.isConflict
                      ? "Analysis Already In Progress"
                      : "Analysis Could Not Complete"}
                  </Text>
                  <Text className="text-[12px] text-[#F87171] leading-[17px]">
                    {analysisError.isInsufficientText
                      ? "This submission has fewer than 100 words. VeriWrite requires at least 100 words to calculate statistically defensible stylometric indicators. Please submit a longer draft."
                      : analysisError.message}
                  </Text>
                </View>
              </View>

              <View className="flex-row mt-2">
                <Pressable
                  onPress={onClose}
                  className="flex-1 h-[38px] bg-[#3B191D] border border-[#68242C] rounded-xl items-center justify-center mr-2 active:opacity-80"
                  accessibilityRole="button"
                >
                  <Text className="text-[12.5px] font-bold text-white">
                    Dismiss
                  </Text>
                </Pressable>

                {!analysisError.isInsufficientText ? (
                  <Pressable
                    onPress={() => {
                      hasTriggeredRef.current = false;
                      setAnalysisError(null);
                    }}
                    className="flex-1 h-[38px] bg-[#1E294B] border border-[#38BDF8] rounded-xl items-center justify-center active:opacity-80"
                    accessibilityRole="button"
                  >
                    <Text className="text-[12.5px] font-bold text-white">
                      Retry
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Forensic Integrity Banner */}
          <View className="bg-[#0B1020] border border-[#162244] rounded-2xl p-4 mb-6 flex-row items-start">
            <Ionicons
              name="shield-checkmark"
              size={18}
              color="#38BDF8"
              style={{ marginTop: 2, marginRight: 10 }}
            />
            <View className="flex-1">
              <Text className="text-[10px] font-bold tracking-[1px] text-[#38BDF8] uppercase mb-1">
                256-BIT FORENSIC INTEGRITY GUARANTEED • ANALYZE • VERIFY • TRUST
              </Text>
              <Text className="text-[11.5px] text-[#8E96B0] leading-[17px]">
                You can safely navigate away; we'll notify you once your
                verification report is finalized.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({});
