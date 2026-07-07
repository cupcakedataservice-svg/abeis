// const mongoose = require("mongoose");

// const webcamFeaturesSchema = new mongoose.Schema(
//   {
//     blinkRate: Number,
//     blinkCount: Number,
//     screenAttention: Number,
//     lookAwayCount: Number,
//     averagePitch: Number,
//     averageYaw: Number,
//     averageRoll: Number,
//     headMovementVariance: Number,
//     faceVisiblePercentage: Number,
//     eyeClosureRate: Number,
//   },
//   { _id: false }
// );

// const screenFeaturesSchema = new mongoose.Schema(
//   {
//     cursorSpeed: Number,
//     cursorAcceleration: Number,
//     cursorSmoothness: Number,
//     scrollFrequency: Number,
//     scrollSpeed: Number,
//     idleDuration: Number,
//     focusChanges: Number,
//   },
//   { _id: false }
// );

// const ExtractedBehaviorFeatureSchema = new mongoose.Schema(
//   {
//     assessmentId: { type: String, required: true, unique: true, index: true },
//     userId: { type: String, required: true, index: true },
//     sessionId: { type: String, required: true, index: true },
//     assessmentType: {
//       type: String,
//       enum: ["mcq", "coding", "typing"],
//       required: true,
//     },

//     webcamFeatures: webcamFeaturesSchema,
//     screenFeatures: screenFeaturesSchema,

//     // Processing/job bookkeeping — separate from the ML output above so the
//     // pipeline can report status without polluting the feature vector.
//     status: {
//       type: String,
//       enum: ["pending", "processing", "completed", "failed"],
//       default: "pending",
//       index: true,
//     },
//     attempts: { type: Number, default: 0 },
//     lastError: { type: String, default: null },

//     metadata: {
//       processedAt: Date,
//       modelVersion: { type: String, default: "v1.0" },
//       webcamDiagnostics: mongoose.Schema.Types.Mixed,
//       screenDiagnostics: mongoose.Schema.Types.Mixed,
//     },
//   },
//   { timestamps: true, collection: "ExtractedBehaviorFeatures" }
// );

// module.exports = mongoose.model(
//   "ExtractedBehaviorFeature",
//   ExtractedBehaviorFeatureSchema
// );

// const mongoose = require("mongoose");

// // v2 upgrade: added the fields listed in config/featureSchema.js's
// // WEBCAM_FIELDS/SCREEN_FIELDS. Every new field defaults to `null` and none
// // are `required`, so documents written by the pre-upgrade pipeline continue
// // to load and query normally — no migration script needed. (Note: Mongoose
// // schema `default` only applies when a document is created/re-saved
// // through a full Mongoose document, NOT to `.lean()` reads of pre-existing
// // documents that simply lack the field — see services/exportService.js's
// // use of config/featureSchema.js's normalizeFeatureObject() for how reads
// // are made consistent regardless.)
// const webcamFeaturesSchema = new mongoose.Schema(
//   {
//     // --- v1 ---
//     blinkRate: { type: Number, default: null },
//     blinkCount: { type: Number, default: null },
//     screenAttention: { type: Number, default: null },
//     lookAwayCount: { type: Number, default: null },
//     averagePitch: { type: Number, default: null },
//     averageYaw: { type: Number, default: null },
//     averageRoll: { type: Number, default: null },
//     headMovementVariance: { type: Number, default: null },
//     faceVisiblePercentage: { type: Number, default: null },
//     eyeClosureRate: { type: Number, default: null },

//     // --- v2: Face detection ---
//     averageFaceConfidence: { type: Number, default: null },
//     continuousFaceLossCount: { type: Number, default: null },
//     maximumFaceLossDuration: { type: Number, default: null },

//     // --- v2: Blink behaviour ---
//     averageBlinkDuration: { type: Number, default: null },
//     maximumBlinkDuration: { type: Number, default: null },
//     blinkIntervalVariance: { type: Number, default: null },

//     // --- v2: Eye gaze ---
//     screenAttentionPercentage: { type: Number, default: null },
//     averageLookAwayDuration: { type: Number, default: null },
//     maximumLookAwayDuration: { type: Number, default: null },

//     // --- v2: Head pose ---
//     pitchStdDeviation: { type: Number, default: null },
//     yawStdDeviation: { type: Number, default: null },
//     rollStdDeviation: { type: Number, default: null },
//     averageHeadSpeed: { type: Number, default: null },
//     maximumHeadSpeed: { type: Number, default: null },
//   },
//   { _id: false, strict: false } // strict:false lets forward/unknown fields pass through untouched
// );

