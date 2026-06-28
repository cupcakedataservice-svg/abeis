import { useRef, useCallback } from "react";

/**
 * Tracks mouse movement, clicks, drags and scroll behavior for the lifetime
 * of an assessment. Call attach() once on mount; call getSummary() to pull
 * an aggregated feature snapshot (and reset raw buffers) when needed.
 */
export function useMouseTracking() {
  const positions = useRef([]); // { x, y, t }
  const clicks = useRef([]); // { x, y, t, button }
  const doubleClicks = useRef(0);
  const rightClicks = useRef(0);
  const dragEvents = useRef(0);
  const isDragging = useRef(false);
  const scrollEvents = useRef([]); // { deltaY, t }
  const lastClickTime = useRef(0);

  const onMouseMove = useCallback((e) => {
    positions.current.push({ x: e.clientX, y: e.clientY, t: Date.now() });
    if (positions.current.length > 5000) positions.current.shift(); // cap memory
  }, []);

  const onMouseDown = useCallback((e) => {
    if (e.button === 2) rightClicks.current += 1;
    isDragging.current = true;
    const now = Date.now();
    if (now - lastClickTime.current < 350) doubleClicks.current += 1;
    lastClickTime.current = now;
    clicks.current.push({ x: e.clientX, y: e.clientY, t: now, button: e.button });
  }, []);

  const onMouseUp = useCallback(() => {
    if (isDragging.current) dragEvents.current += 1;
    isDragging.current = false;
  }, []);

  const onWheel = useCallback((e) => {
    scrollEvents.current.push({ deltaY: e.deltaY, t: Date.now() });
  }, []);

  const attach = useCallback(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("wheel", onWheel);
    };
  }, [onMouseMove, onMouseDown, onMouseUp, onWheel]);

  const getSummary = useCallback(() => {
    const pts = positions.current;
    let totalMovement = 0;
    let speeds = [];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = Math.max(pts[i].t - pts[i - 1].t, 1);
      totalMovement += dist;
      speeds.push(dist / dt);
    }
    const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const maxSpeed = speeds.length ? Math.max(...speeds) : 0;

    // Acceleration: variance of consecutive speed deltas (rough smoothness proxy)
    let accelSum = 0;
    for (let i = 1; i < speeds.length; i++) accelSum += Math.abs(speeds[i] - speeds[i - 1]);
    const acceleration = speeds.length > 1 ? accelSum / (speeds.length - 1) : 0;

    const durationSeconds = pts.length
      ? Math.max((pts[pts.length - 1].t - pts[0].t) / 1000, 1)
      : 1;

    const scrollDistance = scrollEvents.current.reduce((sum, s) => sum + Math.abs(s.deltaY), 0);

    return {
      totalMovement,
      avgSpeed,
      maxSpeed,
      acceleration,
      cursorSmoothness: acceleration === 0 ? 1 : 1 / (1 + acceleration), // 0-1, higher = smoother
      clickFrequency: clicks.current.length / durationSeconds,
      totalClicks: clicks.current.length,
      doubleClicks: doubleClicks.current,
      rightClicks: rightClicks.current,
      dragEvents: dragEvents.current,
      scrollEvents: scrollEvents.current.length,
      scrollDistance,
    };
  }, []);

  const getRawEvents = useCallback(() => ({
    positionsSample: positions.current.slice(-500), // cap payload size
    clicks: clicks.current,
  }), []);

  return { attach, getSummary, getRawEvents };
}
