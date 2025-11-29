import { supabase } from "@/integrations/supabase/client";

export type CreatorHistoryEntry = {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  revenue: number;
  viewers: number;
};

export const creatorHistoryService = async (profileId: string) => {
  const { data, error } = await supabase
    .from("lives")
    .select("id, title, created_at, ended_at, status")
    .eq("creator_id", profileId)
    .order("ended_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  const entries: CreatorHistoryEntry[] = (data ?? []).map((live: any) => {
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