// const screenFeaturesSchema = new mongoose.Schema(
//   {
//     // --- v1 ---
//     cursorSpeed: { type: Number, default: null },
//     cursorAcceleration: { type: Number, default: null },
//     cursorSmoothness: { type: Number, default: null },
//     scrollFrequency: { type: Number, default: null },
//     scrollSpeed: { type: Number, default: null },
//     idleDuration: { type: Number, default: null },
//     focusChanges: { type: Number, default: null },

//     // --- v2: Mouse behaviour ---
//     mouseStopCount: { type: Number, default: null },
//     averageMouseStopDuration: { type: Number, default: null },
//     mousePathCurvature: { type: Number, default: null },
//     cursorJitter: { type: Number, default: null },

//     // --- v2: Scroll behaviour ---
//     scrollBurstCount: { type: Number, default: null },
//     averageScrollBurstDuration: { type: Number, default: null },

//     // --- v2: Idle behaviour ---
//     idleEventCount: { type: Number, default: null },
//     maximumIdleDuration: { type: Number, default: null },

//     // --- v2: Activity density ---
//     mouseEventsPerSecond: { type: Number, default: null },
//     scrollEventsPerSecond: { type: Number, default: null },
//     activityDensity: { type: Number, default: null },
//   },
//   { _id: false, strict: false }
// );

// const ExtractedBehaviorFeatureSchema = new mongoose.Schema(
//   {
//     assessmentId: { type: String, required: true, unique: true, index: true },
//     userId: { type: String, required: true, index: true },
//     sessionId: { type: String, required: true, index: true },
//     assessmentType: {
//       type: String,
//       enum: ["mcq", "coding", "typing"],
//       required: true,
//     },

//     webcamFeatures: webcamFeaturesSchema,
//     screenFeatures: screenFeaturesSchema,

//     // Processing/job bookkeeping — separate from the ML output above so the
//     // pipeline can report status without polluting the feature vector.
//     status: {
//       type: String,
//       enum: ["pending", "processing", "completed", "failed"],
//       default: "pending",
//       index: true,
//     },
//     attempts: { type: Number, default: 0 },
//     lastError: { type: String, default: null },

//     metadata: {
//       processedAt: Date,
//       modelVersion: { type: String, default: "v1.0" },
//       webcamDiagnostics: mongoose.Schema.Types.Mixed,
//       screenDiagnostics: mongoose.Schema.Types.Mixed,
//     },
//   },
//   { timestamps: true, collection: "ExtractedBehaviorFeatures" }
// );

// module.exports = mongoose.model(
//   "ExtractedBehaviorFeature",
//   ExtractedBehaviorFeatureSchema
// );

const mongoose = require("mongoose");

// Nested sub-schemas for the two v3 object-typed webcam fields. Kept as
// their own schema definitions (rather than mongoose.Schema.Types.Mixed)
// so each has real, typed sub-fields — but `default: null` is set on the
// *parent* path in webcamFeaturesSchema below, not here, since Mongoose
// nested-schema defaults apply per sub-field, and we want "the whole
// object is null" as the missing-data state, not "{x: null, y: null, ...}".
const boundingBoxSchema = new mongoose.Schema(
  {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
  },
  { _id: false }
);

const pointSchema = new mongoose.Schema(
  {
    x: Number,
    y: Number,
  },
  { _id: false }
);

