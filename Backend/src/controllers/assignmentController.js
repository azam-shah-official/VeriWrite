import crypto from "node:crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import Assignment from "../models/Assignment.js";
import { safeDeleteUploadedFile } from "../middleware/uploadMiddleware.js";
import { extractTextFromFile } from "../utils/textExtractor.js";
import {
  validateEvidenceOffsets,
  assertValidEvidenceOffsets,
  validateAnalysisResultEvidence,
  EvidenceValidationError,
} from "../utils/textValidator.js";
import {
  runAnalysisPipeline,
  AnalysisServiceError,
} from "../services/analysis/analysisService.js";
import { extractEvidenceMap } from "../services/analysis/evidenceMapper.js";

export {
  validateEvidenceOffsets,
  assertValidEvidenceOffsets,
  validateAnalysisResultEvidence,
  EvidenceValidationError,
  extractEvidenceMap,
};

const MAX_TITLE_LENGTH = 150;
const MAX_COURSE_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;

/**
 * Formats a Date object or ISO timestamp into a display date string (e.g., "Nov 12, 2026").
 */
const formatSubmittedDate = (dateValue) => {
  if (!dateValue) {
    return "—";
  }
  const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(dateObj.getTime())) {
    return "—";
  }
  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Safely serializes an analysisResult subdocument.
 * Omits internal execution details if not present, and ensures evidence snippets
 * only include clean, safe data (never raw server paths or sensitive system fields).
 */
const serializeAnalysisResult = (analysisResult) => {
  if (!analysisResult) {
    return null;
  }

  // If analysisResult exists but has no analyzedAt date and runCount is 0,
  // no actual analysis has executed yet. Return null to avoid misleading the client.
  if (
    !analysisResult.analyzedAt &&
    (!analysisResult.runCount || analysisResult.runCount === 0)
  ) {
    return null;
  }

  return {
    engineVersion: analysisResult.engineVersion || "1.0.0-stylometrics",
    analyzedAt: analysisResult.analyzedAt || null,
    executionTimeMs:
      typeof analysisResult.executionTimeMs === "number"
        ? analysisResult.executionTimeMs
        : 0,
    signalLevel: analysisResult.signalLevel || "Inconclusive",
    analysisConfidence: analysisResult.analysisConfidence || "Low",
    metrics: {
      burstinessScore: analysisResult.metrics?.burstinessScore || 0,
      lexicalDiversity: analysisResult.metrics?.lexicalDiversity || 0,
      sentenceLengthVariance:
        analysisResult.metrics?.sentenceLengthVariance || 0,
      transitionDensityScore:
        analysisResult.metrics?.transitionDensityScore || 0,
      totalSentencesAnalyzed:
        analysisResult.metrics?.totalSentencesAnalyzed || 0,
      totalParagraphsAnalyzed:
        analysisResult.metrics?.totalParagraphsAnalyzed || 0,
    },
    indicators: Array.isArray(analysisResult.indicators)
      ? analysisResult.indicators.map((ind) => ({
          code: ind.code,
          label: ind.label,
          severity: ind.severity,
          explanation: ind.explanation,
          evidence: Array.isArray(ind.evidence)
            ? ind.evidence.map((ev, evIdx) => ({
                findingId:
                  typeof ev.findingId === "string" && ev.findingId.trim().length > 0
                    ? ev.findingId.trim()
                    : `FND-${ind.code}-${evIdx + 1}`,
                snippet: ev.snippet,
                paragraphIndex: ev.paragraphIndex,
                sentenceIndex:
                  typeof ev.sentenceIndex === "number"
                    ? ev.sentenceIndex
                    : null,
                charStart:
                  typeof ev.charStart === "number" ? ev.charStart : null,
                charEnd: typeof ev.charEnd === "number" ? ev.charEnd : null,
                flagReason: ev.flagReason,
              }))
            : [],
        }))
      : [],
    limitations: Array.isArray(analysisResult.limitations)
      ? [...analysisResult.limitations]
      : [],
    runCount:
      typeof analysisResult.runCount === "number"
        ? analysisResult.runCount
        : 0,
  };
};

