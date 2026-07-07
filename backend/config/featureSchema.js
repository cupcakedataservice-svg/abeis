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
];

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

const CURRENT_MODEL_VERSION = "v2.0";

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
  SCREEN_FIELDS,
  CURRENT_MODEL_VERSION,
  isMissingFields,
  normalizeFeatureObject,
};
