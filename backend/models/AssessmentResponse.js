const mongoose = require("mongoose");

const assessmentResponseSchema = new mongoose.Schema(
  {
    assessmentId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    assessmentType: {
      type: String,
      enum: ["mcq", "coding", "typing"],
      required: true,
      index: true,
    },

    // MCQ
    mcqResponses: [
      {
        questionId: String,
        questionText: String,
        selectedOption: String,
        correctOption: String,
        isCorrect: Boolean,
        responseTimeMs: Number,
      },
    ],

    // Coding
    codingResponses: [
      {
        questionNumber: { type: Number, enum: [1, 2] }, // 1 = independent, 2 = transcription
        prompt: String,
        providedSolution: String, // only set for question 2
        submittedCode: String,
        language: { type: String, default: "javascript" },
        responseTimeMs: Number,
        backspaceCount: Number,
        correctionCount: Number,
        copyPasteAttempts: Number,
        matchesProvidedSolution: Boolean, // for question 2 integrity check
      },
    ],

    // Typing
    typingResponses: [
      {
        taskNumber: { type: Number, enum: [1, 2] }, // 1 = plain paragraph, 2 = numeric/symbol heavy
        sourceText: String,
        typedText: String,
        wpm: Number,
        accuracy: Number,
        responseTimeMs: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("AssessmentResponse", assessmentResponseSchema);
