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

type HeartbeatRow = { live_id: string; last_heartbeat?: string | null; camera_active?: boolean | null };
type LiveRowData = {
  id: string;
  title?: string | null;
  status?: string | null;
  creator_id: string;
  room_name?: string | null;
  created_at?: string | null;
  ended_at?: string | null;
  is_active?: boolean;
};
type AlertRow = { live_id: string; creator_id: string; reason?: string | null; ended_at?: string | null };

export const fetchLiveMonitorData = async (): Promise<LiveMonitorData> => {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const [livesRes, heartbeatRes, recentLivesRes, alertsRes] = await Promise.all([
    (supabase as any)
      .from("lives")
      .select("id, title, status, is_active, creator_id, room_name, created_at")
      .eq("is_active", true),
    (supabase as any).from("live_heartbeat").select("live_id, last_heartbeat, camera_active"),
    (supabase as any)
      .from("lives")
      .select("id, title, status, creator_id, room_name, created_at, ended_at")
      .gte("ended_at", fortyEightHoursAgo)
      .order("ended_at", { ascending: false })
      .limit(10),
    (supabase as any)
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

  const heartbeatLookup = new Map<string, { last_heartbeat?: string | null; camera_active?: boolean | null }>();
  const heartbeatData = (heartbeatRes.data as unknown as HeartbeatRow[]) ?? [];
  heartbeatData.forEach((row) => {
    heartbeatLookup.set(row.live_id, {
      last_heartbeat: row.last_heartbeat,
      camera_active: row.camera_active,
    });
  });

  const livesData = (livesRes.data as unknown as LiveRowData[]) ?? [];
  const activeLives: ActiveLive[] = livesData.map((row) => {
    const hb = heartbeatLookup.get(row.id) ?? {};
    return {
      id: row.id,
      title: row.title ?? null,
      status: (row.status as LiveLifecycleStatus) ?? null,
      creator_id: row.creator_id,
      room_name: row.room_name ?? null,
      created_at: row.created_at ?? null,
      last_heartbeat: hb.last_heartbeat ?? null,
      camera_active: hb.camera_active ?? null,
    };
  });

  const recentData = (recentLivesRes.data as unknown as LiveRowData[]) ?? [];
  const recentLives: RecentLive[] = recentData.map((row) => ({
    id: row.id,
    title: row.title ?? null,
    status: (row.status as LiveLifecycleStatus) ?? null,
    creator_id: row.creator_id,
    room_name: row.room_name ?? null,
    created_at: row.created_at ?? null,
    ended_at: row.ended_at ?? null,
  }));

  const alertsData = (alertsRes.data as unknown as AlertRow[]) ?? [];
  const alerts: LiveAlert[] = alertsData.map((row) => ({
    live_id: row.live_id,
    creator_id: row.creator_id,
    reason: row.reason ?? null,
    ended_at: row.ended_at ?? null,
  }));

  return {
    activeLives,
    recentLives,
    alerts,
  };
};
