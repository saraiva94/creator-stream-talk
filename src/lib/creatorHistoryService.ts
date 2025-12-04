import { supabase } from "@/integrations/supabase/client";

export type CreatorHistoryEntry = {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  revenue: number;
  viewers: number;
};

type LiveRowData = {
  id: string;
  title?: string | null;
  created_at?: string | null;
  ended_at?: string | null;
  status?: string | null;
};

export const creatorHistoryService = async (profileId: string) => {
  const { data, error } = await (supabase
    .from("lives") as any)
    .select("id, title, created_at, ended_at, status")
    .eq("creator_id", profileId)
    .order("ended_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  const rows = (data as unknown as LiveRowData[]) ?? [];

  const entries: CreatorHistoryEntry[] = rows.map((live) => {
    const start = live.created_at ? new Date(live.created_at) : null;
    const end = live.ended_at ? new Date(live.ended_at) : null;
    const durationMinutes =
      start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : 0;
    return {
      id: live.id,
      title: live.title ?? "Live",
      date: live.ended_at ?? live.created_at ?? new Date().toISOString(),
      durationMinutes,
      revenue: 0,
      viewers: 0,
    };
  });

  return { entries };
};
