import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { uploadSingleAssignmentFile } from "../middleware/uploadMiddleware.js";
import {
  uploadAssignment,
  getMyAssignments,
  analyzeAssignment,
  getAssignmentEvidence,
  getInstituteTeachers,
  getAssignmentReviewStatus,
  getAssignmentComments,
  getAssignmentAuditTrail,
} from "../controllers/assignmentController.js";

const router = express.Router();

// GET /api/assignments/teachers - Authenticated STUDENT only (fetches registered teachers from student's institute)
router.get("/teachers", protect, authorizeRoles("STUDENT"), getInstituteTeachers);

// GET /api/assignments/my - Authenticated STUDENT only (fetches student's own assignments)
router.get("/my", protect, authorizeRoles("STUDENT"), getMyAssignments);

// POST /api/assignments/upload - Authenticated STUDENT only
router.post(
  "/upload",
  protect,
  authorizeRoles("STUDENT"),
  uploadSingleAssignmentFile,
  uploadAssignment
);

// POST /api/assignments/:id/analyze - Authenticated STUDENT only
router.post(
  "/:id/analyze",
  protect,
  authorizeRoles("STUDENT"),
  analyzeAssignment
);

// GET /api/assignments/:id/evidence - Authenticated users (student owner or teacher)
router.get(
  "/:id/evidence",
  protect,
  getAssignmentEvidence
);

// Task 14: Review Status & Progress (student owner or assigned teacher)
router.get(
  "/:id/review-status",
  protect,
  getAssignmentReviewStatus
);

// Task 12: Comments & Feedback (student owner or assigned teacher)
router.get(
  "/:id/comments",
  protect,
  getAssignmentComments
);

// Task 13: Audit Trail & History (student owner or assigned teacher)
router.get(
  "/:id/audit-trail",
  protect,
  getAssignmentAuditTrail
);

export default router;
