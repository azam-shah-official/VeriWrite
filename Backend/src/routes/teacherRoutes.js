import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getTeacherAssignments,
  createTeacherAssignment,
  getTeacherAssignmentById,
  updateTeacherAssignment,
  deleteTeacherAssignment,
} from "../controllers/teacherAssignmentController.js";
import {
  getTeacherDashboardStats,
  getTeacherSubmissions,
  submitTeacherReview,
  submitFindingDecision,
  addTeacherComment,
  getTeacherComments,
  getTeacherAuditTrail,
} from "../controllers/teacherSubmissionController.js";

const router = express.Router();

// All teacher routes require authentication and TEACHER role
router.use(protect, authorizeRoles("TEACHER"));

// Teacher Dashboard statistics
router.get("/dashboard/stats", getTeacherDashboardStats);

// Student Submissions assigned to this teacher
router.get("/submissions", getTeacherSubmissions);
router.patch("/submissions/:id/review", submitTeacherReview);

// Task 11: Accept / Reject Finding decisions
router.patch("/submissions/:id/findings/:findingId/decision", submitFindingDecision);
router.post("/submissions/:id/findings/:findingId/decision", submitFindingDecision);

// Task 12: Teacher comments
router.post("/submissions/:id/comments", addTeacherComment);
router.get("/submissions/:id/comments", getTeacherComments);

// Task 13: Review Audit Trail
router.get("/submissions/:id/audit-trail", getTeacherAuditTrail);

// Teacher-created assignment instructions
router.get("/assignments", getTeacherAssignments);
router.post("/assignments", createTeacherAssignment);
router.get("/assignments/:id", getTeacherAssignmentById);
router.put("/assignments/:id", updateTeacherAssignment);
router.delete("/assignments/:id", deleteTeacherAssignment);

export default router;
