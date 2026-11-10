import express from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
} from "../controllers/authController.js";
import { forgotPasswordRateLimiter } from "../middleware/rateLimitMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/me", protect, getMe);

export default router;
