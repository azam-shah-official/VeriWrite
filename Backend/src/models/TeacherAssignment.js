import mongoose from "mongoose";

const teacherAssignmentSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Teacher reference is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Assignment title is required"],
      trim: true,
      maxlength: [150, "Assignment title must not exceed 150 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description must not exceed 2000 characters"],
      default: "",
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject reference is required"],
      index: true,
    },
    subjectName: {
      type: String,
      required: [true, "Subject name snapshot is required"],
      trim: true,
    },
    subjectCode: {
      type: String,
      trim: true,
      default: "",
    },
    deadline: {
      type: Date,
      default: null,
    },
    institution: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: {
        values: ["Active", "Archived", "Draft"],
        message: "Status must be Active, Archived, or Draft",
      },
      default: "Active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const TeacherAssignment = mongoose.model(
  "TeacherAssignment",
  teacherAssignmentSchema
);

export default TeacherAssignment;
