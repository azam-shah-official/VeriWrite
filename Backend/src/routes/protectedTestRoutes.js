import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Minimal role-protected test endpoint for STUDENT role only
router.get(
  "/student/protected-test",
  protect,
  authorizeRoles("STUDENT"),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Student protected endpoint accessed successfully.",
      user: req.user,
    });
  }
);

// Minimal role-protected test endpoint for TEACHER role only
router.get(
  "/teacher/protected-test",
  protect,
  authorizeRoles("TEACHER"),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Teacher protected endpoint accessed successfully.",
      user: req.user,
    });
  }
);

export default router;
