import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Teacher reference is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
      maxlength: [100, "Subject name must not exceed 100 characters"],
    },
    nameNormalized: {
      type: String,
      lowercase: true,
      trim: true,
      required: true,
    },
    code: {
      type: String,
      trim: true,
      maxlength: [30, "Course code must not exceed 30 characters"],
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description must not exceed 500 characters"],
      default: "",
    },
    institution: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring a teacher cannot have duplicate active subject names
subjectSchema.index(
  { teacher: 1, nameNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

subjectSchema.pre("validate", function () {
  if (this.name) {
    this.nameNormalized = this.name.trim().toLowerCase();
  }
});

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;