/**
 * Safely serializes a teacherReview subdocument.
 * Enforces role-based visibility:
 * - When requestingRole === "STUDENT":
 *   feedbackNotes is exposed ONLY when isSharedWithStudent is explicitly true.
 *   When false or missing (undefined/null), feedbackNotes is blanked out ("")
 *   to ensure private educator remarks are never leaked.
 *   isSharedWithStudent is omitted (undefined) for students.
 * - When requestingRole === "TEACHER":
 *   feedbackNotes is always included.
 *   isSharedWithStudent is included as a boolean (defaulting to false if missing).
 */
const serializeTeacherReview = (teacherReview, options = {}) => {
  if (!teacherReview) {
    return null;
  }

  const requestingRole = options.requestingRole || "STUDENT";
  const isTeacher = requestingRole === "TEACHER";
  const isExplicitlyShared = teacherReview.isSharedWithStudent === true;

  const safeFeedbackNotes =
    isTeacher || isExplicitlyShared ? teacherReview.feedbackNotes || "" : "";

  const reviewerId = teacherReview.reviewedBy
    ? (teacherReview.reviewedBy._id?.toString() ||
        teacherReview.reviewedBy.toString())
    : null;
  const reviewerName =
    typeof teacherReview.reviewedBy === "object" && teacherReview.reviewedBy?.name
      ? teacherReview.reviewedBy.name
      : null;

  return {
    reviewedBy: reviewerId,
    reviewerName: isTeacher ? reviewerName : undefined,
    reviewedAt: teacherReview.reviewedAt || null,
    verdict: teacherReview.verdict || "Pending",
    feedbackNotes: safeFeedbackNotes,
    isSharedWithStudent: isTeacher
      ? Boolean(teacherReview.isSharedWithStudent)
      : undefined,
  };
};

/**
 * Validates and attaches an analysis result to an assignment document.
 * Ensures character offsets and snippets strictly match the assignment's
 * original extractedText under the end-exclusive convention: extractedText.slice(charStart, charEnd).
 * Rejects invalid evidence with an error rather than silently correcting offsets.
 *
 * @param {Assignment} assignmentDoc - Assignment document (with extractedText string).
 * @param {object} analysisResult - Analysis result object to validate and attach.
 */
export const attachValidatedAnalysisResult = (
  assignmentDoc,
  analysisResult
) => {
  if (!assignmentDoc) {
    throw new Error("Assignment document is required.");
  }

  const extractedText = assignmentDoc.extractedText;
  if (typeof extractedText !== "string") {
    throw new Error(
      "Assignment extractedText is required for evidence offset validation."
    );
  }

  const validation = validateAnalysisResultEvidence(
    analysisResult,
    extractedText
  );
  if (!validation.isValid) {
    const err = new EvidenceValidationError(
      validation.error,
      validation.errorCode || "INVALID_EVIDENCE_OFFSETS"
    );
    err.indicatorCode = validation.indicatorCode;
    throw err;
  }

  assignmentDoc.analysisResult = analysisResult;
  return assignmentDoc;
};

/**
 * Serializes a Mongoose Assignment document into safe public metadata.
 * Never includes storagePath, extractedText, or __v.
 */
export const serializeAssignment = (doc, options = {}) => {
  const assignmentId = doc._id.toString();
  const requestingRole = options.requestingRole || "STUDENT";

  return {
    id: assignmentId,
    student: doc.student?.toString ? doc.student.toString() : String(doc.student || ""),
    teacher: doc.teacher?.toString ? doc.teacher.toString() : doc.teacher ? String(doc.teacher) : null,
    title: doc.title,
    course: doc.course || "",
    notes: doc.notes || "",
    institution: doc.institution || "",
    originalFileName: doc.originalFileName,
    fileName: doc.originalFileName,
    storageKey: doc.storageKey,
    mimeType: doc.mimeType,
    fileExtension: doc.fileExtension,
    fileCategory: doc.fileCategory,
    fileSize: doc.fileSize,
    extractionStatus: doc.extractionStatus || "Pending",
    wordCount: doc.wordCount || 0,
    characterCount: doc.characterCount || 0,
    characterCountWithoutSpaces: doc.characterCountWithoutSpaces || 0,
    paragraphCount: doc.paragraphCount || 0,
    lineCount: doc.lineCount || 0,
    readingTimeMinutes: doc.readingTimeMinutes || 0,
    analysisStatus: doc.analysisStatus || "Pending",
    reviewStatus: doc.reviewStatus || "Pending",
    summaryNote:
      doc.summaryNote ||
      "Submission received and queued for writing analysis.",
    submittedDate: formatSubmittedDate(doc.createdAt),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastReviewedAt: doc.lastReviewedAt || null,
    findingReviews: Array.isArray(doc.findingReviews) ? doc.findingReviews : [],
    teacherComments: Array.isArray(doc.teacherComments) ? doc.teacherComments : [],
    analysisResult: serializeAnalysisResult(doc.analysisResult),
    teacherReview: serializeTeacherReview(doc.teacherReview, {
      requestingRole,
    }),
  };
};

