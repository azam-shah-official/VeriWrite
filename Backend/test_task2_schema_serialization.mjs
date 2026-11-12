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
import {
  validateEvidenceOffsets,
  assertValidEvidenceOffsets,
  validateAnalysisResultEvidence,
  EvidenceValidationError,
} from "file:///D:/First_Project/Backend/src/utils/textValidator.js";
import {
  serializeAssignment,
  attachValidatedAnalysisResult,
} from "file:///D:/First_Project/Backend/src/controllers/assignmentController.js";

const RUN_ID = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
const TEST_STUDENT_EMAIL = `task2.sec.${RUN_ID}@veriwrite.test`;
const TEST_PASSWORD = "StudentTestSecurePass2026!";

const createdUserIds = [];
const createdAssignmentIds = [];
const createdPhysicalFiles = [];

let studentToken = null;
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

async function runTask2TestSuite() {
  console.log("===============================================================================");
  console.log("   VeriWrite Task 2: Security & Evidence Offset Validation Suite");
  console.log("===============================================================================\n");

  // ==========================================================================
  // SECTION 1: Evidence Offset & Text Boundary Unit Tests
  // ==========================================================================
  console.log("-------------------------------------------------------------------------------");
  console.log("SECTION 1: Evidence Offset & Text Boundary Validation Tests");
  console.log("-------------------------------------------------------------------------------");

  const sampleExtractedText =
    "Academic research indicates that stylized patterns of uniform sentence cadence and repetitive transitional phrases are characteristic indicators.";

  // 1.1 Valid offsets and matching snippet accepted
  const validSnippet = "Academic research indicates";
  const validEv = {
    snippet: validSnippet,
    paragraphIndex: 0,
    sentenceIndex: 0,
    charStart: 0,
    charEnd: validSnippet.length, // 27
    flagReason: "Opening clause pattern.",
  };
  const validRes = validateEvidenceOffsets(validEv, sampleExtractedText);
  assert.equal(validRes.isValid, true, "Valid offsets and matching snippet must be accepted");
  reportPass("EVIDENCE", "1. Valid offsets and matching snippet accepted");

  // 1.2 Negative charStart rejected
  const negStartEv = {
    snippet: validSnippet,
    paragraphIndex: 0,
    charStart: -1,
    charEnd: 20,
    flagReason: "Test negative offset",
  };
  const negStartRes = validateEvidenceOffsets(negStartEv, sampleExtractedText);
  assert.equal(negStartRes.isValid, false, "Negative charStart must be rejected");
  assert.equal(negStartRes.errorCode, "NEGATIVE_CHAR_START");
  reportPass("EVIDENCE", "2. Negative charStart rejected");

  // 1.3 charEnd beyond extractedText.length rejected
  const beyondEndEv = {
    snippet: "indicators.",
    paragraphIndex: 0,
    charStart: 50,
    charEnd: sampleExtractedText.length + 10,
    flagReason: "Test offset beyond text boundary",
  };
  const beyondEndRes = validateEvidenceOffsets(beyondEndEv, sampleExtractedText);
  assert.equal(beyondEndRes.isValid, false, "charEnd beyond extractedText.length must be rejected");
  assert.equal(beyondEndRes.errorCode, "OFFSET_OUT_OF_BOUNDS");
  reportPass("EVIDENCE", "3. charEnd beyond extractedText.length rejected");

  // 1.4 charStart >= charEnd rejected (both charStart === charEnd and charStart > charEnd)
  const equalOffsetEv = {
    snippet: "test",
    paragraphIndex: 0,
    charStart: 15,
    charEnd: 15,
    flagReason: "Equal offsets",
  };
  const equalOffsetRes = validateEvidenceOffsets(equalOffsetEv, sampleExtractedText);
  assert.equal(equalOffsetRes.isValid, false, "charStart === charEnd must be rejected");
  assert.equal(equalOffsetRes.errorCode, "INVALID_OFFSET_RANGE");

  const invertedOffsetEv = {
    snippet: "test",
    paragraphIndex: 0,
    charStart: 25,
    charEnd: 15,
    flagReason: "Inverted offsets",
  };
  const invertedOffsetRes = validateEvidenceOffsets(invertedOffsetEv, sampleExtractedText);
  assert.equal(invertedOffsetRes.isValid, false, "charStart > charEnd must be rejected");
  assert.equal(invertedOffsetRes.errorCode, "INVALID_OFFSET_RANGE");
  reportPass("EVIDENCE", "4. charStart >= charEnd rejected");

  // 1.5 Valid offsets with a mismatching snippet rejected
  const mismatchSnippetEv = {
    snippet: "Fabricated text not matching original content",
    paragraphIndex: 0,
    charStart: 0,
    charEnd: 27, // Actually "Academic research indicates"
    flagReason: "Snippet mismatch test",
  };
  const mismatchRes = validateEvidenceOffsets(mismatchSnippetEv, sampleExtractedText);
  assert.equal(mismatchRes.isValid, false, "Mismatching snippet must be rejected");
  assert.equal(mismatchRes.errorCode, "SNIPPET_MISMATCH");
  reportPass("EVIDENCE", "5. Valid offsets with a mismatching snippet rejected");

  // 1.6 Missing or invalid offsets handled according to documented schema policy
  // 1.6a Unanchored document-level evidence: both null -> valid if snippet is non-empty
  const unanchoredEv = {
    snippet: "General stylistic uniformity across document.",
    paragraphIndex: 0,
    charStart: null,
    charEnd: null,
    flagReason: "Document-level indicator",
  };
  const unanchoredRes = validateEvidenceOffsets(unanchoredEv, sampleExtractedText);
  assert.equal(unanchoredRes.isValid, true, "Unanchored evidence with null offsets is accepted");

  // 1.6b Incomplete offsets: charStart provided but charEnd null -> rejected
  const partialStartEv = {
    snippet: "test",
    paragraphIndex: 0,
    charStart: 10,
    charEnd: null,
    flagReason: "Missing end",
  };
  const partialStartRes = validateEvidenceOffsets(partialStartEv, sampleExtractedText);
  assert.equal(partialStartRes.isValid, false, "Partial charStart without charEnd must be rejected");
  assert.equal(partialStartRes.errorCode, "INCOMPLETE_OFFSETS");

  // 1.6c Incomplete offsets: charEnd provided but charStart null -> rejected
  const partialEndEv = {
    snippet: "test",
    paragraphIndex: 0,
    charStart: null,
    charEnd: 20,
    flagReason: "Missing start",
  };
  const partialEndRes = validateEvidenceOffsets(partialEndEv, sampleExtractedText);
  assert.equal(partialEndRes.isValid, false, "Partial charEnd without charStart must be rejected");
  assert.equal(partialEndRes.errorCode, "INCOMPLETE_OFFSETS");

  // 1.6d Non-integer offsets rejected
  const floatOffsetEv = {
    snippet: "test",
    paragraphIndex: 0,
    charStart: 1.5,
    charEnd: 20,
    flagReason: "Float start",
  };
  const floatRes = validateEvidenceOffsets(floatOffsetEv, sampleExtractedText);
  assert.equal(floatRes.isValid, false, "Non-integer offset must be rejected");
  assert.equal(floatRes.errorCode, "INVALID_CHAR_START");
  reportPass("EVIDENCE", "6. Missing or invalid offsets handled according to documented schema policy");

  // ==========================================================================
  // SECTION 2: Feedback Privacy & Mongoose Schema Defaults
  // ==========================================================================
  console.log("\n-------------------------------------------------------------------------------");
  console.log("SECTION 2: Teacher Feedback Privacy Unit Tests");
  console.log("-------------------------------------------------------------------------------");

  const sampleStudentId = new mongoose.Types.ObjectId();

  // 2.1 New teacherReview defaults isSharedWithStudent to false
  const freshDoc = new Assignment({
    student: sampleStudentId,
    title: "Unit Test Paper",
    originalFileName: "paper.txt",
    storageKey: `key-${Date.now()}`,
    storagePath: "/storage/paper.txt",
    mimeType: "text/plain",
    fileExtension: "txt",
    fileCategory: "TXT",
    fileSize: 100,
  });
  assert.equal(freshDoc.teacherReview.isSharedWithStudent, false, "teacherReview.isSharedWithStudent must default to false");
  reportPass("PRIVACY", "1. New teacherReview defaults isSharedWithStudent to false");

  // 2.2 Student cannot see feedback when false
  freshDoc.teacherReview.feedbackNotes = "CONFIDENTIAL FACULTY NOTE: Possible external assistance.";
  freshDoc.teacherReview.isSharedWithStudent = false;
  const studentSerializedFalse = serializeAssignment(freshDoc, { requestingRole: "STUDENT" });
  assert.equal(studentSerializedFalse.teacherReview.feedbackNotes, "", "Student receives empty feedback when isSharedWithStudent is false");
  assert.equal(studentSerializedFalse.teacherReview.isSharedWithStudent, undefined, "isSharedWithStudent flag is omitted for student");
  reportPass("PRIVACY", "2. Student cannot see feedback when false");

  // 2.3 Student cannot see feedback when the field is missing
  const legacyDocMissingField = {
    _id: new mongoose.Types.ObjectId(),
    student: sampleStudentId,
    title: "Legacy Paper",
    teacherReview: {
      verdict: "Needs Human Review",
      feedbackNotes: "OLD UNMIGRATED PRIVATE NOTE",
      // isSharedWithStudent is undefined / missing!
    },
  };
  const studentSerializedMissing = serializeAssignment(legacyDocMissingField, { requestingRole: "STUDENT" });
  assert.equal(studentSerializedMissing.teacherReview.feedbackNotes, "", "Student receives empty feedback when isSharedWithStudent is missing");
  reportPass("PRIVACY", "3. Student cannot see feedback when the field is missing");

  // 2.4 Student can see feedback only when explicitly true
  freshDoc.teacherReview.feedbackNotes = "Helpful guidance: Please review section 3 citations.";
  freshDoc.teacherReview.isSharedWithStudent = true;
  const studentSerializedTrue = serializeAssignment(freshDoc, { requestingRole: "STUDENT" });
  assert.equal(studentSerializedTrue.teacherReview.feedbackNotes, "Helpful guidance: Please review section 3 citations.");
  reportPass("PRIVACY", "4. Student can see feedback only when explicitly true");

  // 2.5 Teacher can see private feedback when false
  freshDoc.teacherReview.feedbackNotes = "INTERNAL FACULTY ONLY NOTE";
  freshDoc.teacherReview.isSharedWithStudent = false;
  const teacherSerialized = serializeAssignment(freshDoc, { requestingRole: "TEACHER" });
  assert.equal(teacherSerialized.teacherReview.feedbackNotes, "INTERNAL FACULTY ONLY NOTE", "Teacher sees feedbackNotes even when isSharedWithStudent is false");
  assert.equal(teacherSerialized.teacherReview.isSharedWithStudent, false, "Teacher sees isSharedWithStudent boolean");
  reportPass("PRIVACY", "5. Teacher can see private feedback when false");

  // ==========================================================================
  // SECTION 3: Live Atlas Integration & Regressions
  // ==========================================================================
  console.log("\n-------------------------------------------------------------------------------");
  console.log("SECTION 3: Live Atlas Integration & Full Regressions");
  console.log("-------------------------------------------------------------------------------");

  console.log("Connecting to MongoDB Atlas...");
  await connectDB();
  console.log("Connected to MongoDB Atlas.\n");

  serverInstance = app.listen(0);
  const port = serverInstance.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running on port ${port}.\n`);

  try {
    // 3.1 Authenticate test student
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Security Correction Student",
        email: TEST_STUDENT_EMAIL,
        password: TEST_PASSWORD,
        role: "STUDENT",
        institution: "VeriWrite Security Lab",
      }),
    });
    const regData = await regRes.json();
    assert.equal(regRes.status, 201);
    createdUserIds.push(regData.user.id);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_STUDENT_EMAIL,
        password: TEST_PASSWORD,
        role: "STUDENT",
      }),
    });
    const loginData = await loginRes.json();
    assert.equal(loginRes.status, 200);
    studentToken = loginData.token;
    reportPass("LIVE ATLAS", "Test student registered & authenticated on live Atlas");

    // 3.2 Upload valid assignment via POST /api/assignments/upload
    const essayText =
      "VeriWrite ensures that all writing indicators are backed by rigorous boundary-validated text evidence.";
    const formData = new FormData();
    formData.append("title", "Evidence Validation Test Paper");
    formData.append("course", "ENG 301");
    formData.append(
      "file",
      new Blob([Buffer.from(essayText, "utf8")], { type: "text/plain" }),
      "evidence_paper.txt"
    );

    const uploadRes = await fetch(`${baseUrl}/api/assignments/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    assert.equal(uploadRes.status, 201);
    assert.equal(uploadData.success, true);
    const assignmentId = uploadData.id;
    createdAssignmentIds.push(assignmentId);

    // Verify upload response defaults: isSharedWithStudent is false, zero privacy leaks
    assert.equal(uploadData.analysisResult, null, "analysisResult defaults to null");
    assert.equal(uploadData.teacherReview.verdict, "Pending", "teacherReview.verdict defaults to 'Pending'");
    assert.equal(uploadData.teacherReview.feedbackNotes, "", "teacherReview.feedbackNotes defaults to empty string");
    assert.equal(uploadData.extractedText, undefined, "upload response must NEVER leak extractedText");
    assert.equal(uploadData.storagePath, undefined, "upload response must NEVER leak storagePath");
    reportPass("LIVE ATLAS", "Assignment uploaded; isSharedWithStudent defaults to false; zero privacy leaks");

    // 3.3 Validate and attach analysis evidence against actual extractedText in Atlas
    const uploadedDoc = await Assignment.findById(assignmentId).select("+storagePath +extractedText");
    createdPhysicalFiles.push(uploadedDoc.storagePath);
    assert.equal(uploadedDoc.extractedText, essayText);

    // 3.3a Valid evidence attached via attachValidatedAnalysisResult
    const validEvidenceSnippet = "VeriWrite ensures that";
    const analysisPayload = {
      engineVersion: "1.0.0-stylometrics",
      analyzedAt: new Date(),
      executionTimeMs: 25,
      signalLevel: "Natural Variation",
      analysisConfidence: "High",
      metrics: {
        burstinessScore: 0.72,
        lexicalDiversity: 0.65,
        sentenceLengthVariance: 32.1,
        transitionDensityScore: 0.05,
        totalSentencesAnalyzed: 1,
        totalParagraphsAnalyzed: 1,
      },
      indicators: [
        {
          code: "UNIFORM_SENTENCE_CADENCE",
          label: "Uniform Sentence Cadence",
          severity: "Low",
          explanation: "Natural sentence structure observed.",
          evidence: [
            {
              snippet: validEvidenceSnippet,
              paragraphIndex: 0,
              sentenceIndex: 0,
              charStart: 0,
              charEnd: validEvidenceSnippet.length, // 22
              flagReason: "Opening assertion clause.",
            },
          ],
        },
      ],
      limitations: ["Probabilistic indicators."],
      runCount: 1,
    };

    attachValidatedAnalysisResult(uploadedDoc, analysisPayload);
    uploadedDoc.analysisStatus = "Completed";
    await uploadedDoc.save();
    reportPass("LIVE ATLAS", "Valid analysis evidence attached and saved to Atlas successfully");

    // 3.3b Invalid evidence rejected by attachValidatedAnalysisResult (does NOT save)
    const invalidAnalysisPayload = {
      ...analysisPayload,
      indicators: [
        {
          code: "UNIFORM_SENTENCE_CADENCE",
          label: "Uniform Sentence Cadence",
          severity: "High",
          explanation: "Testing invalid offset rejection.",
          evidence: [
            {
              snippet: "Non-existent snippet",
              paragraphIndex: 0,
              charStart: 0,
              charEnd: 22,
              flagReason: "Snippet mismatch",
            },
          ],
        },
      ],
    };

    assert.throws(
      () => attachValidatedAnalysisResult(uploadedDoc, invalidAnalysisPayload),
      (err) => err instanceof EvidenceValidationError && err.code === "SNIPPET_MISMATCH",
      "attachValidatedAnalysisResult must reject mismatching snippet without altering document"
    );
    reportPass("LIVE ATLAS", "Mismatching evidence rejected by controller/service validator with EvidenceValidationError");

    // 3.4 Student fetches assignments via GET /api/assignments/my
    const myRes = await fetch(`${baseUrl}/api/assignments/my`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const myData = await myRes.json();
    assert.equal(myRes.status, 200);
    const myAssignment = myData.assignments.find((a) => a.id === assignmentId);
    assert.ok(myAssignment);
    assert.equal(myAssignment.extractedText, undefined, "GET /api/assignments/my must not expose extractedText");
    assert.equal(myAssignment.storagePath, undefined, "GET /api/assignments/my must not expose storagePath");
    assert.equal(myAssignment.teacherReview.feedbackNotes, "", "Feedback notes hidden by default when isSharedWithStudent is false");
    assert.equal(myAssignment.analysisResult.indicators[0].evidence[0].snippet, validEvidenceSnippet);
    reportPass("LIVE ATLAS", "Student retrieval verified: zero privacy leaks, feedback hidden by default, evidence intact");

    // 3.5 toJSON and toObject transforms
    const rawDoc = await Assignment.findById(assignmentId).select("+extractedText +storagePath");
    const jsonOut = rawDoc.toJSON();
    const objOut = rawDoc.toObject();
    assert.equal(jsonOut.extractedText, undefined);
    assert.equal(jsonOut.storagePath, undefined);
    assert.equal(objOut.extractedText, undefined);
    assert.equal(objOut.storagePath, undefined);
    reportPass("LIVE ATLAS", "Mongoose toJSON and toObject transforms strip extractedText and storagePath");

  } catch (err) {
    reportFail("TASK 2 CORRECTIONS", "Unexpected error during test execution", err);
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
    console.log(`   TASK 2 CORRECTIONS SUITE: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("===============================================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTask2TestSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
