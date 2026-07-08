// /**
//  * Single source of truth for "what fields make up a complete webcamFeatures /
//  * screenFeatures object", used by three places that all need to agree:
//  *   1. scripts/backfillExtraction.js  — to decide "does this doc need the
//  *      incremental feature upgrade?" (any key here missing => yes)
//  *   2. services/exportService.js      — to normalize old documents so
//  *      missing keys export as `null` instead of being silently absent
//  *   3. models/ExtractedBehaviorFeature.js — documents which fields exist
//  *      (the schema itself is still the source of truth for storage; this
//  *      is the source of truth for "completeness checks")
//  *
//  * Adding a future feature = add its key here + to the Mongoose schema +
//  * make the Python worker emit it. Nothing else needs to change.
//  */

// const WEBCAM_FIELDS = [
//   // --- original v1 fields ---
//   "blinkRate",
//   "blinkCount",
//   "screenAttention",
//   "lookAwayCount",
//   "averagePitch",
//   "averageYaw",
//   "averageRoll",
//   "headMovementVariance",
//   "faceVisiblePercentage",
//   "eyeClosureRate",

//   // --- v2 additions ---
//   // Face detection
//   "averageFaceConfidence",
//   "continuousFaceLossCount",
//   "maximumFaceLossDuration",
//   // Blink behaviour
//   "averageBlinkDuration",
//   "maximumBlinkDuration",
//   "blinkIntervalVariance",
//   // Eye gaze
//   "screenAttentionPercentage",
//   "averageLookAwayDuration",
//   "maximumLookAwayDuration",
//   // Head pose
//   "pitchStdDeviation",
//   "yawStdDeviation",
//   "rollStdDeviation",
//   "averageHeadSpeed",
//   "maximumHeadSpeed",
// ];

// const SCREEN_FIELDS = [
//   // --- original v1 fields ---
//   "cursorSpeed",
//   "cursorAcceleration",
//   "cursorSmoothness",
//   "scrollFrequency",
//   "scrollSpeed",
//   "idleDuration",
//   "focusChanges",

//   // --- v2 additions ---
//   // Mouse behaviour
//   "mouseStopCount",
//   "averageMouseStopDuration",
//   "mousePathCurvature",
//   "cursorJitter",
//   // Scroll behaviour
//   "scrollBurstCount",
//   "averageScrollBurstDuration",
//   // Idle behaviour
//   "idleEventCount",
//   "maximumIdleDuration",
//   // Activity density
//   "mouseEventsPerSecond",
//   "scrollEventsPerSecond",
//   "activityDensity",
// ];

// const CURRENT_MODEL_VERSION = "v2.0";

// /**
//  * True if `obj` is missing any canonical key (undefined — `null` counts as
//  * present, since that's our own explicit "not computable" marker).
//  */
// function isMissingFields(obj, fields) {
//   if (!obj) return true;
//   return fields.some((key) => obj[key] === undefined);
// }

// /**
//  * Returns a new object with every canonical key present, filling any
//  * missing one with `null`. Never drops or renames a key that's already
//  * present, including ones outside the canonical list (forward-compatible
//  * with a document from a *newer* pipeline version than this code knows
//  * about).
//  */
// function normalizeFeatureObject(obj, fields) {
//   const result = { ...(obj || {}) };
//   for (const key of fields) {
//     if (result[key] === undefined) result[key] = null;
//   }
//   return result;
// }

// module.exports = {
//   WEBCAM_FIELDS,
//   SCREEN_FIELDS,
//   CURRENT_MODEL_VERSION,
//   isMissingFields,
//   normalizeFeatureObject,
// };

/**
 * Single source of truth for "what fields make up a complete webcamFeatures /
 * screenFeatures object", used by three places that all need to agree:
 *   1. scripts/backfillExtraction.js  — to decide "does this doc need the
 *      incremental feature upgrade?" (any key here missing => yes)
 *   2. services/exportService.js      — to normalize old documents so
 *      missing keys export as `null` instead of being silently absent
 *   3. models/ExtractedBehaviorFeature.js — documents which fields exist
 *      (the schema itself is still the source of truth for storage; this
 *      is the source of truth for "completeness checks")
 *
 * Adding a future feature = add its key here + to the Mongoose schema +
 * make the Python worker emit it. Nothing else needs to change.
 */

