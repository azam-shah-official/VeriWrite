import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";

const PENDING_STATUSES = [
  "Pending",
  "Pending Review",
  "Under Review",
  "Needs Human Review",
];

const REVIEWED_STATUSES = [
  "Completed",
  "Reviewed",
  "Needs Clarification",
  "Further Review Required",
];

/**
 * Helper to verify teacher ownership of an assignment.
 * Only assignment.teacher === req.user.id is permitted.
 */
const verifyTeacherOwnership = (assignment, userId) => {
  const assignedTeacherId = assignment.teacher?.toString
    ? assignment.teacher.toString()
    : assignment.teacher
      ? String(assignment.teacher)
      : null;
  return assignedTeacherId !== null && assignedTeacherId === userId.toString();
};

/**
 * Checks whether a findingId exists in an assignment's analysis result.
 */
const findingExistsInAssignment = (assignment, findingId) => {
  if (!assignment.analysisResult) return false;
  const indicators = assignment.analysisResult.indicators || [];
  for (const ind of indicators) {
    if (Array.isArray(ind.evidence)) {
      for (const ev of ind.evidence) {
        if (ev.findingId === findingId) return true;
      }
    }
  }
  return false;
};

/**
 * GET /api/teacher/dashboard/stats
 * Protected endpoint for TEACHER role only.
 * Returns aggregated statistics for the authenticated teacher.
 */
export const getTeacherDashboardStats = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can access teacher statistics.",
      });
    }

    const teacherObjectId = new mongoose.Types.ObjectId(req.user.id);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalCount, pendingCount, reviewedCount, newThisWeekCount, recentDocs] =
      await Promise.all([
        Assignment.countDocuments({ teacher: teacherObjectId }),
        Assignment.countDocuments({
          teacher: teacherObjectId,
          reviewStatus: { $in: PENDING_STATUSES },
        }),
        Assignment.countDocuments({
          teacher: teacherObjectId,
          reviewStatus: { $in: REVIEWED_STATUSES },
        }),
        Assignment.countDocuments({
          teacher: teacherObjectId,
          createdAt: { $gte: oneWeekAgo },
        }),
        Assignment.find({ teacher: teacherObjectId })
          .populate("student", "name email")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
      ]);

    const formattedRecent = recentDocs.map((doc) => ({
      id: doc._id.toString(),
      title: doc.title,
      course: doc.course || "",
      studentName: doc.student?.name || "Student",
      studentEmail: doc.student?.email || "",
      submittedDate: doc.submittedDate || doc.createdAt,
      analysisStatus: doc.analysisStatus,
      reviewStatus: doc.reviewStatus,
      lastReviewedAt: doc.lastReviewedAt || null,
      signalLevel: doc.analysisResult?.signalLevel || "Pending",
      verdict: doc.teacherReview?.verdict || "Pending",
      feedbackNotes: doc.teacherReview?.feedbackNotes || "",
      findingReviewsCount: doc.findingReviews?.length || 0,
      commentsCount: doc.teacherComments?.length || 0,
      wordCount: doc.wordCount || 0,
      fileCategory: doc.fileCategory || "PDF",
    }));

    return res.status(200).json({
      success: true,
      stats: {
        totalSubmissions: totalCount,
        pendingReviews: pendingCount,
        reviewedCount,
        newThisWeekCount,
        recentSubmissions: formattedRecent,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching teacher dashboard statistics.",
    });
  }
};

/**
 * GET /api/teacher/submissions
 * Protected endpoint for TEACHER role only.
 * Lists all student submissions assigned to this teacher with filtering and search.
 */
