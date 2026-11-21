import express from "express";
import {
  register,
  login,
  forgotPassword,
  openResetPasswordLink,
  resetPassword,
  getMe,
  updateProfile,
} from "../controllers/authController.js";
import { forgotPasswordRateLimiter } from "../middleware/rateLimitMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.get("/reset-password-link/:token", openResetPasswordLink);
router.post("/reset-password/:token", resetPassword);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.patch("/profile", protect, updateProfile);
router.put("/me", protect, updateProfile);
router.patch("/me", protect, updateProfile);

export default router;
