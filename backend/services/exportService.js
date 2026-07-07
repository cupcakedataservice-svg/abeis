const User = require("../models/User");
const Assessment = require("../models/Assessment");
const BehavioralFeature = require("../models/BehavioralFeature");
const AssessmentResponse = require("../models/AssessmentResponse");
const Media = require("../models/Media");
const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
const { WEBCAM_FIELDS, SCREEN_FIELDS, normalizeFeatureObject } = require("../config/featureSchema");

/**
 * Builds one complete, baseline/ML-ready record per assessment by joining
 * users, assessmentresponses, behavioralfeatures, media, and
 * ExtractedBehaviorFeatures on assessmentId (users additionally on userId).
 *
 * Mirrors the per-assessment Promise.all pattern already used elsewhere in
 * adminController.js (e.g. getUserDetails, deleteUserById) rather than an
 * aggregation pipeline, to stay consistent with the rest of the codebase.
 *
 * @param {{assessmentType?: string}} filters
 * @returns {Promise<object[]>}
 */
async function getExportRows({ assessmentType } = {}) {
  const assessmentFilter = {};
  if (assessmentType) assessmentFilter.assessmentType = assessmentType;

  const assessments = await Assessment.find(assessmentFilter).sort({ startedAt: -1 }).lean();

  return Promise.all(assessments.map(_buildRow));
}

async function _buildRow(a) {
  const [user, response, feature, media, extracted] = await Promise.all([
    User.findOne({ userId: a.userId }).lean(),
    AssessmentResponse.findOne({ assessmentId: a.assessmentId }).lean(),
    BehavioralFeature.findOne({ assessmentId: a.assessmentId }).lean(),
    Media.findOne({ assessmentId: a.assessmentId }).lean(),
    ExtractedBehaviorFeature.findOne({ assessmentId: a.assessmentId }).lean(),
  ]);

  // Requirement: real nested object instead of a stringified featureVector,
  // or null if no BehavioralFeature document exists for this assessment.
  const behavioralFeatures = feature && feature.featureVector ? feature.featureVector : null;

  // Requirement: null unless AI extraction actually finished — a
  // pending/processing/failed job has no trustworthy values to export yet.
  // When it HAS finished, normalize to the full canonical field list so a
  // document written before the v2 feature upgrade (or not yet reprocessed
  // by the incremental backfill) still exports every key, with `null` for
  // whatever that document doesn't have yet — never a silently missing key.
  const videoFeatures =
    extracted && extracted.status === "completed"
      ? {
        webcam: normalizeFeatureObject(extracted.webcamFeatures, WEBCAM_FIELDS),
        screen: normalizeFeatureObject(extracted.screenFeatures, SCREEN_FIELDS),
      }
      : null;

  return {
    userId: a.userId,
    name: user ? user.name : null,
    email: user ? user.email : null,

    assessmentId: a.assessmentId,
    sessionId: a.sessionId,
    assessmentType: a.assessmentType,

    status: a.status,

    startedAt: a.startedAt,
    endedAt: a.endedAt,
    durationSeconds: a.duration,

    cameraRecordingUrl: (media && media.cameraRecording && media.cameraRecording.url) || null,
    screenRecordingUrl: (media && media.screenRecording && media.screenRecording.url) || null,

    behavioralFeatures,
    videoFeatures,

    // Beyond the minimum spec: assessmentresponses was listed as a
    // collection to join but wasn't shown in the sample output. Raw
    // answers are useful for ML training too (e.g. correctness vs.
    // behavioral-signal correlation), so they're included as their own
    // field rather than silently dropped. Delete this block if you'd
    // rather keep the export to exactly the sample shape.
    responses: response
      ? {
        mcqResponses: response.mcqResponses || undefined,
        codingResponses: response.codingResponses || undefined,
        typingResponses: response.typingResponses || undefined,
      }
      : null,
  };
}

/**
 * Flattens a row to dot-notation keys for CSV — CSV has no concept of
 * nesting. Arrays are JSON-stringified into a single cell rather than
 * spread across ragged, variable-width columns.
 */
function _flatten(obj, prefix = "", result = {}) {
  if (obj === null || obj === undefined) {
    if (prefix) result[prefix] = "";
    return result;
  }
  if (obj instanceof Date) {
    result[prefix] = obj.toISOString();
    return result;
  }
  if (Array.isArray(obj)) {
    result[prefix] = JSON.stringify(obj);
    return result;
  }
  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      _flatten(value, prefix ? `${prefix}.${key}` : key, result);
    }
    return result;
  }
  result[prefix] = obj;
  return result;
}

/**
 * Converts export rows to a CSV string using the UNION of keys across all
 * rows as the field list (not just the first row's), since some
 * assessments will have null behavioralFeatures/videoFeatures and others
 * won't — using only row[0]'s keys would silently drop columns.
 */
function rowsToCsv(rows) {
  const { Parser } = require("json2csv");

  const flatRows = rows.map((r) => _flatten(r));
  const fieldSet = new Set();
  flatRows.forEach((row) => Object.keys(row).forEach((k) => fieldSet.add(k)));

  const parser = new Parser({ fields: Array.from(fieldSet).sort() });
  return parser.parse(flatRows);
}

module.exports = { getExportRows, rowsToCsv };
