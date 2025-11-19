import logger from '../lib/logger';
import { getHeartbeatPollInterval } from '../lib/env';
import { evaluateLiveHeartbeats } from '../shared/liveMonitorCore';
import {
  countActiveLives,
  endLive,
  getActiveLivesWithHeartbeat,
  getLatestHeartbeatTimestamp,
  updateLiveLifecycleStatus,
  type LiveLifecycleStatus,
} from './supabaseService';

const MONITOR_SCHEDULE = '*/1 * * * *';
const MONITOR_MANAGER = 'supabase_edge_function';

const transitionToEndingAndClose = async (
  liveId: string,
  reason: string,
  currentStatus: LiveLifecycleStatus | null,
) => {
  if (currentStatus !== 'ending') {
    await updateLiveLifecycleStatus(liveId, 'ending');
  }

  await endLive(liveId, reason);
  logger.info({ event: 'monitor.live.ended', liveId, reason });
};

export const evaluateAndTerminateInactiveLives = async () => {
  const summaries = await getActiveLivesWithHeartbeat();
  const evaluation = evaluateLiveHeartbeats(summaries);
  const endedLives: { liveId: string; reason: string }[] = [];

  for (const candidate of evaluation.endedLives) {
    await transitionToEndingAndClose(candidate.liveId, candidate.reason, candidate.status);
    endedLives.push({ liveId: candidate.liveId, reason: candidate.reason });
  }

  logger.info({
    event: 'monitor.cycle.complete',
    evaluatedLives: summaries.length,
    endedLives: endedLives.length,
  });

  return {
    evaluatedLives: summaries.length,
    endedLives,
  };
};

export const getMonitorSnapshot = async () => {
  const [lastHeartbeatRun, activeLives] = await Promise.all([
    getLatestHeartbeatTimestamp(),
    countActiveLives(),
  ]);

  return {
    managedBy: MONITOR_MANAGER,
    schedule: MONITOR_SCHEDULE,
    running: false,
    enabled: true,
    intervalMs: getHeartbeatPollInterval(),
    lastHeartbeatRun,
    lastActiveLives: activeLives,
  };
};
