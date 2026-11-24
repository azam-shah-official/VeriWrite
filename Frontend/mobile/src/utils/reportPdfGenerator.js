/**
 * VeriWrite - Reusable Report PDF & Print Generator
 *
 * Provides shared, professional HTML-to-PDF compilation and native printing
 * for both Student Analysis Reports and Teacher Forensic Review Reports.
 *
 * Powered by expo-print and expo-sharing.
 */

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystemLegacy from "expo-file-system/legacy";

/**
 * Escapes HTML characters to prevent XSS or broken layout when rendering dynamic document text.
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats ISO date string into readable academic format.
 * Provides safe fallback for pre-formatted strings to ensure Hermes compatibility.
 */
function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch (_e) {
    // continue to fallback
  }

  const str = String(dateString).trim();
  if (str && str !== "-" && str.toLowerCase() !== "invalid date") {
    return str;
  }
  return "N/A";
}

/**
 * Formats ISO date string with exact time.
 */
function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    }
  } catch (_e) {
    // continue to fallback
  }

  const str = String(dateString).trim();
  if (str && str !== "-" && str.toLowerCase() !== "invalid date") {
    return str;
  }
  return "N/A";
}

/**
 * Normalizes input data from either student assignment or teacher submission objects.
 */
function normalizeReportData(inputData = {}, role = "STUDENT") {
  const item = inputData.submission || inputData.assignment || inputData.item || inputData;
  const evidenceData = inputData.evidenceData || null;

  const assignmentId = String(item.id || item._id || evidenceData?.assignmentId || inputData.assignmentId || "");
  const idShort = assignmentId ? assignmentId.slice(-5).toUpperCase() : "VERIFIED";

  const title = item.title || evidenceData?.assignmentTitle || inputData.assignmentTitle || "Assignment Submission";
  const course = item.course || evidenceData?.courseName || inputData.courseName || "General Course";
  const studentName = item.studentName || item.student?.name || evidenceData?.studentName || "Student";
  const studentEmail = item.studentEmail || item.student?.email || evidenceData?.studentEmail || "";
  const institution = item.institution || item.student?.institution || evidenceData?.institution || "Academic Institution";
  const submittedDate =
    item.createdAt ||
    item.submittedDate ||
    evidenceData?.createdAt ||
    evidenceData?.submittedDate ||
    inputData.createdAt ||
    inputData.submittedDate ||
    null;
  const wordCount = typeof item.wordCount === "number" ? item.wordCount : typeof evidenceData?.wordCount === "number" ? evidenceData.wordCount : null;
  const fileName = item.originalFileName || item.fileName || evidenceData?.originalFileName || evidenceData?.fileName || item.title || "Document";
  const fileSize = typeof item.fileSize === "number" ? (item.fileSize / (1024 * 1024)).toFixed(2) + " MB" : null;

  const analysisResult = item.analysisResult || evidenceData?.analysisResult || {};
  const signalLevel = analysisResult.signalLevel || item.signalLevel || "Inconclusive";
  const analysisConfidence =
    typeof analysisResult.analysisConfidence === "number"
      ? `${analysisResult.analysisConfidence}%`
      : analysisResult.analysisConfidence ||
        (typeof item.analysisConfidence === "number" ? `${item.analysisConfidence}%` : item.analysisConfidence) ||
        "Medium";
  const analyzedAt = analysisResult.analyzedAt || item.analyzedAt || submittedDate || null;
  const metrics =
    analysisResult.metrics ||
    evidenceData?.metrics ||
    item.metrics ||
    item.stylometricMetrics ||
    {};

  const mattr =
    typeof metrics.mattr === "number"
      ? metrics.mattr
      : typeof metrics.lexicalDiversity === "number"
        ? metrics.lexicalDiversity
        : typeof metrics.vocabularyRichness === "number"
          ? (metrics.vocabularyRichness > 1 ? metrics.vocabularyRichness / 100 : metrics.vocabularyRichness)
          : null;

  const cadenceCV =
    typeof metrics.burstinessScore === "number"
      ? (metrics.burstinessScore > 1 ? metrics.burstinessScore / 100 : metrics.burstinessScore)
      : typeof metrics.sentenceLengthVariation === "number"
        ? metrics.sentenceLengthVariation
        : typeof metrics.cadenceCV === "number"
          ? (metrics.cadenceCV > 1 ? metrics.cadenceCV / 100 : metrics.cadenceCV)
          : typeof metrics.sentenceCadenceCV === "number"
            ? (metrics.sentenceCadenceCV > 1 ? metrics.sentenceCadenceCV / 100 : metrics.sentenceCadenceCV)
            : typeof metrics.sentenceVariety === "number"
              ? (metrics.sentenceVariety > 1 ? metrics.sentenceVariety / 100 : metrics.sentenceVariety)
              : null;

  const transitionDensity =
    typeof metrics.transitionDensityScore === "number"
      ? (metrics.transitionDensityScore > 1 ? metrics.transitionDensityScore / 100 : metrics.transitionDensityScore)
      : typeof metrics.transitionDensity === "number"
        ? (metrics.transitionDensity > 1
            ? metrics.transitionDensity / 100
            : metrics.transitionDensity)
        : null;

  const readabilityGrade = metrics.readabilityGrade || item.readabilityGrade || null;
  const perplexityScore = typeof metrics.perplexityScore === "number" ? metrics.perplexityScore : null;

  // Extract findings
  let findings = [];
  if (evidenceData?.evidenceMap && Array.isArray(evidenceData.evidenceMap.findings)) {
    findings = evidenceData.evidenceMap.findings;
  } else if (Array.isArray(item.findings)) {
    findings = item.findings.map((f, idx) => ({
      findingId: f.findingId || f.id || `FND-${idx + 1}`,
      indicatorCode: f.indicatorCode || f.category || "GENERAL_INDICATOR",
      indicatorLabel: f.indicatorLabel || f.label || "Stylometric Finding",
      category: f.category || "Style & Cadence",
      severity: (f.severity || "Medium").charAt(0).toUpperCase() + (f.severity || "medium").slice(1).toLowerCase(),
      snippet: f.snippet || f.evidenceSnippet || "",
      charStart: f.charStart ?? null,
      charEnd: f.charEnd ?? null,
      paragraphIndex: typeof f.paragraphIndex === "number" ? f.paragraphIndex : 0,
      whyFlagged: f.whyFlagged || f.explanation || "",
      pedagogicalExplanation: f.pedagogicalExplanation || f.explanation || "",
      studentGuidance: f.studentGuidance || f.improvementTip || f.actionableTip || "",
    }));
  } else if (Array.isArray(analysisResult.indicators)) {
    analysisResult.indicators.forEach((ind, indIdx) => {
      const evidenceList = Array.isArray(ind.evidence) ? ind.evidence : [];
      if (evidenceList.length === 0) {
        findings.push({
          findingId: `FND-${ind.code || "ANOMALY"}-${indIdx + 1}`,
          indicatorCode: ind.code || "GENERAL_INDICATOR",
          indicatorLabel: ind.label || ind.indicator || "Stylometric Finding",
          category: ind.category || "Style & Cadence",
          severity: ind.severity || "Medium",
          snippet: "Document-level stylometric observation.",
          charStart: null,
          charEnd: null,
          paragraphIndex: 0,
          whyFlagged: ind.whyFlagged || ind.summary || "Identified during stylistic cadence analysis.",
          pedagogicalExplanation: ind.pedagogicalExplanation || ind.explanation || "",
          studentGuidance: ind.actionableTip || ind.improvementTip || "",
        });
      } else {
        evidenceList.forEach((ev, evIdx) => {
          findings.push({
            findingId: ev.findingId || `FND-${ind.code || "ANOMALY"}-${indIdx + 1}-${evIdx + 1}`,
            indicatorCode: ind.code || "GENERAL_INDICATOR",
            indicatorLabel: ind.label || ind.indicator || "Stylometric Finding",
            category: ind.category || "Style & Cadence",
            severity: ind.severity || "Medium",
            snippet: ev.snippet || "",
            charStart: ev.charStart,
            charEnd: ev.charEnd,
            paragraphIndex: typeof ev.paragraphIndex === "number" ? ev.paragraphIndex : 0,
            whyFlagged: ev.flagReason || ind.whyFlagged || ind.summary || "",
            pedagogicalExplanation: ind.pedagogicalExplanation || ind.explanation || "",
            studentGuidance: ind.actionableTip || ind.improvementTip || "",
          });
        });
      }
    });
  }

  // Map finding decisions
  const findingReviewsMap = {};
  const findingReviews =
    evidenceData?.findingReviews || item.findingReviews || inputData.findingReviews || [];
  if (Array.isArray(findingReviews)) {
    findingReviews.forEach((fr) => {
      const fid = fr?.findingId || fr?.id;
      if (fid) {
        findingReviewsMap[fid] = {
          decision: fr.decision || "Pending",
          notes: fr.notes || "",
          reviewedAt: fr.reviewedAt || null,
        };
      }
    });
  }

  // Also support findingDecisions dictionary (as used in TeacherEvidenceReviewScreen)
  const decisionsObj =
    inputData.findingDecisions ||
    evidenceData?.findingDecisions ||
    item.findingDecisions ||
    {};
  if (typeof decisionsObj === "object" && decisionsObj !== null) {
    Object.entries(decisionsObj).forEach(([fid, val]) => {
      if (!findingReviewsMap[fid]) {
        findingReviewsMap[fid] = {
          decision: typeof val === "string" ? val : val?.decision || "Pending",
          notes: typeof val === "object" ? val?.notes || "" : "",
          reviewedAt: typeof val === "object" ? val?.reviewedAt || null : null,
        };
      }
    });
  }

  // Merge decisions onto findings
  findings = findings.map((f) => {
    const fid = f.findingId || f.id || "FND";
    const review =
      findingReviewsMap[fid] ||
      findingReviewsMap[f.findingId] ||
      findingReviewsMap[f.id] ||
      f.reviewDecision ||
      null;
    const rawDecision =
      (typeof review === "string" ? review : review?.decision) || "Pending";
    return {
      ...f,
      findingId: fid,
      decision: rawDecision.toUpperCase(),
      decisionNotes: review?.notes || "",
      decisionDate: review?.reviewedAt || null,
    };
  });

  // Human review details
  const reviewStatus =
    inputData.reviewStatus ||
    evidenceData?.reviewStatus ||
    item.reviewStatus ||
    item.humanReview?.status ||
    "Pending Review";

  const verdict =
    inputData.verdict ||
    evidenceData?.teacherReview?.verdict ||
    item.teacherReview?.verdict ||
    item.humanReview?.verdict ||
    item.verdict ||
    "Pending";

  const feedbackNotes =
    inputData.feedbackNotes ||
    evidenceData?.teacherReview?.feedbackNotes ||
    item.teacherReview?.feedbackNotes ||
    item.humanReview?.comments ||
    item.feedbackNotes ||
    "";

  const auditTrail =
    inputData.auditTrail || evidenceData?.auditTrail || item.auditTrail || [];

  const reviewedAt =
    evidenceData?.lastReviewedAt ||
    item.lastReviewedAt ||
    evidenceData?.teacherReview?.reviewedAt ||
    item.teacherReview?.reviewedAt ||
    item.humanReview?.reviewedAt ||
    null;

  const normStatus = String(reviewStatus || "").trim().toLowerCase();
  const normVerdict = String(verdict || "").trim().toLowerCase();
  const isPendingOrUnreviewed =
    (!reviewedAt && (
      !reviewStatus ||
      /^(pending|pending review|needs human review|unreviewed)$/.test(normStatus) ||
      normVerdict === "pending"
    )) ||
    (normStatus === "pending review" && normVerdict === "pending") ||
    normStatus === "pending";

  let reviewedBy = "";
  if (isPendingOrUnreviewed) {
    reviewedBy = "Not Reviewed";
  } else {
    const isObjectId = (val) => typeof val === "string" && /^[a-fA-F0-9]{24}$/.test(val.trim());
    let reviewerCandidate =
      evidenceData?.teacherReview?.reviewerName ||
      (typeof evidenceData?.teacherReview?.reviewedBy === "object"
        ? evidenceData?.teacherReview?.reviewedBy?.name
        : "") ||
      (typeof evidenceData?.teacherReview?.reviewedBy === "string" && !isObjectId(evidenceData.teacherReview.reviewedBy)
        ? evidenceData.teacherReview.reviewedBy
        : "") ||
      item.reviewerName ||
      item.teacherReview?.reviewerName ||
      (typeof item.teacherReview?.reviewedBy === "object"
        ? item.teacherReview?.reviewedBy?.name
        : "") ||
      (typeof item.teacherReview?.reviewedBy === "string" && !isObjectId(item.teacherReview.reviewedBy)
        ? item.teacherReview.reviewedBy
        : "") ||
      evidenceData?.reviewerName ||
      (typeof item.reviewedBy === "string" && !isObjectId(item.reviewedBy) ? item.reviewedBy : "") ||
      "";

    // If reviewerCandidate is missing or an unpopulated 24-char ObjectId, resolve from auditTrail
    if (!reviewerCandidate || isObjectId(reviewerCandidate)) {
      const reviewActions = [
        "OVERALL_VERDICT_SUBMITTED",
        "OVERALL_VERDICT_CHANGED",
        "REVIEW_STATUS_CHANGED",
        "FINDING_DECISION_UPDATED",
      ];
      for (let i = auditTrail.length - 1; i >= 0; i--) {
        const entry = auditTrail[i];
        if (entry && reviewActions.includes(entry.action)) {
          const candidate =
            entry.teacherName ||
            (typeof entry.performedBy === "string" && !isObjectId(entry.performedBy) ? entry.performedBy : "") ||
            entry.performedBy?.name ||
            entry.details?.teacherName ||
            "";
          if (candidate && !isObjectId(candidate)) {
            reviewerCandidate = candidate;
            break;
          }
        }
      }
      if (isObjectId(reviewerCandidate)) {
        reviewerCandidate = "";
      }
    }

    reviewedBy = reviewerCandidate || "";
  }

  const teacherComments =
    evidenceData?.teacherComments || item.teacherComments || inputData.teacherComments || [];

  return {
    assignmentId,
    idShort,
    title,
    course,
    studentName,
    studentEmail,
    institution,
    submittedDate,
    wordCount,
    fileName,
    fileSize,
    signalLevel,
    analysisConfidence,
    analyzedAt,
    mattr,
    cadenceCV,
    transitionDensity,
    readabilityGrade,
    perplexityScore,
    findings,
    reviewStatus,
    verdict,
    feedbackNotes,
    reviewedBy,
    reviewedAt,
    teacherComments,
    auditTrail,
    role: role.toUpperCase(),
  };
}