export const getTeacherSubmissions = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can view assigned student submissions.",
      });
    }

    const { status = "all", search = "" } = req.query || {};
    const teacherObjectId = new mongoose.Types.ObjectId(req.user.id);

    const filter = { teacher: teacherObjectId };

    if (status === "pending") {
      filter.reviewStatus = { $in: PENDING_STATUSES };
    } else if (status === "reviewed") {
      filter.reviewStatus = { $in: REVIEWED_STATUSES };
    }

    if (typeof search === "string" && search.trim()) {
      const searchTrimmed = search.trim();
      const escapedSearch = searchTrimmed.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      const searchRegex = new RegExp(escapedSearch, "i");

      // Find matching students to include in query
      const matchingStudents = await mongoose
        .model("User")
        .find({
          role: "STUDENT",
          name: searchRegex,
        })
        .select("_id");
      const matchingStudentIds = matchingStudents.map((s) => s._id);

      filter.$or = [
        { title: searchRegex },
        { course: searchRegex },
        { student: { $in: matchingStudentIds } },
      ];
    }

    const submissions = await Assignment.find(filter)
      .populate("student", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = submissions.map((doc) => ({
      id: doc._id.toString(),
      title: doc.title,
      course: doc.course || "",
      studentId: doc.student?._id ? doc.student._id.toString() : "",
      studentName: doc.student?.name || "Student",
      studentEmail: doc.student?.email || "",
      submittedDate: doc.submittedDate || doc.createdAt,
      analysisStatus: doc.analysisStatus,
      reviewStatus: doc.reviewStatus,
      lastReviewedAt: doc.lastReviewedAt || null,
      signalLevel: doc.analysisResult?.signalLevel || "Pending",
      confidence: doc.analysisResult?.analysisConfidence || "Medium",
      verdict: doc.teacherReview?.verdict || "Pending",
      feedbackNotes: doc.teacherReview?.feedbackNotes || "",
      isSharedWithStudent: Boolean(doc.teacherReview?.isSharedWithStudent),
      findingReviews: doc.findingReviews || [],
      teacherComments: doc.teacherComments || [],
      wordCount: doc.wordCount || 0,
      fileCategory: doc.fileCategory || "PDF",
      originalFileName: doc.originalFileName || "",
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      submissions: formatted,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching teacher submissions.",
    });
  }
};

/**
 * PATCH /api/teacher/submissions/:id/review
 * Protected endpoint for TEACHER role only.
 * Updates the teacher review verdict and feedback for a student submission.
 * Enforces verified teacher ownership: only assignment.teacher === req.user.id can review.
 */
export const submitTeacherReview = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can submit reviews.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID format.",
      });
    }

    const assignment = await Assignment.findById(id).populate("student", "name email");
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment submission not found.",
      });
    }

    if (!verifyTeacherOwnership(assignment, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not have verified teacher ownership of this submission.",
      });
    }

    const { verdict, feedbackNotes = "", isSharedWithStudent = true } = req.body || {};

    if (!verdict || typeof verdict !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid review determination verdict is required.",
      });
    }

    const validVerdicts = [
      "Pending",
      "Approved",
      "Needs Clarification",
      "Further Review Required",
      "Authentic Authorship Confirmed",
      "Discussed with Student",
      "Revision Requested",
      "Misconduct Investigation",
    ];

    if (!validVerdicts.includes(verdict)) {
      return res.status(400).json({
        success: false,
        message: `Invalid review verdict. Must be one of: ${validVerdicts.join(", ")}`,
      });
    }

    const previousVerdict = assignment.teacherReview?.verdict || "Pending";
    const previousStatus = assignment.reviewStatus || "Pending";
    const now = new Date();

    // Determine target reviewStatus according to Task 14
    let targetReviewStatus = "Reviewed";
    if (verdict === "Needs Clarification" || verdict === "Discussed with Student") {
      targetReviewStatus = "Needs Clarification";
    } else if (
      verdict === "Further Review Required" ||
      verdict === "Misconduct Investigation" ||
      verdict === "Revision Requested"
    ) {
      targetReviewStatus = "Further Review Required";
    } else if (verdict === "Approved" || verdict === "Authentic Authorship Confirmed") {
      targetReviewStatus = "Reviewed";
    }

    assignment.teacherReview = {
      reviewedBy: req.user.id,
      reviewedAt: now,
      verdict,
      feedbackNotes: typeof feedbackNotes === "string" ? feedbackNotes.trim() : "",
      isSharedWithStudent: Boolean(isSharedWithStudent),
    };

    const trimmedNotes = typeof feedbackNotes === "string" ? feedbackNotes.trim() : "";
    if (trimmedNotes) {
      // Add as comment in thread if not already present
      const alreadyLoggedComment = assignment.teacherComments?.some(
        (c) => c.text === trimmedNotes && c.findingId === null
      );
      if (!alreadyLoggedComment) {
        assignment.teacherComments.push({
          commentId: new mongoose.Types.ObjectId().toString(),
          teacher: req.user.id,
          teacherName: req.user.name || "Teacher",
          text: trimmedNotes,
          findingId: null,
          createdAt: now,
        });
        assignment.auditTrail.push({
          submissionId: assignment._id,
          findingId: null,
          action: "TEACHER_COMMENT_ADDED",
          previousValue: null,
          newValue: trimmedNotes.slice(0, 100),
          teacher: req.user.id,
          teacherName: req.user.name || "Teacher",
          timestamp: now,
        });
      }
    }

    // Append audit trail for overall verdict
    assignment.auditTrail.push({
      submissionId: assignment._id,
      findingId: null,
      action: previousVerdict === "Pending" ? "OVERALL_VERDICT_SUBMITTED" : "OVERALL_VERDICT_CHANGED",
      previousValue: previousVerdict,
      newValue: verdict,
      teacher: req.user.id,
      teacherName: req.user.name || "Teacher",
      timestamp: now,
    });

    // Record reviewStatus change if changed
    if (previousStatus !== targetReviewStatus) {
      assignment.auditTrail.push({
        submissionId: assignment._id,
        findingId: null,
        action: "REVIEW_STATUS_CHANGED",
        previousValue: previousStatus,
        newValue: targetReviewStatus,
        teacher: req.user.id,
        teacherName: req.user.name || "Teacher",
        timestamp: now,
      });
    }

    assignment.reviewStatus = targetReviewStatus;
    assignment.lastReviewedAt = now;
    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Teacher review determination submitted successfully.",
      submission: {
        id: assignment._id.toString(),
        title: assignment.title,
        course: assignment.course,
        studentName: assignment.student?.name || "Student",
        reviewStatus: assignment.reviewStatus,
        lastReviewedAt: assignment.lastReviewedAt,
        teacherReview: assignment.teacherReview,
        auditTrailCount: assignment.auditTrail.length,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while submitting teacher review.",
    });
  }
};