const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/assignments/teachers
 * Protected endpoint for STUDENT role only.
 * Returns registered teachers belonging to the student's academic institution.
 * Returns only safe fields (id, name, email, institution).
 */
export const getInstituteTeachers = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "STUDENT" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only students can view available teachers.",
      });
    }

    const rawInstitute = req.user.institution;
    const studentInstitute =
      typeof rawInstitute === "string" ? rawInstitute.trim() : "";

    if (!studentInstitute) {
      return res.status(200).json({
        success: true,
        count: 0,
        teachers: [],
        message:
          "No institution is associated with your student account. Please update your profile.",
      });
    }

    const escapedInstitute = escapeRegex(studentInstitute);
    const teachers = await User.find({
      role: "TEACHER",
      institution: new RegExp(`^${escapedInstitute}$`, "i"),
    })
      .select("_id name email institution")
      .sort({ name: 1 })
      .lean();

    const safeTeachers = teachers.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      email: t.email,
      institution: t.institution || "",
    }));

    return res.status(200).json({
      success: true,
      count: safeTeachers.length,
      teachers: safeTeachers,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching institute teachers.",
    });
  }
};

/**
 * POST /api/assignments/upload
 * Protected endpoint for STUDENT role only.
 * Validates metadata fields, persists assignment metadata to MongoDB Atlas,
 * cleans up the uploaded file on any validation or database error,
 * and returns safe metadata without exposing internal filesystem paths.
 */
