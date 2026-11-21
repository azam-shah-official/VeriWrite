import mongoose from "mongoose";
import Subject from "../models/Subject.js";
import TeacherAssignment from "../models/TeacherAssignment.js";

/**
 * GET /api/subjects/my
 * Protected endpoint for TEACHER role only.
 * Returns all active subjects created by the authenticated teacher.
 */
export const getMySubjects = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can manage their subjects.",
      });
    }

    const subjects = await Subject.find({
      teacher: req.user.id,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    const formatted = subjects.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      code: s.code || "",
      description: s.description || "",
      institution: s.institution || "",
      createdAt: s.createdAt,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      subjects: formatted,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching subjects.",
    });
  }
};

/**
 * POST /api/subjects
 * Protected endpoint for TEACHER role only.
 * Creates a new subject owned by the authenticated teacher.
 */
export const createSubject = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can create subjects.",
      });
    }

    const { name, code = "", description = "" } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject name is required.",
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Subject name must not exceed 100 characters.",
      });
    }

    const nameNormalized = trimmedName.toLowerCase();

    // Check for duplicate active subject for this teacher
    const existing = await Subject.findOne({
      teacher: req.user.id,
      nameNormalized,
      isActive: true,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A subject with this name already exists in your curriculum.",
      });
    }

    const subject = await Subject.create({
      teacher: req.user.id,
      name: trimmedName,
      nameNormalized,
      code: typeof code === "string" ? code.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      institution: req.user.institution || "",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Subject created successfully.",
      subject: {
        id: subject._id.toString(),
        name: subject.name,
        code: subject.code,
        description: subject.description,
        institution: subject.institution,
        createdAt: subject.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A subject with this name already exists in your curriculum.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating subject.",
    });
  }
};

/**
 * PUT /api/subjects/:id
 * Protected endpoint for TEACHER role only.
 * Updates an existing subject owned by the authenticated teacher.
 */
export const updateSubject = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can update subjects.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subject ID format.",
      });
    }

    const subject = await Subject.findById(id);
    if (!subject || !subject.isActive) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    // Enforce teacher ownership
    if (subject.teacher.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not own this subject.",
      });
    }

    const { name, code, description } = req.body || {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Subject name cannot be empty.",
        });
      }
      const trimmedName = name.trim();
      const nameNormalized = trimmedName.toLowerCase();

      // Check duplicate
      const duplicate = await Subject.findOne({
        teacher: req.user.id,
        nameNormalized,
        isActive: true,
        _id: { $ne: subject._id },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Another subject with this name already exists in your curriculum.",
        });
      }

      subject.name = trimmedName;
      subject.nameNormalized = nameNormalized;
    }

    if (code !== undefined) {
      subject.code = typeof code === "string" ? code.trim() : "";
    }

    if (description !== undefined) {
      subject.description = typeof description === "string" ? description.trim() : "";
    }

    await subject.save();

    // Synchronize denormalized snapshots in TeacherAssignment records
    if (name !== undefined || code !== undefined) {
      await TeacherAssignment.updateMany(
        { subject: subject._id },
        { $set: { subjectName: subject.name, subjectCode: subject.code } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Subject updated successfully.",
      subject: {
        id: subject._id.toString(),
        name: subject.name,
        code: subject.code,
        description: subject.description,
        institution: subject.institution,
        updatedAt: subject.updatedAt,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating subject.",
    });
  }
};

/**
 * DELETE /api/subjects/:id
 * Protected endpoint for TEACHER role only.
 * Safely deactivates a subject owned by the authenticated teacher.
 */
export const deleteSubject = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can delete subjects.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subject ID format.",
      });
    }

    const subject = await Subject.findById(id);
    if (!subject || !subject.isActive) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    // Enforce teacher ownership
    if (subject.teacher.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not own this subject.",
      });
    }

    subject.isActive = false;
    await subject.save();

    return res.status(200).json({
      success: true,
      message: "Subject removed successfully.",
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting subject.",
    });
  }
};

/**
 * GET /api/subjects/teacher/:teacherId
 * Protected endpoint for authenticated users.
 * Returns active subjects taught by a specific teacher.
 * Used by students during assignment upload to select teacher-specific subjects.
 */
export const getTeacherSubjects = async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher ID format.",
      });
    }

    const subjects = await Subject.find({
      teacher: teacherId,
      isActive: true,
    })
      .select("_id name code description")
      .sort({ name: 1 })
      .lean();

    const formatted = subjects.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      code: s.code || "",
      description: s.description || "",
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      subjects: formatted,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching teacher subjects.",
    });
  }
};
