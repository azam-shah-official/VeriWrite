import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
  {
    snippet: {
      type: String,
      required: [true, "Evidence snippet is required"],
      trim: true,
      maxlength: [1000, "Evidence snippet must not exceed 1000 characters"],
    },
    paragraphIndex: {
      type: Number,
      required: [true, "Paragraph index is required"],
      min: [0, "Paragraph index must be non-negative"],
    },
    sentenceIndex: {
      type: Number,
      default: null,
      min: [0, "Sentence index must be non-negative"],
    },
    charStart: {
      type: Number,
      default: null,
      validate: {
        validator: function (val) {
          if (val === null || val === undefined) {
            return this.charEnd === null || this.charEnd === undefined;
          }
          if (!Number.isInteger(val) || val < 0) return false;
          if (typeof this.charEnd === "number" && this.charEnd !== null) {
            return val < this.charEnd;
          }
          return true;
        },
        message:
          "charStart must be a non-negative integer strictly less than charEnd",
      },
    },
    charEnd: {
      type: Number,
      default: null,
      validate: {
        validator: function (val) {
          if (val === null || val === undefined) {
            return this.charStart === null || this.charStart === undefined;
          }
          if (!Number.isInteger(val) || val <= 0) return false;
          if (typeof this.charStart === "number" && this.charStart !== null) {
            return val > this.charStart;
          }
          return true;
        },
        message:
          "charEnd must be a positive integer strictly greater than charStart",
      },
    },
    flagReason: {
      type: String,
      required: [true, "Flag reason is required"],
      trim: true,
      maxlength: [500, "Flag reason must not exceed 500 characters"],
    },
  },
  { _id: false }
);

const writingIndicatorSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Indicator code is required"],
      trim: true,
      enum: {
        values: [
          "UNIFORM_SENTENCE_CADENCE",
          "LOW_LEXICAL_DIVERSITY",
          "ELEVATED_TRANSITION_DENSITY",
          "REPETITIVE_SYNTACTIC_STARTERS",
          "FORMULAIC_PHRASE_USAGE",
          "HIGH_PREDICTABILITY_PASSAGES",
          "PERPLEXITY_ANOMALY",
        ],
        message: "Invalid indicator code: {VALUE}",
      },
    },
    label: {
      type: String,
      required: [true, "Indicator label is required"],
      trim: true,
      maxlength: [100, "Indicator label must not exceed 100 characters"],
    },
    severity: {
      type: String,
      required: [true, "Indicator severity is required"],
      enum: {
        values: ["Low", "Medium", "High"],
        message: "Indicator severity must be Low, Medium, or High",
      },
    },
    explanation: {
      type: String,
      required: [true, "Indicator explanation is required"],
      trim: true,
      maxlength: [600, "Indicator explanation must not exceed 600 characters"],
    },
    evidence: {
      type: [evidenceSchema],
      default: [],
    },
  },
  { _id: false }
);

const analysisResultSchema = new mongoose.Schema(
  {
    engineVersion: {
      type: String,
      trim: true,
      default: "1.0.0-stylometrics",
    },
    analyzedAt: {
      type: Date,
      default: null,
    },
    executionTimeMs: {
      type: Number,
      default: 0,
      min: [0, "Execution time cannot be negative"],
    },
    signalLevel: {
      type: String,
      enum: {
        values: [
          "Natural Variation",
          "Moderate Uniformity",
          "High Uniformity",
          "Inconclusive",
        ],
        message: "Invalid signal level: {VALUE}",
      },
      default: "Inconclusive",
    },
    analysisConfidence: {
      type: String,
      enum: {
        values: ["Low", "Medium", "High"],
        message: "Analysis confidence must be Low, Medium, or High",
      },
      default: "Low",
    },
    metrics: {
      burstinessScore: { type: Number, default: 0, min: 0 },
      lexicalDiversity: { type: Number, default: 0, min: 0, max: 1 },
      sentenceLengthVariance: { type: Number, default: 0, min: 0 },
      transitionDensityScore: { type: Number, default: 0, min: 0 },
      totalSentencesAnalyzed: { type: Number, default: 0, min: 0 },
      totalParagraphsAnalyzed: { type: Number, default: 0, min: 0 },
    },
    indicators: {
      type: [writingIndicatorSchema],
      default: [],
    },
    limitations: {
      type: [String],
      default: [
        "Stylometric indicators are probabilistic signals and do not constitute proof of AI generation.",
        "Short texts (< 150 words) have low statistical reliability.",
        "Non-native English (ESL) and technical academic writing naturally exhibit elevated uniformity.",
        "Teacher contextual review is required before drawing academic conclusions.",
      ],
    },
    runCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const teacherReviewSchema = new mongoose.Schema(
  {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    verdict: {
      type: String,
      enum: {
        values: [
          "Pending",
          "Authentic Authorship Confirmed",
          "Discussed with Student",
          "Revision Requested",
          "Misconduct Investigation",
        ],
        message: "Invalid teacher review verdict: {VALUE}",
      },
      default: "Pending",
    },
    feedbackNotes: {
      type: String,
      trim: true,
      maxlength: [1000, "Feedback notes must not exceed 1000 characters"],
      default: "",
    },
    isSharedWithStudent: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

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
    analysisResult: {
      type: analysisResultSchema,
      default: null,
    },
    teacherReview: {
      type: teacherReviewSchema,
      default: () => ({
        reviewedBy: null,
        reviewedAt: null,
        verdict: "Pending",
        feedbackNotes: "",
        isSharedWithStudent: false,
      }),
    },
    analysisLockToken: {
      type: String,
      default: null,
    },
    analysisLockAcquiredAt: {
      type: Date,
      default: null,
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
