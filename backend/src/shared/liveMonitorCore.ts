export type LiveLifecycleStatus =
  | 'scheduled'
  | 'waiting_for_host'
  | 'live'
  | 'inactive'
  | 'ending'
  | 'ended';

export type MonitorTerminationReason = 'camera_inactive' | 'host_absent';

export type LiveHeartbeatSummaryLite = {
  liveId: string;
  cameraActive: boolean;
  lastHeartbeat: string;
  status: LiveLifecycleStatus | null;
};

export type MonitorEvaluation = {
  endedLives: {
    liveId: string;
    reason: MonitorTerminationReason;
    status: LiveLifecycleStatus | null;
  }[];
};

export const HOST_ABSENT_THRESHOLD_MS = 10 * 60 * 1000;
export const CAMERA_INACTIVE_THRESHOLD_MS = 20 * 60 * 1000;

export type HeartbeatThresholds = {
  hostAbsentThresholdMs?: number;
  cameraInactiveThresholdMs?: number;
};

const toTimestamp = (input: string): number | null => {
  const value = Date.parse(input);
  return Number.isNaN(value) ? null : value;
};

export const evaluateLiveHeartbeats = (
  summaries: LiveHeartbeatSummaryLite[],
  now: number | Date = Date.now(),
  thresholds: HeartbeatThresholds = {},
): MonitorEvaluation => {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const hostAbsentThresholdMs = thresholds.hostAbsentThresholdMs ?? HOST_ABSENT_THRESHOLD_MS;
  const cameraInactiveThresholdMs = thresholds.cameraInactiveThresholdMs ?? CAMERA_INACTIVE_THRESHOLD_MS;
  const endedLives: MonitorEvaluation['endedLives'] = [];

  for (const summary of summaries) {
    const lastHeartbeatMs = toTimestamp(summary.lastHeartbeat);

    if (!lastHeartbeatMs) {
      continue;
    }

    const delta = nowMs - lastHeartbeatMs;

    if (!summary.cameraActive && delta > cameraInactiveThresholdMs) {
      endedLives.push({
        liveId: summary.liveId,
        reason: 'camera_inactive',
        status: summary.status ?? null,
      });
      continue;
    }

    if (delta > hostAbsentThresholdMs) {
      endedLives.push({
        liveId: summary.liveId,
        reason: 'host_absent',
        status: summary.status ?? null,
      });
    }
  }

  return { endedLives };
};