export const uploadAssignment = async (req, res) => {
  const internalFilePath = req.verifiedUpload?.internalFilePath;

  try {
    if (!req.user || req.user.role !== "STUDENT" || !req.user.id) {
      await safeDeleteUploadedFile(internalFilePath);
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only students can upload assignments.",
      });
    }

    if (!req.verifiedUpload) {
      return res.status(400).json({
        success: false,
        message: "Assignment file is required.",
      });
    }

    const rawTitle = req.body?.title;
    const rawCourse = req.body?.course;
    const rawNotes = req.body?.notes;

    // 1. Validate title (required, non-empty, max 150 chars)
    if (typeof rawTitle !== "string" || !rawTitle.trim()) {
      await safeDeleteUploadedFile(internalFilePath);
      return res.status(400).json({
        success: false,
        message: "Assignment title is required.",
      });
    }

    const trimmedTitle = rawTitle.trim();
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      await safeDeleteUploadedFile(internalFilePath);
      return res.status(400).json({
        success: false,
        message: `Assignment title must not exceed ${MAX_TITLE_LENGTH} characters.`,
      });
    }

    // 2. Validate course (optional, max 100 chars)
    let trimmedCourse = "";
    if (rawCourse !== undefined && rawCourse !== null) {
      if (typeof rawCourse !== "string") {
        await safeDeleteUploadedFile(internalFilePath);
        return res.status(400).json({
          success: false,
          message: "Course field must be a valid text string.",
        });
      }
      trimmedCourse = rawCourse.trim();
      if (trimmedCourse.length > MAX_COURSE_LENGTH) {
        await safeDeleteUploadedFile(internalFilePath);
        return res.status(400).json({
          success: false,
          message: `Course must not exceed ${MAX_COURSE_LENGTH} characters.`,
        });
      }
    }

    // 3. Validate notes (optional, max 500 chars)
    let trimmedNotes = "";
    if (rawNotes !== undefined && rawNotes !== null) {
      if (typeof rawNotes !== "string") {
        await safeDeleteUploadedFile(internalFilePath);
        return res.status(400).json({
          success: false,
          message: "Notes field must be a valid text string.",
        });
      }
      trimmedNotes = rawNotes.trim();
      if (trimmedNotes.length > MAX_NOTES_LENGTH) {
        await safeDeleteUploadedFile(internalFilePath);
        return res.status(400).json({
          success: false,
          message: `Notes must not exceed ${MAX_NOTES_LENGTH} characters.`,
        });
      }
    }

    // 4. Validate teacher selection (required, valid ObjectId, role TEACHER, matching institute)
    const rawTeacherId = req.body?.teacherId || req.body?.teacher;
    if (typeof rawTeacherId !== "string" || !rawTeacherId.trim()) {
      await safeDeleteUploadedFile(internalFilePath);
      return res.status(400).json({
        success: false,
        message:
          "Teacher selection is required. Please select a registered teacher from your institution.",
      });
    }

    const trimmedTeacherId = rawTeacherId.trim();
    if (!mongoose.Types.ObjectId.isValid(trimmedTeacherId)) {
      await safeDeleteUploadedFile(internalFilePath);
      return res.status(400).json({
        success: false,
        message: "Invalid teacher ID format.",
      });
    }

    const teacherDoc = await User.findById(trimmedTeacherId)
      .select("_id name email role institution")
      .lean();

    if (!teacherDoc) {
      await safeDeleteUploadedFile(internalFilePath);
      return res.status(400).json({
        success: false,
        message: "Selected teacher does not exist.",
      });
    }

    if (teacherDoc.role !== "TEACHER") {
      await safeDeleteUploadedFile(internalFilePath);
      return res.status(400).json({
        success: false,
        message: "Selected user account is not a teacher.",
      });
    }

    const studentInstitute = (req.user?.institution || "").trim().toLowerCase();
    const teacherInstitute = (teacherDoc.institution || "").trim().toLowerCase();

    if (
      !studentInstitute ||
      !teacherInstitute ||
      studentInstitute !== teacherInstitute
    ) {
      await safeDeleteUploadedFile(internalFilePath);
      return res.status(400).json({
        success: false,
        message:
          "Selected teacher does not belong to your academic institution.",
      });
    }

    const {
      originalFileName,
      storageKey,
      mimeType,
      fileExtension,
      fileSize,
      fileCategory,
    } = req.verifiedUpload;

    // 4. Perform text extraction and validation for supported document types
    let extractedText = "";
    let extractionStatus = "Pending";
    let extractionErrorCode = null;
    let extractionStats = {
      wordCount: 0,
      characterCount: 0,
      characterCountWithoutSpaces: 0,
      paragraphCount: 0,
      lineCount: 0,
      readingTimeMinutes: 0,
    };

    if (fileCategory === "IMAGE") {
      extractionStatus = "NotSupported";
      extractedText = "";
      extractionErrorCode = null;
    } else if (["PDF", "DOCX", "TXT"].includes(fileCategory)) {
      try {
        const extraction = await extractTextFromFile(internalFilePath, {
          fileCategory,
          enforceStorageDir: true,
        });
        extractedText = extraction.normalizedText || "";
        extractionStatus = "Completed";
        extractionStats = {
          wordCount: extraction.stats?.wordCount || 0,
          characterCount: extraction.stats?.characterCount || 0,
          characterCountWithoutSpaces:
            extraction.stats?.characterCountWithoutSpaces || 0,
          paragraphCount: extraction.stats?.paragraphCount || 0,
          lineCount: extraction.stats?.lineCount || 0,
          readingTimeMinutes: extraction.stats?.readingTimeMinutes || 0,
        };
      } catch (extractErr) {
        // Extraction failed (e.g. empty, corrupt, encrypted, scanned/image-only PDF).
        // Preserve physical file for review; do not delete the file.
        extractionStatus = "Failed";
        extractionErrorCode =
          typeof extractErr?.code === "string"
            ? extractErr.code
            : "EXTRACTION_FAILED";
        extractedText = "";
      }
    } else {
      extractionStatus = "NotSupported";
      extractedText = "";
    }

    // 5. Persist assignment metadata in MongoDB Atlas (always using verified req.user.id)
    const userInstitution =
      typeof req.user?.institution === "string"
        ? req.user.institution.trim()
        : "";
    const institutionNormalized = userInstitution.toLowerCase().trim();

    const createdAssignment = await Assignment.create({
      student: req.user.id,
      teacher: teacherDoc._id,
      title: trimmedTitle,
      course: trimmedCourse,
      notes: trimmedNotes,
      institution: userInstitution,
      institutionNormalized,
      originalFileName,
      storageKey,
      storagePath: internalFilePath,
      mimeType,
      fileExtension,
      fileCategory,
      fileSize,
      extractedText,
      extractionStatus,
      extractionErrorCode,
      wordCount: extractionStats.wordCount,
      characterCount: extractionStats.characterCount,
      characterCountWithoutSpaces: extractionStats.characterCountWithoutSpaces,
      paragraphCount: extractionStats.paragraphCount,
      lineCount: extractionStats.lineCount,
      readingTimeMinutes: extractionStats.readingTimeMinutes,
      analysisStatus: "Pending",
      reviewStatus: "Pending",
    });

    const safeAssignment = serializeAssignment(createdAssignment, {
      requestingRole: req.user?.role || "STUDENT",
    });

    // 6. Return HTTP 201 with MongoDB assignment ID & createdAt while preserving top-level fields
    return res.status(201).json({
      success: true,
      message: "Assignment file uploaded and saved successfully.",
      id: safeAssignment.id,
      assignmentId: safeAssignment.id,
      createdAt: safeAssignment.createdAt,
      updatedAt: safeAssignment.updatedAt,
      submittedDate: safeAssignment.submittedDate,
      analysisStatus: safeAssignment.analysisStatus,
      reviewStatus: safeAssignment.reviewStatus,
      summaryNote: safeAssignment.summaryNote,
      originalFileName: safeAssignment.originalFileName,
      fileName: safeAssignment.fileName,
      storageKey: safeAssignment.storageKey,
      fileId: safeAssignment.storageKey,
      mimeType: safeAssignment.mimeType,
      fileExtension: safeAssignment.fileExtension,
      fileSize: safeAssignment.fileSize,
      fileCategory: safeAssignment.fileCategory,
      extractionStatus: safeAssignment.extractionStatus,
      wordCount: safeAssignment.wordCount,
      characterCount: safeAssignment.characterCount,
      paragraphCount: safeAssignment.paragraphCount,
      readingTimeMinutes: safeAssignment.readingTimeMinutes,
      analysisResult: safeAssignment.analysisResult,
      teacherReview: safeAssignment.teacherReview,
      title: safeAssignment.title,
      teacher: safeAssignment.teacher,
      course: safeAssignment.course,
      notes: safeAssignment.notes,
      institution: safeAssignment.institution,
      assignment: safeAssignment,
    });
  } catch (error) {
    // Always delete the uploaded physical file if MongoDB persistence or any step fails
    await safeDeleteUploadedFile(internalFilePath);

    if (error && error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Invalid assignment metadata.",
      });
    }

    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate storage key conflict. Please retry the upload.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error while saving assignment submission.",
    });
  }
};