const WEBCAM_FIELDS = [
  // --- original v1 fields ---
  "blinkRate",
  "blinkCount",
  "screenAttention",
  "lookAwayCount",
  "averagePitch",
  "averageYaw",
  "averageRoll",
  "headMovementVariance",
  "faceVisiblePercentage",
  "eyeClosureRate",

  // --- v2 additions ---
  // Face detection
  "averageFaceConfidence",
  "continuousFaceLossCount",
  "maximumFaceLossDuration",
  // Blink behaviour
  "averageBlinkDuration",
  "maximumBlinkDuration",
  "blinkIntervalVariance",
  // Eye gaze
  "screenAttentionPercentage",
  "averageLookAwayDuration",
  "maximumLookAwayDuration",
  // Head pose
  "pitchStdDeviation",
  "yawStdDeviation",
  "rollStdDeviation",
  "averageHeadSpeed",
  "maximumHeadSpeed",

  // --- v3 additions ---
  // Multi-face detection
  "numberOfFaces",
  // Face framing (faceBoundingBox / averageFacePosition are nested objects,
  // not scalars — see the "OBJECT_FIELDS" note below for how completeness
  // and normalization treat them atomically rather than key-by-key)
  "faceBoundingBox",
  "averageFaceSize",
  "averageFacePosition",
  // Face absence (cumulative, distinct from maximumFaceLossDuration)
  "faceDisappearanceDuration",
  // Gaze direction — durations (seconds)
  "lookingLeftDuration",
  "lookingRightDuration",
  "lookingUpDuration",
  "lookingDownDuration",
  // Gaze direction — percentages (of processed frames)
  "lookingLeftPercentage",
  "lookingRightPercentage",
  "lookingUpPercentage",
  "lookingDownPercentage",
];

/**
 * Webcam fields whose value is a nested object ({x,y,width,height} or
 * {x,y}) rather than a flat number. normalizeFeatureObject() treats these
 * atomically: the whole object is present, or the whole field is `null` —
 * never a partially-filled object assembled from two different analyzer
 * runs. This matters specifically for the incremental-backfill merge in
 * featureExtractionService.js's `_mergePreferExisting`, which already
 * operates key-by-key at the top level of webcamFeatures/screenFeatures —
 * since `faceBoundingBox` and `averageFacePosition` are themselves single
 * keys at that top level, they're naturally merged as whole objects with
 * no extra code required; this list exists purely so callers that DO want
 * to reason about internals (e.g. a future admin UI rendering these
 * fields) know not to treat `faceBoundingBox.x` as independently nullable
 * from `faceBoundingBox.y`.
 */
const WEBCAM_OBJECT_FIELDS = ["faceBoundingBox", "averageFacePosition"];

const SCREEN_FIELDS = [
  // --- original v1 fields ---
  "cursorSpeed",
  "cursorAcceleration",
  "cursorSmoothness",
  "scrollFrequency",
  "scrollSpeed",
  "idleDuration",
  "focusChanges",

  // --- v2 additions ---
  // Mouse behaviour
  "mouseStopCount",
  "averageMouseStopDuration",
  "mousePathCurvature",
  "cursorJitter",
  // Scroll behaviour
  "scrollBurstCount",
  "averageScrollBurstDuration",
  // Idle behaviour
  "idleEventCount",
  "maximumIdleDuration",
  // Activity density
  "mouseEventsPerSecond",
  "scrollEventsPerSecond",
  "activityDensity",
];

// v3: adds the face-position/gaze webcam features (see WEBCAM_FIELDS above).
// No screen fields were added in this upgrade.
const CURRENT_MODEL_VERSION = "v3.1";

/**
 * True if `obj` is missing any canonical key (undefined — `null` counts as
 * present, since that's our own explicit "not computable" marker).
 */
function isMissingFields(obj, fields) {
  if (!obj) return true;
  return fields.some((key) => obj[key] === undefined);
}

/**
 * Returns a new object with every canonical key present, filling any
 * missing one with `null`. Never drops or renames a key that's already
 * present, including ones outside the canonical list (forward-compatible
 * with a document from a *newer* pipeline version than this code knows
 * about).
 *
 * Object-typed fields (see WEBCAM_OBJECT_FIELDS) are handled by the same
 * logic as scalars here: if the key is `undefined` on the source object it
 * becomes `null`; if it's present (even from an older document that only
 * has some of its sub-keys — which shouldn't happen given the Python
 * worker always writes these two fields as complete objects or omits them
 * entirely, but is defensively safe either way) it's passed through as-is
 * rather than being reconstructed key-by-key.
 */
function normalizeFeatureObject(obj, fields) {
  const result = { ...(obj || {}) };
  for (const key of fields) {
    if (result[key] === undefined) result[key] = null;
  }
  return result;
}

module.exports = {
  WEBCAM_FIELDS,
  WEBCAM_OBJECT_FIELDS,
  SCREEN_FIELDS,
  CURRENT_MODEL_VERSION,
  isMissingFields,
  normalizeFeatureObject,
};
