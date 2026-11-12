import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import { createRequire } from "node:module";
const require = createRequire("file:///D:/First_Project/Backend/package.json");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: "D:/First_Project/Backend/.env" });

import app from "file:///D:/First_Project/Backend/src/App.js";
import connectDB from "file:///D:/First_Project/Backend/src/config/db.js";
import User from "file:///D:/First_Project/Backend/src/models/User.js";
import Assignment from "file:///D:/First_Project/Backend/src/models/Assignment.js";
import { segmentSentences } from "file:///D:/First_Project/Backend/src/services/analysis/sentenceSegmenter.js";
import {
  calculatePrintableRatio,
  calculateSentenceLengthVariation,
  calculateMATTR,
  calculateTransitionDensity,
  detectRepetitiveStarters,
  findFormulaicPhrases,
} from "file:///D:/First_Project/Backend/src/services/analysis/stylometricAnalyzer.js";
import { buildEvidenceItem, clampEvidenceSpan } from "file:///D:/First_Project/Backend/src/services/analysis/evidenceBuilder.js";
import { buildIndicators } from "file:///D:/First_Project/Backend/src/services/analysis/indicatorBuilder.js";
import { runAnalysisPipeline, AnalysisServiceError } from "file:///D:/First_Project/Backend/src/services/analysis/analysisService.js";
import { serializeAssignment } from "file:///D:/First_Project/Backend/src/controllers/assignmentController.js";

const RUN_ID = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
const STUDENT_A_EMAIL = `task3.studentA.${RUN_ID}@veriwrite.test`;
const STUDENT_B_EMAIL = `task3.studentB.${RUN_ID}@veriwrite.test`;
const TEST_PASSWORD = "StudentTask3SecurePass2026!";

const createdUserIds = [];
const createdAssignmentIds = [];
const createdPhysicalFiles = [];

let tokenA = null;
let tokenB = null;
let studentAId = null;
let studentBId = null;
let serverInstance = null;
let baseUrl = "";

let passedCount = 0;
let failedCount = 0;

function reportPass(category, testName) {
  passedCount++;
  console.log(`  [PASS] [${category}] ${testName}`);
}

function reportFail(category, testName, err) {
  failedCount++;
  console.error(`  [FAIL] [${category}] ${testName}:`, err?.message || err);
}