/**
 * GET /api/assignments/my
 * Protected endpoint for STUDENT role only.
 * Fetches assignments belonging strictly to req.user.id, sorted newest first.
 */
export const getMyAssignments = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "STUDENT" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only students can access their assignments.",
      });
    }

    const docs = await Assignment.find({ student: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    const assignments = docs.map((doc) =>
      serializeAssignment(doc, { requestingRole: req.user?.role || "STUDENT" })
    );

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching assignments.",
    });
  }
};

/**
 * POST /api/assignments/:id/analyze
 * Protected endpoint for STUDENT role only.
 * Triggers stylometric AI writing analysis on the student's assignment.
 * Enforces atomic concurrency locking, stale lock recovery, and idempotency.
 */
export const analyzeAssignment = async (req, res) => {
  const assignmentId = req.params?.id;

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid assignment ID format.",
    });
  }

  if (!req.user || req.user.role !== "STUDENT" || !req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access forbidden. Only students can analyze their assignments.",
    });
  }

  const STALE_LOCK_MS = 3 * 60 * 1000; // 3 minutes stale lock threshold
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MS);
  const currentRunToken = crypto.randomUUID();
  const now = new Date();
  const forceReanalysis = req.body?.forceReanalysis === true;

  try {
    // 1. Inspect existing assignment state for ownership & prerequisites
    const existingAssignment = await Assignment.findOne({
      _id: assignmentId,
      student: req.user.id,
    }).select("+extractedText");

    if (!existingAssignment) {
      // Check if assignment exists under another student to return 403 vs 404
      const otherStudentDoc = await Assignment.findById(assignmentId).select(
        "_id student"
      );
      if (otherStudentDoc) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. You do not own this assignment.",
        });
      }
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    // 2. Check extraction status
    if (existingAssignment.extractionStatus !== "Completed") {
      return res.status(400).json({
        success: false,
        message: `Cannot analyze assignment because document text extraction is '${existingAssignment.extractionStatus}'. Only 'Completed' extractions can be analyzed.`,
        extractionStatus: existingAssignment.extractionStatus,
      });
    }

    if (
      !existingAssignment.extractedText ||
      existingAssignment.extractedText.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Assignment extracted text is missing or empty.",
      });
    }

    // 3. Idempotency: if already completed and not forceReanalysis, return existing result
    if (
      existingAssignment.analysisStatus === "Completed" &&
      existingAssignment.analysisResult &&
      !forceReanalysis
    ) {
      const safeAssignment = serializeAssignment(existingAssignment, {
        requestingRole: "STUDENT",
      });
      return res.status(200).json({
        success: true,
        message: "Analysis already completed for this assignment.",
        assignmentId: safeAssignment.id,
        analysisStatus: safeAssignment.analysisStatus,
        analysisResult: safeAssignment.analysisResult,
        assignment: safeAssignment,
      });
    }

    // 4. Atomic lock acquisition
    const lockedAssignment = await Assignment.findOneAndUpdate(
      {
        _id: assignmentId,
        student: req.user.id,
        extractionStatus: "Completed",
        $or: [
          { analysisStatus: { $ne: "Processing" } },
          {
            analysisStatus: "Processing",
            $or: [
              { analysisLockAcquiredAt: { $lt: staleThreshold } },
              { analysisLockAcquiredAt: null },
              { analysisLockAcquiredAt: { $exists: false } },
            ],
          },
        ],
      },
      {
        $set: {
          analysisStatus: "Processing",
          analysisLockToken: currentRunToken,
          analysisLockAcquiredAt: now,
          summaryNote: "Writing analysis in progress...",
        },
      },
      { new: true }
    ).select("+extractedText");

    if (!lockedAssignment) {
      // Could not acquire lock because another active non-stale process is running
      return res.status(409).json({
        success: false,
        message:
          "Analysis is currently in progress for this assignment. Please try again shortly.",
      });
    }

    // 5. Execute analysis pipeline
    let analysisResult;
    try {
      const currentRunCount = lockedAssignment.analysisResult?.runCount || 0;
      analysisResult = runAnalysisPipeline(
        lockedAssignment.extractedText,
        currentRunCount
      );

      // Validate offsets and snippets against original extracted text
      attachValidatedAnalysisResult(lockedAssignment, analysisResult);
    } catch (pipelineError) {
      // Failed during computation / validation -> conditional rollback matching currentRunToken
      const hasPriorResult = !!existingAssignment.analysisResult?.analyzedAt;
      await Assignment.findOneAndUpdate(
        {
          _id: assignmentId,
          analysisLockToken: currentRunToken,
        },
        {
          $set: {
            analysisStatus: "Failed",
            analysisLockToken: null,
            analysisLockAcquiredAt: null,
            summaryNote: hasPriorResult
              ? "Re-analysis attempt failed; previous analysis results preserved."
              : "Analysis failed due to a processing error.",
          },
        }
      );

      if (pipelineError instanceof AnalysisServiceError) {
        return res.status(400).json({
          success: false,
          code: pipelineError.code,
          message: pipelineError.message,
        });
      }

      return res.status(500).json({
        success: false,
        message:
          pipelineError?.message ||
          "Internal server error during writing analysis.",
      });
    }

    // 6. Conditional completion update matching currentRunToken
    const completedAssignment = await Assignment.findOneAndUpdate(
      {
        _id: assignmentId,
        analysisLockToken: currentRunToken,
      },
      {
        $set: {
          analysisStatus: "Completed",
          analysisLockToken: null,
          analysisLockAcquiredAt: null,
          analysisResult,
          summaryNote: "Writing analysis completed successfully.",
        },
      },
      { new: true }
    );

    if (!completedAssignment) {
      // Stale lock condition: another worker recovered and acquired a newer lock in the interim
      return res.status(409).json({
        success: false,
        message: "Analysis run was superseded by a newer execution request.",
      });
    }

    const safeAssignment = serializeAssignment(completedAssignment, {
      requestingRole: "STUDENT",
    });

    return res.status(200).json({
      success: true,
      message: "Writing analysis completed successfully.",
      assignmentId: safeAssignment.id,
      analysisStatus: safeAssignment.analysisStatus,
      analysisResult: safeAssignment.analysisResult,
      assignment: safeAssignment,
    });
  } catch (_error) {
    // Unhandled exception recovery
    try {
      await Assignment.findOneAndUpdate(
        {
          _id: assignmentId,
          analysisLockToken: currentRunToken,
        },
        {
          $set: {
            analysisStatus: "Failed",
            analysisLockToken: null,
            analysisLockAcquiredAt: null,
            summaryNote:
              "Analysis interrupted due to an unexpected server error.",
          },
        }
      );
    } catch {}

    return res.status(500).json({
      success: false,
      message: "Internal server error while executing writing analysis.",
    });
  }
};

