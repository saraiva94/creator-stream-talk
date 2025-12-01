import { supabase } from "@/integrations/supabase/client";

export type LiveLifecycleStatus =
  | "scheduled"
  | "waiting_for_host"
  | "live"
  | "inactive"
  | "ending"
  | "ended";

export type ActiveLive = {
  id: string;
  title: string | null;
  status: LiveLifecycleStatus | null;
  creator_id: string;
  room_name: string | null;
  created_at: string | null;
  last_heartbeat?: string | null;
  camera_active?: boolean | null;
};

export type RecentLive = {
  id: string;
  title: string | null;
  status: LiveLifecycleStatus | null;
  creator_id: string;
  room_name: string | null;
  created_at: string | null;
  ended_at: string | null;
};

export type LiveAlert = {
  live_id: string;
  creator_id: string;
  reason: string | null;
  ended_at: string | null;
};

export type LiveMonitorData = {
  activeLives: ActiveLive[];
  recentLives: RecentLive[];
  alerts: LiveAlert[];
};

const toDateKey = (value: string | null | undefined) => {
  if (!value) return null;
  return value.slice(0, 10);
};

export const fetchLiveMonitorData = async (): Promise<LiveMonitorData> => {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const [livesRes, heartbeatRes, recentLivesRes, alertsRes] = await Promise.all([
    supabase
      .from("lives")
      .select("id, title, status, is_active, creator_id, room_name, created_at")
      .eq("is_active", true),
    supabase.from("live_heartbeat").select("live_id, last_heartbeat, camera_active"),
    supabase
      .from("lives")
      .select("id, title, status, creator_id, room_name, created_at, ended_at")
      .gte("ended_at", fortyEightHoursAgo)
      .order("ended_at", { ascending: false })
      .limit(10),
    supabase
      .from("live_end_log")
      .select("live_id, creator_id, reason, ended_at")
      .gte("ended_at", fortyEightHoursAgo)
      .order("ended_at", { ascending: false })
      .limit(10),
  ]);

  if (livesRes.error) throw new Error(livesRes.error.message);
  if (heartbeatRes.error) throw new Error(heartbeatRes.error.message);
  if (recentLivesRes.error) throw new Error(recentLivesRes.error.message);
  if (alertsRes.error) throw new Error(alertsRes.error.message);

  type HeartbeatRow = { live_id: string; last_heartbeat?: string | null; camera_active?: boolean | null };
  type LiveRow = {
    id: string;
    title?: string | null;
    status?: LiveLifecycleStatus | null;
    creator_id: string;
    room_name?: string | null;
    created_at?: string | null;
    ended_at?: string | null;
  };
  type AlertRow = { live_id: string; creator_id: string; reason?: string | null; ended_at?: string | null };

  const heartbeatLookup = new Map<string, { last_heartbeat?: string | null; camera_active?: boolean | null }>();
  (heartbeatRes.data ?? []).forEach((row: HeartbeatRow) => {
    heartbeatLookup.set(row.live_id, {
      last_heartbeat: row.last_heartbeat,
      camera_active: row.camera_active,
    });
  });

  const activeLives: ActiveLive[] = (livesRes.data ?? []).map((row: LiveRow) => {
    const hb = heartbeatLookup.get(row.id) ?? {};
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      creator_id: row.creator_id,
      room_name: row.room_name,
      created_at: row.created_at,
      last_heartbeat: hb.last_heartbeat ?? null,
      camera_active: hb.camera_active ?? null,
    };
  });

  const recentLives: RecentLive[] = (recentLivesRes.data ?? []).map((row: LiveRow) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    creator_id: row.creator_id,
    room_name: row.room_name,
    created_at: row.created_at,
    ended_at: row.ended_at,
  }));

  const alerts: LiveAlert[] = (alertsRes.data ?? []).map((row: AlertRow) => ({
    live_id: row.live_id,
    creator_id: row.creator_id,
    reason: row.reason,
    ended_at: row.ended_at,
  }));

  return {
    activeLives,
    recentLives,
    alerts,
  };
};
