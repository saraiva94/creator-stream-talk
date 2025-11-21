import React from "react";

import { track } from "@/lib/analytics";

type PreviewRole = "anonymous" | "authenticated";
type EntitlementState = "entitled" | "unentitled";

interface UsePreviewTimerOptions {
  role: PreviewRole;
  entitlementState: EntitlementState;
  liveId?: string;
  durationOverrideMs?: number;
}

interface PreviewTimerState {
  isPreviewing: boolean;
  hasExpired: boolean;
  remainingMs: number;
  durationMs: number;
  start: () => boolean;
  stop: () => void;
}

const getDurationMs = (
  role: PreviewRole,
  entitlementState: EntitlementState,
  overrideMs?: number,
) => {
  if (entitlementState === "entitled") return 0;
  if (typeof overrideMs === "number" && overrideMs > 0) return overrideMs;
  return role === "anonymous" ? 30_000 : 10_000;
};

export function usePreviewTimer({ role, entitlementState, liveId, durationOverrideMs }: UsePreviewTimerOptions): PreviewTimerState {
  const mountedRef = React.useRef(true);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [hasExpired, setHasExpired] = React.useState(false);
  const [remainingMs, setRemainingMs] = React.useState(0);
  const [durationMs, setDurationMs] = React.useState(() =>
    getDurationMs(role, entitlementState, durationOverrideMs),
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const stop = React.useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    if (!mountedRef.current) return;
    setIsPreviewing(false);
    setHasExpired(false);
    setRemainingMs(0);
  }, []);

  const expire = React.useCallback(() => {
    if (!mountedRef.current) return;
    setIsPreviewing(false);
    setHasExpired(true);
    setRemainingMs(0);
    track("preview_expired", { liveId, role, durationMs });
  }, [durationMs, liveId, role]);

  const start = React.useCallback(() => {
    const nextDuration = getDurationMs(role, entitlementState, durationOverrideMs);
    setDurationMs(nextDuration);
    if (nextDuration <= 0 || isPreviewing || hasExpired) return false;

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setHasExpired(false);
    setIsPreviewing(true);
    setRemainingMs(nextDuration);
    track("preview_started", { liveId, role, durationMs: nextDuration });

    intervalRef.current = setInterval(() => {
      setRemainingMs((current) => {
        const next = Math.max(0, current - 1000);
        return next;
      });
    }, 1000);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      expire();
    }, nextDuration);

    return true;
  }, [entitlementState, expire, hasExpired, isPreviewing, liveId, role]);

  React.useEffect(() => {
    // Refresh duration if auth/entitlement changes before a preview starts.
    setDurationMs(getDurationMs(role, entitlementState, durationOverrideMs));
  }, [durationOverrideMs, entitlementState, role]);

  return {
    isPreviewing,
    hasExpired,
    remainingMs,
    durationMs,
    start,
    stop,
  };
}