// v3 upgrade: added numberOfFaces / faceBoundingBox / averageFaceSize /
// averageFacePosition / faceDisappearanceDuration / the four looking*
// duration+percentage fields — see config/featureSchema.js's WEBCAM_FIELDS
// for the canonical list these correspond to. Every new field defaults to
// `null` and none are `required`, so documents written by the pre-v3
// pipeline continue to load and query normally — no migration script
// needed. (Note: Mongoose schema `default` only applies when a document is
// created/re-saved through a full Mongoose document, NOT to `.lean()`
// reads of pre-existing documents that simply lack the field — see
// services/exportService.js's use of config/featureSchema.js's
// normalizeFeatureObject() for how reads are made consistent regardless.)
const webcamFeaturesSchema = new mongoose.Schema(
  {
    // --- v1 ---
    blinkRate: { type: Number, default: null },
    blinkCount: { type: Number, default: null },
    screenAttention: { type: Number, default: null },
    lookAwayCount: { type: Number, default: null },
    averagePitch: { type: Number, default: null },
    averageYaw: { type: Number, default: null },
    averageRoll: { type: Number, default: null },
    headMovementVariance: { type: Number, default: null },
    faceVisiblePercentage: { type: Number, default: null },
    eyeClosureRate: { type: Number, default: null },

    // --- v2: Face detection ---
    averageFaceConfidence: { type: Number, default: null },
    continuousFaceLossCount: { type: Number, default: null },
    maximumFaceLossDuration: { type: Number, default: null },

    // --- v2: Blink behaviour ---
    averageBlinkDuration: { type: Number, default: null },
    maximumBlinkDuration: { type: Number, default: null },
    blinkIntervalVariance: { type: Number, default: null },

    // --- v2: Eye gaze ---
    screenAttentionPercentage: { type: Number, default: null },
    averageLookAwayDuration: { type: Number, default: null },
    maximumLookAwayDuration: { type: Number, default: null },

    // --- v2: Head pose ---
    pitchStdDeviation: { type: Number, default: null },
    yawStdDeviation: { type: Number, default: null },
    rollStdDeviation: { type: Number, default: null },
    averageHeadSpeed: { type: Number, default: null },
    maximumHeadSpeed: { type: Number, default: null },

    // --- v3: Multi-face detection ---
    numberOfFaces: { type: Number, default: null },

    // --- v3: Face framing (nested-object fields — first non-scalar
    // webcam features; see boundingBoxSchema/pointSchema above) ---
    faceBoundingBox: { type: boundingBoxSchema, default: null },
    averageFaceSize: { type: Number, default: null },
    averageFacePosition: { type: pointSchema, default: null },

    // --- v3: Face absence (cumulative total, distinct from the v2
    // maximumFaceLossDuration which is only the single longest run) ---
    faceDisappearanceDuration: { type: Number, default: null },

    // --- v3: Gaze direction — durations (seconds) ---
    lookingLeftDuration: { type: Number, default: null },
    lookingRightDuration: { type: Number, default: null },
    lookingUpDuration: { type: Number, default: null },
    lookingDownDuration: { type: Number, default: null },

    // --- v3: Gaze direction — percentages (of processed frames) ---
    lookingLeftPercentage: { type: Number, default: null },
    lookingRightPercentage: { type: Number, default: null },
    lookingUpPercentage: { type: Number, default: null },
    lookingDownPercentage: { type: Number, default: null },
  },
  { _id: false, strict: false } // strict:false lets forward/unknown fields pass through untouched
);

const screenFeaturesSchema = new mongoose.Schema(
  {
    // --- v1 ---
    cursorSpeed: { type: Number, default: null },
    cursorAcceleration: { type: Number, default: null },
    cursorSmoothness: { type: Number, default: null },
    scrollFrequency: { type: Number, default: null },
    scrollSpeed: { type: Number, default: null },
    idleDuration: { type: Number, default: null },
    focusChanges: { type: Number, default: null },

    // --- v2: Mouse behaviour ---
    mouseStopCount: { type: Number, default: null },
    averageMouseStopDuration: { type: Number, default: null },
    mousePathCurvature: { type: Number, default: null },
    cursorJitter: { type: Number, default: null },

    // --- v2: Scroll behaviour ---
    scrollBurstCount: { type: Number, default: null },
    averageScrollBurstDuration: { type: Number, default: null },

    // --- v2: Idle behaviour ---
    idleEventCount: { type: Number, default: null },
    maximumIdleDuration: { type: Number, default: null },

    // --- v2: Activity density ---
    mouseEventsPerSecond: { type: Number, default: null },
    scrollEventsPerSecond: { type: Number, default: null },
    activityDensity: { type: Number, default: null },

    // No screen fields were added in the v3 upgrade — face/gaze features
    // only apply to the webcam recording.
  },
  { _id: false, strict: false }
);

const ExtractedBehaviorFeatureSchema = new mongoose.Schema(
  {
    assessmentId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    assessmentType: {
      type: String,
      enum: ["mcq", "coding", "typing"],
      required: true,
    },

    webcamFeatures: webcamFeaturesSchema,
    screenFeatures: screenFeaturesSchema,

    // Processing/job bookkeeping — separate from the ML output above so the
    // pipeline can report status without polluting the feature vector.
    //
    // v3 note: `updatedAt` (from the `timestamps: true` option below) is
    // now load-bearing for featureExtractionService.js's staleness check —
    // a document sitting at "processing"/"pending" for longer than
    // STALE_PROCESSING_MS is treated as an abandoned job and safe to
    // re-enqueue via the live path, not just via backfill. Do not disable
    // `timestamps` without updating that logic.
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },

    metadata: {
      processedAt: Date,
      modelVersion: { type: String, default: "v1.0" },
      webcamDiagnostics: mongoose.Schema.Types.Mixed,
      screenDiagnostics: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true, collection: "ExtractedBehaviorFeatures" }
);

module.exports = mongoose.model(
  "ExtractedBehaviorFeature",
  ExtractedBehaviorFeatureSchema
);
