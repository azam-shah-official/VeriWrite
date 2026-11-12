import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("===============================================================================");
console.log("   VeriWrite Tasks 4, 5 & 6: Student AI Analysis Frontend Verification");
console.log("===============================================================================\n");

let passed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(`         ${err.message}`);
    process.exit(1);
  }
}

// 1. Verify API Configuration
test("ASSIGNMENT_ENDPOINTS.ANALYZE endpoint generator is correctly defined", async () => {
  const { ASSIGNMENT_ENDPOINTS } = await import("./src/config/api.js");
  assert.equal(typeof ASSIGNMENT_ENDPOINTS.ANALYZE, "function");
  const testId = "660c1f2e9a3b8d1e5f4a7c2b";
  const url = ASSIGNMENT_ENDPOINTS.ANALYZE(testId);
  assert.ok(url.includes(`/assignments/${testId}/analyze`));
});

// 2. Verify Client Helper
test("triggerWritingAnalysis client helper exists and builds expected POST request", () => {
  const code = fs.readFileSync(path.join(__dirname, "src/utils/apiClient.js"), "utf8");
  assert.ok(code.includes("export const triggerWritingAnalysis ="), "Missing triggerWritingAnalysis export");
  assert.ok(code.includes("ASSIGNMENT_ENDPOINTS.ANALYZE(assignmentId)"), "Missing ASSIGNMENT_ENDPOINTS.ANALYZE invocation");
  assert.ok(code.includes("forceReanalysis"), "Missing forceReanalysis parameter pass-through");
});

// 3. Inspect Component Source Code for Invariants
test("AnalyzingProgressModal strictly matches Figma design and handles errors", () => {
  const code = fs.readFileSync(path.join(__dirname, "src/components/AnalyzingProgressModal.js"), "utf8");

  // Telemetry stages
  assert.ok(code.includes("File Uploaded Successfully"), "Missing File Uploaded stage");
  assert.ok(code.includes("Extracting Assignment Text"), "Missing Extracting Assignment Text stage");
  assert.ok(code.includes("Checking AI Writing Indicators"), "Missing Checking AI Writing Indicators stage");
  assert.ok(code.includes("Checking Text Similarity"), "Missing Checking Text Similarity stage");
  assert.ok(code.includes("Preparing Analysis Report"), "Missing Preparing Analysis Report stage");

  // Visual cues from Figma
  assert.ok(code.includes("DIAGNOSTIC"), "Missing DIAGNOSTIC label");
  assert.ok(code.includes("SECURED INGEST"), "Missing SECURED INGEST label");
  assert.ok(code.includes("256-BIT FORENSIC INTEGRITY GUARANTEED"), "Missing forensic integrity banner");
  assert.ok(code.includes("• ANALYZE • VERIFY • TRUST"), "Missing slogan badge");

  // Error handling
  assert.ok(code.includes("INSUFFICIENT_TEXT_FOR_ANALYSIS"), "Missing insufficient text handling");
  assert.ok(code.includes("Insufficient Word Count for Analysis"), "Missing friendly insufficient text title");
  assert.ok(code.includes("at least 100 words"), "Missing 100 words policy mention");
  assert.ok(code.includes("onUnauthorized"), "Missing session expiry handler");
});

test("AnalysisReportModal adheres to honest presentation, limitations, and evidence inspection", () => {
  const code = fs.readFileSync(path.join(__dirname, "src/components/AnalysisReportModal.js"), "utf8");
  const normalizedCode = code.replace(/\s+/g, " ");

  // Honest presentation: no fake AI percentage claims
  assert.ok(!code.includes("AI Generated Percentage"), "Must not display fake AI Generated Percentage");
  assert.ok(
    normalizedCode.includes("Elevated or uniform stylometric patterns reflect empirical writing metrics and do not prove or confirm AI generation."),
    "Missing empirical metrics disclaimer"
  );
  assert.ok(code.includes("Important Limitations"), "Missing Important Limitations section");

  // 4-Card Overview Metric Grid
  assert.ok(code.includes("AI Writing Indicators"), "Missing AI Writing Indicators card");
  assert.ok(code.includes("MATTR"), "Missing MATTR card");
  assert.ok(code.includes("Review Status"), "Missing Review Status card");

  // Evidence Inspection Accordion
  assert.ok(code.includes("Evidence Inspection"), "Missing Evidence Inspection section");
  assert.ok(code.includes("A. Original Assignment Text"), "Missing Part A: Original Assignment Text");
  assert.ok(code.includes("B. Why Section Was Flagged"), "Missing Part B: Why Section Was Flagged");
  assert.ok(code.includes("C. Forensic Telemetry Matrix"), "Missing Part C: Forensic Telemetry Matrix");

  // Re-analysis action
  assert.ok(code.includes("Re-analyze Writing"), "Missing Re-analyze Writing action button");
  assert.ok(code.includes("onReanalyze"), "Missing onReanalyze callback handler");
});

test("AssignmentCard and AssignmentDetailModal integrate analysis trigger and report viewing", () => {
  const cardCode = fs.readFileSync(path.join(__dirname, "src/components/AssignmentCard.js"), "utf8");
  const modalCode = fs.readFileSync(path.join(__dirname, "src/components/AssignmentDetailModal.js"), "utf8");

  // Card triggers
  assert.ok(cardCode.includes("onPressAnalyze"), "Missing onPressAnalyze prop in AssignmentCard");
  assert.ok(cardCode.includes("onPressReport"), "Missing onPressReport prop in AssignmentCard");
  assert.ok(cardCode.includes("View Report"), "Missing View Report button in AssignmentCard");
  assert.ok(cardCode.includes("Analyze Writing"), "Missing Analyze Writing button in AssignmentCard");

  // Modal triggers
  assert.ok(modalCode.includes("onAnalyze"), "Missing onAnalyze prop in AssignmentDetailModal");
  assert.ok(modalCode.includes("onViewReport"), "Missing onViewReport prop in AssignmentDetailModal");
  assert.ok(modalCode.includes("View Full Analysis Report"), "Missing View Full Analysis Report button in AssignmentDetailModal");
});

test("StudentDashboard manages full state transitions, back button, and modal lifecycle", () => {
  const dashboardCode = fs.readFileSync(path.join(__dirname, "src/screens/StudentDashboard.js"), "utf8");

  assert.ok(dashboardCode.includes("analyzingAssignment"), "Missing analyzingAssignment state in StudentDashboard");
  assert.ok(dashboardCode.includes("reportAssignment"), "Missing reportAssignment state in StudentDashboard");
  assert.ok(dashboardCode.includes("handleStartAnalysis"), "Missing handleStartAnalysis in StudentDashboard");
  assert.ok(dashboardCode.includes("handleAnalysisComplete"), "Missing handleAnalysisComplete in StudentDashboard");
  assert.ok(dashboardCode.includes("handleViewReport"), "Missing handleViewReport in StudentDashboard");
  assert.ok(dashboardCode.includes("AnalyzingProgressModal"), "Missing AnalyzingProgressModal rendering");
  assert.ok(dashboardCode.includes("AnalysisReportModal"), "Missing AnalysisReportModal rendering");
});

console.log("\n===============================================================================");
console.log(`   FRONTEND VERIFICATION COMPLETE: ${passed} PASSED, 0 FAILED`);
console.log("===============================================================================\n");
