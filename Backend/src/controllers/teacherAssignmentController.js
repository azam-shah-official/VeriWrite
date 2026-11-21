import mongoose from "mongoose";
import TeacherAssignment from "../models/TeacherAssignment.js";
import Subject from "../models/Subject.js";

/**
 * Robust helper to locate a subject owned by the authenticated teacher.
 * Priority hierarchy:
 * 1. Valid ObjectId lookup (highest priority) with strict teacher ownership check.
 * 2. Exact subject name / nameNormalized match within the teacher's active curriculum.
 * 3. Subject code match ONLY when it unambiguously identifies exactly one active subject for this teacher.
 *    If multiple active subjects share the same code, the lookup is rejected (returns null)
 *    to prevent arbitrary assignment binding.
 */
const findTeacherSubject = async (teacherId, subjectIdentifier) => {
  if (!subjectIdentifier) return null;
  const cleanId = String(subjectIdentifier).trim();
  if (!cleanId) return null;

  // 1. Highest Priority: Valid ObjectId lookup
  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    const directMatch = await Subject.findOne({
      _id: cleanId,
      teacher: teacherId,
      isActive: true,
    });
    if (directMatch) return directMatch;

    // Fallback findById with strict ownership validation
    const byId = await Subject.findById(cleanId);
    if (
      byId &&
      byId.isActive &&
      byId.teacher &&
      byId.teacher.toString() === teacherId.toString()
    ) {
      return byId;
    }
  }

  // 2. Next Priority: Exact subject name or normalized name matching
  const byName = await Subject.findOne({
    teacher: teacherId,
    isActive: true,
    $or: [
      { name: cleanId },
      { nameNormalized: cleanId.toLowerCase() },
    ],
  });
  if (byName) return byName;

  // 3. Lowest Priority: Unambiguous course code fallback
  // Find all active subjects owned by this teacher matching this code
  const codeMatches = await Subject.find({
    teacher: teacherId,
    isActive: true,
    code: cleanId.toUpperCase(),
  });

  // Only accept if exactly ONE active subject matches this code for this teacher
  if (codeMatches.length === 1) {
    return codeMatches[0];
  }

  // If multiple subjects match or zero match, return null (reject ambiguous lookup)
  return null;
};

/**
 * GET /api/teacher/assignments
 * Protected endpoint for TEACHER role only.
 * Lists all teacher-created assignment instructions for the authenticated teacher.
 */
export const getTeacherAssignments = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can view their created assignments.",
      });
    }

    const { status, subjectId } = req.query || {};

    const filter = { teacher: req.user.id };
    if (status && ["Active", "Archived", "Draft"].includes(status)) {
      filter.status = status;
    }
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      filter.subject = subjectId;
    }

    const assignments = await TeacherAssignment.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const formatted = assignments.map((a) => ({
      id: a._id.toString(),
      title: a.title,
      description: a.description || "",
      subjectId: a.subject?.toString() || "",
      subjectName: a.subjectName,
      subjectCode: a.subjectCode || "",
      deadline: a.deadline,
      institution: a.institution || "",
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      assignments: formatted,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching teacher assignments.",
    });
  }
};

/**
 * POST /api/teacher/assignments
 * Protected endpoint for TEACHER role only.
 * Creates a new teacher assignment instruction.
 */
export const createTeacherAssignment = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can create assignments.",
      });
    }

    const { title, description = "", subjectId, deadline = null } =
      req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assignment title is required.",
      });
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Assignment title must not exceed 150 characters.",
      });
    }

    const rawSubject = subjectId || req.body?.subject || req.body?.id;
    if (!rawSubject) {
      return res.status(400).json({
        success: false,
        message: "A valid subject selection is required.",
      });
    }

    // Verify subject belongs to this authenticated teacher
    const subject = await findTeacherSubject(req.user.id, rawSubject);

    if (!subject) {
      return res.status(400).json({
        success: false,
        message:
          "Selected subject not found in your curriculum. Please select a valid subject.",
      });
    }

    let parsedDeadline = null;
    if (deadline) {
      parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid deadline date format.",
        });
      }
    }

    const assignment = await TeacherAssignment.create({
      teacher: req.user.id,
      title: trimmedTitle,
      description: typeof description === "string" ? description.trim() : "",
      subject: subject._id,
      subjectName: subject.name,
      subjectCode: subject.code || "",
      deadline: parsedDeadline,
      institution: req.user.institution || "",
      status: "Active",
    });

    return res.status(201).json({
      success: true,
      message: "Assignment created successfully.",
      assignment: {
        id: assignment._id.toString(),
        title: assignment.title,
        description: assignment.description,
        subjectId: assignment.subject.toString(),
        subjectName: assignment.subjectName,
        subjectCode: assignment.subjectCode,
        deadline: assignment.deadline,
        institution: assignment.institution,
        status: assignment.status,
        createdAt: assignment.createdAt,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating teacher assignment.",
    });
  }
};

