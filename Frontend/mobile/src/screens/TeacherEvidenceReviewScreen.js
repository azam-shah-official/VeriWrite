import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchAssignmentEvidence,
  submitTeacherReview,
  submitFindingDecision,
  addTeacherComment,
  fetchTeacherAuditTrail,
} from "../utils/apiClient";
import HighlightedEvidenceViewer from "../components/HighlightedEvidenceViewer";
import { downloadAndShareReport, printReport } from "../utils/reportPdfGenerator";

const formatDate = (dateString) => {
  if (!dateString) return "Recently";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (_e) {
    return "Recently";
  }
};

const formatTime = (dateString) => {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch (_e) {
    return "";
  }
};

const getVerdictBadge = (verdict) => {
  switch (verdict) {
    case "Approved":
    case "Authentic Authorship Confirmed":
      return {
        bg: "bg-[#09221C]",
        border: "border-[#144837]",
        text: "text-[#34D399]",
        label: "Approved",
      };
    case "Needs Clarification":
    case "Discussed with Student":
      return {
        bg: "bg-[#291F0E]",
        border: "border-[#4A381A]",
        text: "text-[#FBBF24]",
        label: "Needs Clarification",
      };
    case "Further Review Required":
    case "Misconduct Investigation":
    case "Revision Requested":
      return {
        bg: "bg-[#2B1417]",
        border: "border-[#522229]",
        text: "text-[#F87171]",
        label: "Further Review",
      };
    default:
      return {
        bg: "bg-[#1E2746]",
        border: "border-[#2D3960]",
        text: "text-[#94A3B8]",
        label: "Under Review",
      };
  }
};

