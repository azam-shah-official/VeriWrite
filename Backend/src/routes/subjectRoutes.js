import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getMySubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getTeacherSubjects,
} from "../controllers/subjectController.js";

const router = express.Router();

// Teacher subject management
router.get("/my", protect, authorizeRoles("TEACHER"), getMySubjects);
router.post("/", protect, authorizeRoles("TEACHER"), createSubject);
router.put("/:id", protect, authorizeRoles("TEACHER"), updateSubject);
router.delete("/:id", protect, authorizeRoles("TEACHER"), deleteSubject);

// Public/Student lookup of a teacher's subjects
router.get("/teacher/:teacherId", protect, getTeacherSubjects);

export default router;