/**
 * GET /api/teacher/assignments/:id
 * Protected endpoint for TEACHER role only.
 * Gets details of a teacher-created assignment.
 */
export const getTeacherAssignmentById = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can view assignments.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID format.",
      });
    }

    const assignment = await TeacherAssignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    // Enforce teacher ownership
    if (assignment.teacher.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not own this assignment.",
      });
    }

    return res.status(200).json({
      success: true,
      assignment: {
        id: assignment._id.toString(),
        title: assignment.title,
        description: assignment.description,
        subjectId: assignment.subject.toString(),
        subjectName: assignment.subjectName,
        subjectCode: assignment.subjectCode,
        deadline: assignment.deadline,
        institution: assignment.institution,
        status: assignment.status,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching assignment.",
    });
  }
};

/**
 * PUT /api/teacher/assignments/:id
 * Protected endpoint for TEACHER role only.
 * Updates a teacher-created assignment.
 */
export const updateTeacherAssignment = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can update assignments.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID format.",
      });
    }

    const assignment = await TeacherAssignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    // Enforce teacher ownership
    if (assignment.teacher.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not own this assignment.",
      });
    }

    const { title, description, subjectId, deadline, status } = req.body || {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Assignment title cannot be empty.",
        });
      }
      assignment.title = title.trim();
    }

    if (description !== undefined) {
      assignment.description =
        typeof description === "string" ? description.trim() : "";
    }

    const rawSubject = subjectId !== undefined ? subjectId : req.body?.subject;
    if (rawSubject !== undefined) {
      const subject = await findTeacherSubject(req.user.id, rawSubject);

      if (!subject) {
        return res.status(400).json({
          success: false,
          message:
            "Selected subject not found in your curriculum. Please select a valid subject.",
        });
      }

      assignment.subject = subject._id;
      assignment.subjectName = subject.name;
      assignment.subjectCode = subject.code || "";
    }

    if (deadline !== undefined) {
      if (deadline === null || deadline === "") {
        assignment.deadline = null;
      } else {
        const parsed = new Date(deadline);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid deadline date format.",
          });
        }
        assignment.deadline = parsed;
      }
    }

    if (status !== undefined) {
      if (!["Active", "Archived", "Draft"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be Active, Archived, or Draft.",
        });
      }
      assignment.status = status;
    }

    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Assignment updated successfully.",
      assignment: {
        id: assignment._id.toString(),
        title: assignment.title,
        description: assignment.description,
        subjectId: assignment.subject.toString(),
        subjectName: assignment.subjectName,
        subjectCode: assignment.subjectCode,
        deadline: assignment.deadline,
        institution: assignment.institution,
        status: assignment.status,
        updatedAt: assignment.updatedAt,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating assignment.",
    });
  }
};

/**
 * DELETE /api/teacher/assignments/:id
 * Protected endpoint for TEACHER role only.
 * Deletes a teacher-created assignment.
 */
export const deleteTeacherAssignment = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "TEACHER" || !req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Only teachers can delete assignments.",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID format.",
      });
    }

    const assignment = await TeacherAssignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    // Enforce teacher ownership
    if (assignment.teacher.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not own this assignment.",
      });
    }

    await TeacherAssignment.deleteOne({ _id: assignment._id });

    return res.status(200).json({
      success: true,
      message: "Assignment deleted successfully.",
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting assignment.",
    });
  }
};
