import { useRef, useCallback } from "react";

const IDLE_THRESHOLD_MS = 5000;

/**
 * Tracks session-level signals: idle periods, focus/blur, tab switches,
 * fullscreen exits, device/browser metadata, and a rough network latency probe.
 */
export function useSessionTracking() {
  const lastActivityTime = useRef(Date.now());
  const idlePeriods = useRef([]); // ms durations
  const focusChanges = useRef(0);
  const tabSwitches = useRef(0);
  const fullscreenExits = useRef(0);
  const sessionStart = useRef(Date.now());
  const idleCheckInterval = useRef(null);
  const currentlyIdleSince = useRef(null);

  const markActivity = useCallback(() => {
    const now = Date.now();
    if (currentlyIdleSince.current) {
      idlePeriods.current.push(now - currentlyIdleSince.current);
      currentlyIdleSince.current = null;
    }
    lastActivityTime.current = now;
  }, []);

  const checkIdle = useCallback(() => {
    const now = Date.now();
    if (!currentlyIdleSince.current && now - lastActivityTime.current > IDLE_THRESHOLD_MS) {
      currentlyIdleSince.current = lastActivityTime.current + IDLE_THRESHOLD_MS;
    }
  }, []);

  const onBlur = useCallback(() => {
    focusChanges.current += 1;
  }, []);

  const onVisibilityChange = useCallback(() => {
    if (document.hidden) tabSwitches.current += 1;
  }, []);

  const onFullscreenChange = useCallback(() => {
    if (!document.fullscreenElement) fullscreenExits.current += 1;
  }, []);

  const attach = useCallback(() => {
    sessionStart.current = Date.now();
    const activityEvents = ["mousemove", "keydown", "click", "scroll"];
    activityEvents.forEach((evt) => window.addEventListener(evt, markActivity));
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    idleCheckInterval.current = setInterval(checkIdle, 1000);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, markActivity));
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      clearInterval(idleCheckInterval.current);
    };
  }, [markActivity, onBlur, onVisibilityChange, onFullscreenChange, checkIdle]);

  const probeNetworkLatency = useCallback(async (apiBaseUrl) => {
    try {
      const start = performance.now();
      await fetch(`${apiBaseUrl.replace(/\/api$/, "")}/health`, { cache: "no-store" });
      return performance.now() - start;
    } catch {
      return null;
    }
  }, []);

  const getDeviceInfo = useCallback(() => {
    const ua = navigator.userAgent;
    const isMobile = /Mobi|Android/i.test(ua);
    const isTablet = /Tablet|iPad/i.test(ua);
    return {
      userAgent: ua,
      browserName: detectBrowser(ua),
      os: detectOS(ua),
      deviceType: isTablet ? "tablet" : isMobile ? "mobile" : "desktop",
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    };
  }, []);

  const getSummary = useCallback((networkLatencyMs) => {
    const idleTimeMs = idlePeriods.current.reduce((a, b) => a + b, 0);
    return {
      idleTimeMs,
      idlePeriodsCount: idlePeriods.current.length,
      focusChanges: focusChanges.current,
      tabSwitches: tabSwitches.current,
      fullscreenExits: fullscreenExits.current,
      avgNetworkLatencyMs: networkLatencyMs ?? undefined,
      sessionDurationMs: Date.now() - sessionStart.current,
      ...getDeviceInfo(),
    };
  }, [getDeviceInfo]);

  return { attach, getSummary, getDeviceInfo, probeNetworkLatency };
}

function detectBrowser(ua) {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
  return "Unknown";
}

function detectOS(ua) {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown";
}