/**
 * PATCH /api/teacher/submissions/:id/findings/:findingId/decision
 * POST /api/teacher/submissions/:id/findings/:findingId/decision
 * Task 11: Accept / Reject individual finding.
 * Records individual review decision without deleting or mutating original AI evidence.
 */
export const submitFindingDecision = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can review findings.",
      });
    }

    const { id, findingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID format.",
      });
    }

    if (!findingId || typeof findingId !== "string" || !findingId.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid finding ID is required.",
      });
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment submission not found.",
      });
    }

    if (!verifyTeacherOwnership(assignment, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not have verified teacher ownership of this submission.",
      });
    }

    // Validate finding exists in the assignment
    if (!findingExistsInAssignment(assignment, findingId.trim())) {
      return res.status(400).json({
        success: false,
        message: `Finding ID '${findingId}' does not exist in this submission's evidence map.`,
      });
    }

    const { decision, notes = "" } = req.body || {};
    const validDecisions = ["Accepted", "Rejected", "Pending"];

    if (!decision || !validDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: `Invalid finding decision. Must be one of: ${validDecisions.join(", ")}`,
      });
    }

    const now = new Date();
    const cleanFindingId = findingId.trim();
    const cleanNotes = typeof notes === "string" ? notes.trim() : "";

    // Find existing review index
    const existingIndex = assignment.findingReviews.findIndex(
      (r) => r.findingId === cleanFindingId
    );
    const previousDecision =
      existingIndex >= 0 ? assignment.findingReviews[existingIndex].decision : "Pending";

    const findingReviewRecord = {
      findingId: cleanFindingId,
      decision,
      teacher: req.user.id,
      reviewedAt: now,
      notes: cleanNotes,
    };

    if (existingIndex >= 0) {
      assignment.findingReviews[existingIndex] = findingReviewRecord;
    } else {
      assignment.findingReviews.push(findingReviewRecord);
    }

    // Determine audit action
    let auditAction = "FINDING_DECISION_UPDATED";
    if (existingIndex < 0 || previousDecision === "Pending") {
      if (decision === "Accepted") {
        auditAction = "FINDING_ACCEPTED";
      } else if (decision === "Rejected") {
        auditAction = "FINDING_REJECTED";
      }
    } else {
      auditAction = "FINDING_DECISION_UPDATED";
    }

    assignment.auditTrail.push({
      submissionId: assignment._id,
      findingId: cleanFindingId,
      action: auditAction,
      previousValue: previousDecision,
      newValue: decision,
      teacher: req.user.id,
      teacherName: req.user.name || "Teacher",
      timestamp: now,
    });

    // Auto-progress from Pending to Under Review if review is underway
    if (
      assignment.reviewStatus === "Pending" ||
      assignment.reviewStatus === "Pending Review"
    ) {
      const prevStatus = assignment.reviewStatus;
      assignment.reviewStatus = "Under Review";
      assignment.auditTrail.push({
        submissionId: assignment._id,
        findingId: null,
        action: "REVIEW_STATUS_CHANGED",
        previousValue: prevStatus,
        newValue: "Under Review",
        teacher: req.user.id,
        teacherName: req.user.name || "Teacher",
        timestamp: now,
      });
    }

    assignment.lastReviewedAt = now;
    await assignment.save();

    return res.status(200).json({
      success: true,
      message: `Finding decision '${decision}' saved successfully.`,
      findingReview: findingReviewRecord,
      reviewStatus: assignment.reviewStatus,
      lastReviewedAt: assignment.lastReviewedAt,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while saving finding review decision.",
    });
  }
};

