import { supabase } from "@/integrations/supabase/client";
import type { PostgrestFilterBuilder } from "@supabase/supabase-js";

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

const isCompletedPayment = (status?: string | null) => {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return ["approved", "completed", "paid", "succeeded"].includes(normalized);
};

const isProcessedWithdrawal = (status?: string | null) => {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return ["approved", "paid"].includes(normalized);
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

  const dateFilter = <T>(
    builder: PostgrestFilterBuilder<T>,
    column: string,
  ): PostgrestFilterBuilder<T> => {
    if (startDate) {
      return builder.gte(column, startDate.toISOString());
    }
    return builder;
  };

  const [platformRevenueRes, paymentsRes, withdrawalsRes] = await Promise.all([
    dateFilter(supabase.from("platform_revenue").select("amount, created_at"), "created_at"),
    dateFilter(supabase.from("payments").select("amount, status, created_at"), "created_at"),
    dateFilter(supabase.from("withdrawals").select("amount, status, processed_at, created_at"), "created_at"),
  ]);

  if (platformRevenueRes.error) {
    throw new Error(platformRevenueRes.error.message);
  }
  if (paymentsRes.error) {
    throw new Error(paymentsRes.error.message);
  }
  if (withdrawalsRes.error) {
    throw new Error(withdrawalsRes.error.message);
  }

  const platformRows = platformRevenueRes.data ?? [];
  const paymentsRows = paymentsRes.data ?? [];
  const withdrawalsRows = withdrawalsRes.data ?? [];

  type PlatformRevenueRow = { amount: number | null; created_at: string };
  type PaymentRow = { amount: number | null; status?: string | null; created_at: string };
  type WithdrawalRow = { amount: number | null; status?: string | null; created_at: string; processed_at?: string | null };

  const platformCut = sumAmounts(platformRows.map((row: PlatformRevenueRow) => row.amount));
  const grossRevenue = sumAmounts(
    paymentsRows.filter((row: PaymentRow) => isCompletedPayment(row.status)).map((row: PaymentRow) => row.amount),
  );
  const creatorPayouts = sumAmounts(
    withdrawalsRows
      .filter((row: WithdrawalRow) => isProcessedWithdrawal(row.status))
      .map((row: WithdrawalRow) => row.amount),
  );

  const seriesMap = new Map<string, number>();
  platformRows.forEach((row: PlatformRevenueRow) => {
    const key = toDateKey(row.created_at);
    const prev = seriesMap.get(key) ?? 0;
    seriesMap.set(key, Number((prev + (row.amount ?? 0)).toFixed(2)));
  });

  const series = Array.from(seriesMap.entries())
    .map(([date, platform]) => ({ date, platform }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    summary: {
      grossRevenue,
      platformCut,
      creatorPayouts,
    },
    series,
  };
};