/**
 * Returns color codes and labels for signal levels.
 */
function getSignalStyles(signalLevel) {
  switch (signalLevel) {
    case "Natural Variation":
      return {
        color: "#059669",
        bg: "#ECFDF5",
        border: "#A7F3D0",
        label: "Natural Variation",
        desc: "Stylometric patterns reflect organic structural variation across sentence lengths and syntax.",
      };
    case "Moderate Uniformity":
      return {
        color: "#D97706",
        bg: "#FFFBEB",
        border: "#FDE68A",
        label: "Moderate Uniformity",
        desc: "Slightly elevated syntactic uniformity observed in specific passages. Deserving of contextual reading.",
      };
    case "High Uniformity":
      return {
        color: "#DC2626",
        bg: "#FEF2F2",
        border: "#FECACA",
        label: "High Uniformity",
        desc: "Atypical syntactic cadence and elevated formulaic repetition detected across multiple sections.",
      };
    case "Inconclusive":
    default:
      return {
        color: "#475569",
        bg: "#F8FAFC",
        border: "#E2E8F0",
        label: signalLevel || "Inconclusive",
        desc: "Document length under 150 words or insufficient sample size for definitive metric calibration.",
      };
  }
}

/**
 * Returns color codes for severity badges.
 */
function getSeverityStyles(severity) {
  switch (severity) {
    case "High":
      return { color: "#B91C1C", bg: "#FEE2E2", border: "#FCA5A5" };
    case "Medium":
      return { color: "#B45309", bg: "#FEF3C7", border: "#FCD34D" };
    case "Low":
    default:
      return { color: "#0369A1", bg: "#E0F2FE", border: "#BAE6FD" };
  }
}

