const Baseline = require("../models/Baseline");
const BehavioralFeature = require("../models/BehavioralFeature");

const TYPE_TO_FIELD = {
  mcq: "mcqBaseline",
  coding: "codingBaseline",
  typing: "typingBaseline",
};

/**
 * Safely pull a numeric metric out of a featureVector using a list of
 * candidate paths (different assessment types nest things slightly differently).
 */
function pick(vector, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), vector);
    if (typeof value === "number" && !Number.isNaN(value)) return value;
  }
  return undefined;
}

function runningAverage(prevAvg, prevCount, newValue) {
  if (typeof newValue !== "number") return prevAvg;
  if (!prevAvg || !prevCount) return newValue;
  return (prevAvg * prevCount + newValue) / (prevCount + 1);
}

/**
 * Recalculates / updates the relevant baseline sub-document for a user after
 * a completed assessment. Called by the controller once an assessment is
 * marked "completed" and its BehavioralFeature document has been saved.
 */
async function updateBaselineAfterAssessment({ userId, assessmentType, featureVector }) {
  const fieldName = TYPE_TO_FIELD[assessmentType];
  if (!fieldName) throw new Error(`Unknown assessment type: ${assessmentType}`);

  let baseline = await Baseline.findOne({ userId });
  if (!baseline) {
    baseline = new Baseline({ userId });
  }

  const current = baseline[fieldName] || {};
  const prevCount = current.sampleCount || 0;

  const responseTime = pick(featureVector, ["session.avgResponseTimeMs", "responseTimeMs"]);
  const typingSpeed = pick(featureVector, ["typing.wpm", "session.wpm"]);
  const mouseSpeed = pick(featureVector, ["mouse.avgSpeed"]);
  const clickFrequency = pick(featureVector, ["mouse.clickFrequency"]);
  const keyLatency = pick(featureVector, ["keyboard.avgInterKeyLatency"]);
  const scrollDistance = pick(featureVector, ["mouse.scrollDistance"]);
  const idleDuration = pick(featureVector, ["session.idleTimeMs"]);
  const backspaceCount = pick(featureVector, ["keyboard.backspaceCount"]);
  const focusChanges = pick(featureVector, ["session.focusChanges"]);

  const updated = {
    sampleCount: prevCount + 1,
    avgResponseTimeMs: runningAverage(current.avgResponseTimeMs, prevCount, responseTime),
    avgTypingSpeedWpm: runningAverage(current.avgTypingSpeedWpm, prevCount, typingSpeed),
    avgMouseSpeed: runningAverage(current.avgMouseSpeed, prevCount, mouseSpeed),
    avgClickFrequency: runningAverage(current.avgClickFrequency, prevCount, clickFrequency),
    avgKeyLatencyMs: runningAverage(current.avgKeyLatencyMs, prevCount, keyLatency),
    avgScrollDistance: runningAverage(current.avgScrollDistance, prevCount, scrollDistance),
    avgIdleDurationMs: runningAverage(current.avgIdleDurationMs, prevCount, idleDuration),
    avgBackspaceCount: runningAverage(current.avgBackspaceCount, prevCount, backspaceCount),
    avgFocusChanges: runningAverage(current.avgFocusChanges, prevCount, focusChanges),
    lastUpdatedAt: new Date(),
    lastFeatureVector: featureVector,
  };

  baseline[fieldName] = updated;
  await baseline.save();
  return baseline;
}

/**
 * Compares a freshly captured featureVector against the user's stored baseline
 * for the given assessment type, returning per-metric percentage deviation.
 */
async function compareAgainstBaseline({ userId, assessmentType, featureVector }) {
  const fieldName = TYPE_TO_FIELD[assessmentType];
  const baseline = await Baseline.findOne({ userId });
  if (!baseline || !baseline[fieldName] || !baseline[fieldName].sampleCount) {
    return { hasBaseline: false, deviations: null };
  }

  const b = baseline[fieldName];

  const metricPairs = [
    ["avgResponseTimeMs", pick(featureVector, ["session.avgResponseTimeMs", "responseTimeMs"])],
    ["avgTypingSpeedWpm", pick(featureVector, ["typing.wpm", "session.wpm"])],
    ["avgMouseSpeed", pick(featureVector, ["mouse.avgSpeed"])],
    ["avgClickFrequency", pick(featureVector, ["mouse.clickFrequency"])],
    ["avgKeyLatencyMs", pick(featureVector, ["keyboard.avgInterKeyLatency"])],
    ["avgScrollDistance", pick(featureVector, ["mouse.scrollDistance"])],
    ["avgIdleDurationMs", pick(featureVector, ["session.idleTimeMs"])],
    ["avgBackspaceCount", pick(featureVector, ["keyboard.backspaceCount"])],
    ["avgFocusChanges", pick(featureVector, ["session.focusChanges"])],
  ];

  const deviations = {};
  for (const [key, newValue] of metricPairs) {
    const baselineValue = b[key];
    if (typeof baselineValue === "number" && typeof newValue === "number" && baselineValue !== 0) {
      deviations[key] = {
        baseline: baselineValue,
        current: newValue,
        percentChange: ((newValue - baselineValue) / baselineValue) * 100,
      };
    }
  }

  return { hasBaseline: true, deviations };
}

module.exports = { updateBaselineAfterAssessment, compareAgainstBaseline };