/**
 * POST /api/teacher/submissions/:id/comments
 * Task 12: Add overall or finding-specific teacher comment.
 */
export const addTeacherComment = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can add review comments.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID format.",
      });
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment submission not found.",
      });
    }

    if (!verifyTeacherOwnership(assignment, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not have verified teacher ownership of this submission.",
      });
    }

    const { text, findingId = null } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required and cannot be empty.",
      });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Comment text cannot exceed 2000 characters.",
      });
    }

    let cleanFindingId = null;
    if (findingId && typeof findingId === "string" && findingId.trim()) {
      cleanFindingId = findingId.trim();
      if (!findingExistsInAssignment(assignment, cleanFindingId)) {
        return res.status(400).json({
          success: false,
          message: `Referenced finding ID '${cleanFindingId}' does not exist in this submission.`,
        });
      }
    }

    const now = new Date();
    const commentRecord = {
      commentId: new mongoose.Types.ObjectId().toString(),
      teacher: req.user.id,
      teacherName: req.user.name || "Teacher",
      text: trimmedText,
      findingId: cleanFindingId,
      createdAt: now,
    };

    assignment.teacherComments.push(commentRecord);

    // Record audit trail
    assignment.auditTrail.push({
      submissionId: assignment._id,
      findingId: cleanFindingId,
      action: "TEACHER_COMMENT_ADDED",
      previousValue: null,
      newValue: trimmedText.slice(0, 100),
      teacher: req.user.id,
      teacherName: req.user.name || "Teacher",
      timestamp: now,
    });

    // Auto-progress from Pending to Under Review if review is underway
    if (
      assignment.reviewStatus === "Pending" ||
      assignment.reviewStatus === "Pending Review"
    ) {
      const prevStatus = assignment.reviewStatus;
      assignment.reviewStatus = "Under Review";
      assignment.auditTrail.push({
        submissionId: assignment._id,
        findingId: null,
        action: "REVIEW_STATUS_CHANGED",
        previousValue: prevStatus,
        newValue: "Under Review",
        teacher: req.user.id,
        teacherName: req.user.name || "Teacher",
        timestamp: now,
      });
    }

    assignment.lastReviewedAt = now;
    await assignment.save();

    return res.status(201).json({
      success: true,
      message: "Comment added successfully.",
      comment: commentRecord,
      comments: assignment.teacherComments,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while adding teacher comment.",
    });
  }
};

/**
 * GET /api/teacher/submissions/:id/comments
 * Task 12: List all comments for an assignment submission.
 */
export const getTeacherComments = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can view submission comments.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID format.",
      });
    }

    const assignment = await Assignment.findById(id).lean();
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment submission not found.",
      });
    }

    if (!verifyTeacherOwnership(assignment, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not have verified teacher ownership of this submission.",
      });
    }

    return res.status(200).json({
      success: true,
      count: assignment.teacherComments?.length || 0,
      comments: assignment.teacherComments || [],
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching teacher comments.",
    });
  }
};

/**
 * GET /api/teacher/submissions/:id/audit-trail
 * Task 13: Retrieve append-only review audit history for a submission.
 */
export const getTeacherAuditTrail = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can view submission audit trail.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID format.",
      });
    }

    const assignment = await Assignment.findById(id).lean();
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment submission not found.",
      });
    }

    if (!verifyTeacherOwnership(assignment, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not have verified teacher ownership of this submission.",
      });
    }

    return res.status(200).json({
      success: true,
      submissionId: assignment._id.toString(),
      count: assignment.auditTrail?.length || 0,
      auditTrail: assignment.auditTrail || [],
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching submission audit trail.",
    });
  }
};
