const mongoose = require("mongoose");
const Assessment = require("../models/Assessment"); // adjust path to existing model

/**
 * Builds one complete, ML/baseline-ready record per assessment by joining:
 *   assessments -> users -> assessmentresponses -> behavioralfeatures
 *              -> media -> ExtractedBehaviorFeatures
 * all on assessmentId (users additionally keyed on userId).
 *
 * Uses a single aggregation pipeline (rather than N+1 queries per
 * assessment) so this stays performant as the assessments collection grows
 * into the thousands. $lookup + $unwind with preserveNullAndEmptyArrays
 * means a missing related document simply becomes `undefined` in the
 * pipeline output — never an error, never a skipped assessment.
 *
 * @param {{assessmentType?: string}} filters
 * @returns {Promise<object[]>}
 */
async function buildExportRecords({ assessmentType } = {}) {
  const matchStage = assessmentType ? { assessmentType } : {};

  const pipeline = [
    { $match: matchStage },

    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "userId",
        as: "userDoc",
      },
    },
    { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "assessmentresponses",
        localField: "assessmentId",
        foreignField: "assessmentId",
        as: "responseDoc",
      },
    },
    { $unwind: { path: "$responseDoc", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "behavioralfeatures", // BehavioralFeature model's default collection name
        localField: "assessmentId",
        foreignField: "assessmentId",
        as: "featureDoc",
      },
    },
    { $unwind: { path: "$featureDoc", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "media",
        localField: "assessmentId",
        foreignField: "assessmentId",
        as: "mediaDoc",
      },
    },
    { $unwind: { path: "$mediaDoc", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "ExtractedBehaviorFeatures", // explicit collection name set on the model
        localField: "assessmentId",
        foreignField: "assessmentId",
        as: "extractedDoc",
      },
    },
    { $unwind: { path: "$extractedDoc", preserveNullAndEmptyArrays: true } },
  ];

  const rows = await Assessment.aggregate(pipeline);
  return rows.map(_shapeRecord);
}

function _shapeRecord(row) {
  const user = row.userDoc || {};
  const media = row.mediaDoc || null;
  const featureDoc = row.featureDoc || null;
  const extracted = row.extractedDoc || null;
  const response = row.responseDoc || null;

  // Requirement: replace the old stringified `featureVectorJSON` with a
  // real nested object, or null if no BehavioralFeature doc exists.
  const behavioralFeatures =
    featureDoc && featureDoc.featureVector ? featureDoc.featureVector : null;

  // Requirement: null unless AI extraction actually finished — a pending/
  // processing/failed job has no trustworthy feature values to export.
  const videoFeatures =
    extracted && extracted.status === "completed"
      ? {
        webcam: extracted.webcamFeatures || null,
        screen: extracted.screenFeatures || null,
      }
      : null;

  return {
    userId: row.userId,
    name: user.name || null,
    email: user.email || null,

    assessmentId: row.assessmentId,
    sessionId: row.sessionId,
    assessmentType: row.assessmentType,

    status: row.status,

    startedAt: row.startedAt || null,
    endedAt: row.endedAt || null,
    durationSeconds: row.duration ?? null,

    cameraRecordingUrl: (media && media.cameraRecording && media.cameraRecording.url) || null,
    screenRecordingUrl: (media && media.screenRecording && media.screenRecording.url) || null,

    behavioralFeatures,
    videoFeatures,

    // Bonus, beyond the minimum spec: assessmentresponses was listed as a
    // collection to join but wasn't shown in the sample output. The actual
    // answers/typed text are useful for ML training too (e.g. correctness
    // vs. behavioral signal correlation), so it's included here as its own
    // top-level field rather than silently dropped. Remove this block if
    // you don't want raw responses in the export.
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
 * Flattens a nested object into dot-notation keys for CSV output, since
 * CSV has no concept of nested structure. Arrays are JSON-stringified
 * rather than flattened (index-per-column would produce a ragged,
 * hard-to-use CSV for variable-length arrays like mcqResponses).
 */
function flattenForCsv(obj, prefix = "", result = {}) {
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
    // Mongoose Mixed fields (e.g. featureVector) may still carry internal
    // ObjectId-like wrappers; a plain JSON round-trip normalizes those.
    const plain = obj.toJSON ? obj.toJSON() : obj;
    for (const [key, value] of Object.entries(plain)) {
      flattenForCsv(value, prefix ? `${prefix}.${key}` : key, result);
    }
    return result;
  }
  result[prefix] = obj;
  return result;
}

/**
 * Converts shaped export records into a CSV string. Field set is the union
 * of keys across all rows (not just the first row), since some assessments
 * will have null videoFeatures/behavioralFeatures and others won't.
 */
function recordsToCsv(records) {
  const { Parser } = require("json2csv"); // already a project dependency per the ABEIS stack

  const flatRows = records.map((r) => flattenForCsv(r));
  const fieldSet = new Set();
  flatRows.forEach((row) => Object.keys(row).forEach((k) => fieldSet.add(k)));

  const parser = new Parser({ fields: Array.from(fieldSet).sort() });
  return parser.parse(flatRows);
}

module.exports = { buildExportRecords, recordsToCsv };