/**
 * GET /api/assignments/:id/evidence
 * Retrieves the extracted and traceable evidence map for an assignment.
 * Access policy:
 * - STUDENT: Must own the assignment.
 * - TEACHER: Must belong to the same institution (or teacher role authorized).
 */
export const getAssignmentEvidence = async (req, res) => {
  const assignmentId = req.params?.id;

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid assignment ID format.",
    });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    const assignment = await Assignment.findById(assignmentId)
      .select("+extractedText")
      .populate("teacherReview.reviewedBy", "name email");

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    // Role-based authorization
    const isStudent = req.user.role === "STUDENT";
    const isTeacher = req.user.role === "TEACHER";

    if (isStudent) {
      const studentId = assignment.student?.toString
        ? assignment.student.toString()
        : String(assignment.student);
      if (studentId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. You do not own this assignment.",
        });
      }
    } else if (isTeacher) {
      const assignedTeacherId = assignment.teacher?.toString
        ? assignment.teacher.toString()
        : assignment.teacher
          ? String(assignment.teacher)
          : null;

      const isOwnerTeacher =
        assignedTeacherId !== null &&
        assignedTeacherId === req.user.id.toString();

      if (!isOwnerTeacher) {
        return res.status(403).json({
          success: false,
          message:
            "Access forbidden. You do not have verified teacher ownership of this assignment.",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Unsupported role.",
      });
    }

    if (
      assignment.analysisStatus !== "Completed" ||
      !assignment.analysisResult
    ) {
      return res.status(400).json({
        success: false,
        message: `Analysis evidence is not available because analysis status is '${assignment.analysisStatus}'.`,
        analysisStatus: assignment.analysisStatus,
      });
    }

    const evidenceMap = extractEvidenceMap(
      assignment.analysisResult,
      assignment.extractedText || ""
    );

    // Merge individual finding review decisions onto findings
    const reviewDecisionsMap = new Map();
    if (Array.isArray(assignment.findingReviews)) {
      assignment.findingReviews.forEach((fr) => {
        if (fr.findingId) {
          reviewDecisionsMap.set(fr.findingId, {
            decision: fr.decision,
            reviewedAt: fr.reviewedAt,
            notes: fr.notes || "",
            teacher: fr.teacher?.toString ? fr.teacher.toString() : String(fr.teacher || ""),
          });
        }
      });
    }

    if (evidenceMap && Array.isArray(evidenceMap.findings)) {
      evidenceMap.findings = evidenceMap.findings.map((f) => {
        const review = reviewDecisionsMap.get(f.findingId);
        return {
          ...f,
          reviewDecision: review || {
            decision: "Pending",
            reviewedAt: null,
            notes: "",
            teacher: null,
          },
        };
      });
    }

    return res.status(200).json({
      success: true,
      assignmentId: assignment._id.toString(),
      title: assignment.title,
      analysisStatus: assignment.analysisStatus,
      reviewStatus: assignment.reviewStatus,
      lastReviewedAt: assignment.lastReviewedAt || null,
      extractedText: assignment.extractedText || "",
      evidenceMap,
      metrics: assignment.analysisResult?.metrics || null,
      analysisResult: assignment.analysisResult
        ? {
            signalLevel: assignment.analysisResult.signalLevel,
            analysisConfidence: assignment.analysisResult.analysisConfidence,
            metrics: assignment.analysisResult.metrics || null,
          }
        : null,
      findingReviews: Array.isArray(assignment.findingReviews) ? assignment.findingReviews : [],
      teacherComments: Array.isArray(assignment.teacherComments) ? assignment.teacherComments : [],
      teacherReview: serializeTeacherReview(assignment.teacherReview, {
        requestingRole: req.user?.role || "STUDENT",
      }),
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while extracting evidence map.",
    });
  }
};

