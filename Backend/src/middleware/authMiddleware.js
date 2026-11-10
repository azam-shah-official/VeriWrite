import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * JWT Authentication Middleware
 * Verifies Authorization: Bearer <token>, checks that the user still exists in MongoDB,
 * and attaches the verified user's safe identity and role to req.user.
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization || "";

    if (
      typeof authHeader !== "string" ||
      !authHeader.toLowerCase().startsWith("bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid Bearer token.",
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Token is missing.",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || !jwtSecret.trim()) {
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (_jwtError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token payload.",
      });
    }

    // Verify that the user still exists in MongoDB and retrieve only safe fields
    const user = await User.findById(decoded.id)
      .select("_id name email role institution")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "The account associated with this token no longer exists.",
      });
    }

    // Attach verified database identity and role to req.user
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      institution: user.institution || "",
    };

    return next();
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * Uses only the database-verified role on req.user.role.
 * Never trusts role values sent from the frontend request body, query, or headers.
 */
export const authorizeRoles = (...allowedRoles) => {
  const normalizedAllowed = allowedRoles.map((role) =>
    String(role).trim().toUpperCase()
  );

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const userRole = String(req.user.role).trim().toUpperCase();

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden. Role '${userRole}' is not authorized to access this resource.`,
      });
    }

    return next();
  };
};
