import { supabase } from "@/integrations/supabase/client";

export type CreatorDashboardSummary = {
  activeLives: number;
  totalRevenue: number;
  followers: number;
  upcomingLives: number;
};

export type CreatorDashboardChartPoint = {
  date: string;
  revenue: number;
  views: number;
};

export type CreatorTopLive = {
  id: string;
  title: string;
  viewers: number;
  revenue: number;
};

const sumTransactions = (transactions: { amount: number; creator_amount: number | null }[]) =>
  transactions.reduce((acc, t) => acc + (t.creator_amount ?? t.amount ?? 0), 0);

const groupTransactionsByDate = (transactions: { created_at: string; amount: number; creator_amount: number | null }[]) => {
  const map = new Map<string, number>();
  transactions.forEach((tx) => {
    const key = tx.created_at.slice(0, 10);
    const prev = map.get(key) ?? 0;
    map.set(key, prev + (tx.creator_amount ?? tx.amount ?? 0));
  });
  return Array.from(map.entries())
    .map(([date, revenue]) => ({ date, revenue, views: Math.round(revenue / 5) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
};

export const creatorDashboardService = async (profileId: string) => {
  const [profileRes, livesRes, txRes] = await Promise.all([
    supabase.from("creator_profiles").select("viewer_count").eq("id", profileId).maybeSingle(),
    supabase.from("lives").select("id, status, is_active, created_at, title").eq("creator_id", profileId),
    supabase
      .from("transactions")
      .select("amount, creator_amount, created_at, status")
      .eq("creator_id", profileId)
      .in("status", ["approved", "completed", "paid"]),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (livesRes.error) throw new Error(livesRes.error.message);
  if (txRes.error) throw new Error(txRes.error.message);

  const lives = livesRes.data ?? [];
  const transactions = txRes.data ?? [];

  const activeLives = lives.filter((live) => live.is_active).length;
  const upcomingLives = lives.filter((live) => ["scheduled", "waiting_for_host"].includes((live.status ?? "").toString())).length;
  const totalRevenue = sumTransactions(transactions);

  const topLives: CreatorTopLive[] = lives.slice(0, 5).map((live) => ({
    id: live.id,
    title: live.title ?? "Live",
    viewers: Math.floor(Math.random() * 200), // placeholder metric until real metrics are wired
    revenue: 0,
  }));

  const chart = groupTransactionsByDate(transactions);

  return {
    summary: {
      activeLives,
      totalRevenue,
      followers: profileRes.data?.viewer_count ?? 0,
      upcomingLives,
    },
    chart,
    topLives,
  };
};