/**
 * GET /api/assignments/:id/review-status
 * Task 14: Protected endpoint for submission owner or assigned teacher.
 * Retrieves current review status, finding decisions, teacher feedback, and review date.
 */
export const getAssignmentReviewStatus = async (req, res) => {
  const assignmentId = req.params?.id;

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid assignment ID format.",
    });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    const isStudent = req.user.role === "STUDENT";
    const isTeacher = req.user.role === "TEACHER";

    if (isStudent) {
      const studentId = assignment.student?.toString
        ? assignment.student.toString()
        : String(assignment.student);
      if (studentId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. You do not own this assignment.",
        });
      }
    } else if (isTeacher) {
      const assignedTeacherId = assignment.teacher?.toString
        ? assignment.teacher.toString()
        : assignment.teacher
          ? String(assignment.teacher)
          : null;
      if (!assignedTeacherId || assignedTeacherId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. You do not have verified teacher ownership of this assignment.",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Unsupported role.",
      });
    }

    return res.status(200).json({
      success: true,
      assignmentId: assignment._id.toString(),
      title: assignment.title,
      reviewStatus: assignment.reviewStatus,
      lastReviewedAt: assignment.lastReviewedAt || null,
      verdict: assignment.teacherReview?.verdict || "Pending",
      feedbackNotes: assignment.teacherReview?.feedbackNotes || "",
      findingReviews: Array.isArray(assignment.findingReviews) ? assignment.findingReviews : [],
      teacherComments: Array.isArray(assignment.teacherComments) ? assignment.teacherComments : [],
      updatedAt: assignment.updatedAt,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching assignment review status.",
    });
  }
};

