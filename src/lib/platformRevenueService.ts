import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type RevenueRange = "7d" | "30d" | "90d" | "lifetime";

export type RevenueSummary = {
  grossRevenue: number;
  platformCut: number;
  creatorPayouts: number;
};

export type RevenueSeriesPoint = {
  date: string;
  platform: number;
};

export type PlatformRevenueResponse = {
  summary: RevenueSummary;
  series: RevenueSeriesPoint[];
};


const toStartDate = (range: RevenueRange): Date | null => {
  const now = new Date();
  if (range === "lifetime") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return start;
};

const toDateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
};

const sumAmounts = (values: Array<number | null | undefined>) =>
  Number(
    values
      .map((v) => (typeof v === "number" ? v : Number(v ?? 0)))
      .filter((v) => Number.isFinite(v))
      .reduce((acc, cur) => acc + cur, 0)
      .toFixed(2),
  );

export const fetchPlatformRevenue = async (range: RevenueRange): Promise<PlatformRevenueResponse> => {
  const startDate = toStartDate(range);

  // Build queries with optional date filter
  let platformRevenueQuery = db.from("platform_revenue").select("amount, created_at, source_type");
  let payoutRequestsQuery = db.from("payout_requests").select("amount, status, paid_at, created_at");

  if (startDate) {
    const startIso = startDate.toISOString();
    platformRevenueQuery = platformRevenueQuery.gte("created_at", startIso);
    payoutRequestsQuery = payoutRequestsQuery.gte("created_at", startIso);
  }

  const [platformRevenueRes, payoutRequestsRes] = await Promise.all([
    platformRevenueQuery,
    payoutRequestsQuery,
  ]);

  type PlatformRevenueRow = { amount: number | null; created_at: string; source_type: string };
  type PayoutRow = { amount: number | null; status?: string | null; created_at: string; paid_at?: string | null };

  const platformRows: PlatformRevenueRow[] = platformRevenueRes.data ?? [];
  const payoutRows: PayoutRow[] = payoutRequestsRes.data ?? [];

  // Calculate platform cut from platform_revenue table (in centavos, convert to reais)
  const platformCut = sumAmounts(platformRows.map((row) => (row.amount ?? 0) / 100));

  // Calculate gross revenue from platform_revenue sources
  // Gross = platform revenue amounts (which are only platform's cut) / 0.2 for most sources
  // Registration: platform gets remainder after commissions (variable)
  // Credits: platform gets 100%
  // SuperChat/Live: platform gets 20%
  let grossRevenue = 0;
  platformRows.forEach((row) => {
    const amountReais = (row.amount ?? 0) / 100;
    const sourceType = (row.source_type ?? "").toLowerCase();
    
    if (sourceType === "credits_purchase") {
      // 100% of credits goes to platform
      grossRevenue += amountReais;
    } else if (sourceType === "superchat" || sourceType === "live_earnings") {
      // 20% goes to platform, so gross = platform / 0.2
      grossRevenue += amountReais / 0.2;
    } else if (sourceType === "registration") {
      // Registration has variable split, estimate gross as R$5 per registration
      grossRevenue += 5;
    } else {
      // Unknown source, just add platform amount as minimum
      grossRevenue += amountReais;
    }
  });

  // Calculate creator payouts from payout_requests with status 'paid'
  const creatorPayouts = sumAmounts(
    payoutRows
      .filter((row) => {
        const status = (row.status ?? "").toLowerCase();
        return status === "paid";
      })
      .map((row) => (row.amount ?? 0) / 100), // payout_requests.amount is in centavos
  );

  // Build series from platform_revenue table
  const seriesMap = new Map<string, number>();
  platformRows.forEach((row) => {
    const key = toDateKey(row.created_at);
    const prev = seriesMap.get(key) ?? 0;
    const amountInReais = (row.amount ?? 0) / 100;
    seriesMap.set(key, Number((prev + amountInReais).toFixed(2)));
  });

  const series = Array.from(seriesMap.entries())
    .map(([date, platform]) => ({ date, platform }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    summary: {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      platformCut,
      creatorPayouts,
    },
    series,
  };
};