export default function TeacherEvidenceReviewScreen({
  submission,
  onClose,
  onReviewSubmitted,
}) {
  const [evidenceData, setEvidenceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Active finding and category selection
  const [activeFindingId, setActiveFindingId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Faculty feedback state (overall determination notes)
  const [feedbackText, setFeedbackText] = useState(
    submission?.feedbackNotes || submission?.teacherReview?.feedbackNotes || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentVerdict, setCurrentVerdict] = useState(
    submission?.verdict || submission?.teacherReview?.verdict || "Pending"
  );

  // Task 11: Finding decisions map { [findingId]: { decision, notes, reviewedAt } }
  const [findingDecisions, setFindingDecisions] = useState({});
  const [isUpdatingFindingDecision, setIsUpdatingFindingDecision] = useState(false);

  // Task 12: Comments state
  const [commentsList, setCommentsList] = useState([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Task 13: Audit trail state
  const [auditTrailList, setAuditTrailList] = useState([]);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [isLoadingAuditTrail, setIsLoadingAuditTrail] = useState(false);
  const [isAuditTrailLoaded, setIsAuditTrailLoaded] = useState(false);

  // PDF Export and Print states
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  const assignmentId = submission?.id;

  const isPrintOrShareCancelled = (err) => {
    const msg = String(err?.message || err || "").toLowerCase();
    return (
      msg.includes("cancel") ||
      msg.includes("dismiss") ||
      msg.includes("abort") ||
      err?.code === "CANCELLED" ||
      err?.name === "AbortError"
    );
  };

  /**
   * Verified retrieval of forensic audit trail.
   * Throws an error on fetch failure to prevent unverified or incomplete records from being certified.
   */
  const ensureAuditTrail = async () => {
    if (isAuditTrailLoaded && Array.isArray(auditTrailList)) {
      return auditTrailList;
    }
    if (!assignmentId) {
      throw new Error("Missing submission ID for forensic verification.");
    }
    const response = await fetchTeacherAuditTrail(assignmentId);
    if (!response.ok || !response.data?.success || !Array.isArray(response.data?.auditTrail)) {
      const serverMessage =
        response.data?.message || "Failed to retrieve verified audit trail records from the server.";
      throw new Error(`Audit trail verification failed (${serverMessage}). Generation halted to protect evidentiary integrity.`);
    }
    setAuditTrailList(response.data.auditTrail);
    setIsAuditTrailLoaded(true);
    return response.data.auditTrail;
  };

  const handleDownloadForensicReport = async () => {
    if (isDownloadingPdf || isPrintingReport) return;
    setIsDownloadingPdf(true);
    try {
      const trail = await ensureAuditTrail();
      const persistedReviewerName =
        evidenceData?.teacherReview?.reviewerName ||
        submission?.reviewerName ||
        null;

      await downloadAndShareReport({
        submission,
        evidenceData,
        role: "TEACHER",
        auditTrail: trail,
        findingDecisions,
        verdict: currentVerdict,
        feedbackNotes: feedbackText,
        reviewerName: persistedReviewerName,
      });
    } catch (err) {
      if (!isPrintOrShareCancelled(err)) {
        Alert.alert(
          "Forensic Report Export Halted",
          err?.message || "Could not generate verified forensic PDF report."
        );
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintForensicReport = async () => {
    if (isDownloadingPdf || isPrintingReport) return;
    setIsPrintingReport(true);
    try {
      const trail = await ensureAuditTrail();
      const persistedReviewerName =
        evidenceData?.teacherReview?.reviewerName ||
        submission?.reviewerName ||
        null;

      await printReport({
        submission,
        evidenceData,
        role: "TEACHER",
        auditTrail: trail,
        findingDecisions,
        verdict: currentVerdict,
        feedbackNotes: feedbackText,
        reviewerName: persistedReviewerName,
      });
    } catch (err) {
      if (!isPrintOrShareCancelled(err)) {
        Alert.alert(
          "Print Forensic Report Failed",
          err?.message || "Could not open print spooler."
        );
      }
    } finally {
      setIsPrintingReport(false);
    }
  };

  const loadEvidence = useCallback(async () => {
    if (!assignmentId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetchAssignmentEvidence(assignmentId);
      if (response.ok && response.data?.success) {
        setEvidenceData(response.data);

        // Populate finding decisions map
        const decisionsMap = {};
        if (Array.isArray(response.data.findingReviews)) {
          response.data.findingReviews.forEach((fr) => {
            if (fr.findingId) {
              decisionsMap[fr.findingId] = {
                decision: fr.decision,
                notes: fr.notes || "",
                reviewedAt: fr.reviewedAt,
              };
            }
          });
        }
        setFindingDecisions(decisionsMap);

        // Populate comments
        if (Array.isArray(response.data.teacherComments)) {
          setCommentsList(response.data.teacherComments);
        }
      } else {
        setLoadError(
          response.data?.message || "Failed to load submission evidence."
        );
      }
    } catch (_err) {
      setLoadError("Network error while connecting to evidence service.");
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  const findings = useMemo(() => {
    return Array.isArray(evidenceData?.evidenceMap?.findings)
      ? evidenceData.evidenceMap.findings
      : [];
  }, [evidenceData]);

  // Set active finding to first one when loaded if not yet set
  useEffect(() => {
    if (findings.length > 0 && !activeFindingId) {
      setActiveFindingId(findings[0].findingId);
    }
  }, [findings, activeFindingId]);

  const activeFinding = useMemo(() => {
    if (!activeFindingId) return findings[0] || null;
    return findings.find((f) => f.findingId === activeFindingId) || null;
  }, [activeFindingId, findings]);

  // Task 11: Handle accept / reject finding decision
  const handleFindingDecision = async (decision) => {
    if (!assignmentId || !activeFinding?.findingId || isUpdatingFindingDecision) return;

    setIsUpdatingFindingDecision(true);
    try {
      const response = await submitFindingDecision(
        assignmentId,
        activeFinding.findingId,
        { decision, notes: "" }
      );

      if (response.ok && response.data?.success) {
        setFindingDecisions((prev) => ({
          ...prev,
          [activeFinding.findingId]: {
            decision,
            notes: "",
            reviewedAt: new Date().toISOString(),
          },
        }));

        // Refresh audit trail if open
        if (isAuditTrailOpen) {
          loadAuditTrail();
        }
      } else {
        Alert.alert(
          "Error",
          response.data?.message || "Failed to save finding decision."
        );
      }
    } catch (_err) {
      Alert.alert("Error", "Network error while saving finding decision.");
    } finally {
      setIsUpdatingFindingDecision(false);
    }
  };

  // Task 12: Handle posting comment
  const handlePostComment = async () => {
    if (!assignmentId || !newCommentText.trim() || isPostingComment) return;

    setIsPostingComment(true);
    try {
      const response = await addTeacherComment(assignmentId, {
        text: newCommentText.trim(),
        findingId: activeFinding?.findingId || null,
      });

      if (response.ok && response.data?.success) {
        if (response.data.comment) {
          setCommentsList((prev) => [...prev, response.data.comment]);
        } else if (Array.isArray(response.data.comments)) {
          setCommentsList(response.data.comments);
        }
        setNewCommentText("");

        if (isAuditTrailOpen) {
          loadAuditTrail();
        }
      } else {
        Alert.alert(
          "Error",
          response.data?.message || "Failed to post teacher comment."
        );
      }
    } catch (_err) {
      Alert.alert("Error", "Network error while posting comment.");
    } finally {
      setIsPostingComment(false);
    }
  };

  // Task 13: Load audit trail
  const loadAuditTrail = async () => {
    if (!assignmentId) return;
    setIsLoadingAuditTrail(true);
    try {
      const response = await fetchTeacherAuditTrail(assignmentId);
      if (response.ok && Array.isArray(response.data?.auditTrail)) {
        setAuditTrailList(response.data.auditTrail);
        setIsAuditTrailLoaded(true);
      }
    } catch (_err) {
      // non-blocking for manual UI toggle
    } finally {
      setIsLoadingAuditTrail(false);
    }
  };

  const handleToggleAuditTrail = () => {
    const nextState = !isAuditTrailOpen;
    setIsAuditTrailOpen(nextState);
    if (nextState) {
      loadAuditTrail();
    }
  };

  const handleDecision = async (verdict) => {
    if (!assignmentId) return;

    setIsSubmitting(true);
    try {
      const response = await submitTeacherReview(assignmentId, {
        verdict,
        feedbackNotes: feedbackText,
        isSharedWithStudent: true,
      });

      if (response.ok && response.data?.success) {
        setCurrentVerdict(verdict);
        Alert.alert(
          "Faculty Determination Submitted",
          `Submission review marked as '${verdict}'.`,
          [
            {
              text: "Done",
              onPress: () => {
                if (onReviewSubmitted) {
                  onReviewSubmitted({
                    ...submission,
                    reviewStatus: response.data?.submission?.reviewStatus || "Reviewed",
                    verdict,
                    feedbackNotes: feedbackText,
                  });
                }
                if (onClose) {
                  onClose();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Review Submission Failed",
          response.data?.message || "Could not save faculty review."
        );
      }
    } catch (_err) {
      Alert.alert(
        "Connection Error",
        "Unable to submit review. Please check your internet connection."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const verdictBadge = getVerdictBadge(currentVerdict);
  const activeFindingDecision = activeFinding
    ? findingDecisions[activeFinding.findingId]?.decision || "Pending"
    : "Pending";
  const renderReviewHeader = () => (
    <View className="pb-2">
        {/* Audit Mode Header Card */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center bg-[#0F1B38] border border-[#1E2E5C] rounded-full px-2.5 py-1">
            <Ionicons name="finger-print-outline" size={12} color="#38BDF8" style={{ marginRight: 4 }} />
            <Text className="text-[9.5px] font-bold text-[#38BDF8] tracking-[0.5px] uppercase">
              FORENSIC DOCUMENT REVIEW
            </Text>
          </View>

          <View className={`px-2.5 py-0.5 rounded-full border ${verdictBadge.bg} ${verdictBadge.border}`}>
            <Text className={`text-[10px] font-bold ${verdictBadge.text}`}>
              • {verdictBadge.label}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text className="text-[20px] font-bold text-white mb-0.5">
          Teacher Review & Evidence
        </Text>
        <Text className="text-[11.5px] text-[#8E96B0] mb-3">
          Review student submission, evaluate flagged forensic evidence, and submit faculty determination.
        </Text>

        {/* Assignment Metadata Card */}
        <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-7 h-7 rounded-lg bg-[#141C34] border border-[#222E54] items-center justify-center mr-2">
                <Ionicons name="school-outline" size={14} color="#38BDF8" />
              </View>
              <View className="flex-1">
                <Text className="text-[12px] font-bold text-white" numberOfLines={1}>
                  {submission?.course || "General Course"}
                </Text>
                <Text className="text-[10px] text-[#8E96B0]" numberOfLines={1}>
                  {submission?.title || "Assignment Submission"}
                </Text>
              </View>
            </View>

            <Text className="text-[10px] text-[#64748B]">
              {formatDate(submission?.submittedDate)}
            </Text>
          </View>

          <View className="flex-row items-center justify-between pt-2 border-t border-[#182038]">
            <View>
              <Text className="text-[9.5px] uppercase tracking-[0.5px] text-[#64748B]">
                Student
              </Text>
              <Text className="text-[11.5px] font-bold text-[#CBD5E1]">
                {submission?.studentName || "Student"}
              </Text>
            </View>

            <View className="items-end">
              <Text className="text-[9.5px] uppercase tracking-[0.5px] text-[#64748B]">
                Word Count
              </Text>
              <Text className="text-[11.5px] font-bold text-[#CBD5E1]">
                {submission?.wordCount ? `${submission.wordCount.toLocaleString()} words` : "Analyzed"}
              </Text>
            </View>
          </View>
        </View>

        {/* Interactive Document Header */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Ionicons
              name="reader-outline"
              size={16}
              color="#38BDF8"
              style={{ marginRight: 6 }}
            />
            <Text className="text-[15px] font-bold text-white">
              Assignment Document
            </Text>
          </View>
          <Text className="text-[10px] text-[#38BDF8] font-bold">
            Interactive Forensic View
          </Text>
        </View>
    </View>
  );

  const renderReviewFooter = () => (
    <View className="pt-2 pb-8">
            {/* Evidence Details Card */}
            {activeFinding ? (
              <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-4">
                <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-[#182038]">
                  <View className="flex-row items-center">
                    <Ionicons
                      name="search-outline"
                      size={15}
                      color="#818CF8"
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-[14px] font-bold text-white">
                      Evidence Details
                    </Text>
                  </View>
                  <View className="bg-[#181F38] border border-[#25325C] rounded-full px-2 py-0.5">
                    <Text className="text-[9px] font-bold text-[#818CF8]">
                      CRITICAL TELEMETRY
                    </Text>
                  </View>
                </View>

                {/* Finding Switcher Pills if multiple findings */}
                {findings.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-3 max-h-8"
                  >
                    {findings.map((f, fIdx) => {
                      const isSelected = f.findingId === activeFinding.findingId;
                      const fDecision = findingDecisions[f.findingId]?.decision;
                      return (
                        <Pressable
                          key={`fnd-tab-${f.findingId}`}
                          onPress={() => setActiveFindingId(f.findingId)}
                          className={`mr-2 px-2.5 py-1 rounded-full border flex-row items-center ${
                            isSelected
                              ? "bg-[#1E294B] border-[#818CF8]"
                              : "bg-[#0C101E] border-[#182038]"
                          }`}
                        >
                          {fDecision === "Accepted" ? (
                            <Ionicons name="checkmark-circle" size={10} color="#34D399" style={{ marginRight: 3 }} />
                          ) : fDecision === "Rejected" ? (
                            <Ionicons name="close-circle" size={10} color="#F87171" style={{ marginRight: 3 }} />
                          ) : null}
                          <Text
                            className={`text-[10px] font-bold ${
                              isSelected ? "text-[#818CF8]" : "text-[#64748B]"
                            }`}
                          >
                            {String(fIdx + 1).padStart(2, "0")} {f.severity}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}

                {/* 1. Flagged Passage */}
                <Text className="text-[10px] font-bold tracking-[0.8px] text-[#38BDF8] uppercase mb-1">
                  1. FLAGGED PASSAGE (Para {activeFinding.paragraphIndex + 1})
                </Text>
                <View className="bg-[#080B14] border border-[#182038] rounded-xl p-3 mb-3">
                  <Text className="text-[12px] italic font-mono text-[#CBD5E1] leading-[18px]">
                    "{activeFinding.snippet}"
                  </Text>
                </View>

                {/* 2. Forensic Classification */}
                <Text className="text-[10px] font-bold tracking-[0.8px] text-[#FBBF24] uppercase mb-1">
                  2. FORENSIC CLASSIFICATION
                </Text>
                <View className="bg-[#0C1224] border border-[#1A264D] rounded-xl p-3 mb-3 flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-[12.5px] font-bold text-white mb-0.5">
                      {activeFinding.indicatorLabel || activeFinding.indicatorCode}
                    </Text>
                    <Text className="text-[10.5px] text-[#8E96B0]">
                      Severity: {activeFinding.severity}
                    </Text>
                  </View>
                  <View className="bg-[#121B35] border border-[#202E5C] rounded-full px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-[#38BDF8]">
                      {activeFinding.isExactMatch ? "100% Match" : "Pattern Flag"}
                    </Text>
                  </View>
                </View>

                {/* 3. Reason for Flag */}
                <Text className="text-[10px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase mb-1">
                  3. REASON FOR FLAG
                </Text>
                <Text className="text-[11.5px] text-[#CBD5E1] leading-[17px] mb-3">
                  {activeFinding.flagReason || activeFinding.indicatorExplanation}
                </Text>

                {/* 4. Pedagogical Guidance */}
                {activeFinding.explanationDetails ? (
                  <View className="bg-[#0B1526] border border-[#192E50] rounded-xl p-3 mb-3">
                    <Text className="text-[10px] font-bold tracking-[0.8px] text-[#38BDF8] uppercase mb-1">
                      4. CONSIDERATION & PEDAGOGY
                    </Text>
                    <Text className="text-[11px] text-[#93C5FD] leading-[16px] mb-1.5">
                      {activeFinding.explanationDetails.improvementTip}
                    </Text>
                    <Text className="text-[9.5px] text-[#64748B] italic">
                      {activeFinding.explanationDetails.disclaimer}
                    </Text>
                  </View>
                ) : null}

                {/* 5. Task 11: Faculty Finding Evaluation (Accept / Reject) */}
                <View className="bg-[#080D1D] border border-[#1D2A4F] rounded-xl p-3 mt-1">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-[10px] font-bold tracking-[0.8px] text-[#A5B4FC] uppercase">
                      5. INDIVIDUAL FINDING EVALUATION
                    </Text>
                    <View
                      className={`px-2 py-0.5 rounded-full border ${
                        activeFindingDecision === "Accepted"
                          ? "bg-[#09221C] border-[#144837]"
                          : activeFindingDecision === "Rejected"
                          ? "bg-[#2B1417] border-[#522229]"
                          : "bg-[#181F38] border-[#25325C]"
                      }`}
                    >
                      <Text
                        className={`text-[9.5px] font-bold ${
                          activeFindingDecision === "Accepted"
                            ? "text-[#34D399]"
                            : activeFindingDecision === "Rejected"
                            ? "text-[#F87171]"
                            : "text-[#94A3B8]"
                        }`}
                      >
                        {activeFindingDecision === "Accepted"
                          ? "✓ Accepted Finding"
                          : activeFindingDecision === "Rejected"
                          ? "✗ Dismissed / False Positive"
                          : "Decision Pending"}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-[11px] text-[#8E96B0] mb-2.5">
                    Evaluate whether this specific stylometric anomaly represents an authentic concern or an acceptable variation.
                  </Text>

                  {/* Accept & Reject Action Buttons */}
                  <View className="flex-row space-x-2">
                    {/* Accept Button */}
                    <Pressable
                      disabled={isUpdatingFindingDecision}
                      onPress={() => handleFindingDecision("Accepted")}
                      className={`flex-1 py-2 px-3 rounded-lg flex-row items-center justify-center mr-1.5 border active:opacity-85 ${
                        activeFindingDecision === "Accepted"
                          ? "bg-[#0B3326] border-[#10B981]"
                          : "bg-[#0B1E19] border-[#144338]"
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel="Accept this finding"
                    >
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={activeFindingDecision === "Accepted" ? "#34D399" : "#10B981"}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        className={`text-[11.5px] font-bold ${
                          activeFindingDecision === "Accepted" ? "text-white" : "text-[#34D399]"
                        }`}
                      >
                        Accept Finding
                      </Text>
                    </Pressable>

                    {/* Reject Button */}
                    <Pressable
                      disabled={isUpdatingFindingDecision}
                      onPress={() => handleFindingDecision("Rejected")}
                      className={`flex-1 py-2 px-3 rounded-lg flex-row items-center justify-center ml-1.5 border active:opacity-85 ${
                        activeFindingDecision === "Rejected"
                          ? "bg-[#3D1A1F] border-[#EF4444]"
                          : "bg-[#201015] border-[#4A2027]"
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel="Reject this finding"
                    >
                      <Ionicons
                        name="close"
                        size={14}
                        color={activeFindingDecision === "Rejected" ? "#FCA5A5" : "#F87171"}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        className={`text-[11.5px] font-bold ${
                          activeFindingDecision === "Rejected" ? "text-white" : "text-[#F87171]"
                        }`}
                      >
                        Reject / Dismiss
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}

        {/* Task 12: Teacher Comments & Feedback Discussion */}
        <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-[#182038]">
            <View className="flex-row items-center">
              <Ionicons
                name="chatbubbles-outline"
                size={16}
                color="#38BDF8"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[14px] font-bold text-white">
                Teacher Comments & Feedback
              </Text>
            </View>
            <View className="bg-[#0C243B] border border-[#194D7C] rounded-full px-2 py-0.5">
              <Text className="text-[9px] font-bold text-[#38BDF8]">
                {commentsList.length} {commentsList.length === 1 ? "Comment" : "Comments"}
              </Text>
            </View>
          </View>

          {/* Comment Thread List */}
          {commentsList.length > 0 ? (
            <View className="mb-3">
              {commentsList.map((c, cIdx) => (
                <View
                  key={`comment-${c.commentId || cIdx}`}
                  className="bg-[#080B14] border border-[#182038] rounded-xl p-3 mb-2"
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center">
                      <Ionicons
                        name="person-circle-outline"
                        size={13}
                        color="#818CF8"
                        style={{ marginRight: 4 }}
                      />
                      <Text className="text-[11px] font-bold text-white">
                        {c.teacherName || "Faculty Instructor"}
                      </Text>
                      {c.findingId ? (
                        <View className="bg-[#181F38] border border-[#25325C] rounded px-1.5 py-0.2 ml-2">
                          <Text className="text-[8.5px] font-bold text-[#818CF8]">
                            Finding Reference
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-[9.5px] text-[#64748B]">
                      {formatDate(c.createdAt)} {formatTime(c.createdAt)}
                    </Text>
                  </View>
                  <Text className="text-[11.5px] text-[#CBD5E1] leading-[17px]">
                    {c.text}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-[11px] text-[#64748B] italic mb-3">
              No comments posted yet. Add overall feedback or specific finding notes below.
            </Text>
          )}

          {/* Add Comment Input */}
          <View className="bg-[#080B14] border border-[#1A233D] rounded-xl p-3 mb-2.5">
            <TextInput
              multiline
              numberOfLines={3}
              value={newCommentText}
              onChangeText={setNewCommentText}
              placeholder={
                activeFinding
                  ? `Add a comment (attached to ${activeFinding.indicatorLabel || "this section"})...`
                  : "Add instructor feedback note for student..."
              }
              placeholderTextColor="#475569"
              className="text-[12px] text-[#CBD5E1] leading-[18px] min-h-[50px]"
              textAlignVertical="top"
            />
          </View>

          <Pressable
            disabled={isPostingComment || !newCommentText.trim()}
            onPress={handlePostComment}
            className={`self-end py-1.5 px-3.5 rounded-lg flex-row items-center active:opacity-85 ${
              newCommentText.trim() ? "bg-[#0284C7]" : "bg-[#141C34] opacity-50"
            }`}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
          >
            {isPostingComment ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
            ) : (
              <Ionicons name="send" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            )}
            <Text className="text-[11px] font-bold text-white">Post Comment</Text>
          </Pressable>
        </View>

        {/* Task 13: Review History & Audit Trail Accordion */}
        <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-4">
          <Pressable
            onPress={handleToggleAuditTrail}
            className="flex-row items-center justify-between"
            accessibilityRole="button"
            accessibilityLabel="Toggle review audit trail"
          >
            <View className="flex-row items-center">
              <Ionicons
                name="time-outline"
                size={16}
                color="#A5B4FC"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[14px] font-bold text-white">
                Review History & Audit Trail
              </Text>
            </View>
            <Ionicons
              name={isAuditTrailOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color="#94A3B8"
            />
          </Pressable>

          {isAuditTrailOpen ? (
            <View className="mt-3 pt-3 border-t border-[#182038]">
              {isLoadingAuditTrail ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text className="text-[11px] text-[#8E96B0] mt-1.5">
                    Loading audit trail...
                  </Text>
                </View>
              ) : auditTrailList.length > 0 ? (
                auditTrailList.map((rec, rIdx) => (
                  <View
                    key={`audit-${rec.recordId || rIdx}`}
                    className="flex-row items-start mb-2.5 last:mb-0"
                  >
                    <View className="w-2 h-2 rounded-full bg-[#818CF8] mt-1.5 mr-2" />
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[11px] font-bold text-[#CBD5E1]">
                          {rec.action.replace(/_/g, " ")}
                        </Text>
                        <Text className="text-[9.5px] text-[#64748B]">
                          {formatDate(rec.timestamp)} {formatTime(rec.timestamp)}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-[#8E96B0]">
                        {rec.previousValue
                          ? `Changed from '${rec.previousValue}' to '${rec.newValue}'`
                          : `Value: '${rec.newValue}'`}
                      </Text>
                      {rec.teacherName ? (
                        <Text className="text-[9px] text-[#64748B]">
                          Recorded by: {rec.teacherName}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-[11px] text-[#64748B] italic py-2">
                  No review audit records recorded yet. Actions will appear here as findings are evaluated.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Teacher Review & Final Decision Card */}
        <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-8">
          <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-[#182038]">
            <View className="flex-row items-center">
              <Ionicons
                name="shield-checkmark"
                size={16}
                color="#10B981"
                style={{ marginRight: 6 }}
              />
              <Text className="text-[14px] font-bold text-white">
                Teacher Review & Final Decision
              </Text>
            </View>
            <View className="bg-[#0C241D] border border-[#144837] rounded-full px-2 py-0.5">
              <Text className="text-[9px] font-bold text-[#34D399]">
                Faculty Action
              </Text>
            </View>
          </View>

          {/* Teacher Overall Summary Comments Input */}
          <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1.5">
            Final Evaluation Notes & Summary
          </Text>
          <View className="bg-[#080B14] border border-[#1A233D] rounded-xl p-3 mb-4">
            <TextInput
              multiline
              numberOfLines={4}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Enter final summary notes, recommendations, or instructions for the student..."
              placeholderTextColor="#475569"
              className="text-[12px] text-[#CBD5E1] leading-[18px] min-h-[70px]"
              textAlignVertical="top"
            />
          </View>

          {/* Determination Buttons */}
          <Text className="text-[11px] font-bold tracking-[0.8px] text-[#64748B] uppercase mb-2">
            SUBMIT FINAL DETERMINATION
          </Text>

          {/* 1. Approved Button (Green) */}
          <Pressable
            disabled={isSubmitting}
            onPress={() => handleDecision("Approved")}
            className="w-full bg-[#0A261D] border border-[#14533C] rounded-xl p-3.5 mb-2.5 flex-row items-center justify-between active:opacity-85"
            accessibilityRole="button"
            accessibilityLabel="Approve assignment"
          >
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-7 h-7 rounded-lg bg-[#0F382B] items-center justify-center mr-2.5">
                <Ionicons name="checkmark-circle" size={17} color="#34D399" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-white mb-0.5">
                  Approved
                </Text>
                <Text className="text-[10px] text-[#34D399]">
                  Matches expectations & exhibits integrity
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#34D399" />
          </Pressable>

          {/* 2. Needs Clarification Button (Amber) */}
          <Pressable
            disabled={isSubmitting}
            onPress={() => handleDecision("Needs Clarification")}
            className="w-full bg-[#291F0E] border border-[#523F1C] rounded-xl p-3.5 mb-2.5 flex-row items-center justify-between active:opacity-85"
            accessibilityRole="button"
            accessibilityLabel="Request clarification from student"
          >
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-7 h-7 rounded-lg bg-[#3D2F14] items-center justify-center mr-2.5">
                <Ionicons name="alert-circle" size={17} color="#FBBF24" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-white mb-0.5">
                  Needs Clarification
                </Text>
                <Text className="text-[10px] text-[#FBBF24]">
                  Requires student explanation or discussion
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FBBF24" />
          </Pressable>

          {/* 3. Further Review Required Button (Red) */}
          <Pressable
            disabled={isSubmitting}
            onPress={() => handleDecision("Further Review Required")}
            className="w-full bg-[#2B1417] border border-[#57222A] rounded-xl p-3.5 mb-3 flex-row items-center justify-between active:opacity-85"
            accessibilityRole="button"
            accessibilityLabel="Flag for further review"
          >
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-7 h-7 rounded-lg bg-[#421A20] items-center justify-center mr-2.5">
                <Ionicons name="flag" size={17} color="#F87171" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-white mb-0.5">
                  Further Review Required
                </Text>
                <Text className="text-[10px] text-[#F87171]">
                  Flag for departmental academic review
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#F87171" />
          </Pressable>

          {/* Institutional Dossier Export Card */}
          <View className="bg-[#0D1224] border border-[#1E293B] rounded-2xl p-4 mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-7 h-7 rounded-lg bg-[#0284C7]/20 border border-[#0284C7]/40 items-center justify-center mr-2.5">
                  <Ionicons name="document-text-outline" size={16} color="#38BDF8" />
                </View>
                <View>
                  <Text className="text-[12.5px] font-bold text-white">
                    Institutional Evidence Dossier
                  </Text>
                  <Text className="text-[10px] text-[#64748B]">
                    Tamper-evident forensic PDF with full audit trail
                  </Text>
                </View>
              </View>
            </View>
            
            <View className="flex-row items-center mt-2">
              <Pressable
                disabled={isDownloadingPdf || isPrintingReport}
                onPress={handleDownloadForensicReport}
                className="flex-1 h-[40px] bg-[#0284C7] rounded-xl flex-row items-center justify-center mr-1.5 active:opacity-85"
                accessibilityRole="button"
                accessibilityLabel="Download PDF Dossier"
              >
                {isDownloadingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-download-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text className="text-[11.5px] font-bold text-white">Export PDF Dossier</Text>
                  </>
                )}
              </Pressable>
              
              <Pressable
                disabled={isDownloadingPdf || isPrintingReport}
                onPress={handlePrintForensicReport}
                className="flex-1 h-[40px] bg-[#141C33] border border-[#233159] rounded-xl flex-row items-center justify-center ml-1.5 active:opacity-85"
                accessibilityRole="button"
                accessibilityLabel="Print Evidence Dossier"
              >
                {isPrintingReport ? (
                  <ActivityIndicator size="small" color="#38BDF8" />
                ) : (
                  <>
                    <Ionicons name="print-outline" size={15} color="#CBD5E1" style={{ marginRight: 6 }} />
                    <Text className="text-[11.5px] font-bold text-[#E2E8F0]">Print Dossier</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* Faculty Discretion Disclaimer */}
          <View className="bg-[#080B14] border border-[#162038] rounded-xl p-3 flex-row items-start">
            <Ionicons
              name="information-circle-outline"
              size={15}
              color="#64748B"
              style={{ marginTop: 1, marginRight: 8 }}
            />
            <Text className="flex-1 text-[10.5px] text-[#64748B] leading-[15px]">
              Faculty Discretion: AI indicators and stylometric scores are advisory formulas to assist human review. Final academic evaluations remain exclusively under faculty judgment.
            </Text>
          </View>
        </View>
      </View>
  );


  return (
    <SafeAreaView className="flex-1 bg-[#080B14]">
      {/* Top Header Bar */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3 border-b border-[#14192C]">
        <View className="flex-row items-center flex-1 mr-2">
          <Pressable
            onPress={onClose}
            hitSlop={10}
            className="w-8 h-8 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center mr-3 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
          >
            <Ionicons name="arrow-back" size={17} color="#94A3B8" />
          </Pressable>
          <View>
            <Text className="text-[14px] font-bold text-white">
              Forensic Document Audit
            </Text>
            <Text className="text-[10px] text-[#38BDF8] font-bold tracking-[1px] uppercase">
              • AUDIT MODE
            </Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <Pressable
            disabled={isDownloadingPdf || isPrintingReport}
            onPress={handlePrintForensicReport}
            hitSlop={8}
            className="w-8 h-8 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center mr-2 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Print Report"
          >
            {isPrintingReport ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Ionicons name="print-outline" size={15} color="#CBD5E1" />
            )}
          </Pressable>
          <Pressable
            disabled={isDownloadingPdf || isPrintingReport}
            onPress={handleDownloadForensicReport}
            hitSlop={8}
            className="w-8 h-8 rounded-xl bg-[#0284C7]/20 border border-[#0284C7]/40 items-center justify-center mr-2 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Download Forensic Report"
          >
            {isDownloadingPdf ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Ionicons name="cloud-download-outline" size={15} color="#38BDF8" />
            )}
          </Pressable>
          <View className="w-8 h-8 rounded-full bg-[#182038] border border-[#25325C] items-center justify-center">
            <Ionicons name="person" size={14} color="#818CF8" />
          </View>
        </View>
      </View>

      {isLoading || loadError ? (
        <ScrollView className="flex-1 px-5 pt-3" showsVerticalScrollIndicator={false}>
          {renderReviewHeader()}
          {isLoading ? (
            <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-8 items-center mb-4">
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text className="text-[13px] font-bold text-white mt-3 mb-1">
                Extracting Forensic Evidence...
              </Text>
              <Text className="text-[11px] text-[#8E96B0] text-center">
                Synchronizing character offsets and mapping indicators to extracted text.
              </Text>
            </View>
          ) : (
            <View className="bg-[#2B1417] border border-[#522229] rounded-[20px] p-4 mb-4">
              <View className="flex-row items-center mb-1.5">
                <Ionicons name="alert-circle" size={16} color="#F87171" style={{ marginRight: 6 }} />
                <Text className="text-[13px] font-bold text-[#F87171]">
                  Evidence Unavailable
                </Text>
              </View>
              <Text className="text-[11.5px] text-[#CBD5E1] mb-2.5">
                {loadError}
              </Text>
              <Pressable
                onPress={loadEvidence}
                className="bg-[#3D1A1F] border border-[#6B242C] rounded-lg py-1.5 px-3 self-start active:opacity-80"
              >
                <Text className="text-[11px] font-bold text-white">Retry Loading</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : (
        <View className="flex-1 px-5 pt-3">
          <HighlightedEvidenceViewer
            extractedText={evidenceData?.extractedText || ""}
            evidenceMap={evidenceData?.evidenceMap || null}
            activeFindingId={activeFindingId}
            onSelectFinding={setActiveFindingId}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            ListHeaderComponent={renderReviewHeader}
            ListFooterComponent={renderReviewFooter}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});
