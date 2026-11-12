import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { uploadSingleAssignmentFile } from "../middleware/uploadMiddleware.js";
import {
  uploadAssignment,
  getMyAssignments,
  analyzeAssignment,
} from "../controllers/assignmentController.js";

const router = express.Router();

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

export default router;
