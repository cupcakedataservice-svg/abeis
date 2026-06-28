import { useRef, useCallback } from "react";

/**
 * Tracks keyboard dynamics: press durations, inter-key latency, backspaces,
 * deletes, shift usage, ctrl combos, and copy/paste attempts.
 */
export function useKeyboardTracking() {
  const keyDownTimes = useRef({}); // key -> timestamp
  const pressDurations = useRef([]); // ms
  const interKeyLatencies = useRef([]); // ms between consecutive keydowns
  const lastKeyDownTime = useRef(null);
  const backspaceCount = useRef(0);
  const deleteCount = useRef(0);
  const shiftUsageCount = useRef(0);
  const ctrlComboCount = useRef(0);
  const copyAttempts = useRef(0);
  const pasteAttempts = useRef(0);
  const totalKeystrokes = useRef(0);
  const keyFrequency = useRef({}); // key -> count

  const onKeyDown = useCallback((e) => {
    const now = Date.now();
    keyDownTimes.current[e.key] = now;
    totalKeystrokes.current += 1;
    keyFrequency.current[e.key] = (keyFrequency.current[e.key] || 0) + 1;

    if (lastKeyDownTime.current !== null) {
      interKeyLatencies.current.push(now - lastKeyDownTime.current);
    }
    lastKeyDownTime.current = now;

    if (e.key === "Backspace") backspaceCount.current += 1;
    if (e.key === "Delete") deleteCount.current += 1;
    if (e.key === "Shift") shiftUsageCount.current += 1;

    if (e.ctrlKey || e.metaKey) {
      ctrlComboCount.current += 1;
      if (e.key.toLowerCase() === "c") copyAttempts.current += 1;
      if (e.key.toLowerCase() === "v") pasteAttempts.current += 1;
    }
  }, []);

  const onKeyUp = useCallback((e) => {
    const downTime = keyDownTimes.current[e.key];
    if (downTime) {
      pressDurations.current.push(Date.now() - downTime);
      delete keyDownTimes.current[e.key];
    }
  }, []);

  const onPaste = useCallback(() => {
    pasteAttempts.current += 1;
  }, []);

  const onCopy = useCallback(() => {
    copyAttempts.current += 1;
  }, []);

  const attach = useCallback(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("paste", onPaste);
    window.addEventListener("copy", onCopy);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("copy", onCopy);
    };
  }, [onKeyDown, onKeyUp, onPaste, onCopy]);

  const getSummary = useCallback(() => {
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      avgKeyPressDuration: avg(pressDurations.current),
      avgInterKeyLatency: avg(interKeyLatencies.current),
      typingRhythmVariance: variance(interKeyLatencies.current),
      totalKeystrokes: totalKeystrokes.current,
      keyFrequency: keyFrequency.current,
      backspaceCount: backspaceCount.current,
      deleteCount: deleteCount.current,
      shiftUsageCount: shiftUsageCount.current,
      ctrlComboCount: ctrlComboCount.current,
      copyAttempts: copyAttempts.current,
      pasteAttempts: pasteAttempts.current,
      errorRate:
        totalKeystrokes.current > 0
          ? (backspaceCount.current + deleteCount.current) / totalKeystrokes.current
          : 0,
    };
  }, []);

  return { attach, getSummary };
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
}