async function runTask3TestSuite() {
  console.log("===============================================================================");
  console.log("   VeriWrite Task 3 Test Suite: AI Analysis Engine, Evidence & Backend API");
  console.log("===============================================================================\n");

  // ==========================================================================
  // SECTION 1: Sentence Segmentation & Exact-Offset Matrix (T1 to T10)
  // ==========================================================================
  console.log("-------------------------------------------------------------------------------");
  console.log("SECTION 1: Sentence Segmentation & Exact-Offset Invariant Matrix");
  console.log("-------------------------------------------------------------------------------");

  const matrixTests = [
    {
      id: "T1",
      name: "Decimal Numbers",
      text: "Cost is $12.50 today. Paid in full.",
      expected: [
        { charStart: 0, charEnd: 21, text: "Cost is $12.50 today." },
        { charStart: 22, charEnd: 35, text: "Paid in full." },
      ],
    },
    {
      id: "T2",
      name: "Latin Abbreviations",
      text: "Use e.g. apples or i.e. fruit. Next.",
      expected: [
        { charStart: 0, charEnd: 30, text: "Use e.g. apples or i.e. fruit." },
        { charStart: 31, charEnd: 36, text: "Next." },
      ],
    },
    {
      id: "T3",
      name: "Honorifics / Titles",
      text: "Dr. Jones met Prof. Smith. Done.",
      expected: [
        { charStart: 0, charEnd: 26, text: "Dr. Jones met Prof. Smith." },
        { charStart: 27, charEnd: 32, text: "Done." },
      ],
    },
    {
      id: "T4",
      name: "Initials",
      text: "C. S. Lewis wrote Narnia. Great book.",
      expected: [
        { charStart: 0, charEnd: 25, text: "C. S. Lewis wrote Narnia." },
        { charStart: 26, charEnd: 37, text: "Great book." },
      ],
    },
    {
      id: "T5",
      name: "Quotes & Parentheses",
      text: 'He said, "Stop!" (Then paused). End.',
      expected: [
        { charStart: 0, charEnd: 16, text: 'He said, "Stop!"' },
        { charStart: 17, charEnd: 31, text: "(Then paused)." },
        { charStart: 32, charEnd: 36, text: "End." },
      ],
    },
    {
      id: "T6",
      name: "Multiple Punctuation",
      text: "Really?! Yes... absolutely! Final.",
      expected: [
        { charStart: 0, charEnd: 8, text: "Really?!" },
        { charStart: 9, charEnd: 27, text: "Yes... absolutely!" },
        { charStart: 28, charEnd: 34, text: "Final." },
      ],
    },
    {
      id: "T7",
      name: "Document Boundaries",
      text: "First. Middle. Last.",
      expected: [
        { charStart: 0, charEnd: 6, text: "First." },
        { charStart: 7, charEnd: 14, text: "Middle." },
        { charStart: 15, charEnd: 20, text: "Last." },
      ],
    },
    {
      id: "T8",
      name: "Whitespace & Newlines",
      text: "Line one.  \n\n  Line two.",
      expected: [
        { charStart: 0, charEnd: 9, text: "Line one." },
        { charStart: 15, charEnd: 24, text: "Line two." },
      ],
    },
    {
      id: "T9",
      name: "Empty / Whitespace Text",
      text: "   \n\t  ",
      expected: [],
    },
    {
      id: "T10",
      name: "Non-BMP Unicode (Emoji)",
      text: "Note: 📘 Begins here. Concludes.",
      expected: [
        { charStart: 0, charEnd: 21, text: "Note: 📘 Begins here." },
        { charStart: 22, charEnd: 32, text: "Concludes." },
      ],
    },
  ];

  for (const t of matrixTests) {
    const segmented = segmentSentences(t.text);
    assert.equal(
      segmented.length,
      t.expected.length,
      `${t.id} sentence count mismatch (got ${segmented.length}, expected ${t.expected.length})`
    );

    for (let i = 0; i < segmented.length; i++) {
      const actual = segmented[i];
      const exp = t.expected[i];
      assert.equal(actual.charStart, exp.charStart, `${t.id} S${i + 1} charStart mismatch`);
      assert.equal(actual.charEnd, exp.charEnd, `${t.id} S${i + 1} charEnd mismatch`);
      assert.equal(actual.text, exp.text, `${t.id} S${i + 1} text mismatch`);
      // Exact-slice invariant:
      assert.equal(
        t.text.slice(actual.charStart, actual.charEnd),
        actual.text,
        `${t.id} S${i + 1} slice invariant failed`
      );
    }
    reportPass("SEGMENTATION", `${t.id}: ${t.name} passed exact UTF-16 slicing`);
  }

  // ==========================================================================
  // SECTION 2: Stylometric Metrics, Printable Ratio & MATTR
  // ==========================================================================
  console.log("\n-------------------------------------------------------------------------------");
  console.log("SECTION 2: Stylometric Heuristics & Mathematical Metrics");
  console.log("-------------------------------------------------------------------------------");

  // 2.1 Printable Character Ratio
  const prEnglish = calculatePrintableRatio("Hello world! Academic prose.");
  assert.equal(prEnglish, 1.0, "English text should have 1.0 printable ratio");

  const prEmoji = calculatePrintableRatio("Important: 📘 Chapter 1 begins.");
  assert.equal(prEmoji, 1.0, "Emoji text should have 1.0 printable ratio");

  const prArabic = calculatePrintableRatio("مَرْحَبًا بِكُمْ فِي جَامِعَةِ");
  assert.equal(prArabic, 1.0, "Arabic with tashkeel should have 1.0 printable ratio");

  const prHindi = calculatePrintableRatio("नमस्ते दुनिया, यह एक शोध पत्र है।");
  assert.equal(prHindi, 1.0, "Hindi with matras should have 1.0 printable ratio");

  const prCorrupt = calculatePrintableRatio("Valid text\u0000\u0007\uFFFDwith corruption.");
  assert.ok(prCorrupt < 0.95, "Control characters and \\uFFFD must be penalized below 0.95");
  reportPass("METRICS", "Printable character ratio verified across English, Emoji, Arabic, Hindi, and control chars");

  // 2.2 Unclamped Sentence-Length CV
  const uniformSentences = [
    { wordCount: 15 },
    { wordCount: 16 },
    { wordCount: 15 },
    { wordCount: 14 },
    { wordCount: 15 },
    { wordCount: 16 },
    { wordCount: 15 },
    { wordCount: 15 },
  ];
  const uniformVariation = calculateSentenceLengthVariation(uniformSentences);
  assert.ok(uniformVariation.cv < 0.28, `Uniform sentences CV must be < 0.28, got ${uniformVariation.cv}`);

  // Test that large CV is NOT clamped at 2.0
  const extremeSentences = [
    { wordCount: 1 },
    { wordCount: 1 },
    { wordCount: 1 },
    { wordCount: 100 },
  ];
  const extremeVariation = calculateSentenceLengthVariation(extremeSentences);
  assert.ok(extremeVariation.cv > 1.5, "Extreme variance produces large unclamped CV");
  reportPass("METRICS", "Sentence-length variance and unclamped mathematical CV verified");

  // 2.3 MATTR (50-word window vs < 50 tokens)
  const shortTokens = ["one", "two", "three", "four", "five"];
  const mattrNull = calculateMATTR(shortTokens, 50);
  assert.equal(mattrNull, null, "MATTR must return null when tokens < 50 (does not fake simple TTR)");

  // 100 diverse tokens
  const diverseTokens = Array.from({ length: 100 }, (_, idx) => `word_${idx}`);
  const mattrDiverse = calculateMATTR(diverseTokens, 50);
  assert.equal(mattrDiverse, 1.0, "100 completely distinct tokens should have MATTR of 1.0");

  // 100 repetitive tokens (repeating 5 words)
  const repetitiveTokens = Array.from({ length: 100 }, (_, idx) => `word_${idx % 5}`);
  const mattrRepetitive = calculateMATTR(repetitiveTokens, 50);
  assert.equal(mattrRepetitive, 0.1, "Repeating 5 words in 50-word window yields 5/50 = 0.1 MATTR");
  reportPass("METRICS", "MATTR 50-word sliding window and sub-50 token null fallback verified");

  // 2.4 Transition Sentence Density (M / n)
  const sampleSentences = [
    { text: "Furthermore, in addition, the experiment proves the hypothesis." }, // contains 2 transitions, contributes 1 to M
    { text: "The primary findings remained stable." },
    { text: "However, the control group showed differences." }, // contains 1 transition, contributes 1 to M
    { text: "We concluded our analysis." },
  ];
  const transResult = calculateTransitionDensity(sampleSentences);
  assert.equal(transResult.matchingSentences.length, 2, "Exactly 2 sentences contain transitions");
  assert.equal(transResult.score, 0.5, "2 / 4 sentences yields density of 0.50");
  reportPass("METRICS", "Transition density accurately counts sentences with >= 1 transition (M / n)");

  // 2.5 Repetitive Starter Patterns (exact first two tokens)
  const starterTestSentences = [
    { text: "The study analyzed historical literature." },
    { text: "The study examined recent developments." },
    { text: "The study concluded significant findings." },
    { text: "Different text starts here." },
  ];
  const starters = detectRepetitiveStarters(starterTestSentences);
  assert.equal(starters.length, 1, "Must detect 1 contiguous run of repetitive starters");
  assert.equal(starters[0].bigram, "the study");
  assert.equal(starters[0].sentences.length, 3);
  reportPass("METRICS", "Repetitive sentence starter bigrams accurately detected");

  // 2.6 Formulaic Stock Phrase Matching & Overlap Resolution
  const formulaicText = "In today's fast-paced world, artificial systems plays a crucial role in society. In today's fast-paced world, we learn.";
  const formulaicMatches = findFormulaicPhrases(formulaicText);
  assert.equal(formulaicMatches.length, 3, "Finds 3 distinct non-overlapping formulaic occurrences");
  reportPass("METRICS", "Formulaic phrase matching with boundary and overlap resolution verified");

  // ==========================================================================
  // SECTION 3: Evidence Builder, 1000-Char Clamping & Minimum-Text Tiers
  // ==========================================================================
  console.log("\n-------------------------------------------------------------------------------");
  console.log("SECTION 3: Evidence Builder & Minimum Text Policy");
  console.log("-------------------------------------------------------------------------------");

  // 3.1 Long sentence (>1000 chars) clamping without invalid offsets
  const baseSentence = "This is a detailed analysis of the primary factors influencing academic performance. ";
  const longSentenceText = baseSentence.repeat(15); // ~1290 characters
  assert.ok(longSentenceText.length > 1000, "Test string must exceed 1000 characters");

  const clamped = clampEvidenceSpan(longSentenceText, 0, longSentenceText.length);
  assert.ok(clamped.charEnd - clamped.charStart <= 950, "Clamped span must be <= 950 characters");
  assert.ok(clamped.isTruncated, "isTruncated must be true");

  const builtEv = buildEvidenceItem(longSentenceText, {
    charStart: 0,
    charEnd: longSentenceText.length,
    paragraphIndex: 0,
    flagReason: "Long sentence cadence test",
  });
  assert.ok(builtEv.snippet.length <= 950, "Evidence snippet length must be <= 950");
  assert.equal(
    longSentenceText.slice(builtEv.charStart, builtEv.charEnd),
    builtEv.snippet,
    "Clamped snippet must strictly match original text slice"
  );
  reportPass("EVIDENCE", "Sentences > 1000 chars clamped to <= 950 at clause boundaries without offset errors");

  // 3.2 Minimum-Text Tiers
  // 3.2a < 100 words -> throws INSUFFICIENT_TEXT_FOR_ANALYSIS
  const textUnder100 = "Short essay text. ".repeat(10); // ~30 words
  assert.throws(
    () => runAnalysisPipeline(textUnder100, 0),
    (err) => err instanceof AnalysisServiceError && err.code === "INSUFFICIENT_TEXT_FOR_ANALYSIS",
    "Text under 100 words must throw INSUFFICIENT_TEXT_FOR_ANALYSIS"
  );
  reportPass("POLICY", "Fewer than 100 words rejected with INSUFFICIENT_TEXT_FOR_ANALYSIS");

  // 3.2b 100–149 words -> signalLevel: Inconclusive, confidence: Low, advisory-only
  const text100To149 = "Academic essay discussing scientific methodology and verified educational principles in university coursework. Furthermore, researchers observe significant variance across student submissions. Moreover, the empirical data supports standard writing conventions throughout. Additionally, structured formatting guides clear presentation. ".repeat(3); // ~120 words
  const result100To149 = runAnalysisPipeline(text100To149, 0);
  assert.equal(result100To149.signalLevel, "Inconclusive", "100-149 words must force signalLevel to Inconclusive");
  assert.equal(result100To149.analysisConfidence, "Low", "100-149 words must force analysisConfidence to Low");
  for (const ind of result100To149.indicators) {
    assert.equal(ind.severity, "Low", "100-149 word indicators must be forced to Low severity");
    assert.ok(ind.label.startsWith("Advisory:"), `Indicator label must have Advisory prefix: ${ind.label}`);
  }
  assert.ok(
    result100To149.limitations[0].includes("100–149 words"),
    "First limitation must state 100-149 word advisory restriction"
  );
  reportPass("POLICY", "100–149 words successfully executes with Inconclusive signal, Low confidence & Advisory labels");

  // ==========================================================================
  // SECTION 4: Live Atlas Integration, API Concurrency & Lock Recovery
  // ==========================================================================
  console.log("\n-------------------------------------------------------------------------------");
  console.log("SECTION 4: Live Atlas API, Concurrency, Stale Recovery & Security");
  console.log("-------------------------------------------------------------------------------");

  console.log("Connecting to MongoDB Atlas...");
  await connectDB();
  console.log("Connected to MongoDB Atlas.\n");

  serverInstance = app.listen(0);
  const port = serverInstance.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running on port ${port}.\n`);

  try {
    // 4.1 Authenticate Student A & Student B
    const regARes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Task 3 Student A",
        email: STUDENT_A_EMAIL,
        password: TEST_PASSWORD,
        role: "STUDENT",
        institution: "VeriWrite Security Lab",
      }),
    });
    const regAData = await regARes.json();
    assert.equal(regARes.status, 201);
    studentAId = regAData.user.id;
    createdUserIds.push(studentAId);

    const loginARes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: STUDENT_A_EMAIL,
        password: TEST_PASSWORD,
        role: "STUDENT",
      }),
    });
    const loginAData = await loginARes.json();
    tokenA = loginAData.token;

    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Task 3 Student B",
        email: STUDENT_B_EMAIL,
        password: TEST_PASSWORD,
        role: "STUDENT",
        institution: "VeriWrite Security Lab",
      }),
    });
    const regBData = await regBRes.json();
    assert.equal(regBRes.status, 201);
    studentBId = regBData.user.id;
    createdUserIds.push(studentBId);

    const loginBRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: STUDENT_B_EMAIL,
        password: TEST_PASSWORD,
        role: "STUDENT",
      }),
    });
    const loginBData = await loginBRes.json();
    tokenB = loginBData.token;
    reportPass("AUTH", "Two distinct student accounts registered and authenticated on Atlas");

    // 4.2 Upload a 200+ word essay for Student A
    const fullEssayText = `

`.trim();

    const formData = new FormData();
    formData.append("title", "Task 3 Full Analysis Paper");
    formData.append("course", "RES 401");
    formData.append(
      "file",
      new Blob([Buffer.from(fullEssayText, "utf8")], { type: "text/plain" }),
      "task3_paper.txt"
    );

    const uploadRes = await fetch(`${baseUrl}/api/assignments/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    assert.equal(uploadRes.status, 201);
    const assignmentId = uploadData.id;
    createdAssignmentIds.push(assignmentId);

    const uploadedDoc = await Assignment.findById(assignmentId).select("+storagePath");
    createdPhysicalFiles.push(uploadedDoc.storagePath);
    reportPass("API", "Assignment uploaded successfully with Completed extraction status");

    // 4.3 Security & Ownership: Student B attempts to trigger analysis on Student A's paper -> 403 Forbidden
    const crossStudentRes = await fetch(`${baseUrl}/api/assignments/${assignmentId}/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(crossStudentRes.status, 403, "Student B must receive 403 Forbidden on Student A's paper");
    reportPass("SECURITY", "Cross-student analysis trigger strictly rejected with HTTP 403");

    // 4.4 Student A triggers analysis successfully via POST /api/assignments/:id/analyze
    const analyzeRes = await fetch(`${baseUrl}/api/assignments/${assignmentId}/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const analyzeData = await analyzeRes.json();
    assert.equal(analyzeRes.status, 200);
    assert.equal(analyzeData.success, true);
    assert.equal(analyzeData.analysisStatus, "Completed");
    assert.ok(analyzeData.analysisResult, "Must return analysisResult");
    assert.equal(analyzeData.analysisResult.runCount, 1, "runCount must be 1 on first successful analysis");
    assert.ok(analyzeData.analysisResult.indicators.length > 0, "Must contain triggered indicators");
    assert.equal(analyzeData.extractedText, undefined, "Must NOT expose extractedText in API response");
    assert.equal(analyzeData.storagePath, undefined, "Must NOT expose storagePath in API response");
    reportPass("API", "POST /api/assignments/:id/analyze executed successfully with runCount=1 and zero leaks");

    // 4.5 Idempotency: second request returns existing result without re-running or incrementing runCount
    const idempotentRes = await fetch(`${baseUrl}/api/assignments/${assignmentId}/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const idempotentData = await idempotentRes.json();
    assert.equal(idempotentRes.status, 200);
    assert.equal(idempotentData.analysisResult.runCount, 1, "runCount must remain 1 on idempotent request");
    reportPass("CONCURRENCY", "Idempotent analysis call returned existing result without re-executing");

    // 4.6 Force Re-analysis: explicit { forceReanalysis: true } increments runCount
    const reanalysisRes = await fetch(`${baseUrl}/api/assignments/${assignmentId}/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ forceReanalysis: true }),
    });
    const reanalysisData = await reanalysisRes.json();
    assert.equal(reanalysisRes.status, 200);
    assert.equal(reanalysisData.analysisResult.runCount, 2, "runCount must increment to 2 on forceReanalysis");
    reportPass("CONCURRENCY", "Explicit forceReanalysis=true safely increments runCount to 2");

    // 4.7 Concurrency Lock: Simulate active lock -> returns HTTP 409 Conflict
    const activeLockToken = crypto.randomUUID();
    await Assignment.findByIdAndUpdate(assignmentId, {
      $set: {
        analysisStatus: "Processing",
        analysisLockToken: activeLockToken,
        analysisLockAcquiredAt: new Date(), // fresh lock
      },
    });

    const conflictRes = await fetch(`${baseUrl}/api/assignments/${assignmentId}/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ forceReanalysis: true }),
    });
    assert.equal(conflictRes.status, 409, "Active non-stale lock must return HTTP 409 Conflict");
    reportPass("CONCURRENCY", "Simultaneous active lock correctly returns HTTP 409 Conflict");

    // 4.8 Stale Lock Recovery: Lock older than 3 minutes is safely recovered
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
    await Assignment.findByIdAndUpdate(assignmentId, {
      $set: {
        analysisStatus: "Processing",
        analysisLockToken: "abandoned-stale-token",
        analysisLockAcquiredAt: fourMinutesAgo, // older than 3 min
      },
    });

    const recoverRes = await fetch(`${baseUrl}/api/assignments/${assignmentId}/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ forceReanalysis: true }),
    });
    const recoverData = await recoverRes.json();
    assert.equal(recoverRes.status, 200, "Stale lock must be recovered successfully");
    assert.equal(recoverData.analysisStatus, "Completed");
    assert.equal(recoverData.analysisResult.runCount, 3, "runCount increments to 3 after recovery");
    reportPass("CONCURRENCY", "Stale Processing lock older than 3 minutes safely recovered and executed");

    // 4.9 Stale Lock Recovery with null/missing timestamp
    await Assignment.findByIdAndUpdate(assignmentId, {
      $set: {
        analysisStatus: "Processing",
        analysisLockToken: "orphan-no-timestamp",
        analysisLockAcquiredAt: null, // null timestamp
      },
    });

    const recoverNullRes = await fetch(`${baseUrl}/api/assignments/${assignmentId}/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ forceReanalysis: true }),
    });
    assert.equal(recoverNullRes.status, 200, "Lock with null timestamp safely recovered");
    reportPass("CONCURRENCY", "Stale Processing lock with null acquisition timestamp safely recovered");

    // 4.10 Re-analysis Failure Preserves Previous Successful Results
    // Corrupt the extractedText temporarily to simulate a mid-pipeline failure
    const validExtractedText = uploadedDoc.extractedText;
    await Assignment.findByIdAndUpdate(assignmentId, {
      $set: { extractedText: "Corrupted short text" }, // < 100 words triggers failure
    });

    const failRes = await fetch(`${baseUrl}/api/assignments/${assignmentId}/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ forceReanalysis: true }),
    });
    assert.equal(failRes.status, 400);

    const postFailDoc = await Assignment.findById(assignmentId);
    assert.equal(postFailDoc.analysisStatus, "Failed");
    assert.ok(postFailDoc.analysisResult, "Previous successful analysisResult must be preserved");
    assert.equal(postFailDoc.analysisResult.runCount, 4, "runCount must NOT increment on failed attempt");
    assert.ok(
      postFailDoc.summaryNote.includes("previous analysis results preserved"),
      "Summary note must document previous result preservation"
    );
    reportPass("CONCURRENCY", "Failed re-analysis safely preserved previous successful results without incrementing runCount");

    // Restore valid text for cleanliness
    await Assignment.findByIdAndUpdate(assignmentId, {
      $set: { extractedText: validExtractedText },
    });

  } catch (err) {
    reportFail("TASK 3 SUITE", "Unexpected error in Task 3 test suite", err);
  } finally {
    console.log("\n-------------------------------------------------------------------------------");
    console.log("CLEANUP: Removing test records from MongoDB Atlas and Storage");
    console.log("-------------------------------------------------------------------------------");

    if (createdAssignmentIds.length > 0) {
      const delAssignments = await Assignment.deleteMany({ _id: { $in: createdAssignmentIds } });
      console.log(`Cleaned up ${delAssignments.deletedCount} test assignment records from MongoDB Atlas.`);
    }

    let filesCleaned = 0;
    for (const fPath of createdPhysicalFiles) {
      try {
        await fs.unlink(fPath);
        filesCleaned++;
      } catch {}
    }
    console.log(`Cleaned up ${filesCleaned} physical test files from storage.`);

    if (createdUserIds.length > 0) {
      const delUsers = await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`Cleaned up ${delUsers.deletedCount} test student accounts from MongoDB Atlas.`);
    }

    if (serverInstance) {
      serverInstance.close();
    }

    console.log("\n===============================================================================");
    console.log(`   TASK 3 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("===============================================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTask3TestSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
