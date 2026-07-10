// const mongoose = require("mongoose");

// const assessmentResponseSchema = new mongoose.Schema(
//   {
//     assessmentId: { type: String, required: true, index: true },
//     userId: { type: String, required: true, index: true },
//     sessionId: { type: String, required: true, index: true },
//     assessmentType: {
//       type: String,
//       enum: ["mcq", "coding", "typing"],
//       required: true,
//       index: true,
//     },

//     // MCQ
//     mcqResponses: [
//       {
//         questionId: String,
//         questionText: String,
//         selectedOption: String,
//         correctOption: String,
//         isCorrect: Boolean,
//         responseTimeMs: Number,
//       },
//     ],

//     // Coding
//     codingResponses: [
//       {
//         questionNumber: { type: Number, enum: [1, 2] }, // 1 = independent, 2 = transcription
//         prompt: String,
//         providedSolution: String, // only set for question 2
//         submittedCode: String,
//         language: { type: String, default: "javascript" },
//         responseTimeMs: Number,
//         backspaceCount: Number,
//         correctionCount: Number,
//         copyPasteAttempts: Number,
//         matchesProvidedSolution: Boolean, // for question 2 integrity check
//       },
//     ],

//     // Typing
//     typingResponses: [
//       {
//         taskNumber: { type: Number, enum: [1, 2] }, // 1 = plain paragraph, 2 = numeric/symbol heavy
//         sourceText: String,
//         typedText: String,
//         wpm: Number,
//         accuracy: Number,
//         responseTimeMs: Number,
//       },
//     ],
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("AssessmentResponse", assessmentResponseSchema);

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
    //
    // questionNumber is intentionally NOT restricted to a fixed enum.
    // The coding assessment previously always submitted exactly two
    // entries (1 = independent problem, 2 = transcription task), which is
    // why this used to be `enum: [1, 2]`. The assessment now presents
    // three independent problems (no transcription task), so
    // questionNumber can be 1, 2, or 3 depending on which/how many
    // questions are configured on the frontend. Hardcoding an enum here
    // ties this schema to one specific question-count decision made in
    // the UI; leaving it as a plain Number lets the frontend's question
    // bank change size again in the future (see the "Question bank"
    // known limitation) without requiring a matching backend/schema
    // change every time.
    codingResponses: [
      {
        questionNumber: { type: Number },
        prompt: String,
        // Legacy field from the old transcription-task question (2 of 2).
        // No longer populated by the current three-question assessment,
        // but left in the schema (rather than removed) so historical
        // documents that do have it keep validating and exporting
        // unchanged. Mongoose fields with no `required` constraint are
        // harmless to leave unset going forward.
        providedSolution: String,
        submittedCode: String,
        language: { type: String, default: "javascript" },
        responseTimeMs: Number,
        backspaceCount: Number,
        correctionCount: Number,
        copyPasteAttempts: Number,
        // Legacy field: was the integrity check for the old transcription
        // task ("did the typed text match the provided solution exactly").
        // Not applicable to the current three independent-problem
        // questions, so it will simply be absent/undefined on new
        // documents. Left in place for the same backward-compatibility
        // reason as providedSolution above.
        matchesProvidedSolution: Boolean,
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
