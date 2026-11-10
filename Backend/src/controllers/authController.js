import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendPasswordResetEmail } from "../utils/sendEmail.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = ["TEACHER", "STUDENT"];
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

export const register = async (req, res) => {
  try {
    const { name, email, password, role, institution } = req.body || {};

    // 1. Check required fields presence and non-empty strings
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password.trim() ||
      typeof role !== "string" ||
      !role.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and role are required.",
      });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toUpperCase();
    const trimmedInstitution =
      typeof institution === "string" ? institution.trim() : "";

    // 2. Validate email format
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // 3. Validate password length (minimum 8 characters)
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    // 4. Validate role strictly against TEACHER and STUDENT
    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Allowed roles are TEACHER and STUDENT.",
      });
    }

    // 5. Check if email is already registered
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email is already registered.",
      });
    }

    // 6. Create new user (User model pre-save hook hashes the password automatically)
    const newUser = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password,
      role: normalizedRole,
      institution: trimmedInstitution,
    });

    // 7. Return HTTP 201 without password
    return res.status(201).json({
      success: true,
      message: "Account registered successfully",
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        institution: newUser.institution || "",
      },
    });
  } catch (error) {
    // Handle race-condition duplicate key error from MongoDB unique index
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email is already registered.",
      });
    }

    // Handle Mongoose validation errors
    if (error && error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Invalid registration data.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error while registering account.",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body || {};

    // 1. Validate required fields
    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password.trim() ||
      typeof role !== "string" ||
      !role.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and role are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toUpperCase();

    // 2. Validate email format and allowed role values
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Allowed roles are TEACHER and STUDENT.",
      });
    }

    // 3. Ensure JWT_SECRET is configured in environment variables
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || !jwtSecret.trim()) {
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
    }

    // 4. Find user by email and explicitly include hidden password & lockout fields
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password +failedLoginAttempts +lockUntil"
    );

    // Do not reveal whether the email exists when credentials are invalid
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // 5. Check persistent MongoDB lockout state
    const now = new Date();
    if (user.lockUntil && user.lockUntil > now) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((user.lockUntil.getTime() - now.getTime()) / 60000)
      );
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
      });
    }

    // Reset expired lockout counter before evaluating new attempt
    if (user.lockUntil && user.lockUntil <= now) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    // 6. Compare password using the User model's comparePassword() method
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      user.failedLoginAttempts = attempts;

      if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await user.save({ validateBeforeSave: false });

        return res.status(423).json({
          success: false,
          message:
            "Account locked for 15 minutes due to 5 consecutive failed login attempts.",
        });
      }

      user.lockUntil = null;
      await user.save({ validateBeforeSave: false });

      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // 7. Verify selected role matches the user's registered role in MongoDB
    if (user.role !== normalizedRole) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This account is not registered as a ${normalizedRole}.`,
      });
    }

    // 8. Clear any prior failed login attempts upon successful authentication
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save({ validateBeforeSave: false });
    }

    // 9. Generate signed JWT token with 1 day expiry
    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: "1d" }
    );

    // 10. Return safe user object and token (never return password or hash)
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        institution: user.institution || "",
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while logging in.",
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Registered email is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+resetPasswordToken +resetPasswordExpires"
    );

    // Always return the same generic response when email is not registered
    if (!user) {
      return res.status(200).json({
        success: true,
        message: GENERIC_FORGOT_PASSWORD_MESSAGE,
      });
    }

    // Generate cryptographically secure random token (32 bytes = 64 hex chars)
    const rawResetToken = crypto.randomBytes(32).toString("hex");

    // Store only the SHA-256 hash of the token in MongoDB
    const hashedResetToken = crypto
      .createHash("sha256")
      .update(rawResetToken)
      .digest("hex");

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetToken: rawResetToken,
      });
    } catch (emailError) {
      // Roll back stored token if email delivery fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });

      if (emailError && emailError.code === "SMTP_NOT_CONFIGURED") {
        return res.status(503).json({
          success: false,
          message:
            "Email service is not configured on the server. Please configure SMTP environment variables.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to send password reset email at this time.",
      });
    }

    return res.status(200).json({
      success: true,
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing password reset request.",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params || {};
    const { password } = req.body || {};

    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required.",
      });
    }

    if (typeof password !== "string" || !password.trim()) {
      return res.status(400).json({
        success: false,
        message: "New password is required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long.",
      });
    }

    // Hash incoming token with SHA-256 to compare against stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token.trim())
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select(
      "+password +resetPasswordToken +resetPasswordExpires +failedLoginAttempts +lockUntil"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is invalid or has expired.",
      });
    }

    // Update password (User model pre-save hook will hash it once with bcrypt)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password has been reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    if (error && error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Invalid password.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error while resetting password.",
    });
  }
};

export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        institution: req.user.institution || "",
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching user profile.",
    });
  }
};

