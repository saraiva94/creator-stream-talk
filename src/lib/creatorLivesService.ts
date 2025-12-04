import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type CreatorLiveRow = {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "live" | "ended";
  scheduledFor?: string | null;
  price?: number | null;
  viewers: number;
};

type LiveRowData = {
  id: string;
  title?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  price?: number | null;
};

const normalizeStatus = (status: string | null | undefined, isActive: boolean | null | undefined): "draft" | "scheduled" | "live" | "ended" => {
  if (isActive) return "live";
  if (!status) return "draft";
  const s = status.toLowerCase();
  if (s === "live" || s === "scheduled" || s === "ended" || s === "draft") {
    return s as "draft" | "scheduled" | "live" | "ended";
  }
  if (s === "ending" || s === "inactive") return "ended";
  return "draft";
};

export const creatorLivesService = async (profileId: string) => {
  const { data, error } = await db
    .from("lives")
    .select("id, title, status, is_active, price, created_at, ended_at")
    .eq("creator_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data as unknown as LiveRowData[]) ?? [];

  const lives: CreatorLiveRow[] = rows.map((live) => ({
    id: live.id,
    title: live.title ?? "Live",
    status: normalizeStatus(live.status, live.is_active),
    scheduledFor: live.created_at ?? null,
    price: live.price ?? null,
    viewers: 0,
  }));

  return { lives };
};