/**
 * Generates the complete, self-contained HTML document for the VeriWrite Report.
 */
export function generateReportHtml(inputData, options = {}) {
  const role = (options.role || inputData.role || "STUDENT").toUpperCase();
  const isTeacher = role === "TEACHER";
  const data = normalizeReportData(inputData, role);

  const signalStyle = getSignalStyles(data.signalLevel);
  const nowStr = formatDateTime(new Date());

  const highCount = data.findings.filter((f) => f.severity === "High").length;
  const mediumCount = data.findings.filter((f) => f.severity === "Medium").length;
  const lowCount = data.findings.filter((f) => f.severity === "Low").length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VeriWrite ${isTeacher ? "Forensic Integrity" : "Analysis"} Report - ${escapeHtml(data.idShort)}</title>
  <style>
    @page {
      margin: 12mm 12mm;
      size: A4 portrait;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0F172A;
      background-color: #FFFFFF;
      line-height: 1.45;
      font-size: 11pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    
    /* Header Bar */
    .report-header {
      border-bottom: 2px solid #0284C7;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .brand-block {
      display: flex;
      align-items: center;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      background-color: #0F172A;
      border: 1px solid #0284C7;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #38BDF8;
      font-weight: 800;
      font-size: 16px;
      margin-right: 10px;
    }
    .brand-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.5px;
    }
    .brand-slogan {
      font-size: 7.5pt;
      font-weight: 700;
      color: #0284C7;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 1px;
    }
    .security-badge {
      text-align: right;
    }
    .doc-id-pill {
      display: inline-block;
      background: #F0F9FF;
      border: 1px solid #BAE6FD;
      color: #0284C7;
      font-size: 8.5pt;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .gen-timestamp {
      font-size: 8pt;
      color: #64748B;
    }
    .report-type-banner {
      background-color: ${isTeacher ? "#0F172A" : "#0C243B"};
      color: #FFFFFF;
      padding: 8px 12px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
    }
    .report-type-title {
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #38BDF8;
    }
    .institution-label {
      font-size: 8.5pt;
      font-weight: 600;
      color: #E2E8F0;
    }

    /* Section Cards */
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
    }
    .section-title::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 13px;
      background-color: #0284C7;
      margin-right: 6px;
      border-radius: 2px;
    }

    /* Metadata Table */
    .metadata-grid {
      display: table;
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      overflow: hidden;
      font-size: 9pt;
    }
    .metadata-row {
      display: table-row;
    }
    .metadata-cell {
      display: table-cell;
      padding: 5px 10px;
      border-bottom: 1px solid #E2E8F0;
      width: 50%;
    }
    .meta-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 1px;
    }
    .meta-val {
      font-size: 9pt;
      font-weight: 600;
      color: #0F172A;
    }

    /* Scorecard */
    .scorecard {
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .signal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #E2E8F0;
    }
    .signal-badge {
      display: inline-block;
      background: ${signalStyle.bg};
      border: 1px solid ${signalStyle.border};
      color: ${signalStyle.color};
      font-weight: 800;
      font-size: 11pt;
      padding: 4px 14px;
      border-radius: 999px;
    }
    .confidence-tag {
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
    }
    .signal-desc {
      font-size: 8.5pt;
      color: #475569;
      margin-bottom: 8px;
      font-style: italic;
    }

    /* Metrics Grid */
    .metrics-row {
      display: flex;
      gap: 10px;
      margin-bottom: 4px;
    }
    .metric-card {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .metric-title {
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .metric-value {
      font-size: 14pt;
      font-weight: 800;
      color: #0F172A;
      margin: 2px 0;
    }
    .metric-hint {
      font-size: 7.5pt;
      color: #64748B;
      line-height: 1.2;
    }

    /* Findings Section */
    .findings-summary-bar {
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
      background: #F1F5F9;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .finding-box {
      border: 1px solid #E2E8F0;
      border-left: 4px solid #0284C7;
      background: #FFFFFF;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .finding-id {
      font-size: 8.5pt;
      font-weight: 700;
      color: #0284C7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .finding-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0F172A;
    }
    .severity-pill {
      font-size: 7.5pt;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: uppercase;
    }
    .snippet-quote {
      background: #F8FAFC;
      border-left: 3px solid #94A3B8;
      padding: 6px 10px;
      font-size: 8.5pt;
      font-family: Georgia, serif;
      font-style: italic;
      color: #1E293B;
      margin: 6px 0;
      line-height: 1.4;
    }
    .location-tag {
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748B;
      margin-bottom: 4px;
    }
    .explanation-text {
      font-size: 8.5pt;
      color: #334155;
      line-height: 1.35;
      margin-bottom: 4px;
    }
    .tip-box {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      color: #166534;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 8pt;
      margin-top: 4px;
    }
    .decision-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 5px 8px;
      margin-top: 6px;
      font-size: 8pt;
    }

    /* Human Review Section */
    .review-card {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .review-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .verdict-badge {
      display: inline-block;
      background: #ECFDF5;
      border: 1px solid #10B981;
      color: #065F46;
      font-weight: 800;
      font-size: 9.5pt;
      padding: 3px 12px;
      border-radius: 999px;
    }
    .feedback-box {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 8.5pt;
      color: #1E293B;
      margin-top: 6px;
    }

    /* Audit Trail Table */
    .audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 10px;
    }
    .audit-table thead {
      display: table-header-group;
    }
    .audit-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .audit-table th {
      background: #0F172A;
      color: #FFFFFF;
      text-align: left;
      padding: 4px 6px;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .audit-table td {
      padding: 4px 6px;
      border-bottom: 1px solid #E2E8F0;
      color: #334155;
    }
    .audit-table tr:nth-child(even) td {
      background: #F8FAFC;
    }

    /* Sign-off & Legal Disclaimers */
    .signoff-section {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #CBD5E1;
    }
    .sign-box {
      width: 45%;
    }
    .sign-line {
      border-bottom: 1px solid #475569;
      height: 24px;
      margin-bottom: 4px;
    }
    .sign-title {
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }
    .disclaimer-box {
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 6px 10px;
      margin-top: 8px;
      font-size: 7pt;
      color: #475569;
      line-height: 1.35;
    }
    .report-footer {
      text-align: center;
      font-size: 7pt;
      color: #94A3B8;
      margin-top: 8px;
      border-top: 1px solid #F1F5F9;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="report-header">
      <div class="header-top">
        <div class="brand-block">
          <div class="brand-logo">V</div>
          <div>
            <div class="brand-title">VeriWrite</div>
            <div class="brand-slogan">• ANALYZE • VERIFY • TRUST •</div>
          </div>
        </div>
        <div class="security-badge">
          <div class="doc-id-pill">VR-${escapeHtml(data.idShort)}</div>
          <div class="gen-timestamp">Generated: ${escapeHtml(nowStr)}</div>
        </div>
      </div>
      <div class="report-type-banner">
        <div class="report-type-title">
          ${isTeacher ? "OFFICIAL FORENSIC WRITING INTEGRITY REPORT" : "ACADEMIC WRITING ANALYSIS REPORT"}
        </div>
        <div class="institution-label">
          ${escapeHtml(data.institution)}
        </div>
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="metadata-grid avoid-break">
      <div class="metadata-row">
        <div class="metadata-cell">
          <div class="meta-label">Assignment Title</div>
          <div class="meta-val">${escapeHtml(data.title)}</div>
        </div>
        <div class="metadata-cell">
          <div class="meta-label">Course / Curriculum</div>
          <div class="meta-val">${escapeHtml(data.course)}</div>
        </div>
      </div>
      <div class="metadata-row">
        <div class="metadata-cell">
          <div class="meta-label">Student Name</div>
          <div class="meta-val">${escapeHtml(data.studentName)}${data.studentEmail ? ` (${escapeHtml(data.studentEmail)})` : ""}</div>
        </div>
        <div class="metadata-cell">
          <div class="meta-label">Submission Date</div>
          <div class="meta-val">${escapeHtml(formatDate(data.submittedDate))}</div>
        </div>
      </div>
      <div class="metadata-row">
        <div class="metadata-cell">
          <div class="meta-label">Source Document</div>
          <div class="meta-val">${escapeHtml(data.fileName)}${data.fileSize ? ` (${escapeHtml(data.fileSize)})` : ""}</div>
        </div>
        <div class="metadata-cell">
          <div class="meta-label">Analyzed Word Count</div>
          <div class="meta-val">${data.wordCount !== null ? escapeHtml(data.wordCount.toLocaleString()) + " words" : "Calibrated sample"}</div>
        </div>
      </div>
    </div>

    <!-- Executive Scorecard -->
    <div class="scorecard avoid-break">
      <div class="signal-header">
        <div>
          <span class="signal-badge">${escapeHtml(signalStyle.label)}</span>
        </div>
        <div class="confidence-tag">
          Analysis Confidence: <strong>${escapeHtml(data.analysisConfidence)}</strong>
        </div>
      </div>
      <div class="signal-desc">
        ${escapeHtml(signalStyle.desc)}
      </div>

      <!-- Key Metrics Row -->
      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-title">Lexical Diversity (MATTR)</div>
          <div class="metric-value">
            ${data.mattr !== null ? escapeHtml(Number(data.mattr).toFixed(2)) : "N/A"}
          </div>
          <div class="metric-hint">50-word rolling Type-Token Ratio. Lower diversity flagged when &lt;0.70 (Medium) and &lt;0.62 (High).</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Sentence Cadence CV</div>
          <div class="metric-value">
            ${data.cadenceCV !== null ? escapeHtml(Number(data.cadenceCV).toFixed(2)) : "N/A"}
          </div>
          <div class="metric-hint">Coefficient of variation in sentence lengths. Organic prose: &gt;0.40.</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Transition Density</div>
          <div class="metric-value">
            ${data.transitionDensity !== null ? escapeHtml((Number(data.transitionDensity) * 100).toFixed(1)) + " / 100w" : "N/A"}
          </div>
          <div class="metric-hint">Cohesive marker frequency across paragraphs.</div>
        </div>
      </div>
      ${data.readabilityGrade || data.perplexityScore !== null ? `
      <div class="metrics-row" style="margin-top: 8px;">
        ${data.readabilityGrade ? `
        <div class="metric-card">
          <div class="metric-title">Readability Grade</div>
          <div class="metric-value">${escapeHtml(data.readabilityGrade)}</div>
          <div class="metric-hint">Estimated structural comprehension level.</div>
        </div>
        ` : ""}
        ${data.perplexityScore !== null ? `
        <div class="metric-card">
          <div class="metric-title">Perplexity Score</div>
          <div class="metric-value">${escapeHtml(data.perplexityScore)}</div>
          <div class="metric-hint">Model predictability measure across text.</div>
        </div>
        ` : ""}
      </div>
      ` : ""}
    </div>

    <!-- Human Review Section -->
    <div class="avoid-break">
      <div class="section-title">Faculty Review & Determination</div>
      <div class="review-card">
        <div class="review-row">
          <div>
            <div class="meta-label">Current Review Status</div>
            <div class="meta-val" style="color: #0284C7;">${escapeHtml(data.reviewStatus)}</div>
          </div>
          <div>
            <div class="meta-label">Faculty Verdict</div>
            <div class="verdict-badge">${escapeHtml(data.verdict)}</div>
          </div>
        </div>
        ${data.reviewedAt || data.reviewedBy ? `
          <div style="font-size: 8pt; color: #64748B; margin-bottom: 6px;">
            ${data.reviewedBy ? `Faculty Reviewer: <strong>${escapeHtml(data.reviewedBy)}</strong>` : ""}
            ${data.reviewedBy && data.reviewedAt ? " &bull; " : ""}
            ${data.reviewedAt ? `Evaluated: ${escapeHtml(formatDateTime(data.reviewedAt))}` : ""}
          </div>
        ` : ""}
        ${data.feedbackNotes ? `
          <div class="meta-label">Faculty Feedback & Determination Notes:</div>
          <div class="feedback-box">
            ${escapeHtml(data.feedbackNotes)}
          </div>
        ` : `
          <div style="font-size: 8.5pt; color: #94A3B8; font-style: italic;">
            No written feedback notes submitted yet. Review is ${escapeHtml(data.reviewStatus)}.
          </div>
        `}
      </div>
    </div>

    <!-- Findings & Evidence Section -->
    <div class="avoid-break">
      <div class="section-title">
        Stylometric Findings & Forensic Evidence (${data.findings.length})
      </div>
      <div class="findings-summary-bar">
        <span>High Severity: <strong>${highCount}</strong></span>
        <span>Medium Severity: <strong>${mediumCount}</strong></span>
        <span>Low Severity: <strong>${lowCount}</strong></span>
      </div>
    </div>

    ${data.findings.length === 0 ? `
      <div class="finding-box avoid-break" style="border-left-color: #10B981; background: #F0FDF4;">
        <div style="font-size: 9pt; font-weight: 700; color: #166534; margin-bottom: 2px;">
          ✓ No Stylometric Anomalies Detected
        </div>
        <div style="font-size: 8.5pt; color: #15803D;">
          The analyzed text exhibits expected natural syntactic cadence, lexical variation, and structural fluidity without uniform pacing flags.
        </div>
      </div>
    ` : data.findings.map((finding, idx) => {
      const sev = getSeverityStyles(finding.severity);
      const locText = finding.charStart !== null && finding.charStart !== undefined
        ? `¶ Paragraph ${finding.paragraphIndex + 1} (Characters ${finding.charStart}–${finding.charEnd})`
        : "Document-level observation";

      return `
        <div class="finding-box avoid-break">
          <div class="finding-header">
            <div>
              <span class="finding-id">${escapeHtml(finding.findingId || `FINDING-${idx + 1}`)}</span>
              <span class="finding-title"> — ${escapeHtml(finding.indicatorLabel)}</span>
            </div>
            <span class="severity-pill" style="background: ${sev.bg}; color: ${sev.color}; border: 1px solid ${sev.border};">
              ${escapeHtml(finding.severity)}
            </span>
          </div>

          <div class="location-tag">Location: ${escapeHtml(locText)}</div>

          ${finding.snippet ? `
            <div class="snippet-quote">“${escapeHtml(finding.snippet)}”</div>
          ` : ""}

          ${finding.whyFlagged ? `
            <div class="explanation-text">
              <strong>Observation:</strong> ${escapeHtml(finding.whyFlagged)}
            </div>
          ` : ""}

          ${finding.pedagogicalExplanation ? `
            <div class="explanation-text">
              <strong>Academic Context:</strong> ${escapeHtml(finding.pedagogicalExplanation)}
            </div>
          ` : ""}

          ${!isTeacher && finding.studentGuidance ? `
            <div class="tip-box">
              <strong>Writing Tip:</strong> ${escapeHtml(finding.studentGuidance)}
            </div>
          ` : ""}

          ${isTeacher ? `
            <div class="decision-row">
              <span>Faculty Review on Flag: <strong>${escapeHtml(finding.decision)}</strong></span>
              ${finding.decisionNotes ? `<span>Notes: ${escapeHtml(finding.decisionNotes)}</span>` : ""}
            </div>
          ` : ""}
        </div>
      `;
    }).join("")}

    ${isTeacher ? `
      <!-- Audit Trail Table (Teacher Forensic View Only) -->
      <div style="margin-top: 10px;">
        <div class="section-title">Forensic Audit Trail (${data.auditTrail.length} Records)</div>
        ${data.auditTrail.length === 0 ? `
          <div style="font-size: 8.5pt; color: #64748B; font-style: italic; padding: 10px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px;">
            Verified audit log retrieved: No logged audit events recorded for this submission yet.
          </div>
        ` : `
          <table class="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Finding / Target</th>
                <th>Evaluator</th>
              </tr>
            </thead>
            <tbody>
              ${data.auditTrail.map((rec) => `
                <tr>
                  <td>${escapeHtml(formatDateTime(rec.timestamp))}</td>
                  <td><strong>${escapeHtml(rec.action)}</strong></td>
                  <td>${escapeHtml(rec.findingId || rec.details || "Overall Submission")}</td>
                  <td>${escapeHtml(rec.teacherName || rec.performedBy || "Authorized Faculty")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `}
      </div>
    ` : ""}

    <!-- Sign-off & Institutional Disclaimers -->
    <div class="avoid-break">
      ${isTeacher ? `
        <div class="signoff-section">
          <div class="sign-box">
            <div class="sign-line"></div>
            <div class="sign-title">Faculty Evaluator Signature & Date</div>
          </div>
          <div class="sign-box">
            <div class="sign-line"></div>
            <div class="sign-title">Academic Department / Institutional Seal & Stamp</div>
          </div>
        </div>
      ` : ""}

      <div class="disclaimer-box">
        <strong>Academic Integrity Advisory Disclosure:</strong> Stylometric metrics and algorithmic signals generated by VeriWrite are advisory diagnostic indicators designed to support transparent human inspection. Automated statistical indicators must never be treated as conclusive standalone proof of non-human authorship or misconduct. Formal academic determinations remain under the exclusive authority of course instructors and university governance.
      </div>

      <div class="report-footer">
        VeriWrite Academic Integrity System • Forensic Review & Audit Trail Record
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates a PDF file on the device and returns the local file URI and Base64 data.
 */
export async function exportReportToPdf(inputData, options = {}) {
  const html = generateReportHtml(inputData, options);
  const file = await Print.printToFileAsync({
    html,
    base64: true,
  });
  return file;
}

/**
 * Writes Base64 PDF data directly into the authorized application cache directory.
 * Avoids any attempt to read from expo-print's temporary cache path, which is blocked
 * by Expo Go's scoped file permission boundary on Android.
 */
async function writePdfBase64ToAppCache(base64Data, targetFileName) {
  if (!base64Data || typeof base64Data !== "string" || base64Data.trim() === "") {
    throw new Error("PDF generation completed, but base64 report data was not produced by the print engine.");
  }

  if (!FileSystemLegacy?.cacheDirectory) {
    throw new Error("Application cache directory is unavailable for report export.");
  }

  const targetUri = `${FileSystemLegacy.cacheDirectory}${targetFileName}`;
  const encoding = FileSystemLegacy.EncodingType?.Base64 || "base64";

  try {
    await FileSystemLegacy.writeAsStringAsync(targetUri, base64Data, {
      encoding,
    });
    return targetUri;
  } catch (writeErr) {
    throw new Error(`Failed to write PDF report to application cache: ${writeErr?.message || writeErr}`);
  }
}

/**
 * Generates a PDF file, writes the Base64 data directly to the scoped cache directory
 * under a sanitized, conflict-free filename, and opens the native system share/save sheet.
 */
export async function downloadAndShareReport(inputData, options = {}) {
  const file = await exportReportToPdf(inputData, options);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("File sharing is not supported on this device. You can use the Print option instead.");
  }

  const role = (options.role || inputData.role || "STUDENT").toUpperCase();
  const rawTitle =
    inputData.title ||
    inputData.assignment?.title ||
    inputData.submission?.title ||
    "Report";
  const sanitizedTitle = String(rawTitle)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 60) || "Report";

  // Prevent collisions across repeated exports with a timestamp
  const timestamp = Date.now();
  const rolePrefix = role === "TEACHER" ? "VeriWrite_Forensic_Dossier" : "VeriWrite_Analysis_Report";
  const safeFileName = `${rolePrefix}_${sanitizedTitle}_${timestamp}.pdf`;

  // Write base64 directly to scoped application cache (never read from expo-print temporary path)
  const shareableUri = await writePdfBase64ToAppCache(file.base64, safeFileName);

  try {
    await Sharing.shareAsync(shareableUri, {
      mimeType: "application/pdf",
      dialogTitle: `${rolePrefix}_${sanitizedTitle}`,
      UTI: "com.adobe.pdf",
    });
  } catch (shareErr) {
    const isCancel =
      String(shareErr?.message || shareErr || "").toLowerCase().includes("cancel") ||
      String(shareErr?.message || shareErr || "").toLowerCase().includes("dismiss") ||
      shareErr?.code === "CANCELLED";
    if (isCancel) {
      throw shareErr;
    }
    throw new Error(`Failed to share PDF report: ${shareErr?.message || shareErr}`);
  }

  return { ...file, uri: shareableUri };
}

/**
 * Opens native system wireless / airprint printing dialog.
 */
export async function printReport(inputData, options = {}) {
  const html = generateReportHtml(inputData, options);
  await Print.printAsync({
    html,
    printerUrl: options.printerUrl,
  });
}
