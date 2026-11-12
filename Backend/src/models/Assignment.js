import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Assignment title is required"],
      trim: true,
      maxlength: [150, "Assignment title must not exceed 150 characters"],
    },
    course: {
      type: String,
      trim: true,
      maxlength: [100, "Course must not exceed 100 characters"],
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes must not exceed 500 characters"],
      default: "",
    },
    originalFileName: {
      type: String,
      required: [true, "Original file name is required"],
      trim: true,
    },
    storageKey: {
      type: String,
      required: [true, "Storage key is required"],
      unique: true,
      trim: true,
    },
    storagePath: {
      type: String,
      required: [true, "Storage path is required"],
      select: false,
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
      trim: true,
    },
    fileExtension: {
      type: String,
      required: [true, "File extension is required"],
      trim: true,
      lowercase: true,
    },
    fileCategory: {
      type: String,
      required: [true, "File category is required"],
      enum: {
        values: ["PDF", "DOCX", "TXT", "IMAGE"],
        message: "File category must be one of PDF, DOCX, TXT, or IMAGE",
      },
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be greater than 0"],
    },
    extractedText: {
      type: String,
      default: "",
      select: false,
    },
    extractionStatus: {
      type: String,
      enum: {
        values: [
          "Pending",
          "Processing",
          "Completed",
          "Failed",
          "NotSupported",
        ],
        message:
          "Extraction status must be one of Pending, Processing, Completed, Failed, or NotSupported",
      },
      default: "Pending",
    },
    extractionErrorCode: {
      type: String,
      default: null,
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    characterCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    characterCountWithoutSpaces: {
      type: Number,
      default: 0,
      min: 0,
    },
    paragraphCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    readingTimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    analysisStatus: {
      type: String,
      enum: {
        values: ["Pending", "Processing", "Completed", "Failed"],
        message:
          "Analysis status must be one of Pending, Processing, Completed, or Failed",
      },
      default: "Pending",
    },
    reviewStatus: {
      type: String,
      enum: {
        values: ["Pending", "Needs Human Review", "Completed"],
        message:
          "Review status must be one of Pending, Needs Human Review, or Completed",
      },
      default: "Pending",
    },
    summaryNote: {
      type: String,
      trim: true,
      default: "Submission received and queued for writing analysis.",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.storagePath;
        delete ret.extractedText;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret.storagePath;
        delete ret.extractedText;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Assignment =
  mongoose.models.Assignment ||
  mongoose.model("Assignment", assignmentSchema);

export default Assignment;
