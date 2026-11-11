import Assignment from "../models/Assignment.js";
import { safeDeleteUploadedFile } from "../middleware/uploadMiddleware.js";

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
 * Serializes a Mongoose Assignment document into safe public metadata.
 * Never includes storagePath or __v.
 */
const serializeAssignment = (doc) => {
  const assignmentId = doc._id.toString();
  return {
    id: assignmentId,
    student: doc.student?.toString ? doc.student.toString() : String(doc.student || ""),
    title: doc.title,
    course: doc.course || "",
    notes: doc.notes || "",
    originalFileName: doc.originalFileName,
    fileName: doc.originalFileName,
    storageKey: doc.storageKey,
    mimeType: doc.mimeType,
    fileExtension: doc.fileExtension,
    fileCategory: doc.fileCategory,
    fileSize: doc.fileSize,
    analysisStatus: doc.analysisStatus || "Pending",
    reviewStatus: doc.reviewStatus || "Pending",
    summaryNote:
      doc.summaryNote ||
      "Submission received and queued for writing analysis.",
    submittedDate: formatSubmittedDate(doc.createdAt),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
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

    const {
      originalFileName,
      storageKey,
      mimeType,
      fileExtension,
      fileSize,
      fileCategory,
    } = req.verifiedUpload;

    // 4. Persist assignment metadata in MongoDB Atlas (always using verified req.user.id)
    const createdAssignment = await Assignment.create({
      student: req.user.id,
      title: trimmedTitle,
      course: trimmedCourse,
      notes: trimmedNotes,
      originalFileName,
      storageKey,
      storagePath: internalFilePath,
      mimeType,
      fileExtension,
      fileCategory,
      fileSize,
      analysisStatus: "Pending",
      reviewStatus: "Pending",
    });

    const safeAssignment = serializeAssignment(createdAssignment);

    // 5. Return HTTP 201 with MongoDB assignment ID & createdAt while preserving top-level fields
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
      title: safeAssignment.title,
      course: safeAssignment.course,
      notes: safeAssignment.notes,
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

    const assignments = docs.map((doc) => serializeAssignment(doc));

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
