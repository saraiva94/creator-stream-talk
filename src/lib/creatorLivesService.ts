import { supabase } from "@/integrations/supabase/client";

export type CreatorLiveRow = {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "live" | "ended" | string;
  scheduledFor?: string | null;
  price?: number | null;
  viewers: number;
};

export const creatorLivesService = async (profileId: string) => {
  const { data, error } = await supabase
    .from("lives")
    .select("id, title, status, is_active, price, created_at, ended_at")
    .eq("creator_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const lives: CreatorLiveRow[] = (data ?? []).map((live: {
    id: string;
    title?: string | null;
    status?: string | null;
    is_active?: boolean | null;
    created_at?: string | null;
    price?: number | null;
  }) => ({
    id: live.id,
    title: live.title ?? "Live",
    status: live.status ?? (live.is_active ? "live" : "draft"),
    scheduledFor: live.created_at ?? null,
    price: live.price ?? null,
    viewers: 0,
  }));

  return { lives };
};