/**
 * GET /api/assignments/:id/comments
 * Task 12: Protected endpoint for submission owner or assigned teacher.
 * Retrieves comments thread for this assignment.
 */
export const getAssignmentComments = async (req, res) => {
  const assignmentId = req.params?.id;

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid assignment ID format.",
    });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    const assignment = await Assignment.findById(assignmentId).lean();
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    const isStudent = req.user.role === "STUDENT";
    const isTeacher = req.user.role === "TEACHER";

    if (isStudent) {
      const studentId = assignment.student?.toString
        ? assignment.student.toString()
        : String(assignment.student);
      if (studentId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. You do not own this assignment.",
        });
      }
    } else if (isTeacher) {
      const assignedTeacherId = assignment.teacher?.toString
        ? assignment.teacher.toString()
        : assignment.teacher
          ? String(assignment.teacher)
          : null;
      if (!assignedTeacherId || assignedTeacherId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. You do not have verified teacher ownership of this assignment.",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Unsupported role.",
      });
    }

    return res.status(200).json({
      success: true,
      assignmentId: assignment._id.toString(),
      count: assignment.teacherComments?.length || 0,
      comments: assignment.teacherComments || [],
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching assignment comments.",
    });
  }
};

/**
 * GET /api/assignments/:id/audit-trail
 * Task 13: Protected endpoint for submission owner or assigned teacher.
 * Retrieves append-only review history for this assignment.
 */
export const getAssignmentAuditTrail = async (req, res) => {
  const assignmentId = req.params?.id;

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid assignment ID format.",
    });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    const assignment = await Assignment.findById(assignmentId).lean();
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    const isStudent = req.user.role === "STUDENT";
    const isTeacher = req.user.role === "TEACHER";

    if (isStudent) {
      const studentId = assignment.student?.toString
        ? assignment.student.toString()
        : String(assignment.student);
      if (studentId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. You do not own this assignment.",
        });
      }
    } else if (isTeacher) {
      const assignedTeacherId = assignment.teacher?.toString
        ? assignment.teacher.toString()
        : assignment.teacher
          ? String(assignment.teacher)
          : null;
      if (!assignedTeacherId || assignedTeacherId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. You do not have verified teacher ownership of this assignment.",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Unsupported role.",
      });
    }

    return res.status(200).json({
      success: true,
      assignmentId: assignment._id.toString(),
      count: assignment.auditTrail?.length || 0,
      auditTrail: assignment.auditTrail || [],
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching assignment audit trail.",
    });
  }
};
