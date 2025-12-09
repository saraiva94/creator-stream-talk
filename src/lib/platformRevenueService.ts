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

  // Build queries with optional date filter
  let platformRevenueQuery = db.from("platform_revenue").select("amount, created_at, source_type");
  let paymentsQuery = db.from("payments").select("amount, status, created_at");
  let transactionsQuery = db.from("transactions").select("amount, status, created_at, type");
  let withdrawalsQuery = db.from("withdrawals").select("amount, status, processed_at, created_at");

  if (startDate) {
    const startIso = startDate.toISOString();
    platformRevenueQuery = platformRevenueQuery.gte("created_at", startIso);
    paymentsQuery = paymentsQuery.gte("created_at", startIso);
    transactionsQuery = transactionsQuery.gte("created_at", startIso);
    withdrawalsQuery = withdrawalsQuery.gte("created_at", startIso);
  }

  const [platformRevenueRes, paymentsRes, transactionsRes, withdrawalsRes] = await Promise.all([
    platformRevenueQuery,
    paymentsQuery,
    transactionsQuery,
    withdrawalsQuery,
  ]);

  type PlatformRevenueRow = { amount: number | null; created_at: string; source_type: string };
  type PaymentRow = { amount: number | null; status?: string | null; created_at: string };
  type TransactionRow = { amount: number | null; status?: string | null; created_at: string; type: string };
  type WithdrawalRow = { amount: number | null; status?: string | null; created_at: string; processed_at?: string | null };

  const platformRows: PlatformRevenueRow[] = platformRevenueRes.data ?? [];
  const paymentsRows: PaymentRow[] = paymentsRes.data ?? [];
  const transactionsRows: TransactionRow[] = transactionsRes.data ?? [];
  const withdrawalsRows: WithdrawalRow[] = withdrawalsRes.data ?? [];

  // Calculate platform cut from platform_revenue table (in centavos, convert to reais)
  const platformCut = sumAmounts(platformRows.map((row) => (row.amount ?? 0) / 100));

  // Calculate gross revenue from completed transactions or payments
  let grossRevenue = sumAmounts(
    transactionsRows.filter((row) => isCompletedPayment(row.status)).map((row) => row.amount),
  );
  
  // If no transactions, fallback to payments
  if (grossRevenue === 0) {
    grossRevenue = sumAmounts(
      paymentsRows.filter((row) => isCompletedPayment(row.status)).map((row) => row.amount),
    );
  }

  // Calculate creator payouts from withdrawals
  const creatorPayouts = sumAmounts(
    withdrawalsRows
      .filter((row) => isProcessedWithdrawal(row.status))
      .map((row) => row.amount),
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
      grossRevenue,
      platformCut,
      creatorPayouts,
    },
    series,
  };
};
